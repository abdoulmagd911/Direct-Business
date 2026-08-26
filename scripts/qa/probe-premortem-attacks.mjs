/* attack-premortem.mjs — bulletproof/landmine pass over the M14–M17 importer surface.
   Method: postmortem-in-advance. Assume a month from now Finance data is wrong or facts were
   silently lost; each scenario below is one story of HOW, written as an attack that should
   FAIL if the story is possible.

   A — intra-drop accumulation: one lines file with TWO rows for the same transaction (real,
       separate expenses) must SUM (900+600=1500), not replace, despite the M17 replace fix.
   B — commit, then an UPDATED lines file in the SAME session (no reload): must REPLACE
       (cost 400, capture table exactly one row), not append to the committed 1500.
   C — the big one: a 6,000-row lines file through the REAL input (crosses the 5,000-row
       streaming batch boundary) PLUS the duplicate trigger (change event + Check click)
       racing a still-streaming first run. 6,000 × 0.25 must land as exactly 1,500.
   D — two tax files in ONE drop disagreeing about the same invoice: last file wins, the
       final row is one consistent pair, nothing crashes.
   E — a tax file targeting an EXCLUDED client's invoice (Takamol 9999999999): must not
       touch it.
   H — capture-only drop persistence: drop ONLY the transaction-status (gate) file, no
       invoice write to confirm — then reload and drop ONLY the lines file. If the gate fact
       was not persistable in session 1, the join can never resolve in session 2 and the
       owner's "import only the update" promise silently breaks. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8265;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const inv = async (n) => fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + n).then((r) => r.json()).then((a) => a[0] || {});
const capLines = async (ref) => fetch(BASE + '/rest/v1/finance_expense_lines_capture?transaction_ref=eq.' + ref).then((r) => r.json());
const capGates = async (ref) => fetch(BASE + '/rest/v1/finance_expense_gate_capture?transaction_ref=eq.' + ref).then((r) => r.json());

async function main() {
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

  async function login(isReload) {
    await p.waitForTimeout(2000);
    if (await p.locator('#cl_email').isVisible().catch(() => false)) {
      await p.fill('#cl_email', 'test@directksa.com');
      await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
      await p.click('#cl_go');
      await p.waitForTimeout(4000);
    } else if (!isReload) { await p.waitForTimeout(2000); }
    await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); });
    await p.waitForTimeout(700);
  }
  async function ingest(name, csv) {
    await p.evaluate(([n, t]) => window.v65IngestText(n, t), [name, csv]);
    await p.waitForTimeout(1200);
  }
  async function confirm() {
    const clicked = await p.evaluate(() => {
      const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm|Save/i.test(x.textContent));
      if (bt) { bt.click(); return bt.textContent.trim(); }
      return null;
    });
    await p.waitForTimeout(2000);
    return clicked;
  }

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await login(false);

  // ================= ATTACK A — intra-drop sum =================
  console.log('\nATTACK A — two real expense rows for one transaction in one file must SUM');
  await ingest('gate-a.csv', ['transaction_ref,txn_expense_status,invoice_issuing_raw', 'ATT-A,Ready,Issued 116361003'].join('\n'));
  await ingest('lines-a.csv', ['transaction_ref,amount_sar,expense_status', 'ATT-A,900,Approved', 'ATT-A,600,Approved'].join('\n'));
  let btn = await confirm();
  if (!btn) fail('A: no commit button appeared');
  let rA = await inv('116361003');
  if (Number(rA.cost_sar) !== 1500) fail(`A: expected cost 1500 (900+600 summed), got ${rA.cost_sar} — intra-drop accumulation broken by the replace fix`);
  else ok('A: two same-ref rows in one drop summed to 1500 — replace-per-drop did not break real multi-line expenses');
  let cA = await capLines('ATT-A');
  if (cA.length !== 2) fail(`A: capture table should hold BOTH raw lines (2 rows), got ${cA.length}`);
  else ok('A: both raw lines persisted');

  // ================= ATTACK B — updated re-drop, same session, after commit =================
  console.log('\nATTACK B — an updated lines file in the SAME session after commit must REPLACE');
  await ingest('lines-a-UPDATED.csv', ['transaction_ref,amount_sar,expense_status', 'ATT-A,400,Approved'].join('\n'));
  btn = await confirm();
  if (!btn) fail('B: no commit button appeared');
  rA = await inv('116361003');
  if (Number(rA.cost_sar) !== 400) fail(`B: expected cost 400 (replaced), got ${rA.cost_sar} — same-session update appended instead of replacing`);
  else ok('B: same-session updated file replaced the cost (400, not 1900)');
  cA = await capLines('ATT-A');
  if (cA.length !== 1 || Number(cA[0].amount_sar) !== 400) fail(`B: capture table should hold exactly the one new row (400), got ${JSON.stringify(cA.map((x) => x.amount_sar))}`);
  else ok('B: capture table replaced to exactly one 400 row');

  // ================= ATTACK C — 6,000 rows, real input, duplicate trigger race =================
  console.log('\nATTACK C — 6,000-row lines file via the REAL input + duplicate Check click');
  const tmpd = fs.mkdtempSync('/tmp/attack-');
  const bigRows = ['transaction_ref,amount_sar,expense_status'];
  for (let i = 0; i < 6000; i++) bigRows.push('ATT-C,0.25,Approved');
  fs.writeFileSync(tmpd + '/lines-c.csv', bigRows.join('\n'));
  fs.writeFileSync(tmpd + '/gate-c.csv', ['transaction_ref,txn_expense_status,invoice_issuing_raw', 'ATT-C,Ready,Issued 116361006'].join('\n'));
  await p.setInputFiles('#finFile', [tmpd + '/lines-c.csv', tmpd + '/gate-c.csv']);
  await p.waitForTimeout(300); // click while the first (auto) run may still be streaming
  await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find((x) => /Check file/i.test(x.textContent)); if (bt) bt.click(); });
  await p.waitForTimeout(4000);
  btn = await confirm();
  if (!btn) fail('C: no commit button appeared');
  const rC = await inv('116361006');
  if (Number(rC.cost_sar) !== 1500) fail(`C: expected cost exactly 1500 (6000×0.25), got ${rC.cost_sar} — chunk boundary or duplicate-run race double-counted`);
  else ok('C: 6,000 rows across the 5,000-row batch boundary, with the duplicate trigger racing a live stream, summed to exactly 1500');
  const cC = await capLines('ATT-C');
  if (cC.length !== 6000) fail(`C: capture table should hold exactly 6000 raw rows, got ${cC.length}`);
  else ok('C: exactly 6000 raw capture rows — no duplicate batch leaked through');

  // ================= ATTACK D — two tax files disagreeing in one drop =================
  console.log('\nATTACK D — two tax files in one drop, same invoice, different totals');
  fs.writeFileSync(tmpd + '/tax-d1.csv', ['invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date', '116361009,DPIN-D1,12100,Issued,2026-08-01'].join('\n'));
  fs.writeFileSync(tmpd + '/tax-d2.csv', ['invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date', '116361009,DPIN-D2,12200,Issued,2026-08-02'].join('\n'));
  await p.setInputFiles('#finFile', [tmpd + '/tax-d1.csv', tmpd + '/tax-d2.csv']);
  await p.waitForTimeout(1500);
  btn = await confirm();
  if (!btn) fail('D: no commit button appeared');
  const rD = await inv('116361009');
  const pairOk = (rD.zatca_dpin === 'DPIN-D2' && Number(rD.total_incl_vat_sar) === 12200);
  if (!pairOk) fail(`D: expected the LAST file's consistent pair (DPIN-D2/12200), got ${JSON.stringify({ dpin: rD.zatca_dpin, total: rD.total_incl_vat_sar })} — a mixed/torn pair means the merge interleaved two files' fields`);
  else ok('D: last file won cleanly with a consistent dpin/total pair — no torn merge');

  // ================= ATTACK E — excluded client's invoice must stay untouched =================
  console.log('\nATTACK E — tax file targeting the EXCLUDED Takamol invoice');
  fs.writeFileSync(tmpd + '/tax-e.csv', ['invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date', '9999999999,DPIN-EVIL,1,Issued,2026-08-01'].join('\n'));
  await p.setInputFiles('#finFile', [tmpd + '/tax-e.csv']);
  await p.waitForTimeout(1500);
  // commit if anything is offered — the point is what the DATABASE ends up holding
  await confirm();
  const rE = await inv('9999999999');
  if (rE.zatca_dpin !== 'TTIN-9999' || Number(rE.total_incl_vat_sar) !== 314159) {
    fail(`E: the excluded Takamol invoice was MODIFIED — got ${JSON.stringify({ dpin: rE.zatca_dpin, total: rE.total_incl_vat_sar })}, expected untouched TTIN-9999/314159`);
  } else ok('E: the excluded client\'s invoice is untouched — exclusion holds on the import path');

  // ================= ATTACK H — capture-only drop must be persistable =================
  console.log('\nATTACK H — gate file today, lines file next session: the gate fact must survive');
  await ingest('gate-h.csv', ['transaction_ref,txn_expense_status,invoice_issuing_raw', 'ATT-H,Ready,Issued 116361012'].join('\n'));
  const persistBtn = await p.evaluate(() => {
    const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm|Save/i.test(x.textContent));
    return bt ? bt.textContent.trim() : null;
  });
  if (!persistBtn) fail('H: a gate-only drop offers NO way to persist what it captured — the fact dies with the tab, and next session\'s lines file can never resolve');
  else {
    ok(`H: capture-only drop offers a persist action ("${persistBtn}")`);
    await confirm();
    const g = await capGates('ATT-H');
    if (!g.length) fail('H: clicked the persist action but finance_expense_gate_capture holds nothing for ATT-H');
    else ok('H: the gate fact is actually in finance_expense_gate_capture');
  }
  // Session 2 — reload, lines only
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await login(true);
  await ingest('lines-h.csv', ['transaction_ref,amount_sar,expense_status', 'ATT-H,750,Approved'].join('\n'));
  btn = await confirm();
  const rH = await inv('116361012');
  if (Number(rH.cost_sar) !== 750) fail(`H: after reload, the lines-only drop did not resolve — cost is ${rH.cost_sar}, expected 750. The owner would have to re-supply the gate file, breaking the incremental-update promise.`);
  else ok('H: gate captured in session 1, lines dropped in session 2 — cost resolved to 750 with nothing re-supplied');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} unexpected JS/console error(s)`);

  await b.close();
  srv.close();
  fs.rmSync(tmpd, { recursive: true, force: true });
  if (failures) { console.log(`\nATTACKS LANDED — ${failures} failure(s).`); process.exit(1); }
  console.log('\nall premortem attacks survived.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
