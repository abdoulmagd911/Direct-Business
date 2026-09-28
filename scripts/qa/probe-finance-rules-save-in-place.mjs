/* probe-finance-rules-save-in-place.mjs (2026-09-28) — Finance punch list A: the Finance freeze.
   Found by the oversight walking the live app as QA: every save on Finance → Rules (a rule, an item name) emptied the whole
   ledger and loaded it again ("Loading the finance ledger…" for ~20 s on the office PC), and saves made close together
   stacked full reloads until the tab hung. What this holds, with 600 made-up invoices in the stand-in (rule 7):
     1. adding an item name on the Rules tab never reloads the invoices: FIN.rows is the same list before and after, and
        finance_invoices is not read again — only the money view (money_rows) is;
     2. at most one money_rows read per save, and refreshes that land while a read is running share it (five fired together →
        one or two reads);
     3. "Loading the finance ledger" is never on screen after a save, and the page answers (a JS round trip) in under 1.5 s
        after each save;
     4. the new names land: the Rules list shows all three, and FIN.m carries the refreshed view (pass-through appears);
     5. no JS error, no native dialog.
   Sabotage: put `FIN.rows=null; finLoad();` back in js/119's add path → checks 1 and 2 go red.
   PORT 9751. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const PORT = 9751;

const invs = [], lines = [];
for (let i = 1; i <= 600; i++) {
  const no = 'QA-FRZ-' + String(i).padStart(4, '0'), d = '2026-' + String(1 + (i % 9)).padStart(2, '0') + '-' + String(1 + (i % 27)).padStart(2, '0');
  invs.push({ id: 'frz-' + i, invoice_no: no, client_group: 'QA Freeze Co ' + (i % 40), customer_raw_name: 'QA Freeze Co ' + (i % 40), invoice_date: d, paid_at: d,
    total_incl_vat_sar: 1000 + i, wallet_portion_sar: 0, revenue_sar: 1000 + i, cost_sar: null, profit_sar: null, amount_received_sar: 1000 + i, amount_remaining_sar: 0,
    integrity_status: 'verified_paid', payments_status: 'Fully Paid', row_kind: 'sale', revenue_way: 'invoice', deleted_at: null, source_batch: 'qa-frz', source: 'import' });
  lines.push({ id: 2 * i, invoice_no: no, line_no: 1, kind: 'item', product: 'Direct Flights', name: 'Flight Booking - QA Frz Fare', item_total_sar: 900, taxable: false });
  lines.push({ id: 2 * i + 1, invoice_no: no, line_no: 2, kind: 'item', product: 'Direct Flights', name: 'Flight Booking - QA Frz Fee', item_total_sar: 100 + i, taxable: true });
}

(async () => {
  process.env.MOCK_ROLE = 'admin';
  const { start } = await import('./mock-supabase.mjs'); const srv = start(PORT, { finance_invoices: invs, finance_invoice_lines: lines }); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errors = [], natives = [], reads = { inv: 0, mr: 0 };
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.message()); d.dismiss(); });
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    if (rq.method() === 'GET' && /\/rest\/v1\/finance_invoices$/.test(u.pathname)) reads.inv++;
    if (rq.method() === 'GET' && /\/rest\/v1\/money_rows$/.test(u.pathname)) reads.mr++;
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && window.FIN && FIN.rows && FIN.rows.length >= 600 && FIN.m && !FIN.loading, null, { timeout: 150000 });
  await p.evaluate(() => { current = 'finance'; finGo('rules'); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__frzRows = FIN.rows; });
  const before = { ...reads };

  /* three saves, quickly */
  const lag = [];
  for (const nm of ['QA Frz Fare', 'QA Frz Extra One', 'QA Frz Extra Two']) {
    await p.evaluate(() => window.v119AddItem()); await p.waitForSelector('#v119_name', { timeout: 10000 });
    await p.fill('#v119_name', nm); await p.evaluate(() => { const s = document.getElementById('v119_class'); if (s) s.value = 'pass_through'; });
    await p.click('#mSave');
    const t0 = Date.now(); await p.evaluate(() => 1); lag.push(Date.now() - t0);
    await p.waitForTimeout(120);
  }
  await p.waitForFunction(() => !FIN._mrBusy, null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => { const r = FIN.rows.find((x) => x.invoice_no === 'QA-FRZ-0001'); const m = FIN.m[r.id] || {};
    return { same: window.__frzRows === FIN.rows, n: FIN.rows.length, pt: m.pass_through_sar, loading: /Loading the finance ledger/.test(document.body.innerText),
      names: [...document.querySelectorAll('.v119-items [data-v119-item]')].length }; });
  const invReads = reads.inv - before.inv, mrReads = reads.mr - before.mr;
  check(after.same && after.n === 600 && invReads === 0, '1. a save on Rules never reloads the invoices (same list, finance_invoices not read again)', JSON.stringify({ same: after.same, n: after.n, invReads }));
  const b2 = reads.mr; await p.evaluate(() => { for (let i = 0; i < 5; i++) finRefreshMoney(); });
  await p.waitForFunction(() => !FIN._mrBusy, null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  const burst = reads.mr - b2;
  check(mrReads >= 1 && mrReads <= 3 && burst >= 1 && burst <= 2, '2. one money-view read per save at most, and five refreshes fired together share 1–2 reads', JSON.stringify({ perSave: mrReads, burst }));
  check(!after.loading && Math.max(...lag) < 1500, '3. no "Loading the finance ledger" after a save, and the page answers at once', JSON.stringify({ loading: after.loading, lag }));
  check(after.names === 3 && +after.pt === 900, '4. all three names land and the refreshed view shows the pass-through (900)', JSON.stringify(after));
  check(!errors.length && !natives.length, '5. no JS error, no native dialog', JSON.stringify({ errors, natives }));
  await b.close(); try { srv.close(); } catch (_) { }
  console.log(failures ? '\nFAILED — ' + failures + ' check(s)' : '\nPASS — a Rules save refreshes the money view in place, never the whole ledger');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
