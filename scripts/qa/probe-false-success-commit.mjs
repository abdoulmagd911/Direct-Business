/* probe-false-success-commit.mjs — M13 regression guard for a real live bug, worse than a
   crash: the owner ran a real import and read "Done. Imported 0 new, updated 27." while the
   database had written NOTHING (verified in Supabase immediately after: with_cost 0, cost
   0.00, profit still equalling revenue). The error text WAS present in the same message
   ("cannot insert a non-DEFAULT value into column \"year\""), but subordinated under a green
   "Done" headline built from the INTENDED batch length, not from anything the database
   confirmed — exactly the B2 failure already in docs/DECISIONS.md (a refused write that
   looks identical to a successful one), except worse here because a reasonable person reads
   "Done, updated 27" and stops, never reaching the error text at all.

   ROOT CAUSE: `year` on finance_invoices is `GENERATED ALWAYS AS
   (EXTRACT(year FROM invoice_date))::integer STORED` (confirmed against the live schema, not
   guessed — the only generated column on the table; `month`/`quarter` are plain columns the
   finance_derive_fields trigger recomputes regardless of what is sent, so they were never the
   problem). Two update-payload builders in js/65-universal-importer.js spread a full,
   already-fetched finance_invoices row (`Object.assign({},existing,{...delta})`) straight from
   FIN.rows — a real `select *` — so `year` rode along into the write. PostgREST sends one
   batch as ONE statement, so a single row carrying `year` fails the WHOLE batch — this is why
   ALL 27 failed together, not a partial success.

   TWO INDEPENDENT FIXES, TWO INDEPENDENT ASSERTIONS BELOW:
   (1) pickWritable() — every update/insert payload is now built from an explicit allowlist of
       writable columns instead of ever spreading a full row object. SCENARIO 1 intercepts the
       real outgoing request body and asserts `year` is never present in it, then confirms via
       FIN.rows that the write actually landed with the exact values reported.
   (2) v65Commit()'s reporting — every insert/upsert now chains `.select('id')` and counts what
       the database actually returned; on ANY batch error the headline flips to a red FAILED
       naming the confirmed-written count (never the intended count as if it were written).
       SCENARIO 2 forces a real Postgres-shaped rejection at the network layer — independent of
       whether fix (1) holds — and asserts the UI reports FAILED with a written count of 0, the
       real error text, and leaves the target row byte-for-byte unchanged.

   mock-supabase.mjs was also taught to reject any finance_invoices write whose payload carries
   `year`, mirroring the real constraint — before this, the mock had no way to catch this class
   of bug at all, which is exactly how it shipped undetected through an otherwise thorough
   regression suite. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8237;
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

  let capturedBodies = [];
  async function proxyHandler(r) {
    const rq = r.request(); const u = new URL(rq.url());
    if (rq.method() === 'POST' && u.pathname === '/rest/v1/finance_invoices') {
      try { capturedBodies.push(JSON.parse(rq.postData() || '[]')); } catch (_) {}
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  }
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', proxyHandler);
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

  async function commitAndReadPreview(csv, fileName) {
    const ingested = await p.evaluate(([n, text]) => window.v65IngestText(n, text), [fileName, csv]);
    if (!ingested) fail(`v65IngestText(${fileName}) did not run`);
    await p.waitForTimeout(800);
    const clicked = await p.evaluate(() => {
      const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm/i.test(x.textContent));
      if (bt) { bt.click(); return true; }
      return false;
    });
    if (!clicked) fail(`no Confirm import button appeared for ${fileName}`);
    await p.waitForTimeout(1500);
    return p.evaluate(() => { const v = document.getElementById('finImpOut'); return v ? v.innerText : ''; });
  }

  // ================= SCENARIO 1 — clean commit, fix (1): payload never carries `year` =================
  // 116361000 (i=0 in the mock fixture) — real tax code + Issued status, genuinely eligible.
  const csv1 = [
    'invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date',
    '116361000,DPIN-200000,5300,Issued,2026-08-01',
  ].join('\n');
  const preview1 = await commitAndReadPreview(csv1, 'tax-invoices-1.csv');
  console.log('scenario 1 preview:', JSON.stringify(preview1));

  const anyYearInPayload = capturedBodies.some((batch) => (batch || []).some((row) => Object.prototype.hasOwnProperty.call(row, 'year')));
  if (anyYearInPayload) fail('SCENARIO 1: the real outgoing write payload carries `year` — a GENERATED column — exactly the payload that fails a real Postgres batch statement');
  else ok('SCENARIO 1: the real outgoing write payload never carries `year` — pickWritable() is doing its job');

  if (!/Done\./.test(preview1) || /FAILED/.test(preview1)) fail(`SCENARIO 1: expected a clean success headline, got: ${preview1.slice(0, 300)}`);
  else ok('SCENARIO 1: reported success ("Done.") for a write that should genuinely succeed');
  if (!/Imported 0 new, updated 1\./.test(preview1)) fail(`SCENARIO 1: expected "Imported 0 new, updated 1.", got: ${preview1.slice(0, 300)}`);
  else ok('SCENARIO 1: reported exactly 1 updated — matches what was actually sent and (below) actually landed');

  const row1 = await p.evaluate(() => { const r = (FIN.rows || []).find((x) => x.invoice_no === '116361000'); return r ? { dpin: r.zatca_dpin, total: r.total_incl_vat_sar } : null; });
  if (!row1 || row1.dpin !== 'DPIN-200000' || row1.total !== 5300) fail(`SCENARIO 1: the reported "updated 1" did not actually land in the database — got ${JSON.stringify(row1)}`);
  else ok('SCENARIO 1: the reported count matches a real, DB-confirmed write (zatca_dpin/total actually changed)');

  // ================= SCENARIO 2 — forced database refusal, fix (2): reporting =================
  // Independent of fix (1): force the exact real Postgres rejection at the network layer,
  // regardless of what the app's own payload contains, and confirm the UI never claims success.
  capturedBodies = [];
  let scenario2Blocked = false;
  await p.unroute('**vkxoeeoauexyfpzqufqd.supabase.co/**');
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (rq.method() === 'POST' && u.pathname === '/rest/v1/finance_invoices') {
      scenario2Blocked = true;
      await r.fulfill({
        status: 400, contentType: 'application/json',
        body: JSON.stringify({ message: 'cannot insert a non-DEFAULT value into column "year"', code: '428C9', hint: 'Column "year" is a generated column.' }),
      });
      return;
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });

  // 116361009 (i=9) — seeded with zatca_dpin=null, total_incl_vat_sar=11993 — must stay exactly
  // that after the forced failure.
  const csv2 = [
    'invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date',
    '116361009,DPIN-200009,6100,Issued,2026-08-02',
  ].join('\n');
  const preview2 = await commitAndReadPreview(csv2, 'tax-invoices-2.csv');
  console.log('scenario 2 preview:', JSON.stringify(preview2));

  if (!scenario2Blocked) fail('SCENARIO 2: the forced-failure route never engaged — the test did not actually exercise a database refusal');
  else ok('SCENARIO 2: the forced database refusal engaged for the real write call');

  if (/Done\./.test(preview2)) fail(`THE EXACT BUG THE OWNER HIT: the commit reports success ("Done.") despite the database refusing the write — ${preview2.slice(0, 400)}`);
  else ok('SCENARIO 2: does NOT report "Done." when the database refused the write');
  if (!/FAILED/.test(preview2)) fail(`SCENARIO 2: expected a FAILED headline, got: ${preview2.slice(0, 400)}`);
  else ok('SCENARIO 2: reports FAILED, leading with failure rather than burying it under a success headline');
  if (!/wrote:\s*0 new,\s*0 updated/i.test(preview2)) fail(`SCENARIO 2: expected the database-confirmed written count to read 0 new, 0 updated — got: ${preview2.slice(0, 400)}`);
  else ok('SCENARIO 2: the confirmed-written count reads 0 — never the intended batch length dressed up as success');
  if (!/intended 0 new,\s*1 updated/i.test(preview2)) fail(`SCENARIO 2: expected the intended count (1) to still be shown, separately labeled "intended" — got: ${preview2.slice(0, 400)}`);
  else ok('SCENARIO 2: the intended count is still shown, but explicitly labeled "intended" — never presented as what was written');
  if (!/cannot insert a non-DEFAULT value into column "year"/.test(preview2)) fail(`SCENARIO 2: the real Postgres error text is missing from the message — got: ${preview2.slice(0, 400)}`);
  else ok('SCENARIO 2: the real error text is surfaced, not swallowed');

  const row2 = await p.evaluate(() => { const r = (FIN.rows || []).find((x) => x.invoice_no === '116361009'); return r ? { dpin: r.zatca_dpin, total: r.total_incl_vat_sar } : null; });
  if (!row2 || row2.dpin !== null || row2.total !== 11993) fail(`SCENARIO 2: the row changed despite the database refusing the write — got ${JSON.stringify(row2)} (expected {dpin:null,total:11993}, exactly as seeded)`);
  else ok('SCENARIO 2: the target row is byte-for-byte unchanged — nothing landed, matching what the UI reported');

  // "status of 400" is the browser's own devtools network log for the exact 400 SCENARIO 2
  // deliberately forces (a real Postgres-shaped rejection) — expected, not a JS/app error.
  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION|status of 400/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nfalse-success-commit OK — a real write payload never carries the GENERATED `year` column, a real DB-confirmed write is reported accurately, and a forced database refusal is reported as FAILED with a written count of 0 — never as success dressed up from intent.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
