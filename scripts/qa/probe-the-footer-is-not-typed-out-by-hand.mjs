/* probe-the-footer-is-not-typed-out-by-hand.mjs — the company's own name, on the company's own
   document, in the language the document is written in.

   Fire #185. Fire #160 took the invented NUMBERS out of the shared document footer one round
   earlier and left two things in it typed out by hand, identically in all five client-facing
   documents:

     · the branch list, as an ENGLISH sentence;
     · the trade name, as an ARABIC one.

   Both live in the `company_identity` registry, in both languages, both flagged
   show_on_documents — so the registry was being ignored for exactly the two values it holds.
   Read off the produced document: the ARABIC quotation carried an English branches sentence, and
   the ENGLISH quotation carried the Arabic trade name and never the English one. The registry's
   own English branch list turned out to name one more site than the hand-typed sentence did, which
   is the other half of the cost: a name typed into five files does not change when the owner
   changes it in the registry. The two numeric labels beside them were Arabic-only for the same
   reason, so an English document carried Arabic words around its own registered numbers.

   What this holds:
     1. on the ENGLISH document the branch list and the trade name are the registry's English
        values, character for character;
     2. and the footer's own text carries no Arabic — including the labels;
     3. on the ARABIC document both are the registry's Arabic values;
     4. and the footer's own text carries no English sentence;
     5. the values are genuinely read, not copied: a registry serving different values produces a
        different footer;
     6. no hand-typed branch sentence or trade name is left in any of the five sources — checked in
        the source, so a re-introduction is caught even if the runtime path changes;
     7. when the registry has no branches and no legal name, those lines are absent and there is no
        dangling label with nothing after it;
     8. the registered numbers still print, with their labels, in the document's language — #160's
        footer must survive this;
     9. every document that draws this footer agrees — it is one shared footer, so a fix in one
        file is not a fix. The Company Profile draws it on its section pages, which the harness has
        no data for, so for that one check 6's source test is the coverage;
    10. no JS errors.

   Checks 5, 7 and 8 are the brakes. Swapping one set of literals for another would pass 1-4;
   dropping the whole footer would pass 2, 4 and 6; and a label printed with no value is the
   failure #160 named.

   No registry VALUE is written in this file — the fixture's are synthetic and the real ones stay
   in the database (rule 7).
   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the
   hand-typed sentences back into js/67 fails checks 1, 3, 4, 6 and 9.
   Run: node scripts/qa/probe-the-footer-is-not-typed-out-by-hand.mjs                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const APP = process.env.APP_DIR || process.cwd();
/* PORTS_RESERVED: 9173-9179 — this probe opens seven mocks: PORT, PORT+1, PORT+2, PORT+3 and
   PORT+4+i for three tabs. The step of that last one is computed, so check-probe-integrity
   cannot count it from the source; declaring the span here makes it exact instead of reserved
   conservatively. Fire #188 exists because those offset ports were counted by nothing at all. */
const PORT = 9173; const BASE = 'http://localhost:' + PORT;

/* synthetic — deliberately unlike anything the company actually uses */
const BR_EN = 'QA-Alpha, QA-Beta and QA-Gamma';
const BR_AR = 'مدينة ألفا ومدينة بيتا';
const LN_EN = 'QA Placeholder Trading Co.';
const LN_AR = 'شركة اختبار للسفر';
const UNN = '7000000001', LIC = '70000001';

const ident = (o) => Object.assign({ id: 'x', category: 'legal', value_ar: null, sort: 1, expires_on: null,
  issued_on: null, proof_path: null, show_on_documents: true, sensitive: false, source: 'QA',
  label_en: 'L', label_ar: 'ل', updated_at: '2026-09-01T00:00:00Z', updated_by: null, download_name: null }, o);

const FULL = [
  ident({ id: 'q1', key: 'legal_name', value_en: LN_EN, value_ar: LN_AR, label_en: 'Legal name', label_ar: 'الاسم التجاري' }),
  ident({ id: 'q2', key: 'branches', category: 'contact', value_en: BR_EN, value_ar: BR_AR, label_en: 'Branches', label_ar: 'الفروع' }),
  ident({ id: 'q3', key: 'unified_number', value_en: UNN, label_en: 'Unified number', label_ar: 'الرقم الموحد' }),
  ident({ id: 'q4', key: 'mot_licence', value_en: LIC, label_en: 'Tourism licence', label_ar: 'رقم الترخيص' }),
  ident({ id: 'q5', key: 'iata', category: 'membership', value_en: '99000022', label_en: 'IATA', label_ar: 'إياتا' }),
];
/* the same registry with the two new values withheld — check 7 */
const THIN = FULL.filter((r) => r.key !== 'branches' && r.key !== 'legal_name');
/* a second set of values — check 5: the document must follow the registry, not a copy */
const OTHER = FULL.map((r) => r.key === 'branches' ? Object.assign({}, r, { value_en: 'QA-Delta only', value_ar: 'مدينة دلتا' })
  : r.key === 'legal_name' ? Object.assign({}, r, { value_en: 'QA Second Name Ltd.', value_ar: 'شركة الاسم الثاني' }) : r);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(rows, port, lang, tab) {
  const srv = start(port, { company_identity: rows });
  const base = 'http://localhost:' + port;
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|next_document_number/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(base + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(base + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.evaluate((t) => { try { openLead = null; current = 'documents'; render(); } catch (_) {} setTimeout(() => { try { dgGo(t); } catch (_) {} }, 400); }, tab);
  await p.waitForTimeout(3000);
  /* Contract and Tender open in ARABIC by default — a Saudi contract is Arabic-first, and that
     is the app's intent, not a defect. So the wanted language is always clicked, never assumed. */
  await p.evaluate((want) => {
    const el = [].slice.call(document.getElementById('view').querySelectorAll('button'))
      .find((x) => (x.textContent || '').trim() === (want === 'ar' ? 'العربية' : 'English'));
    if (el) el.click();
  }, lang);
  await p.waitForTimeout(2400);
  /* step 3 is where the document itself is drawn */
  await p.evaluate(() => {
    const v = document.getElementById('view');
    const el = [].slice.call(v.querySelectorAll('button,[role=button],.step,a')).find((x) => /^3\s*·|Review|المراجعة/i.test((x.innerText || '').trim()));
    if (el) el.click();
  });
  await p.waitForTimeout(2600);
  const out = await p.evaluate(() => {
    const v = document.getElementById('view');
    const feet = [].slice.call(v.querySelectorAll('.po-foot, .sf-foot, .cp-foot, .ct-foot, .tn-foot, [class$="-foot"]'));
    const f = feet[0];
    return { found: !!f,
      text: f ? (f.innerText || '').replace(/\s+/g, ' ').trim() : '',
      branch: f ? ((f.querySelector('.fb') || {}).innerText || '').trim() : '',
      legalLine: f ? ((f.querySelector('.fl') || {}).innerText || '').replace(/\s+/g, ' ').trim() : '' };
  });
  await ctx.close(); srv.close?.();
  return out;
}

const enFull = await run(FULL, PORT, 'en', 'offer');
const arFull = await run(FULL, PORT + 1, 'ar', 'offer');
const enOther = await run(OTHER, PORT + 2, 'en', 'offer');
const enThin = await run(THIN, PORT + 3, 'en', 'offer');
/* The Company Profile puts this footer on its SECTION pages only, and the sections come from
   company_profile_sections, which the harness does not serve — with none, it draws a cover and a
   thank-you page and no footer at all. So the profile is held to the source check (6) rather than
   pretended to be measured: reporting "ok" about a footer that was never drawn is the worse
   outcome. Its runtime footer is covered by probe-a-document-never-invents-the-company. */
const others = [];
for (const [i, t] of ['fees', 'contract', 'tender'].entries()) others.push({ t, ...(await run(FULL, PORT + 4 + i, 'en', t)) });
await b.close();

const TABS = ['js/67-price-offer-tab.js', 'js/68-service-fees-tab.js', 'js/69-company-profile-tab.js',
  'js/70-contract-tab.js', 'js/71-tender-tab.js'];
/* the hand-typed shapes, matched as patterns so no real value is written here */
const HAND = /class="fb">[A-Za-z]|class="fl"[^>]*>\s*[؀-ۿ]/;
/* Comments are stripped FIRST: the fix's own explanatory comment quotes the two old literals
   verbatim, and the first version of this check flagged all five files because of it. */
const decomment = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, '');
const stillTyped = TABS.filter((f) => { try { return HAND.test(decomment(fs.readFileSync(path.join(APP, f), 'utf8'))); } catch (_) { return false; } });

const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const hasLatinWord = (s) => /[A-Za-z]{3,}/.test(s || '');
/* the e-mail and website are Latin in both languages by nature — drop them before judging */
const strip = (s) => String(s || '').replace(/\S+@\S+/g, '').replace(/www\.\S+/g, '');

const checks = [
  ['on the English document the branch list and the trade name are the registry\'s English values',
    enFull.found && enFull.branch === BR_EN && enFull.legalLine.indexOf(LN_EN) >= 0,
    JSON.stringify({ branch: enFull.branch, legal: enFull.legalLine })],
  ['and the English footer carries no Arabic, labels included', enFull.found && !hasArabic(enFull.text),
    (enFull.text.match(/[؀-ۿ][^ ]*/g) || []).slice(0, 4).join(' ') || '(none)'],
  ['on the Arabic document both are the registry\'s Arabic values',
    arFull.found && arFull.branch === BR_AR && arFull.legalLine.indexOf(LN_AR) >= 0,
    JSON.stringify({ branch: arFull.branch, legal: arFull.legalLine })],
  ['and the Arabic footer carries no English sentence', arFull.found && !hasLatinWord(strip(arFull.text)),
    (strip(arFull.text).match(/[A-Za-z]{3,}[^·]*/g) || []).slice(0, 3).join(' | ') || '(none)'],
  ['a registry serving different values produces a different footer',
    enOther.found && enOther.branch !== enFull.branch && enOther.legalLine !== enFull.legalLine &&
    enOther.branch === 'QA-Delta only',
    JSON.stringify({ branch: enOther.branch })],
  ['no hand-typed branch sentence or trade name is left in any of the five sources',
    stillTyped.length === 0, stillTyped.join(', ')],
  ['with the registry silent those lines are absent, and no label dangles',
    enThin.found && enThin.branch === '' && !/Legal name/i.test(enThin.legalLine) && !/الاسم التجاري/.test(enThin.legalLine),
    JSON.stringify({ branch: enThin.branch, legal: enThin.legalLine })],
  ['the registered numbers still print with their labels, in the document\'s language',
    enFull.legalLine.indexOf(UNN) >= 0 && /Unified number/.test(enFull.legalLine) &&
    arFull.legalLine.indexOf(UNN) >= 0 && /الرقم الموحد/.test(arFull.legalLine),
    JSON.stringify({ en: enFull.legalLine.slice(-60), ar: arFull.legalLine.slice(-40) })],
  ['every document that draws this footer agrees — one shared footer, so one file is not a fix',
    others.length === 3 && others.every((o) => o.found && o.branch === BR_EN && o.legalLine.indexOf(LN_EN) >= 0),
    others.map((o) => o.t + ':' + (o.found ? (o.branch === BR_EN ? 'ok' : 'BRANCH=' + o.branch) : 'NO FOOTER')).join(' · ')],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
