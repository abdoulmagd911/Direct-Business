/* probe-expense-capture-persistence.mjs — M15 regression guard for the owner's core Workstream
   3 requirement, verbatim: "if something happened on the expenses and it got updated and I got
   a new export or report and I want to add it, I want it to accept it and update the values for
   the expenses... so I do not have to import all the files, I just need to import the updates
   and it would spread it automatically."

   Drives TWO SEPARATE BROWSER SESSIONS (a real page.reload(), not just resetting a JS variable)
   against the same mock Supabase — the only way to actually prove "survives a reload and a new
   session" rather than merely "survives while this tab stays open," which page-lifetime memory
   already did before this round.

   SESSION 1 — drop both real files (lines + gate) for one transaction, confirm. Cost resolves
   and is written to finance_invoices; the raw facts are persisted to
   finance_expense_lines_capture / finance_expense_gate_capture (flushPendingCapture(), M15).

   SESSION 2 — reload the page (fresh EXPENSE_JOIN, empty in-memory state), drop ONLY an updated
   expense_lines_capture file for the SAME transaction with a DIFFERENT amount — the gate file is
   never re-supplied. Asserts: (a) the cost updates to the new amount, proving the gate fact
   (captured in session 1) was loaded from Supabase as the baseline, not re-typed; (b) the lines
   table holds exactly the NEW amount for that transaction, not old+new summed — delete-then-
   insert per transaction_ref, never an append that would double-count on every re-export. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8247;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

const TARGET_INVOICE = '116361000'; // i=0 fixture row: total 5000, cost 0
const TXN = 'QA-CAPTURE-T1';

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

  async function loginAndOpenImport(isReload) {
    if (isReload) {
      // Auth persists across a reload (localStorage), same as a real browser — the login form
      // may never appear at all. Wait briefly for it; proceed either way.
      await p.waitForTimeout(2000);
      const emailVisible = await p.locator('#cl_email').isVisible().catch(() => false);
      if (emailVisible) {
        await p.fill('#cl_email', 'test@directksa.com');
        await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
        await p.click('#cl_go');
        await p.waitForTimeout(4000);
      }
    } else {
      await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForTimeout(2000);
      await p.fill('#cl_email', 'test@directksa.com');
      await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
      await p.click('#cl_go');
      await p.waitForTimeout(4000);
    }
    await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); });
    await p.waitForTimeout(700);
  }

  // Just ingests a file (builds up EXPENSE_JOIN / PENDING_CAPTURE in memory) without assuming a
  // Confirm button appears — a gate-only or lines-only drop with nothing yet to resolve
  // correctly produces NO commit-able change until its counterpart file arrives.
  async function ingestOnly(csv, fileName) {
    const ingested = await p.evaluate(([n, text]) => window.v65IngestText(n, text), [fileName, csv]);
    if (!ingested) fail(`v65IngestText(${fileName}) did not run`);
    await p.waitForTimeout(1000);
  }

  async function ingestAndCommit(csv, fileName) {
    await ingestOnly(csv, fileName);
    const clicked = await p.evaluate(() => {
      const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm/i.test(x.textContent));
      if (bt) { bt.click(); return true; }
      return false;
    });
    if (!clicked) fail(`no Confirm import button appeared for ${fileName}`);
    await p.waitForTimeout(1200);
    return p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  }

  // ================= SESSION 1 =================
  await loginAndOpenImport(false);

  // Gate file alone resolves nothing yet (no lines to sum) — ingest only, no Confirm expected.
  const gateCsv1 = ['transaction_ref,txn_expense_status,invoice_issuing_raw', `${TXN},Ready,Issued ${TARGET_INVOICE}`].join('\n');
  await ingestOnly(gateCsv1, 'gate-session1.csv');

  const linesCsv1 = ['transaction_ref,amount_sar,expense_status', `${TXN},1000,Approved`].join('\n');
  const preview1 = await ingestAndCommit(linesCsv1, 'lines-session1.csv');
  console.log('session 1 final preview:', JSON.stringify(preview1.slice(0, 300)));

  const row1 = await p.evaluate((inv) => { const r = (FIN.rows || []).find((x) => x.invoice_no === inv); return r ? { cost: r.cost_sar } : null; }, TARGET_INVOICE);
  if (!row1 || Number(row1.cost) !== 1000) fail(`SESSION 1: expected cost_sar=1000 on ${TARGET_INVOICE}, got ${JSON.stringify(row1)}`);
  else ok('SESSION 1: cost resolved to 1000 and landed on the invoice');

  // Confirm the raw facts actually persisted to the two capture tables via a direct read —
  // proof of persistence, not just proof the preview looked right.
  const persisted1 = await fetch(BASE + '/rest/v1/finance_expense_lines_capture?transaction_ref=eq.' + TXN).then((r) => r.json());
  const persistedGate1 = await fetch(BASE + '/rest/v1/finance_expense_gate_capture?transaction_ref=eq.' + TXN).then((r) => r.json());
  if (!persisted1.length || Number(persisted1[0].amount_sar) !== 1000) fail(`SESSION 1: finance_expense_lines_capture does not hold amount 1000 for ${TXN} — got ${JSON.stringify(persisted1)}`);
  else ok('SESSION 1: the raw expense line (1000) is actually persisted in finance_expense_lines_capture');
  if (!persistedGate1.length || persistedGate1[0].txn_expense_status !== 'Ready') fail(`SESSION 1: finance_expense_gate_capture does not hold the gate row for ${TXN} — got ${JSON.stringify(persistedGate1)}`);
  else ok('SESSION 1: the raw gate fact is actually persisted in finance_expense_gate_capture');

  // ================= SESSION 2 — a REAL new session (page.reload()), not just a JS reset =====
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await loginAndOpenImport(true);

  // Drop ONLY an updated lines file — the gate file is deliberately never re-supplied. If the
  // gate fact isn't loaded from Supabase as a baseline, this transaction has no invoice to
  // attribute cost to and the join will report it "waiting", never resolving.
  const linesCsv2 = ['transaction_ref,amount_sar,expense_status', `${TXN},1500,Approved`].join('\n');
  const preview2 = await ingestAndCommit(linesCsv2, 'lines-session2-UPDATED.csv');
  console.log('session 2 final preview:', JSON.stringify(preview2.slice(0, 400)));

  const row2 = await p.evaluate((inv) => { const r = (FIN.rows || []).find((x) => x.invoice_no === inv); return r ? { cost: r.cost_sar } : null; }, TARGET_INVOICE);
  if (!row2 || Number(row2.cost) !== 1500) fail(`SESSION 2 (THE CORE REQUIREMENT): expected cost_sar to UPDATE to 1500 after dropping ONLY an updated lines file in a brand-new session, got ${JSON.stringify(row2)} — the gate fact from session 1 was not consulted as a baseline`);
  else ok('SESSION 2 (THE CORE REQUIREMENT HELD): a single updated file, in a brand-new browser session, with the OTHER file never re-supplied, correctly updated the cost from 1000 to 1500 — the gate fact persisted from session 1 was consulted automatically');

  // Delete-then-insert, never append: exactly ONE line row for this transaction, holding the
  // NEW amount — not two rows (1000 and 1500) that would silently double the summed cost.
  const persisted2 = await fetch(BASE + '/rest/v1/finance_expense_lines_capture?transaction_ref=eq.' + TXN).then((r) => r.json());
  if (persisted2.length !== 1) fail(`SESSION 2: expected exactly 1 persisted line row for ${TXN} after the re-export (delete-then-insert), got ${persisted2.length} — a re-export must replace, never append`);
  else if (Number(persisted2[0].amount_sar) !== 1500) fail(`SESSION 2: the persisted line row was not updated to 1500 — got ${JSON.stringify(persisted2)}`);
  else ok('SESSION 2: exactly one persisted line row, holding the new amount — the re-export replaced the stale capture rather than appending to it');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nexpense-capture-persistence OK — a single updated file, dropped in a brand-new browser session with the other file never re-supplied, correctly propagated through the cost join, and the raw capture tables replace (never append) on re-export.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
