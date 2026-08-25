/* Generator probe #4 — the Company Profile tab (family PRF) on the engine.

   What it proves:
   1. Static: js/69 contains no copied brand hex, never mentions localStorage,
      and never mentions the two owner-excluded verification vendors (M2).
   2. The profile tab renders through the js/66 seam (form + A4 preview under
      data-identity="classic") with cover / section / thank-you pages.
   3. Enabled sections render in sort order; a DISABLED section never renders.
   4. The stats band is ABSENT when the stats section has no items (M8: the
      canonical numbers are an open owner question — nothing invented).
   5. The rendered page (dynamic) carries no excluded-vendor string either.
   6. AR doc-language renders an RTL document with AR section titles.
   7. Personalized cover: picking a client puts its name on the cover only.
   8. Draft save POSTs to generated_documents with family PRF, status draft
      and NO doc_number (numbering is server-side, issue-time only), and the
      payload snapshot carries ONLY enabled sections.
   9. Runtime: no localStorage.setItem call originates from js/69. No js errors.
   Fixture data is synthetic (D4: nothing real in the repo).

   Run:            node scripts/generator-qa/probe-company-profile.mjs
   Sabotage test:  node scripts/generator-qa/probe-company-profile.mjs --sabotage
                   (serves a copy whose js/69 renderer no longer filters on
                    s.enabled — disabled sections would print to clients; the
                    probe MUST exit 1, and the wrapper inverts that to PASS) */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from '../qa/mock-supabase.mjs';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const SABOTAGE = process.argv.includes('--sabotage');

if (SABOTAGE) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-sab-'));
  fs.cpSync(REPO + '/index.html', tmp + '/index.html');
  fs.cpSync(REPO + '/js', tmp + '/js', { recursive: true });
  fs.cpSync(REPO + '/brand', tmp + '/brand', { recursive: true });
  const f = tmp + '/js/69-company-profile-tab.js';
  const src = fs.readFileSync(f, 'utf8');
  const needle = '.filter(function(s){return s.enabled;})';
  if (!src.includes(needle)) { console.log('FAIL  sabotage setup: enabled-filter not found to corrupt'); process.exit(1); }
  /* corrupt the RENDERER: disabled sections print anyway — a real client-facing defect */
  fs.writeFileSync(f, src.split(needle).join('.filter(function(s){return true;})'));
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, APP_DIR: tmp }, stdio: 'pipe', encoding: 'utf8' });
  const failedAsItShould = r.status !== 0;
  console.log(failedAsItShould
    ? 'PASS  sabotage: with the enabled-filter removed (disabled sections rendering) the probe exits non-zero'
    : 'FAIL  sabotage: the probe still passed with disabled sections rendering — it is not actually checking');
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
  const src = fs.readFileSync(APP + '/js/69-company-profile-tab.js', 'utf8');
  const hexes = ['F06820', 'F87020', 'F47A1F', 'FBAE16', 'E54525', 'F26721', 'FF6C00', '323E49', '303848'];
  const found = hexes.filter(h => new RegExp(h, 'i').test(src));
  check('js/69 contains no copied brand hex', found.length === 0, 'found: ' + found.join(','));
  check('js/69 never mentions localStorage', !/localStorage/.test(src));
  check('js/69 never mentions the excluded vendors (M2, static)', !/takamol|techtic|تكامل/i.test(src));
  check('js/69 registers family PRF only', /family:'PRF'/.test(src) && !/family:'SFP'/.test(src));
}

/* live page */
const PORT = 8874; process.env.APP_DIR = APP; start(PORT); const BASE = 'http://localhost:' + PORT;
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
const SECTIONS = [
  { key: 'what_we_offer', title_en: 'What we offer', title_ar: 'ما نقدمه',
    body_en: 'SYNTH-OFFER paragraph one.\n- synth bullet A\n- synth bullet B', body_ar: 'فقرة اختبار.',
    items: [], sort: 10, enabled: true },
  { key: 'values', title_en: 'Our values', title_ar: 'قيمنا', body_en: '', body_ar: '',
    items: [
      { en: 'Continuous Innovation', ar: 'الابتكار المستمر', desc_en: 'synth d1', desc_ar: 'وصف 1' },
      { en: 'Client-Centric', ar: 'العميل أولاً', desc_en: 'synth d2', desc_ar: 'وصف 2' }],
    sort: 20, enabled: true },
  { key: 'tech', title_en: 'SYNTH-TECH-HIDDEN', title_ar: 'قسم مخفي',
    body_en: 'This disabled section must NEVER render.', body_ar: 'يجب ألا يظهر.',
    items: [], sort: 30, enabled: false },
  { key: 'services', title_en: 'Our services', title_ar: 'خدماتنا', body_en: '', body_ar: '',
    items: [
      { en: 'Domestic flight booking', ar: 'حجز طيران داخلي' },
      { en: 'Hotel reservation', ar: 'حجز فندقي' },
      { en: 'Visa services', ar: 'خدمات التأشيرات' }],
    sort: 40, enabled: true },
  /* stats deliberately EMPTY — the band must be absent (open owner question) */
  { key: 'stats', title_en: 'Direct in numbers', title_ar: 'دايركت بالأرقام',
    body_en: '', body_ar: '', items: [], sort: 50, enabled: true },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_profile_sections**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SECTIONS) }));

const IDENTITY = [
  { key: 'legal_name', label_en: 'Legal name', label_ar: 'الاسم القانوني', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار', show_on_documents: true, sensitive: false, sort: 1 },
  { key: 'cr_number', label_en: 'CR number', label_ar: 'السجل التجاري', value_en: '9999999999', value_ar: null, show_on_documents: true, sensitive: false, sort: 2 },
  { key: 'vat_number', label_en: 'VAT number', label_ar: 'الرقم الضريبي', value_en: '399999999900003', value_ar: null, show_on_documents: true, sensitive: false, sort: 3 },
  { key: 'website', label_en: 'Website', label_ar: 'الموقع', value_en: 'www.example.test', value_ar: null, show_on_documents: true, sensitive: false, sort: 4 },
  { key: 'email', label_en: 'Email', label_ar: 'البريد', value_en: 'qa@example.test', value_ar: null, show_on_documents: true, sensitive: false, sort: 5 },
  { key: 'phone_licence', label_en: 'Phone', label_ar: 'الهاتف', value_en: '000 000 0000', value_ar: null, show_on_documents: true, sensitive: false, sort: 6 },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IDENTITY) }));

let draftPost = null;
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/generated_documents**', async r => {
  const rq = r.request();
  if (rq.method() === 'POST') {
    try { draftPost = JSON.parse(rq.postData() || 'null'); } catch (_) { draftPost = { parseError: true }; }
    const row = Object.assign({ id: '33333333-4444-5555-6666-777777777777', created_at: new Date().toISOString() },
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

/* open the profile tab through the real tab button */
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('#dgWrap .dg-tabs button')].find(x => /Company Profile|الملف التعريفي/.test(x.textContent));
  if (btn) btn.click();
});
await p.waitForTimeout(1800);

/* 2 — the tab renders through the seam */
check('profile tab renders through the seam (form present)', await p.evaluate(() => !!document.querySelector('#cpWrap .cp-form')));
check('A4 preview renders under data-identity="classic"', await p.evaluate(() =>
  !!document.querySelector('#cpPreviewCol[data-identity="classic"] .cp-page')));
check('unissued profile carries the diagonal DRAFT watermark', await p.evaluate(() =>
  !!document.querySelector('#cpPages .cp-wm span')));
check('cover + closing pages use the gradient identity', await p.evaluate(() => {
  const pages = [...document.querySelectorAll('#cpPages .cp-page')];
  return pages.length >= 3 && pages[0].classList.contains('grad') && pages[pages.length - 1].classList.contains('grad');
}));

/* 3 — enabled sections in sort order; disabled absent; stats band absent */
{
  const txt = await p.evaluate(() => document.getElementById('cpPages')?.innerText || '');
  check('sections render in sort order (What we offer → Our values → Our services)', (() => {
    const a = txt.indexOf('What we offer'), b2 = txt.indexOf('Our values'), c = txt.indexOf('Our services');
    return a >= 0 && b2 > a && c > b2;
  })(), 'order broken');
  check('DISABLED section never renders (SYNTH-TECH-HIDDEN absent)', !txt.includes('SYNTH-TECH-HIDDEN'));
  check('markdown-lite bullets render (synth bullet A/B)', txt.includes('synth bullet A') && txt.includes('synth bullet B'));
  check('values cards render both seeded values', txt.includes('Continuous Innovation') && txt.includes('Client-Centric'));
  check('services list renders the fixture services', txt.includes('Domestic flight booking') && txt.includes('Hotel reservation'));
  check('stats band ABSENT when stats items are empty', await p.evaluate(() =>
    document.querySelectorAll('#cpPages .cp-stat').length === 0));
  check('stats section heading also absent (no empty page)', !txt.includes('Direct in numbers'));
  check('thank-you page carries identity block (CR + VAT + email)',
    txt.includes('9999999999') && txt.includes('399999999900003') && txt.includes('qa@example.test'));
  check('rendered page never mentions the excluded vendors (M2, dynamic)', !/takamol|techtic|تكامل/i.test(txt));
}

/* 4 — AR document language renders RTL with AR titles */
await p.evaluate(() => cpLang('ar'));
await p.waitForTimeout(900);
{
  const txt = await p.evaluate(() => document.getElementById('cpPages')?.innerText || '');
  check('AR doc renders RTL pages', await p.evaluate(() => {
    const pgs = [...document.querySelectorAll('#cpPages .cp-page')];
    return pgs.length > 0 && pgs.every(x => x.classList.contains('ar')) &&
      getComputedStyle(pgs[0]).direction === 'rtl';
  }));
  check('AR section titles render (ما نقدمه / قيمنا / خدماتنا)',
    txt.includes('ما نقدمه') && txt.includes('قيمنا') && txt.includes('خدماتنا'));
  check('AR cover title renders (الملف التعريفي)', txt.includes('الملف التعريفي'));
}
await p.evaluate(() => cpLang('en'));
await p.waitForTimeout(700);

/* 5 — personalized cover variant: client name on the cover only */
await p.evaluate(() => {
  try { DB.businesses = DB.businesses || []; DB.businesses.push({ id: 'qa-biz-1', name: 'Synthetic Client LLC', isClient: true }); } catch (_) {}
  cpSet('clientId', 'qa-biz-1');
});
await p.waitForTimeout(700);
{
  const coverTxt = await p.evaluate(() => document.querySelector('#cpPages .cp-page')?.innerText || '');
  const restTxt = await p.evaluate(() =>
    [...document.querySelectorAll('#cpPages .cp-page')].slice(1).map(x => x.innerText).join('\n'));
  check('personalized cover shows the picked client name on the cover', coverTxt.includes('Synthetic Client LLC'));
  check('client name appears on the cover ONLY (no other page)', !restTxt.includes('Synthetic Client LLC'));
}

/* 6 — draft save: family PRF, status draft, no client-side number */
await p.evaluate(() => cpSaveDraft());
await p.waitForTimeout(1500);
check('draft save POSTed to generated_documents', !!draftPost);
if (draftPost) {
  const body = Array.isArray(draftPost) ? draftPost[0] : draftPost;
  check('POST body: family is PRF', body.family === 'PRF');
  check('POST body: status is draft', body.status === 'draft');
  check('POST body: NO doc_number on a draft (numbering is issue-time, server-side)', body.doc_number == null);
  check('POST body: personalized cover links the business', body.business_id === 'qa-biz-1');
  check('POST body: payload snapshot carries ONLY enabled sections (4, no tech)',
    !!body.payload && Array.isArray(body.payload.sections)
    && body.payload.sections.length === 4
    && !body.payload.sections.some(s => s.key === 'tech'));
}

/* 7 — nothing in js/69 ever writes localStorage; no js errors */
const ls = await p.evaluate(() => (window.__lsWrites || []).filter(x => x.stack.includes('69-company-profile')));
check('no localStorage.setItem call originates from js/69', ls.length === 0,
  ls.slice(0, 2).map(x => x.key).join(','));
check('no javascript errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
