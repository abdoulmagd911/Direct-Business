/* Generator probe #6 — the Tender pair tab (families TEC + FIN) on the engine.

   What it proves:
   1. Static: js/71 contains no copied brand hex, never mentions localStorage,
      never mentions the excluded vendors (M2), registers families TEC/FIN only,
      and REUSES js/67's amount-in-words (no duplicated wordsEN/wordsAR).
   2. The 6th tab is registered: the tab bar shows 6 buttons and the
      /documents/tender deep link opens the tender tab through the seam.
   3. AR is the DEFAULT document language and renders strict RTL; the DRAFT
      watermark shows on unissued documents.
   4. CRITICAL INVARIANT: the TECHNICAL document contains NO prices anywhere —
      the fixture unit-price and line-amount strings are ABSENT from the
      technical innerText and PRESENT in the financial innerText for the SAME
      BoQ (sabotage mode makes the technical renderer print prices; the probe
      must then exit non-zero).
   5. The Technical/Financial toggle switches documents.
   6. The 4-phase work plan renders (real anatomy, pre-seeded).
   7. Amounts in words EN+AR for a known total; VAT 15% math; payment schedule
      renders; the fee formula is present VERBATIM in the financial document.
   8. Past-projects section is PRESENT by default (owner ruling 25 Aug); certificates
      index lists proof documents as "attached: <label>".
   9. Draft save POSTs TWO rows — family TEC and family FIN — sharing
      payload.tender_ref, both with NO doc_number (numbering is issue-time,
      server-side).
  10. BOTH Issue buttons carry data-v21relabeled; no localStorage writes from
      js/71; no js errors; no Takamol/Techtic anywhere in the rendered pages.
   Fixture data is synthetic (D4: nothing real in the repo).

   Run:            node scripts/generator-qa/probe-tender.mjs
   Sabotage test:  node scripts/generator-qa/probe-tender.mjs --sabotage
                   (serves a copy whose TECHNICAL BoQ renderer prints the
                    price column — the no-prices invariant is broken; the
                    probe MUST exit 1, and the wrapper inverts that to PASS) */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from '../qa/mock-supabase.mjs';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const SABOTAGE = process.argv.includes('--sabotage');

if (SABOTAGE) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'td-sab-'));
  fs.cpSync(REPO + '/index.html', tmp + '/index.html');
  fs.cpSync(REPO + '/js', tmp + '/js', { recursive: true });
  fs.cpSync(REPO + '/brand', tmp + '/brand', { recursive: true });
  const f = tmp + '/js/71-tender-tab.js';
  const src = fs.readFileSync(f, 'utf8');
  const needle = "return '<tr><td>'+(i+1)+'</td><td class=\"svc\">'+esc(svc)+'</td><td>'+esc(r.unit||'—')+'</td><td>'+esc(String(r.qty||''))+'</td></tr>';";
  if (!src.includes(needle)) { console.log('FAIL  sabotage setup: technical BoQ row marker not found to corrupt'); process.exit(1); }
  /* corrupt the INVARIANT: the technical BoQ now prints prices */
  fs.writeFileSync(f, src.split(needle).join(
    "return '<tr><td>'+(i+1)+'</td><td class=\"svc\">'+esc(svc)+'</td><td>'+esc(r.unit||'—')+'</td><td>'+esc(String(r.qty||''))+'</td><td class=\"amt\">'+(r.price===''?'—':fmt(Number(r.price)))+'</td><td class=\"amt\">'+(isFinite(lineAmount(r))?fmt(lineAmount(r)):'—')+'</td></tr>';"
  ));
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, APP_DIR: tmp }, stdio: 'pipe', encoding: 'utf8' });
  const failedAsItShould = r.status !== 0;
  console.log(failedAsItShould
    ? 'PASS  sabotage: with the technical document rendering BoQ prices the probe exits non-zero (the no-prices invariant is really checked)'
    : 'FAIL  sabotage: the probe still passed while the technical document showed prices — it is not actually checking');
  process.exit(failedAsItShould ? 0 : 1);
}

const APP = process.env.APP_DIR || REPO;

let failed = 0, passed = 0;
const check = (label, ok, detail = '') => {
  ok ? passed++ : failed++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (ok || !detail ? '' : '  → ' + detail));
};

/* 1 — static scans */
{
  const src = fs.readFileSync(APP + '/js/71-tender-tab.js', 'utf8');
  const hexes = ['F06820', 'F87020', 'F47A1F', 'FBAE16', 'E54525', 'F26721', 'FF6C00', '323E49', '303848'];
  const found = hexes.filter(h => new RegExp(h, 'i').test(src));
  check('js/71 contains no copied brand hex', found.length === 0, 'found: ' + found.join(','));
  check('js/71 never mentions localStorage', !/localStorage/.test(src));
  check('js/71 never mentions the excluded vendors (M2, static)', !/takamol|techtic|تكامل/i.test(src));
  check('js/71 registers families TEC and FIN only', /family:fam/.test(src) && /'TEC'/.test(src) && /'FIN'/.test(src) && !/family:'CTR'/.test(src) && !/family:'SFP'/.test(src));
  check('js/71 REUSES js/67 words (__poWordsProbe) and does not duplicate the algorithm',
    /__poWordsProbe/.test(src) && !/function wordsEN/.test(src) && !/AR_TEENS/.test(src));
}

/* live page */
const PORT = 8876; process.env.APP_DIR = APP; start(PORT); const BASE = 'http://localhost:' + PORT;
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 950 } });
await ctx.addInitScript(() => {
  window.__lsWrites = [];
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    try { window.__lsWrites.push({ key: String(k), stack: String(new Error().stack || '') }); } catch (_) {}
    return orig.apply(this, arguments);
  };
});
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push('js: ' + e.message));

/* the qa mock serves .css as text/plain; Chrome refuses text/plain stylesheets */
await p.route('**/brand/*.css', r => {
  const u = new URL(r.request().url());
  try { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(APP + u.pathname, 'utf8') }); }
  catch (e) { r.fulfill({ status: 404, body: '' }); }
});

/* catch-all supabase route FIRST — fixture REST routes registered AFTER it win */
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
  const rq = r.request(); const u = new URL(rq.url());
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body });
  } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route('**fonts.gstatic.com/**', r => r.abort());

/* synthetic fixtures only (D4) — registered AFTER the catch-all so they win */
const IDENTITY = [
  { key: 'legal_name', label_en: 'Legal name', label_ar: 'الاسم القانوني', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار للسفر', category: 'legal', proof_path: null, sensitive: false, sort: 1 },
  { key: 'cr_number', label_en: 'CR number', label_ar: 'السجل التجاري', value_en: '9999999999', value_ar: null, category: 'legal', proof_path: 'legal/cr.pdf', sensitive: false, sort: 2 },
  { key: 'vat_number', label_en: 'VAT number', label_ar: 'الرقم الضريبي', value_en: '399999999900003', value_ar: null, category: 'tax', proof_path: null, sensitive: false, sort: 3 },
  { key: 'website', label_en: 'Website', label_ar: 'الموقع', value_en: 'www.example.test', value_ar: null, category: 'contact', proof_path: null, sensitive: false, sort: 4 },
  { key: 'iata_licence', label_en: 'SYNTH IATA Licence', label_ar: 'رخصة اختبارية', value_en: 'IATA-000', value_ar: null, category: 'licence', proof_path: 'licence/iata.pdf', sensitive: false, sort: 5 },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IDENTITY) }));

const posts = [];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/generated_documents**', async r => {
  const rq = r.request();
  if (rq.method() === 'POST') {
    let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (_) { body = { parseError: true }; }
    const rec = Array.isArray(body) ? body[0] : body;
    posts.push(rec);
    const row = Object.assign({ id: 'aaaa000' + posts.length + '-1111-2222-3333-444444444444', created_at: new Date().toISOString() }, rec);
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

/* deep link straight to the 6th tab */
await p.goto(BASE + '/documents/tender', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(2500);
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);
await p.evaluate(() => { window.__userRole = window.__userRole || 'admin'; current = 'documents'; render(); });
await p.waitForTimeout(1800);

/* 2 — 6th tab registered + deep link works */
check('tab bar shows 6 tabs (tender added to TABS)', await p.evaluate(() =>
  document.querySelectorAll('#dgWrap .dg-tabs button').length === 6));
check('a tab button is labelled Tender / المناقصات', await p.evaluate(() =>
  [...document.querySelectorAll('#dgWrap .dg-tabs button')].some(x => /المناقصات/.test(x.textContent))));
check('/documents/tender deep link opens the tender tab', await p.evaluate(() =>
  window.__dgTabProbe && window.__dgTabProbe() === 'tender'));
check('tender tab renders through the seam (form present)', await p.evaluate(() => !!document.querySelector('#tdWrap .td-form')));
check('A4 preview renders under data-identity="classic"', await p.evaluate(() =>
  !!document.querySelector('#tdPreviewCol[data-identity="classic"] .td-page')));
check('unissued document carries the diagonal DRAFT watermark', await p.evaluate(() =>
  !!document.querySelector('#tdPages .td-wm span')));

/* 3 — AR default + strict RTL; technical is the default view */
check('AR is the default document language and the page is RTL', await p.evaluate(() => {
  const pg = document.querySelector('#tdPages .td-page');
  return window.__tdProbe().lang === 'ar' && !!pg && pg.classList.contains('ar') &&
    getComputedStyle(pg).direction === 'rtl';
}));
check('the TECHNICAL document is the default view', await p.evaluate(() =>
  window.__tdProbe().view === 'tec'));
{
  const txt = await p.evaluate(() => document.getElementById('tdPages')?.innerText || '');
  check('the 4-phase work plan renders pre-seeded (real anatomy)', (() => {
    const order = ['توقيع العقد وتحليل الاحتياج', 'توفير موظفين في مقر الجهة', 'تفعيل المنصة الإلكترونية', 'الخدمة المستمرة'];
    let last = -1;
    for (const o of order) { const i = txt.indexOf(o); if (i < 0 || i < last) return false; last = i; }
    return true;
  })(), 'phase order broken');
  check('the tender definition carries exactly 4 phases', await p.evaluate(() => window.__tdProbe().phases === 4));
  check('past-projects section is PRESENT by default (owner ruling 25 Aug; M2 exclusions still never appear)',
    (await p.evaluate(() => window.__tdProbe().pastProjectsOn === true)));
  check('certificates index lists proof documents as attached: <label>',
    txt.includes('الشهادات والمستندات الرسمية') && txt.includes('مرفق: رخصة اختبارية'));
}

/* 4 — the fixture tender: entity from records (leads allowed) + BoQ + schedule */
await p.evaluate(() => {
  try { DB.businesses = DB.businesses || []; DB.businesses.push({ id: 'qa-biz-1', name: 'Synthetic Entity HRC', nameAr: 'جهة اختبارية', isClient: false }); } catch (_) {}
  tdSet('clientId', 'qa-biz-1');
  tdSet('titleAr', 'مناقصة خدمات سفر اختبارية');
  tdItemSet('boq', 0, 'ar', 'تذاكر طيران اختبارية'); tdItemSet('boq', 0, 'en', 'SYNTH flight tickets');
  tdItemSet('boq', 0, 'unit', 'ticket'); tdItemSet('boq', 0, 'qty', '3'); tdItemSet('boq', 0, 'price', '1000');
  tdItem('boq', 'add');
  tdItemSet('boq', 1, 'ar', 'إقامة فندقية اختبارية'); tdItemSet('boq', 1, 'en', 'SYNTH hotel stay');
  tdItemSet('boq', 1, 'unit', 'night'); tdItemSet('boq', 1, 'qty', '2'); tdItemSet('boq', 1, 'price', '500');
  tdItemSet('schedule', 0, 'month', 'SYNTH-Month-1'); tdItemSet('schedule', 0, 'amount', '2000'); tdItemSet('schedule', 0, 'notes', 'first payment');
});
await p.waitForTimeout(900);
check('a lead (non-client) entity is selectable for a tender', await p.evaluate(() =>
  window.__tdProbe().clientId === 'qa-biz-1'));

/* 5 — CRITICAL INVARIANT: technical shows the BoQ but NO prices */
{
  const tec = await p.evaluate(() => document.getElementById('tdPages')?.innerText || '');
  check('technical view shows the BoQ items (unpriced table present)',
    tec.includes('تذاكر طيران اختبارية') && tec.includes('إقامة فندقية اختبارية') && tec.includes('جدول الكميات'));
  check('TECHNICAL CONTAINS NO PRICES: fixture unit prices absent (1,000.00 / 500.00)',
    !tec.includes('1,000.00') && !tec.includes('500.00'), 'a price leaked into the technical document');
  check('TECHNICAL CONTAINS NO PRICES: line amounts and totals absent (3,000.00 / 4,000.00 / 4,600.00)',
    !tec.includes('3,000.00') && !tec.includes('4,000.00') && !tec.includes('4,600.00'));
  check('technical never shows the VAT or subtotal rows',
    !tec.includes('ضريبة القيمة المضافة') && !tec.includes('المجموع (ريال)'));
}

/* 6 — the toggle switches to the FINANCIAL document */
await p.evaluate(() => tdView('fin'));
await p.waitForTimeout(900);
check('the Technical/Financial toggle switches documents (view=fin, title العرض المالي)', await p.evaluate(() =>
  window.__tdProbe().view === 'fin' && (document.getElementById('tdPages')?.innerText || '').includes('العرض المالي')));
{
  const fin = await p.evaluate(() => document.getElementById('tdPages')?.innerText || '');
  check('financial shows the SAME BoQ priced (unit prices + line amounts present)',
    fin.includes('تذاكر طيران اختبارية') && fin.includes('1,000.00') && fin.includes('3,000.00') && fin.includes('500.00'));
  check('VAT math: subtotal 4,000.00 → VAT 600.00 → total 4,600.00', await p.evaluate(() => {
    const t = window.__tdProbe();
    return Math.abs(t.subtotal - 4000) < 0.001 && Math.abs(t.vat - 600) < 0.001 && Math.abs(t.grand - 4600) < 0.001;
  }) && fin.includes('4,000.00') && fin.includes('600.00') && fin.includes('4,600.00'));
  check('total in words EN (reused js/67 algorithm)',
    fin.includes('Four thousand six hundred Saudi riyals only'));
  check('total in words AR (reused js/67 algorithm)',
    fin.includes('فقط أربعة آلاف وستمائة ريال لا غير'));
  check('per-line amount in words renders (3000 line)',
    fin.includes('فقط ثلاثة آلاف ريال لا غير'));
  check('monthly payment schedule renders (month / amount / notes)',
    fin.includes('جدول الدفعات الشهرية') && fin.includes('SYNTH-Month-1') && fin.includes('2,000.00') && fin.includes('first payment'));
  check('the fee formula is present VERBATIM in the financial document',
    fin.includes('كل دفعة = تكلفة الخدمة المطلوبة + رسوم الخدمة التعاقدية'));
  check('financial carries the official documents list page',
    fin.includes('الشهادات والمستندات الرسمية'));
  check('rendered pages never mention the excluded vendors (M2, dynamic)', !/takamol|techtic|تكامل/i.test(fin));
}

/* 7 — draft save: TWO rows (TEC + FIN) sharing tender_ref, no numbers */
await p.evaluate(() => tdSaveDraft());
await p.waitForTimeout(2000);
check('draft save POSTed TWO rows to generated_documents', posts.length === 2, 'posts=' + posts.length);
if (posts.length === 2) {
  const fams = posts.map(x => x.family).sort().join(',');
  check('POST bodies: one family TEC and one family FIN', fams === 'FIN,TEC', fams);
  check('POST bodies: both drafts carry NO doc_number (numbering is issue-time, server-side)',
    posts.every(x => x.doc_number == null && x.status === 'draft'));
  check('POST bodies: both rows share the same payload.tender_ref (the pair is linkable)',
    !!posts[0].payload && !!posts[1].payload &&
    typeof posts[0].payload.tender_ref === 'string' && posts[0].payload.tender_ref.length >= 32 &&
    posts[0].payload.tender_ref === posts[1].payload.tender_ref);
  check('POST bodies: both rows link the picked entity', posts.every(x => x.business_id === 'qa-biz-1'));
}

/* 8 — relabeler trap + storage + errors */
check('BOTH Issue buttons carry data-v21relabeled (core-06 relabeler trap)', await p.evaluate(() => {
  const btns = [...document.querySelectorAll('#tdWrap button')].filter(x => /إصدار العرض|Issue technical|Issue financial/.test(x.textContent));
  return btns.length === 2 && btns.every(b => b.getAttribute('data-v21relabeled') === 'true');
}));
const ls = await p.evaluate(() => (window.__lsWrites || []).filter(x => x.stack.includes('71-tender')));
check('no localStorage.setItem call originates from js/71', ls.length === 0,
  ls.slice(0, 2).map(x => x.key).join(','));
check('no javascript errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
