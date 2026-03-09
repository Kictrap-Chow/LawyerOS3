import { Case, Party } from '../types';

const DB_NAME = 'lawyeros-local-sync';
const STORE_NAME = 'kv';
const HANDLE_KEY = 'icloud-json-handle';
const ENABLED_KEY = 'lawyerLocalFileSyncEnabled';

type AppPayload = { cases: Case[]; parties: Party[] };

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

export const isLocalFileSyncSupported = () =>
  typeof window !== 'undefined' &&
  'indexedDB' in window &&
  'showOpenFilePicker' in window &&
  'showSaveFilePicker' in window;

export const getLocalFileSyncEnabled = () =>
  typeof window !== 'undefined' && localStorage.getItem(ENABLED_KEY) === '1';

export const setLocalFileSyncEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
};

export const getBoundFileHandle = async (): Promise<FileSystemFileHandle | null> => {
  try {
    return await idbGet<FileSystemFileHandle>(HANDLE_KEY);
  } catch {
    return null;
  }
};

export const setBoundFileHandle = async (handle: FileSystemFileHandle) => {
  await idbSet(HANDLE_KEY, handle);
};

export const clearBoundFileHandle = async () => {
  await idbDel(HANDLE_KEY);
};

const ensurePermission = async (
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite'
): Promise<boolean> => {
  const opts = { mode } as FileSystemHandlePermissionDescriptor;
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
};

export const canReadWriteHandle = async (handle: FileSystemFileHandle): Promise<boolean> => {
  try {
    return await ensurePermission(handle, 'readwrite');
  } catch {
    return false;
  }
};

export const readPayloadFromHandle = async (handle: FileSystemFileHandle): Promise<AppPayload> => {
  const file = await handle.getFile();
  const text = await file.text();
  const raw = JSON.parse(text || '{}');
  const cases = Array.isArray(raw?.cases) ? raw.cases : [];
  const parties = Array.isArray(raw?.parties) ? raw.parties : [];
  return { cases, parties };
};

export const writePayloadToHandle = async (
  handle: FileSystemFileHandle,
  payload: AppPayload
): Promise<void> => {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
};

export const pickExistingJsonFile = async (): Promise<FileSystemFileHandle> => {
  const [handle] = await (window as any).showOpenFilePicker({
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    excludeAcceptAllOption: false,
    multiple: false,
  });
  return handle;
};

export const createAndPickJsonFile = async (suggestedName: string): Promise<FileSystemFileHandle> => {
  const handle = await (window as any).showSaveFilePicker({
    suggestedName,
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  });
  return handle;
};
