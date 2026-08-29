/* probe-sector-scope.mjs — blueprint step 4 (2026-08-26): the render-time Sector dimension.
   Injects two synthetic verified invoices — one whose linked business has payment_terms
   'Tender', one plain B2B, plus one 'School Commission' row — then proves: the chips render,
   'All sectors' counts all three, 'Tenders' keeps exactly the tender row, 'Academies' keeps
   exactly the commission row, and switching back restores the full total. Uses the same
   mock-supabase + real-login scaffold as every probe here. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8178; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET','HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v,k)=>{ if(!['content-encoding','content-length','transfer-encoding'].includes(k)) h[k]=v; });
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
  await p.waitForTimeout(1500);

  const setup = await p.evaluate(() => {
    if (typeof FIN === 'undefined' || !window.finGo) return 'app not ready';
    FIN.rows = FIN.rows || [];
    const mk = (no, cg, svc, amt) => ({ id: 'sec-' + no, invoice_no: no, client_group: cg, customer_raw_name: cg,
      invoice_date: '2026-05-05', month: 'May', quarter: 'Q2', year: 2026, service_type: svc, record_type: 'b2b',
      total_incl_vat_sar: amt, revenue_sar: amt, cost_sar: 0, profit_sar: amt, amount_received_sar: amt,
      amount_remaining_sar: 0, wallet_portion_sar: 0, integrity_status: 'verified_paid', deleted_at: null });
    FIN.rows = [mk('SEC-T1','TENDER CO','Hotels',1000), mk('SEC-B1','PLAIN CO','Hotels',200), mk('SEC-A1','SCHOOL CO','School Commission',30)];
    DB.businesses = DB.businesses || [];
    DB.businesses.push({ id: 'secb1', name: 'TENDER CO', paymentTerms: 'Tender' }, { id: 'secb2', name: 'PLAIN CO', paymentTerms: 'Post-paid · Monthly' });
    const uu = (x) => (window.__bizUuid ? __bizUuid(x) : x);
    FIN.linkByGroup = FIN.linkByGroup || {};
    FIN.linkByGroup['TENDER CO'] = { business_id: uu('secb1'), is_client: true };
    FIN.linkByGroup['PLAIN CO'] = { business_id: uu('secb2'), is_client: true };
    if (typeof clearFinCanon === 'function') clearFinCanon();
    FIN.p = { year: 'all', part: 'all', sector: 'all' };
    return 'ok';
  });
  if (setup !== 'ok') { fail('setup: ' + setup); process.exit(1); }
  // navigate FIRST, then re-inject: finGo triggers the app's own load, which replaces FIN.rows
  await p.evaluate(() => finGo('overview'));
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const mk = (no, cg, svc, amt) => ({ id: 'sec-' + no, invoice_no: no, client_group: cg, customer_raw_name: cg,
      invoice_date: '2026-05-05', month: 'May', quarter: 'Q2', year: 2026, service_type: svc, record_type: 'b2b',
      total_incl_vat_sar: amt, revenue_sar: amt, cost_sar: 0, profit_sar: amt, amount_received_sar: amt,
      amount_remaining_sar: 0, wallet_portion_sar: 0, integrity_status: 'verified_paid', deleted_at: null });
    FIN.rows = [mk('SEC-T1','TENDER CO','Hotels',1000), mk('SEC-B1','PLAIN CO','Hotels',200), mk('SEC-A1','SCHOOL CO','School Commission',30)];
    FIN.linkByGroup = FIN.linkByGroup || {};
    const uu = (x) => (window.__bizUuid ? __bizUuid(x) : x);
    FIN.linkByGroup['TENDER CO'] = { business_id: uu('secb1'), is_client: true };
    FIN.linkByGroup['PLAIN CO'] = { business_id: uu('secb2'), is_client: true };
    if (typeof clearFinCanon === 'function') clearFinCanon();
    if (typeof render === 'function') render();
  });
  await p.waitForTimeout(1200);

  const read = () => p.evaluate(() => {
    const V = (FIN.rows || []).filter((r) => !r.deleted_at && r.integrity_status === 'verified_paid' && finInPeriod(r));
    const chips = [...document.querySelectorAll('#view button')].map((b) => b.innerText.trim()).filter((t) => ['All sectors','Tenders','B2B','Academies'].includes(t));
    return { n: V.length, rev: V.reduce((s, r) => s + (+r.revenue_sar || 0), 0), chips };
  });

  let st = await read();
  if (st.chips.length === 4) ok('all 4 sector chips render in the period bar'); else fail('chips missing: ' + JSON.stringify(st.chips));
  if (st.n === 3 && st.rev === 1230) ok('All sectors: 3 rows, 1230 — full scope'); else fail(`All sectors wrong: n=${st.n} rev=${st.rev}`);

  await p.evaluate(() => window.finPS('tenders')); await p.waitForTimeout(900); st = await read();
  if (st.n === 1 && st.rev === 1000) ok('Tenders: exactly the tender-terms row (1000)'); else fail(`Tenders wrong: n=${st.n} rev=${st.rev}`);

  await p.evaluate(() => window.finPS('academies')); await p.waitForTimeout(900); st = await read();
  if (st.n === 1 && st.rev === 30) ok('Academies: exactly the School Commission row (30)'); else fail(`Academies wrong: n=${st.n} rev=${st.rev}`);

  await p.evaluate(() => window.finPS('b2b')); await p.waitForTimeout(900); st = await read();
  if (st.n === 1 && st.rev === 200) ok('B2B: exactly the plain row (200)'); else fail(`B2B wrong: n=${st.n} rev=${st.rev}`);

  await p.evaluate(() => window.finPS('all')); await p.waitForTimeout(900); st = await read();
  if (st.n === 3 && st.rev === 1230) ok('back to All: full total restored — the filter is lossless'); else fail(`restore wrong: n=${st.n} rev=${st.rev}`);

  const realErrors = errors.filter((e) => !/ResizeObserver|favicon/.test(e));
  if (realErrors.length) fail('JS errors: ' + realErrors.slice(0, 3).join(' | ')); else ok('no JS errors');
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nsector-scope OK — sector chips filter every derived number, losslessly, with no schema change.');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
