import type { Case, Party } from '../types';

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

export const pullFromCos = async (config: CosConfig): Promise<{ cases: Case[]; parties: Party[] }> => {
  const res = await fetch('/api/cos/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  const json = await readJsonSafely(res);
  if (res.status === 404) {
    throw new Error('未找到 COS API。当前是纯静态模式，请改用服务端模式启动：npm run build && npm run start:3001');
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
    throw new Error('未找到 COS API。当前是纯静态模式，请改用服务端模式启动：npm run build && npm run start:3001');
  }
  if (!res.ok || !json?.ok) throw new Error(json?.error || `COS push failed (HTTP ${res.status})`);
};
