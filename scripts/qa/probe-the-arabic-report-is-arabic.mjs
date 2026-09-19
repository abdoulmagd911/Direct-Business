/* probe-the-arabic-report-is-arabic.mjs — the Reports page, and the 2026-09-20 (fire #112) fix in
   js/core/core-10.

   The owner's own pre-launch pass on 2026-08-21 gave every OBJECTIVE an Arabic title, and
   rptObjTitle() uses it. The 30 KPIs sitting under those objectives never got one — and nothing in
   the report looked for one either. So the Arabic report prints Arabic objective headings with
   English KPI lines beneath them: the half-English document a Saudi reader actually receives.

   The Arabic wording of a KPI is the owner's to write. It is his performance framework, and
   inventing Arabic for it here would be exactly the kind of guess this project does not make. What
   was fixed is the half that is code: every place a KPI title is printed — the report table, the
   picker, the shortfall list and the copy-out text — now asks for `tAr` first, the same way
   objectives do. Adding the Arabic text later is then a content edit and nothing else, and this
   probe proves it lands: it puts an Arabic title on one KPI and requires it on the generated
   report.

   Driven against the real database the same day. The report itself was checked while here and is
   honest: it prints the targets and leaves every actual as "—" rather than inventing a zero, and
   it carries no VAT anywhere — the M1 rule, checked with a word boundary because "private" and
   "innovation" both contain those letters and had already fooled one measurement this session.

   Sabotage-tested 2026-09-20: with the four KPI title call sites put back to the English field,
   1 check goes FAIL, exit 1 — the Arabic title never reaches the report.
   Run: node scripts/qa/probe-the-arabic-report-is-arabic.mjs                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9085; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];
const AR_KPI = 'مؤشر مترجم للاختبار';

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof window.rptKpiTitle === 'function' && Array.isArray(window.RPT_KPIS), { timeout: 120000 });
  await p.waitForTimeout(2500);

  /* the Arabic wording a KPI would carry, if the owner writes one */
  const seeded = await p.evaluate((ar) => {
    const k = (window.RPT_KPIS || [])[0]; if (!k) return null;
    k.tAr = ar;
    const other = (window.RPT_KPIS || [])[1];
    return { count: (window.RPT_KPIS || []).length, n: k.n, englishOfOther: other ? other.t : null };
  }, AR_KPI);

  await p.evaluate(() => { current = 'reports'; openLead = null; render(); });
  await p.waitForTimeout(2500);
  /* the objective titles live on the Overview, not on the generated document — read them there */
  const overview = await p.evaluate(() => {
    const t = ((document.getElementById('view') || {}).innerText || '');
    return { objAr: /زيادة الإيرادات من العقود التجارية|توسيع المشاركة في المناقصات/.test(t),
      objEn: /Increase revenue from commercial contracts|Expand participation in public and private tenders/.test(t) };
  });
  /* the KPI list on the Objectives & KPIs tab renders through a different line than the report —
     that is where the last English-only title was still hiding, so it is read here too */
  const kpiTab = await p.evaluate(() => {
    const b2 = [].slice.call(document.querySelectorAll('#view button'))
      .find((x) => /Objectives & KPIs|الأهداف والمؤشرات/.test(x.innerText || ''));
    if (b2) b2.click();
    return true;
  });
  await p.waitForTimeout(2000);
  /* the KPI lines sit inside an objective that has to be opened first */
  await p.evaluate(() => {
    if (document.querySelector('.rpt-kpirow')) return;
    const cands = [].slice.call(document.querySelectorAll('#view [onclick],#view summary,#view .rpt-obj,#view details'));
    for (const c of cands) { try { c.click(); } catch (_) { } if (document.querySelector('.rpt-kpirow')) return; }
  });
  await p.waitForTimeout(1600);
  const kpiTabText = await p.evaluate(() => {
    const t = ((document.getElementById('view') || {}).innerText || '');
    /* read the ROWS, not the page text: a container that is scrolled or collapsed gives an empty
       innerText while the nodes are plainly there — the lesson from fire #108 */
    const rowText = [].slice.call(document.querySelectorAll('.rpt-kpirow'))
      .map((r) => (r.textContent || '').replace(/\s+/g, ' ')).join(' | ');
    void t;
    return { rows: document.querySelectorAll('.rpt-kpirow').length,
      hasAr: rowText.indexOf('مؤشر مترجم للاختبار') >= 0,
      hasEn: /Improvement of suppliers contracts terms/.test(rowText) };
  });
  void kpiTab;
  await p.evaluate(() => { current = 'reports'; openLead = null; render(); });
  await p.waitForTimeout(1800);
  const built = await p.evaluate(() => {
    const btn = [].slice.call(document.querySelectorAll('#view button'))
      .find((x) => /Generate Report|إنشاء تقرير/.test(x.innerText || ''));
    if (btn) btn.click();
    return !!btn;
  });
  await p.waitForTimeout(3000);

  const out = await p.evaluate(() => {
    const t = ((document.getElementById('view') || {}).innerText || '');
    /* word-bounded on purpose: "private" and "innovation" contain those letters */
    const vat = (t.match(/\bVAT\b|ضريبة القيمة|الضريبة المضافة/g) || []).length;
    return { chars: t.length, vat,
      hasArKpi: t.indexOf('مؤشر مترجم للاختبار') >= 0,
      hasEnKpiOfSeeded: /Improvement of suppliers contracts terms/.test(t),
      dashedActuals: (t.match(/—/g) || []).length,
      zeroActuals: /(\bACTUAL\b|الفعلي)[^\n]{0,40}\b0\b/.test(t) };
  });
  await ctx.close();
  return { seeded, built, out, overview, kpiTabText };
}

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();
console.log('  AR report', JSON.stringify(ar.out), '· overview', JSON.stringify(ar.overview));
console.log('  EN report', JSON.stringify(en.out), '· overview', JSON.stringify(en.overview));

const checks = [
  ['the report really built, in both languages', ar.built && en.built && ar.out.chars > 800 && en.out.chars > 800],
  ['there are KPIs to talk about', ar.seeded && ar.seeded.count > 0, 'KPIs: ' + (ar.seeded ? ar.seeded.count : 'none')],
  ['the objective titles read in Arabic on the Arabic page — the owner\'s own 2026-08-21 pass still holds',
    ar.overview.objAr === true && ar.overview.objEn === false, JSON.stringify(ar.overview)],
  /* this pair is what caught the fix being incomplete: the shortfall list had switched to Arabic
     while the KPI table above it was still printing the English title of the very same KPI */
  ['a KPI given an Arabic title shows it on the Arabic report, so the translation is a content edit and nothing more',
    ar.out.hasArKpi === true],
  ['and its English title is then gone from the Arabic report — every place that prints it switched, not just one',
    ar.out.hasEnKpiOfSeeded === false, 'english still present: ' + ar.out.hasEnKpiOfSeeded],
  ['the English report is unaffected: it carries that KPI\'s English title and not the Arabic one',
    en.out.hasArKpi === false && en.out.hasEnKpiOfSeeded === true,
    JSON.stringify({ arabicLeaked: en.out.hasArKpi, englishPresent: en.out.hasEnKpiOfSeeded })],
  ['the KPI list on the Objectives tab switched too, not only the report',
    ar.kpiTabText.rows > 0 && ar.kpiTabText.hasAr === true && ar.kpiTabText.hasEn === false, JSON.stringify(ar.kpiTabText)],
  ['no VAT anywhere on the report, in either language — checked on the word, not on letters inside "private"',
    ar.out.vat === 0 && en.out.vat === 0, 'VAT mentions: AR ' + ar.out.vat + ' · EN ' + en.out.vat],
  ['an actual nobody has recorded is left as a dash, never filled in as a zero',
    en.out.dashedActuals > 0 && en.out.zeroActuals === false, JSON.stringify({ dashes: en.out.dashedActuals, zeros: en.out.zeroActuals })],
  ['building the report wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ ar, en }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
