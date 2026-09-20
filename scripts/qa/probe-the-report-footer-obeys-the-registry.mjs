/* probe-the-report-footer-obeys-the-registry.mjs — the strip at the foot of the report was still
   advertising a lapsed certification.

   Fire #162. Fire #139 taught the About one-pager to obey the company registry: a credential that
   the owner's own instrument records as expired, or marks "not on documents", is stripped out of
   the document. Two places it never reached were the footer of the **monthly report** and the last
   slide of the **PowerPoint export** — both one hardcoded string, and that string said:

       … · IATA <number> · Amadeus <office> · PCI-DSS · <website> · <old phone>

   Checked against the live registry the same day: **PCI-DSS expired 2026-07-14 and is marked not
   for documents.** So a report printed for a client, and a deck attached to a tender, both claimed
   a certification the company no longer holds — the same claim, in the same words, that #139 had
   already removed from the one-pager. The Amadeus office is marked not-for-documents too, and the
   phone was the older number rather than the licence phone.

   Now both are built from the registry and put through the same filter, so "may we print this?" has
   one answer in one place for every document.

   What this holds:
     1. the footer prints what the registry holds — the legal name, the IATA number, the contact;
     2. it does NOT print a credential the registry marks expired or not-for-documents;
     3. with the registry not loaded, there is no footer at all — nothing is printed from memory;
     4. neither the footer helper nor the offer's IATA disclosure carries a number in the source; the
        disclosure keeps its owner-approved wording with a placeholder. (This check names no number:
        the company's identifiers belong in the database — rule 7.)
     5. no JS errors.

   Check 2 is the point of the round, and check 3 is what stops it being solved by remembering.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting "PCI-DSS"
   and a hardcoded IATA number back into the footer fails checks 2, 3 and 4 — and check 3 shows why
   it matters, printing both of them onto a report built while the registry was unreachable.
   Run: node scripts/qa/probe-the-report-footer-obeys-the-registry.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9113; const BASE = 'http://localhost:' + PORT;
const APP = process.env.APP_DIR || path.resolve(new URL('../..', import.meta.url).pathname);

const LEGAL = 'QA Placeholder Travel Company Ltd';
const IATA = '99000033', SITE = 'www.qa-example.test', TEL = '+966 11 000 0001';
const IDENTITY = [
  { id: 'r1', key: 'legal_name', category: 'legal', label_en: 'Legal name', label_ar: 'الاسم', value_en: LEGAL, value_ar: null, sort: 1, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false },
  { id: 'r2', key: 'iata', category: 'membership', label_en: 'IATA', label_ar: 'إياتا', value_en: IATA, value_ar: null, sort: 2, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false },
  { id: 'r3', key: 'website', category: 'contact', label_en: 'Website', label_ar: 'الموقع', value_en: SITE, value_ar: null, sort: 3, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false },
  { id: 'r4', key: 'phone_licence', category: 'contact', label_en: 'Phone', label_ar: 'الهاتف', value_en: TEL, value_ar: null, sort: 4, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false },
  /* the one that must NOT print: expired, and marked not-for-documents — exactly the live shape */
  { id: 'r5', key: 'pci_dss', category: 'membership', label_en: 'PCI-DSS', label_ar: 'PCI-DSS', value_en: 'Certified', value_ar: null, sort: 5, expires_on: '2026-07-14', proof_path: null, show_on_documents: false, sensitive: false },
];

const srv = start(PORT, { company_identity: IDENTITY });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(failRegistry) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (failRegistry && /\/rest\/v1\/company_identity/.test(u.pathname) && ['GET', 'HEAD'].includes(m)) {
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
  await p.waitForTimeout(9000);                 /* the registry loads eagerly after sign-in */
  await p.evaluate(() => { try { openLead = null; current = 'reports'; render(); } catch (_) { } });
  await p.waitForTimeout(2000);
  await p.evaluate(() => {
    const v = document.getElementById('view');
    const el = [].slice.call(v.querySelectorAll('button,a,[role=button]')).find((x) => /generate report|إنشاء تقرير/i.test((x.innerText || '').trim()));
    if (el) el.click();
  });
  await p.waitForTimeout(1800);
  const out = await p.evaluate(() => {
    try { rptBuildReport(); } catch (_) { }
    const d = document.getElementById('rptdoc');
    return d ? (d.innerText || '').replace(/\s+/g, ' ') : '(no report)';
  });
  await ctx.close();
  return out;
}

const good = await run(false);
const broke = await run(true);
await b.close(); srv.close?.();

/* source checks — name-free */
let helper = '', offerEn = '', offerAr = '';
try {
  const c10 = fs.readFileSync(path.join(APP, 'js/core/core-10-v29-reports.js'), 'utf8');
  const i = c10.indexOf('function rptFootBits(');
  helper = i >= 0 ? c10.slice(i, c10.indexOf('\n  }', i)) : '';
  const o = fs.readFileSync(path.join(APP, 'js/67-price-offer-tab.js'), 'utf8');
  offerEn = (o.match(/iata:'Direct is an IATA[^']*'/) || [''])[0];
  offerAr = (o.match(/iata:'[^']*إياتا[^']*'/) || [''])[0];
} catch (_) { }

const checks = [
  ['the footer prints what the registry holds — legal name, IATA, contact',
    good.indexOf(LEGAL) >= 0 && good.indexOf(IATA) >= 0 && good.indexOf(SITE) >= 0 && good.indexOf(TEL) >= 0,
    good.slice(-120)],
  ['it does NOT print a credential the registry marks expired or not-for-documents',
    !/PCI/i.test(good.slice(-300)), good.slice(-160)],
  ['with the registry not loaded there is no footer at all — nothing printed from memory',
    broke.indexOf(LEGAL) < 0 && broke.indexOf(IATA) < 0 && broke.indexOf(SITE) < 0 && !/PCI/i.test(broke),
    broke.slice(-120)],
  ['neither the footer helper nor the offer disclosure carries a number in the source',
    helper.length > 0 && !/\d{5,}/.test(helper)
      && offerEn.indexOf('{n}') >= 0 && !/\d{5,}/.test(offerEn)
      && offerAr.indexOf('{n}') >= 0 && !/\d{5,}/.test(offerAr),
    JSON.stringify({ helper: !!helper, en: offerEn.slice(0, 45), ar: offerAr.length })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
