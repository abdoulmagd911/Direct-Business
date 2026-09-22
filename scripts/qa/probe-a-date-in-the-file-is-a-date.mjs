/* probe-a-date-in-the-file-is-a-date.mjs — an exported date is readable, whatever the column is
   called and however deeply it is buried.

   Fire #217. The Clients "full details" export was taken from the LIVE database and read column by
   column. Two cells in it were machine numbers:

       lastContact   1758…                     bare, on 11 of the 28 clients
       activities    "1758… Call Completed …"  the same 11, once per logged activity

   `exportFlat` recognised a date by the NAME of its column — a key ending At / _at / Date / date /
   Ts / ts — so a millisecond timestamp stored under any other name went into the spreadsheet as a
   13-digit number, and the nested path (a list of activities flattened into one cell) never looked
   at dates at all. A person opening that file cannot read it, and a spreadsheet cannot sort it as a
   date either. probe-export-records already held the named columns (createdAt on Operations and
   Projects, fire from 2026-09-02); this holds the two cases it could not see.

   Fixed: an epoch is recognised by its VALUE, at the top level and nested.

   What this holds, on a seeded client whose dates sit in columns named nothing like a date:
     1. no cell in the file is a bare millisecond timestamp;
     2. no cell CONTAINS one either — the nested case, which is the half that was never covered;
     3. the unnamed date column reads as a date-time (YYYY-MM-DD HH:MM);
     4. the activity line reads as a date-time too;
     5. the brake: a 10-digit registration number is still a registration number — the fix must not
        turn every long number into a date;
     6. the brake's other half: a 12-digit number is left alone as well. This is the reason the
        unnamed window is exactly 13 digits: a Saudi mobile written as bare digits with its country
        code is 12, and a company registration number is 10, so neither can be read as a date;
     7. Arabic: the same file in Arabic carries no machine number either;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · restoring the name-gated epoch branch — fails 1, 2, 3, 4 and 7, printing the cell back as
       "1757000000000 Call Completed …";
     · widening the unnamed window to 1e9 (the careless version of the fix) — fails 5 and 6, with
       the registration number and the 12-digit number rewritten as dates in 1970 and 1973.
   Run: node scripts/qa/probe-a-date-in-the-file-is-a-date.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9246 — one mock. */
const PORT = 9246; const BASE = 'http://localhost:' + PORT;

/* fixed instants, so the expected text is a constant and not a function of when this runs */
const MS_TOP = 1758000000000;   /* 2025-09-16 05:20 UTC */
const MS_ACT = 1757000000000;   /* 2025-09-04 15:33 UTC */
const CR_10 = 1010000000;       /* ten digits — a registration number, not a date */
const N_12 = 123456789012;      /* twelve digits — the boundary the window must not cross */
const asText = (ms) => { const d = new Date(ms); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 16); };

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB', acceptDownloads: true });
await ctx.addInitScript(() => {
  window.__caps = [];
  try { const _co = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (bl) { try { bl.text().then((t) => window.__caps.push(t)); } catch (_) {} return _co(bl); }; } catch (_) {}
  try { const _ac = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) return; return _ac.apply(this, arguments); }; } catch (_) {}
});
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

/* one client carrying a date in a column named nothing like a date, a date nested inside a list,
   and two long numbers that are NOT dates */
const seeded = await p.evaluate(([msTop, msAct, cr, n12]) => {
  try {
    const B = DB.businesses || []; const src = B.find((x) => x.isClient) || B[0]; if (!src) return { ok: false };
    const c = JSON.parse(JSON.stringify(src));
    c.id = 'qa_dates'; c.isClient = true; c.name = 'QADATES Company'; c.stage = 'Won'; c.status = 'Won';
    c.lastContact = msTop;
    c.activities = [{ date: msAct, type: 'Call', status: 'Completed', note: 'QA seeded line', by: 'QA' }];
    c.qaRegistration = cr; c.qaLongNumber = n12;
    if (c.raw) c.raw = {};
    B.push(c);
    return { ok: true };
  } catch (e) { return { ok: false, err: e.message }; }
}, [MS_TOP, MS_ACT, CR_10, N_12]);
await p.waitForTimeout(400);

const exportNow = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang();
    window.__caps = []; current = 'clients'; openLead = null; render(); } catch (_) {} }, lang);
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { expGo('full'); } catch (_) {} });
  await p.waitForTimeout(1400);
  return (await p.evaluate(() => window.__caps[window.__caps.length - 1])) || '';
};
const en = await exportNow('en');
const ar = await exportNow('ar');
await b.close(); srv.close?.();

/* the seeded row, as text — enough to look inside its cells without parsing the whole file */
const rowOf = (txt) => String(txt || '').split('\n').find((l) => /QADATES Company/.test(l)) || '';
const cellsOf = (txt) => (rowOf(txt).match(/"(?:[^"]|"")*"/g) || []).map((s) => s.slice(1, -1).replace(/""/g, '"'));
const enCells = cellsOf(en), arCells = cellsOf(ar);
const bareMs = (cells) => cells.filter((c) => /^\d{13}$/.test(c.trim()));
const holdsMs = (cells) => cells.filter((c) => !/^\d{13}$/.test(c.trim()) && /(^|[^\d])\d{13}([^\d]|$)/.test(c));
const anyCell = (cells, re) => cells.some((c) => re.test(c));

const checks = [
  ['no cell is a bare millisecond timestamp',
    enCells.length > 5 && bareMs(enCells).length === 0,
    JSON.stringify({ cells: enCells.length, bare: bareMs(enCells).length, seeded })],
  ['no cell contains one either — the nested case',
    holdsMs(enCells).length === 0,
    JSON.stringify(holdsMs(enCells).map((c) => c.slice(0, 60)))],
  ['the unnamed date column reads as a date-time',
    anyCell(enCells, new RegExp('^' + asText(MS_TOP).replace(/[-: ]/g, '[-: ]') + '$')),
    JSON.stringify({ expected: asText(MS_TOP), got: enCells.filter((c) => /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(c)) })],
  ['the activity line reads as a date-time too',
    anyCell(enCells, new RegExp(asText(MS_ACT).replace(/[-: ]/g, '[-: ]') + '.*QA seeded line')),
    JSON.stringify({ expected: asText(MS_ACT), activityCell: (enCells.find((c) => /QA seeded line/.test(c)) || '').slice(0, 80) })],
  ['brake: a 10-digit registration number is still a number',
    anyCell(enCells, new RegExp('^' + CR_10 + '$')),
    JSON.stringify({ looking_for: String(CR_10), found: anyCell(enCells, new RegExp('^' + CR_10 + '$')) })],
  ['brake: a 12-digit number is left alone as well',
    anyCell(enCells, new RegExp('^' + N_12 + '$')),
    JSON.stringify({ looking_for: String(N_12), found: anyCell(enCells, new RegExp('^' + N_12 + '$')) })],
  ['Arabic: the same file carries no machine number either',
    arCells.length > 5 && bareMs(arCells).length === 0 && holdsMs(arCells).length === 0,
    JSON.stringify({ cells: arCells.length, bare: bareMs(arCells).length, inside: holdsMs(arCells).length })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
