import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');

const escapeIcs = (s = '') =>
  String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

const dtStamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

const toLocalDateTime = (dateStr, timeStr = '09:00') => {
  const [y, m, d] = (dateStr || '').split('-');
  const [hh, mm] = (timeStr || '09:00').split(':');
  if (!y || !m || !d) return '';
  return `${y}${m}${d}T${String(hh || '09').padStart(2, '0')}${String(mm || '00').padStart(2, '0')}00`;
};

const toDateOnly = (dateStr) => (dateStr || '').replace(/-/g, '');

const nextDateOnly = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
};

const buildIcs = (cases = []) => {
  const stamp = dtStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LawyerOS//Case Calendar//CN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:LawyerOS Schedule',
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  cases.forEach((c) => {
    const caseName = c?.name || '案件';
    (c?.reminders || []).forEach((r) => {
      const dt = toLocalDateTime(r.date, r.time || '09:00');
      if (!dt) return;
      lines.push(
        'BEGIN:VEVENT',
        `UID:rem-${c.id}-${r.id}@lawyeros`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${dt}`,
        `DTEND:${dt}`,
        `SUMMARY:${escapeIcs(r.title || '日程')} - ${escapeIcs(caseName)}`,
        `DESCRIPTION:${escapeIcs(`案件：${caseName}`)}`,
        'END:VEVENT'
      );
    });

    (c?.deadlines || []).forEach((d) => {
      if (d.completed || !d.date) return;
      const start = toDateOnly(d.date);
      const end = nextDateOnly(d.date);
      if (!start || !end) return;
      lines.push(
        'BEGIN:VEVENT',
        `UID:ddl-${c.id}-${d.id}@lawyeros`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${escapeIcs(d.title || '期限')} - ${escapeIcs(caseName)}`,
        `DESCRIPTION:${escapeIcs(`案件：${caseName}`)}`,
        'END:VEVENT'
      );
    });
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
};

const normalizePrefix = (prefix = '') => String(prefix || '').replace(/^\/+|\/+$/g, '');

const makeCosClient = (config) => {
  const region = String(config?.region || '').trim();
  const secretId = String(config?.secretId || '').trim();
  const secretKey = String(config?.secretKey || '').trim();
  if (!region || !secretId || !secretKey) {
    throw new Error('COS config incomplete');
  }
  return new S3Client({
    region,
    endpoint: `https://cos.${region}.myqcloud.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: secretId,
      secretAccessKey: secretKey,
    },
  });
};

const streamToString = async (stream) =>
  await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const readJsonObject = async (client, bucket, key) => {
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await streamToString(obj.Body);
    return JSON.parse(text || '{}');
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const code = error?.Code || error?.name;
    if (status === 404 || code === 'NoSuchKey' || code === 'NotFound') return null;
    throw error;
  }
};

const putJsonObject = async (client, bucket, key, value) => {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: 'application/json',
    })
  );
};

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use((req, res, next) => {
  if (req.path === '/sw.js' || req.path === '/index.html' || req.path === '/manifest.webmanifest') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'dist')));

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ cases: [], parties: [] }, null, 2));
}

// API Routes
app.get('/api/data', (req, res) => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json({ cases: [], parties: [] });
    }
  } catch (err) {
    console.error('Error reading database:', err);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

app.post('/api/data', (req, res) => {
  try {
    const data = req.body;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Error writing database:', err);
    res.status(500).json({ error: 'Failed to save database' });
  }
});

app.get('/api/calendar.ics', (req, res) => {
  try {
    const data = fs.existsSync(DB_FILE)
      ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
      : { cases: [] };
    const ics = buildIcs(Array.isArray(data?.cases) ? data.cases : []);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(ics);
  } catch (err) {
    console.error('Error building ics:', err);
    res.status(500).send('Failed to generate calendar feed');
  }
});

app.post('/api/cos/pull', async (req, res) => {
  try {
    const config = req.body?.config || {};
    const bucket = String(config.bucket || '').trim();
    const prefix = normalizePrefix(config.prefix || 'LawyerOS3');
    if (!bucket) return res.status(400).json({ ok: false, error: 'COS bucket is required' });
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

    return res.json({ ok: true, data: { cases, parties, manifest } });
  } catch (error) {
    console.error('COS pull failed:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'COS pull failed' });
  }
});

app.post('/api/cos/push', async (req, res) => {
  try {
    const config = req.body?.config || {};
    const data = req.body?.data || {};
    const bucket = String(config.bucket || '').trim();
    const prefix = normalizePrefix(config.prefix || 'LawyerOS3');
    if (!bucket) return res.status(400).json({ ok: false, error: 'COS bucket is required' });

    const client = makeCosClient(config);
    const cases = Array.isArray(data.cases) ? data.cases : [];
    const parties = Array.isArray(data.parties) ? data.parties : [];

    const casesPrefix = `${prefix}/cases/`;
    const partiesPrefix = `${prefix}/parties/`;
    const caseIds = cases.map((item) => item.id).filter(Boolean);
    const partyIds = parties.map((item) => item.id).filter(Boolean);

    for (const item of cases) {
      if (!item?.id) continue;
      await putJsonObject(client, bucket, `${casesPrefix}${item.id}.json`, item);
    }
    for (const item of parties) {
      if (!item?.id) continue;
      await putJsonObject(client, bucket, `${partiesPrefix}${item.id}.json`, item);
    }

    const listAndDeleteStale = async (objPrefix, keepSet) => {
      const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: objPrefix }));
      const staleKeys = (listed.Contents || [])
        .map((obj) => obj.Key)
        .filter((key) => key && key.endsWith('.json'))
        .filter((key) => {
          const id = key.replace(objPrefix, '').replace(/\.json$/, '');
          return !keepSet.has(id);
        });
      if (!staleKeys.length) return;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: staleKeys.map((Key) => ({ Key })) },
        })
      );
    };

    await listAndDeleteStale(casesPrefix, new Set(caseIds));
    await listAndDeleteStale(partiesPrefix, new Set(partyIds));

    const manifest = {
      version: 2,
      mode: 'segmented',
      updatedAt: new Date().toISOString(),
      caseCount: caseIds.length,
      partyCount: partyIds.length,
      caseIds,
      partyIds,
    };
    await putJsonObject(client, bucket, `${prefix}/manifest.json`, manifest);
    return res.json({ ok: true, data: { manifest } });
  } catch (error) {
    console.error('COS push failed:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'COS push failed' });
  }
});

// Serve React App for any other route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Data stored in: ${DB_FILE}`);
});
