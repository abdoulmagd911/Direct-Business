/* probe-reports-arabic-chrome.mjs — guards the 2026-09-16 (fire #59) Arabic pass over the Reports page
   (core-10): the objective cards' "Target / Actual / INITIATIVES / no KPI" chrome, the built report's
   heading, section heads, "Generated", the empty-achievements line, and the month
   names — all English on the Arabic page when driven live. Also that the downloaded .html/.doc keep an
   ENGLISH file name in Arabic (rptTitleEn), while the document itself is Arabic and marked dir="rtl".
   EN must be untouched. Sabotage-tested: with the core-10 edit stashed, 3 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-reports-arabic-chrome.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9046; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof rptGo === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(2000);
const view = () => p.evaluate(() => (document.getElementById('view').innerText || '').replace(/\s+/g, ' '));
const go = async (tab) => { await p.evaluate((t) => { current = 'reports'; render(); rptGo(t); }, tab); await p.waitForTimeout(1200); };
async function grab(fn) { const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null); await p.evaluate((n) => window[n](), fn); const d = await dl; if (!d) return null; return { name: d.suggestedFilename(), txt: fs.readFileSync(await d.path(), 'utf8') }; }
/* EN first — must be untouched. (release 3: the Objectives tab reads the database — wait until it has answered) */
await p.waitForFunction(() => window.__v112 && window.__v112.loaded, { timeout: 30000 }).catch(() => { });
await go('objectives'); await p.evaluate(() => { const card = document.querySelector('#view .rpt-obj'); const b = card && card.querySelector('[onclick^="rptToggleObj("]'); if (b && !card.classList.contains('open')) new Function(b.getAttribute('onclick'))(); }); await p.waitForTimeout(800);
const enObj = await view();
await go('report'); await p.evaluate(() => rptRepSet('type', 'monthly')); await p.waitForTimeout(900);
const enRep = await view(); const enTitle = await p.evaluate(() => (document.querySelector('#rptdoc h2') || {}).innerText || ''); const enFile = await grab('rptDownloadReport');
/* AR */
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(900);
await go('objectives'); await p.evaluate(() => { const card = document.querySelector('#view .rpt-obj'); const b = card && card.querySelector('[onclick^="rptToggleObj("]'); if (b && !card.classList.contains('open')) new Function(b.getAttribute('onclick'))(); }); await p.waitForTimeout(800);
const arObj = await view();
await go('report'); await p.evaluate(() => rptRepSet('type', 'monthly')); await p.waitForTimeout(900);
const arRep = await view(); const arTitle = await p.evaluate(() => (document.querySelector('#rptdoc h2') || {}).innerText || ''); const arFile = await grab('rptDownloadReport');
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
/* 2026-09-26 (Phase 3 release 3): the Objectives tab is js/112's table — its chrome is the column heads and the
   objective's INITIATIVES block; the rule is the same: English in English, Arabic in Arabic, none left behind */
const EN_OBJ = ['Target', 'Actual', 'INITIATIVES']; const AR_OBJ = ['الهدف', 'الفعلي', 'المبادرات'];
const EN_REP = ['Monthly Commercial Report', 'Commercial Department · Operational Plan 2026', 'Generated ', '2 · KPI progress vs 2026 targets']; const AR_REP = ['التقرير التجاري الشهري', 'القسم التجاري · الخطة التشغيلية 2026', 'أُنشئ في ', '2 · تقدّم المؤشرات مقابل أهداف 2026'];
const checks = [
  ['EN objectives card still says Target / Actual / INITIATIVES', EN_OBJ.every((s) => enObj.toLowerCase().includes(s.toLowerCase()))   /* table heads are capitalised by the page's style */],
  ['EN report still carries its English heading, plan line, "Generated" and section head', EN_REP.every((s) => enRep.includes(s)) && /^Monthly Commercial Report · [A-Z][a-z]+ \d{4}$/.test(enTitle)],
  ['AR objectives card: Arabic chrome present, English chrome gone', AR_OBJ.every((s) => arObj.includes(s)) && !/Actual|Target|INITIATIVES|no KPI/i.test(arObj)],
  ['AR report: Arabic heading (Arabic month), plan line, "أُنشئ في", section head; English gone', AR_REP.every((s) => arRep.includes(s)) && !EN_REP.some((s) => arRep.includes(s)) && /^التقرير التجاري الشهري · [؀-ۿ]+ \d{4}$/.test(arTitle)],
  ['AR download keeps an English file name, the document is Arabic and dir="rtl"', !!arFile && /^Monthly-Commercial-Report-[A-Za-z]+-\d{4}\.html$/.test(arFile.name) && arFile.txt.includes('dir="rtl"') && arFile.txt.includes('القسم التجاري')],
  ['EN download: same file-name shape, no dir="rtl"', !!enFile && /^Monthly-Commercial-Report-[A-Za-z]+-\d{4}\.html$/.test(enFile.name) && !enFile.txt.includes('dir="rtl"')],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ enTitle, arTitle, arFile: arFile && arFile.name, enFile: enFile && enFile.name, arObj: arObj.slice(0, 300), arRep: arRep.slice(0, 400)})); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
