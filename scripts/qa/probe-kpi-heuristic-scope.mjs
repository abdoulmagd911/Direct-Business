/* probe-kpi-heuristic-scope.mjs (2026-09-09, live test findings T3, C1, AU5) — core-09's
   "four numbers in a div = a KPI strip" heuristic must leave named structures alone.
   Attack area (ad).

   PORT NOTE: 8701–8757 are taken. This is 8758, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand, and traced here to one function (v26FixKpiLayouts): the
   Today hero split into three boxes with an empty "Today · 9 Sept" tile (T3), the client card
   grew two empty panels where its detail grid had been tiled (C1), and every Activity & Audit
   row drew as four boxes (AU5). All three were the same heuristic grid-ifying a div because its
   text happened to hold four numbers (a date and a time are two already).

   Under test — after the page has settled, no element of these kinds carries .v26-kpi-grid:
     1. Today: the hero, every .v19-today-group and .v19-today-card, the hub.
     2. A lead card and a client card: the .detail-grid and anything inside it.
     3. Activity & Audit: any .act-row / .act-feed.
     4. Control: a genuine KPI strip (the hero's .chips row of five counters) IS still tiled —
        the heuristic was narrowed, not removed.

   Run:  node scripts/qa/probe-kpi-heuristic-scope.mjs        (port 8758)
   Sabotage: in core-09 v26FixKpiLayouts delete the `.detail-grid,.v19-today-group,…` closest()
   additions and the classList guards — checks 1–3 go red. Assert the sabotage APPLIED with a
   marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8758;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT, { record_history: [{ id: 7001, at: new Date().toISOString(), actor: 'u-qa', actor_name: 'QA Test Account', table_name: 'businesses', record_id: 'r', action: 'edit', before_row: { id: 'r', name: 'Probe Co', stage: 'new' }, after_row: { id: 'r', name: 'Probe Co', stage: 'won' }, undone_at: null }] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && document.querySelector('#v26TodayHub'), { timeout: 90000 }).catch(() => fail('Today never rendered'));
  await p.waitForTimeout(8000);   // the heuristic runs on timers after each render

  /* the hero's .chips counters are a real KPI strip and may be tiled — everything else in the hero may not */
  const tiled = (sel) => p.evaluate((s) => [...document.querySelectorAll('#view .v26-kpi-grid')].filter((d) => (d.matches(s) || d.closest(s)) && !d.classList.contains('chips')).map((d) => d.className).slice(0, 5), sel);

  /* ---- 1. Today ---- */
  await p.evaluate(() => { openLead = null; current = 'today'; render(); }); await p.waitForTimeout(3000);
  const t1 = await tiled('.hero, .v19-today-group, .v19-today-card, #v26TodayHub');
  const heroOne = await p.evaluate(() => { const h = document.querySelector('#view .hero'); if (!h) return null; const r = h.getBoundingClientRect(); const h2 = h.querySelector('h2'); return { w: r.width, h2: !!h2 && h2.getBoundingClientRect().height > 0, grid: h.classList.contains('v26-kpi-grid') }; });
  if (!t1.length && heroOne && heroOne.h2 && !heroOne.grid) ok('Today: the hero, the groups and the cards are not tiled; the hero is one card with its title');
  else fail(`Today: tiled structures ${JSON.stringify(t1)} hero=${JSON.stringify(heroOne)} — the live-site split "Today · 9 Sept" card`);
  const chips = await p.evaluate(() => { const c = document.querySelector('#view .hero .chips'); return c ? c.classList.contains('v26-kpi-grid') : null; });
  if (chips === true) ok('control: the hero\'s five-counter .chips row is still a KPI strip — the heuristic was narrowed, not removed');
  else fail(`control: the counters row is no longer tiled (${chips}) — the heuristic was removed rather than narrowed`);

  /* ---- 2. lead and client cards ---- */
  for (const kind of ['lead', 'client']) {
    await p.evaluate((k) => { const x = DB.businesses.find((y) => (k === 'client') ? y.isClient : !y.isClient); openLead = x && x.id; current = 'leads'; render(); }, kind); await p.waitForTimeout(3000);
    const t2 = await tiled('.detail-grid');
    if (!t2.length) ok(`${kind} card: the detail grid and everything inside it is not tiled`);
    else fail(`${kind} card: tiled ${JSON.stringify(t2)} — the live-site two empty panels`);
  }

  /* ---- 3. Activity & Audit ---- */
  await p.evaluate(() => { openLead = null; current = 'activity'; render(); });
  await p.waitForFunction(() => document.querySelector('#view .act-row'), { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(3000);
  const t3 = await tiled('.act-feed, .act-row');
  if (!t3.length) ok('Activity & Audit: no row is tiled');
  else fail(`Activity & Audit: tiled ${JSON.stringify(t3)} — the live-site four-boxes-per-row look`);

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nkpi-heuristic-scope OK — the KPI tiler leaves named structures alone');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
