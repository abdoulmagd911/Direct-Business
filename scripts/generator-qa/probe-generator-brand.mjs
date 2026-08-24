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
  { key: 'legal_name', category: 'legal', label_en: 'Legal name', label_ar: 'الاسم القانوني', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار', expires_on: null, source: 'fixture', sensitive: false, show_on_documents: true, sort: 10 },
  { key: 'cr_number', category: 'legal', label_en: 'CR', label_ar: 'السجل', value_en: '9999999999', value_ar: null, expires_on: '2020-01-01', source: 'fixture', sensitive: false, show_on_documents: true, sort: 20 },
  { key: 'iban_test', category: 'banking', label_en: 'Test IBAN', label_ar: 'آيبان', value_en: 'SA0000000000000000000000', value_ar: null, expires_on: null, source: 'fixture', sensitive: true, show_on_documents: true, sort: 60 },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) }));

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
}

/* page render */
const txt = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
check('Documents nav entry present', await p.evaluate(() =>
  [...document.querySelectorAll('#nav button')].some(x => /Documents|المستندات/.test(x.textContent))));
check('tabs render (4 families)', await p.evaluate(() => document.querySelectorAll('#dgWrap .dg-tabs button').length) === 4);
check('registry rows render from data', txt.includes('Synthetic Test Co Ltd'));
check('renewals radar shows EXPIRED for the past date', /EXPIRED|منتهية/.test(txt));
check('sensitive value is masked until revealed', !txt.includes('SA0000000000000000000000') && /hidden|مخفي/.test(txt));
await p.evaluate(() => { const b = [...document.querySelectorAll('#dgWrap button')].find(x => /^(Show|عرض)$/.test(x.textContent.trim())); if (b) b.click(); });
await p.waitForTimeout(600);
const txt2 = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
check('reveal shows the value on demand', txt2.includes('SA0000000000000000000000'));
check('no javascript errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
