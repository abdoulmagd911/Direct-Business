/* probe-readout-surface-attacks.mjs (2026-09-06, watch cycle 31) - every OTHER way money leaves
   the Finance page to a session that may not see it.

   Cycle 30 found the three CSV exports had no permission check and guarded them with canFinView().
   Round 50 (the Code session) then found that closed only half the case: canFinView() asks whether
   this is a read-only share LINK, and Finance is refused for a second reason too - a ROLE that does
   not allow it. Both halves are now covered by finMayExport(), and probe-export-access-attacks
   holds them.

   This probe asks the question one level wider: the CSV buttons were not the only way money leaves
   this page. Anything on window that reads FIN / TXN state and puts it in front of a person is the
   same shape. Two more were found by reading:

     finRow(id) - opens the invoice modal, which prints an invoice's total, cost, revenue, profit,
     received, remaining and wallet. It is in this lane and had no check of its own.

     exportCurrent() in js/core/core-05-records.js - the Records page's own export reads
     FIN._csvRows DIRECTLY and downloads it, so it never passed through finLedgerCSV and neither
     cycle 30's guard nor round 50's finMayExport() was in its path at all. That file was OUTSIDE
     cycle 31's lane, so cycle 31 measured it and handed it over. GUARDED 2026-09-06 (round 51)
     with the same finMaySeeMoney() question, and the measurement below is now an ASSERTION.

   Under test:
     1. Positive controls first: as an admin every read-out really does produce what it claims, so
        a refusal below means something.
     2. Under a read-only share view AND under a role that denies Finance, each read-out is checked
        separately. Both halves, every time - that is the lesson of round 50.
     3. The three CSVs stay refused (a regression guard on cycles 30 and round 50).
     4. The Records-page export refuses under both halves too (round 51's guard).

   Run:  node scripts/qa/probe-readout-surface-attacks.mjs        (port 8243)
   Sabotage (file-level): remove the guard from finRow, and separately the finance guard from
   exportCurrent() in js/core/core-05-records.js. Each must turn this red on its own. Restore
   byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8243;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SEED = [];
for (let i = 0; i < 6; i++) {
  const mo = (i % 6) + 1, d = '2026-' + String(mo).padStart(2, '0') + '-1' + (i % 8);
  SEED.push({
    id: 'r' + i, invoice_no: 'RS-' + i, line_no: 1, zatca_dpin: null,
    client_group: 'Readout Co ' + (i % 3), customer_raw_name: 'Readout Co ' + (i % 3),
    invoice_date: d, year: 2026, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: 20000 + i * 1234, wallet_portion_sar: 0, revenue_sar: 20000 + i * 1234,
    cost_sar: 12000, profit_sar: 8000 + i * 1234, vat_sar: 0,
    amount_received_sar: 20000 + i * 1234, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'rs-qa',
    revenue_way: 'invoice', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  });
}
const TXNS = [];
for (let i = 0; i < 4; i++) TXNS.push({ id: 'rt' + i, transaction_ref: 'RT-' + i, invoice_no: i < 2 ? 'RS-' + i : null,
  company: 'Readout Co ' + (i % 3), business_id: null, service_type: 'Flights', amount_sar: 5000 + i * 100,
  cost_confirmed_sar: 3000, cost_estimate_sar: null, amount_received_sar: 5000 + i * 100, amount_remaining_sar: 0,
  expense_status: 'ready', overdue: false, created_at_source: '2026-04-0' + (i + 1), deleted_at: null });

const srv = start(PORT, { finance_invoices: SEED, finance_transactions: TXNS, finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;
/* a figure that appears on the invoice modal and nowhere a refused page would legitimately show */
const SECRET = SEED[0].total_incl_vat_sar;

async function main() {
  console.log(`fixture: ${SEED.length} invoices and ${TXNS.length} transactions; invoice RS-0 carries ${SECRET.toLocaleString()} SAR`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  /* build every piece of state the read-outs consume, the way the page builds it */
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  await p.waitForTimeout(1000);
  await p.evaluate(() => finGo('ledger')); await p.waitForTimeout(1300);
  await p.evaluate(() => { finGo('reports'); FIN.rb.g1 = '__client'; FIN.rb.g2 = ''; FIN.rb.verifiedOnly = true; FIN.rb.metrics = { revenue_sar: true }; render(); });
  await p.waitForTimeout(1300);
  await p.evaluate(() => finGo('overview')); await p.waitForTimeout(800);

  const closeModal = () => p.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
  /* finRow: does a money modal appear, and does it carry the invoice's figures? */
  const tryRow = async () => {
    await closeModal();
    const r = await p.evaluate((secret) => {
      let alerted = null; const oa = window.alert; window.alert = function (m) { alerted = String(m); };
      let threw = null;
      try { const row = (FIN.rows || []).find(x => x.invoice_no === 'RS-0'); if (row) window.finRow(row.id); else threw = 'fixture row missing'; }
      catch (e) { threw = String(e && e.message || e); }
      window.alert = oa;
      const m = document.getElementById('finModal');
      const txt = m ? (m.innerText || '') : '';
      return { modal: !!m, hasMoney: txt.indexOf(secret.toLocaleString('en-US')) >= 0 || /\d{1,3}(,\d{3})+/.test(txt), sample: txt.slice(0, 120).replace(/\s+/g, ' '), alerted, threw };
    }, SECRET);
    return r;
  };
  const tryExport = (fn) => p.evaluate((fn) => new Promise((res) => {
    let captured = null, clicked = false, alerted = null, threw = null;
    const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click, oa = window.alert;
    URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { clicked = true; };
    window.alert = function (m) { alerted = String(m); };
    try { if (typeof window[fn] === 'function') window[fn](); else threw = 'not a function'; } catch (e) { threw = String(e && e.message || e); }
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2; window.alert = oa;
    if (!captured) return res({ file: null, clicked, alerted, threw });
    captured.text().then((t) => res({ file: t.replace(/^﻿/, ''), clicked, alerted, threw }));
  }), fn);
  /* the Records page's own export path, which reads FIN._csvRows directly */
  const tryRecords = () => p.evaluate(() => new Promise((res) => {
    let captured = null, name = null, alerted = null, threw = null;
    const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click, oa = window.alert;
    URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { name = this.getAttribute('download'); };
    window.alert = function (m) { alerted = String(m); };
    const prev = window.current;
    try { window.current = 'finance'; if (typeof window.exportCurrent === 'function') window.exportCurrent('csv'); else threw = 'exportCurrent not reachable'; }
    catch (e) { threw = String(e && e.message || e); }
    window.current = prev;
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2; window.alert = oa;
    if (!captured) return res({ file: null, name, alerted, threw });
    captured.text().then((t) => res({ file: t.replace(/^﻿/, ''), name, alerted, threw }));
  }));
  const EXPORTS = [['finLedgerCSV', 'the invoice export'], ['finTxnCSV', 'the ledger export'], ['finCSV', 'the Report Builder export']];
  let recordsSeen = false;

  /* ---------- 1. positive controls ---------- */
  const ctlRow = await tryRow();
  if (ctlRow.modal && ctlRow.hasMoney) ok(`control: as an admin, finRow opens the invoice modal and it carries money — "${ctlRow.sample}"`);
  else fail(`control: as an admin, finRow produced no money modal (${JSON.stringify(ctlRow)}) — the checks below would pass for the wrong reason`);
  await closeModal();
  let ctlBad = 0;
  for (const [fn, label] of EXPORTS) {
    const r = await tryExport(fn);
    if (r.file && r.file.trim().split('\n').length > 1) ok(`control: as an admin, ${label} produces a file with ${r.file.trim().split('\n').length - 1} row(s)`);
    else { ctlBad++; fail(`control: as an admin, ${label} produced no file (${JSON.stringify({ a: r.alerted, t: r.threw })})`); }
  }
  const ctlRec = await tryRecords();
  /* This control is what stops step 4 below passing for the wrong reason. "No file under a denied
     role" is only meaningful if an ALLOWED role gets one — otherwise a path that simply broke, or
     a harness that cannot reach it, would read as a permission check working. So it FAILS here. */
  if (ctlRec.file && ctlRec.file.trim().split('\n').length > 1) ok(`control: as an admin, the Records-page finance export produces a file (${ctlRec.name || 'unnamed'}) with ${ctlRec.file.trim().split('\n').length - 1} row(s) — it reads FIN._csvRows directly, never through finLedgerCSV`);
  else { ctlBad++; fail(`control: as an admin, the Records-page finance export produced no file (${JSON.stringify({ a: ctlRec.alerted, t: ctlRec.threw })}) — the refusal checks below would then pass for the wrong reason, so this is a failure, not a skip`); }
  if (ctlBad) { console.log('\nFAILED - ' + failures + ' check(s)'); await b.close(); srv.close(); process.exit(1); }

  /* ---------- 2. both halves of "refused Finance" ---------- */
  const HALVES = [
    ['a read-only share view', () => { window.__isShareView = true; }],
    ['a role that denies Finance', () => { window.__isShareView = false; window.__userTier = 'viewer'; window.__accessKnown = function () { return true; }; window.myAllowedPages = function () { return ['leads']; }; }]
  ];
  for (const [half, setup] of HALVES) {
    await p.evaluate(setup);
    const st = await p.evaluate(() => ({ canFinView: typeof canFinView === 'function' ? canFinView() : null, mayOpen: window.__v73MayOpen ? window.__v73MayOpen('finance') : null, mayExport: typeof window.finMayExport === 'function' ? window.finMayExport() : null }));
    if (st.mayExport === false) ok(`control: under ${half}, finMayExport() says no (canFinView ${st.canFinView}, mayOpen ${st.mayOpen}) — the session really is refused Finance`);
    else fail(`control: under ${half}, finMayExport() says ${st.mayExport} (${JSON.stringify(st)}) — this half is not set up, so nothing below is tested`);

    for (const [fn, label] of EXPORTS) {
      const r = await tryExport(fn);
      if (!r.file && !r.clicked) ok(`under ${half}: ${label} still refuses`);
      else fail(`REGRESSION — under ${half}: ${label} produced a file again; cycles 30 and round 50 both closed this`);
    }
    const rr = await tryRow();
    if (!rr.modal) ok(`under ${half}: finRow opens no invoice modal${rr.alerted ? ' — "' + rr.alerted.slice(0, 80) + '"' : ''}`);
    else fail(`under ${half}: finRow opened the invoice modal with the invoice's total, cost, revenue, profit, received and remaining on it — "${rr.sample}". The page refuses this session in words, and every CSV export now asks the same question, but the modal that prints one invoice's whole money does not`);
    await closeModal();

    /* Cycle 31 could only MEASURE this one — js/core/core-05-records.js was outside its lane, so
       it left a note and handed the file over. Round 51 guarded it with the same two-question
       finMaySeeMoney(), so the note is now an assertion: a finance file here is a failure, exactly
       like the three Ledger exports above. The admin control at step 1 is what keeps this honest —
       it fails if an allowed role gets nothing, so "no file" can never mean "path broken". */
    const rec = await tryRecords();
    if (!rec.file) ok(`under ${half}: the Records-page export produced no finance file${rec.alerted ? ' — "' + rec.alerted.slice(0, 70) + '"' : ''}`);
    else fail(`under ${half}: the Records-page export handed over a ${rec.file.trim().split('\n').length - 1}-row finance file (${rec.name || 'unnamed'}) of invoice money. It reads FIN._csvRows directly, so finLedgerCSV's guard is not in its path — round 51 guarded exportCurrent() itself; that guard is gone or no longer asks both questions`);
    recordsSeen = recordsSeen || !!rec.file || !!rec.alerted || !!rec.threw;

    await p.evaluate(() => { window.__isShareView = false; window.__userTier = 'admin'; try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; } try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; } });
  }

  if (recordsSeen) ok('the Records-page finance export is still a live path — it answered under a denied role rather than silently not existing, so the refusals above are a guard doing its job');
  else fail('the Records-page finance export produced nothing and said nothing under either half — it may have been rewired or removed, in which case the checks above are guarding code that has moved. Re-read js/core/core-05-records.js before trusting this probe again');

  if (!errors.length) ok('no page error'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
