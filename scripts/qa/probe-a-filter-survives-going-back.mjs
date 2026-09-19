/* probe-a-filter-survives-going-back.mjs — the Leads filter, the highlighted chip and the rows must
   always be the same story, including after going back and after a reload.

   js/03 is called "filter memory each section" and keeps each section's filters in `history.state`.
   Driven in fire #101 against the real database, in both languages, what it actually does is:
     · click a stage chip → filter Prospect, chip "Prospect 53", rows 53;
     · switch page inside the app and press Back → all three unchanged (the filter object never left
       memory, so nothing had to be restored);
     · navigate away for real and press Back, or reload → the filter RESETS to All 78, and the chip
       and the rows follow it.

   So the memory only holds within one page lifetime, which is the case that needed no memory. That
   is recorded as measured behaviour rather than fixed: nothing on screen ever disagrees with itself,
   a fresh load starting clean is defensible, and making the restore real would touch routing for a
   payoff of one re-click. If it is ever to change, it is the owner's call, not a QA round's.

   What this probe guards is the part that would be a real failure: **a screen that lies about
   itself** — a chip highlighted "Contacted 25" above a list of 78, or rows that move while the
   highlight does not. It checks that agreement in all four states above.

   Sabotage-tested: with the chip's `active` class left on the wrong chip (core-09's chip click), the
   filtered state reads chip "All 33" above 12 rows and 1 check goes FAIL, exit 1. Only one, because
   a later re-render puts the highlight back — so the moment that matters is the one right after the
   click, which is exactly when a person looks.
   Run: node scripts/qa/probe-a-filter-survives-going-back.mjs                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9078; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof leadFilter !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 90000 });
  await p.waitForTimeout(4000);

  const snap = () => p.evaluate(() => ({
    stage: (typeof leadFilter !== 'undefined') ? (leadFilter.stage || 'all') : null,
    chip: (function () { const a = document.querySelector('#view .v26_3-chip.active, #view .chip.active, #view [class*=chip].active'); return a ? (a.innerText || '').replace(/\s+/g, ' ').trim() : null; })(),
    rows: [].slice.call(document.querySelectorAll('#view tbody tr')).filter((r) => !r.querySelector('td[colspan]')).length,
    page: (typeof current !== 'undefined') ? current : '?',
  }));

  /* click a stage chip that really narrows the list — not "All", and not one that shows nothing */
  const picked = await p.evaluate(() => {
    const els = [].slice.call(document.querySelectorAll('#view .v26_3-chip, #view [class*=chip]'))
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 10 && (e.innerText || '').length < 40; });
    const c = els.find((e) => { const m = (e.innerText || '').match(/(\d+)\s*$/); return m && Number(m[1]) > 0 && !/^(All|الكل)/.test((e.innerText || '').trim()); });
    if (!c) return null; c.click(); return (c.innerText || '').replace(/\s+/g, ' ').trim();
  });
  await p.waitForTimeout(2200);
  const filtered = await snap();

  /* switching page inside the app, then Back */
  await p.evaluate(() => { try { current = 'clients'; openLead = null; render(); } catch (_) { } });
  await p.waitForTimeout(2500);
  await p.goBack({ waitUntil: 'domcontentloaded' }).catch(() => { });
  await p.waitForTimeout(3000);
  const back = await snap();

  /* leaving for real and coming back — this reboots the app */
  await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(4000);
  await p.goBack({ waitUntil: 'domcontentloaded' }).catch(() => { });
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(4000);
  const realBack = await snap();

  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof render === 'function' && typeof leadFilter !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(4500);
  const reloaded = await snap();
  await ctx.close();
  return { picked, filtered, back, realBack, reloaded };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
for (const [k, r] of [['EN', en], ['AR', ar]]) {
  console.log(`  ${k} picked ${JSON.stringify(r.picked)}`);
  console.log(`     filtered ${JSON.stringify(r.filtered)}`);
  console.log(`     back     ${JSON.stringify(r.back)}`);
  console.log(`     realBack ${JSON.stringify(r.realBack)}`);
  console.log(`     reloaded ${JSON.stringify(r.reloaded)}`);
}

/* the chip's own badge is the number it promises; the rows are what it delivered */
const agrees = (s) => {
  if (!s || !s.chip) return false;
  const m = s.chip.match(/(\d+)\s*$/);
  return !!m && Number(m[1]) === s.rows;
};
const checks = [
  ['a stage chip was really clicked and really narrowed the list, in both languages',
    !!en.picked && !!ar.picked && en.filtered.stage !== 'all' && ar.filtered.stage !== 'all' && en.filtered.rows > 0],
  ['with the filter on, the highlighted chip\'s own number is the number of rows under it', agrees(en.filtered) && agrees(ar.filtered)],
  ['after switching page inside the app and going Back, it still is', agrees(en.back) && agrees(ar.back)],
  ['after leaving for real and coming Back, it still is', agrees(en.realBack) && agrees(ar.realBack)],
  ['after a full reload, it still is', agrees(en.reloaded) && agrees(ar.reloaded)],
  ['every one of those states really rendered a list, so none of the above passed on an empty page',
    [en, ar].every((r) => [r.filtered, r.back, r.realBack, r.reloaded].every((s2) => s2.rows > 0 && !!s2.chip))],
  ['both languages are on Leads throughout', [en, ar].every((r) => [r.back, r.realBack, r.reloaded].every((s2) => s2.page === 'leads'))],
  ['going back and reloading wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
