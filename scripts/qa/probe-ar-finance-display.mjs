/* probe-ar-finance-display.mjs — Arabic Finance display defects found by eye on 2026-09-02:
   (1) the monthly chart labelled months "Jan…Jun" in Arabic mode; (2) a negative service fee
   rendered as "18.0K-" (bidi put the sign after the number). Both are guarded here, on the real
   Overview render under LANG='ar'. Sabotage: revert either fix → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8273;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
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
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); current = 'finance'; FIN.tab = 'overview'; FIN.p = { year: 'all', part: 'all', month: 'all' }; render(); });
  await p.waitForFunction(() => document.querySelector('.v32-svc'), null, { timeout: 20000 }).catch(() => null);
  await p.waitForTimeout(1500);

  const chart = await p.evaluate(() => {
    const view = document.getElementById('view');
    const labels = [...view.querySelectorAll('div[style*="height:124px"]')].map((bars) => (bars.parentElement.querySelector('div[style*="font-size:10px"]') || {}).textContent || '');
    return labels;
  });
  if (!chart.length) fail('CHART: no monthly bars rendered');
  else if (chart.some((l) => /^[A-Za-z]{3}$/.test(l.trim()))) fail('CHART: month labels are English in Arabic mode: ' + JSON.stringify(chart));
  else if (!chart.every((l) => /[؀-ۿ]/.test(l))) fail('CHART: expected Arabic month names, got ' + JSON.stringify(chart));
  else ok('CHART: month labels read in Arabic (' + chart.join(' ') + ')');

  const neg = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('.v32-svc tbody td:last-child')];
    const negs = cells.filter((c) => /-/.test(c.textContent));
    return { total: cells.length, negs: negs.map((c) => ({ text: c.textContent.trim(), ltr: !!c.querySelector('span[dir="ltr"]'), first: (c.querySelector('span[dir="ltr"]') || c).textContent.trim()[0] })) };
  });
  if (!neg.total) fail('SIGN: the income-by-service table did not render');
  else if (!neg.negs.length) ok('SIGN: no negative fee in this fixture (nothing to check)');
  else if (neg.negs.some((n) => !n.ltr || n.first !== '-')) fail('SIGN: a negative fee is not isolated left-to-right (would render as "18.0K-" in Arabic): ' + JSON.stringify(neg.negs));
  else ok(`SIGN: ${neg.negs.length} negative fee cell(s) isolated left-to-right, sign first`);

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS error(s)`);
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nar-finance-display OK — Arabic month labels on the chart, negative fees keep their sign in front.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
