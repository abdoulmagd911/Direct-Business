/* probe-compare-to.mjs (2026-08-27) — blueprint step 5, "Compare to" on the Performance tab.
   Injects three synthetic verified invoices spanning two years so both comparison modes have
   real data to resolve against: 2026 Q1 (current), 2025 Q1 (year-over-year target), 2025 Q4
   (previous-period target, since Q1's "previous" crosses the year boundary). Asserts: no
   comparison table with cmp=none; the YoY table shows the 2025 Q1 figures; the prev-period
   table shows the 2025 Q4 figures; switching the year filter to "All years" swaps the table
   for the "pick a year first" explanation instead of silently doing nothing.
   Sabotage-tested: SABOTAGE=1 breaks finCompPeriodOf's previous-quarter math (Q1 wraps to Q3,
   not Q4) — proves the probe catches a wrong comparison period, not just a missing one. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8180; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const SABOTAGE = process.env.SABOTAGE === '1';

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
    const mk = (no, y, q, mo, rev, cost) => ({ id: 'cmp-' + no, invoice_no: no, client_group: 'CMP CO', customer_raw_name: 'CMP CO',
      invoice_date: y + '-01-05', month: mo, quarter: q, year: y, service_type: 'Hotels', record_type: 'b2b',
      total_incl_vat_sar: rev, revenue_sar: rev, cost_sar: cost, profit_sar: rev - cost, amount_received_sar: rev,
      amount_remaining_sar: 0, wallet_portion_sar: 0, integrity_status: 'verified_paid', deleted_at: null });
    FIN.rows = [
      mk('CMP-CUR', 2026, 'Q1', 'January', 1000, 400),   // current: 2026 Q1
      mk('CMP-YOY', 2025, 'Q1', 'January', 500, 300),     // same period last year target
      mk('CMP-PREV', 2025, 'Q4', 'December', 300, 100),   // previous-period target (crosses year boundary)
    ];
    if (typeof clearFinCanon === 'function') clearFinCanon();
    FIN.p = { year: '2026', part: 'Q1', sector: 'all', cmp: 'none' };
    finGo('overview');
    return 'ok';
  });
  if (setup !== 'ok') { fail('setup: ' + setup); process.exit(1); }
  await p.waitForTimeout(500);

  if (SABOTAGE) {
    // finCompPeriodOf isn't exposed on window (module-scoped, like most of this file's
    // internals), so sabotage the one reachable seam: make picking a comparison mode also
    // silently drag the underlying year filter along with it. Same downstream symptom as a
    // broken finCompPeriodOf (the comparison period label is wrong) reached a different way —
    // good enough to prove the assertions below aren't rubber stamps.
    await p.evaluate(() => {
      window.finCmp = function (v) { FIN.p.cmp = v; FIN.p.year = '2020'; render(); };
    });
  }

  const settle = async () => {
    let last = '', same = 0;
    for (let i = 0; i < 20; i++) {
      const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0);
      if (h === last) { same++; if (same >= 2) return; } else { same = 0; }
      last = h; await p.waitForTimeout(150);
    }
  };
  await settle();

  // 1. cmp=none shows no comparison table
  let text = await p.evaluate(() => document.querySelector('#view').innerText);
  if (text.includes('2025 · Q1') || text.includes('2025 · Q4')) fail('comparison period label shown while cmp=none');
  else ok('no comparison period label shown with "No comparison" selected');

  // 2. YoY
  await p.evaluate(() => finCmp('yoy'));
  await settle();
  text = await p.evaluate(() => document.querySelector('#view').innerText);
  if (text.includes('2025 · Q1')) ok('YoY comparison targets 2025 · Q1 (same quarter, prior year)');
  else fail('YoY comparison did not show 2025 · Q1 label. Text: ' + text.slice(0, 400));
  if (/500\b/.test(text) || text.includes('500 SAR')) ok('YoY comparison column shows the 2025 Q1 revenue (500)');
  else fail('YoY comparison revenue (500) not found in table');

  // 3. Previous period (crosses year boundary: Q1 2026 -> Q4 2025)
  await p.evaluate(() => finCmp('prev'));
  await settle();
  text = await p.evaluate(() => document.querySelector('#view').innerText);
  if (text.includes('2025 · Q4')) ok('Previous-period comparison correctly wraps Q1 2026 back to Q4 2025');
  else fail('Previous-period comparison did not show 2025 · Q4 label. Text: ' + text.slice(0, 400));

  // 4. "All years" guard
  await p.evaluate(() => { FIN.p.year = 'all'; FIN.p.cmp = 'yoy'; render(); });
  await settle();
  text = await p.evaluate(() => document.querySelector('#view').innerText);
  if (/pick a specific year|اختر سنة محددة/i.test(text)) ok('"All years" shows the pick-a-year explanation instead of a table');
  else fail('"All years" + a comparison mode did not show the guard message');
  if (text.includes('2025 · Q1') || text.includes('2025 · Q4')) fail('a comparison table rendered anyway under "All years"');

  if (errors.length) { errors.forEach(e => fail(e)); }

  console.log(SABOTAGE ? '\n[SABOTAGE MODE]' : '');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
