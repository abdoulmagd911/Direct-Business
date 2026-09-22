/* probe-an-empty-finance-tab-says-it-is-empty.mjs — the three Finance capture tabs say, in words,
   that nothing has been recorded — and stop saying it the moment something is.

   Fire #207, a verification round. Three tabs on Finance exist to capture what the mirror cannot
   know: Expenses (the real cost behind a service), Payment proofs, and Individual bookings.
   Measured against the LIVE database on 2026-09-22 they are, all three, completely empty:

       finance_expenses   content-range 0-0/1   — that one row is soft-deleted, so 0 live
       proof_documents    content-range 0-0/1   — likewise
       individual bookings (finance_invoices where revenue_way='b2c_manual')   none

   Each tab handles it correctly and bilingually — "No service costs recorded yet." / «لا تكاليف
   خدمات مسجلة بعد.» and the two equivalents — which is the house rule (an empty list must say it is
   empty, never just show a 0) already honoured here. Nothing was wrong, and nothing guarded it:
   a table change that dropped the empty row would have looked like a working page with a shorter
   list. That is what this probe is for.

   Worth knowing beside it, because the two facts belong together: 19 of the 46 live invoices record
   their cost as 0, carrying 214,550 SAR of the 492,622.59 SAR profit total. The tool for recording
   what those services actually cost is built, bilingual, keeps its receipts — and has never been
   used. That is an owner decision, not a defect, and it is on the list in docs/BACKLOG.md.

   What this holds:
     1-3. with no rows, each of the three tabs shows its own "…recorded yet" line, in English;
     4.   the same three in Arabic;
     5.   the brake: with ONE row present, each tab shows the row and NO LONGER shows the line —
          a page that always prints the empty line would pass 1-4 and be lying;
     6.   no JS errors in either language.

   The three tables are answered by this probe rather than the mock, so "empty" and "one row" are
   both exact and neither depends on fixture drift.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched), a real run:
     · dropping the empty-state cell from js/45 (the expenses table falls back to an empty tbody) —
       fails 1 and 4, naming the tab that went silent.
   Run: node scripts/qa/probe-an-empty-finance-tab-says-it-is-empty.mjs                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9237 — one mock. */
const PORT = 9237; const BASE = 'http://localhost:' + PORT;

const ROWS = {
  expenses: [],
  proofs: [],
  b2c: []
};
const ONE = {
  expenses: [{ id: 'qa-exp-1', expense_date: '2026-09-01', description: 'QA hotel night', service_type: 'Hotels',
    transaction_ref: 'QA-TX-1', amount_sar: 1234, paid_via: 'bank_transfer', supplier: 'QA Supplier',
    proof_path: null, notes: '', deleted_at: null }],
  proofs: [{ id: 'qa-prf-1', doc_date: '2026-09-02', doc_type: 'transfer', client_group: 'QA Client',
    invoice_no: 'QA-INV-1', wallet_topup_ref: null, file_path: null, amount_sar: 500, notes: '', deleted_at: null }],
  b2c: [{ id: 'qa-b2c-1', invoice_date: '2026-09-03', client_group: 'QA Person', service_type: 'Flights',
    integrity_status: 'verified_paid', invoice_no: 'QA-B2C-1', total_incl_vat_sar: 900, revenue_way: 'b2c_manual',
    cost_sar: null, profit_sar: null, deleted_at: null }]
};

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', (d) => { try { if (d.type() === 'beforeunload') return d.accept(); } catch (_) {} return d.dismiss(); });
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  if (m === 'GET') {
    const j = (rows) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    if (u.pathname === '/rest/v1/finance_expenses') { await j(ROWS.expenses); return; }
    if (u.pathname === '/rest/v1/proof_documents') { await j(ROWS.proofs); return; }
    if (u.pathname === '/rest/v1/finance_invoices' && /revenue_way=eq\.b2c_manual/.test(u.search)) { await j(ROWS.b2c); return; }
  }
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

const signIn = async () => {
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(3500);
};
await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await signIn();

const TABS = [
  ['expenses', 'No service costs recorded yet.', 'لا تكاليف خدمات مسجلة بعد.'],
  ['proofs', 'No payment proofs recorded yet.', 'لا مستندات دفع مسجلة بعد.'],
  ['b2c', 'No individual bookings recorded yet.', 'لا حجوزات فردية مسجلة بعد.']
];
const readTab = async (tab, lang) => {
  await p.evaluate(([tb, l]) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); current = 'finance'; FIN.tab = tb; render(); } catch (_) {} }, [tab, lang]);
  await p.waitForTimeout(3000);
  return p.evaluate(() => {
    const v = document.querySelector('#view'); const t = v ? (v.innerText || '') : '';
    const tb = v ? v.querySelector('table') : null;
    /* the empty state IS a table row, so "rows" counts it — the data rows are the ones with more
       than one cell, which is what tells an empty table from a table with one record in it */
    const trs = tb ? [...tb.querySelectorAll('tbody tr')] : [];
    return { text: t, dataRows: trs.filter((x) => x.querySelectorAll('td').length > 1).length };
  });
};

const empty = {};
for (const [tab] of TABS) { empty[tab + ':en'] = await readTab(tab, 'en'); empty[tab + ':ar'] = await readTab(tab, 'ar'); }

/* one row in each table — the same screens must stop saying they are empty */
ROWS.expenses = ONE.expenses; ROWS.proofs = ONE.proofs; ROWS.b2c = ONE.b2c;
await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(4000);
const filled = {};
for (const [tab] of TABS) filled[tab] = await readTab(tab, 'en');
await b.close(); srv.close?.();

const saysEmpty = (r, phrase) => !!r && r.text.indexOf(phrase) >= 0 && r.dataRows === 0;
const checks = [];
for (const [tab, en] of TABS) {
  checks.push(['the ' + tab + ' tab says in English that nothing is recorded yet',
    saysEmpty(empty[tab + ':en'], en),
    JSON.stringify({ found: !!empty[tab + ':en'] && empty[tab + ':en'].text.indexOf(en) >= 0, dataRows: empty[tab + ':en'] && empty[tab + ':en'].dataRows })]);
}
checks.push(['all three say it in Arabic too',
  TABS.every(([tab, , ar]) => saysEmpty(empty[tab + ':ar'], ar)),
  JSON.stringify(TABS.map(([tab, , ar]) => tab + ':' + (empty[tab + ':ar'] && empty[tab + ':ar'].text.indexOf(ar) >= 0)))]);
checks.push(['brake: with one record each, the row is drawn and the empty line is gone',
  TABS.every(([tab, en]) => filled[tab] && filled[tab].dataRows === 1 && filled[tab].text.indexOf(en) < 0),
  JSON.stringify(TABS.map(([tab, en]) => ({ tab, rows: filled[tab] && filled[tab].dataRows, stillSaysEmpty: !!filled[tab] && filled[tab].text.indexOf(en) >= 0 })))]);
checks.push(['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')]);
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
