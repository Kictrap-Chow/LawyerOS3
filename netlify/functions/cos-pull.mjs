import { json, makeCosClient, normalizePrefix, readJsonObject } from './_cos-common.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method Not Allowed' });
  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const config = payload?.config || {};
    const bucket = String(config.bucket || '').trim();
    const prefix = normalizePrefix(config.prefix || 'LawyerOS3');
    if (!bucket) return json(400, { ok: false, error: 'COS bucket is required' });

    const client = makeCosClient(config);
    const manifestKey = `${prefix}/manifest.json`;
    const casesPrefix = `${prefix}/cases/`;
    const partiesPrefix = `${prefix}/parties/`;

    const manifest = (await readJsonObject(client, bucket, manifestKey)) || {};
    const caseIds = Array.isArray(manifest.caseIds) ? manifest.caseIds : [];
    const partyIds = Array.isArray(manifest.partyIds) ? manifest.partyIds : [];

    const cases = [];
    for (const id of caseIds) {
      const row = await readJsonObject(client, bucket, `${casesPrefix}${id}.json`);
      if (row) cases.push(row);
    }

    const parties = [];
    for (const id of partyIds) {
      const row = await readJsonObject(client, bucket, `${partiesPrefix}${id}.json`);
      if (row) parties.push(row);
    }

    return json(200, { ok: true, data: { cases, parties, manifest } });
  } catch (error) {
    return json(500, { ok: false, error: error?.message || 'COS pull failed' });
  }
};

