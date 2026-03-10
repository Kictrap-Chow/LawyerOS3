import type { Case, Party } from '../types';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const COS_CONFIG_KEY = 'lawyerCosConfig_v1';

export type CosConfig = {
  secretId: string;
  secretKey: string;
  region: string;
  bucket: string;
  prefix: string;
};

export const emptyCosConfig = (): CosConfig => ({
  secretId: '',
  secretKey: '',
  region: '',
  bucket: '',
  prefix: 'LawyerOS3',
});

export const loadCosConfig = (): CosConfig => {
  try {
    const raw = localStorage.getItem(COS_CONFIG_KEY);
    if (!raw) return emptyCosConfig();
    const parsed = JSON.parse(raw);
    return {
      secretId: parsed?.secretId || '',
      secretKey: parsed?.secretKey || '',
      region: parsed?.region || '',
      bucket: parsed?.bucket || '',
      prefix: parsed?.prefix || 'LawyerOS3',
    };
  } catch {
    return emptyCosConfig();
  }
};

export const saveCosConfig = (config: CosConfig) => {
  localStorage.setItem(COS_CONFIG_KEY, JSON.stringify(config));
};

export const isCosConfigReady = (config: CosConfig) =>
  Boolean(config.secretId && config.secretKey && config.region && config.bucket);

const readJsonSafely = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
};

const normalizePrefix = (prefix = '') => String(prefix || '').replace(/^\/+|\/+$/g, '');

const makeCosClient = (config: CosConfig) =>
  new S3Client({
    region: config.region,
    endpoint: `https://cos.${config.region}.myqcloud.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.secretId,
      secretAccessKey: config.secretKey,
    },
  });

const bodyToText = async (body: any): Promise<string> => {
  if (!body) return '';
  if (typeof body.transformToString === 'function') return await body.transformToString();
  if (typeof Blob !== 'undefined' && body instanceof Blob) return await body.text();
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((acc, item) => acc + item.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(merged);
  }
  return String(body);
};

const readJsonObject = async (client: S3Client, bucket: string, key: string) => {
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await bodyToText((obj as any).Body);
    return JSON.parse(text || '{}');
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    const code = error?.Code || error?.name;
    if (status === 404 || code === 'NoSuchKey' || code === 'NotFound') return null;
    throw error;
  }
};

const clearPrefix = async (client: S3Client, bucket: string, prefix: string) => {
  let continuationToken: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    const objects = (listed.Contents || []).map((it) => ({ Key: it.Key })).filter((it) => it.Key);
    if (objects.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
};

const pullFromCosDirect = async (config: CosConfig): Promise<{ cases: Case[]; parties: Party[] }> => {
  const client = makeCosClient(config);
  const bucket = config.bucket.trim();
  const prefix = normalizePrefix(config.prefix || 'LawyerOS3');
  const manifest = (await readJsonObject(client, bucket, `${prefix}/manifest.json`)) || {};
  const caseIds = Array.isArray(manifest.caseIds) ? manifest.caseIds : [];
  const partyIds = Array.isArray(manifest.partyIds) ? manifest.partyIds : [];

  const cases: Case[] = [];
  for (const id of caseIds) {
    // eslint-disable-next-line no-await-in-loop
    const row = await readJsonObject(client, bucket, `${prefix}/cases/${id}.json`);
    if (row) cases.push(row as Case);
  }
  const parties: Party[] = [];
  for (const id of partyIds) {
    // eslint-disable-next-line no-await-in-loop
    const row = await readJsonObject(client, bucket, `${prefix}/parties/${id}.json`);
    if (row) parties.push(row as Party);
  }
  return { cases, parties };
};

const pushToCosDirect = async (config: CosConfig, payload: { cases: Case[]; parties: Party[] }) => {
  const client = makeCosClient(config);
  const bucket = config.bucket.trim();
  const prefix = normalizePrefix(config.prefix || 'LawyerOS3');
  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  const parties = Array.isArray(payload.parties) ? payload.parties : [];

  await clearPrefix(client, bucket, `${prefix}/`);

  for (const row of cases) {
    if (!row?.id) continue;
    // eslint-disable-next-line no-await-in-loop
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${prefix}/cases/${row.id}.json`,
      Body: JSON.stringify(row, null, 2),
      ContentType: 'application/json',
    }));
  }

  for (const row of parties) {
    if (!(row as any)?.id) continue;
    // eslint-disable-next-line no-await-in-loop
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${prefix}/parties/${(row as any).id}.json`,
      Body: JSON.stringify(row, null, 2),
      ContentType: 'application/json',
    }));
  }

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${prefix}/manifest.json`,
    Body: JSON.stringify({
      version: 2,
      mode: 'segmented',
      updatedAt: new Date().toISOString(),
      caseCount: cases.length,
      partyCount: parties.length,
      caseIds: cases.map((item) => item.id).filter(Boolean),
      partyIds: parties.map((item: any) => item.id).filter(Boolean),
    }, null, 2),
    ContentType: 'application/json',
  }));
};

export const pullFromCos = async (config: CosConfig): Promise<{ cases: Case[]; parties: Party[] }> => {
  const res = await fetch('/api/cos/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  const json = await readJsonSafely(res);
  if (res.status === 404) {
    try {
      return await pullFromCosDirect(config);
    } catch (error: any) {
      throw new Error(`COS 直连失败：${error?.message || '请检查 Bucket CORS 与密钥权限'}`);
    }
  }
  if (!res.ok || !json?.ok) throw new Error(json?.error || `COS pull failed (HTTP ${res.status})`);
  return {
    cases: Array.isArray(json.data?.cases) ? json.data.cases : [],
    parties: Array.isArray(json.data?.parties) ? json.data.parties : [],
  };
};

export const pushToCos = async (config: CosConfig, payload: { cases: Case[]; parties: Party[] }) => {
  const res = await fetch('/api/cos/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, data: payload }),
  });
  const json = await readJsonSafely(res);
  if (res.status === 404) {
    try {
      await pushToCosDirect(config, payload);
      return;
    } catch (error: any) {
      throw new Error(`COS 直连失败：${error?.message || '请检查 Bucket CORS 与密钥权限'}`);
    }
  }
  if (!res.ok || !json?.ok) throw new Error(json?.error || `COS push failed (HTTP ${res.status})`);
};
