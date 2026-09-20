/* probe-a-document-obeys-the-registry.mjs — a client-facing document must not claim a credential
   the company's own registry says has lapsed.

   Found live on 2026-09-20 (fire #139) against the real database. The Generator's Renewals radar
   listed FOUR credentials as EXPIRED — and the registry row for each also carried the owner's own
   `show_on_documents = false`. Meanwhile core-10's one-pager, the document sent to clients and
   attached to TENDERS, printed a HARD-CODED badge list that still advertised "PCI-DSS", and a
   hard-coded Compliance line that still read "PCI-DSS · Bank Guarantee 750K SAR · DUNS registered".
   The app said it on one screen and denied it on another, and the version a client reads was the
   one that was wrong. A hard-coded list was overriding an explicit instruction in the database.

   What this holds, in both languages:
     1. a credential the registry marks expired, or marks "not on documents", does not appear in
        the document a CLIENT reads — measured with .noprint stripped, which is exactly what the
        print stylesheet does;
     2. the person GENERATING it is told what was left off and why, in a box the client never sees,
        so a registry row that is merely out of date can be corrected rather than silently obeyed;
     3. a credential the registry does NOT object to is still printed — the fix must not quietly
        strip the company's real accreditations;
     4. if the registry has not loaded, nothing is filtered on a guess and the box says so — the
        same refusal to pretend as v21AgencyHeader (core-06, round 41).

   The fourth check is the one that would rot first: without it, a future change that made the
   registry fail to load would silently restore every claim this probe exists to remove, and checks
   1-3 would go on passing because nothing would be dropped and nothing would be claimed wrongly…
   except on the document itself.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): with core-10's
   filter removed, checks 1 and 2 FAIL and name PCI-DSS.
   Run: node scripts/qa/probe-a-document-obeys-the-registry.mjs                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9098;

/* a registry with one lapsed credential, one the owner has marked "not on documents", and one that
   is perfectly fine — so the probe can tell filtering from indiscriminate stripping */
const TODAY = new Date();
const past = new Date(TODAY.getTime() - 90 * 86400000).toISOString().slice(0, 10);
const future = new Date(TODAY.getTime() + 300 * 86400000).toISOString().slice(0, 10);
const IDENTITY = [
  { key: 'pci', category: 'membership', label_en: 'PCI DSS (SAQ A 4.0.1)', label_ar: 'شهادة PCI DSS', value_en: 'SAQ A', expires_on: past, show_on_documents: false, sort: 1 },
  { key: 'duns', category: 'membership', label_en: 'DUNS', label_ar: 'دن آند برادستريت', value_en: '000000000', expires_on: past, show_on_documents: false, sort: 2 },
  { key: 'icef', category: 'membership', label_en: 'ICEF', label_ar: 'آيسف', value_en: 'member', expires_on: future, show_on_documents: true, sort: 3 },
  { key: 'vat_number', category: 'tax', label_en: 'VAT number', label_ar: 'الرقم الضريبي', value_en: '300000000000003', expires_on: null, show_on_documents: true, sort: 4 },
  { key: 'iban_alinma', category: 'banking', label_en: 'Alinma IBAN', label_ar: 'آيبان الإنماء', value_en: 'SA0000000000000000000000', expires_on: null, show_on_documents: true, sort: 5 },
  { key: 'cr_number', category: 'legal', label_en: 'Commercial Registration (CR)', label_ar: 'السجل التجاري', value_en: '1010000000', expires_on: future, show_on_documents: true, sort: 6 },
];
const srv = start(PORT, { company_identity: IDENTITY });
const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function onePager(lang, opts) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    /* the "registry never answers" case, for check 4 */
    if (opts && opts.noRegistry && /company_identity/.test(u.pathname)) { await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof window.directTenderPage === 'function', { timeout: 120000 });
  if (!(opts && opts.noRegistry)) {
    await p.waitForFunction(() => { try { return typeof window.dgCredentialFacts === 'function' && window.dgCredentialFacts().loaded; } catch (_) { return false; } }, { timeout: 90000 }).catch(() => { });
  } else { await p.waitForTimeout(9000); }
  const [pop] = await Promise.all([
    p.waitForEvent('popup', { timeout: 25000 }).catch(() => null),
    p.evaluate(() => { try { window.directTenderPage(); } catch (_) { } }),
  ]);
  if (!pop) { await ctx.close(); return null; }
  await pop.waitForTimeout(1200);
  const out = await pop.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('.noprint').forEach((x) => x.remove());
    const seenByClient = (clone.innerText || '').replace(/\s+/g, ' ');
    const box = document.querySelector('.noprint[style*="FFF8E6"]');
    return { seenByClient, notice: box ? (box.innerText || '').replace(/\s+/g, ' ') : '' };
  });
  await pop.close(); await ctx.close();
  return out;
}

const en = await onePager('en');
const ar = await onePager('ar');
const blind = await onePager('en', { noRegistry: true });
await b.close(); srv.close?.();

const both = [en, ar].filter(Boolean);
const checks = [
  ['the one-pager was actually generated in both languages — otherwise everything below passes by finding nothing',
    both.length === 2 && both.every((d) => d.seenByClient.length > 400), both.map((d) => (d ? d.seenByClient.length : 0)).join('/') + ' chars'],
  ['a credential the registry says has EXPIRED is not claimed in the document a client reads',
    both.every((d) => !/PCI/i.test(d.seenByClient)), JSON.stringify(both.map((d) => (d.seenByClient.match(/.{0,40}PCI.{0,40}/i) || [''])[0]))],
  ['nor is the compliance line that named it and DUNS',
    both.every((d) => !/DUNS registered/i.test(d.seenByClient)), ''],
  ['the person generating it is told what was left off, and why',
    both.every((d) => /PCI/i.test(d.notice) && /expired/i.test(d.notice)), JSON.stringify(both.map((d) => d.notice.slice(0, 90)))],
  ['and told in the language the page is in — an English-only notice above an Arabic document is the fire #125 defect again',
    !!ar && /\u0623\u064f\u0633\u0642\u0637\u062a|\u0633\u062c\u0644 \u0634\u0631\u0643\u062a\u0643/.test(ar.notice) && !!en && /Left off this document/.test(en.notice),
    JSON.stringify([en ? en.notice.slice(0, 40) : '', ar ? ar.notice.slice(0, 40) : ''])],
  ['…and named once, not once per place it was dropped from',
    both.every((d) => (d.notice.match(/PCI/gi) || []).length === 1), JSON.stringify(both.map((d) => (d.notice.match(/PCI/gi) || []).length))],
  ['a credential the registry does NOT object to is still printed — real accreditations are not stripped',
    both.every((d) => /ICEF|World Travel Award/i.test(d.seenByClient)), ''],
  ['with the registry unreadable, nothing is filtered on a guess and the box says it could not be checked',
    !!blind && /could not be checked/i.test(blind.notice), blind ? blind.notice.slice(0, 110) : '(the document did not open)'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
