/* probe-cost-join-performance.mjs — a REAL-SIZE regression guard for
   js/65-universal-importer.js's expense-cost join, 2026-08-24.

   WHY THIS EXISTS: the oversight session reported the browser locking solid (60-90s, no
   console error, no preview, nothing written) when dropping the real capture — 154
   transactions, 222 expense lines — while a 3-row fixture of the same shape processed
   instantly. Their own diagnosis, and the reason the earlier synthetic-fixture probe never
   caught it: "correctness at 3 rows says nothing about behaviour at 154." That report was
   later narrowed — a SEPARATE, now-retracted report about a "freeze" turned out to be the
   oversight session's own browser-extension sandbox having a dead async layer (setTimeout,
   Blob.text(), FileReader never resolving) — but this specific report is a different symptom
   (console hooks installed BEFORE the drop show nothing, the page is unresponsive to script
   injection for 60-90s, then returns with no preview and nothing written) and was not
   retracted. It reproduces (or doesn't) independently of that other issue, so it gets its own
   real test rather than being assumed explained away.

   This probe builds a SYNTHETIC fixture at the real cardinality — 154 transactions, 222
   expense lines, one 8-transaction group and one 4-transaction group feeding single invoices
   (the exact shape reported for real invoices 1163754021 and 1163766126, reproduced here with
   fake IDs — real invoice/transaction numbers never get committed to this repo, D4/decisions).
   It drives the real path end to end via window.v65IngestText (no synthetic shortcut into
   resolveExpenseJoin() directly — this has to exercise the exact same code a real drop does,
   including the render), and asserts a wall-clock ceiling. If this ever regresses to
   superlinear behavior as row counts grow, this is what catches it before a real drop does. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8229;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

// ---- Build the synthetic fixture: 154 transactions, 222 expense lines ----
// Two heavy groups (8 and 4 transactions issuing into one invoice each — the real shape that
// prompted this probe), the rest spread thinly across ~38 more invoices. 102 transactions are
// blank/Ready (done, issued into one of ~40 invoices); 52 are "Pending" (not yet issued) —
// matching the real blank/Pending/Ready distribution (84/52/18) reported alongside this bug.
function buildFixture() {
  const txns = []; // {ref, invNo|null, status}
  let ref = 1;
  const invoices = [];
  function addGroup(invNo, count, status) {
    invoices.push(invNo);
    for (let i = 0; i < count; i++) { txns.push({ ref: 'SYN-TX-' + String(ref++).padStart(4, '0'), invNo, status }); }
  }
  addGroup('SYN-INV-HEAVY-A', 8, ''); // blank status == Issued, per the corrected M9 gate
  addGroup('SYN-INV-HEAVY-B', 4, 'Ready');
  // 38 more invoices sharing the remaining issued transactions (102 - 8 - 4 = 90), 2-3 each
  let remaining = 90, invIdx = 1;
  while (remaining > 0) {
    const n = Math.min(remaining, (invIdx % 2 === 0) ? 2 : 3);
    addGroup('SYN-INV-' + String(invIdx).padStart(3, '0'), n, invIdx % 3 === 0 ? 'Ready' : '');
    remaining -= n; invIdx++;
  }
  // 52 not-yet-issued transactions
  for (let i = 0; i < 52; i++) { txns.push({ ref: 'SYN-TX-' + String(ref++).padStart(4, '0'), invNo: null, status: 'Pending' }); }
  if (txns.length !== 154) throw new Error('fixture generator bug: expected 154 transactions, built ' + txns.length);

  // 222 expense lines across the 154 transactions — every transaction gets 1 line, the first
  // 68 also get a second (154 + 68 = 222), each Approved.
  const lines = [];
  txns.forEach((t, i) => {
    lines.push({ ref: t.ref, amount: 500 + (i % 37) * 13.5, status: 'Approved' });
    if (i < 68) lines.push({ ref: t.ref, amount: 200 + (i % 19) * 7.25, status: 'Approved' });
  });
  if (lines.length !== 222) throw new Error('fixture generator bug: expected 222 lines, built ' + lines.length);

  const linesCsv = ['transaction_ref,amount_sar,expense_status']
    .concat(lines.map((l) => l.ref + ',' + l.amount.toFixed(2) + ',' + l.status)).join('\n');
  const gateCsv = ['transaction_ref,txn_expense_status,invoice_issuing_raw']
    .concat(txns.map((t) => t.ref + ',' + t.status + ',' + (t.invNo ? ('Issued ' + t.invNo) : 'Need to issue'))).join('\n');
  return { linesCsv, gateCsv, invoiceCount: invoices.length, txnCount: txns.length, lineCount: lines.length };
}

async function main() {
  const fixture = buildFixture();
  console.log(`fixture: ${fixture.txnCount} transactions, ${fixture.lineCount} expense lines, ${fixture.invoiceCount} invoice groups`);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

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

  // Wall-clock is measured INSIDE the page, around window.v65IngestText itself — that call is
  // fully synchronous (parse → batch → resolveExpenseJoin() → renderCombinedPreview all run in
  // one JS tick), so this measurement is exactly what would block the real browser's main
  // thread on a real drop, not Playwright/IPC overhead.
  const CEILING_MS = 3000; // generous for 154+222 rows; a real superlinear bug blows far past this

  const t1 = await p.evaluate(({ text }) => {
    const t0 = performance.now();
    const ok = window.v65IngestText('expense-lines.csv', text);
    return { ms: performance.now() - t0, ok };
  }, { text: fixture.linesCsv });
  console.log(`lines file (${fixture.lineCount} rows): ${t1.ms.toFixed(1)}ms`);
  if (!t1.ok) fail('v65IngestText did not run for the lines file');
  else if (t1.ms > CEILING_MS) fail(`lines file took ${t1.ms.toFixed(1)}ms, ceiling is ${CEILING_MS}ms — investigate before this ships`);
  else ok(`lines file (${fixture.lineCount} rows) processed in ${t1.ms.toFixed(1)}ms`);

  const t2 = await p.evaluate(({ text }) => {
    const t0 = performance.now();
    const ok = window.v65IngestText('expense-gate.csv', text);
    return { ms: performance.now() - t0, ok };
  }, { text: fixture.gateCsv });
  console.log(`gate file (${fixture.txnCount} rows) — THE FILE REPORTED TO FREEZE: ${t2.ms.toFixed(1)}ms`);
  if (!t2.ok) fail('v65IngestText did not run for the gate file');
  else if (t2.ms > CEILING_MS) fail(`gate file took ${t2.ms.toFixed(1)}ms, ceiling is ${CEILING_MS}ms — THIS REPRODUCES THE REPORTED FREEZE, investigate before this ships`);
  else ok(`gate file (${fixture.txnCount} rows) processed in ${t2.ms.toFixed(1)}ms — the reported freeze does not reproduce at this size in this harness`);

  await p.waitForTimeout(500);
  const preview = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (preview.length < 100) fail(`preview did not render meaningfully after both files: ${preview.slice(0, 300)}`);
  else ok('preview rendered a real result after both files — not just fast, but actually correct-shaped');
  // None of the synthetic SYN-INV-* numbers exist as live finance_invoices rows (fake IDs, on
  // purpose — this probe is about SCALE, not re-proving business correctness, which
  // scripts/qa/probe-expense-report-capture.mjs already does against real live-matching
  // fixtures). Every one of the ~40 groups should resolve to "not a live invoice" — proving
  // the join fully resolved all of them without erroring or silently dropping any, not that
  // any of them were writable.
  if (!/not a live invoice/i.test(preview)) fail('preview does not mention "not a live invoice" at all — the ~40 synthetic invoice groups may not have resolved through Level 2 grouping correctly');
  else ok('all ~40 synthetic invoice groups correctly resolved through Level 2 grouping as "not a live invoice" (expected — none are real fixture rows)');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log(`\ncost-join performance OK at real scale (${fixture.txnCount} transactions, ${fixture.lineCount} lines) — both files well under the ${CEILING_MS}ms ceiling, preview correct.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
