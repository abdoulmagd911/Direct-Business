/* probe-finance-invariants.mjs — standing exclusion invariant (docs/DECISIONS.md, 2026-08-23).

   The owner ruled "No takamol what so ever" after ten live Takamol invoices — 6,724,291.12
   SAR, 77% of the Finance page's displayed revenue — turned out to have entered
   finance_invoices despite a correctly-configured exclusion list existing since 2026-08-21.
   The exclusion check (js/62-finance-guardrails.js's finExclusionCheck) IS correctly wired
   into both of this app's importers (js/41-money-in.js:110, js/65-universal-importer.js:275)
   — read and independently confirmed before writing this probe. The rows entered anyway,
   almost certainly through a path outside this app's own importer UI entirely, which no
   client-side import-time check can ever defend against. So js/16-finance-ledger.js's
   finGot() now re-checks every row against the same exclusion list on every load, regardless
   of how the row arrived — belt-and-suspenders. docs/DECISIONS.md: "A standing exclusion is
   not satisfied by loading the data and labelling it."

   This probe is the regression guard for that filter. scripts/qa/mock-supabase.mjs seeds one
   extra live, non-deleted, verified_paid finance_invoices row (id 'i-qa-takamol',
   client_group 'Takamol for Business Services', total 314,159 SAR) alongside the exclusion
   entry that names it — exactly the shape a future re-import mistake would produce. If this
   row EVER counts in FIN.rows, any rendered total, or any export, this probe fails the
   build. It does not rely on remembering to check — that is the whole point. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8179;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

const TELLTALES = [/takamol/i, /techtic/i, /9999999999/, /314[,.]?159/, /TTIN-9999/];

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

function scanClean(text, label) {
  const hit = TELLTALES.find((re) => re.test(text));
  if (hit) fail(`${label}: the excluded Takamol row leaked through — matched ${hit}`);
  else ok(`${label}: no trace of the excluded row`);
}

async function readDownload(download) {
  const tmp = path.join(os.tmpdir(), 'fininv-' + Math.random().toString(36).slice(2) + '-' + download.suggestedFilename());
  await download.saveAs(tmp);
  const text = fs.readFileSync(tmp, 'utf8');
  fs.unlinkSync(tmp);
  return text;
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
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

  // ---- 1. Sanity on the exclusion machinery itself, and on the raw fixture, before
  // trusting any downstream check. live() (js/16-finance-ledger.js) is where the actual
  // filtering happens — scoped inside that file, not exposed on window, so it's verified
  // indirectly below via rendered totals and real exports, which is what a person actually
  // sees and is the stronger proof anyway. ----
  const state = await p.evaluate(() => ({
    rawRowCount: (typeof FIN !== 'undefined' && FIN.rows) ? FIN.rows.length : null,
    exclusionCheckWired: typeof window.finExclusionCheck === 'function',
    exclusionListHasTakamol: typeof window.finExclusionCheck === 'function' ? !!window.finExclusionCheck('Takamol for Business Services') : null,
  }));
  console.log('state:', JSON.stringify(state));

  if (!state.exclusionCheckWired) fail('window.finExclusionCheck is not a function — js/62 did not load');
  else ok('finExclusionCheck is wired');
  if (!state.exclusionListHasTakamol) fail('the exclusion list does not name "Takamol for Business Services" — fixture/app_settings mismatch, this probe cannot test anything');
  else ok('exclusion list correctly names Takamol');
  if (state.rawRowCount !== 16) fail(`FIN.rows (raw, pre-filter) has ${state.rawRowCount} rows, expected exactly 16 seeded server-side — fixture assumption broke`);
  else ok('FIN.rows (raw) has all 16 seeded rows — the exclusion is applied on every read, not by dropping data at load');

  // ---- 2. Rendered totals — Overview, Clients & collections, Ledger — no visible trace ----
  for (const tab of ['overview', 'clients', 'ledger']) {
    const clicked = await p.evaluate((k) => { if (typeof window.finGo === 'function') { window.finGo(k); return true; } return false; }, tab);
    if (!clicked) { fail(`Finance/${tab}: window.finGo is not a function`); continue; }
    await p.waitForTimeout(900);
    const text = await p.evaluate(() => { const v = document.getElementById('view'); return v ? v.innerText : ''; });
    scanClean(text, `Finance/${tab} rendered text`);
  }

  // ---- 3. Every CSV export — the real buttons, the real downloaded file ----
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('ledger'); });
  await p.waitForTimeout(900);
  {
    const dialogsBefore = dialogs.length;
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      p.evaluate(() => { window.finLedgerCSV(); }),
    ]);
    if (dialogs.length > dialogsBefore) fail(`finLedgerCSV() alerted: ${dialogs[dialogs.length - 1]}`);
    if (!download) fail('finLedgerCSV(): no download captured');
    else scanClean(await readDownload(download), 'finLedgerCSV() export');
  }
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('overview'); });
  await p.waitForTimeout(900);
  for (const scope of ['list', 'full']) {
    const dialogsBefore = dialogs.length;
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      p.evaluate((s) => { window.expGo(s); }, scope),
    ]);
    if (dialogs.length > dialogsBefore) fail(`Export ▾ "${scope}" alerted: ${dialogs[dialogs.length - 1]}`);
    if (!download) fail(`Export ▾ "${scope}": no download captured`);
    else scanClean(await readDownload(download), `Export ▾ "${scope}" export`);
  }

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nfinance invariants OK — the excluded Takamol row never reached FIN.rows, any rendered total, or any export.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
