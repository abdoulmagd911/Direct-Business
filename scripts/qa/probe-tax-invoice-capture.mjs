/* probe-tax-invoice-capture.mjs — regression guard for js/65-universal-importer.js's third
   real source, tax_invoice_capture (2026-08-24), and the first real test of
   window.v65IngestText (drives every assertion below through it — a real smoke test, not
   just a claim it works).

   THE TRAP THIS SIGNATURE EXISTS TO DEFEND AGAINST — the Takamol mistake's shape, again, on a
   different column, caught before it shipped: the tax-invoice report carries TWO tax-code
   prefixes, DPIN and TTIN, not one. A first-pass regex that only matched DPIN- reported 21
   invoices as having no code at all — wrong, 10 of those 21 carry TTIN- codes, and all ten
   are Takamol invoices already `integrity_status`-excluded in `finance_invoices` (the five
   largest invoices in the whole system, every one over a million SAR). An importer that
   treats "has a tax code" as "safe to import" would have silently re-admitted the entire
   excluded Takamol book the moment it saw a TTIN- string. TTIN appears to BE the Takamol
   series on this sample (10 for 10) — but that is a hypothesis, not a rule, so this signature
   does NOT special-case any prefix. It gates on `finExclusionCheck()` against the EXISTING
   row's own `client_group`, exactly like every other cost/revenue import path in this app —
   which is why the sabotage case below feeds a row that would otherwise sail straight through
   (real tax code, final status) and asserts it is refused anyway, purely because of who the
   existing row belongs to. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8223;
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
  // invoice_no = '11636' + (1000+i), zatca_dpin is null when i%3===0.
  //   116361000 (i0, total 5000, zatca_dpin null)  — eligible: real tax code, Issued — applies
  //   116361003 (i3, total 7331, zatca_dpin null)  — blank tax code — manual review, untouched
  //   116361006 (i6, total 9662, zatca_dpin null)  — "Waiting for Issuing" — manual review, untouched
  //   9999999999 (Takamol, zatca_dpin 'TTIN-9999') — THE SABOTAGE CASE: real tax code, Issued
  //     status, would otherwise sail straight through — must be refused purely on client exclusion
  //   UNKNOWN-TEST-003 — not a live invoice — never inserted
  const csv = [
    'invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date',
    '116361000,DPIN-100000,5200,Issued,2026-07-01',
    '116361003,,7331,Issued,2026-07-02',
    '116361006,DPIN-100006,9662,Waiting for Issuing,2026-07-03',
    '9999999999,TTIN-SABOTAGE-9999,999999,Issued,2026-08-24',
    'UNKNOWN-TEST-003,DPIN-999999,1000,Issued,2026-07-04',
  ].join('\n');

  // Driven through window.v65IngestText — no File object, no #finFile input — a real smoke
  // test of the entry point itself, not just a claim it works.
  const ingested = await p.evaluate((text) => {
    if (typeof window.v65IngestText !== 'function') return { ok: false, reason: 'window.v65IngestText is not a function' };
    return { ok: window.v65IngestText('tax-invoices.csv', text) };
  }, csv);
  if (!ingested.ok) fail(`v65IngestText did not run: ${ingested.reason || 'returned false'}`);
  else ok('window.v65IngestText("tax-invoices.csv", csvText) ran and returned true');
  await p.waitForTimeout(800);

  const preview = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/Tax Invoices — final phase/i.test(preview)) fail(`file was not recognized as tax_invoice_capture: ${preview.slice(0, 300)}`);
  else ok('recognized as "Tax Invoices — final phase" (tax_invoice_capture)');
  if (!/1 updated/.test(preview)) fail(`expected exactly 1 updated row (116361000): ${preview.slice(0, 400)}`);
  else ok('exactly 1 updated row — the only genuinely eligible one');
  if (!/116361003/.test(preview) || !/no tax code/i.test(preview)) fail('116361003 (blank tax code) not itemized as needing manual review');
  else ok('116361003 itemized — blank tax code correctly routed to manual review');
  if (!/116361006/.test(preview) || !/Waiting for Issuing/i.test(preview)) fail('116361006 ("Waiting for Issuing") not itemized as needing manual review');
  else ok('116361006 itemized — "Waiting for Issuing" correctly routed to manual review, not treated as final');
  if (!/UNKNOWN-TEST-003/.test(preview) || !/not a live invoice/i.test(preview)) fail('UNKNOWN-TEST-003 not itemized as "not a live invoice"');
  else ok('UNKNOWN-TEST-003 itemized — not a live invoice, correctly never inserted (no client name to create one with)');
  // THE SABOTAGE ASSERTION: a row with a real tax code and a final status, targeting an
  // EXCLUDED client, must be reported as excluded — never silently included as though the
  // exclusion check simply hadn't run.
  // clientExcludedDetail entries carry the client name, not the invoice_no (same shape as
  // every other client-exclusion rendering in this importer) — check for the name.
  if (!/[Tt]akamol/.test(preview)) fail('SABOTAGE CASE FAILED TO SURFACE: "Takamol" does not appear anywhere in the preview — the exclusion re-check may not be running');
  else ok('SABOTAGE CASE: the excluded Takamol client is correctly reported as excluded, despite its invoice carrying a real tax code and a final status');

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
  await p.waitForTimeout(1200);

  await p.evaluate(() => { FIN.rows = null; finLoad(); });
  await p.waitForTimeout(1200);

  const rows = await p.evaluate(() => {
    function get(no) { const r = (FIN.rows || []).find((x) => x.invoice_no === no); return r ? { dpin: r.zatca_dpin, total: r.total_incl_vat_sar, date: r.invoice_date } : null; }
    return {
      applied: get('116361000'),
      blankCode: get('116361003'),
      waitingForIssuing: get('116361006'),
      sabotage: get('9999999999'),
    };
  });
  console.log('rows:', JSON.stringify(rows));

  // ---- 116361000: real tax code + Issued status — applies ----
  if (!rows.applied) fail('116361000: row went missing entirely');
  else if (rows.applied.dpin !== 'DPIN-100000' || rows.applied.total !== 5200 || rows.applied.date !== '2026-07-01') fail(`116361000: expected {dpin:'DPIN-100000',total:5200,date:'2026-07-01'}, got ${JSON.stringify(rows.applied)}`);
  else ok('116361000: tax code, total and date all correctly written');

  // ---- 116361003: blank tax code — must stay exactly as seeded ----
  if (!rows.blankCode) fail('116361003: row went missing entirely');
  else if (rows.blankCode.dpin !== null || rows.blankCode.total !== 7331) fail(`116361003: a blank-tax-code row was written anyway — got ${JSON.stringify(rows.blankCode)}`);
  else ok('116361003: left completely untouched — blank tax code correctly refused, not guessed');

  // ---- 116361006: "Waiting for Issuing" — must stay exactly as seeded ----
  if (!rows.waitingForIssuing) fail('116361006: row went missing entirely');
  else if (rows.waitingForIssuing.dpin !== null || rows.waitingForIssuing.total !== 9662) fail(`116361006: a "Waiting for Issuing" row was written anyway — got ${JSON.stringify(rows.waitingForIssuing)}`);
  else ok('116361006: left completely untouched — "Waiting for Issuing" correctly refused, not treated as final');

  // ---- THE SABOTAGE ROW ITSELF: must be byte-for-byte untouched — this is the assertion
  // that actually fails the build (exit 1) if the exclusion guard is ever removed or bypassed ----
  if (!rows.sabotage) fail('9999999999 (Takamol): row unexpectedly disappeared');
  else if (rows.sabotage.dpin === 'TTIN-SABOTAGE-9999' || rows.sabotage.total === 999999) fail(`SABOTAGE: the excluded Takamol row WAS overwritten (${JSON.stringify(rows.sabotage)}) despite carrying a real tax code and a final status — the exclusion-by-client guard did not fire. This is exactly the re-admitted-Takamol failure mode this signature exists to prevent.`);
  else ok(`9999999999 (Takamol): completely untouched (${JSON.stringify(rows.sabotage)}) — the exclusion-by-client guard held even though the row would otherwise have qualified automatically`);

  const noNewRow = await p.evaluate(() => !(FIN.rows || []).some((r) => r.invoice_no === 'UNKNOWN-TEST-003'));
  if (!noNewRow) fail('UNKNOWN-TEST-003: a new finance_invoices row was created — tax_invoice_capture must NEVER insert, only update a live invoice (it carries no client name to create one with)');
  else ok('UNKNOWN-TEST-003: correctly never inserted as a new row');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\ntax invoice capture OK — v65IngestText drives the real path end to end, eligibility gates (tax code + not "Waiting for Issuing") hold, and the sabotage row (a would-otherwise-qualify Takamol invoice) is refused purely on client exclusion, never on its tax-code prefix.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
