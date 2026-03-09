import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
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

// Serve React App for any other route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Data stored in: ${DB_FILE}`);
});
