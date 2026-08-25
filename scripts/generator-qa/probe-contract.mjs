/* Generator probe #5 — the Contract / Agreement tab (family CTR) on the engine.

   What it proves:
   1. Static: js/70 contains no copied brand hex, never mentions localStorage,
      never mentions the excluded vendors (M2), and registers family CTR only.
   2. The 5th tab is registered: the tab bar shows 5 buttons and the
      /documents/contract deep link opens the contract tab through the seam.
   3. AR is the DEFAULT document language and renders strict RTL.
   4. Clauses render in the real signed-agreement order; a DISABLED optional
      clause (force majeure) never renders.
   5. The notice-days field substitutes into the term clause ({{notice_days}}).
   6. OVERRIDE ISOLATION: editing a clause inside a contract changes only the
      contract's payload — the probe asserts NO PATCH ever reaches
      contract_clauses during the edit (sabotage mode strips this isolation
      and the probe must exit non-zero).
   7. Fee annex imports sections/rows/col2 from a saved SFP proposal fixture
      for the same client, and renders them.
   8. Signature grid: two party blocks each carrying CR / represented-by /
      title / phone / signature / date lines; Direct's signatory is EMPTY by
      default (owner decision — never invented).
   9. Draft save POSTs family CTR, status draft, NO doc_number; payload
      snapshots clauses + annex + party2.
  10. The Issue button carries data-v21relabeled; no localStorage writes from
      js/70; no js errors.
   Fixture data is synthetic (D4: nothing real in the repo).

   Run:            node scripts/generator-qa/probe-contract.mjs
   Sabotage test:  node scripts/generator-qa/probe-contract.mjs --sabotage
                   (serves a copy whose ctClauseSave ALSO writes the shared
                    contract_clauses template — a per-contract edit would leak
                    into every future contract; the probe MUST exit 1, and the
                    wrapper inverts that to PASS) */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from '../qa/mock-supabase.mjs';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const SABOTAGE = process.argv.includes('--sabotage');

if (SABOTAGE) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-sab-'));
  fs.cpSync(REPO + '/index.html', tmp + '/index.html');
  fs.cpSync(REPO + '/js', tmp + '/js', { recursive: true });
  fs.cpSync(REPO + '/brand', tmp + '/brand', { recursive: true });
  const f = tmp + '/js/70-contract-tab.js';
  const src = fs.readFileSync(f, 'utf8');
  const needle = "c.override=true;                       /* per-contract override; template untouched */";
  if (!src.includes(needle)) { console.log('FAIL  sabotage setup: override marker not found to corrupt'); process.exit(1); }
  /* corrupt the ISOLATION: the per-contract save now ALSO writes the shared template */
  fs.writeFileSync(f, src.split(needle).join(
    "c.override=true; try{client().from('contract_clauses').update({body_en:c.body_en,body_ar:c.body_ar}).eq('key',key).select().then(function(){},function(){});}catch(_){}"
  ));
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, APP_DIR: tmp }, stdio: 'pipe', encoding: 'utf8' });
  const failedAsItShould = r.status !== 0;
  console.log(failedAsItShould
    ? 'PASS  sabotage: with override isolation stripped (contract edits leaking into the shared template) the probe exits non-zero'
    : 'FAIL  sabotage: the probe still passed while contract edits leaked into contract_clauses — it is not actually checking');
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
  const src = fs.readFileSync(APP + '/js/70-contract-tab.js', 'utf8');
  const hexes = ['F06820', 'F87020', 'F47A1F', 'FBAE16', 'E54525', 'F26721', 'FF6C00', '323E49', '303848'];
  const found = hexes.filter(h => new RegExp(h, 'i').test(src));
  check('js/70 contains no copied brand hex', found.length === 0, 'found: ' + found.join(','));
  check('js/70 never mentions localStorage', !/localStorage/.test(src));
  check('js/70 never mentions the excluded vendors (M2, static)', !/takamol|techtic|تكامل/i.test(src));
  check('js/70 registers family CTR only', /family:'CTR'/.test(src) && !/family:'SFP',/.test(src) && !/family:'PRF'/.test(src));
}

/* live page */
const PORT = 8875; process.env.APP_DIR = APP; start(PORT); const BASE = 'http://localhost:' + PORT;
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
const CLAUSES = [
  { key: 'preamble', title_en: 'Preamble', title_ar: 'تمهيد', body_en: 'SYNTH preamble. [Edit per agreement]', body_ar: 'تمهيد اختباري. [يُحرَّر حسب الاتفاق]', optional: false, enabled: true, sort: 10 },
  { key: 'scope', title_en: 'Scope of Services', title_ar: 'نطاق الخدمات', body_en: 'SYNTH scope. [Edit per agreement]', body_ar: 'نطاق اختباري. [يُحرَّر حسب الاتفاق]', optional: false, enabled: true, sort: 20 },
  { key: 'financial', title_en: 'Financial Terms', title_ar: 'الشروط المالية', body_en: 'SYNTH financial.', body_ar: 'شروط مالية اختبارية.', optional: false, enabled: true, sort: 30 },
  { key: 'obligations_p1', title_en: 'Obligations of the First Party', title_ar: 'التزامات الطرف الأول', body_en: 'SYNTH p1.', body_ar: 'التزامات أول اختبارية.', optional: false, enabled: true, sort: 40 },
  { key: 'channels', title_en: 'Communication & Booking Channels', title_ar: 'طرق التواصل والحجز', body_en: 'SYNTH channels.', body_ar: 'قنوات اختبارية.', optional: false, enabled: true, sort: 50 },
  { key: 'obligations_p2', title_en: 'Obligations of the Second Party', title_ar: 'التزامات الطرف الثاني', body_en: 'SYNTH p2.', body_ar: 'التزامات ثانٍ اختبارية.', optional: false, enabled: true, sort: 60 },
  { key: 'confidentiality', title_en: 'Confidentiality', title_ar: 'السرية', body_en: 'SYNTH confidentiality.', body_ar: 'سرية اختبارية.', optional: false, enabled: true, sort: 70 },
  { key: 'term', title_en: 'Term & Termination', title_ar: 'المدة والإنهاء', body_en: 'Notice of ({{notice_days}}) days.', body_ar: 'إشعار قبل ({{notice_days}}) يوماً.', optional: false, enabled: true, sort: 80 },
  { key: 'disputes', title_en: 'Dispute Resolution', title_ar: 'تسوية النزاعات', body_en: 'Amicable then arbitration, KSA law.', body_ar: 'ودياً ثم التحكيم وفق أنظمة المملكة.', optional: false, enabled: true, sort: 90 },
  { key: 'force_majeure', title_en: 'SYNTH-FM-HIDDEN', title_ar: 'القوة القاهرة المخفية', body_en: 'Must NEVER render while disabled.', body_ar: 'يجب ألا يظهر.', optional: true, enabled: false, sort: 130 },
];
let clausePatches = 0;
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/contract_clauses**', r => {
  const m = r.request().method();
  if (m === 'PATCH') {
    clausePatches++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([CLAUSES[0]]) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CLAUSES) });
});

const IDENTITY = [
  { key: 'legal_name', label_en: 'Legal name', label_ar: 'الاسم القانوني', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار للسفر', show_on_documents: true, sensitive: false, sort: 1 },
  { key: 'cr_number', label_en: 'CR number', label_ar: 'السجل التجاري', value_en: '9999999999', value_ar: null, show_on_documents: true, sensitive: false, sort: 2 },
  { key: 'vat_number', label_en: 'VAT number', label_ar: 'الرقم الضريبي', value_en: '399999999900003', value_ar: null, show_on_documents: true, sensitive: false, sort: 3 },
  { key: 'website', label_en: 'Website', label_ar: 'الموقع', value_en: 'www.example.test', value_ar: null, show_on_documents: true, sensitive: false, sort: 4 },
  { key: 'phone_licence', label_en: 'Phone', label_ar: 'الهاتف', value_en: '000 000 0000', value_ar: null, show_on_documents: true, sensitive: false, sort: 5 },
];
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IDENTITY) }));

/* saved SFP proposal fixture for the same client — the annex import source */
const SFP_DOC = {
  id: 'aaaaaaaa-1111-2222-3333-444444444444', doc_number: 'SFP-2026-001', title: 'Synthetic proposal',
  status: 'sent', business_id: 'qa-biz-1', created_at: '2026-08-01T00:00:00Z',
  payload: {
    col2: { on: true, head1En: 'Company rate', head1Ar: 'سعر الشركة', headEn: 'Employee rate', headAr: 'سعر الموظف' },
    sections: [{ tEn: 'SYNTH-Flights', tAr: 'طيران اختباري', rows: [
      { en: 'SYNTH domestic ticket', ar: 'تذكرة داخلية اختبارية', fee: '25', fee2: '50', total: false, free: false },
      { en: 'SYNTH change fee', ar: 'رسوم تغيير اختبارية', fee: '0', fee2: '', total: false, free: true }] }]
  }
};
let draftPost = null;
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/generated_documents**', async r => {
  const rq = r.request(); const url = rq.url();
  if (rq.method() === 'POST') {
    try { draftPost = JSON.parse(rq.postData() || 'null'); } catch (_) { draftPost = { parseError: true }; }
    const row = Object.assign({ id: '55555555-6666-7777-8888-999999999999', created_at: new Date().toISOString() },
      Array.isArray(draftPost) ? draftPost[0] : draftPost);
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
  }
  if (url.includes('family=eq.SFP'))
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SFP_DOC]) });
  return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

/* deep link straight to the 5th tab */
await p.goto(BASE + '/documents/contract', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(2500);
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);
await p.evaluate(() => { window.__userRole = window.__userRole || 'admin'; current = 'documents'; render(); });
await p.waitForTimeout(1800);

/* 2 — 5th tab registered + deep link works */
check('tab bar shows 5 tabs (contract added to TABS)', await p.evaluate(() =>
  document.querySelectorAll('#dgWrap .dg-tabs button').length === 5));
check('a tab button is labelled Contract / العقد', await p.evaluate(() =>
  [...document.querySelectorAll('#dgWrap .dg-tabs button')].some(x => /العقد/.test(x.textContent))));
check('/documents/contract deep link opens the contract tab', await p.evaluate(() =>
  window.__dgTabProbe && window.__dgTabProbe() === 'contract'));
check('contract tab renders through the seam (form present)', await p.evaluate(() => !!document.querySelector('#ctWrap .ct-form')));
check('A4 preview renders under data-identity="classic"', await p.evaluate(() =>
  !!document.querySelector('#ctPreviewCol[data-identity="classic"] .ct-page')));
check('unissued contract carries the diagonal DRAFT watermark', await p.evaluate(() =>
  !!document.querySelector('#ctPages .ct-wm span')));

/* 3 — AR is the DEFAULT and renders strict RTL */
check('AR is the default document language and the page is RTL', await p.evaluate(() => {
  const pg = document.querySelector('#ctPages .ct-page');
  return window.__ctProbe().lang === 'ar' && !!pg && pg.classList.contains('ar') &&
    getComputedStyle(pg).direction === 'rtl';
}));
{
  const txt = await p.evaluate(() => document.getElementById('ctPages')?.innerText || '');
  check('AR default title renders (اتفاقية تقديم خدمات سفر وسياحة)', txt.includes('اتفاقية تقديم خدمات سفر وسياحة'));
  check('clauses render in the signed-agreement order (تمهيد → نطاق → مالية → … → نزاعات)', (() => {
    const order = ['تمهيد', 'نطاق الخدمات', 'الشروط المالية', 'التزامات الطرف الأول', 'طرق التواصل والحجز', 'التزامات الطرف الثاني', 'السرية', 'المدة والإنهاء', 'تسوية النزاعات'];
    let last = -1;
    for (const o of order) { const i = txt.indexOf(o); if (i < 0 || i < last) return false; last = i; }
    return true;
  })(), 'order broken');
  check('DISABLED optional clause never renders (force majeure absent)',
    !txt.includes('القوة القاهرة المخفية') && !txt.includes('SYNTH-FM-HIDDEN'));
  check('notice-days field substitutes into the term clause (default 30)', txt.includes('(30)'));
  check('rendered page never mentions the excluded vendors (M2, dynamic)', !/takamol|techtic|تكامل/i.test(txt));
}

/* notice days editable */
await p.evaluate(() => ctSet('noticeDays', '7'));
await p.waitForTimeout(600);
check('changing notice days reprints the term clause ((7) appears)', await p.evaluate(() =>
  (document.getElementById('ctPages')?.innerText || '').includes('(7)')));

/* 4 — signature grid: both parties, all fields; Direct signatory EMPTY */
{
  const grid = await p.evaluate(() => {
    const pts = [...document.querySelectorAll('#ctPages .ct-sign .pt')];
    return { n: pts.length, txt: pts.map(x => x.innerText).join('\n') };
  });
  check('signature grid renders two party blocks', grid.n === 2);
  check('signature blocks carry السجل التجاري / يمثلها / الصفة / الهاتف / التوقيع / التاريخ',
    ['السجل التجاري', 'يمثلها', 'الصفة', 'الهاتف', 'التوقيع', 'التاريخ'].every(k => grid.txt.includes(k)));
  check('Direct signatory is EMPTY by default (owner decision, never invented)', await p.evaluate(() => {
    /* the party-1 rep/title inputs are blank */
    const ins = [...document.querySelectorAll('#ctWrap input')]
      .filter(i => String(i.getAttribute('oninput') || '').includes("'party1'"));
    return ins.length === 2 && ins.every(i => i.value === '');
  }));
}

/* 5 — override isolation: editing a clause inside the contract never PATCHes contract_clauses */
const patchesBefore = clausePatches;
await p.evaluate(() => {
  ctClauseEdit('scope');
});
await p.waitForTimeout(500);
await p.evaluate(() => {
  document.getElementById('ctE_bar').value = 'نص معدل لهذا العقد فقط SYNTH-OVERRIDE';
  ctClauseSave('scope');
});
await p.waitForTimeout(1200);
check('per-contract clause edit renders in the preview (SYNTH-OVERRIDE)', await p.evaluate(() =>
  (document.getElementById('ctPages')?.innerText || '').includes('SYNTH-OVERRIDE')));
check('the edited clause is flagged override:true in the payload', await p.evaluate(() =>
  window.__ctProbe().clauses.find(c => c.key === 'scope')?.override === true));
check('editing inside a contract sends NO PATCH to contract_clauses (override isolation)',
  clausePatches === patchesBefore, 'PATCH count went ' + patchesBefore + ' → ' + clausePatches);
/* reset restores the template text */
await p.evaluate(() => ctClauseReset('scope'));
await p.waitForTimeout(600);
check('reset-to-template restores the shared text and clears the override flag', await p.evaluate(() =>
  !(document.getElementById('ctPages')?.innerText || '').includes('SYNTH-OVERRIDE') &&
  window.__ctProbe().clauses.find(c => c.key === 'scope')?.override === false));

/* 6 — fee annex import from the saved SFP proposal for the same client */
await p.evaluate(() => {
  try { DB.businesses = DB.businesses || []; DB.businesses.push({ id: 'qa-biz-1', name: 'Synthetic Client LLC', nameAr: 'شركة عميل اختبارية', isClient: true }); } catch (_) {}
  ctSet('clientId', 'qa-biz-1');
});
await p.waitForTimeout(1800);
check('the import dropdown offers the saved proposal by number', await p.evaluate(() =>
  [...document.querySelectorAll('#ctWrap select option')].some(o => o.textContent.includes('SFP-2026-001'))));
await p.evaluate(() => ctImportSFP('aaaaaaaa-1111-2222-3333-444444444444'));
await p.waitForTimeout(900);
{
  const txt = await p.evaluate(() => document.getElementById('ctPages')?.innerText || '');
  check('imported fee rows render in the annex (AR strings, dual columns)',
    txt.includes('تذكرة داخلية اختبارية') && txt.includes('طيران اختباري') && txt.includes('سعر الموظف'));
  check('annex heading ملحق الرسوم renders', txt.includes('ملحق الرسوم'));
  check('import records its source proposal number', await p.evaluate(() =>
    window.__ctProbe().importedFrom === 'SFP-2026-001'));
}

/* 7 — draft save: family CTR, status draft, no client-side number */
await p.evaluate(() => ctSaveDraft());
await p.waitForTimeout(1500);
check('draft save POSTed to generated_documents', !!draftPost);
if (draftPost) {
  const body = Array.isArray(draftPost) ? draftPost[0] : draftPost;
  check('POST body: family is CTR', body.family === 'CTR');
  check('POST body: status is draft', body.status === 'draft');
  check('POST body: NO doc_number on a draft (numbering is issue-time, server-side)', body.doc_number == null);
  check('POST body: contract links the picked business', body.business_id === 'qa-biz-1');
  check('POST body: payload snapshots clauses + annex + party2',
    !!body.payload && Array.isArray(body.payload.clauses) && body.payload.clauses.length === CLAUSES.length
    && !!body.payload.annex && body.payload.annex.sections.length === 1
    && !!body.payload.party2);
}

/* 8 — relabeler trap + storage + errors */
check('Issue button carries data-v21relabeled (core-06 relabeler trap)', await p.evaluate(() => {
  const btn = [...document.querySelectorAll('#ctWrap button')].find(x => /Issue|إصدار العقد/.test(x.textContent));
  return !!btn && btn.getAttribute('data-v21relabeled') === 'true';
}));
const ls = await p.evaluate(() => (window.__lsWrites || []).filter(x => x.stack.includes('70-contract')));
check('no localStorage.setItem call originates from js/70', ls.length === 0,
  ls.slice(0, 2).map(x => x.key).join(','));
check('no javascript errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
