/* probe-a-document-never-invents-the-company.mjs — a wrong identifier is worse than a missing one.

   Found on 2026-09-21 (fire #160) by failing one request against the real database. All five
   client-document tabs — price offer, service fees, company profile, contract, tender — print a
   footer carrying the company's legal name, its unified number and its tourism-licence number, and
   all five read those from the `company_identity` registry. Every one of them treated a FAILED read
   as an empty one, and then filled the gap from literals written into the code.

   Those literals had drifted. Each was ONE DIGIT SHORT of what the registry holds. So a quotation,
   a contract or a tender built while that single request was failing went out with a unified number
   and a licence number that are not the company's — measured, not deduced: with the registry
   reachable the footer printed the registry's values, and with it failing the same footer printed
   two different, shorter numbers.

   A missing identifier is a gap somebody notices. A wrong one is sent.

   What this holds:
     1. with the registry failing, the document prints NEITHER number — and not the label either,
        so there is no dangling "unified number:" with nothing after it;
     2. the page says so, above the editor, where the person building the document will see it;
     3. no tab carries a fallback literal any more — checked in the source, so a future re-introduction
        is caught even if the runtime path changes. (The check names no numbers: the company's own
        registered identifiers belong in the database, not in a public repository — rule 7.)
     4. the notice is in Arabic on the Arabic side;
     5. with the registry reachable there is no notice, and both numbers print — the fix must not
        cost the document its footer;
     6. the IATA-wakeel disclosure keeps its owner-approved wording, with the number filled from the
        registry — and is left out entirely when the registry has no number, because a disclosure
        you cannot complete is not one you may make.

   Check 5 is the one that keeps it honest: the cheap way to pass 1-3 is to stop printing the footer.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting a fallback
   literal back into js/67's regNum call fails checks 1 and 3, and check 1 prints the invented number.
   Run: node scripts/qa/probe-a-document-never-invents-the-company.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9111; const BASE = 'http://localhost:' + PORT;
const APP = process.env.APP_DIR || path.resolve(new URL('../..', import.meta.url).pathname);

/* synthetic values — the real ones stay in the database */
const UNN = '7000000001', LIC = '70000001', IATA = '99000022';
const IDENTITY = [
  { id: 'ci1', key: 'legal_name', category: 'legal', value_en: 'QA Placeholder Trading Co.', value_ar: 'شركة اختبار', sort: 1, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false, label_en: 'Legal name', label_ar: 'الاسم القانوني' },
  { id: 'ci2', key: 'cr_number', category: 'legal', value_en: '0000000000', value_ar: null, sort: 2, expires_on: '2027-01-31', proof_path: null, show_on_documents: true, sensitive: false, label_en: 'CR', label_ar: 'السجل' },
  { id: 'ci3', key: 'vat_number', category: 'tax', value_en: '300000000000003', value_ar: null, sort: 3, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false, label_en: 'VAT', label_ar: 'الضريبي' },
  { id: 'ci8', key: 'unified_number', category: 'legal', value_en: UNN, value_ar: null, sort: 8, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false, label_en: 'Unified number', label_ar: 'الرقم الموحد' },
  { id: 'ci10', key: 'iata', category: 'membership', value_en: IATA, value_ar: null, sort: 10, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false, label_en: 'IATA', label_ar: 'إياتا' },
  { id: 'ci9', key: 'mot_licence', category: 'legal', value_en: LIC, value_ar: null, sort: 9, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false, label_en: 'Tourism licence', label_ar: 'رقم الترخيص' },
];

const srv = start(PORT, { company_identity: IDENTITY });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(lang, failIdentity) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (failIdentity && /\/rest\/v1\/company_identity/.test(u.pathname) && ['GET', 'HEAD'].includes(m)) {
      await r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'simulated outage' }) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { openLead = null; current = 'documents'; render(); } catch (_) { } });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { try { dgGo('offer'); } catch (_) { } });
  await p.waitForTimeout(2200);
  /* walk to the Review step, where the document itself is drawn */
  await p.evaluate(() => {
    const v = document.getElementById('view');
    const el = [].slice.call(v.querySelectorAll('button,[role=button],.step,a')).find((x) => /^3\s*·|Review|المراجعة/i.test((x.innerText || '').trim()));
    if (el) el.click();
  });
  await p.waitForTimeout(2600);
  const out = await p.evaluate(() => {
    const v = document.getElementById('view');
    const doc = v.querySelector('#poPages');
    return { doc: doc ? (doc.innerText || '').replace(/\s+/g, ' ') : '',
      notice: !!v.querySelector('.v87-identity'),
      noticeText: (v.querySelector('.v87-identity') || {}).innerText || '',
      noticeNoPrint: !!(v.querySelector('.v87-identity') && /noprint/.test(v.querySelector('.v87-identity').className)) };
  });
  await ctx.close();
  return out;
}

const broke = await run('en', true);
const brokeAr = await run('ar', true);
const fine = await run('en', false);
await b.close(); srv.close?.();

/* source check — no tab may carry a fallback literal for these numbers again */
const TABS = ['js/67-price-offer-tab.js', 'js/68-service-fees-tab.js', 'js/69-company-profile-tab.js', 'js/70-contract-tab.js', 'js/71-tender-tab.js'];
const withLiteral = TABS.filter((f) => {
  try { return /regNum\(\[[^\]]*\]\s*,/.test(fs.readFileSync(path.join(APP, f), 'utf8')); } catch (_) { return false; }
});

const LABEL_UNN = 'الرقم الموحد';   /* الرقم الموحد */
const LABEL_LIC = 'رقم الترخيص';         /* رقم الترخيص */
const checks = [
  ['with the registry failing the document prints neither number, and not the label either',
    broke.doc.indexOf(UNN) < 0 && broke.doc.indexOf(LIC) < 0 && broke.doc.indexOf(LABEL_UNN) < 0 && broke.doc.indexOf(LABEL_LIC) < 0,
    broke.doc.slice(-90)],
  ['the page says so, above the editor, and the notice does not print',
    broke.notice && /did not load/i.test(broke.noticeText) && broke.noticeNoPrint, broke.noticeText.slice(0, 90)],
  ['no tab carries a fallback literal any more — checked in the source',
    withLiteral.length === 0, JSON.stringify(withLiteral)],
  ['the notice is in Arabic on the Arabic side',
    brokeAr.notice && /[؀-ۿ]/.test(brokeAr.noticeText), brokeAr.noticeText.slice(0, 70)],
  ['with the registry reachable there is no notice, and both numbers print',
    !fine.notice && fine.doc.indexOf(UNN) >= 0 && fine.doc.indexOf(LIC) >= 0, fine.doc.slice(-90)],
  ['the IATA disclosure carries its exact wording with the registry\'s number, and vanishes without one',
    fine.doc.indexOf('IATA-accredited agent (Wakeel) No. ' + IATA + ' acting as agent for the carriers.') >= 0
      && broke.doc.indexOf('IATA-accredited agent') < 0,
    (fine.doc.match(/Direct is an IATA[^.]{0,70}\./) || ['(missing)'])[0]],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
