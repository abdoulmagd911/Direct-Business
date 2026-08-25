/* probe-import-tab-wiring.mjs — regression guard for a real bug the owner hit live,
   2026-08-24: he opened Finance, clicked the "Import" sub-tab, dropped a genuinely correct
   tax_invoice_capture.csv, clicked "Check file", and got a red "Header does not match the
   expected format" listing his own (correct) columns as if he had made a mistake.

   ROOT CAUSE, confirmed by direct measurement (js/65-universal-importer.js's
   v65WireImportPanel() comment carries the full story): window.finGo() (js/16) has two
   paths — `if (v && current==='finance') renderFinance(v); else render();`. The common case
   — a user already on the Finance page clicking the Import sub-tab — takes the FIRST path,
   which never touches the global window.render() that js/65's multi-file wiring hooks into.
   So the very first paint of the Import tab is drawn by the raw, unwired HTML: the "Check
   file" button still reads onclick="finParse()" (the OLD single-format legacy checker), the
   drop zone has no multi-file listener, and #finFile.multiple is still false. Only some LATER,
   unrelated global render() (a poller, a nav click) retroactively wires it — which is exactly
   why "call window.render() once" fixed it, and why it looked like a signature problem when
   it was actually a mount-timing race.

   THIS IS WHY THE PROBE NAVIGATES EXACTLY ONCE: Finance nav click, then a SINGLE click on the
   Import sub-tab button (the real "already on Finance" path) — no second render(), no wait
   for a poller, no manual re-trigger. If the wiring depends on anything beyond that one
   navigation, this probe must fail. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8231;
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

  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);

  // Real navigation, exactly as a person would do it: click into Finance (lands on whatever
  // FIN.tab currently defaults to — NOT Import), then click the "Import" sub-tab button —
  // this second click is the exact "already on Finance" path that skipped wiring.
  const clickedFinanceNav = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('#nav button')].find((x) => /Finance|المالية/.test(x.textContent));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clickedFinanceNav) fail('could not find the Finance nav button at all');
  await p.waitForTimeout(900);

  const clickedImportTab = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('#view button')].find((x) => /^Import$|^استيراد$/.test(x.textContent.trim()));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clickedImportTab) fail('could not find the Import sub-tab button — cannot reproduce the real navigation path at all');
  else ok('clicked the Import sub-tab from an already-open Finance page — the exact path that skipped wiring');

  // No extra render(), no wait for a poller — settle only long enough for the click's own
  // synchronous handler chain to finish, nothing more. If the assertions below need anything
  // beyond this one navigation, the bug is back.
  await p.waitForTimeout(400);

  const state = await p.evaluate(() => {
    const dz = document.getElementById('finDrop');
    const inp = document.getElementById('finFile');
    const btn = [...document.querySelectorAll('#view button')].find((x) => /Check file|فحص الملف/.test(x.textContent));
    return {
      dzWired: !!(dz && dz.__v65),
      inputMultiple: !!(inp && inp.multiple),
      checkFileOnclick: btn ? (btn.getAttribute('onclick') || '') : null,
    };
  });
  console.log('state after ONE navigation:', JSON.stringify(state));

  if (!state.dzWired) fail('#finDrop.__v65 is not set after a single navigation — the drop zone is still the old single-file listener, exactly the bug the owner hit');
  else ok('#finDrop.__v65 is set — multi-file drop zone wired on the very first paint');

  if (!state.inputMultiple) fail('#finFile.multiple is still false after a single navigation — only one file could be selected, the old behavior');
  else ok('#finFile.multiple is true — multi-file selection wired on the very first paint');

  if (state.checkFileOnclick === null) fail('could not find the "Check file" button at all');
  else if (!/v65CheckFiles/.test(state.checkFileOnclick)) fail(`"Check file" button still calls "${state.checkFileOnclick}" (the legacy single-format checker) after a single navigation — this is EXACTLY the failure the owner hit: a correct file gets rejected as though it were wrong`);
  else ok('"Check file" button is bound to v65CheckFiles() (not the legacy finParse()) on the very first paint');

  // A real correctness check, not just a wiring check: drop a file matching one of the newer
  // signatures through the now-wired panel and confirm it is actually recognized — proving
  // the wiring isn't just present but functional.
  const dropCsv = 'transaction_ref,txn_expense_status,invoice_issuing_raw\nT-WIRE-1,,Issued 116361000\n';
  await p.setInputFiles('#finFile', { name: 'wiring-check.csv', mimeType: 'text/csv', buffer: Buffer.from(dropCsv) });
  await p.waitForTimeout(1200);
  const preview = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  if (!/Expense Report — transaction status \(join\)/i.test(preview)) fail(`a real expense_gate_capture file was not recognized after a single navigation: ${preview.slice(0, 300)}`);
  else ok('a real file dropped immediately after one navigation was correctly recognized — the wiring is functional, not just present');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nimport-tab wiring OK — a single navigation (Finance → Import, the real "already on Finance" path) fully wires the multi-file importer, no second render() needed.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
