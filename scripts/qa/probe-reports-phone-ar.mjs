/* probe-reports-phone-ar.mjs — the Reports page on a phone and in Arabic (2026-09-02, attack
   round 24). Found while driving: on a 390 px phone the four report tabs ran off the right edge
   (a scrolling row with no hint — "Generate Report" sat off-screen), and the built report's KPI
   table pushed the whole page sideways; in Arabic the Generate Report tab (title, labels,
   options, buttons), the Achievements filters and the built report's table heads were English.
   Asserts:
     - phone: all four tabs sit inside the viewport on every tab; after "Build report" the page
       itself never scrolls sideways (the preview scrolls internally)
     - AR: the Generate tab, the Achievements filters, the Objectives meta line and the built
       report's heads are Arabic; none of the known English chrome survives
     - AR: picking "Quarterly objectives review" still stores the English key (options carry
       values); the report builds in both languages
   Sabotage: drop the flex-wrap rule in core-10 → tabs off-screen → red. Drop REPORTS_AR in
   js/21 → "Build report" survives → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8384;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
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

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6000);
  const setLang = (l) => p.evaluate((l) => { LANG = l; if (typeof applyLang === 'function') applyLang(); }, l);
  const go = async (tab) => { await p.evaluate((t) => { openLead = null; current = 'reports'; if (typeof rptGo === 'function' && t) { rptGo(t); } else render(); }, tab); await p.waitForTimeout(600); };
  const text = () => p.evaluate(() => (document.getElementById('view') || {}).textContent || '');
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 6);
  const tabsInView = () => p.evaluate(() => [...document.querySelectorAll('.rpt-tabs button')].map((x) => { const r = x.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1; }));

  // ---- phone
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  for (const tab of ['overview', 'achievements', 'objectives', 'report']) {
    await go(tab);
    const tv = await tabsInView(); const over = await overflow();
    if (tv.length === 4 && tv.every(Boolean) && !over) ok('phone ' + tab + ': all four tabs inside the viewport, no sideways scroll'); else fail('phone ' + tab + ': tabs in view ' + JSON.stringify(tv) + ', page overflow ' + over);
  }
  await p.evaluate(() => rptBuildReport()); await p.waitForTimeout(500);
  const built = await p.evaluate(() => !!document.getElementById('rptdoc'));
  const over2 = await overflow();
  const innerScroll = await p.evaluate(() => { const e = document.querySelector('.rpt-preview'); return e ? e.scrollWidth > e.clientWidth : null; });
  if (built && !over2) ok('phone: the built report does not push the page sideways (preview scrolls internally: ' + innerScroll + ')'); else fail('phone: report built ' + built + ', page overflow ' + over2);

  // ---- Arabic, desktop
  await p.setViewportSize({ width: 1366, height: 900 }); await setLang('ar');
  await go('report'); let t = await text();
  const genMust = ['إنشاء تقرير', 'نوع التقرير', 'النطاق', 'تقرير القسم الشهري', 'القسم كاملًا', 'إنشاء التقرير', 'طباعة / PDF', 'نسخ النص'];
  let missing = genMust.filter((w) => t.indexOf(w) < 0);
  if (!missing.length) ok('AR Generate Report: title, labels, options and buttons are Arabic'); else fail('AR Generate Report missing ' + JSON.stringify(missing));
  await p.evaluate(() => { const s = [...document.querySelectorAll('#view select')].find((x) => (x.getAttribute('onchange') || '').indexOf("rptRepSet('type'") >= 0); s.value = 'quarterly'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(400);
  // rptRep is file-private; the re-rendered select shows what was stored
  const typeKey = await p.evaluate(() => { const s = [...document.querySelectorAll('#view select')].find((x) => (x.getAttribute('onchange') || '').indexOf("rptRepSet('type'") >= 0); return s ? s.value : null; });
  if (typeKey === 'quarterly') ok('AR: choosing the Arabic option stores the English key ("quarterly")'); else fail('AR: report type stored as ' + JSON.stringify(typeKey));
  await p.evaluate(() => rptBuildReport()); await p.waitForTimeout(500); t = await text();
  const docMust = ['1 · الإنجازات', '2 · تقدّم المؤشرات مقابل أهداف 2026', 'المؤشر', 'الفعلي (منذ بداية السنة)', 'التقدم'];
  missing = docMust.filter((w) => t.indexOf(w) < 0);
  if (!missing.length) ok('AR built report: section heads and table heads are Arabic'); else fail('AR built report missing ' + JSON.stringify(missing));
  await go('achievements'); t = await text();
  missing = ['كل الأشهر', 'كل الأعضاء', 'كل الأهداف', 'لا شيء هنا بعد'].filter((w) => t.indexOf(w) < 0);
  if (!missing.length) ok('AR Achievements: filters and empty state are Arabic'); else fail('AR Achievements missing ' + JSON.stringify(missing));
  await go('objectives'); t = await text();
  if (t.indexOf('الربط الاستراتيجي') >= 0 && t.indexOf('مؤشر ·') >= 0) ok('AR Objectives: the meta line reads Arabic'); else fail('AR Objectives: meta line still English');
  const leftovers = ['Build report', 'Report type', 'Whole department', 'All months', 'Strategic link', 'Actual (YTD)', 'Nothing here yet'];
  const allAr = (await Promise.all(['report', 'achievements', 'objectives'].map(async (tab) => { await go(tab); return text(); }))).join('\n');
  const leak = leftovers.filter((w) => allAr.indexOf(w) >= 0);
  if (!leak.length) ok('AR Reports: none of the known English chrome survives'); else fail('AR Reports: English chrome survives ' + JSON.stringify(leak));

  // ---- English still builds
  await setLang('en'); await go('report'); await p.evaluate(() => rptBuildReport()); await p.waitForTimeout(400); t = await text();
  if (/Build report/.test(t) && /KPI progress vs 2026 targets/.test(t)) ok('EN: the report builds and reads English'); else fail('EN: report build/wording off');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nreports-phone-ar OK — Reports fits a phone and reads Arabic in Arabic');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
