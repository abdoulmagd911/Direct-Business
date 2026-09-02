/* probe-report-presets.mjs (2026-08-26) — Report Builder "Quick views" (saved-view presets).
   Proves the three buttons (Executive monthly / Collections chase / Tax pack) each set
   FIN.rb to the intended shape, that the active one highlights, and that switching back to
   a manual combination clears the highlight. Sabotage-tested: run with SABOTAGE=1 to prove
   a broken preset (wrong g1) makes this probe fail, not just pass by accident.
   2026-08-29: also proves the scope caption ("What this report counts") — it must exist,
   its scope must match the preset (verified-only vs all live), and the invoice count it
   states must equal the rows the table was actually built from (same base set, no second
   copy of the rule). SABOTAGE=2 breaks the caption (scope attribute inverted) to prove the
   caption checks can fail. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8179; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const SABOTAGE = process.env.SABOTAGE === '1';
const SABOTAGE_CAPTION = process.env.SABOTAGE === '2';

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

  // Caption check: reads the caption the page rendered and recomputes the expected invoice
  // count from the app's own filters, independently of the caption's own code path.
  const checkCaption = async (label, expectScope) => {
    const c = await p.evaluate(() => {
      const el = document.querySelector('#rb-caption'); if (!el) return null;
      const rb = FIN.rb;
      // live()/verified() are IIFE-scoped and unreachable from here (build-log lesson) — so
      // recompute from the raw rows with the app's own public exclusion check. That is the
      // better test anyway: an independent count, not the caption's own helper re-run.
      const ex = (typeof window.finExclusionCheck === 'function') ? window.finExclusionCheck : () => false;
      const base = (FIN.rows || []).filter(r => !r.deleted_at && !(ex(r.client_group) || ex(r.customer_raw_name)))
        .filter(r => !rb.verifiedOnly || r.integrity_status === 'verified_paid')
        .filter(r => rb.quarter === 'all' || r.quarter === rb.quarter);
      return { scope: el.getAttribute('data-scope'), n: +el.getAttribute('data-n'), text: el.textContent.trim(), expectN: base.length,
               tableRowsBehind: (FIN._lastReport && FIN._lastReport.keys || []).reduce((a, k) => a + FIN._lastReport.g[k].__rows.length, 0) };
    });
    if (!c) { fail(label + ': no #rb-caption rendered'); return; }
    if (c.scope !== expectScope) fail(label + `: caption scope is "${c.scope}", expected "${expectScope}"`); else ok(label + `: caption scope = ${expectScope}`);
    if (c.n !== c.expectN) fail(label + `: caption says ${c.n} invoices, the same filters give ${c.expectN}`); else ok(label + `: caption count ${c.n} = rows the filters actually select`);
    if (c.n !== c.tableRowsBehind) fail(label + `: caption says ${c.n} invoices, the rendered table is built from ${c.tableRowsBehind}`); else ok(label + `: caption count = rows behind the rendered table`);
    const want = expectScope === 'verified' ? /fully-paid|المدفوعة بالكامل/ : /paid and unpaid|المدفوعة وغير المدفوعة/;
    if (!want.test(c.text)) fail(label + ': caption text does not state the scope in words: ' + c.text.slice(0, 120)); else ok(label + ': caption states the scope in words');
    if (!/period bar above does not apply|شريط الفترة/.test(c.text)) fail(label + ': caption does not disclose that the period bar is ignored here'); else ok(label + ': caption discloses the period-bar gap');
  };
  if (SABOTAGE_CAPTION) {
    // Invert the scope attribute after every render — the caption now lies about what's counted.
    await p.evaluate(() => {
      const orig = window.render;
      window.render = function () { orig.apply(this, arguments); const el = document.querySelector('#rb-caption'); if (el) el.setAttribute('data-scope', el.getAttribute('data-scope') === 'verified' ? 'all' : 'verified'); };
    });
  }

  // Add one synthetic UNPAID invoice so the verified-only and all-live sets differ by exactly
  // one row — otherwise (the seed is all verified_paid) the caption's count could never tell
  // the two scopes apart and the count check would be incapable of failing on scope.
  await p.evaluate(() => {
    FIN.rows.push({ id: 'qa-caption-unpaid', invoice_no: 'QA-CAPTION-UNPAID-1', client_group: 'QA Caption Co', customer_raw_name: 'QA Caption Co',
      integrity_status: 'pending', total_incl_vat_sar: 1000, revenue_sar: 1000, cost_sar: 0, profit_sar: 1000, amount_received_sar: 0, amount_remaining_sar: 1000,
      invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null });
    render();
  });
  await settle();
  const counts = await p.evaluate(() => {
    const ex = (typeof window.finExclusionCheck === 'function') ? window.finExclusionCheck : () => false;
    const rows = (FIN.rows || []).filter(r => !r.deleted_at && !(ex(r.client_group) || ex(r.customer_raw_name)));
    return { all: rows.length, verified: rows.filter(r => r.integrity_status === 'verified_paid').length };
  });
  if (counts.all === counts.verified + 1) ok(`fixture: ${counts.verified} verified-paid + 1 unpaid = ${counts.all} live (scopes now distinguishable)`);
  else fail('fixture setup: expected all = verified + 1, got ' + JSON.stringify(counts));

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
  await checkCaption('Executive monthly', 'verified');

  // 3. Collections chase
  await p.evaluate(() => finRBPreset('collect'));
  await settle();
  rb = await p.evaluate(() => JSON.parse(JSON.stringify(FIN.rb)));
  if (rb.g1 === '__client' && rb.verifiedOnly === false && rb.metrics.amount_received_sar && rb.metrics.amount_remaining_sar) {
    ok('Collections chase groups by client, turns OFF verified-only, shows received/outstanding');
  } else fail('Collections chase rb mismatch: ' + JSON.stringify(rb));
  await checkCaption('Collections chase', 'all');

  // 4. Tax pack
  await p.evaluate(() => finRBPreset('tax'));
  await settle();
  rb = await p.evaluate(() => JSON.parse(JSON.stringify(FIN.rb)));
  if (rb.g1 === 'quarter' && rb.g2 === 'service_type' && rb.verifiedOnly === true && rb.metrics.revenue_sar) {
    ok('Tax pack groups by quarter › service type, verified-only revenue');
  } else fail('Tax pack rb mismatch: ' + JSON.stringify(rb));
  await checkCaption('Tax pack', 'verified');

  // 5. Manual tweak clears the highlight (proves it's a live match, not a sticky flag)
  await p.evaluate(() => finRB('g1', 'record_type'));
  await settle();
  activeCount = await p.evaluate(() => document.querySelectorAll('button[onclick^="finRBPreset"].pri').length);
  if (activeCount === 0) ok('manual Group-by change clears the active-preset highlight'); else fail('expected 0 highlighted after manual change, found ' + activeCount);

  if (errors.length) { errors.forEach(e => fail(e)); }

  console.log(SABOTAGE ? '\n[SABOTAGE MODE]' : SABOTAGE_CAPTION ? '\n[SABOTAGE MODE — caption]' : '');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
