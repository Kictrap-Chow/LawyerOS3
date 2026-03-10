import { clearPrefix, json, makeCosClient, normalizePrefix, putJsonObject } from './_cos-common.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method Not Allowed' });
  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const config = payload?.config || {};
    const data = payload?.data || {};
    const bucket = String(config.bucket || '').trim();
    const prefix = normalizePrefix(config.prefix || 'LawyerOS3');
    if (!bucket) return json(400, { ok: false, error: 'COS bucket is required' });

    const client = makeCosClient(config);
    const cases = Array.isArray(data.cases) ? data.cases : [];
    const parties = Array.isArray(data.parties) ? data.parties : [];
    const casesPrefix = `${prefix}/cases/`;
    const partiesPrefix = `${prefix}/parties/`;
    const caseIds = cases.map((item) => item.id).filter(Boolean);
    const partyIds = parties.map((item) => item.id).filter(Boolean);

    await clearPrefix(client, bucket, `${prefix}/`);

    for (const item of cases) {
      if (!item?.id) continue;
      await putJsonObject(client, bucket, `${casesPrefix}${item.id}.json`, item);
    }

    for (const item of parties) {
      if (!item?.id) continue;
      await putJsonObject(client, bucket, `${partiesPrefix}${item.id}.json`, item);
    }

    await putJsonObject(client, bucket, `${prefix}/manifest.json`, {
      version: 2,
      mode: 'segmented',
      updatedAt: new Date().toISOString(),
      caseCount: cases.length,
      partyCount: parties.length,
      caseIds,
      partyIds,
    });

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { ok: false, error: error?.message || 'COS push failed' });
  }
};

