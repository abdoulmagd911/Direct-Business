/* probe-the-cost-gap-says-how-much.mjs — when the money page admits some invoices have no cost
   recorded, it says how much profit is resting on that, not only how many invoices.

   Fire #195. The app is already careful here, and that is why this was easy to miss: three places
   warn about unrecorded cost, a client with no cost on any invoice prints the WORDS "not recorded"
   and "unknown" rather than a zero and a full-revenue profit, and the per-row ⚠ marks are there.
   Every one of those warnings named a COUNT.

   Measured on the live book the same day:

       19 of 46 invoices carry no recorded cost                    ← what the page said
       they contribute 214,550 SAR of a 492,623 SAR profit total   ← what it did not say
       = 44% of the headline profit figure

   "19 of 46" reads like a minority. The rows are wildly unequal in size, so the count cannot stand
   in for the amount: the same sentence would be printed whether the exposure were 2% or half. A
   cost of zero makes profit equal revenue — that is the whole mechanism — so the number a manager
   needs is the riyals, and it was the one number missing. All three warnings now carry it, with the
   share computed from the figures on screen rather than assumed.

   What this holds, on the three surfaces that warn:
     1. the Performance headline warning names an amount, and that amount equals the profit on the
        no-cost rows, summed independently here from `FIN.rows`;
     2. it names the share, and the share is that amount over the profit shown — arithmetic, not a
        stored guess;
     3. Clients & collections names its amount too;
     4. Report Builder names its amount too;
     5. Arabic prints the same amount, in Arabic — the warning is not English-only;
     6. give every no-cost row a cost and every one of the three warnings disappears;
     7. the amount named is NOT simply the whole profit total.
     8. no JS errors, in either language.

   Checks 6 and 7 are the brakes. A sentence hardcoded into the page would pass 1-5 and fail 6; a
   warning that printed the headline profit figure instead of the part resting on missing cost would
   pass 1, 3, 4 and 5 and fail 7. The fixture is arranged so the two numbers differ.

   Check 6 also asserts its own precondition — that all three warnings were on screen BEFORE the
   rows were given a cost. It did not at first, and the first sabotage run showed why: against a
   build whose warnings never render, "they disappeared" passes while proving nothing. That is M50's
   lesson arriving in a fresh costume, caught by running the sabotage rather than reasoning about it.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both runs real:
     · putting all three count-only sentences back — fails 1, 2, 3, 4, 5 and 7;
     · printing the period's whole profit in place of the part resting on missing cost — fails 1, 2,
       5 and 7: the share reads 100, and the Arabic check catches it too because it compares the
       Arabic figure against the English one rather than trusting either alone.
   Run: node scripts/qa/probe-the-cost-gap-says-how-much.mjs                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9228 — one mock. */
const PORT = 9228; const BASE = 'http://localhost:' + PORT;

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

await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(4000);
await p.evaluate(() => { current = 'finance'; render(); });
await p.waitForTimeout(4500);

const goTab = async (t) => { await p.evaluate((tt) => { try { finGo(tt); } catch (_) {} }, t); await p.waitForTimeout(3000); };
const read = (sel, amtAttr, cntAttr) => p.evaluate(([s, a, c]) => {
  const n = document.querySelector(s); if (!n) return null;
  return { amount: Number(n.getAttribute(a)), count: Number(n.getAttribute(c)),
    share: n.hasAttribute('data-fin-nocost-share') ? Number(n.getAttribute('data-fin-nocost-share')) : null,
    text: (n.textContent || '').trim() };
}, [sel, amtAttr, cntAttr]);

/* What the data actually says. Summed here, but over EXACTLY the rows the headline covers —
   `finLive()` minus the unverified, then the period filter the page is showing — because a truth
   computed over a different set is not a check, it is a second opinion about a different question.
   (First run of this probe did that and reported 4 rows / 347,807 against the page's 3 / 33,648.) */
const truth = () => p.evaluate(() => {
  const all = (typeof window.finLive === 'function') ? window.finLive() : ((window.FIN && FIN.rows) || []).filter((r) => !r.deleted_at);
  const ver = all.filter((r) => r.integrity_status === 'verified_paid');
  const R = (typeof window.finInPeriod === 'function') ? ver.filter(window.finInPeriod) : ver;
  const z = R.filter((r) => Number(r.cost_sar || 0) === 0);
  const sum = (a) => a.reduce((s, x) => s + Number(x.profit_sar || 0), 0);
  return { rows: R.length, zero: z.length, zeroProfit: Math.round(sum(z)), allProfit: Math.round(sum(R)) };
});

const t0 = await truth();
const perf = await read('[data-fin-nocost]', 'data-fin-nocost-profit', 'data-fin-nocost');
/* the key the app uses for the tab the headline warning lives on — read from the app, not guessed */
const PERF_TAB = await p.evaluate(() => { try { return (window.FIN && FIN.tab) || 'perf'; } catch (_) { return 'perf'; } });
await goTab('clients');
const cl = await read('[data-cl-gap-clients]', 'data-cl-gap-profit', 'data-cl-gap-clients');
await goTab('reports');
const rb = await read('[data-rb-nocost]', 'data-rb-nocost-profit', 'data-rb-nocost');

/* Arabic: the same warning, the same amount */
await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) {} });
await p.waitForTimeout(1200);
await goTab(PERF_TAB);
let ar = await read('[data-fin-nocost]', 'data-fin-nocost-profit', 'data-fin-nocost');

/* BRAKE: give every no-cost row a cost, and all three warnings must go */
await p.evaluate(() => {
  try { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); } catch (_) {}
  try {
    ((window.FIN && FIN.rows) || []).forEach((r) => { if (Number(r.cost_sar || 0) === 0) { r.cost_sar = 1; r.profit_sar = Number(r.revenue_sar || 0) - 1; } });
    current = 'finance';
  } catch (_) {}
});
await p.waitForTimeout(400);
await goTab(PERF_TAB);
await p.waitForTimeout(3500);
const gonePerf = await p.evaluate(() => !document.querySelector('[data-fin-nocost]'));
await goTab('clients');
const goneCl = await p.evaluate(() => !document.querySelector('[data-cl-gap-clients]'));
await goTab('reports');
const goneRb = await p.evaluate(() => !document.querySelector('[data-rb-nocost]'));

await b.close(); srv.close?.();

const near = (a, b2, slack) => a != null && b2 != null && Math.abs(a - b2) <= (slack || 1);
const fmt = (n) => Number(n).toLocaleString('en-GB');
const checks = [
  ['the Performance warning names the profit resting on unrecorded cost',
    !!perf && near(perf.amount, t0.zeroProfit, 2) && perf.count === t0.zero,
    perf ? ('page says ' + perf.amount + ' over ' + perf.count + ' rows; the data says ' + t0.zeroProfit + ' over ' + t0.zero) : 'warning not on screen'],
  ['it names the share, and the share is that amount over the profit shown',
    !!perf && perf.share !== null && t0.allProfit > 0 && Math.abs(perf.share - Math.round(100 * t0.zeroProfit / t0.allProfit)) <= 1,
    perf ? ('share ' + perf.share + '%, arithmetic gives ' + Math.round(100 * t0.zeroProfit / t0.allProfit) + '%') : 'n/a'],
  ['Clients & collections names its amount too',
    !!cl && cl.amount > 0 && cl.count > 0 && /SAR/.test(cl.text),
    cl ? (cl.count + ' clients, ' + cl.amount + ' SAR') : 'note not on screen'],
  ['Report Builder names its amount too',
    !!rb && rb.amount > 0 && rb.count > 0 && /SAR/.test(rb.text),
    rb ? (rb.count + ' rows, ' + rb.amount + ' SAR') : 'note not on screen'],
  ['Arabic prints the same amount, in Arabic',
    !!ar && near(ar.amount, t0.zeroProfit, 2) && /[؀-ۿ]/.test(ar.text) && ar.text.indexOf(fmt(perf ? perf.amount : -1)) >= 0,
    ar ? ('amount ' + ar.amount + ', arabic=' + /[؀-ۿ]/.test(ar.text) + ', prints the figure=' + (ar.text.indexOf(fmt(perf ? perf.amount : -1)) >= 0)) : 'warning not on screen in Arabic'],
  /* M50: assert the precondition, not just the outcome. All three must have been ON SCREEN before
     the rows were given a cost, or "they disappeared" proves nothing — as sabotage A showed, where
     this check passed against a build whose warnings never rendered at all. */
  ['give every no-cost row a cost and all three warnings disappear — having been there first',
    !!perf && !!cl && !!rb && gonePerf === true && goneCl === true && goneRb === true,
    JSON.stringify({ wereThere: { performance: !!perf, clients: !!cl, reports: !!rb },
      goneAfter: { performance: gonePerf, clients: goneCl, reports: goneRb } })],
  ['the amount named is the part, not the whole profit total',
    !!perf && t0.allProfit > 0 && perf.amount < t0.allProfit,
    perf ? (perf.amount + ' of a ' + t0.allProfit + ' total') : 'n/a'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
