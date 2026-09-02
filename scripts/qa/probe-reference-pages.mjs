/* probe-reference-pages.mjs — the Reference pages driven past the list (2026-09-02, attack round 19).
   Airlines and Providers & GDS had only ever been swept at list level, and the harness blob carried
   zero airlines / zero providers, so the drill-downs (airline detail + dashboard, provider detail +
   dashboard) had never rendered a row in QA. The mock now seeds five carriers and four providers.
   Asserts, EN + AR, desktop + phone:
     - the lists show the seeded rows; each drill-down opens on the right record, no "undefined /
       NaN / [object" anywhere, no horizontal overflow at 390 px
     - the provider "servicing capability" toggles read as the plain flags they are (Book / Reissue /
       Refund / EMD / Seats / Bags / Split PNR) — never relabeled into a money action — and clicking
       one persists to the workspace
     - changing an NDC status in ARABIC still stores the English keyword (the matrix is data, and
       ndcActive() counts status==="Active")
     - the Arabic drill-down chrome is translated (back buttons, card titles, fact labels, tiles)
     - friendly addresses resolve: /providers → the Providers page, /operations → Operations
   Sabotage: drop the ALIAS map in js/03 → /providers lands on Today → red. Drop the setCap skip in
   core-06 → the Refund flag reads "Request refund → Direct Payment" → red. Drop a dictionary entry
   in js/21 → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8373;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const blob = async () => ((await (await fetch(BASE + '/rest/v1/app_state?id=eq.1')).json())[0] || {}).data || {};

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
  const text = () => p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
  // collapsed <details> sections are invisible to innerText — the chrome checks read the whole markup
  const textAll = () => p.evaluate(() => (document.getElementById('view') || {}).textContent || '');
  const bad = (t) => (t.match(/undefined|NaN|\[object/g) || []);
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 6);
  const setLang = (l) => p.evaluate((l) => { LANG = l; if (typeof applyLang === 'function') applyLang(); }, l);

  const counts = await p.evaluate(() => ({ a: (DB.airlines || []).length, v: (DB.vendors || []).length }));
  if (counts.a === 5 && counts.v === 4) ok('seeded reference data loaded from the workspace blob: 5 airlines, 4 providers');
  else fail('seed missing — airlines ' + counts.a + ', providers ' + counts.v);

  // ---- every drill-down, EN + AR
  const seen = {};
  for (const lang of ['en', 'ar']) {
    await setLang(lang);
    const steps = [
      ['airlines list', () => { openSup = null; current = 'airlines'; render(); }, /QA National Carrier/],
      ['airline detail', () => { openSupFn('air', 'air_qa1'); }, /QA National Carrier/],
      ['airline dashboard', () => { supView = 'dash'; render(); }, /QA National Carrier/],
      ['providers list', () => { openSup = null; current = 'vendors'; render(); }, /QA Global GDS/],
      ['provider detail', () => { openSupFn('prov', 'ven_qa1'); }, /QA Global GDS/],
      ['provider dashboard', () => { supView = 'dash'; render(); }, /QA Global GDS/],
    ];
    for (const [name, fn, must] of steps) {
      await p.evaluate(fn); await p.waitForTimeout(500);
      const t = await text(); seen[lang + ':' + name] = await textAll();
      const b1 = bad(t);
      if (must.test(t) && !b1.length) ok(lang.toUpperCase() + ' ' + name + ': renders the record, no undefined/NaN');
      else fail(lang.toUpperCase() + ' ' + name + ': record ' + must.test(t) + ', bad tokens ' + JSON.stringify(b1.slice(0, 4)));
    }
  }

  // ---- Arabic chrome on the drill-downs (whole-string dictionary hits)
  const arMust = [
    ['airline detail', ['← رجوع', 'مخزون التذاكر', 'مزوّدو المحتوى', 'قواعد الإصدار والأسعار', 'مهلة الإبطال']],
    ['airline dashboard', ['← العودة إلى شركات الطيران', 'تفعيل NDC — حسب المصدر', 'قواعد الإصدار', 'حجم الحجوزات (منعكس)', 'مخاطر ADM']],
    ['provider detail', ['من أين نحصل على التوفر', 'مدير الحساب', 'التكلفة لكل حجز', 'بوابة الحجز / الوكيل']],
    ['provider dashboard', ['← العودة إلى الموردين', 'مصفوفة إمكانات الخدمة', 'حالة API', 'الحجم الموجَّه (منعكس)']],
  ];
  for (const [name, words] of arMust) {
    const t = seen['ar:' + name] || '';
    const missing = words.filter((w) => t.indexOf(w) < 0);
    if (!missing.length) ok('AR ' + name + ': chrome translated (' + words.length + ' labels checked)');
    else fail('AR ' + name + ': still English — missing ' + JSON.stringify(missing));
  }
  const leftovers = ['Back to airlines', 'Ticketing rules', 'Ticket stock', 'Servicing capability matrix', 'Account manager', 'Content providers', 'Cost per booking', 'Dashboard view', 'Where we get availability'];
  const leak = leftovers.filter((w) => ['airline detail', 'airline dashboard', 'provider detail', 'provider dashboard'].some((n) => (seen['ar:' + n] || '').indexOf(w) >= 0));
  if (!leak.length) ok('AR drill-downs: none of the known English chrome labels survive');
  else fail('AR drill-downs still show English chrome: ' + JSON.stringify(leak));

  // ---- capability flags: plain labels, and a click persists (still in AR — the flags translate too)
  await p.evaluate(() => { openSup = null; current = 'vendors'; render(); openSupFn('prov', 'ven_qa1'); supView = 'dash'; render(); }); await p.waitForTimeout(500);
  await setLang('en'); await p.evaluate(() => render()); await p.waitForTimeout(500);
  // the dashboard renders the matrix twice (its own card + the commercial card) — compare the distinct labels in order
  const caps = await p.evaluate(() => [...new Set([...document.querySelectorAll('#view button')].filter((x) => (x.getAttribute('onclick') || '').indexOf('setCap(') >= 0).map((x) => x.textContent.replace(/^✓\s*/, '').trim()))]);
  const expectCaps = ['Book', 'Reissue', 'Refund', 'EMD', 'Seats', 'Bags', 'Split PNR'];
  if (JSON.stringify(caps) === JSON.stringify(expectCaps)) ok('capability flags read as plain flags: ' + caps.join(' / '));
  else fail('capability flags mislabeled: ' + JSON.stringify(caps) + ' (a flag must never read like a money action)');
  const before = await p.evaluate(() => !!(DB.vendors.find((x) => x.id === 'ven_qa1').caps || {}).Refund);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find((x) => (x.getAttribute('onclick') || '').indexOf("setCap('ven_qa1','Refund'") >= 0); b.click(); });
  await p.waitForTimeout(2500);
  const d1 = await blob();
  const stored = !!(((d1.vendors || []).find((x) => x.id === 'ven_qa1') || {}).caps || {}).Refund;
  if (stored === !before) ok('clicking the Refund flag persisted to the workspace (was ' + before + ', now ' + stored + ')');
  else fail('Refund flag click did not persist — workspace says ' + stored + ', expected ' + !before);

  // ---- NDC status changed in Arabic stores the English keyword
  await setLang('ar');
  await p.evaluate(() => { openSup = null; current = 'airlines'; render(); openSupFn('air', 'air_qa1'); supView = 'dash'; render(); }); await p.waitForTimeout(600);
  const picked = await p.evaluate(() => { const sel = [...document.querySelectorAll('#view select')].find((s) => (s.getAttribute('onchange') || '').indexOf("setNdc('air_qa1','Amadeus','status'") >= 0); if (!sel) return null; const opt = [...sel.options].find((o) => o.value === 'Pending'); if (!opt) return 'no-pending:' + [...sel.options].map((o) => o.value).join(','); sel.value = 'Pending'; sel.dispatchEvent(new Event('change')); return 'ok'; });
  await p.waitForTimeout(2500);
  const d2 = await blob();
  const st = ((((d2.airlines || []).find((x) => x.id === 'air_qa1') || {}).ndc || {}).Amadeus || {}).status;
  if (picked === 'ok' && st === 'Pending') ok('NDC status changed in Arabic stored the English keyword "Pending" (data stays data)');
  else fail('NDC status in Arabic: picked=' + picked + ', stored=' + JSON.stringify(st) + ' — an Arabic word here would break ndcActive() counts');
  await setLang('en');

  // ---- friendly addresses (the router accepted /providers but no such view existed → Today)
  for (const [path, want, mustText] of [['/providers', 'vendors', /QA Global GDS/], ['/operations', 'ops', /./]]) {
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(5000);
    const cur = await p.evaluate(() => (typeof current !== 'undefined' ? current : null));
    const t = await text();
    if (cur === want && mustText.test(t) && !/Nothing urgent right now|لا شيء عاجل/.test(t)) ok(path + ' opens the ' + want + ' page');
    else fail(path + ' landed on "' + cur + '" (' + t.slice(0, 60).replace(/\n/g, ' / ') + ')');
  }

  // ---- phone
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  for (const [name, fn] of [['airlines list', () => { openSup = null; current = 'airlines'; render(); }], ['airline dashboard', () => { openSupFn('air', 'air_qa1'); supView = 'dash'; render(); }], ['providers list', () => { openSup = null; current = 'vendors'; render(); }], ['provider dashboard', () => { openSupFn('prov', 'ven_qa1'); supView = 'dash'; render(); }]]) {
    await p.evaluate(fn); await p.waitForTimeout(500);
    const over = await overflow();
    if (!over) ok('phone ' + name + ': no horizontal overflow');
    else fail('phone ' + name + ': page scrolls sideways');
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nreference-pages OK — Airlines and Providers hold past the list, in both languages, on a phone');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
