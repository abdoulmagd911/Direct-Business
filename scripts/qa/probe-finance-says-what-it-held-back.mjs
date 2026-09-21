/* probe-finance-says-what-it-held-back.mjs — the page that counts the money says how much of it
   it is not counting.

   Fire #190. The Finance header reads "46 invoices · data through 2026-08-20". Driven against the
   live database, the page held **91 rows in memory and dropped 45 of them** from every figure on it
   — revenue, cost, profit, the client tables, the report builder — and said nothing. The words
   "excluded", "held back" and "deleted" appeared nowhere on the page, and `FIN.showDeleted` was a
   flag declared in the state object and wired to nothing at all.

   Of the 45 live ones: 10 carry a recorded reason (verification revenue that belongs to another
   system and must never appear here) and **35 carry no reason at all**, soft-deleted during the
   August data work. A month past the 24-hour undo window, with the Archive page covering companies
   only, nothing in the app mentioned they existed.

   This is M39 on the page where it matters most: a figure that excludes rows says how many it
   dropped. The tile beside Leads learned it in #181; Finance never had.

   What this holds:
     1. with rows held back, the page says so — the count, in words, at the top;
     2. it splits them: how many carry a recorded reason and how many do not;
     3. the two parts add up to the whole, and the whole is the number actually held back;
     4. it says they are still in the database, so a held-back row is never read as a loss;
     5. with NOTHING held back it says nothing at all — a clean ledger gets no apology;
     6. the figures on the page are unchanged: the held-back rows are still excluded from them, and
        the header still counts only the live invoices;
     7. it is only on Finance — switching page removes it;
     8. in Arabic the sentence is Arabic;
     9. no JS errors.

   Checks 5, 6 and 7 are the brakes. A sentence that always shows, or one bought by quietly letting
   the held-back rows into the totals, or one left behind on another page, would each pass the rest
   and make the app worse — and 6 is the important one, because these are money figures.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/99
   fails checks 1, 2, 3, 4 and 8; counting every held-back row as "no reason recorded" fails check 2
   alone — check 3 still passes, because 0 + 3 sums to 3 just as 2 + 1 does. Arithmetic that adds up
   is not the same as arithmetic that is right, which is why the split is checked separately.
   Run: node scripts/qa/probe-finance-says-what-it-held-back.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9215-9218 — four mocks: PORT, PORT+1, PORT+2, PORT+3 (fire #188's rule). */
const PORT = 9215; const BASE = 'http://localhost:' + PORT;

/* synthetic money, deliberately unlike anything real (rule 7) */
const inv = (o) => Object.assign({
  id: 'qa-' + Math.abs(o.line_no || 1), invoice_no: 'QA-INV-' + (o.line_no || 1), line_no: 1,
  invoice_date: '2026-05-10', month: '2026-05', quarter: '2026-Q2', year: 2026,
  customer_raw_name: 'QA Held Back Co', client_group: 'QA Held Back Co', branch: 'QA', salesman: 'QA',
  record_type: 'b2b', origin: 'booking', service_type: 'Flights', products: null, items: null,
  total_incl_vat_sar: 1000, vat_sar: 0, wallet_portion_sar: 0, discount_sar: 0,
  revenue_sar: 1000, cost_sar: 700, profit_sar: 300, amount_received_sar: 1000, amount_remaining_sar: 0,
  revenue_way: 'invoice', integrity_status: 'verified_paid', zatca_dpin: null, transaction_ref: null,
  direct_uuid: null, proposal_ref: null, project_tag: null, source_batch: 'qa', notes: null,
  collection_due_date: null, exclusion_reason: null, deleted_at: null,
  created_at: '2026-05-10T00:00:00Z', updated_at: '2026-05-10T00:00:00Z',
}, o);

/* three live, three held back: two with a recorded reason, one without */
const MIXED = [
  inv({ id: 'qa1', invoice_no: 'QA-INV-1', line_no: 1 }),
  inv({ id: 'qa2', invoice_no: 'QA-INV-2', line_no: 2 }),
  inv({ id: 'qa3', invoice_no: 'QA-INV-3', line_no: 3 }),
  inv({ id: 'qa4', invoice_no: 'QA-INV-4', line_no: 4, deleted_at: '2026-08-22T00:00:00Z', exclusion_reason: 'QA — belongs to another system' }),
  inv({ id: 'qa5', invoice_no: 'QA-INV-5', line_no: 5, deleted_at: '2026-08-22T00:00:00Z', exclusion_reason: 'QA — belongs to another system' }),
  inv({ id: 'qa6', invoice_no: 'QA-INV-6', line_no: 6, deleted_at: '2026-08-23T00:00:00Z' }),
];
const CLEAN = MIXED.filter((r) => !r.deleted_at);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(rows, port, opts) {
  opts = opts || {};
  const srv = start(port, { finance_invoices: rows });
  const base = 'http://localhost:' + port;
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 }, locale: 'en-GB' });
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
  await p.goto(base + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(2500);
  if (opts.arabic) { await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }); await p.waitForTimeout(1200); }
  const out = await p.evaluate(() => {
    try { current = 'finance'; openLead = null; render(); } catch (_) {}
    return new Promise((res) => setTimeout(() => {
      const v = document.getElementById('view');
      const e = document.getElementById('v99-heldback');
      let finRows = null, held = null, counted = null;
      try {
        finRows = (window.FIN && FIN.rows) ? FIN.rows.length : null;
        held = (window.FIN && FIN.rows) ? FIN.rows.filter((r) => r.deleted_at).length : null;
        counted = (typeof window.live === 'function') ? null : null;
      } catch (_) {}
      const txt = (v.innerText || '').replace(/\s+/g, ' ').trim();
      /* the header's own invoice count, which must still describe the LIVE rows only */
      const hdr = (txt.match(/(\d+)\s+invoices? ·|·\s*(\d+)\s*فاتورة/) || [])[1] || null;
      res({
        note: e ? (e.textContent || '').trim() : '',
        n: e ? e.getAttribute('data-n') : null,
        withReason: e ? e.getAttribute('data-with-reason') : null,
        without: e ? e.getAttribute('data-without-reason') : null,
        finRows, held, headerInvoices: hdr,
        pageText: txt.slice(0, 300),
      });
    }, 5200));
  });
  /* and away from Finance */
  const elsewhere = await p.evaluate(() => {
    try { current = 'leads'; openLead = null; render(); } catch (_) {}
    return new Promise((res) => setTimeout(() => res(!!document.getElementById('v99-heldback')), 2400));
  });
  await ctx.close(); srv.close?.();
  return Object.assign(out, { elsewhere });
}

const mixed = await run(MIXED, PORT);
const clean = await run(CLEAN, PORT + 1);
const arab = await run(MIXED, PORT + 2, { arabic: true });
await b.close();

const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const n = +(mixed.n || 0), wr = +(mixed.withReason || 0), wo = +(mixed.without || 0);

const checks = [
  ['with rows held back, the page says so, with the count in words',
    !!mixed.note && /^3 finance records are held back/.test(mixed.note),
    mixed.note.slice(0, 90) || '(nothing said)'],
  ['it splits them by whether a reason was recorded',
    wr === 2 && wo === 1 && /2 with a reason recorded and 1 with none/.test(mixed.note),
    JSON.stringify({ withReason: mixed.withReason, without: mixed.without })],
  ['the two parts add up to the whole, and the whole is what is really held back',
    n === wr + wo && n === mixed.held && mixed.held === 3,
    JSON.stringify({ said: n, parts: wr + wo, reallyHeld: mixed.held })],
  ['it says they are still in the database', /still in the database/i.test(mixed.note),
    mixed.note.slice(-60)],
  ['with nothing held back it says nothing at all',
    clean.note === '' && clean.held === 0 && clean.finRows === 3,
    JSON.stringify({ note: clean.note, held: clean.held, rows: clean.finRows })],
  ['the page\'s own figures are unchanged — the header still counts the live invoices only',
    mixed.headerInvoices === '3' && clean.headerInvoices === '3' && mixed.finRows === 6,
    JSON.stringify({ mixedHeader: mixed.headerInvoices, cleanHeader: clean.headerInvoices, inMemory: mixed.finRows })],
  ['it is only on Finance', mixed.elsewhere === false && clean.elsewhere === false,
    JSON.stringify({ mixed: mixed.elsewhere, clean: clean.elsewhere })],
  ['in Arabic the sentence is Arabic',
    hasArabic(arab.note) && !/held back|still in the database/i.test(arab.note) && arab.n === '3',
    (arab.note || '(nothing)').slice(0, 70)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n2, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n2 + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
