import { Case, Party } from '../types';

const DB_NAME = 'lawyeros-local-sync';
const STORE_NAME = 'kv';
const HANDLE_KEY = 'icloud-sync-handle';
const KIND_KEY = 'icloud-sync-kind';
const ENABLED_KEY = 'lawyerLocalFileSyncEnabled';

export type AppPayload = { cases: Case[]; parties: Party[] };
export type LocalSyncTargetKind = 'file' | 'directory';
export type LocalSyncTarget =
  | { kind: 'file'; handle: FileSystemFileHandle }
  | { kind: 'directory'; handle: FileSystemDirectoryHandle };

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbGet = async <T,>(key: string): Promise<T | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const idbSet = async <T,>(key: string, value: T): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbDel = async (key: string): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const ensurePermission = async (
  handle: FileSystemFileHandle | FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite'
): Promise<boolean> => {
  const opts = { mode } as FileSystemHandlePermissionDescriptor;
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
};

const readJsonFile = async <T,>(
  dir: FileSystemDirectoryHandle,
  fileName: string
): Promise<T | null> => {
  try {
    const handle = await dir.getFileHandle(fileName, { create: false });
    const file = await handle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const writeJsonFile = async (
  dir: FileSystemDirectoryHandle,
  fileName: string,
  value: unknown
) => {
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(value, null, 2));
  await writable.close();
};

const ensureSubDir = async (
  root: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> => root.getDirectoryHandle(name, { create: true });

const cleanupStaleFiles = async (
  dir: FileSystemDirectoryHandle,
  keepIds: Set<string>
) => {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'file') continue;
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -5);
    if (!keepIds.has(id)) {
      try {
        await dir.removeEntry(name);
      } catch {
        // ignore deletion failures
      }
    }
  }
};

const readPayloadFromFile = async (handle: FileSystemFileHandle): Promise<AppPayload> => {
  const file = await handle.getFile();
  const text = await file.text();
  const raw = JSON.parse(text || '{}');
  const cases = Array.isArray(raw?.cases) ? raw.cases : [];
  const parties = Array.isArray(raw?.parties) ? raw.parties : [];
  return { cases, parties };
};

const readPayloadFromDirectory = async (root: FileSystemDirectoryHandle): Promise<AppPayload> => {
  const manifest = await readJsonFile<any>(root, 'manifest.json');

  if (manifest?.mode === 'segmented') {
    const casesDir = await root.getDirectoryHandle('cases', { create: true });
    const partiesDir = await root.getDirectoryHandle('parties', { create: true });

    const cases: Case[] = [];
    const parties: Party[] = [];

    for await (const [, handle] of casesDir.entries()) {
      if (handle.kind !== 'file') continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      if (!file.name.endsWith('.json')) continue;
      try {
        const raw = JSON.parse(await file.text());
        if (raw && typeof raw === 'object') cases.push(raw as Case);
      } catch {
        // ignore broken single file
      }
    }

    for await (const [, handle] of partiesDir.entries()) {
      if (handle.kind !== 'file') continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      if (!file.name.endsWith('.json')) continue;
      try {
        const raw = JSON.parse(await file.text());
        if (raw && typeof raw === 'object') parties.push(raw as Party);
      } catch {
        // ignore broken single file
      }
    }
    return { cases, parties };
  }

  // Compatibility fallback: single-json mode inside directory root.
  for await (const [, handle] of root.entries()) {
    if (handle.kind !== 'file') continue;
    const file = await (handle as FileSystemFileHandle).getFile();
    if (!file.name.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(await file.text());
      if (Array.isArray(raw?.cases) || Array.isArray(raw?.parties)) {
        return {
          cases: Array.isArray(raw?.cases) ? raw.cases : [],
          parties: Array.isArray(raw?.parties) ? raw.parties : [],
        };
      }
    } catch {
      // try next json file
    }
  }

  return { cases: [], parties: [] };
};

const writePayloadToFile = async (handle: FileSystemFileHandle, payload: AppPayload) => {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
};

const writePayloadToDirectory = async (root: FileSystemDirectoryHandle, payload: AppPayload) => {
  const casesDir = await ensureSubDir(root, 'cases');
  const partiesDir = await ensureSubDir(root, 'parties');

  for (const c of payload.cases) {
    await writeJsonFile(casesDir, `${c.id}.json`, c);
  }
  for (const p of payload.parties) {
    await writeJsonFile(partiesDir, `${p.id}.json`, p);
  }

  await cleanupStaleFiles(casesDir, new Set(payload.cases.map((x) => x.id)));
  await cleanupStaleFiles(partiesDir, new Set(payload.parties.map((x) => x.id)));

  await writeJsonFile(root, 'manifest.json', {
    version: 2,
    mode: 'segmented',
    updatedAt: new Date().toISOString(),
    caseCount: payload.cases.length,
    partyCount: payload.parties.length,
    caseIds: payload.cases.map((x) => x.id),
    partyIds: payload.parties.map((x) => x.id),
  });
};

export const isLocalFileSyncSupported = () =>
  typeof window !== 'undefined' &&
  'indexedDB' in window &&
  ('showDirectoryPicker' in window || 'showOpenFilePicker' in window);

export const getLocalFileSyncEnabled = () =>
  typeof window !== 'undefined' && localStorage.getItem(ENABLED_KEY) === '1';

export const setLocalFileSyncEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
};

export const getBoundSyncTarget = async (): Promise<LocalSyncTarget | null> => {
  try {
    const kind = await idbGet<LocalSyncTargetKind>(KIND_KEY);
    const handle = await idbGet<FileSystemFileHandle | FileSystemDirectoryHandle>(HANDLE_KEY);
    if (!kind || !handle) return null;
    if (kind === 'file') return { kind, handle: handle as FileSystemFileHandle };
    return { kind, handle: handle as FileSystemDirectoryHandle };
  } catch {
    return null;
  }
};

export const setBoundSyncFileTarget = async (handle: FileSystemFileHandle) => {
  await idbSet(KIND_KEY, 'file');
  await idbSet(HANDLE_KEY, handle);
};

export const setBoundSyncDirectoryTarget = async (handle: FileSystemDirectoryHandle) => {
  await idbSet(KIND_KEY, 'directory');
  await idbSet(HANDLE_KEY, handle);
};

export const clearBoundSyncTarget = async () => {
  await idbDel(KIND_KEY);
  await idbDel(HANDLE_KEY);
};

export const canReadWriteTarget = async (target: LocalSyncTarget): Promise<boolean> => {
  try {
    return await ensurePermission(target.handle, 'readwrite');
  } catch {
    return false;
  }
};

export const readPayloadFromTarget = async (target: LocalSyncTarget): Promise<AppPayload> => {
  if (target.kind === 'file') return readPayloadFromFile(target.handle);
  return readPayloadFromDirectory(target.handle);
};

export const writePayloadToTarget = async (
  target: LocalSyncTarget,
  payload: AppPayload
): Promise<void> => {
  if (target.kind === 'file') {
    await writePayloadToFile(target.handle, payload);
    return;
  }
  await writePayloadToDirectory(target.handle, payload);
};

export const getTargetName = (target: LocalSyncTarget | null) => {
  if (!target) return null;
  if (target.kind === 'directory') return `${target.handle.name}/`;
  return target.handle.name;
};

export const pickExistingJsonFile = async (): Promise<LocalSyncTarget> => {
  const [handle] = await (window as any).showOpenFilePicker({
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    excludeAcceptAllOption: false,
    multiple: false,
  });
  return { kind: 'file', handle };
};

export const createAndPickJsonFile = async (suggestedName: string): Promise<LocalSyncTarget> => {
  const handle = await (window as any).showSaveFilePicker({
    suggestedName,
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  });
  return { kind: 'file', handle };
};

export const pickSyncDirectory = async (): Promise<LocalSyncTarget> => {
  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  return { kind: 'directory', handle };
};
