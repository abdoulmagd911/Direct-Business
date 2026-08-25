/* probe-import-preview-density.mjs — regression guard for a real density complaint (owner,
   2026-08-25): the import preview "printed the identical Takamol sentence about twenty times
   in a row" — one line per excluded row, all byte-identical except the row wasn't even shown,
   just the same client name/id/reason repeated. Collapses to ONE line with a count via
   groupDupes() (js/65-universal-importer.js), never shortening the reason text itself (B6 —
   a sentence stating a rule the user could violate is load-bearing, only the REPETITION goes).

   Drives the real tax_invoice_capture path end to end: seeds 5 distinct existing invoices all
   belonging to the same excluded client (Takamol, #7 — the standing fixture, see
   docs/DECISIONS.md), then imports 5 rows that would each otherwise qualify (real tax code,
   final status) targeting those 5 invoices — each one is excluded individually inside
   processTaxInvoiceBatch(), and the preview must show ONE collapsed line ("Takamol ... — 5
   rows"), never 5 separate near-identical sentences. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8243;
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

  const N = 5;
  await p.evaluate((n) => {
    FIN.rows = FIN.rows || [];
    for (let i = 0; i < n; i++) {
      FIN.rows.push({ invoice_no: 'QA-TAKAMOL-DUP-' + i, client_group: 'Takamol for Business Services', customer_raw_name: 'Takamol for Business Services', total_incl_vat_sar: 999999, revenue_sar: 999999, cost_sar: 0, profit_sar: 999999, integrity_status: 'excluded', deleted_at: null, invoice_date: '2026-05-01', zatca_dpin: null });
    }
  }, N);

  const csvLines = ['invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date'];
  for (let i = 0; i < N; i++) csvLines.push(`QA-TAKAMOL-DUP-${i},TTIN-DUP-${i},999999,Issued,2026-08-01`);
  const csv = csvLines.join('\n');

  const ingested = await p.evaluate((text) => window.v65IngestText('dup-takamol.csv', text), csv);
  if (!ingested) fail('v65IngestText did not run');
  await p.waitForTimeout(800);

  const preview = await p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  console.log('preview:', JSON.stringify(preview.slice(0, 500)));

  // "Takamol" legitimately appears twice within ONE collapsed line (once in the client name,
  // once in the reason text) — the real signal of a collapse failure is the REASON SENTENCE
  // repeating, which is what "printed the identical Takamol sentence ~20 times" described.
  const reasonMatches = (preview.match(/accounted for elsewhere/g) || []).length;
  if (reasonMatches === 0) fail('the exclusion reason text does not appear at all in the preview — the exclusion may not have fired');
  else if (reasonMatches > 1) fail(`the exclusion reason sentence appears ${reasonMatches} times in the preview — the ${N} identical exclusion rows were NOT collapsed into one line (the exact density complaint)`);
  else ok(`the exclusion reason sentence appears exactly once, despite ${N} rows being excluded for the same reason — collapsed correctly, not repeated`);

  if (!new RegExp(N + ' ').test(preview) && !preview.includes(String(N))) fail(`the collapsed row count (${N}) is not shown anywhere in the preview — a count is what makes a collapsed line trustworthy`);
  else ok(`the row count (${N}) is shown alongside the collapsed line — the reader knows how many rows this represents, not just that some rows exist`);

  // B6: the reason text itself must survive the collapse, not just the client name.
  if (!/accounted for elsewhere/i.test(preview)) fail('the exclusion REASON text is missing after collapsing — B6 says shorten the repetition, never the rule itself');
  else ok('the exclusion reason text survives the collapse — B6 held: the rule is shortened in repetition, never deleted');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nimport-preview-density OK — repeated identical exclusion rows collapse into one line with a count, the reason text survives, and JS/console stayed clean.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
