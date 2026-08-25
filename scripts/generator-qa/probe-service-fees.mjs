/* Generator probe #3 — the Service-Fee Proposal tab (family SFP) on the engine.

   What it proves:
   1. Static: js/68 contains no copied brand hex, never mentions localStorage, and
      carries the standard T&C string VERBATIM (EN and AR).
   2. The fees tab renders through the js/66 seam (form + A4 preview under
      data-identity="classic") with cover / About / fee / closing pages.
   3. The About page shows company_identity rows flagged show_on_documents.
   4. Scenario seeding: picking the dual-rate scenario fills the editor's sections
      and rows and turns the second fee column on (proved via __sfProbe).
   5. Dual-column rendering: both custom bilingual headers appear in the table.
   6. FREE rows render FREE/مجاناً; a "Total"-flagged row carries the all-inclusive
      annotation in both languages.
   7. The verbatim T&C text and the SLA lines render on the pages.
   8. Draft save POSTs to generated_documents with family SFP, status draft and NO
      doc_number (numbering is server-side, issue-time only).
   9. Runtime: no localStorage.setItem call originates from js/68. No js errors.
   Fixture data is synthetic (D4: nothing real in the repo).

   Run:            node scripts/generator-qa/probe-service-fees.mjs
   Sabotage test:  node scripts/generator-qa/probe-service-fees.mjs --sabotage
                   (serves a copy whose js/68 T&C string says "include VAT" instead
                    of "exclude VAT" — a real client-facing money defect; the probe
                    MUST exit 1, and the wrapper inverts that so success prints PASS) */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from '../qa/mock-supabase.mjs';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const SABOTAGE = process.argv.includes('--sabotage');

const TC_EN = 'All listed fees exclude VAT · per person, per ticket, document or visa · fees cover our service fees only, excluding embassy/consulate/shipping/hotel/airline fees (unless a line is marked Total).';

if (SABOTAGE) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-sab-'));
  fs.cpSync(REPO + '/index.html', tmp + '/index.html');
  fs.cpSync(REPO + '/js', tmp + '/js', { recursive: true });
  fs.cpSync(REPO + '/brand', tmp + '/brand', { recursive: true });
  const f = tmp + '/js/68-service-fees-tab.js';
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('exclude VAT')) { console.log('FAIL  sabotage setup: T&C string not found to corrupt'); process.exit(1); }
  fs.writeFileSync(f, src.replace('exclude VAT', 'include VAT'));
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, APP_DIR: tmp }, stdio: 'pipe', encoding: 'utf8' });
  const failedAsItShould = r.status !== 0;
  console.log(failedAsItShould
    ? 'PASS  sabotage: with the T&C corrupted ("include VAT") the probe exits non-zero (the verbatim check really checks)'
    : 'FAIL  sabotage: the probe still passed with corrupted terms — it is not actually checking');
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
  const src = fs.readFileSync(APP + '/js/68-service-fees-tab.js', 'utf8');
  const hexes = ['F06820', 'F87020', 'F47A1F', 'FBAE16', 'E54525', 'F26721', 'FF6C00', '323E49', '303848'];
  const found = hexes.filter(h => new RegExp(h, 'i').test(src));
  check('js/68 contains no copied brand hex', found.length === 0, 'found: ' + found.join(','));
  check('js/68 never mentions localStorage', !/localStorage/.test(src));
  check('js/68 carries the standard T&C EN string verbatim', src.includes(TC_EN));
  check('js/68 carries the AR T&C (ex-VAT, service fees only)',
    src.includes('غير شاملة ضريبة القيمة المضافة') && src.includes('رسوم خدماتنا فقط'));
}

/* live page */
const PORT = 8873; process.env.APP_DIR = APP; start(PORT); const BASE = 'http://localhost:' + PORT;
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
  { key: 'legal_name', category: 'legal', label_en: 'Legal name', label_ar: 'الاسم القانوني', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار', show_on_documents: true, sensitive: false, sort: 1 },
  { key: 'cr_number', category: 'legal', label_en: 'CR number', label_ar: 'السجل التجاري', value_en: '9999999999', value_ar: null, show_on_documents: true, sensitive: false, sort: 2 },
  { key: 'vat_number', category: 'tax', label_en: 'VAT number', label_ar: 'الرقم الضريبي', value_en: '399999999900003', value_ar: null, show_on_documents: true, sensitive: false, sort: 3 },
  { key: 'iata_number', category: 'membership', label_en: 'IATA', label_ar: 'اياتا', value_en: 'QA-IATA-000', value_ar: null, show_on_documents: true, sensitive: false, sort: 4 },
  { key: 'secret_iban', category: 'banking', label_en: 'IBAN', label_ar: 'آيبان', value_en: 'SA00SECRET', value_ar: null, show_on_documents: false, sensitive: true, sort: 5 },
  { key: 'website', category: 'contact', label_en: 'Website', label_ar: 'الموقع', value_en: 'www.example.test', value_ar: null, show_on_documents: true, sensitive: false, sort: 6 },
  { key: 'email', category: 'contact', label_en: 'Email', label_ar: 'البريد', value_en: 'qa@example.test', value_ar: null, show_on_documents: true, sensitive: false, sort: 7 },
  { key: 'phone_licence', category: 'contact', label_en: 'Phone', label_ar: 'الهاتف', value_en: '000 000 0000', value_ar: null, show_on_documents: true, sensitive: false, sort: 8 },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IDENTITY) }));

/* scenarios fixture mirrors the real seeded table's SHAPE with synthetic-safe rows */
const SCENARIOS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', name_en: 'Flat corporate rates', name_ar: 'رسوم موحدة للشركات', sort: 1,
    columns: [{ header_en: 'Fee (SAR)', header_ar: 'الرسوم (ريال)' }],
    rows: [{ title_en: 'Flights', title_ar: 'الطيران', rows: [
      { svc_en: 'Domestic flight booking', svc_ar: 'حجز طيران داخلي', fees: [25] },
      { svc_en: 'International flight booking', svc_ar: 'حجز طيران دولي', fees: [30] }] }] },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', name_en: 'Dual rate — company / employee', name_ar: 'تسعيرة مزدوجة — الشركة / الموظف', sort: 2,
    columns: [{ header_en: 'Company rate', header_ar: 'سعر الشركة' }, { header_en: 'Employee rate', header_ar: 'سعر الموظف' }],
    rows: [{ title_en: 'Flights', title_ar: 'الطيران', rows: [
      { svc_en: 'Domestic flight booking', svc_ar: 'حجز طيران داخلي', fees: [15, 20] },
      { svc_en: 'Seat selection', svc_ar: 'اختيار المقاعد', fees: [0, 0], free: true }] },
      { title_en: 'Hotels', title_ar: 'الفنادق', rows: [
      { svc_en: 'Hotel reservation', svc_ar: 'حجز فندقي', fees: [20, 30] }] }] },
  { id: 'aaaaaaaa-0000-0000-0000-000000000003', name_en: 'Visa service packages', name_ar: 'باقات خدمات التأشيرات', sort: 3,
    columns: [{ header_en: 'Fee (SAR)', header_ar: 'الرسوم (ريال)' }],
    rows: [{ title_en: 'Visa service packages', title_ar: 'باقات خدمات التأشيرات', rows: [
      { svc_en: 'Silver package — response within 8 working hours', svc_ar: 'الباقة الفضية — الرد خلال 8 ساعات عمل', fees: [149] }] }] },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/service_fee_scenarios**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SCENARIOS) }));

let draftPost = null;
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/generated_documents**', async r => {
  const rq = r.request();
  if (rq.method() === 'POST') {
    try { draftPost = JSON.parse(rq.postData() || 'null'); } catch (_) { draftPost = { parseError: true }; }
    const row = Object.assign({ id: '22222222-3333-4444-5555-666666666666', created_at: new Date().toISOString() },
      Array.isArray(draftPost) ? draftPost[0] : draftPost);
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await p.goto(BASE + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(2500);
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);
await p.evaluate(() => { window.__userRole = window.__userRole || 'admin'; current = 'documents'; render(); });
await p.waitForTimeout(1500);

/* open the fees tab through the real tab button */
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('#dgWrap .dg-tabs button')].find(x => /Service-Fee Proposal|عرض رسوم الخدمات/.test(x.textContent));
  if (btn) btn.click();
});
await p.waitForTimeout(1800);

/* 2 — the tab renders */
check('fees tab renders through the seam (form present)', await p.evaluate(() => !!document.querySelector('#sfWrap .sf-form')));
check('A4 preview renders under data-identity="classic"', await p.evaluate(() =>
  !!document.querySelector('#sfPreviewCol[data-identity="classic"] .sf-page')));
check('deck has 5 pages (cover, About, fees, commitments, back-cover)', await p.evaluate(() =>
  document.querySelectorAll('#sfPages .sf-page').length === 5),
  'got ' + await p.evaluate(() => document.querySelectorAll('#sfPages .sf-page').length));
check('unissued proposal carries the diagonal DRAFT watermark', await p.evaluate(() =>
  !!document.querySelector('#sfPages .sf-wm span')));

/* — real-design cover / closing / footer (2026-08-25 redesign) — */
{
  const cover = await p.evaluate(() => {
    const pg = document.querySelector('#sfPages .sf-page');
    return { grad: !!pg && pg.classList.contains('grad'), cvr: !!pg && !!pg.querySelector('.sf-cvr'),
      qr: !!pg && !!pg.querySelector('img[src*="direct_qr"]'),
      logo: !!pg && !!pg.querySelector('img[src*="direct_logo_white"]'), txt: pg ? pg.innerText : '' };
  });
  check('cover is the full-bleed brand cover (grad + .sf-cvr + white logo + QR)',
    cover.grad && cover.cvr && cover.logo && cover.qr);
  check('cover carries NO proposal-number label and NO date',
    !/Proposal no\.|رقم العرض|Valid until|صالح حتى/.test(cover.txt) && !/\d{4}-\d{2}-\d{2}/.test(cover.txt),
    'cover text: ' + cover.txt.slice(0, 120));
  check('closing back-cover exists (last page: full-bleed, white logo, QR)', await p.evaluate(() => {
    const pgs = [...document.querySelectorAll('#sfPages .sf-page')];
    const pg = pgs[pgs.length - 1];
    return !!pg && pg.classList.contains('grad') && !!pg.querySelector('.sf-cvr') &&
      !!pg.querySelector('img[src*="direct_logo_white"]') && !!pg.querySelector('img[src*="direct_qr"]');
  }));
  const all = await p.evaluate(() => document.getElementById('sfPages')?.innerText || '');
  check('footer legal block: trade name + unified no. + licence no.',
    all.includes('شركة المسافر المباشر للسفر والسياحة') && all.includes('700782406') && all.includes('7310322'));
  check('footer carries the branches line',
    all.includes('You can visit our branches in Riyadh – Jeddah – Buraydah – Dammam'));
}

/* 3 — About page shows show_on_documents identity rows, never the sensitive one */
{
  const txt = await p.evaluate(() => document.getElementById('sfPages')?.innerText || '');
  check('About page shows the CR from company_identity', txt.includes('9999999999'));
  check('About page shows the IATA number', txt.includes('QA-IATA-000'));
  check('rows NOT flagged show_on_documents never appear (sensitive IBAN)', !txt.includes('SA00SECRET'));
  check('SLA lines render (3 hours / 24 hours / 24-7)',
    /within 3 hours|خلال 3 ساعات/.test(txt) && /24 hours|خلال 24 ساعة/.test(txt) && /24\/7/.test(txt));
  check('signature block renders both parties', /For Direct|عن دايركت/.test(txt) && /For the client|عن العميل/.test(txt));
}

/* 4 — scenario picker seeds the editor */
check('scenario picker lists the three seeded scenarios', await p.evaluate(() =>
  /Flat corporate rates/.test(document.body.innerHTML) && /Dual rate/.test(document.body.innerHTML) && /Visa service packages/.test(document.body.innerHTML)));
await p.evaluate(() => sfSeed('aaaaaaaa-0000-0000-0000-000000000002'));
await p.waitForTimeout(900);
const sp = await p.evaluate(() => window.__sfProbe ? __sfProbe() : null);
check('seed probe exists', !!sp);
if (sp) {
  check('dual scenario seeded 2 sections into the editor', sp.sections === 2, 'got ' + JSON.stringify(sp));
  check('dual scenario seeded 3 editable rows', sp.rows === 3, 'got ' + JSON.stringify(sp));
  check('dual scenario turned the second fee column on', sp.col2 === true);
}

/* 5 — dual-column rendering + FREE */
{
  const txt = await p.evaluate(() => document.getElementById('sfPages')?.innerText || '');
  /* app css uppercases th via text-transform, so innerText comes back uppercased */
  check('dual headers render (Company rate / Employee rate)', /company rate/i.test(txt) && /employee rate/i.test(txt));
  check('fee=0 + free flag renders FREE', /FREE/.test(txt));
  check('fee values render in the table (15 / 20)', /\b15\b/.test(txt) && /\b20\b/.test(txt));
}

/* AR versions of the key strings */
await p.evaluate(() => sfLang('ar'));
await p.waitForTimeout(900);
{
  const txt = await p.evaluate(() => document.getElementById('sfPages')?.innerText || '');
  check('AR dual headers render (سعر الشركة / سعر الموظف)', txt.includes('سعر الشركة') && txt.includes('سعر الموظف'));
  check('AR FREE renders as مجاناً', txt.includes('مجاناً'));
  check('AR T&C renders (غير شاملة ضريبة القيمة المضافة)', txt.includes('غير شاملة ضريبة القيمة المضافة'));
  check('AR fees page title reads عرض رسوم خدمة (real deck wording)', txt.includes('عرض رسوم خدمة'));
  check('AR page direction is RTL', await p.evaluate(() =>
    !![...document.querySelectorAll('#sfPages .sf-page.ar')].length));
}
await p.evaluate(() => sfLang('en'));
await p.waitForTimeout(700);

/* 6 — Total flag annotation */
await p.evaluate(() => sfRowSet(0, 0, 'total', true));
await p.waitForTimeout(700);
{
  const txt = await p.evaluate(() => document.getElementById('sfPages')?.innerText || '');
  check('Total-flagged row carries "(Total — includes all charges)"', txt.includes('(Total — includes all charges)'));
  check('T&C renders VERBATIM on the fee page', txt.includes(TC_EN));
}

/* 7 — draft save goes to generated_documents, family SFP, no client-side number */
await p.evaluate(() => {
  const b = [...document.querySelectorAll('#sfBar button')].find(x => /Save draft|حفظ المسودة/.test(x.textContent));
  if (b) b.click();
});
await p.waitForTimeout(1500);
check('draft save POSTed to generated_documents', !!draftPost);
if (draftPost) {
  const body = Array.isArray(draftPost) ? draftPost[0] : draftPost;
  check('POST body: family is SFP', body.family === 'SFP');
  check('POST body: status is draft', body.status === 'draft');
  check('POST body: NO doc_number on a draft (numbering is issue-time, server-side)', body.doc_number == null);
  check('POST body: payload carries the seeded sections', !!body.payload && Array.isArray(body.payload.sections)
    && body.payload.sections.length === 2);
}

/* 8 — nothing in js/68 ever writes localStorage; no js errors */
const ls = await p.evaluate(() => (window.__lsWrites || []).filter(x => x.stack.includes('68-service-fees')));
check('no localStorage.setItem call originates from js/68', ls.length === 0,
  ls.slice(0, 2).map(x => x.key).join(','));
check('no javascript errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
