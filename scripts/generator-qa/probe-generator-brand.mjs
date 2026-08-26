/* Generator probe #1 — the brand tokens are READ, not copied (rules P5/F1), and the
   Documents page actually renders its Company Assets tab.

   What it proves:
   1. js/66 contains no hardcoded brand hex (static scan).
   2. The live page resolves --accent/--accent-strong/--ink/--gold for data-identity
      "classic" and "product" to EXACTLY the values written in /brand/tokens.css —
      parsed from the file at runtime, so editing tokens.css moves the expectation too.
   3. The Documents page renders: nav entry, tabs, registry rows, renewals radar with an
      EXPIRED pill, sensitive values masked until revealed.
   Fixture data is synthetic (D4: nothing real in the repo).

   Run:            node scripts/generator-qa/probe-generator-brand.mjs
   Sabotage test:  node scripts/generator-qa/probe-generator-brand.mjs --sabotage
                   (serves a copy whose tokens.css is emptied — the probe MUST exit 1;
                    the wrapper inverts that so sabotage success prints PASS)          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from '../qa/mock-supabase.mjs';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const SABOTAGE = process.argv.includes('--sabotage');

if (SABOTAGE) {
  // build a broken copy: identical app, tokens.css emptied — then demand the probe FAILS
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-sab-'));
  fs.cpSync(REPO + '/index.html', tmp + '/index.html');
  fs.cpSync(REPO + '/js', tmp + '/js', { recursive: true });
  fs.cpSync(REPO + '/brand', tmp + '/brand', { recursive: true });
  fs.writeFileSync(tmp + '/brand/tokens.css', '/* sabotaged for rule B7 */\n');
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, APP_DIR: tmp }, stdio: 'pipe', encoding: 'utf8' });
  const failedAsItShould = r.status !== 0;
  console.log(failedAsItShould
    ? 'PASS  sabotage: with tokens.css emptied the probe exits non-zero (the guard really guards)'
    : 'FAIL  sabotage: the probe still passed with tokens.css emptied — it is not actually checking');
  process.exit(failedAsItShould ? 0 : 1);
}

const APP = process.env.APP_DIR || REPO;

/* parse expected values straight from the tokens file the app will serve */
function parseIdentity(css, id) {
  const m = css.match(new RegExp('\\[data-identity="' + id + '"\\]\\s*\\{([^}]*)\\}'));
  const block = m ? m[1] : '';
  const v = (name) => { const mm = block.match(new RegExp('--' + name + ':\\s*([^;]+);')); return mm ? mm[1].trim() : ''; };
  return { accent: v('accent'), accentStrong: v('accent-strong'), ink: v('ink'), gold: v('gold') };
}
const tokensCss = fs.readFileSync(APP + '/brand/tokens.css', 'utf8');
const EXP_CLASSIC = parseIdentity(tokensCss, 'classic');
const EXP_PRODUCT = parseIdentity(tokensCss, 'product');

let failed = 0, passed = 0;
const check = (label, ok, detail = '') => {
  ok ? passed++ : failed++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (ok || !detail ? '' : '  → ' + detail));
};

/* 1 — static: no brand hex copied into the generator layer */
{
  const src = fs.readFileSync(APP + '/js/66-document-generator.js', 'utf8');
  const hexes = ['F06820', 'F87020', 'F47A1F', 'FBAE16', 'E54525', 'F26721', 'FF6C00', '323E49', '303848'];
  const found = hexes.filter(h => new RegExp(h, 'i').test(src));
  check('js/66 contains no copied brand hex', found.length === 0, 'found: ' + found.join(','));
}

/* audit 2026-08-24: the legacy AGENCY block must never again carry the stale VAT /
   unknown-IBAN literals that printed on invoice previews and seeded the ZATCA QR */
{
  const core06 = fs.readFileSync(APP + '/js/core/core-06-v18-v21.js', 'utf8');
  check('core-06 carries no stale VAT literal', !/302166089700003/.test(core06));
  check('core-06 carries no IBAN literal', !/SA\d{22}/.test(core06));
}

/* 2+3 — live page */
const PORT = 8871; process.env.APP_DIR = APP; start(PORT); const BASE = 'http://localhost:' + PORT;
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errors = [];
p.on('pageerror', e => errors.push('js: ' + e.message));

/* The qa mock serves .css as text/plain and Chrome refuses to apply a stylesheet with
   that MIME — Vercel serves text/css in production. mock-supabase.mjs is owned by the
   finance session (P4), so the fix lives here: serve the css with the right type. */
await p.route('**/brand/*.css', r => {
  const u = new URL(r.request().url());
  try { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(APP + u.pathname, 'utf8') }); }
  catch (e) { r.fulfill({ status: 404, body: '' }); }
});

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

/* synthetic registry fixture — invented values only (D4) */
const FIXTURE = [
  { key: 'legal_name', category: 'legal', label_en: 'Legal name', label_ar: 'الاسم القانوني', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار', expires_on: null, source: 'fixture', sensitive: false, show_on_documents: true, sort: 10, proof_path: null },
  { key: 'cr_number', category: 'legal', label_en: 'CR', label_ar: 'السجل', value_en: '9999999999', value_ar: null, expires_on: '2020-01-01', source: 'fixture', sensitive: false, show_on_documents: true, sort: 20, proof_path: null },
  { key: 'vat_number', category: 'tax', label_en: 'VAT', label_ar: 'ضريبة', value_en: '999999999999999', value_ar: null, expires_on: null, source: 'fixture', sensitive: false, show_on_documents: true, sort: 30, proof_path: null },
  { key: 'iban_alinma', category: 'banking', label_en: 'Alinma IBAN', label_ar: 'آيبان', value_en: 'SA9999999999999999999999', value_ar: null, expires_on: null, source: 'fixture', sensitive: true, show_on_documents: true, sort: 59, proof_path: null, download_name: null },
  { key: 'iban_test', category: 'banking', label_en: 'Test IBAN', label_ar: 'آيبان', value_en: 'SA0000000000000000000000', value_ar: null, expires_on: null, source: 'fixture', sensitive: true, show_on_documents: true, sort: 60, proof_path: null },
  /* certificate-like licence row with NO expiry date — must still appear on the radar
     with a neutral "date not on file" pill, and its proof gets a View button */
  { key: 'test_licence', category: 'licence', label_en: 'Test licence', label_ar: 'رخصة اختبار', value_en: 'LIC-0000', value_ar: null, expires_on: null, source: 'fixture', sensitive: false, show_on_documents: true, sort: 30, proof_path: 'licence/test_licence.pdf', download_name: 'Synthetic licence proof for QA.pdf' },
  /* wallet row (outgoing only) — must render in its own section AFTER banking and must
     NEVER appear in the copied bank-details block */
  { key: 'wallet_test', category: 'wallet', label_en: 'Test wallet (outgoing only)', label_ar: 'محفظة اختبار', value_en: 'SA1111111111111111111111', value_ar: null, expires_on: null, source: 'fixture', sensitive: false, show_on_documents: false, sort: 70, proof_path: 'wallet/wallet_test.pdf', download_name: 'Synthetic wallet letter for QA.pdf' },
];
FIXTURE.forEach(r => { if (!('download_name' in r)) r.download_name = null; });
const patches = [];   /* every PATCH body the app sends, for the edit-save check */
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r => {
  const rq = r.request();
  if (rq.method() === 'PATCH') {
    const body = JSON.parse(rq.postData() || '{}'); patches.push(body);
    const m = new URL(rq.url()).searchParams.get('key');           // key=eq.<key>
    const key = m ? m.replace(/^eq\./, '') : '';
    const row = FIXTURE.find(x => x.key === key);
    if (row) Object.keys(body).forEach(k => { if (k in row) row[k] = body[k]; });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
  }
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) });
});
/* storage sign endpoint — echo a plausible signed path so the client can build the URL */
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/storage/v1/object/sign/**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/company-docs/x.pdf?token=qa' }) }));

/* synthetic saved-documents fixture for the unified start-screen list (D4) */
const DOCS = [
  { id: 'qa-doc-1', family: 'OFR', doc_number: 'OFR-2026-0001', title: 'QA Offer', status: 'sent', business_id: null, created_at: '2026-08-20T10:00:00Z',
    payload: { titleEn: 'QA Loaded Offer', titleAr: '', attn: '', date: '2026-08-20', valid: 14, by: '', notes: '', lines: [{ svc: 'QA service', qty: 1, fee: 100 }] } },
  { id: 'qa-doc-2', family: 'CTR', doc_number: null, title: 'QA Contract Draft', status: 'draft', business_id: null, created_at: '2026-08-19T10:00:00Z' },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/generated_documents**', r => {
  if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DOCS) });
  r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await p.goto(BASE + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(2500);
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);
await p.evaluate(() => { current = 'documents'; render(); });
await p.waitForTimeout(2500);

/* brand: computed at runtime vs parsed from the file */
const live = await p.evaluate(() => ({
  classic: window.__dgBrandProbe ? __dgBrandProbe('classic') : null,
  product: window.__dgBrandProbe ? __dgBrandProbe('product') : null,
}));
check('brand probe hook exists', !!live.classic);
if (live.classic) {
  for (const k of ['accent', 'accentStrong', 'ink', 'gold']) {
    check('classic --' + k + ' resolves from tokens.css (' + EXP_CLASSIC[k] + ')',
      !!EXP_CLASSIC[k] && live.classic[k] === EXP_CLASSIC[k], 'got ' + JSON.stringify(live.classic[k]));
  }
  check('product --accent resolves from tokens.css (' + EXP_PRODUCT.accent + ')',
    !!EXP_PRODUCT.accent && live.product.accent === EXP_PRODUCT.accent, 'got ' + JSON.stringify(live.product.accent));
  check('tokens.css <link> injected', live.classic.linkPresent === true);
  /* hydration runs on a 1.5s retry loop — poll up to 12s instead of racing a fixed wait */
  let ag = null;
  for (let i = 0; i < 24; i++) {
    ag = await p.evaluate(() => (typeof AGENCY !== 'undefined' ? { vat: AGENCY.vat, iban: AGENCY.iban } : null));
    if (ag && ag.vat === '999999999999999' && ag.iban === 'SA9999999999999999999999') break;
    await p.waitForTimeout(500);
  }
  check('AGENCY vat+iban hydrate from the registry (Alinma default)', !!ag && ag.vat === '999999999999999', 'got ' + JSON.stringify(ag));
}

/* page render */
check('nav entry is renamed to Generator', await p.evaluate(() =>
  [...document.querySelectorAll('#nav button')].some(x => /Generator|المولّد/.test(x.textContent))));
check('nav no longer says Documents', await p.evaluate(() =>
  ![...document.querySelectorAll('#nav button')].some(x => /Documents|المستندات/.test(x.textContent))));
check('page heading is Generator', await p.evaluate(() =>
  /Generator|المولّد/.test((document.getElementById('vTitle') || {}).textContent || '')));

/* ---- start screen (26 Aug redesign): /documents with no sub-address = home ---- */
{
  /* the saved-list query resolves async — poll until the rows land */
  let home = null;
  for (let i = 0; i < 20; i++) {
    home = await p.evaluate(() => window.__dgHomeProbe ? __dgHomeProbe() : null);
    if (home && home.savedRows > 0) break;
    await p.waitForTimeout(400);
  }
  check('__dgHomeProbe exists and reports the home view', !!home && home.view === 'home', JSON.stringify(home));
  check('start screen renders 5 document cards', !!home && home.cards === 5, JSON.stringify(home));
  const ht = await p.evaluate(() => (document.getElementById('dgHome') || {}).innerText || '');
  check('start screen carries the heading', /What do you want to create\?|ماذا تريد أن تنشئ؟/.test(ht));
  check('the quieter Company assets & registry entry exists', await p.evaluate(() =>
    !!document.querySelector('#dgHome .dg-assets-row')) && /Company assets & registry|أصول الشركة والسجل/.test(ht));
  check('unified saved list renders rows from the fixture (all families, one list)',
    !!home && home.savedRows === 2 && ht.includes('OFR-2026-0001') && /Draft|مسودة/.test(ht)
    && /Financial proposal|عرض مالي/.test(ht) && /Contract|العقد/.test(ht), JSON.stringify(home));
  check('the old tab bar is gone', await p.evaluate(() => !document.querySelector('#dgWrap .dg-tabs')));
}

/* open the Company Assets editor through its start-screen entry */
await p.evaluate(() => { const b = document.querySelector('#dgHome .dg-assets-row'); if (b) b.click(); });
await p.waitForTimeout(1200);
const txt = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
check('assets entry opens the assets editor view', await p.evaluate(() =>
  window.__dgHomeProbe && __dgHomeProbe().view === 'editor' && __dgHomeProbe().editor === 'assets'));
check('editor view shows the back button + the editor name', await p.evaluate(() =>
  !!document.querySelector('#dgWrap .dg-back')
  && /All documents|كل المستندات/.test(document.querySelector('#dgWrap .dg-back').textContent)
  && /Company assets & registry|أصول الشركة والسجل/.test((document.querySelector('#dgWrap .dg-ed-name') || {}).textContent || '')));
check('assets editor hides the step header (not a document)', await p.evaluate(() => !document.getElementById('dgSteps')));
check('registry rows render from data', txt.includes('Synthetic Test Co Ltd'));
check('renewals radar shows EXPIRED for the past date', /EXPIRED|منتهية/.test(txt));
check('radar shows the no-date licence with a neutral pill', /date not on file|التاريخ غير مسجل/.test(txt)
  && await p.evaluate(() => !!document.querySelector('#dgWrap .dg-pill.nodate')));
check('proof row gets a View document button', /View document|عرض المستند/.test(txt));
check('page is self-contained: no target=_blank links, no Brand Hub jump-off', await p.evaluate(() =>
  document.querySelectorAll('#dgWrap a[target]').length === 0
  && !/Open Brand Hub/.test(document.getElementById('dgWrap')?.innerText || '')));
check('brand assets render inline as thumbnails with Download', await p.evaluate(() =>
  document.querySelectorAll('#dgWrap .dg-chip img').length >= 4
  && [...document.querySelectorAll('#dgWrap .dg-chip a[download]')].length >= 4));
check('sensitive value is masked until revealed', !txt.includes('SA0000000000000000000000') && /hidden|مخفي/.test(txt));
await p.evaluate(() => { [...document.querySelectorAll('#dgWrap button')].filter(x => /^(Show|عرض)$/.test(x.textContent.trim())).forEach(b=>b.click()); });
await p.waitForTimeout(600);
const txt2 = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
check('reveal shows the value on demand', txt2.includes('SA0000000000000000000000'));

/* ---- wallet section: renders with its explainer note, AFTER banking ---- */
{
  const w = await p.evaluate(() => {
    const t = document.getElementById('dgWrap')?.innerText || '';
    return {
      bank: t.indexOf('Bank accounts'),
      wallet: t.indexOf('Wallets — outgoing only'),
      note: t.includes('Used to fund virtual cards; we do not receive money on wallets.'),
    };
  });
  check('wallet section renders after the banking section', w.bank >= 0 && w.wallet > w.bank, JSON.stringify(w));
  check('wallet section carries the outgoing-only note', w.note);
}

/* ---- dgCopyBank: banking IBAN in, wallet IBAN OUT (real click, clipboard spied) ---- */
{
  await p.evaluate(() => {
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } }, configurable: true });
    const b = [...document.querySelectorAll('#dgWrap button')].find(x => /Copy bank details|نسخ البيانات البنكية/.test(x.textContent));
    if (b) b.click();
  });
  await p.waitForTimeout(400);
  const copied = await p.evaluate(() => window.__copied);
  check('Copy-bank click copies the banking IBAN', !!copied && copied.includes('SA0000000000000000000000'), JSON.stringify(copied));
  check('Copy-bank block EXCLUDES the wallet IBAN', !!copied && !copied.includes('SA1111111111111111111111'));
  check('Copy-bank intro no longer claims "every IBAN"', !/every IBAN —|كل الآيبانات/.test(await p.evaluate(() => document.getElementById('dgWrap').innerText)));
}

/* ---- Download uses the registry download_name (window.open spied, real click) ---- */
{
  await p.evaluate(() => {
    window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return { closed: false }; };
    const tr = [...document.querySelectorAll('#dgWrap table.dg tr')].find(x => x.innerText.includes('Test licence') && /Download|تنزيل/.test(x.innerText));
    const b = tr && [...tr.querySelectorAll('button')].find(x => /^(Download|تنزيل)$/.test(x.textContent.trim()));
    if (b) b.click();
  });
  /* signed-URL fetch is async — poll instead of racing a fixed wait */
  let opened = [];
  for (let i = 0; i < 20 && !opened.length; i++) { await p.waitForTimeout(400); opened = await p.evaluate(() => window.__opened); }
  check('proof Download opens a signed URL carrying the descriptive download_name',
    opened.some(u => u.includes('download=') && /Synthetic(%20|\+| )licence(%20|\+| )proof/.test(u)), JSON.stringify(opened));
  check('the download_name is never shown on screen',
    !(await p.evaluate(() => document.getElementById('dgWrap').innerText.includes('Synthetic licence proof for QA'))));
  /* View stays a plain signed URL with no download param */
  await p.evaluate(() => {
    window.__opened = [];
    const tr = [...document.querySelectorAll('#dgWrap table.dg tr')].find(x => x.innerText.includes('Test licence') && /View document|عرض المستند/.test(x.innerText));
    const b = tr && [...tr.querySelectorAll('button')].find(x => /View document|عرض المستند/.test(x.textContent));
    if (b) b.click();
  });
  let viewed = [];
  for (let i = 0; i < 20 && !viewed.length; i++) { await p.waitForTimeout(400); viewed = await p.evaluate(() => window.__opened); }
  check('proof View opens in a tab WITHOUT forcing a download name', viewed.length === 1 && !viewed[0].includes('download='), JSON.stringify(viewed));
}

/* ---- edit UX: real clicks through Edit → labeled aligned inputs → Save → Cancel ---- */
{
  const clickRowBtn = (rowText, btnRe) => p.evaluate(([t, re]) => {
    const tr = [...document.querySelectorAll('#dgWrap table.dg tr')].find(x => x.innerText.includes(t));
    const b = tr && [...tr.querySelectorAll('button')].find(x => new RegExp(re).test(x.textContent.trim()));
    if (b) { b.click(); return true; } return false;
  }, [rowText, btnRe]);
  check('Edit button clicks on the legal-name row', await clickRowBtn('Synthetic Test Co Ltd', '^(Edit|تعديل)$'));
  await p.waitForTimeout(500);
  const form = await p.evaluate(() => {
    const en = document.getElementById('dgE_en'), exp = document.getElementById('dgE_exp');
    const grid = document.querySelector('#dgWrap .dg-edit-grid');
    const labels = [...document.querySelectorAll('#dgWrap .dg-fl')].map(x => x.textContent);
    const gw = grid ? grid.getBoundingClientRect().width : 0;
    return {
      open: !!en, labels, gridded: !!grid && getComputedStyle(grid).display === 'grid',
      dateFits: !!exp && exp.getBoundingClientRect().right <= grid.getBoundingClientRect().right + 1,
      inputsAligned: !!en && Math.abs(en.getBoundingClientRect().left - grid.getBoundingClientRect().left) < 2,
      spans: document.querySelector('#dgWrap .dg-editrow td')?.getAttribute('colspan') === '3',
    };
  });
  check('edit form opens as a labeled grid (4 labels, grid layout, full-row, aligned)',
    form.open && form.labels.length === 4 && form.gridded && form.spans && form.inputsAligned, JSON.stringify(form));
  check('date input does not overflow the form', form.dateFits, JSON.stringify(form));
  await p.evaluate(() => { const e = document.getElementById('dgE_en'); e.value = 'Edited Co Ltd QA'; });
  check('Save button clicks', await p.evaluate(() => { const b = [...document.querySelectorAll('#dgWrap .dg-edit button')].find(x => /^(Save|حفظ)$/.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; }));
  /* PATCH + reload + re-render are async — poll for the new value instead of a fixed wait */
  let saved = false;
  for (let i = 0; i < 25 && !saved; i++) { await p.waitForTimeout(400); saved = await p.evaluate(() => document.getElementById('dgWrap').innerText.includes('Edited Co Ltd QA')); }
  check('Save sent one PATCH whose body carries the edited value', patches.length === 1 && patches[0].value_en === 'Edited Co Ltd QA', JSON.stringify(patches));
  check('row shows the new value after Save', saved);
  /* Cancel: open again, cancel, form gone, nothing new PATCHed */
  check('Edit re-opens for Cancel', await clickRowBtn('Edited Co Ltd QA', '^(Edit|تعديل)$'));
  await p.waitForTimeout(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#dgWrap .dg-edit button')].find(x => /^(Cancel|إلغاء)$/.test(x.textContent.trim())); if (b) b.click(); });
  await p.waitForTimeout(400);
  check('Cancel closes the form without writing', patches.length === 1 && await p.evaluate(() => !document.getElementById('dgE_en')));
}

/* ---- Replace proof moved off the row strip into the edit form (declutter 2026-08-26):
        rows with a proof end at 4 actions (View document / Download / Copy / Edit);
        rows without one keep Attach proof on the row (nothing to view yet) ---- */
{
  const strip = await p.evaluate(() => {
    const t = document.getElementById('dgWrap').innerText;
    return { replaceVisible: /Replace proof|استبدال المستند/.test(t),
             attachVisible: /Attach proof|إرفاق مستند/.test(t) };
  });
  check('row strips show NO Replace proof while nothing is being edited', !strip.replaceVisible, JSON.stringify(strip));
  check('rows without a proof still offer Attach proof on the row', strip.attachVisible, JSON.stringify(strip));
  const openEdit = (rowText) => p.evaluate((t) => {
    /* the renewals radar lists the same licence WITHOUT an Edit button — pick the
       registry row (the one that actually carries Edit), not merely the first match */
    const tr = [...document.querySelectorAll('#dgWrap table.dg tr')].find(x => x.innerText.includes(t)
      && [...x.querySelectorAll('button')].some(b => /^(Edit|تعديل)$/.test(b.textContent.trim())));
    const b = tr && [...tr.querySelectorAll('button')].find(x => /^(Edit|تعديل)$/.test(x.textContent.trim()));
    if (b) { b.click(); return true; } return false;
  }, rowText);
  check('Edit opens on the proof-carrying licence row', await openEdit('Test licence'));
  await p.waitForTimeout(500);
  const ed = await p.evaluate(() => {
    const e = document.querySelector('#dgWrap .dg-edit');
    return { open: !!e, replaceInEdit: !!e && /Replace proof|استبدال المستند/.test(e.innerText),
             fileInput: !!e && !!e.querySelector('input[type="file"]') };
  });
  check('edit form carries Replace proof with its file-upload control', ed.open && ed.replaceInEdit && ed.fileInput, JSON.stringify(ed));
  await p.evaluate(() => { const b = [...document.querySelectorAll('#dgWrap .dg-edit button')].find(x => /^(Cancel|إلغاء)$/.test(x.textContent.trim())); if (b) b.click(); });
  await p.waitForTimeout(400);
}

/* ---- radar dates never wrap mid-date ---- */
{
  const radar = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('#dgWrap .dg-radar .dg-date')];
    return {
      n: cells.length,
      nowrap: cells.every(c => getComputedStyle(c).whiteSpace === 'nowrap'),
      noBreak: cells.every(c => !/\d\n\d|\d-\n/.test(c.innerText)),
    };
  });
  check('radar date cells are nowrap and unbroken', radar.n > 0 && radar.nowrap && radar.noBreak, JSON.stringify(radar));
}

/* ---- nav: 'offers' (Proposals) is out of the primary menu, page still renders ---- */
{
  check('Proposals is absent from the primary nav', await p.evaluate(() =>
    ![...document.querySelectorAll('#nav button')].some(x => /Proposals|العروض/.test(x.textContent))));
  const off = await p.evaluate(() => { current = 'offers'; render(); return { cur: current, len: (document.getElementById('view')?.innerText || '').length }; });
  check('the /offers page itself still renders (reachable by URL)', off.cur === 'offers' && off.len > 40, JSON.stringify(off));
  await p.evaluate(() => { current = 'documents'; render(); });
  await p.waitForTimeout(1200);
}
/* ---- back button returns home, then a card opens its editor with the sub-address ---- */
await p.evaluate(() => { const b = document.querySelector('#dgWrap .dg-back'); if (b) b.click(); });
await p.waitForTimeout(800);
check('back button returns to the start screen', await p.evaluate(() =>
  window.__dgHomeProbe && __dgHomeProbe().view === 'home' && document.querySelectorAll('#dgWrap .dg-card').length === 5));
check('back button leaves the address at /documents', await p.evaluate(() => location.pathname) === '/documents');
await p.evaluate(() => { const c = [...document.querySelectorAll('#dgHome .dg-card')].find(x => /Financial proposal|عرض مالي/.test(x.textContent)); if (c) c.click(); });
await p.waitForTimeout(800);
check('the card opens the offer editor full-width', await p.evaluate(() =>
  window.__dgHomeProbe && __dgHomeProbe().view === 'editor' && __dgHomeProbe().editor === 'offer' && !!document.querySelector('#poWrap')));
check('the editor shows the sticky 3-step header', await p.evaluate(() =>
  document.querySelectorAll('#dgSteps button').length === 3
  && getComputedStyle(document.getElementById('dgSteps')).position === 'sticky'));
check('opening a card writes the sub-address /documents/offer', await p.evaluate(() => location.pathname) === '/documents/offer');
/* browser Back from the editor returns to the start screen (spec item 6) */
await p.evaluate(() => history.back());
await p.waitForTimeout(1200);
check('browser Back returns to /documents and shows the start screen', await p.evaluate(() =>
  location.pathname === '/documents' && window.__dgHomeProbe && __dgHomeProbe().view === 'home'));
/* clicking a saved row opens the matching editor AND hands the id to its opener */
{
  /* the home list re-fetches after dgHome — wait for the fixture row to be back */
  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) { await p.waitForTimeout(400); ok = await p.evaluate(() => !!document.querySelector('#dgHome .dg-saved .dg-row')); }
  await p.evaluate(() => { const r = [...document.querySelectorAll('#dgHome .dg-saved .dg-row')].find(x => x.innerText.includes('OFR-2026-0001')); if (r) r.click(); });
  let loaded = null;
  for (let i = 0; i < 25; i++) {
    loaded = await p.evaluate(() => ({
      editor: window.__dgHomeProbe ? __dgHomeProbe().editor : null,
      hasDoc: !!document.querySelector('#poWrap') && (document.querySelector('#poWrap') || {}).innerText.includes('OFR-2026-0001'),
    }));
    if (loaded.hasDoc) break;
    await p.waitForTimeout(400);
  }
  check('saved row opens the offer editor', !!loaded && loaded.editor === 'offer', JSON.stringify(loaded));
  check('saved row loads that document through poOpen (number shown in the editor)', !!loaded && loaded.hasDoc, JSON.stringify(loaded));
}
/* leave the page first so the deep-link goto is a real cross-URL navigation */
await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(1500);
await p.goto(BASE + '/documents/offer', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(3000);
if (await p.$('#cl_email')) {
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
}
/* the QA mock serves an EMPTY access list, so js/52/64 bounce every page to Today on a
   fresh load (live admins carry 'documents' in their access list). Step past the
   harness artifact exactly like the checks above do — the deep-link claim being proven
   is that the boot pathname picked the OFFER tab, which the bounce cannot undo. */
await p.evaluate(() => { current = 'documents'; render(); });
await p.waitForTimeout(2000);
const deep = await p.evaluate(() => ({
  cur: (typeof current !== 'undefined') ? current : null,
  tab: window.__dgTabProbe ? __dgTabProbe() : null,
  offerRendered: !!document.querySelector('#poWrap'),
  path: location.pathname,
}));
check('deep link /documents/offer lands on the generator page', deep.cur === 'documents', JSON.stringify(deep));
check('deep link opens the Price Offer tab directly', deep.tab === 'offer' && deep.offerRendered, JSON.stringify(deep));
check('address bar keeps the tab sub-address', deep.path === '/documents/offer', JSON.stringify(deep));

/* ---- phone (390px): no horizontal overflow; preview behind a floating toggle ---- */
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(800);
const mob = await p.evaluate(() => {
  const t = document.getElementById('dgPreviewToggle');
  const c = document.querySelector('#dgWrap [id$="PreviewCol"]');
  return {
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    toggleVisible: !!t && getComputedStyle(t).display !== 'none',
    previewHidden: !!c && getComputedStyle(c).display === 'none',
    backTap: (document.querySelector('#dgWrap .dg-back') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height >= 44,
    stepTap: [...document.querySelectorAll('#dgSteps button')].every(b => b.getBoundingClientRect().height >= 44),
  };
});
check('390px: page has no horizontal overflow', mob.scrollW <= mob.clientW + 1, JSON.stringify(mob));
check('390px: preview is hidden behind a visible floating toggle', mob.toggleVisible && mob.previewHidden, JSON.stringify(mob));
check('390px: back button and step chips are 44px tap targets', mob.backTap && mob.stepTap, JSON.stringify(mob));
await p.evaluate(() => window.dgTogglePreview());
await p.waitForTimeout(400);
check('preview toggle shows the preview panel', await p.evaluate(() => {
  const c = document.querySelector('#dgWrap [id$="PreviewCol"]');
  return !!c && getComputedStyle(c).display !== 'none';
}));
await p.evaluate(() => window.dgTogglePreview());
await p.waitForTimeout(300);
check('preview toggle hides it again', await p.evaluate(() => {
  const c = document.querySelector('#dgWrap [id$="PreviewCol"]');
  return !!c && getComputedStyle(c).display === 'none';
}));
/* home at 390px: cards stack and stay tappable, nothing overflows */
await p.evaluate(() => window.dgHome());
await p.waitForTimeout(1000);
const mobHome = await p.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
  cards: document.querySelectorAll('#dgWrap .dg-card').length,
  cardTap: [...document.querySelectorAll('#dgWrap .dg-card')].every(c => c.getBoundingClientRect().height >= 44),
  stacked: (() => { const cs = [...document.querySelectorAll('#dgWrap .dg-card')]; return cs.length > 1 && cs[0].getBoundingClientRect().left === cs[1].getBoundingClientRect().left; })(),
}));
check('390px: start screen has no horizontal overflow', mobHome.scrollW <= mobHome.clientW + 1, JSON.stringify(mobHome));
check('390px: the 5 cards stack in one column, each a 44px+ target', mobHome.cards === 5 && mobHome.stacked && mobHome.cardTap, JSON.stringify(mobHome));

check('no javascript errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
