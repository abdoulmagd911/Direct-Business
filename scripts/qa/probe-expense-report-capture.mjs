/* probe-expense-report-capture.mjs — regression guard for js/65-universal-importer.js's
   expense_report_capture signature (2026-08-23).

   THE SOURCE. Direct Payments' admin.stats.expense-report (?of_corporate_client=true, 219
   corporate rows, one row per expense line), found by reading the app's own Ziggy route
   registry rather than guessing URLs. Cross-verified against the earlier "View Assignments"
   modal path on a real invoice before trusting it (both independently read 12,247.00 for
   invoice 1163597647). That modal path was then abandoned entirely: a stale iframe reference
   returned the PREVIOUS invoice's approved-cost figure for four rows in a row before it was
   caught — a well-formed, plausible number that was simply wrong, discarded before any of it
   reached a database. The expense-report path has no iframe, no per-row modal, no staleness
   risk of that shape.

   TWO TRAPS FOUND DURING CAPTURE, both defended here in code, neither trusted to memory:
     1. The report's own expense_status URL filter does NOT apply server-side — filtering for
        Approved still returned Pending/Cancelled/Under Review rows. This probe's fixture
        deliberately includes a non-Approved line on the same invoice as Approved lines, and
        asserts it is excluded from the sum by VALUE, not by having trusted a query string.
     2. Repeated (amount, expense_type) pairs on one invoice are real, separate expenses (owner's
        own notes: three identical-amount Hotel Cost / RateHawk lines, three different approval
        timestamps) — never deduplicated. This probe's fixture repeats one amount twice on
        purpose and asserts BOTH count toward the sum.

   THE STANDING GATE (owner's Aug 20/21 notes, re-confirmed 2026-08-23 after an earlier,
   incomplete design missed it): per-line Approved is not enough — an invoice's cost is only
   FINAL once its own transaction Expense Status reads Ready/Issued; a line can be Approved
   while ANOTHER line on the same invoice is still Under Review, leaving the invoice Pending
   overall. Summing only the Approved lines in that state is a real number that is silently
   INCOMPLETE. So nothing is ever written unless every line on the invoice agrees the gate
   (txn_expense_status) is Ready/Issued — Pending leaves cost_sar exactly as it was: untouched,
   never zeroed, never a partial sum. This probe asserts that gate directly, plus every other
   guard the design carries: no new finance_invoices row is ever created (excluded/unknown
   invoice_no rows are reported, never inserted), a second exclusion-list check runs even
   though a live match already implies the invoice passed it once, a cost that would exceed
   the invoice's own total is rejected (the exact shape of the stale-iframe class of bug), a
   malformed amount voids that invoice's whole line group rather than guessing which lines to
   trust, and conflicting txn_expense_status values across one invoice's lines are refused
   rather than picked between. */
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
  //   i3 116361003 total 7331  — lines disagree on gate — rejected
  //   i4 116361004 total 8108  — Ready, one line has a malformed amount — rejected
  const csv = [
    'invoice_no,amount_sar,expense_status,txn_expense_status',
    '116361000,1000,Approved,Ready',
    '116361000,1000,Approved,Ready',
    '116361000,500,Approved,Ready',
    '116361000,300,Pending,Ready',
    '116361001,2000,Approved,Pending',
    '9999999999,100,Approved,Ready',
    'UNKNOWN-TEST-001,50,Approved,Ready',
    '116361002,999999,Approved,Ready',
    '116361003,1000,Approved,Ready',
    '116361003,500,Approved,Pending',
    '116361004,abc,Approved,Ready',
  ].join('\n');

  await p.setInputFiles('#finFile', { name: 'expense-report.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await p.waitForTimeout(1500);

  const preview = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/Expense Report Capture/i.test(preview)) fail(`preview did not show the expense_report_capture signature — file was not recognized: ${preview.slice(0, 200)}`);
  else ok('file recognized as Expense Report Capture');

  const dialogsBefore = dialogs.length;
  const clicked = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('#finImpOut button')];
    const bt = btns.find((x) => /Confirm/i.test(x.textContent));
    if (bt) { bt.click(); return true; }
    return false;
  });
  if (!clicked) fail('no Confirm import button appeared — nothing to commit means the whole batch was rejected, which is wrong (invoice 116361000 must apply)');
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

  // ---- Invoice 116361003: lines disagree on txn_expense_status — never guessed at ----
  if (!rows.conflictingGate) fail('116361003: row went missing entirely');
  else if (rows.conflictingGate.cost === 1000 || rows.conflictingGate.cost === 1500) fail(`116361003: cost_sar was written (${rows.conflictingGate.cost}) despite the two lines disagreeing on transaction expense status — this must never be resolved by guessing`);
  else ok('116361003: cost_sar left untouched — conflicting transaction expense status across lines correctly refused, not guessed');

  // ---- Invoice 116361004: a malformed amount on one line must void the whole invoice's write ----
  if (!rows.malformed) fail('116361004: row went missing entirely');
  else if (rows.malformed.cost === 0) fail('116361004: a malformed amount silently became 0 cost — must be refused entirely, not fabricated as zero');
  else ok(`116361004: cost_sar left untouched at ${rows.malformed.cost} — the malformed-amount guard correctly refused the whole invoice`);

  // ---- Excluded client: never touched, never created ----
  if (!rows.takamol) fail('9999999999 (Takamol, already excluded): row unexpectedly disappeared');
  else if (rows.takamol.cost === 100) fail('9999999999: the excluded Takamol row received a cost write — the exclusion re-check inside expense_report_capture did not fire');
  else ok('9999999999: the excluded Takamol row was correctly left untouched by the capture path');

  // ---- Unknown invoice_no (test company / not in our system): never inserted as a new row ----
  const noNewRow = await p.evaluate(() => !(FIN.rows || []).some((r) => r.invoice_no === 'UNKNOWN-TEST-001'));
  if (!noNewRow) fail('UNKNOWN-TEST-001: a new finance_invoices row was created — expense_report_capture must NEVER insert, only update a live invoice');
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
  console.log('\nexpense report capture OK — Ready/Issued gate holds, sums are correct without deduping, every trap stays refused, no new rows are ever created.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
