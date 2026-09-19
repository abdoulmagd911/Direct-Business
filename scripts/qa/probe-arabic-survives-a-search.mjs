/* probe-arabic-survives-a-search.mjs — guards the 2026-09-19 (fire #98) fixes in js/21 and core-02.

   `sweep-language` drives every nav page in Arabic and currently reports ONE piece of Latin-only
   text, which is a person's name. It only ever sees each page in its ordinary, full state. Fire #97
   found two English-only cards in js/16 that it could never reach, because they only appear when a
   read fails. This round went after the same blind spot from the other side: what a list says when
   it is REDRAWN — a search, a filter — and what it says when nothing matches.

   Two defects, both measured before and after on the real database with the app in Arabic:

   1. js/21's translation pass is hung on render(). A list redrawn WITHOUT a render — which is what
      every search box in the app does — writes fresh English headers over the Arabic ones and
      nothing puts them back. On Leads, the busiest page, the seven headers read المنشأة / المرحلة /
      المسار / آخر نشاط / الإجراء التالي / المسؤول / الأولوية before typing and BUSINESS / STAGE /
      FUNNEL / LAST ACTIVITY / NEXT ACTION / OWNER / PRIORITY one keystroke later — still English six
      seconds on, and for the rest of the session. Fixed by wrapping every drawer the app publishes,
      not just the one that was caught, so the next list to be added is covered too.

   2. Clients said "No clients match." in English under an otherwise Arabic page.

   Not defects, checked and left alone: supplier names (Travelfusion, Kiwi, Dnata…) are data, and
   IATA / BSP / NDC are the industry vocabulary this project has a standing decision to keep.

   Sabotage-tested: with the js/21 and core-02 edits reverted, 3 checks go FAIL, exit 1 — the two
   header checks with the headers visibly back to BUSINESS / STAGE / FUNNEL, and the Clients line.
   Run: node scripts/qa/probe-arabic-survives-a-search.mjs                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9075; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, locale: 'en-GB' });
await ctx.addInitScript(() => { try { localStorage.setItem('dbLang', 'ar'); } catch (_) { } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
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
await p.waitForFunction(() => typeof render === 'function' && typeof LANG !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 90000 });
await p.waitForTimeout(4000);

const ARABIC = /[؀-ۿ]/;
const heads = () => p.evaluate(() => [].slice.call(document.querySelectorAll('#view thead th')).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
const emptyLine = () => p.evaluate(() => { const c = [].slice.call(document.querySelectorAll('#view td[colspan], #view .empty')).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean); return c[0] || null; });
/* The box that matters is the one wired to this page's own redraw — an earlier version of this
   probe typed into whatever visible input it found first, which in the harness was not the list's
   search at all, so the redraw never happened and the check could not fail even with the fix
   reverted. It now finds the input whose own handler calls a draw function, types into that, and
   the probe asserts it found one: no redraw, no test. */
/* The box that matters is the page's OWN search, the one in `.search-wrap` — Leads wires #lq from
   JavaScript rather than an inline attribute, so neither "the first visible input" nor "an input
   whose oninput mentions draw…" finds it. An earlier version of this probe used the first of those
   and typed into something else entirely: the redraw never happened and the check could not fail
   even with the fix reverted. It asserts below that it found one — no redraw, no test. */
const typeNonsense = () => p.evaluate(() => {
  const boxes = [].slice.call(document.querySelectorAll('#view .search-wrap input'))
    .filter((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && r.width > 60; });
  boxes.forEach((e) => { try { e.value = 'zqxwvkjh9'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('keyup', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) { } });
  return boxes.length;
});

const at = {};
for (const pg of ['leads', 'clients']) {
  await p.evaluate((x) => { try { current = x; openLead = null; render(); } catch (_) { } }, pg);
  await p.waitForTimeout(2500);
  const before = await heads();
  const boxes = await typeNonsense();
  await p.waitForTimeout(1500);
  /* Typing reaches the filter (leadFilter.q really changes), but in the harness the handler's own
     no-argument redraw does not always rewrite the table head, while against the real database it
     does — measured both ways. So the page's redraw is ALSO called the way the live path calls it,
     with the search term, which is the call proven to rewrite the head: with the js/21 wrapper
     reverted it comes back BUSINESS / STAGE / FUNNEL. Without this the header checks could not fail
     in the harness, and a check that cannot fail is not a check. */
  const redrew = await p.evaluate((pg2) => {
    const fn = pg2 === 'leads' ? window.drawLeads : (window.drawClients || window.drawLeads);
    if (typeof fn !== 'function') return false;
    try { fn('zqxwvkjh9'); return true; } catch (_) { return false; }
  }, pg);
  await p.waitForTimeout(2500);
  const after = await heads();
  await p.waitForTimeout(4000);            /* and it must still be Arabic a moment later */
  at[pg] = { lang: await p.evaluate(() => LANG), boxes, redrew, before, after, later: await heads(), empty: await emptyLine() };
  console.log(`  ${pg}: ${boxes} search box(es) · headers before ${JSON.stringify(before.slice(0, 3))} · after ${JSON.stringify(at[pg].after.slice(0, 3))} · empty line ${JSON.stringify(at[pg].empty)}`);
}
await b.close(); srv.close?.();

const allAr = (list) => list.length > 2 && list.every((h) => ARABIC.test(h) || /^[#\d\s▲▼]+$/.test(h) || /^(IATA|BSP|NDC|API)$/i.test(h));
const checks = [
  ['the app really was in Arabic and the tables really were found, so nothing below passes by absence',
    at.leads.lang === 'ar' && at.leads.before.length > 2 && at.clients.before.length > 2],
  ['a search box was really found and typed into on both pages — no redraw, no test', at.leads.boxes > 0 && at.clients.boxes > 0],
  ['and the page\'s own redraw really ran, the call that rewrites the table head', at.leads.redrew === true],
  ['Leads: the headers were Arabic before the search', allAr(at.leads.before)],
  ['Leads: and they are STILL Arabic right after it — this is the defect', allAr(at.leads.after)],
  ['Leads: and still Arabic some seconds later, so nothing put English back', allAr(at.leads.later)],
  ['Clients: its headers survive the search too', allAr(at.clients.after) && allAr(at.clients.later)],
  ['Clients: the "nothing matched" line is in Arabic', !!at.clients.empty && ARABIC.test(at.clients.empty) && !/No clients match/i.test(at.clients.empty)],
  ['Leads: its "nothing matched" line is in Arabic as well', !!at.leads.empty && ARABIC.test(at.leads.empty)],
  ['typing in a search box wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify(at, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
