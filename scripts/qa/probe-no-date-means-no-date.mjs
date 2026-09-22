/* probe-no-date-means-no-date.mjs — the Events page's two "no date" controls are one question.

   Fire #221. Driven live in both languages, the Events page carried two controls that both mean
   "events with no date on file", a few centimetres apart, giving different answers:

       tile   «21 No date yet»  → filtered to 21
       status dropdown "No date" → filtered to 18

   The tile asks the EVENT (fire #172's computed UNDATED). The dropdown asked the stored `status`
   code — and `status` conflates two independent facts: how verified an event is (confirmed / needs
   check / stale / outside KSA / outside window) and whether it has a date. An event can be both
   "needs check" AND undated, and one column holds only one of them, so three undated events
   carrying "Needs check" (2) and "Stale" (1) were missing from the answer to the very question the
   option is named after. This is M65's shape — two controls, one question — on a different page.

   Fixed: one predicate, `isUndated(e)`, used by the tile, the dropdown and the count. The other
   five status options are untouched and still read the stored code, so the three events now appear
   under BOTH "No date" and their own status, which is what they are.

   What this holds, on a seeded world where the two answers would differ if the rule split again:
     1. the tile's number equals the rows the tile shows;
     2. the dropdown's "No date" shows the same rows as the tile — the same count, and the same
        events, not merely the same total;
     3. an undated event whose stored status is NOT "no_date" is in both answers — the exact record
        the old rule dropped;
     4. the brake: a DATED event whose stored status IS "no_date" is in NEITHER — "no date" must
        mean the date, not the code, in both directions, or the fix is just a different wrong rule;
     5. the other status options still filter by the stored code — this fix must not turn the whole
        dropdown into a date filter;
     6. Arabic: the tile reads Arabic and both answers still agree;
     7. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · putting the dropdown back on `e.status!==F.status` — fails 2, 3, 4 and 6. Note what it
       prints: the two answers are both 2 rows and they are DIFFERENT events. That is why check 2
       compares the events and not merely the totals — a count check alone would have passed here;
     · making isUndated() ignore the date and read the status code — fails 3 and 4 (the dated
       "no_date" event listed, the undated "stale" one missing) while 2 passes, because both
       controls then share the same wrong rule. Agreement is not correctness, so the two brakes
       exist separately from the agreement check.
   Run: node scripts/qa/probe-no-date-means-no-date.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9249 — one mock. */
const PORT = 9249; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
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

await p.goto(BASE + '/events', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.evaluate(() => { try { current = 'events'; openLead = null; render(); } catch (_) {} });
await p.waitForTimeout(5000);

/* four events that make the two rules disagree in both directions */
const YEAR_AHEAD = '2099-06-01';
const seeded = await p.evaluate((far) => {
  try {
    const E = DB.ksaEvents; if (!Array.isArray(E)) return { ok: false, why: 'no ksaEvents' };
    const mk = (id, name, status, start, end) => { E.push({ id: id, name_en: name, name_ar: name,
      vertical: 'Other', status: status, start_date: start, end_date: end, city: 'QA', venue: 'QA',
      organiser: 'QA', priority: 3, approach: 'undecided', approach_status: 'not_started',
      opportunity_sales: false, opportunity_partner: false, notes: '' }); };
    mk('qa_ev_undated_nodate', 'QAEV undated coded nodate', 'no_date', '', '');
    mk('qa_ev_undated_stale', 'QAEV undated coded stale', 'stale', '', '');      /* the record the old rule dropped */
    mk('qa_ev_dated_nodate', 'QAEV dated coded nodate', 'no_date', far, far);    /* the brake */
    mk('qa_ev_dated_confirmed', 'QAEV dated confirmed', 'confirmed', far, far);
    return { ok: true, events: E.length };
  } catch (e) { return { ok: false, why: e.message }; }
}, YEAR_AHEAD);
await p.evaluate(() => { try { render(); } catch (_) {} });
await p.waitForTimeout(2500);

/* The page's filter state lives inside the layer and SURVIVES render(), so every measurement has
   to put it back by hand. The first version of this probe did not, and two checks went red on a
   correct app: the tile stayed pressed, so "Confirmed" meant "undated AND confirmed" (nothing), and
   the Arabic pass then un-pressed it and measured a different filter entirely. Reset by driving the
   page's own controls — the dropdowns back to "all", and the tile only if it is pressed. */
const fresh = async (lang) => {
  await p.evaluate((l) => { try { if (l) { LANG = l; if (typeof applyLang === 'function') applyLang(); }
    current = 'events'; openLead = null; render(); } catch (_) {} }, lang || null);
  await p.waitForTimeout(2400);
  for (const id of ['evF_s', 'evF_m', 'evF_v']) {
    await p.evaluate((i) => { const s = document.getElementById(i);
      if (s && s.value !== 'all') { s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); } }, id);
    await p.waitForTimeout(700);
  }
  await p.evaluate(() => { const t = document.querySelector('#view [data-evstat="nodate"]');
    if (t && t.getAttribute('aria-pressed') === 'true') t.click(); });
  await p.waitForTimeout(1600);
  const dirty = await p.evaluate(() => { const t = document.querySelector('#view [data-evstat="nodate"]');
    return { tile: t ? t.getAttribute('aria-pressed') : null,
      s: (document.getElementById('evF_s') || {}).value, m: (document.getElementById('evF_m') || {}).value,
      v: (document.getElementById('evF_v') || {}).value }; });
  if (dirty.tile === 'true' || [dirty.s, dirty.m, dirty.v].some((x) => x && x !== 'all')) {
    console.log('FAIL · the probe could not reset the page filters — ' + JSON.stringify(dirty)); process.exit(1);
  }
};
const listed = () => p.evaluate(() => {
  const v = document.getElementById('view'); const t = v.querySelector('table');
  const rows = t ? [...t.querySelectorAll('tbody tr')].filter((r) => r.querySelectorAll('td').length > 1) : [];
  return { n: rows.length, qa: rows.map((r) => ((r.innerText || '').match(/QAEV [a-z ]+/) || [''])[0].trim()).filter(Boolean).sort() };
});
const tileInfo = () => p.evaluate(() => { const t = document.querySelector('#view [data-evstat="nodate"]');
  if (!t) return null; const txt = (t.innerText || '').replace(/\s+/g, ' ').trim();
  return { text: txt, n: Number((txt.match(/(\d+)/) || [])[1]) }; });

await fresh('en');
const tile = await tileInfo();
await p.evaluate(() => { const t = document.querySelector('#view [data-evstat="nodate"]'); if (t) t.click(); });
await p.waitForTimeout(2400);
const byTile = await listed();
await fresh('en');
await p.evaluate(() => { const s = document.getElementById('evF_s'); if (s) { s.value = 'no_date'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
await p.waitForTimeout(2400);
const byDrop = await listed();
await fresh('en');
await p.evaluate(() => { const s = document.getElementById('evF_s'); if (s) { s.value = 'confirmed'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
await p.waitForTimeout(2400);
const byConfirmed = await listed();
await fresh('ar');
const tileAr = await tileInfo();
await p.evaluate(() => { const t = document.querySelector('#view [data-evstat="nodate"]'); if (t) t.click(); });
await p.waitForTimeout(2400);
const byTileAr = await listed();
await fresh('ar');
await p.evaluate(() => { const s = document.getElementById('evF_s'); if (s) { s.value = 'no_date'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
await p.waitForTimeout(2400);
const byDropAr = await listed();
await b.close(); srv.close?.();

const same = (a, c) => a.length === c.length && a.every((x, i) => x === c[i]);
const isAr = (s) => /[؀-ۿ]/.test(String(s || ''));
const checks = [
  ['the tile\'s number equals the rows the tile shows',
    !!tile && tile.n === byTile.n && byTile.n > 0,
    JSON.stringify({ tile: tile && tile.text, rows: byTile.n, seeded })],
  ['the dropdown\'s "No date" shows the same rows as the tile — same count AND same events',
    byDrop.n === byTile.n && same(byDrop.qa, byTile.qa),
    JSON.stringify({ tile: byTile.n, dropdown: byDrop.n, tileQa: byTile.qa, dropQa: byDrop.qa })],
  ['an undated event whose stored status is not "no_date" is in both answers',
    byTile.qa.includes('QAEV undated coded stale') && byDrop.qa.includes('QAEV undated coded stale'),
    JSON.stringify({ tile: byTile.qa, dropdown: byDrop.qa })],
  ['brake: a DATED event whose stored status is "no_date" is in neither',
    !byTile.qa.includes('QAEV dated coded nodate') && !byDrop.qa.includes('QAEV dated coded nodate'),
    JSON.stringify({ tile: byTile.qa, dropdown: byDrop.qa })],
  ['the other status options still filter by the stored code',
    byConfirmed.qa.includes('QAEV dated confirmed') && !byConfirmed.qa.includes('QAEV dated coded nodate') &&
    !byConfirmed.qa.includes('QAEV undated coded stale'),
    JSON.stringify({ confirmed: byConfirmed.qa })],
  ['Arabic: the tile reads Arabic and both answers still agree',
    !!tileAr && isAr(tileAr.text) && byDropAr.n === byTileAr.n && same(byDropAr.qa, byTileAr.qa),
    JSON.stringify({ tile: tileAr && tileAr.text, tileRows: byTileAr.n, dropRows: byDropAr.n })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
