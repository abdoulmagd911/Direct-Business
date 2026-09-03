/* probe-finance-tab-honest.mjs — a Finance tab that fails must not quietly show a different one
   (2026-09-02, round 39).

   HOW THE TABS ARE BUILT, because the bug follows from it. js/16 owns five tabs (Performance,
   Clients & collections, Ledger, Report Builder, Import) and its dispatcher was a chain ending
   in `: rOverview()`. The other three — Expenses, Payment proofs, Individual bookings — are
   added by LATER layers that WRAP renderFinance: the inner call runs first and draws the
   Overview, then the wrapper checks FIN.tab and, if the tab is its own, wipes #view and rebuilds.

   Every one of those wrappers ends in `catch(e){ console.warn(...) }`.

   So if a layer throws while rendering its tab, its Overview fallback simply stays on screen.
   The person clicks "Individual bookings" and gets **Performance** — no error, no empty state,
   nothing to suggest the click did anything. This project's own history names that failure
   mode: "looks exactly like a mysterious failure".

   Now a tab js/16 does not own renders an honest placeholder instead. A working layer
   overwrites it in the same tick, so nobody ever sees it; if it survives, the section really
   did fail and it says so and tells the person what to do.

   Checks:
     - all eight tabs open and render their OWN content (nothing silently shows Performance)
     - a layer forced to throw leaves the honest placeholder, NOT the Performance page
     - the placeholder never appears on a tab that works
     - both languages
   Sabotage: restore `: rOverview()` for foreign tabs -> a broken tab shows Performance -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8387;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

// key -> a string that only that tab's own content contains
const TABS = [
  ['overview', /Key indicators|المؤشرات/],
  ['clients', /Top clients by revenue|أعلى العملاء/],
  ['ledger', /Ledger|السجل/],
  ['reports', /Quick views|عرض جاهز/],
  ['expenses', /Add a service cost|إضافة تكلفة/],
  ['proofs', /payment proof|إثبات دفع/i],
  ['b2c', /Individual bookings|الحجوزات الفردية/],
  ['import', /Import|استيراد/],
];

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(7500);
  await p.evaluate(() => { openLead = null; current = 'finance'; render(); });
  await p.waitForTimeout(2200);

  async function open(tab) {
    await p.evaluate((t) => { if (typeof finGo === 'function') finGo(t); }, tab);
    await p.waitForTimeout(1500);
    return p.evaluate(() => ({
      tab: (typeof FIN !== 'undefined' ? FIN.tab : '?'),
      txt: ((document.getElementById('view') || {}).innerText || '').replace(/\s+/g, ' '),
      pending: !!document.getElementById('fin-tab-pending'),
    }));
  }

  // ---- 1. every tab shows its own content
  let bad = [];
  for (const [key, needle] of TABS) {
    const r = await open(key);
    if (r.tab !== key) { bad.push(`${key}: FIN.tab is ${r.tab}`); continue; }
    if (!needle.test(r.txt)) bad.push(`${key}: its own content is not on screen`);
    if (r.pending) bad.push(`${key}: left the "did not load" placeholder up`);
  }
  if (!bad.length) ok(`all ${TABS.length} Finance tabs open and render their own content — none silently shows another tab's page`);
  else fail('tabs not rendering themselves: ' + bad.join(' | '));

  // ---- 2. the Performance page must not be what a foreign tab falls back to
  const foreign = await open('no-such-tab');
  if (foreign.pending) ok('a tab this file does not own renders the honest placeholder, not the Performance page');
  else fail('an unknown tab fell through to something else: ' + JSON.stringify(foreign.txt.slice(0, 160)));
  if (!/Key indicators/.test(foreign.txt)) ok('…and specifically not Performance, which is what it used to show');
  else fail('an unknown tab is still showing the Performance page');
  if (/did not load|لم يُحمَّل/.test(foreign.txt)) ok('…and it tells the person what happened and what to do about it');
  else fail('the placeholder says nothing useful: ' + JSON.stringify(foreign.txt.slice(0, 200)));

  // ---- 3. THE REAL CASE: a layer that throws while rendering its own tab
  const broken = await p.evaluate(async () => {
    // make the Individual-bookings layer fail exactly the way a runtime error would: its wrapper
    // catches and only console.warns, so before this round the Overview stayed on screen.
    const realLoad = window.b2cSave;
    const boom = () => { throw new Error('QA forced failure inside the b2c tab'); };
    // the layer reads B2C.rows through its own closure; the reachable seam is the global it
    // calls while rendering. Break document.getElementById for the duration of the render so
    // the wrapper's body throws, then restore it.
    const realGet = document.getElementById.bind(document);
    let armed = true;
    document.getElementById = function (id) {
      if (armed && id === 'view') { armed = false; boom(); }
      return realGet(id);
    };
    try { if (typeof finGo === 'function') finGo('b2c'); } catch (_) {}
    document.getElementById = realGet;
    await new Promise((r) => setTimeout(r, 400));
    const v = realGet('view');
    return { txt: ((v || {}).innerText || '').replace(/\s+/g, ' '), pending: !!realGet('fin-tab-pending') };
  });
  if (!/Key indicators/.test(broken.txt)) ok('when the Individual-bookings layer throws mid-render, the person is NOT left looking at the Performance page');
  else fail('a failing tab still shows Performance — the exact "mysterious failure" this round is about');
  if (broken.pending || /did not load|لم يُحمَّل/.test(broken.txt)) ok('…they get the placeholder saying the section did not load');
  else fail('a failing tab shows neither its content nor an explanation: ' + JSON.stringify(broken.txt.slice(0, 200)));

  // ---- 4. Arabic
  await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); });
  const ar = await open('no-such-tab');
  if (/لم يُحمَّل/.test(ar.txt)) ok('the placeholder is Arabic in Arabic');
  else fail('the placeholder is English on an Arabic page: ' + JSON.stringify(ar.txt.slice(0, 160)));
  const arWorking = await open('b2c');
  if (!arWorking.pending) ok('…and a working tab in Arabic still shows its own content, not the placeholder');
  else fail('a working tab shows the placeholder in Arabic');
  await p.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); });

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION|QA forced failure/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nfinance-tab-honest OK — a tab that fails says so instead of showing a different page');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
