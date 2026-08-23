/* probe-expense-report-capture.mjs — regression guard for js/65-universal-importer.js's
   TWO-FILE cost-capture join (expense_lines_capture + expense_gate_capture), rebuilt
   2026-08-23. This REPLACES the earlier single-file expense_report_capture probe: that
   design (shipped in commit ef7c254) required a transaction-level txn_expense_status column
   on every expense-report row, and the real source — Direct Payments'
   admin.stats.expense-report (219 corporate rows) — does not carry that column at all. Its
   own columns are INVOICE # | AMOUNT (SAR) | STATUS | APPROVAL DATE | MERCHANT, confirmed by
   checking, not assumed.

   THE GATE'S REAL SOURCE, confirmed 2026-08-23: /en/admin/corporate_clients/transactions
   (RECEIPT REF. | PRODUCT | AMOUNT (SAR) | INVOICE ISSUING | CREATED AT | EXPENSE STATUS,
   153 rows — the expected many-lines-to-one-transaction shape against 219 lines, not a
   mismatch). Per docs/DECISIONS.md principle P1 (take the durable option, not the quick
   one), the join between the two files happens HERE, in the importer, in code — never in a
   one-off capture script that would be invisible to this probe and would die with the
   session that wrote it. The join key itself (expense-report's INVOICE # = transactions'
   RECEIPT REF.) is an UNVERIFIED CLAIM — same number space, not yet proven on a real matching
   pair — which is exactly why every unmatched invoice_no must be reported individually as
   "waiting," never silently dropped: a wrong join-key assumption must surface as a visible
   list, not a quietly-clean import that understates cost. This probe asserts that loud
   reporting directly, on both sides of the join.

   THE SELF-CAUGHT BUG THIS PROBE SPECIFICALLY EXERCISES: EXPENSE_JOIN (the in-memory join
   state) must persist across SEPARATE drop batches, not just within one multi-file drop — the
   two files are captured from two different Direct Payments pages and may genuinely arrive in
   two different sessions (lines today, transaction status tomorrow). An earlier version of
   processFileList() called resetExpenseJoin() at the start of every drop, which would have
   silently destroyed an already-captured file's data the moment the second file was dropped
   later — caught by re-reading the code against the importer's own stated rule before it ever
   shipped, not by a test failure. This probe drops the two files via two SEPARATE
   page.setInputFiles() calls (never together) specifically to prove the fix holds.

   THE STANDING GATE (owner's Aug 20/21 notes, re-confirmed 2026-08-23): per-line Approved is
   not enough — an invoice's cost is only FINAL once its own transaction Expense Status reads
   Ready/Issued; a line can be Approved while ANOTHER line on the same invoice is still Under
   Review, leaving the invoice Pending overall. Summing only the Approved lines in that state
   is a real number that is silently INCOMPLETE. So nothing is ever written unless the gate
   says Ready/Issued — Pending leaves cost_sar exactly as it was: untouched, never zeroed,
   never a partial sum. This probe asserts that gate directly, plus every other guard the
   design carries: no new finance_invoices row is ever created (excluded/unknown invoice_no
   rows are reported, never inserted), a second exclusion-list check runs even though a live
   match already implies the invoice passed it once, a cost that would exceed the invoice's
   own total is rejected, a malformed amount voids that invoice's whole line group, and a
   gate file that disagrees with itself on one invoice_no is refused rather than guessed at. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8211;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const dialogs = [];
  p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });

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

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); });
  await p.waitForTimeout(700);

  // Fixture invoices, matching scripts/qa/mock-supabase.mjs's finance_invoices generator:
  // invoice_no = '11636' + (1000+i), total_incl_vat_sar = 5000 + i*777.
  //   i0 116361000 total 5000  — Ready, 3 Approved lines (one repeated) + 1 Pending line
  //   i1 116361001 total 5777  — Pending gate, 1 Approved line — must stay untouched
  //   i2 116361002 total 6554  — Ready, Approved sum exceeds total — rejected
  //   i3 116361003 total 7331  — gate file disagrees with itself on this invoice — rejected
  //   i4 116361004 total 8108  — Ready, one line has a malformed amount — rejected
  //   i5 116361005 total 8885  — a REAL live invoice with a transaction-status row but NO
  //                              expense lines dropped for it — "waiting for lines," untouched
  const linesCsv = [
    'invoice_no,amount_sar,expense_status',
    '116361000,1000,Approved',
    '116361000,1000,Approved',
    '116361000,500,Approved',
    '116361000,300,Pending',
    '116361001,2000,Approved',
    '9999999999,100,Approved',
    'UNKNOWN-TEST-001,50,Approved',
    '116361002,999999,Approved',
    '116361003,1000,Approved',
    '116361003,500,Approved',
    '116361004,abc,Approved',
  ].join('\n');
  const gateCsv = [
    'invoice_no,txn_expense_status',
    '116361000,Ready',
    '116361001,Pending',
    '9999999999,Ready',
    'UNKNOWN-TEST-001,Ready',
    '116361002,Ready',
    '116361003,Ready',
    '116361003,Pending',
    '116361004,Ready',
    '116361005,Ready',
  ].join('\n');

  // ---- Drop 1: expense_lines_capture ALONE. Everything must sit "waiting for gate" — no
  // Confirm button, nothing written, and every waiting invoice named individually, not folded
  // into a bare count. ----
  await p.setInputFiles('#finFile', { name: 'expense-lines.csv', mimeType: 'text/csv', buffer: Buffer.from(linesCsv) });
  await p.waitForTimeout(1500);

  const preview1 = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/Expense Report — lines/i.test(preview1)) fail(`drop 1: lines file was not recognized as expense_lines_capture: ${preview1.slice(0, 300)}`);
  else ok('drop 1: expense-lines.csv recognized as "Expense Report — lines"');
  if (!/Cost — joined and resolved/i.test(preview1)) fail('drop 1: no joined-result entry appeared — the join must render even with only one file present');
  else ok('drop 1: joined-result entry appeared alongside the raw file');
  if (!/7 invoice\(s\) have expense lines but no transaction status yet/i.test(preview1)) fail(`drop 1: waiting-for-gate note missing or wrong count (expected 7): ${preview1.slice(0, 400)}`);
  else ok('drop 1: waiting-for-gate note correctly counts all 7 invoice_nos');
  if (!/116361000/.test(preview1) || !/waiting/i.test(preview1)) fail('drop 1: individual waiting invoice_nos are not listed — this must be loud per-invoice, not just an aggregate count');
  else ok('drop 1: individual invoice_nos are listed as waiting, not just summarized');
  const hasConfirmBtn1 = await p.evaluate(() => !![...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm/i.test(x.textContent)));
  if (hasConfirmBtn1) fail('drop 1: a Confirm button appeared with only the lines file present — nothing should be writable before the gate arrives');
  else ok('drop 1: no Confirm button — correctly nothing is writable yet');

  // ---- Drop 2: expense_gate_capture ALONE, as a SEPARATE action (this is the exact scenario
  // the self-caught resetExpenseJoin() bug would have broken: a second, later drop must not
  // wipe what drop 1 already captured). ----
  await p.setInputFiles('#finFile', { name: 'expense-gate.csv', mimeType: 'text/csv', buffer: Buffer.from(gateCsv) });
  await p.waitForTimeout(1500);

  const preview2 = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/Expense Report — transaction status \(join\)/i.test(preview2)) fail(`drop 2: gate file was not recognized as expense_gate_capture: ${preview2.slice(0, 300)}`);
  else ok('drop 2: expense-gate.csv recognized as "Expense Report — transaction status (join)"');
  if (!/1 updated/.test(preview2)) fail(`drop 2: expected exactly 1 updated row (116361000) once both files are present: ${preview2.slice(0, 400)}`);
  else ok('drop 2: join resolved to exactly 1 updated row — proves EXPENSE_JOIN carried drop 1\'s data forward into this separate drop');
  if (!/116361005/.test(preview2) || !/waiting/i.test(preview2)) fail('drop 2: the transaction-only invoice (116361005, no expense lines) is not listed as waiting — a join-key mismatch here must be visible, never silent');
  else ok('drop 2: 116361005 (gate with no matching lines) correctly listed as waiting, not silently dropped');
  const hasConfirmBtn2 = await p.evaluate(() => !![...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm/i.test(x.textContent)));
  if (!hasConfirmBtn2) fail('drop 2: no Confirm button appeared even though the join now has a real update to write');
  else ok('drop 2: Confirm button appeared now that the join has a real update');

  const dialogsBefore = dialogs.length;
  const clicked = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('#finImpOut button')];
    const bt = btns.find((x) => /Confirm/i.test(x.textContent));
    if (bt) { bt.click(); return true; }
    return false;
  });
  if (!clicked) fail('no Confirm import button appeared to click');
  else ok('Confirm import button clicked');
  if (dialogs.length > dialogsBefore) fail(`commit alerted instead of importing: ${dialogs[dialogs.length - 1]}`);
  await p.waitForTimeout(1500);

  await p.evaluate(() => { FIN.rows = null; finLoad(); });
  await p.waitForTimeout(1500);

  const rows = await p.evaluate(() => {
    function get(no) { const r = (FIN.rows || []).find((x) => x.invoice_no === no); return r ? { cost: r.cost_sar, profit: r.profit_sar } : null; }
    return {
      applied: get('116361000'),
      pendingGate: get('116361001'),
      exceedsTotal: get('116361002'),
      conflictingGate: get('116361003'),
      malformed: get('116361004'),
      waitingForLines: get('116361005'),
      takamol: get('9999999999'),
    };
  });
  console.log('rows:', JSON.stringify(rows));

  // ---- Invoice 116361000: Ready gate, sum of Approved lines only, repeats NOT deduped ----
  if (!rows.applied) fail('116361000: row went missing entirely');
  else if (rows.applied.cost !== 2500) fail(`116361000: cost_sar is ${rows.applied.cost}, expected 2500 (1000+1000+500 Approved; the repeated 1000 must count twice, the 300 Pending line must not count at all)`);
  else ok('116361000: cost_sar = 2500 — repeated Approved line counted twice, Pending line excluded, exactly as the source data means');

  // ---- Invoice 116361001: Pending gate — must be completely untouched (still the seed's 5084) ----
  if (!rows.pendingGate) fail('116361001: row went missing entirely');
  else if (rows.pendingGate.cost !== 5084) fail(`116361001: cost_sar is ${rows.pendingGate.cost}, expected untouched at 5084 — a Pending-gated invoice must never receive a cost write, even though it has a real Approved line`);
  else ok('116361001: cost_sar left untouched at 5084 — the Pending gate correctly blocked the write despite a real Approved line present');

  // ---- Invoice 116361002: Ready gate but Approved sum exceeds the invoice's own total ----
  if (!rows.exceedsTotal) fail('116361002: row went missing entirely');
  else if (rows.exceedsTotal.cost === 999999) fail('116361002: the impossible 999999 cost was applied — this is exactly the stale-iframe class of bug the cost<=total guard exists to catch');
  else ok(`116361002: cost_sar left untouched at ${rows.exceedsTotal.cost} — the exceeds-total guard correctly rejected 999999`);

  // ---- Invoice 116361003: the GATE FILE disagrees with itself on this invoice_no — never guessed at ----
  if (!rows.conflictingGate) fail('116361003: row went missing entirely');
  else if (rows.conflictingGate.cost === 1500) fail(`116361003: cost_sar was written (${rows.conflictingGate.cost}) despite the gate file disagreeing with itself on this invoice_no — this must never be resolved by guessing`);
  else ok('116361003: cost_sar left untouched — a gate file that disagrees with itself on one invoice_no was correctly refused, not guessed');

  // ---- Invoice 116361004: a malformed amount on one line must void the whole invoice's write ----
  if (!rows.malformed) fail('116361004: row went missing entirely');
  else if (rows.malformed.cost === 0) fail('116361004: a malformed amount silently became 0 cost — must be refused entirely, not fabricated as zero');
  else ok(`116361004: cost_sar left untouched at ${rows.malformed.cost} — the malformed-amount guard correctly refused the whole invoice`);

  // ---- Invoice 116361005: a transaction-status row with NO matching expense lines — never touched ----
  if (!rows.waitingForLines) fail('116361005: row went missing entirely');
  else if (rows.waitingForLines.cost !== 7819) fail(`116361005: cost_sar is ${rows.waitingForLines.cost}, expected untouched at 7819 — a transaction-only row with no expense lines must never receive a cost write`);
  else ok('116361005: cost_sar left untouched at 7819 — correctly waiting for the expense-lines file, never guessed at');

  // ---- Excluded client: never touched, never created ----
  if (!rows.takamol) fail('9999999999 (Takamol, already excluded): row unexpectedly disappeared');
  else if (rows.takamol.cost === 100) fail('9999999999: the excluded Takamol row received a cost write — the exclusion re-check inside the join did not fire');
  else ok('9999999999: the excluded Takamol row was correctly left untouched by the join');

  // ---- Unknown invoice_no (test company / not in our system): never inserted as a new row ----
  const noNewRow = await p.evaluate(() => !(FIN.rows || []).some((r) => r.invoice_no === 'UNKNOWN-TEST-001'));
  if (!noNewRow) fail('UNKNOWN-TEST-001: a new finance_invoices row was created — the join must NEVER insert, only update a live invoice');
  else ok('UNKNOWN-TEST-001: correctly never inserted as a new row — an unmatched invoice_no is reported, never created');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nexpense report capture (two-file join) OK — persists across separate drops, Ready/Issued gate holds, sums are correct without deduping, every trap stays refused loudly, no new rows are ever created.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
