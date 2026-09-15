/* probe-proposal-editor-arabic.mjs — guards the 2026-09-15 (fire #55) bilingual edits to the proposal editor
   (core-04 offerEditor: the "load a client's deal" option, the agency-only cost/commission/margin note, the
   fare-options summary; core-06 v18 bundle-templates panel: heading, hint, "items · freebies", "Option 1",
   "Apply", the tiered-pricing hint). Found live by eye: all of it was English on the Arabic page.
   Creates one proposal IN THE MOCK (newOffer), opens it in EN (asserts the English wording is still there),
   then in AR (asserts each English fragment is gone and its Arabic wording present), no JS errors.
   Sabotage-tested: with the two core edits stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-proposal-editor-arabic.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9042; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
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
await p.goto(BASE + '/offers', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof newOffer === 'function' && typeof DB !== 'undefined', { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2500);
const EN = ["Load a corporate client's negotiated deal", 'Agency only:', 'Commission', 'Margin:', 'Fare options — compare 2–3 fares', 'reusable service bundles', 'Save any option as a template', 'Per-option tiered pricing'];
const AR = ['تحميل اتفاقية عميل مؤسسي', 'للوكالة فقط:', 'العمولة', 'الهامش:', 'خيارات الأسعار — قارن', 'باقات خدمات قابلة لإعادة الاستخدام', 'احفظ أي خيار كقالب', 'التسعير المتدرج لكل خيار'];
const read = () => p.evaluate(() => ({ lang: LANG, text: (document.getElementById('view').innerText || '').replace(/\s+/g, ' '), html: document.getElementById('view').innerHTML, hasEditor: !!document.querySelector('#view #of_subject, #view [id^="of_"]') }));
await p.evaluate(() => { current = 'offers'; openOffer = null; render(); newOffer(); }); await p.waitForTimeout(1500);
const en = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(1500);
await p.evaluate(() => { current = 'offers'; render(); }); await p.waitForTimeout(1200);
const ar = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const enMissing = EN.filter((s) => !(en.text.includes(s) || en.html.includes(s)));
const arLeft = EN.filter((s) => ar.text.includes(s) || ar.html.includes(s));
const arMissing = AR.filter((s) => !(ar.text.includes(s) || ar.html.includes(s)));
const checks = [
  ['a proposal editor is open in EN', en.lang === 'en' && en.hasEditor],
  ['EN editor still carries every English label (' + EN.length + ')', enMissing.length === 0],
  ['AR editor: none of the English labels remain', ar.lang === 'ar' && arLeft.length === 0],
  ['AR editor: every Arabic label present', arMissing.length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ enMissing, arLeft, arMissing, enLang: en.lang, arLang: ar.lang, hasEditor: en.hasEditor })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
