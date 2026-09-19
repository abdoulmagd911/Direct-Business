/* probe-the-profit-says-what-it-does-not-know.mjs — the sentence that keeps the Finance headline
   honest, on the screen the owner reads the money on.

   The live position today: 46 invoices, revenue 2,030,764.29, cost 1,538,141.70, profit 492,622.59
   — and NINETEEN of those invoices carry cost_sar = 0. The database trigger derives profit as
   revenue minus cost, so each of those nineteen stores its whole sale as profit: 214,550 SAR,
   **43.6% of the profit figure on that screen**, from invoices whose cost nobody has recorded.
   Each reads as a 100% margin.

   The app does not hide it. js/16 prints, under the KPIs, "N of M invoices in this period carry no
   recorded cost — margin may read higher than reality until their expenses arrive." That sentence
   is the whole reason the number can be shown at all — DECISIONS M8 allows cost_sar=0 to stay an
   honest gap precisely BECAUSE the screen says so.

   Nothing asserted it. The Report Builder's version of the caveat is checked by
   probe-client-profit-honest; the Finance overview's is one `if` inside a render function several
   hundred lines long, and a probe elsewhere even mentions it in a comment as something that
   "already warns honestly" — a comment is not a check. This probe makes it one.

   Driven against the real database on 2026-09-20 as well, both languages, across every surface that
   prints a profit or a margin: the Finance overview, Performance, Clients & collections, Link
   finance to clients and the Report Builder all carry it. Two that looked bare on a first pass were
   not: the Ledger tab is the TRANSACTION ledger, empty today, and its zeros are true; Individual
   bookings already says in its own words that a blank cost leaves the profit blank and that 0 means
   a genuinely free booking. Recorded here so a later round does not re-check them.

   Sabotage-tested 2026-09-20: with the caveat block removed from js/16, 3 checks FAIL — the page
   prints a profit built half from unrecorded costs and says nothing. The sabotage was run against a
   COPY of the app served through the mock's own APP_DIR, so the repository was never edited at all
   and a battery running at the same time could not be disturbed by it — a better habit than
   editing and restoring, and available to any probe here.
   Run: node scripts/qa/probe-the-profit-says-what-it-does-not-know.mjs                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9090; const BASE = 'http://localhost:' + PORT;

/* Two periods on purpose: one shaped like today's live data (some costs missing) and one where
   every cost is recorded — so the check proves the sentence APPEARS where it is true and STAYS
   AWAY where it is not. A caveat printed always would be no caveat at all. */
const PLAN = [
  // [invoice_date, month, quarter, revenue, cost]
  ['2026-08-05', 'August', 'Q3', 40000, 30000],
  ['2026-08-11', 'August', 'Q3', 25000, 0],
  ['2026-08-17', 'August', 'Q3', 18000, 0],
  ['2026-08-23', 'August', 'Q3', 12000, 9000],
  ['2026-05-06', 'May', 'Q2', 33000, 24000],
  ['2026-05-14', 'May', 'Q2', 21000, 15000],
];
const INV = PLAN.map(([d, mo, q, rev, cost], i) => ({
  id: 'nc' + i, invoice_no: 'NC-' + i, zatca_dpin: null,
  client_group: 'Qaanoon Cost Co', customer_raw_name: 'Qaanoon Cost Co',
  invoice_date: d, month: mo, quarter: q, year: 2026,
  products: 'Flights', service_type: 'Flights', record_type: 'b2b',
  total_incl_vat_sar: rev, wallet_portion_sar: 0, revenue_sar: rev,
  cost_sar: cost, profit_sar: rev - cost,
  amount_received_sar: rev, amount_remaining_sar: 0, collection_due_date: '2026-09-15',
  integrity_status: 'verified_paid', exclusion_reason: null, notes: null, source_batch: 'seed',
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', deleted_at: null,
}));
const AUGUST_NO_COST = 2, AUGUST_TOTAL = 4;

const srv = start(PORT, { finance_invoices: INV });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  /* the ledger only loads once Finance is opened (js/16 gates it on the session), so go there
     FIRST and then wait for the rows — waiting before the visit times out on an empty FIN */
  await p.waitForFunction(() => typeof render === 'function' && typeof current !== 'undefined', { timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { openLead = null; current = 'finance'; render(); });
  await p.waitForFunction(() => window.FIN && Array.isArray(FIN.rows) && FIN.rows.length > 0, { timeout: 120000 });
  await p.waitForTimeout(3500);

  const read = async () => p.evaluate(() => {
    const v = document.getElementById('view'); const t = (v && v.innerText) || '';
    /* the warning is a line of its own; take the whole line so the COUNT in it can be read */
    const line = (t.split('\n').find((x) => /carry no recorded cost|بلا تكلفة مسجلة/.test(x)) || '').trim();
    const n = line.match(/(\d+)\s*(?:of|من)\s*(\d+)/);
    return { chars: t.length, line, counted: n ? [Number(n[1]), Number(n[2])] : null,
      /* the profit figure has to be on screen at the same time — a caveat on a page with no
         profit on it would satisfy a naive check while telling the reader nothing */
      profitShown: /Profit|الربح/.test(t),
      englishLeak: /carry no recorded cost/.test(t) };
  });

  /* the app's own idea of the period, set through its own control rather than by hand */
  const setPeriod = async (fn) => { await p.evaluate(fn); await p.waitForTimeout(2500); };
  await setPeriod(() => { openLead = null; current = 'finance'; render(); });
  const all = await read();

  /* the period is changed through the page's OWN handlers, finPY (year) and finPP (part) — the
     ones the dropdowns call. An earlier draft of this probe set FIN.month and FIN.quarter, which
     no longer exist: it silently changed nothing and read the same unfiltered page twice while
     believing it had filtered it. */
  await setPeriod(() => { if (typeof finPY === 'function') finPY('2026'); });
  await setPeriod(() => { if (typeof finPP === 'function') finPP('M:May'); });
  const clean = await read();

  /* and a period where costs ARE missing — proving the difference is the data, not the render */
  await setPeriod(() => { if (typeof finPP === 'function') finPP('M:August'); });
  const august = await read();

  await ctx.close();
  return { all, clean, august };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN all-periods :', JSON.stringify(en.all));
console.log('  EN August      :', JSON.stringify(en.august));
console.log('  EN May (costed):', JSON.stringify(en.clean));
console.log('  AR August      :', JSON.stringify(ar.august));

const checks = [
  ['the Finance page rendered and is showing a profit figure',
    en.all.chars > 600 && ar.all.chars > 600 && en.all.profitShown && ar.all.profitShown,
    JSON.stringify({ en: en.all.chars, ar: ar.all.chars })],
  ['with invoices whose cost nobody recorded, the page says so instead of letting the profit stand alone',
    !!en.all.line && !!ar.all.line, JSON.stringify({ en: en.all.line, ar: ar.all.line })],
  ['and it says how many, and out of how many — a warning without a number is not information',
    !!en.august.counted && en.august.counted[0] === AUGUST_NO_COST && en.august.counted[1] === AUGUST_TOTAL,
    JSON.stringify(en.august.counted) + ' expected ' + JSON.stringify([AUGUST_NO_COST, AUGUST_TOTAL])],
  ['the Arabic page says it in Arabic, with the same numbers and no English left in',
    !!ar.august.counted && ar.august.counted[0] === AUGUST_NO_COST && ar.august.counted[1] === AUGUST_TOTAL
    && ar.august.englishLeak === false,
    JSON.stringify({ counted: ar.august.counted, english: ar.august.englishLeak, line: ar.august.line })],
  /* the half that makes it a real check rather than a string that is always printed */
  ['a period where every cost IS recorded carries no warning at all',
    en.clean.line === '' && ar.clean.line === '', JSON.stringify({ en: en.clean.line, ar: ar.clean.line })],
  ['…and that period still shows its profit, so the silence is about the data and not an empty page',
    en.clean.profitShown && en.clean.chars > 600, JSON.stringify({ shown: en.clean.profitShown, chars: en.clean.chars })],
  ['reading the money page wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0,
    JSON.stringify(wrote.filter((w) => !/finance_client_links/.test(w)).slice(0, 4))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
