/* probe-undated-events-are-not-counted-as-coming.mjs — "still ahead" has to mean a date in the
   future.

   Fire #172. The Events page opens on what is still ahead and puts a number on it. That number
   counted every event that had not ended — and `hasEnded` answers false for an event with **no
   start date at all**, because `relDay` returns null when there is nothing to compare.

   Measured live: 80 events — 22 with a date in the future, 37 finished, and **21 with no date
   whatsoever**. The headline read **"43 Still ahead"**. One of the 21 carries its own note saying
   there is no 2026 edition and the next confirmed one is March 2027; it was being counted as
   coming up.

   This is #163's rule, which the renewals radar already follows: something with no date on file is
   never counted as due. The undated events are not hidden — losing 21 real events would be a worse
   answer than over-counting them — they get their own tile and their own filter.

   What this holds:
     1. "Still ahead" counts only events whose date is in the future;
     2. there is a separate "No date yet" tile carrying the undated count;
     3. the two together still account for every live event — nothing was dropped to make the
        headline smaller;
     4. the undated events are still listed, not hidden;
     5. the new tile really filters — tapping it shows exactly the undated ones, and tapping it
        again clears, because a tile that looks clickable and is not would be its own defect;
     6. in Arabic both tiles are Arabic;
     7. when every live event has a date the tile is not drawn at all, so it never becomes a
        permanent "0";
     8. no JS errors.

   Checks 3, 4 and 7 are the brakes: a fix that shrank the headline by quietly dropping events, or
   that left a dead "0" tile on every calendar, would pass the rest.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): restoring
   `AHEAD = E.filter(e => !hasEnded(e))` fails checks 1, 2, 5, 6 and 7.
   Run: node scripts/qa/probe-undated-events-are-not-counted-as-coming.mjs                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9134; const BASE = 'http://localhost:' + PORT;

const ev = (o) => Object.assign({
  id: 'e0', name_en: 'QA Event', name_ar: 'فعالية', vertical: 'tech', status: 'confirmed',
  start_date: null, end_date: null, city: 'Riyadh', venue: '', organiser: '', link: '',
  opportunity_sales: true, opportunity_partner: false, priority: 2, notes: '',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  approach: 'undecided', approach_status: 'not_started', exhibitor_list_url: null,
}, o);

/* two dated in the future, one finished, three with no date at all */
const EVENTS = [
  ev({ id: 'e1', name_en: 'QA Future One', start_date: '2027-03-01', end_date: '2027-03-03' }),
  ev({ id: 'e2', name_en: 'QA Future Two', start_date: '2027-05-10', end_date: '2027-05-12' }),
  ev({ id: 'e3', name_en: 'QA Finished', start_date: '2020-01-05', end_date: '2020-01-07' }),
  ev({ id: 'e4', name_en: 'QA Undated One' }),
  ev({ id: 'e5', name_en: 'QA Undated Two' }),
  ev({ id: 'e6', name_en: 'QA Undated Three' }),
];
const ALL_DATED = EVENTS.filter((e) => e.start_date);

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'contacted', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: null, created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: null, needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(events, port) {
  const srv = start(port, {
    businesses: [row({ id: 'b1', legacy_id: 'B1', name: 'QA Lead One' })], contacts: [], activities: [],
    ksa_events: events,
  });
  const base = 'http://localhost:' + port;
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
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
  await p.goto(base + '/events', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
  await p.evaluate(() => { try { current = 'events'; render(); } catch (_) { } });
  await p.waitForTimeout(6500);
  return { p, ctx, srv };
}

const readTiles = (p) => p.evaluate(() => {
  const v = document.getElementById('view');
  const tile = (k) => { const el = v.querySelector('[data-evstat="' + k + '"]');
    if (!el) return null;
    const ds = el.querySelectorAll('div');
    return { value: (ds[0] ? ds[0].textContent : '').trim(), label: (ds[1] ? ds[1].textContent : '').trim() }; };
  return { ahead: tile('all'), nodate: tile('nodate'),
    rows: v.querySelectorAll('tbody tr').length,
    names: [].slice.call(v.querySelectorAll('tbody tr')).map((r) => (r.textContent || '').replace(/\s+/g, ' ')) };
});

const A = await run(EVENTS, PORT);
const before = await readTiles(A.p);

/* tap the new tile — it must actually filter */
await A.p.evaluate(() => { const el = document.querySelector('[data-evstat="nodate"]'); if (el) el.click(); });
await A.p.waitForTimeout(2200);
const filtered = await readTiles(A.p);
await A.p.evaluate(() => { const el = document.querySelector('[data-evstat="nodate"]'); if (el) el.click(); });
await A.p.waitForTimeout(2200);
const cleared = await readTiles(A.p);

await A.p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); if (typeof render === 'function') render(); } catch (_) { } });
await A.p.waitForTimeout(2600);
const arabic = await readTiles(A.p);
await A.ctx.close(); A.srv.close?.();

/* every live event dated → the tile must not be drawn at all */
const B = await run(ALL_DATED, PORT + 1);
const allDated = await readTiles(B.p);
await B.ctx.close(); B.srv.close?.();
await b.close();

const num = (t) => (t && t.value ? Number(String(t.value).replace(/[^\d]/g, '')) : NaN);
const undatedShown = (o) => o.names.filter((n) => /QA Undated/.test(n)).length;
const hasArabic = (s) => /[؀-ۿ]/.test(s || '');

const checks = [
  ['"Still ahead" counts only events whose date is in the future', num(before.ahead) === 2, 'tile said ' + (before.ahead && before.ahead.value)],
  ['there is a separate "No date yet" tile with the undated count',
    !!before.nodate && num(before.nodate) === 3, JSON.stringify(before.nodate)],
  ['the two together still account for every live event — nothing was dropped',
    num(before.ahead) + num(before.nodate) === 5 && before.rows === 5,
    JSON.stringify({ ahead: num(before.ahead), nodate: num(before.nodate), rows: before.rows })],
  ['the undated events are still listed, not hidden', undatedShown(before) === 3, String(undatedShown(before))],
  ['the new tile really filters, and tapping it again clears',
    filtered.rows === 3 && undatedShown(filtered) === 3 && cleared.rows === 5,
    JSON.stringify({ filtered: filtered.rows, undatedThere: undatedShown(filtered), cleared: cleared.rows })],
  ['in Arabic both tiles are Arabic',
    hasArabic(arabic.ahead && arabic.ahead.label) && hasArabic(arabic.nodate && arabic.nodate.label),
    JSON.stringify({ ahead: arabic.ahead && arabic.ahead.label, nodate: arabic.nodate && arabic.nodate.label })],
  ['when every live event has a date the tile is not drawn at all',
    allDated.nodate === null, allDated.nodate ? 'still drawn: ' + JSON.stringify(allDated.nodate) : '(absent — right)'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
