/* Generator probe #2 — the Price Offer tab runs on the engine, not on localStorage.

   What it proves:
   1. Static: js/67 contains no copied brand hex and never mentions localStorage.
   2. The Documents page's Offer tab renders (form + A4 preview via the js/66 seam).
   3. Items math: subtotal + VAT(15%) = total, computed live from a typed price.
   4. Amount-in-words for a known value (115.00) in EN and AR, from the live page.
   5. Saving a draft POSTs to generated_documents with family OFR, status draft and
      NO doc_number (numbering is server-side, issue-time only) — the fixture REST
      route asserts the actual POST body.
   6. Runtime: nothing in js/67 ever calls localStorage.setItem (recorder proves it).
   7. No javascript errors.
   Fixture data is synthetic (D4: nothing real in the repo).

   Run:            node scripts/generator-qa/probe-price-offer.mjs
   Sabotage test:  node scripts/generator-qa/probe-price-offer.mjs --sabotage
                   (serves a copy whose js/67 has VAT silently changed to 30% — the
                    probe MUST exit 1; the wrapper inverts that so success prints PASS) */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from '../qa/mock-supabase.mjs';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const SABOTAGE = process.argv.includes('--sabotage');

if (SABOTAGE) {
  // broken copy: identical app, but js/67's VAT rate silently corrupted (a REAL money
  // defect) — then demand the probe FAILS on it (rule B7).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'po-sab-'));
  fs.cpSync(REPO + '/index.html', tmp + '/index.html');
  fs.cpSync(REPO + '/js', tmp + '/js', { recursive: true });
  fs.cpSync(REPO + '/brand', tmp + '/brand', { recursive: true });
  const f = tmp + '/js/67-price-offer-tab.js';
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('var VAT=0.15;')) { console.log('FAIL  sabotage setup: VAT constant not found to corrupt'); process.exit(1); }
  fs.writeFileSync(f, src.replace('var VAT=0.15;', 'var VAT=0.30;'));
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, APP_DIR: tmp }, stdio: 'pipe', encoding: 'utf8' });
  const failedAsItShould = r.status !== 0;
  console.log(failedAsItShould
    ? 'PASS  sabotage: with the VAT rate corrupted the probe exits non-zero (the math check really checks)'
    : 'FAIL  sabotage: the probe still passed with a wrong VAT rate — it is not actually checking');
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
  const src = fs.readFileSync(APP + '/js/67-price-offer-tab.js', 'utf8');
  const hexes = ['F06820', 'F87020', 'F47A1F', 'FBAE16', 'E54525', 'F26721', 'FF6C00', '323E49', '303848'];
  const found = hexes.filter(h => new RegExp(h, 'i').test(src));
  check('js/67 contains no copied brand hex', found.length === 0, 'found: ' + found.join(','));
  check('js/67 never mentions localStorage', !/localStorage/.test(src));
}

/* 2..7 — live page */
const PORT = 8872; process.env.APP_DIR = APP; start(PORT); const BASE = 'http://localhost:' + PORT;
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 950 } });
/* recorder: every localStorage.setItem call keeps its stack, so we can prove js/67
   never writes (the app shell / supabase auth legitimately may). */
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

/* synthetic fixtures only (D4) — registered AFTER the catch-all so they take precedence */
const IDENTITY = [
  { key: 'legal_name', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار' },
  { key: 'cr_number', value_en: '9999999999', value_ar: null },
  { key: 'vat_number', value_en: '399999999900003', value_ar: null },
  { key: 'website', value_en: 'www.example.test', value_ar: null },
  { key: 'email', value_en: 'qa@example.test', value_ar: null },
  { key: 'phone_licence', value_en: '000 000 0000', value_ar: null },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IDENTITY) }));

let draftPost = null;
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/generated_documents**', async r => {
  const rq = r.request();
  if (rq.method() === 'POST') {
    try { draftPost = JSON.parse(rq.postData() || 'null'); } catch (_) { draftPost = { parseError: true }; }
    const row = Object.assign({ id: '11111111-2222-3333-4444-555555555555', created_at: new Date().toISOString() },
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

/* open the Offer tab through the real tab button */
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('#dgWrap .dg-tabs button')].find(x => /Price Offer|عرض السعر/.test(x.textContent));
  if (btn) btn.click();
});
await p.waitForTimeout(1500);

check('offer tab renders through the seam (form present)', await p.evaluate(() => !!document.querySelector('#poWrap .po-form')));
check('A4 preview renders under data-identity="classic"', await p.evaluate(() =>
  !!document.querySelector('#poPreviewCol[data-identity="classic"] .po-page')));
/* before any price is typed: VAT rows and amount-in-words stay hidden, and the empty
   items table shows a friendly "add services above" row */
{
  const t0 = await p.evaluate(() => document.getElementById('poPages')?.innerText || '');
  check('empty offer hides the VAT rows until a price exists', !/VAT 15%|ضريبة القيمة المضافة 15%/.test(t0));
  check('empty offer hides the amount-in-words line', !/In words:|المبلغ كتابةً:/.test(t0));
  check('empty items table shows the friendly add-services row', /Add services above|أضف الخدمات أعلاه/.test(t0));
  check('unissued offer carries the diagonal DRAFT watermark', await p.evaluate(() =>
    !!document.querySelector('#poPages .po-wm span')));
}

/* — real-design cover / closing / footer (2026-08-25 redesign) — */
{
  const cover = await p.evaluate(() => {
    const pg = document.querySelector('#poPages .po-page');
    return { grad: !!pg && pg.classList.contains('grad'), cvr: !!pg && !!pg.querySelector('.po-cvr'),
      qr: !!pg && !!pg.querySelector('img[src*="direct_qr"]'),
      logo: !!pg && !!pg.querySelector('img[src*="direct_logo_white"]'), txt: pg ? pg.innerText : '' };
  });
  check('cover is the full-bleed brand cover (grad + .po-cvr + white logo + QR)',
    cover.grad && cover.cvr && cover.logo && cover.qr);
  const today = await p.evaluate(() => (new Date()).toISOString().slice(0, 10));
  check('cover carries NO date and NO offer-number label', !cover.txt.includes(today) &&
    !/Offer no\.|رقم العرض|Valid until|صالح حتى/.test(cover.txt), 'cover text: ' + cover.txt.slice(0, 120));
  const back = await p.evaluate(() => {
    const pgs = [...document.querySelectorAll('#poPages .po-page')];
    const pg = pgs[pgs.length - 1];
    return !!pg && pg.classList.contains('grad') && !!pg.querySelector('.po-cvr') &&
      !!pg.querySelector('img[src*="direct_logo_white"]') && !!pg.querySelector('img[src*="direct_qr"]');
  });
  check('closing back-cover exists (last page: full-bleed, white logo, QR)', back);
  const all = await p.evaluate(() => document.getElementById('poPages')?.innerText || '');
  check('footer legal block: trade name + unified no. + licence no.',
    all.includes('شركة المسافر المباشر للسفر والسياحة') && all.includes('700782406') && all.includes('7310322'));
  check('footer carries email/site + the branches line',
    /business@directksa\.com|qa@example\.test/.test(all) &&
    all.includes('You can visit our branches in Riyadh – Jeddah – Buraydah – Dammam'));
  check('IATA Wakeel line (EN, exact owner-approved text) renders on the offer body',
    all.includes('Direct is an IATA-accredited agent (Wakeel) No. 71238285 acting as agent for the carriers.'));
}
/* AR document: the AR IATA line renders too */
await p.evaluate(() => poLang('ar'));
await p.waitForTimeout(700);
check('IATA Wakeel line (AR, exact owner-approved text) renders on the AR offer', await p.evaluate(() =>
  (document.getElementById('poPages')?.innerText || '')
    .includes('دايركت وكيل معتمد من الاتحاد الدولي للنقل الجوي (إياتا) رقم 71238285 ويعمل بصفته وكيلاً عن الناقلين.')));
check('AR terms heading reads الشروط والأحكام', await p.evaluate(() =>
  (document.getElementById('poPages')?.innerText || '').includes('الشروط والأحكام')));
await p.evaluate(() => poLang('en'));
await p.waitForTimeout(600);

/* 3 — items math: type a price of 100.00, qty 1 → 100 + 15 = 115 */
await p.fill('#poWrap .po-line input[step="0.01"]', '100');
await p.waitForTimeout(400);
const m = await p.evaluate(() => window.__poCalcProbe ? __poCalcProbe() : null);
check('calc probe exists', !!m);
if (m) {
  check('subtotal is 100.00', m.subEx === 100, 'got ' + JSON.stringify(m));
  check('VAT is exactly 15% (15.00)', m.vat === 15, 'got ' + JSON.stringify(m));
  check('subtotal + VAT = total (115.00)', m.subEx + m.vat === m.tot && m.tot === 115, 'got ' + JSON.stringify(m));
}
const pv = await p.evaluate(() => document.getElementById('poPages')?.innerText || '');
check('preview prints the computed total 115.00', pv.includes('115.00'));
check('preview shows the VAT 15% line once priced (legitimate on client documents)',
  /VAT 15%|ضريبة القيمة المضافة 15%/.test(pv));
check('issue button carries the official-number wording',
  await p.evaluate(() => [...document.querySelectorAll('#poBar button')]
    .some(x => /Issue offer — assign official number|إصدار العرض — تعيين رقم رسمي/.test(x.textContent))));

/* 4 — amount in words, both languages, from the live page's own algorithm */
const w = await p.evaluate(() => window.__poWordsProbe ? __poWordsProbe(115) : null);
check('words probe exists', !!w);
if (w) {
  check('EN words for 115', w.en === 'One hundred and fifteen Saudi riyals only', 'got ' + JSON.stringify(w.en));
  check('AR words for 115', w.ar === 'فقط مائة وخمسة عشر ريالاً لا غير', 'got ' + JSON.stringify(w.ar));
}
check('preview carries the EN amount-in-words', pv.includes('One hundred and fifteen Saudi riyals only'));

/* 5 — draft save goes to generated_documents, with no client-side number */
await p.evaluate(() => {
  const b = [...document.querySelectorAll('#poBar button')].find(x => /Save draft|حفظ المسودة/.test(x.textContent));
  if (b) b.click();
});
await p.waitForTimeout(1500);
check('draft save POSTed to generated_documents', !!draftPost);
if (draftPost) {
  const body = Array.isArray(draftPost) ? draftPost[0] : draftPost;
  check('POST body: family is OFR', body.family === 'OFR');
  check('POST body: status is draft', body.status === 'draft');
  check('POST body: NO doc_number on a draft (numbering is issue-time, server-side)', body.doc_number == null);
  check('POST body: payload carries the line items', !!body.payload && Array.isArray(body.payload.lines)
    && body.payload.lines.some(l => String(l.price) === '100'));
}

/* 6 — nothing in js/67 ever writes localStorage */
const ls = await p.evaluate(() => (window.__lsWrites || []).filter(x => x.stack.includes('67-price-offer')));
check('no localStorage.setItem call originates from js/67', ls.length === 0,
  ls.slice(0, 2).map(x => x.key).join(','));

/* 7 */
check('no javascript errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
