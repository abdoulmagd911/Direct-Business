/* probe-a-company-keeps-what-kind-it-is.mjs — guards the 2026-09-20 (fire #119) fix in
   js/core/core-05-records.js and js/core/core-07-v22-v24.js.

   The fourth and fifth places in this codebase where a dropdown could not show what was stored.

   Nineteen live companies carry an entity type — "Small Company" on eleven of them, plus
   "Government", "Semi Government", "Travel Partner", "Big Company", "Medium Company" — and NOT ONE
   of those is in `ENTITY_TYPES`, which offers Ministry, Government entity, Semi-government,
   Multinational, Corporate, SME and Charity/NGO. "Semi Government" and "Semi-government" are a
   hyphen apart; "Government" and "Government entity" a word.

   A <select> with no matching option selects its first one, and the Corporate profile editor writes
   the box straight back: `b.entityType = val('c_et')`. Measured against the real database in both
   languages: opening the editor on a client and pressing Save with nothing touched filed it as a
   **Ministry**. The editor is reached from the Corporate account card, which is on every client.

   The client-onboarding form (deliberately collapsed by v36, still reachable through its own link)
   has three boxes of the same shape — classification, pricing scheme, payment configuration — and
   the live payment terms are spelled "Post-paid · Monthly · 30 days", which is not one of that
   box's three options either. All four are fixed the same way as the lead, funnel and airline
   boxes: an empty option that means nothing is recorded, and the stored value as its own option,
   marked as what is on file, where the list has no match.

   This pattern has now been found five times here, and the first was not mine: round 30 (js/56)
   found the access matrix calling unknown roles "Admin" for exactly this reason — a select with
   nothing selected shows its first option, and that one showed it in the most dangerous direction.

   Sabotage-tested 2026-09-20 against a COPY of the app (APP_DIR — the repository is untouched):
     · the entity-type box put back to the plain list: 5 checks FAIL — a company with no type is
       filed as a Ministry, a "Semi Government" company loses what it is, and the form has no way
       to say that nothing is recorded.
     · the onboarding classification box put back: 1 check FAILS.
   Run: node scripts/qa/probe-a-company-keeps-what-kind-it-is.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9092; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];
const ODD_TYPE = 'Semi Government';     // exactly as eleven-plus live companies spell it
const KNOWN_TYPE = 'Corporate';         // one ENTITY_TYPES does contain
const ODD_CLASS = 'Chamber of Industry'; // not in V22_CLASSIFICATIONS

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
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
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 2 && typeof editCorporate === 'function', { timeout: 120000 });
  await p.waitForTimeout(4000);

  const ids = await p.evaluate(({ odd, known, oddClass }) => {
    const B = (DB.businesses || []).filter((x) => x.isClient);
    const a = B[0], c = B[1] || B[0], d = B[2] || B[0];
    a.name = 'Qaanoon Odd Type Co'; a.isClient = true; a.entityType = odd;
    a.accountManager = 'Someone'; a.legalName = 'Qaanoon Odd Type LLC'; a.paymentTerms = 'Net 30';
    a.classification = oddClass;
    c.name = 'Qaanoon No Type Co'; c.isClient = true; delete c.entityType;
    d.name = 'Qaanoon Known Type Co'; d.isClient = true; d.entityType = known;
    return { odd: a.id, none: c.id, known: d.id,
      list: (typeof ENTITY_TYPES !== 'undefined') ? ENTITY_TYPES : [] };
  }, { odd: ODD_TYPE, known: KNOWN_TYPE, oddClass: ODD_CLASS });

  const editCorp = async (id) => {
    const before = await p.evaluate((i) => {
      const x = (DB.businesses || []).find((y) => y.id === i) || {};
      return { entityType: x.entityType || null, accountManager: x.accountManager || null,
        legalName: x.legalName || null, paymentTerms: x.paymentTerms || null };
    }, id);
    await p.evaluate((i) => { current = 'leads'; openLead = i; render(); if (typeof editCorporate === 'function') editCorporate(i); }, id);
    await p.waitForTimeout(1800);
    const shown = await p.evaluate(() => {
      const e = document.getElementById('c_et'); if (!e) return null;
      return { value: e.value, optionValues: [].slice.call(e.options).map((o) => o.value),
        selectedText: e.selectedIndex >= 0 ? (e.options[e.selectedIndex].textContent || '').trim() : null };
    });
    const after = await p.evaluate((i) => {
      const btns = [].slice.call(document.querySelectorAll('#modal button, .modal button'));
      const save = btns.find((x) => /^\s*(Save|حفظ)/.test(x.textContent || ''));
      if (save) save.click();
      const x = (DB.businesses || []).find((y) => y.id === i) || {};
      return { clicked: !!save, entityType: x.entityType || null, accountManager: x.accountManager || null,
        legalName: x.legalName || null, paymentTerms: x.paymentTerms || null };
    }, id);
    await p.waitForTimeout(1000);
    return { before, shown, after };
  };

  const odd = await editCorp(ids.odd);
  const none = await editCorp(ids.none);
  const known = await editCorp(ids.known);

  /* the onboarding form v36 collapsed but did not delete — its classification box is the same shape */
  const onboard = await p.evaluate((i) => {
    if (typeof v22OpenClientOnboarding !== 'function') return { noFn: true };
    v22OpenClientOnboarding(i);
    const e = document.getElementById('v22_class');
    return e ? { value: e.value, selectedText: e.selectedIndex >= 0 ? (e.options[e.selectedIndex].textContent || '').trim() : null,
      count: e.options.length } : { noBox: true };
  }, ids.odd);
  await p.evaluate(() => { const m = document.getElementById('modal'); if (m) m.remove(); });

  await ctx.close();
  return { ids, odd, none, known, onboard };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
const diff = (r) => ['entityType', 'accountManager', 'legalName', 'paymentTerms']
  .filter((k) => String(r.before[k]) !== String(r.after[k]));
console.log('  the box offers', en.ids.list.length, 'types:', JSON.stringify(en.ids.list));
console.log('  EN odd  :', JSON.stringify({ shown: en.odd.shown && en.odd.shown.selectedText, changed: diff(en.odd) }));
console.log('  AR odd  :', JSON.stringify({ shown: ar.odd.shown && ar.odd.shown.selectedText, changed: diff(ar.odd) }));
console.log('  EN none :', JSON.stringify({ shown: en.none.shown && en.none.shown.value, after: en.none.after.entityType }));
console.log('  EN known:', JSON.stringify({ shown: en.known.shown && en.known.shown.value, after: en.known.after.entityType }));
console.log('  onboarding classification:', JSON.stringify(en.onboard), JSON.stringify(ar.onboard));

const checks = [
  ['the Corporate profile editor opens with its Entity type box', !!en.odd.shown && !!ar.odd.shown,
    JSON.stringify({ en: !!en.odd.shown, ar: !!ar.odd.shown })],
  ['a company whose kind the box never heard of shows that kind, not the first entry in a list',
    en.odd.shown.value === ODD_TYPE && ar.odd.shown.value === ODD_TYPE,
    JSON.stringify({ en: en.odd.shown.value, ar: ar.odd.shown.value, firstInList: en.ids.list[0] })],
  ['and it says, in the page\'s own language, that this is what is on file',
    /on file/.test(en.odd.shown.selectedText) && /المسجَّل/.test(ar.odd.shown.selectedText),
    JSON.stringify({ en: en.odd.shown.selectedText, ar: ar.odd.shown.selectedText })],
  ['it still offers every standard type, so changing it stays a deliberate choice',
    en.ids.list.every((t) => en.odd.shown.optionValues.indexOf(t) >= 0),
    JSON.stringify(en.odd.shown.optionValues)],
  ['saving that company without touching anything leaves it exactly as it was, in both languages',
    diff(en.odd).length === 0 && diff(ar.odd).length === 0,
    JSON.stringify({ en: diff(en.odd), ar: diff(ar.odd), got: en.odd.after.entityType })],
  ['a company with no kind recorded is not quietly filed as a Ministry',
    !en.none.after.entityType && !ar.none.after.entityType,
    JSON.stringify({ en: en.none.after.entityType, ar: ar.none.after.entityType, firstInList: en.ids.list[0] })],
  ['…and the box can say that nothing is recorded', en.none.shown.value === '' && en.none.shown.optionValues.indexOf('') >= 0,
    JSON.stringify(en.none.shown.value)],
  ['a kind the list DOES contain is selected normally and survives Save',
    en.known.shown.value === KNOWN_TYPE && en.known.after.entityType === KNOWN_TYPE
    && en.known.shown.optionValues.filter((v) => v === KNOWN_TYPE).length === 1,
    JSON.stringify({ shown: en.known.shown.value, after: en.known.after.entityType })],
  ['the onboarding form\'s classification box carries an unknown classification too',
    !!en.onboard && en.onboard.value === ODD_CLASS && /on file/.test(en.onboard.selectedText || ''),
    JSON.stringify(en.onboard)],
  ['Save really tried to store the record, and the attempt went no further than this test',
    en.odd.after.clicked && ar.odd.after.clicked && wrote.filter((w) => /businesses|save_state/.test(w)).length >= 2,
    JSON.stringify(wrote.filter((w) => !/finance_client_links/.test(w)).slice(0, 5))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
