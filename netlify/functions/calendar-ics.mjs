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

export default async (req) => {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const ownerId = process.env.CALENDAR_OWNER_ID;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const requiredToken = process.env.CALENDAR_FEED_TOKEN;

    if (!url || !ownerId) {
      return new Response('Missing VITE_SUPABASE_URL or CALENDAR_OWNER_ID', { status: 500 });
    }
    if (requiredToken && req.queryStringParameters?.token !== requiredToken) {
      return new Response('Unauthorized', { status: 401 });
    }
    const key = serviceRole || anonKey;
    if (!key) {
      return new Response('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY', { status: 500 });
    }

    const endpoint = `${url}/rest/v1/cases?select=id,data&owner_id=eq.${encodeURIComponent(ownerId)}&order=updated_at.desc`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!res.ok) {
      const msg = await res.text();
      return new Response(`Supabase query failed: ${msg}`, { status: 500 });
    }

    const rows = await res.json();
    const cases = (rows || []).map((r) => ({ ...(r?.data || {}), id: r?.id }));
    const ics = buildIcs(cases);

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response(`Calendar feed error: ${err?.message || 'unknown'}`, { status: 500 });
  }
};

