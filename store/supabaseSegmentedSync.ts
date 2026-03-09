import type { SupabaseClient } from '@supabase/supabase-js';
import type { Case, Party } from '../types';

type SegmentedManifest = {
  version: number;
  mode: 'segmented';
  updatedAt: string;
  caseCount: number;
  partyCount: number;
  caseIds: string[];
  partyIds: string[];
};

type ManifestMeta = {
  updatedAt: string;
  caseCount: number;
  partyCount: number;
};

type PullResult = {
  cases: Case[];
  parties: Party[];
  manifestUpdatedAt: string | null;
  hasRemoteData: boolean;
};

const toJsonBlob = (value: unknown) =>
  new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });

const isNotFoundError = (error: any) => {
  const status = error?.statusCode ?? error?.status;
  return status === 404 || status === '404';
};

const getManifestPath = (ownerId: string) => `${ownerId}/manifest.json`;
const getCasesPath = (ownerId: string) => `${ownerId}/cases`;
const getPartiesPath = (ownerId: string) => `${ownerId}/parties`;

const parseJsonBlob = async <T>(blob: Blob): Promise<T> => {
  const text = await blob.text();
  return JSON.parse(text) as T;
};

const downloadJson = async <T>(
  supabaseClient: SupabaseClient,
  bucket: string,
  path: string
): Promise<T | null> => {
  const { data, error } = await supabaseClient.storage.from(bucket).download(path);
  if (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
  return parseJsonBlob<T>(data);
};

const uploadJson = async (
  supabaseClient: SupabaseClient,
  bucket: string,
  path: string,
  value: unknown
) => {
  const { error } = await supabaseClient.storage.from(bucket).upload(path, toJsonBlob(value), {
    upsert: true,
    contentType: 'application/json',
  });
  if (error) throw error;
};

const listAll = async (
  supabaseClient: SupabaseClient,
  bucket: string,
  prefix: string
) => {
  const all: Array<{ name: string }> = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseClient.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      if (isNotFoundError(error)) return [];
      throw error;
    }
    const batch = (data || []).filter((item) => item.name && !item.name.endsWith('/'));
    all.push(...batch.map((item) => ({ name: item.name })));
    if (batch.length < 1000) break;
    offset += 1000;
  }

  return all;
};

const readObjectsByIds = async <T>(
  supabaseClient: SupabaseClient,
  bucket: string,
  basePath: string,
  ids: string[]
): Promise<T[]> => {
  const rows = await Promise.all(
    ids.map(async (id) => {
      const payload = await downloadJson<T>(supabaseClient, bucket, `${basePath}/${id}.json`);
      return payload;
    })
  );
  return rows.filter(Boolean) as T[];
};

const listIdsFromPath = async (
  supabaseClient: SupabaseClient,
  bucket: string,
  basePath: string
) => {
  const files = await listAll(supabaseClient, bucket, basePath);
  return files
    .map((item) => item.name)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5));
};

const removeStaleFiles = async (
  supabaseClient: SupabaseClient,
  bucket: string,
  basePath: string,
  keepIds: Set<string>
) => {
  const existing = await listIdsFromPath(supabaseClient, bucket, basePath);
  const stale = existing.filter((id) => !keepIds.has(id));
  if (!stale.length) return;
  const paths = stale.map((id) => `${basePath}/${id}.json`);
  const { error } = await supabaseClient.storage.from(bucket).remove(paths);
  if (error) throw error;
};

export const readSupabaseSegmentedManifestMeta = async (
  supabaseClient: SupabaseClient,
  bucket: string,
  ownerId: string
): Promise<ManifestMeta | null> => {
  const manifest = await downloadJson<SegmentedManifest>(supabaseClient, bucket, getManifestPath(ownerId));
  if (!manifest || manifest.mode !== 'segmented') return null;
  return {
    updatedAt: manifest.updatedAt,
    caseCount: manifest.caseCount || 0,
    partyCount: manifest.partyCount || 0,
  };
};

export const pullSupabaseSegmented = async (
  supabaseClient: SupabaseClient,
  bucket: string,
  ownerId: string
): Promise<PullResult> => {
  const manifest = await downloadJson<SegmentedManifest>(supabaseClient, bucket, getManifestPath(ownerId));
  const casesPath = getCasesPath(ownerId);
  const partiesPath = getPartiesPath(ownerId);

  let caseIds: string[] = [];
  let partyIds: string[] = [];

  if (manifest?.mode === 'segmented') {
    caseIds = Array.isArray(manifest.caseIds) ? manifest.caseIds : [];
    partyIds = Array.isArray(manifest.partyIds) ? manifest.partyIds : [];
  } else {
    caseIds = await listIdsFromPath(supabaseClient, bucket, casesPath);
    partyIds = await listIdsFromPath(supabaseClient, bucket, partiesPath);
  }

  const [cases, parties] = await Promise.all([
    readObjectsByIds<Case>(supabaseClient, bucket, casesPath, caseIds),
    readObjectsByIds<Party>(supabaseClient, bucket, partiesPath, partyIds),
  ]);

  return {
    cases,
    parties,
    manifestUpdatedAt: manifest?.updatedAt || null,
    hasRemoteData: cases.length > 0 || parties.length > 0,
  };
};

export const pushSupabaseSegmented = async (
  supabaseClient: SupabaseClient,
  bucket: string,
  ownerId: string,
  payload: { cases: Case[]; parties: Party[] }
) => {
  const casesPath = getCasesPath(ownerId);
  const partiesPath = getPartiesPath(ownerId);

  await Promise.all([
    Promise.all(
      payload.cases.map((item) => uploadJson(supabaseClient, bucket, `${casesPath}/${item.id}.json`, item))
    ),
    Promise.all(
      payload.parties.map((item) => uploadJson(supabaseClient, bucket, `${partiesPath}/${item.id}.json`, item))
    ),
  ]);

  await Promise.all([
    removeStaleFiles(supabaseClient, bucket, casesPath, new Set(payload.cases.map((item) => item.id))),
    removeStaleFiles(supabaseClient, bucket, partiesPath, new Set(payload.parties.map((item) => item.id))),
  ]);

  await uploadJson(supabaseClient, bucket, getManifestPath(ownerId), {
    version: 2,
    mode: 'segmented',
    updatedAt: new Date().toISOString(),
    caseCount: payload.cases.length,
    partyCount: payload.parties.length,
    caseIds: payload.cases.map((item) => item.id),
    partyIds: payload.parties.map((item) => item.id),
  } satisfies SegmentedManifest);
};
