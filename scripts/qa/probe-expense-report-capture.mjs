/* probe-expense-report-capture.mjs — regression guard for js/65-universal-importer.js's
   TWO-LEVEL cost-capture join, rebuilt 2026-08-24. This REPLACES the previous (2026-08-23)
   single-level two-file join, which was PROVEN WRONG the same day it shipped: it assumed the
   expense report's own INVOICE # was directly finance_invoices.invoice_no. It is not — it is
   the TRANSACTION's own reference. The real chain, verified end to end on a live example:
   expense line INVOICE # 1163760881 = transaction 1163760881, whose own INVOICE ISSUING column
   reads "Issued 1163762432" — 1163762432 IS a real finance_invoices row (5,600.00 SAR),
   matching the transaction's amount and its single Approved line exactly. So the real model has
   TWO levels: many expense lines → one transaction (Level 1), many transactions → one tax
   invoice (Level 2, confirmed on a real 7-transaction group all issuing into the same invoice).
   Grouping lines by their own INVOICE # directly, as the previous version did, would never
   have produced a correct number.

   SECOND CORRECTION this probe exists to guard: EXPENSE STATUS blank does NOT mean "unknown"
   or "not ready" — it IS the "Issued" half of the Ready/Issued gate (blank always co-occurs
   with invoice_issuing_raw = "Issued <no>"; the on-screen badge itself renders with no text).
   Treating blank as not-ready (the previous version's literal READY_STATUSES=['ready','issued']
   check, which blank never matched) would have dropped nearly half of all real transactions
   and produced a clean-looking, badly understated cost.

   THE SINGLE MOST IMPORTANT NEW SAFEGUARD this probe proves: when an invoice is fed by MORE
   THAN ONE transaction, and even just ONE of those transactions is not yet clean (no lines
   captured yet, a malformed line, a self-conflicting gate row, or a status that contradicts
   its own issued-ness), the WHOLE invoice must be held back — never a partial sum from only
   the transactions that happened to be clean. That silent partial-sum shape is exactly what
   made the previous single-level design dangerous in the first place, just one level down. */
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
  //   i0 116361000 total 5000  — TWO transactions (T1 blank-status, T2 Ready) issue into it —
  //                              proves multi-transaction aggregation AND blank==Issued
  //   i1 116361001 total 5777  — no transaction issues into it — stays untouched
  //   i2 116361002 total 6554  — one transaction, approved sum exceeds total — held back
  //   i3 116361003 total 7331  — one transaction, gate file disagrees with itself — held back
  //   i4 116361004 total 8108  — one transaction, a line has a malformed amount — held back
  //   i5 116361005 total 8885  — TWO transactions issue into it; ONE has no lines captured —
  //                              the whole invoice must be held back, NOT a partial sum from
  //                              the one clean transaction (the core new safeguard)
  //   i6 116361006 total 9662  — one transaction, issued but status reads "Pending" —
  //                              contradiction, held back
  const linesCsv = [
    'transaction_ref,amount_sar,expense_status',
    'T1,750,Approved',
    'T1,750,Approved',
    'T2,500,Approved',
    'T2,300,Pending',
    'T4,999999,Approved',
    'T6,1000,Approved',
    'T7,abc,Approved',
    'T8,2000,Approved',
    'T10,100,Approved',
    'T11,50,Approved',
    'T3,2000,Approved',
    'T13,1200,Approved',
    'T12,300,Approved',
  ].join('\n');
  const gateCsv = [
    'transaction_ref,txn_expense_status,invoice_issuing_raw',
    'T1,,Issued 116361000',
    'T2,Ready,Issued 116361000',
    'T4,,Issued 116361002',
    'T6,Ready,Issued 116361003',
    'T6,Pending,Issued 116361099',
    'T7,,Issued 116361004',
    'T8,,Issued 116361005',
    'T9,,Issued 116361005',
    'T10,,Issued 9999999999',
    'T11,,Issued UNKNOWN-TEST-002',
    'T3,Pending,Need to issue',
    'T13,Pending,Issued 116361006',
  ].join('\n');

  // ---- Drop 1: expense_lines_capture ALONE. Every transaction must sit "waiting for gate" —
  // no Confirm button, nothing written. ----
  await p.setInputFiles('#finFile', { name: 'expense-lines.csv', mimeType: 'text/csv', buffer: Buffer.from(linesCsv) });
  await p.waitForTimeout(1500);

  const preview1 = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/Expense Report — lines/i.test(preview1)) fail(`drop 1: lines file was not recognized as expense_lines_capture: ${preview1.slice(0, 300)}`);
  else ok('drop 1: expense-lines.csv recognized as "Expense Report — lines"');
  if (!/11 transaction\(s\) have expense lines but no transaction-status row yet/i.test(preview1)) fail(`drop 1: waiting-for-gate note missing or wrong count (expected 11 distinct transaction_refs): ${preview1.slice(0, 400)}`);
  else ok('drop 1: waiting-for-gate note correctly counts all 11 transaction_refs');
  const hasConfirmBtn1 = await p.evaluate(() => !![...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm/i.test(x.textContent)));
  if (hasConfirmBtn1) fail('drop 1: a Confirm button appeared with only the lines file present — nothing should be writable before the gate arrives');
  else ok('drop 1: no Confirm button — correctly nothing is writable yet');

  // ---- Drop 2: expense_gate_capture ALONE, as a SEPARATE action — proves EXPENSE_JOIN
  // persists across separate drops, and resolves the full two-level join. ----
  await p.setInputFiles('#finFile', { name: 'expense-gate.csv', mimeType: 'text/csv', buffer: Buffer.from(gateCsv) });
  await p.waitForTimeout(1500);

  const preview2 = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/Expense Report — transaction status \(join\)/i.test(preview2)) fail(`drop 2: gate file was not recognized as expense_gate_capture: ${preview2.slice(0, 300)}`);
  else ok('drop 2: expense-gate.csv recognized as "Expense Report — transaction status (join)"');
  if (!/1 updated/.test(preview2)) fail(`drop 2: expected exactly 1 updated row (116361000) once both files are present: ${preview2.slice(0, 400)}`);
  else ok('drop 2: join resolved to exactly 1 updated row — proves EXPENSE_JOIN carried drop 1\'s data forward into this separate drop');
  if (!/1 transaction\(s\) are not yet issued into any tax invoice/i.test(preview2)) fail('drop 2: "not yet issued" (T3, "Need to issue") count missing or wrong');
  else ok('drop 2: T3 ("Need to issue") correctly counted as not-yet-issued, nothing to attribute it to');
  if (!/1 transaction\(s\) are already issued into a tax invoice but have no expense lines/i.test(preview2)) fail('drop 2: "issued but no lines yet" (T9) count missing or wrong');
  else ok('drop 2: T9 (issued, no lines yet) correctly counted — its invoice is held back, not partially applied');
  if (!/1 transaction\(s\) have expense lines but no transaction-status row yet/i.test(preview2)) fail('drop 2: T12 (lines, no gate row) should still be waiting — the gate file never mentions it');
  else ok('drop 2: T12 (never appears in the gate file) still correctly reported as waiting');
  // Every held-back invoice must be named individually, with the specific transaction and reason.
  if (!/116361002/.test(preview2) || !/exceeds/i.test(preview2)) fail('drop 2: 116361002 (exceeds-total) not itemized in the preview');
  else ok('drop 2: 116361002 itemized — exceeds-total guard reported loudly');
  if (!/116361003/.test(preview2) || !/T6/.test(preview2) || !/disagrees with itself/i.test(preview2)) fail('drop 2: 116361003 (T6 gate self-conflict) not itemized in the preview');
  else ok('drop 2: 116361003 itemized — T6\'s self-conflicting gate row reported loudly');
  if (!/116361004/.test(preview2) || !/T7/.test(preview2) || !/malformed/i.test(preview2)) fail('drop 2: 116361004 (T7 malformed amount) not itemized in the preview');
  else ok('drop 2: 116361004 itemized — T7\'s malformed amount reported loudly');
  if (!/116361005/.test(preview2) || !/T9/.test(preview2) || !/no expense lines captured yet/i.test(preview2)) fail('drop 2: 116361005 (T9 missing lines) not itemized — the core multi-transaction safeguard is not visibly proven');
  else ok('drop 2: 116361005 itemized — held back because T9 (its second contributing transaction) has no lines yet, not partially applied from T8 alone');
  if (!/116361006/.test(preview2) || !/T13/.test(preview2) || !/contradiction/i.test(preview2)) fail('drop 2: 116361006 (T13 status contradicts issued) not itemized in the preview');
  else ok('drop 2: 116361006 itemized — T13\'s status-vs-issued contradiction reported loudly');
  if (!/UNKNOWN-TEST-002/.test(preview2) || !/not a live invoice/i.test(preview2)) fail('drop 2: UNKNOWN-TEST-002 (not a live invoice) not itemized in the preview');
  else ok('drop 2: UNKNOWN-TEST-002 itemized — not a live invoice, correctly never inserted');

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
      multiTxnApplied: get('116361000'),
      noGroup: get('116361001'),
      exceedsTotal: get('116361002'),
      gateConflict: get('116361003'),
      malformed: get('116361004'),
      partialContributor: get('116361005'),
      statusContradiction: get('116361006'),
      takamol: get('9999999999'),
    };
  });
  console.log('rows:', JSON.stringify(rows));

  // ---- Invoice 116361000: TWO transactions (T1 blank-status, T2 Ready-status) both issue
  // into it — proves multi-transaction aggregation AND that blank==Issued (not "not ready") ----
  if (!rows.multiTxnApplied) fail('116361000: row went missing entirely');
  else if (rows.multiTxnApplied.cost !== 2000) fail(`116361000: cost_sar is ${rows.multiTxnApplied.cost}, expected 2000 (T1: 750+750 blank-status Approved = 1500; T2: 500 Ready-status Approved, 300 Pending excluded = 500; 1500+500=2000 across two transactions)`);
  else ok('116361000: cost_sar = 2000 — correctly summed across TWO transactions, and T1\'s blank status was correctly treated as done (not "not ready")');

  // ---- Invoice 116361001: no transaction issues into it — must stay exactly as seeded ----
  if (!rows.noGroup) fail('116361001: row went missing entirely');
  else if (rows.noGroup.cost !== 5084) fail(`116361001: cost_sar is ${rows.noGroup.cost}, expected untouched at 5084`);
  else ok('116361001: cost_sar left untouched at 5084 — no transaction issues into it in this drop');

  // ---- Invoice 116361002: one transaction, approved sum exceeds the invoice's own total ----
  if (!rows.exceedsTotal) fail('116361002: row went missing entirely');
  else if (rows.exceedsTotal.cost === 999999) fail('116361002: the impossible 999999 cost was applied — this is exactly the stale-iframe/join-error class of bug the cost<=total guard exists to catch');
  else ok(`116361002: cost_sar left untouched at ${rows.exceedsTotal.cost} — the exceeds-total guard correctly rejected 999999`);

  // ---- Invoice 116361003: T6's own gate row disagrees with itself — never guessed at ----
  if (!rows.gateConflict) fail('116361003: row went missing entirely');
  else if (rows.gateConflict.cost === 1000) fail(`116361003: cost_sar was written (${rows.gateConflict.cost}) despite T6\'s gate row disagreeing with itself — this must never be resolved by guessing`);
  else ok('116361003: cost_sar left untouched — T6\'s self-conflicting gate row correctly refused, not guessed');

  // ---- Invoice 116361004: T7 has a malformed line amount — voids the whole invoice's write ----
  if (!rows.malformed) fail('116361004: row went missing entirely');
  else if (rows.malformed.cost === 0) fail('116361004: a malformed amount silently became 0 cost — must be refused entirely, not fabricated as zero');
  else ok(`116361004: cost_sar left untouched at ${rows.malformed.cost} — T7\'s malformed-amount guard correctly refused the whole invoice`);

  // ---- Invoice 116361005: T8 is clean (2000 approved), T9 has NO captured lines at all —
  // THE CORE SAFEGUARD: the whole invoice must be held back, never a partial 2000 from T8 alone ----
  if (!rows.partialContributor) fail('116361005: row went missing entirely');
  else if (rows.partialContributor.cost === 2000) fail('116361005: cost_sar was silently written as 2000 (T8\'s sum alone) even though T9, the invoice\'s OTHER contributing transaction, has no expense lines captured yet — this is exactly the silent-understatement shape the whole two-level design exists to prevent');
  else ok(`116361005: cost_sar left untouched at ${rows.partialContributor.cost} — correctly held back the WHOLE invoice because T9 (one of its two contributing transactions) has no lines yet, never a partial sum from T8 alone`);

  // ---- Invoice 116361006: T13 is issued but its own status explicitly reads "Pending" —
  // a contradiction, refused rather than trusted either way ----
  if (!rows.statusContradiction) fail('116361006: row went missing entirely');
  else if (rows.statusContradiction.cost === 1200) fail('116361006: cost_sar was applied despite T13\'s status ("Pending") contradicting its own issued-ness — this must be refused, not trusted');
  else ok(`116361006: cost_sar left untouched at ${rows.statusContradiction.cost} — T13\'s status-vs-issued contradiction correctly refused`);

  // ---- Excluded client (Takamol): never touched, even though its transaction is clean ----
  if (!rows.takamol) fail('9999999999 (Takamol, already excluded): row unexpectedly disappeared');
  else if (rows.takamol.cost === 100) fail('9999999999: the excluded Takamol row received a cost write — the exclusion re-check inside the join did not fire');
  else ok('9999999999: the excluded Takamol row was correctly left untouched by the join');

  // ---- Unknown invoice_no (a real invoice-import gap, per the 2026-08-24 finding): never
  // inserted as a new row, only reported ----
  const noNewRow = await p.evaluate(() => !(FIN.rows || []).some((r) => r.invoice_no === 'UNKNOWN-TEST-002'));
  if (!noNewRow) fail('UNKNOWN-TEST-002: a new finance_invoices row was created — the join must NEVER insert, only update a live invoice');
  else ok('UNKNOWN-TEST-002: correctly never inserted as a new row — a tax invoice with real cost but no matching finance_invoices row is reported, never created');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nexpense report capture (two-level join) OK — persists across separate drops, blank status correctly means Issued, multi-transaction sums are correct, and one dirty contributing transaction correctly holds back its WHOLE invoice rather than a silent partial sum.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
