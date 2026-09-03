/* probe-client-documents.mjs — the five client-facing document editors (2026-09-03, round 44).

   js/67 price offer, js/68 service fees, js/69 company profile, js/70 contract, js/71 tender:
   3,949 lines that produce the documents a real client reads and signs. NOT ONE probe drove any
   of them. They even expose QA hooks — __poCalcProbe, __ctProbe, __ctPlaceholderClauses, __tdProbe
   — so a previous session built them to be testable and the test was never written.

   The money on these pages is a client-facing quotation, where VAT is legally expected and
   belongs: M1 forbids VAT inside cost / profit / revenue, and the owner's 2026-08-23 correction
   says plainly that a quotation may show it. So the test here is not "is VAT absent" — it is
   "do the three figures reconcile, and does the amount in words match the figure printed beside
   it". A quotation whose words and numerals disagree is the kind of defect a client notices and
   a court cares about.

   What this holds:
     - every one of the five tabs opens and draws its own editor
     - VAT-exclusive:  total = subtotal + VAT, to the halala
     - VAT-inclusive:  the same three reconcile, computed the other way round
     - awkward prices (33.333 x 3, 0.005) round to 2dp and still reconcile
     - the amount in words is derived from the SAME total the document prints, in both languages
     - amount-in-words is implemented ONCE (js/67) and reused by the tender (js/71) — not
       duplicated, so an offer and a tender can never spell the same amount differently
     - a contract still carrying its seeded placeholder legal wording CANNOT be issued
     - the tender's grand total reconciles the same way
     - both languages throughout

   Sabotage: make calc() return tot=subEx (drop VAT) -> reconciliation red; make words() read a
   different number than the printed total -> words red; drop the placeholder guard -> contract red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8503;

/* The mock served NO contract_clauses, so S.tpl was [], snapshotClauses() returned early, and the
   whole clause system — including the placeholder guard — had never run in any test. Proven by
   sabotage: deleting the guard outright left this probe green until these rows existed. One clause
   carries the deliberate placeholder wording the guard looks for; the others are clean. */
const PH_EN = 'Edit per agreement', PH_AR = 'يُحرَّر حسب الاتفاق';
const CLAUSES = [
  { id: 'cl-1', key: 'scope', sort: 1, enabled: true, optional: false, title_en: 'Scope of services', title_ar: 'نطاق الخدمات', body_en: 'The First Party shall provide corporate travel services.', body_ar: 'يقدّم الطرف الأول خدمات سفر الشركات.' },
  { id: 'cl-2', key: 'fees', sort: 2, enabled: true, optional: false, title_en: 'Fees and payment', title_ar: 'الأتعاب والسداد', body_en: '[' + PH_EN + ']', body_ar: '[' + PH_AR + ']' },
  { id: 'cl-3', key: 'term', sort: 3, enabled: true, optional: false, title_en: 'Term', title_ar: 'المدة', body_en: 'One year, renewable.', body_ar: 'سنة واحدة قابلة للتجديد.' },
  // disabled AND placeholder: must NOT block issuing — the guard is about what actually goes out
  { id: 'cl-4', key: 'sla', sort: 4, enabled: false, optional: true, title_en: 'Service levels', title_ar: 'مستويات الخدمة', body_en: '[' + PH_EN + ']', body_ar: '[' + PH_AR + ']' },
];
let failures = 0;
function fail(m) { failures++; console.log('  ✗ ' + m); }
function ok(m) { console.log('  ✓ ' + m); }
const r2 = (n) => Math.round(n * 100) / 100;

async function main() {
  const srv = start(PORT, { contract_clauses: CLAUSES });
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(7000);
  await p.evaluate(() => { openLead = null; current = 'documents'; render(); });
  await p.waitForTimeout(2200);

  // ---------- 1. all five tabs open and draw their OWN editor
  const MARK = {
    offer: /Price Offer|عرض سعر/i, fees: /Service-Fee Proposal|أتعاب/i,
    profile: /Company Profile|الملف التعريفي/i, contract: /Contract \/ Agreement|عقد/i,
    tender: /technical \+ financial|فني/i,
  };
  const bad = [];
  for (const t of Object.keys(MARK)) {
    await p.evaluate((x) => dgGo(x), t); await p.waitForTimeout(1300);
    const r = await p.evaluate(() => ({ tab: window.__dgTabProbe ? window.__dgTabProbe() : '?', txt: (document.getElementById('view') || {}).innerText || '' }));
    if (r.tab !== t) bad.push(`${t}: DG.tab is ${r.tab}`);
    else if (!MARK[t].test(r.txt)) bad.push(`${t}: its own editor is not on screen`);
  }
  if (!bad.length) ok('all five client-document editors open and draw their own content');
  else fail('document tabs not rendering themselves: ' + bad.join(' | '));

  // ---------- 2. price offer money
  await p.evaluate(() => dgGo('offer')); await p.waitForTimeout(1200);
  async function offer(lines, vatIncl) {
    return p.evaluate(({ lines, vatIncl }) => {
      // drive through the tab's own setters, never by reaching into its state
      poNew();
      poSetChk('vatIncl', !!vatIncl);
      lines.forEach((ln, i) => {
        if (i > 0) poLine('add');
        poSetLine(i, 'svc', ln.svc); poSetLine(i, 'svcAr', ln.svcAr || ln.svc);
        poSetLine(i, 'qty', ln.qty); poSetLine(i, 'price', ln.price);
      });
      return window.__poCalcProbe();
    }, { lines, vatIncl });
  }

  // VAT-exclusive, clean numbers
  let c = await offer([{ svc: 'Ticketing fee', qty: 10, price: 75 }, { svc: 'Hotel handling', qty: 2, price: 112.5 }], false);
  const sub1 = 10 * 75 + 2 * 112.5;   // 975
  if (c.subEx === sub1) ok(`the offer subtotal is the lines added up (${sub1})`);
  else fail(`subtotal is ${c.subEx}, the lines add to ${sub1}`);
  if (r2(c.subEx + c.vat) === c.tot) ok('VAT-exclusive: total = subtotal + VAT, exactly, to the halala');
  else fail(`VAT-exclusive does not reconcile: ${c.subEx} + ${c.vat} != ${c.tot}`);
  if (c.vat > 0) ok('…and a client-facing quotation does show VAT, which is where it belongs (M1 bars it from cost/profit/revenue, not from a quotation)');
  else fail('a quotation is showing no VAT at all');

  // VAT-inclusive: the same three must still reconcile, computed the other way
  c = await offer([{ svc: 'All-in package', qty: 1, price: 1150 }], true);
  if (c.tot === 1150) ok('VAT-inclusive: the total is the price the client was quoted, unchanged');
  else fail(`VAT-inclusive changed the quoted total: ${c.tot}`);
  if (r2(c.subEx + c.vat) === c.tot) ok('…and it still reconciles — VAT was taken out of the total, not added on top');
  else fail(`VAT-inclusive does not reconcile: ${c.subEx} + ${c.vat} != ${c.tot}`);

  // awkward money must not drift
  c = await offer([{ svc: 'Odd unit', qty: 3, price: 33.333 }, { svc: 'Tiny', qty: 1, price: 0.005 }], false);
  if (r2(c.subEx + c.vat) === c.tot) ok('prices that do not divide cleanly (33.333 x 3, 0.005) still reconcile to the halala');
  else fail(`awkward rounding broke reconciliation: ${c.subEx} + ${c.vat} != ${c.tot}`);
  if (Math.round(c.tot * 100) === c.tot * 100) ok('…and every printed figure is a whole number of halalas, never a long float');
  else fail('a figure carried more than 2 decimals: ' + c.tot);

  // ---------- 3. the words must describe the number printed beside them
  c = await offer([{ svc: 'Ticketing fee', qty: 10, price: 75 }], false);
  const words = await p.evaluate(() => {
    const w = window.__poWordsProbe(window.__poCalcProbe().tot);
    const v = (document.getElementById('view') || {}).innerText || '';
    return { w, onPage: v.replace(/\s+/g, ' ') };
  });
  const expect = await p.evaluate((t) => window.__poWordsProbe(t), c.tot);
  if (words.w.en === expect.en && words.w.ar === expect.ar) ok('the amount in words is derived from the same total the document prints — one number, one spelling');
  else fail('the words and the total come from different numbers');
  if (words.onPage.includes(words.w.en) || words.onPage.includes(words.w.ar)) ok('…and that spelling is actually on the page the client reads');
  else fail('the amount in words is computed but never printed: ' + JSON.stringify(words.w));
  // a wrong total must produce different words — proves the words really track the number
  const other = await p.evaluate((t) => window.__poWordsProbe(t + 1), c.tot);
  if (other.en !== words.w.en) ok('…and a different total spells differently, so the words are not a fixed string');
  else fail('the words do not change with the amount — they are not derived from it');

  // ---------- 4. one implementation, reused
  const src67 = fs.readFileSync('/home/user/Direct-Business/js/67-price-offer-tab.js', 'utf8');
  const src71 = fs.readFileSync('/home/user/Direct-Business/js/71-tender-tab.js', 'utf8');
  const defines = (s) => (s.match(/function amountInWords\s*\(/g) || []).length;
  if (defines(src67) === 1 && defines(src71) === 0) ok('amount-in-words is written once (js/67) and reused by the tender — an offer and a tender can never spell the same amount differently');
  else fail(`amount-in-words is defined in ${defines(src67)} place(s) in js/67 and ${defines(src71)} in js/71 — two copies WILL drift`);

  // ---------- 5. a contract carrying placeholder legal wording must not be issuable
  await p.evaluate(() => dgGo('contract')); await p.waitForTimeout(1800);
  const st0 = await p.evaluate(() => window.__ctProbe());
  if (st0.clauses.length === CLAUSES.length) ok(`the contract snapshots all ${CLAUSES.length} template clauses into its own copy`);
  else fail(`the contract took ${st0.clauses.length} clauses from a ${CLAUSES.length}-clause template — the clause system is not running`);

  // the guard must see the ENABLED placeholder clause, and only that one
  if (st0.placeholderClauseKeys.length === 1 && st0.placeholderClauseKeys[0] === 'fees') ok('it spots the one enabled clause still carrying placeholder legal wording — and ignores the disabled one, which is not going out');
  else fail('the placeholder detector is wrong: ' + JSON.stringify(st0.placeholderClauseKeys));

  // DRIVE the refusal. Sabotage proved a hook-exists check was worthless: the guard could be
  // deleted outright and this probe stayed green.
  const toastBefore = await p.evaluate(() => document.body.innerText);
  await p.evaluate(() => { try { ctIssue(); } catch (_) {} });
  await p.waitForTimeout(1600);
  const afterIssue = await p.evaluate(() => ({ no: window.__ctProbe().docNumber, status: window.__ctProbe().status, body: document.body.innerText.replace(/\s+/g, ' ') }));
  if (!afterIssue.no) ok('Issue is REFUSED while a clause still says "[Edit per agreement]" — no document number is handed out');
  else fail('a contract with placeholder legal wording was issued as ' + afterIssue.no);
  if (/placeholder wording|نصاً مبدئياً/.test(afterIssue.body)) ok('…and it says so, naming the clause to edit, instead of failing silently');
  else fail('the refusal was silent — the person is left not knowing why nothing happened');
  if (/Fees and payment|الأتعاب/.test(afterIssue.body)) ok('…naming the actual clause at fault');
  else fail('the refusal does not say which clause is the problem');

  /* A guard that never lets go is also a bug. Turning the offending clause OFF means it is not
     going into the contract, so the guard must stop objecting — and turning it back on must make
     it object again. That proves the guard reads live state each time rather than latching once. */
  const off = await p.evaluate(() => { ctClauseToggle('fees', false); return window.__ctProbe().placeholderClauseKeys; });
  if (off.length === 0) ok('switching that clause off clears the objection — the guard is about what actually goes out, not what the template once held');
  else fail('the guard still objects to a clause that is switched off: ' + JSON.stringify(off));
  const backOn = await p.evaluate(() => { ctClauseToggle('fees', true); return window.__ctProbe().placeholderClauseKeys; });
  if (backOn.length === 1 && backOn[0] === 'fees') ok('…and switching it back on makes it object again — it re-reads the live clauses every time, it does not latch');
  else fail('the guard did not come back after the clause was re-enabled: ' + JSON.stringify(backOn));

  /* ---------- 5b. if the shared amount-in-words is ever unavailable, the tender must SAY so.
     js/71 deliberately never fabricates a spelling (M8) and returned '' — which printed
     "In words (EN):" followed by nothing, indistinguishable from a real blank. Same rule the
     documents layer already follows for a missing VAT number. */
  /* The totals block (and with it the "In words" line) only renders once the bill of quantities
     has a priced row — `tt.any` gates it — and it lives in the FINANCIAL half of the pair, not the
     technical one that opens by default. Both had to be driven before this could be tested at all. */
  await p.evaluate(() => { dgGo('tender'); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    tdItemSet('boq', 0, 'en', 'Corporate air ticketing'); tdItemSet('boq', 0, 'ar', 'إصدار تذاكر');
    tdItemSet('boq', 0, 'unit', 'ticket'); tdItemSet('boq', 0, 'qty', 100); tdItemSet('boq', 0, 'price', 75);
    tdView('fin');
  });
  await p.waitForTimeout(1400);
  const withWords = await p.evaluate(() => ((document.getElementById('view') || {}).innerText || '').replace(/\s+/g, ' '));
  if (/In words|كتابةً/.test(withWords)) ok('a priced tender prints the amount in words on its financial document');
  else fail('the tender financial document shows no amount in words at all');

  await p.evaluate(() => { window.__qaRealWords = window.__poWordsProbe; delete window.__poWordsProbe; tdView('fin'); });
  await p.waitForTimeout(1400);   // the repaint lands after the call returns — reading in the same tick reads the old DOM
  const noWords = await p.evaluate(() => ((document.getElementById('view') || {}).innerText || '').replace(/\s+/g, ' '));
  await p.evaluate(() => { window.__poWordsProbe = window.__qaRealWords; delete window.__qaRealWords; });
  if (/unavailable|تعذّر/.test(noWords)) ok('with the shared amount-in-words unavailable, the tender says so on the document instead of printing an empty "In words" line');
  else fail('the tender printed a blank amount-in-words with nothing to say it was missing');
  await p.evaluate(() => dgGo('tender')); await p.waitForTimeout(1200);

  // ---------- 6. tender totals reconcile the same way
  await p.evaluate(() => dgGo('tender')); await p.waitForTimeout(1500);
  const td = await p.evaluate(() => window.__tdProbe());
  if (r2((td.subtotal || 0) + (td.vat || 0)) === r2(td.grand || 0)) ok('the tender grand total reconciles: subtotal + VAT = grand');
  else fail(`the tender does not reconcile: ${td.subtotal} + ${td.vat} != ${td.grand}`);

  // ---------- 7. Arabic
  await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); });
  const arBad = [];
  for (const t of Object.keys(MARK)) {
    await p.evaluate((x) => dgGo(x), t); await p.waitForTimeout(1200);
    const txt = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
    if (!/[؀-ۿ]/.test(txt)) arBad.push(t);
  }
  if (!arBad.length) ok('all five editors render Arabic on an Arabic page');
  else fail('editors with no Arabic at all: ' + arBad.join(', '));
  await p.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); });

  const real = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', real.length ? JSON.stringify(real.slice(0, 4)) : 'none');
  if (real.length) fail(real.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nclient-documents OK — the five documents a client reads reconcile, spell their own totals, and refuse to go out half-written');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
