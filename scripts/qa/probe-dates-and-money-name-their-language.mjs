/* probe-dates-and-money-name-their-language.mjs — guards the 2026-09-18 (fire #94) fixes in
   js/core/core-01-foundation.js and js/core/core-04-proposals.js, plus check-structure's new rule.

   toLocaleString(), toLocaleDateString(undefined, …) and toLocaleTimeString([], …) do not mean
   English. They mean "whatever language this laptop is set to". The app has its own language switch
   (LANG / dbLang), and the two had nothing to do with each other.

   Driven against the real database before the fix, with the app in ENGLISH in a browser set to
   Arabic: a lead's detail page printed its dates as "٣٠ … ١٤٤٨" — the HIJRI year, in Arabic-Indic
   digits, on an English screen, beside Gregorian dates printed by other layers; fmtDate returned
   "٢٥ رمضان ١٤٤٧ هـ" and fmtTime "٠٩:٠٥ ص"; and the client-facing quotation printed its option
   totals and its per-passenger figure as "١٬٢٣٤٬٥٦٧٫٥" while the headline Total on the same document
   stayed Western, because that one is printed straight from what was typed. One price document, two
   number systems, decided by whose machine happened to open it — and the same split reached the
   WhatsApp text an agent copies out to a client.

   'en-GB' is what the rest of the app had already settled on for English dates (the Today header,
   Team & Access, Archive, the share panel — the last three after the same Hijri surprise on
   2026-09-17), and 'en-US' is what every other money figure uses. calendar:'gregory' is now stated
   on both language branches so no browser setting can put a Hijri year on screen again.

   This probe loads the app TWICE in English — once in a browser set to en-US, once set to ar-SA —
   and requires the two to agree. The Arabic half is checked too: Arabic must stay Arabic, and must
   still be Gregorian. The static half asserts the gate that would catch the next one.

   Sabotage-tested (re-measured 2026-09-19 after the lead-page check was narrowed): with core-01 and
   core-04 reverted to before the fix, 5 checks go FAIL, exit 1 — both printers, the Hijri date, the
   quotation and the copy-out text. The lead-page check does not fail there, because the harness
   seed's lead shows no date; fmtDate and fmtTime carry that weight, and the live drive is what
   found the Hijri dates on a real lead in the first place.
   Run: node scripts/qa/probe-dates-and-money-name-their-language.mjs                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9071; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const AR_DIGIT = /[٠-٩۰-۹]/;
const HIJRI = /هـ|رمضان|شوال|محرم|صفر|رجب|شعبان/;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

/* one invented quotation, used identically in every run so the renderings can be compared */
const OFFER = { ref: 'QA-LOC', client: 'QA Fixture', currency: 'SAR', total: '1234567.5', paxAdt: 2,
  options: [{ label: 'A', provider: 'QA', base: '1000000', taxes: '200000', anc: '34567.5', fee: '0' }] };

async function run(browserLocale, appLang) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 950 }, locale: browserLocale });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, appLang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(browserLocale + '/' + appLang + ': ' + e.message));
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof fmtDate === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 });
  await p.waitForTimeout(3000);

  const out = await p.evaluate((offer) => {
    const t = Date.UTC(2026, 2, 14, 9, 5);
    const r = { browserSaysArabic: /^ar/.test(navigator.language),
      /* the mechanism itself, so a run that proves nothing is visible as such */
      rawWouldLeak: AR_TEST((1234567.5).toLocaleString()) || AR_TEST(new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })),
      fmtDate: fmtDate(t), fmtTime: fmtTime(t), doc: null, text: null, page: '' };
    try { const d = document.createElement('div'); d.innerHTML = offerHTML(offer); r.doc = d.innerText.replace(/\s+/g, ' ').trim(); } catch (e) { r.doc = 'ERR ' + e.message; }
    try { r.text = offerText(offer); } catch (e) { r.text = 'ERR ' + e.message; }
    try {
      const lead = (DB.businesses || []).find((x) => x.lastContact || x.nextAction || (x.activities || []).length) || (DB.businesses || [])[0];
      current = 'leads'; openLead = lead && lead.id; render();
    } catch (_) { }
    function AR_TEST(s) { return /[٠-٩۰-۹]/.test(String(s)); }
    return r;
  }, OFFER);
  await p.waitForTimeout(2500);
  out.page = await p.evaluate(() => (document.getElementById('view') || document.body).innerText.replace(/\s+/g, ' ').trim());
  await ctx.close();
  return out;
}

const enUS = await run('en-US', 'en');
const arSA = await run('ar-SA', 'en');
const arApp = await run('en-US', 'ar');
await b.close(); srv.close?.();

const structureSrc = fs.readFileSync(REPO + '/scripts/qa/check-structure.mjs', 'utf8');
const clean = (s) => !AR_DIGIT.test(String(s)) && !HIJRI.test(String(s));
const checks = [
  /* if this one ever fails the whole probe is proving nothing — the browser was not really Arabic */
  ['the Arabic-browser run really was Arabic, and a bare toLocaleString there really would print Arabic-Indic digits',
    arSA.browserSaysArabic === true && arSA.rawWouldLeak === true && enUS.rawWouldLeak === false],
  ['the app\'s own date printer gives the same English date on both machines', enUS.fmtDate === arSA.fmtDate && clean(arSA.fmtDate)],
  ['and its time printer too', enUS.fmtTime === arSA.fmtTime && clean(arSA.fmtTime)],
  ['the date is Gregorian, not Hijri — 14 March 2026 is still 2026', /2026/.test(arSA.fmtDate) && !/144\d/.test(arSA.fmtDate)],
  /* 2026-09-19 (fire #100): this check used to require the two pages' whole text to be IDENTICAL.
     It went red in a full battery, twice, on a healthy app: the lead detail page is assembled by a
     stack of injection layers (the service-fit map, the Direct-link banner, the suggested-next-step
     nudge, the managed-in-Direct note), and which of them lands first is not deterministic. Both
     runs held the same 1556 characters in a different order — nothing to do with the browser's
     language, which is what this probe is about. The check now asserts what it always meant: no
     Arabic-Indic digit and no Hijri date leaks onto the English page. The strict equality is kept
     for the quotation below, which renders in one pass and is the surface the defect was found on. */
  ['a lead\'s page carries no Arabic-Indic digits and no Hijri date in the English app', clean(arSA.page) && String(arSA.page).length > 50],
  ['the client-facing quotation prints the same prices on both machines', enUS.doc === arSA.doc && clean(arSA.doc) && /1,234,567.5/.test(arSA.doc)],
  ['and so does the text an agent copies out to a client', enUS.text === arSA.text && clean(arSA.text)],
  /* the other direction: the fix must not have flattened Arabic into English */
  ['the Arabic app is still Arabic — its dates are written in Arabic', /[؀-ۿ]/.test(arApp.fmtDate)],
  ['and Arabic dates are still Gregorian, as they were before', /٢٠٢٦|2026/.test(arApp.fmtDate) && !HIJRI.test(arApp.fmtDate)],
  ['check-structure still fails a layer that formats without naming a language',
    structureSrc.includes('naming a language') && structureSrc.includes('toLocale') && structureSrc.includes('locale-named check could not run')],
  ['reading and rendering wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) {
  console.log('detail:', JSON.stringify({ enUS: { fmtDate: enUS.fmtDate, fmtTime: enUS.fmtTime, doc: String(enUS.doc).slice(0, 220) },
    arSA: { browserSaysArabic: arSA.browserSaysArabic, rawWouldLeak: arSA.rawWouldLeak, fmtDate: arSA.fmtDate, fmtTime: arSA.fmtTime, doc: String(arSA.doc).slice(0, 220) },
    arApp: { fmtDate: arApp.fmtDate } }, null, 1));
  if (errors.length) console.log('errors:', errors.slice(0, 5));
}
process.exit(fail ? 1 : 0);
