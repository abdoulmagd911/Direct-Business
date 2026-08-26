/* probe-multi-file-single-drop.mjs — M17 regression guard, born from hands-on driving
   (2026-08-26), not from a code read. Drives the REAL user flow the other importer probes
   skip: three files selected in ONE file-picker action on the REAL #finFile input
   (Playwright setInputFiles → the input's change event fires → auto-process), followed by a
   click on the "Check file" button — which the owner will naturally also do, and which used
   to process the same selection a SECOND time. Every prior probe drove v65IngestText/
   routeRows2d, so neither bug below was ever reachable by them.

   THE TWO BUGS THIS EXISTS TO CATCH (both found live in the harness, both shipped fixed):

   1. DOUBLE-PROCESSING: the change event AND the Check button both called processFileList on
      the same selection. GENERATION guarded the preview repaint but not the session-level
      expense accumulators, so every expense line was pushed twice — a 900 SAR expense became
      a 1,800 SAR cost, and finance_expense_lines_capture got two identical rows. Fix:
      first-touch tracking is per-DROP generation (a duplicate or re-dropped file REPLACES a
      transaction's lines), and a superseded drop's late streaming batches are discarded.

   2. SAME-INVOICE CROSS-FILE CLOBBER: the tax capture updates zatca_dpin/total for an
      invoice while the expense join updates cost for the SAME invoice, each payload built by
      spreading the same stale FIN.rows base row. Applied sequentially, the later payload's
      stale copies of the earlier one's fields silently reverted them — the invoice ended the
      commit with its dpin/total unchanged. Fix: mergeUpdatesByInvoice() in v65Commit layers
      each payload's actual changes (fields differing from the shared base) onto one payload
      per invoice. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8263;
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

  // Fixtures: 116361000 (dpin null, total 5000, cost 0) is touched by BOTH the tax file and
  // the expense join; 116361001 (dpin TTIN-9001) by the tax file alone.
  const taxCsv = [
    'invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date',
    '116361000,DPIN-MFSD-1,5300,Issued,2026-08-01',
    '116361001,DPIN-MFSD-2,7200,Issued,2026-08-02',
  ].join('\n');
  const gateCsv = ['transaction_ref,txn_expense_status,invoice_issuing_raw', 'MFSD-T1,Ready,Issued 116361000'].join('\n');
  const linesCsv = ['transaction_ref,amount_sar,expense_status', 'MFSD-T1,900,Approved'].join('\n');
  const tmpd = fs.mkdtempSync('/tmp/mfsd-');
  fs.writeFileSync(tmpd + '/tax_invoice_capture.csv', taxCsv);
  fs.writeFileSync(tmpd + '/expense-gate.csv', gateCsv);
  fs.writeFileSync(tmpd + '/expense-lines.csv', linesCsv);

  // ONE multi-select on the real input (fires change → auto-process) …
  await p.setInputFiles('#finFile', [tmpd + '/tax_invoice_capture.csv', tmpd + '/expense-gate.csv', tmpd + '/expense-lines.csv']);
  await p.waitForTimeout(500);
  // … then the Check button too — the duplicate trigger a real owner will also press.
  await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find((x) => /Check file/i.test(x.textContent)); if (bt) bt.click(); });
  await p.waitForTimeout(2500);

  const previewText = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/tax_invoice_capture\.csv/.test(previewText)) fail('the combined preview does not list the tax capture file — the multi-file batch was not kept together');
  else ok('one combined preview lists the whole multi-file selection');

  const clicked = await p.evaluate(() => {
    const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm/i.test(x.textContent));
    if (bt) { bt.click(); return true; }
    return false;
  });
  if (!clicked) fail('no Confirm import button appeared');
  await p.waitForTimeout(2500);

  // Judge by what the DATABASE holds, not by the preview.
  const r1 = await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.116361000').then((r) => r.json()).then((a) => a[0] || {});
  const r2 = await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.116361001').then((r) => r.json()).then((a) => a[0] || {});
  const cap = await fetch(BASE + '/rest/v1/finance_expense_lines_capture?transaction_ref=eq.MFSD-T1').then((r) => r.json());

  if (Number(r1.cost_sar) !== 900) fail(`DOUBLE-PROCESSING: expected cost_sar=900 on 116361000, got ${r1.cost_sar} — the change-event run and the Check-button run both accumulated the same expense lines`);
  else ok('cost is exactly 900 — the duplicate processing run replaced, not doubled, the expense lines');

  if (cap.length !== 1 || Number(cap[0].amount_sar) !== 900) fail(`DOUBLE-CAPTURE: finance_expense_lines_capture should hold exactly one 900 row for MFSD-T1, got ${JSON.stringify(cap)}`);
  else ok('finance_expense_lines_capture holds exactly one row — the pending capture was replaced per drop, not appended');

  if (r1.zatca_dpin !== 'DPIN-MFSD-1' || Number(r1.total_incl_vat_sar) !== 5300) {
    fail(`SAME-INVOICE CLOBBER: 116361000 should carry the tax file's dpin/total (DPIN-MFSD-1 / 5300) AND the join's cost — got ${JSON.stringify({ dpin: r1.zatca_dpin, total: r1.total_incl_vat_sar, cost: r1.cost_sar })}. The cost update's stale base-row copies reverted the tax fields.`);
  } else ok('the shared invoice kept BOTH files\' changes — dpin/total from the tax file and cost from the expense join, merged into one update');

  if (r2.zatca_dpin !== 'DPIN-MFSD-2' || Number(r2.total_incl_vat_sar) !== 7200) fail(`the tax-only invoice 116361001 did not update — got ${JSON.stringify({ dpin: r2.zatca_dpin, total: r2.total_incl_vat_sar })}`);
  else ok('the tax-only invoice updated normally alongside');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} unexpected JS/console error(s) during the run`);

  await b.close();
  srv.close();
  fs.rmSync(tmpd, { recursive: true, force: true });

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nmulti-file-single-drop OK — a real multi-select drop plus the redundant Check click commits every file\'s changes exactly once, including two files updating the same invoice.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
