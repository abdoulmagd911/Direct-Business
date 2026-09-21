/* probe-today-on-the-audit-log-means-today.mjs — a tile labelled "Today" is a promise about a
   calendar day, not about the last twenty-four hours.

   Fire #187. Activity & Audit carries three figures: Events loaded · Today · 7-day. Both of the
   last two were rolling windows — `Date.now() - at < 86400000` under a tile that says **Today**.

   Read off the live log at 02:30 UTC on 21 September, the **Today tile said 21 and every one of
   those 21 changes was dated the 20th**: the tile claimed today and today's real figure was nought.
   Direct works at UTC+3, so at 09:00 in Riyadh a rolling twenty-four hours reaches back to 09:00
   YESTERDAY — a manager asking "what changed today" was reading most of yesterday's work, with
   nothing to tell them so. The 7-day figure had the same shape and dropped from 91 to 86 once
   corrected, because the rolling version was reaching into an eighth day.

   Both are now calendar days from local midnight, which is what both labels say.

   What this holds:
     1. a change made YESTERDAY is not counted under Today;
     2. a change made TODAY is;
     3. 7-day spans seven calendar days: six days ago counts, eight days ago does not, and
        neither does a change dated seven days ago that a rolling 168-hour window would still
        have caught — that last row is the one that tells the two readings apart;
     4. when nothing has happened today and the log is not empty, the tile says so in words and
        says how long ago the last change was — a bare 0 reads as "the log is broken";
     5. when something HAS happened today, that line is absent;
     6. "Events loaded" still counts every row loaded, whatever day it falls on;
     7. in Arabic the tile labels and that line are Arabic;
     8. no JS errors.

   Checks 2, 5 and 6 are the brakes. A tile hard-wired to nought would pass 1 and 4; a note that
   always shows would pass 4 and make the page worse; and narrowing the windows must not narrow the
   total, which is the one figure that is meant to count everything.

   The fixture's timestamps are built at run time from the browser's own midnight, and the browser
   is pinned to UTC so the probe and the page agree about when the day starts. Nothing here is
   dated by hand, so it cannot go stale tomorrow.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the
   rolling `Date.now() - at < 86400000` windows back fails checks 1, 2, 3, 4 and 7 — check 1
   reporting a Today of 1 when the only change was yesterday.
   Run: node scripts/qa/probe-today-on-the-audit-log-means-today.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9204; const BASE = 'http://localhost:' + PORT;

/* UTC midnight, because the browser below is pinned to UTC */
const now = new Date();
const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const D = 86400000;
const iso = (ms) => new Date(ms).toISOString();

const hist = (id, ms, extra) => Object.assign({
  id, at: iso(ms), actor: 'u-qa', actor_name: 'QA Test Account', table_name: 'businesses',
  record_id: 'b' + id, action: 'edit', before_row: { id: 'b' + id, stage: 'new' },
  after_row: { id: 'b' + id, stage: 'contacted' }, undone_at: null, undone_by: null,
}, extra || {});

/* one minute past midnight is always today and always already past, whatever hour this runs */
const TODAY_MS = dayStart + 60000;
const ROWS_QUIET = [
  hist(1, dayStart - 3 * 3600000),        /* yesterday, 3h before midnight */
  hist(2, dayStart - 6 * D + 3600000),    /* six days ago — inside seven calendar days */
  hist(3, dayStart - 8 * D),              /* eight days ago — outside either reading */
  /* The discriminator for check 3, and it has to be there: five minutes inside a ROLLING 168
     hours, but dated seven days ago, so outside seven CALENDAR days. Without it the two readings
     agree on this fixture and check 3 passes against the old code — which is exactly what the
     first sabotage run showed. */
  hist(6, Date.now() - 7 * D + 5 * 60000),
];
const ROWS_BUSY = ROWS_QUIET.concat([hist(4, TODAY_MS), hist(5, TODAY_MS + 60000)]);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(rows, port, arabic) {
  const srv = start(port, { record_history: rows });
  const base = 'http://localhost:' + port;
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB', timezoneId: 'UTC' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(base + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(base + '/activity', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(2500);
  if (arabic) { await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }); await p.waitForTimeout(1200); }
  const out = await p.evaluate(() => {
    try { current = 'activity'; openLead = null; render(); } catch (_) {}
    return new Promise((res) => setTimeout(() => {
      const v = document.getElementById('view');
      const tiles = [].slice.call(v.querySelectorAll('.kl')).map((k) => {
        const box = k.parentElement;
        const val = (box.querySelector('.kv') || {}).textContent || '';
        const extra = [].slice.call(box.children).filter((c) => !c.classList.contains('kl') && !c.classList.contains('kv'))
          .map((c) => (c.textContent || '').trim()).join(' ');
        return { label: (k.textContent || '').trim(), value: val.trim(), extra: extra.trim() };
      });
      return res({ tiles, feedRows: v.querySelectorAll('.act-feed > div').length });
    }, 4200));
  });
  await ctx.close(); srv.close?.();
  return out;
}

const pick = (t, re) => (t.tiles || []).find((x) => re.test(x.label)) || {};
const quiet = await run(ROWS_QUIET, PORT, false);
const busy = await run(ROWS_BUSY, PORT + 1, false);
const arab = await run(ROWS_QUIET, PORT + 2, true);
await b.close();

const qToday = pick(quiet, /Today/i), qWeek = pick(quiet, /7-day/i), qAll = pick(quiet, /Events loaded/i);
const bToday = pick(busy, /Today/i), bWeek = pick(busy, /7-day/i), bAll = pick(busy, /Events loaded/i);
const aTiles = (arab.tiles || []);
const hasArabic = (s) => /[؀-ۿ]/.test(s || '');

const checks = [
  ['a change made yesterday is not counted under Today', qToday.value === '0',
    JSON.stringify({ label: qToday.label, value: qToday.value })],
  ['a change made today is', bToday.value === '2', JSON.stringify(bToday.value)],
  ['7-day spans seven calendar days — six days ago counts, eight does not',
    /* yesterday and six-days-ago are both inside the seven days; eight-days-ago is not.
       So: 2 with nothing added today, 4 once today's two are there. */
    qWeek.value === '2' && bWeek.value === '4',
    JSON.stringify({ quiet: qWeek.value, busy: bWeek.value, expected: '2 then 4 — a rolling window reads 3 then 5' })],
  ['with nothing today it says so, and how long ago the last change was',
    /nothing yet today/i.test(qToday.extra) && /yesterday/i.test(qToday.extra),
    qToday.extra || '(nothing said)'],
  ['with something today that line is absent', bToday.extra === '', JSON.stringify(bToday.extra)],
  ['"Events loaded" still counts every row, whatever day it falls on',
    qAll.value === '4' && bAll.value === '6' && quiet.feedRows === 4 && busy.feedRows === 6,
    JSON.stringify({ quiet: qAll.value, busy: bAll.value, feed: [quiet.feedRows, busy.feedRows] })],
  ['in Arabic the tile labels and that line are Arabic',
    aTiles.length >= 3 &&
    aTiles.every((x) => hasArabic(x.label)) &&
    hasArabic(aTiles.map((x) => x.extra).join(' ')) &&
    !/nothing yet today|yesterday/i.test(aTiles.map((x) => x.extra).join(' ')),
    JSON.stringify(aTiles.map((x) => x.label + '=' + x.value + (x.extra ? ' (' + x.extra.slice(0, 34) + ')' : ''))).slice(0, 190)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
