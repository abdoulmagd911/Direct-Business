/* probe-report-presets.mjs (2026-08-26) — Report Builder "Quick views" (saved-view presets).
   Proves the three buttons (Executive monthly / Collections chase / Tax pack) each set
   FIN.rb to the intended shape, that the active one highlights, and that switching back to
   a manual combination clears the highlight. Sabotage-tested: run with SABOTAGE=1 to prove
   a broken preset (wrong g1) makes this probe fail, not just pass by accident. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8179; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
  await p.evaluate(() => { if (window.finGo) finGo('reports'); });
  await p.waitForTimeout(1000);

  if (SABOTAGE) {
    // window.finRBPreset is the only handle reachable from outside the module closure
    // (RB_PRESETS itself is not on window) — break it to prove the probe can catch a
    // broken preset, not just a missing one.
    await p.evaluate(() => {
      window.finRBPreset = function () { FIN.rb.g1 = 'quarter'; FIN.rb.g2 = ''; FIN.rb.verifiedOnly = true; FIN.rb.metrics = { revenue_sar: true }; render(); };
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

  // 1. Buttons render
  const btnCount = await p.evaluate(() => document.querySelectorAll('button[onclick^="finRBPreset"]').length);
  if (btnCount === 3) ok('3 quick-view buttons render'); else fail('expected 3 quick-view buttons, found ' + btnCount);

  // 2. Executive monthly
  await p.evaluate(() => finRBPreset('exec'));
  await settle();
  let rb = await p.evaluate(() => JSON.parse(JSON.stringify(FIN.rb)));
  if (rb.g1 === 'month' && !rb.g2 && rb.verifiedOnly === true && rb.metrics.revenue_sar && rb.metrics.cost_sar && rb.metrics.profit_sar) {
    ok('Executive monthly sets month grouping + rev/cost/profit + verified-only');
  } else fail('Executive monthly rb mismatch: ' + JSON.stringify(rb));
  let activeCount = await p.evaluate(() => document.querySelectorAll('button[onclick^="finRBPreset"].pri').length);
  if (activeCount === 1) ok('exactly one preset button highlighted after Executive monthly'); else fail('expected 1 highlighted preset, found ' + activeCount);

  // 3. Collections chase
  await p.evaluate(() => finRBPreset('collect'));
  await settle();
  rb = await p.evaluate(() => JSON.parse(JSON.stringify(FIN.rb)));
  if (rb.g1 === '__client' && rb.verifiedOnly === false && rb.metrics.amount_received_sar && rb.metrics.amount_remaining_sar) {
    ok('Collections chase groups by client, turns OFF verified-only, shows received/outstanding');
  } else fail('Collections chase rb mismatch: ' + JSON.stringify(rb));

  // 4. Tax pack
  await p.evaluate(() => finRBPreset('tax'));
  await settle();
  rb = await p.evaluate(() => JSON.parse(JSON.stringify(FIN.rb)));
  if (rb.g1 === 'quarter' && rb.g2 === 'service_type' && rb.verifiedOnly === true && rb.metrics.revenue_sar) {
    ok('Tax pack groups by quarter › service type, verified-only revenue');
  } else fail('Tax pack rb mismatch: ' + JSON.stringify(rb));

  // 5. Manual tweak clears the highlight (proves it's a live match, not a sticky flag)
  await p.evaluate(() => finRB('g1', 'record_type'));
  await settle();
  activeCount = await p.evaluate(() => document.querySelectorAll('button[onclick^="finRBPreset"].pri').length);
  if (activeCount === 0) ok('manual Group-by change clears the active-preset highlight'); else fail('expected 0 highlighted after manual change, found ' + activeCount);

  if (errors.length) { errors.forEach(e => fail(e)); }

  console.log(SABOTAGE ? '\n[SABOTAGE MODE]' : '');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
