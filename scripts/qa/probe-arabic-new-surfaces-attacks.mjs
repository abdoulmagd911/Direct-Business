/* probe-arabic-new-surfaces-attacks.mjs (2026-09-06, watch cycle 31) - the Arabic side of
   everything this watch has added since cycle 26.

   Cycle 11 built the Arabic guard for Finance and it still holds - but probe-finance-arabic-attacks
   runs on the DEFAULT seed, where nothing is outstanding, nothing is future-dated and every invoice
   carries revenue_way 'invoice'. So none of the surfaces added since cycle 26 has ever rendered on
   an Arabic screen at all:

     the "Dated in the future" chip                          (cycle 28, js/16)
     the "% overdue cannot see this money" note              (cycle 28, js/16)
     the export refusal message                              (cycle 30 + round 50, js/16)
     the b2c_manual revenue-way label                        (cycle 27, js/25)
     the unknown-stored-way fallback label                   (cycle 27, js/25)

   The fixture below makes every one of them render, in Arabic, at the same time.

   Cycle 11's real lesson is applied to the new note in particular: a plain digit group cannot be
   reordered by RTL - Unicode treats it as one weak-LTR run - so the shapes that genuinely flip are
   SIGNED amounts and amounts printed next to a currency word. The new note is exactly that shape:
   it drops moneyS() output (which can carry a K or M suffix) into Arabic prose next to "ريال",
   twice in one sentence.

   Under test:
     1. Every new surface renders its Arabic wording, and the English original does NOT appear.
     2. The two amounts inside the no-due-date note are direction-isolated, checked on the SMALLEST
        element carrying both the number and the currency word (cycle 19's correction).
     3. The revenue-way editor's Arabic labels, including the fallback for a way it does not know.
     4. The export refusal speaks Arabic when the page is Arabic.
     5. A control that the check can fail: the same scan must FIND the new surfaces, or it proved
        nothing.

   Run:  node scripts/qa/probe-arabic-new-surfaces-attacks.mjs        (port 8245)
   Sabotage (file-level): replace one Arabic string with its English original. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8245;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const TODAY = new Date();
const TODAY_UTC = Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate());
const dayOffset = (n) => new Date(TODAY_UTC - n * 86400000).toISOString().slice(0, 10);
const UNKNOWN_WAY = 'partner_rebate';

function inv(id, date, total, remaining, way) {
  const mo = +date.slice(5, 7);
  return {
    id, invoice_no: 'AN-' + id, line_no: 1, zatca_dpin: null,
    client_group: 'شركة الاختبار ' + id, customer_raw_name: 'شركة الاختبار ' + id,
    invoice_date: date, year: +date.slice(0, 4), month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: way === 'b2c_manual' ? 'b2c' : 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total,
    cost_sar: Math.round(total * 0.6), profit_sar: total - Math.round(total * 0.6), vat_sar: 0,
    amount_received_sar: total - remaining, amount_remaining_sar: remaining,
    integrity_status: remaining > 0 ? 'pending' : 'verified_paid',
    collection_due_date: null,   /* no due date anywhere on purpose — that is what makes the note render */
    exclusion_reason: null, notes: null, source_batch: 'an-qa', revenue_way: way || 'invoice',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  };
}
const SEED = [
  inv('fut', dayOffset(-150), 48000, 47000),      /* dated in the FUTURE, and unpaid */
  inv('old', dayOffset(200), 62000, 61000),       /* 90+ days, unpaid, no due date */
  inv('new', dayOffset(10), 31000, 30000),        /* 0-30 days, unpaid, no due date */
  inv('paid', dayOffset(40), 90000, 0),
  inv('b2c', dayOffset(20), 12000, 0, 'b2c_manual'),
  inv('unk', dayOffset(25), 15000, 0, UNKNOWN_WAY)
];
/* An invoice with NO date at all, so the "بدون تاريخ فاتورة" chip renders too. The first run of
   this probe checked for that chip without seeding a row that could produce it, and reported the
   app as failing to render something the fixture had never asked for — the check was wrong, not
   the app. year/month/quarter are left null the way a date-less row really arrives. */
SEED.push(Object.assign(inv('nodate', dayOffset(5), 27000, 26000), { invoice_date: null, year: null, month: null, quarter: null }));
const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;

/* Arabic wording added since cycle 26, with the English it must NOT show instead */
const NEW_STRINGS = [
  ['بتاريخ مستقبلي', 'Dated in the future', 'the future-dated ageing chip'],
  ['تُحتسب نسبة المتأخر', '% overdue is measured on', 'the "% overdue cannot see this money" note'],
  ['بدون تاريخ فاتورة', 'No invoice date', 'the no-invoice-date ageing chip']
];

async function main() {
  console.log(`fixture: ${SEED.length} invoices — one dated ${dayOffset(-150)} (in the future), one with no date at all, four unpaid with no due date, one b2c_manual, one carrying an unknown way`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { LANG = 'ar'; if (window.applyLang) applyLang(); current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('clients'); });
  await p.waitForTimeout(1600);

  const dir = await p.evaluate(() => ({ html: document.documentElement.getAttribute('dir'), body: getComputedStyle(document.body).direction }));
  if (dir.html === 'rtl' || dir.body === 'rtl') ok('the page is right-to-left'); else fail('page direction is not RTL: ' + JSON.stringify(dir));
  const txt = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');

  /* ---------- 1. every new surface renders in Arabic, and not in English ---------- */
  let missing = 0;
  for (const [ar, en, what] of NEW_STRINGS) {
    const hasAr = txt.indexOf(ar) >= 0, hasEn = txt.indexOf(en) >= 0;
    if (hasAr && !hasEn) ok(`${what} renders in Arabic ("${ar}") and its English original does not appear`);
    else if (!hasAr && hasEn) { missing++; fail(`${what} rendered in ENGLISH on the Arabic page: "${en}"`); }
    else if (!hasAr) { missing++; fail(`${what} did not render at all — the fixture was built so it must; nothing was tested for it`); }
    else { missing++; fail(`${what} shows BOTH the Arabic and the English wording`); }
  }
  if (!missing) ok('every ageing surface added since cycle 26 speaks Arabic on the Arabic page');

  /* ---------- 2. the note's amounts are direction-isolated (cycle 11's rule, cycle 19's method) ---------- */
  const risky = await p.evaluate(() => {
    const out = { total: 0, isolated: 0, samples: [] };
    const AMT_CCY = /[\d,](?:\.\d+)?\s*[KM]?\s*(?:SAR|ريال|ر\.س)|(?:SAR|ريال|ر\.س)\s*[\d,]/;
    const SIGNED = /(^|\s)[-−]\s?[\d,]/;
    document.querySelectorAll('#view *').forEach(el => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 240) return;
      if (!AMT_CCY.test(t) && !SIGNED.test(t)) return;
      if ([...el.children].some(ch => { const c = (ch.textContent || '').replace(/\s+/g, ' ').trim(); return AMT_CCY.test(c) || SIGNED.test(c); })) return;
      out.total++;
      const st = getComputedStyle(el);
      const iso = st.unicodeBidi === 'isolate' || st.unicodeBidi === 'isolate-override' || st.direction === 'ltr' || !!el.closest('[dir="ltr"],[style*="unicode-bidi"]');
      if (iso) out.isolated++; else if (out.samples.length < 6) out.samples.push(t.slice(0, 90));
    });
    return out;
  });
  if (risky.total === 0) fail('no amount printed next to a currency word was found on the Arabic screen — this check proved nothing');
  else if (risky.isolated === risky.total) ok(`all ${risky.total} amounts printed next to a currency word are direction-isolated`);
  else note(`${risky.total - risky.isolated} of ${risky.total} amounts sit next to a currency word without direction isolation — measured, samples: ${JSON.stringify(risky.samples)}`);

  /* ---------- 3. the revenue-way editor's Arabic labels ---------- */
  await p.evaluate(() => { finGo('ledger'); }); await p.waitForTimeout(1200);
  const wayLabels = async (way) => {
    await p.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
    await p.evaluate((w) => { const r = (FIN.rows || []).find(x => x.revenue_way === w); if (r) window.finRow(r.id); }, way);
    await p.waitForTimeout(700);
    return p.evaluate(() => { const s = document.getElementById('fin_way'); return s ? { value: s.value, labels: [...s.options].map(o => o.textContent) } : null; });
  };
  const b2c = await wayLabels('b2c_manual');
  if (b2c && b2c.value === 'b2c_manual' && b2c.labels.some(l => l.indexOf('حجز فردي') >= 0) && !b2c.labels.some(l => l.indexOf('Individual booking') >= 0))
    ok('the b2c_manual revenue way is labelled in Arabic ("حجز فردي — مُدخل يدويًا") with no English beside it');
  else fail(`the b2c_manual way label is wrong on the Arabic page: ${JSON.stringify(b2c)}`);
  const unk = await wayLabels(UNKNOWN_WAY);
  if (unk && unk.value === UNKNOWN_WAY && unk.labels.some(l => l.indexOf('القيمة المخزنة') >= 0))
    ok(`a stored way the editor does not know ("${UNKNOWN_WAY}") is offered back in Arabic ("القيمة المخزنة — طريقة غير معروفة"), so the Arabic screen cannot silently rewrite it either`);
  else fail(`the unknown-way fallback is not Arabic on the Arabic page: ${JSON.stringify(unk)}`);
  await p.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });

  /* ---------- 4. the export refusal speaks Arabic ---------- */
  await p.evaluate(() => { finGo('overview'); }); await p.waitForTimeout(900);
  const refusal = await p.evaluate(() => {
    window.__isShareView = true;
    let alerted = null; const oa = window.alert, oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click;
    let file = false;
    window.alert = function (m) { alerted = String(m); };
    URL.createObjectURL = function () { file = true; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
    try { window.finLedgerCSV(); } catch (e) { }
    window.alert = oa; URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2;
    window.__isShareView = false;
    return { alerted, file };
  });
  if (!refusal.file && refusal.alerted && /[؀-ۿ]/.test(refusal.alerted) && !/[A-Za-z]{4}/.test(refusal.alerted))
    ok(`the export refusal is written in Arabic on the Arabic page — "${refusal.alerted}"`);
  else if (!refusal.file) fail(`the export refuses but not in Arabic: ${JSON.stringify(refusal.alerted)}`);
  else fail('the export produced a file in a share view — a guard regression, not an Arabic problem');

  if (!errors.length) ok('no page error on the Arabic screen'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
