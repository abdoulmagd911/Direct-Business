/* probe-finance-arabic-attacks.mjs (2026-09-02, overnight cycle) — drives the WHOLE Finance
   section in Arabic and looks for the three ways a bilingual money screen goes wrong:
     1. English left behind on an Arabic screen — a label, a month name, a stage word, an empty
        state, a warning. The brand rule is that Arabic is a full translation, not a veneer.
     2. Direction damage — an amount or a date reordered by RTL so it reads as a different
        number ("1,234" becoming "234,1" to the eye). Every money figure the page prints must
        sit in an isolated LTR run.
     3. Arabic content lost on the way OUT — a company name or a header mangled in a CSV, or a
        file Excel opens as gibberish because the BOM went missing.
   It also re-checks, in Arabic, the honest-empty-state messages this watch added in English:
   the Compare-to "no invoices in that period", the Overview unreadable-amount warning, the
   Ledger's unlinked-client note, and the importer's "deleted here" refusal.
   Run:  node scripts/qa/probe-finance-arabic-attacks.mjs      (port 8207)
   Sabotage: remove MO_AR from the monthly chart in js/16 → the month check goes red; drop the
   \\ufeff from a CSV → the BOM check goes red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8207; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const AR = /[؀-ۿ]/;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.accept());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5500);
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);

  // give the fixture an Arabic company name and an Arabic-heavy row, then switch to Arabic
  await p.evaluate(() => {
    const r0 = FIN.rows[0];
    FIN.rows.push(Object.assign({}, r0, { id: 'ar-1', invoice_no: 'AR-1', client_group: 'شركة الأمل للسفر', customer_raw_name: 'شركة الأمل للسفر', total_incl_vat_sar: 12345.67, revenue_sar: 12345.67, cost_sar: 2345.67, profit_sar: 10000, amount_received_sar: 12345.67, amount_remaining_sar: 0, invoice_date: '2026-03-09', month: 'March', quarter: 'Q1', year: 2026, integrity_status: 'verified_paid', deleted_at: null }));
    LANG = 'ar'; if (window.applyLang) applyLang();
    current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all', cmp: 'none' }; FIN.tab = 'overview';
    if (window.clearFinCanon) clearFinCanon();
    render();
  });
  await p.waitForTimeout(1500);
  const tabText = async (tab) => p.evaluate(async (tab) => {
    FIN.tab = tab; renderFinance(document.getElementById('view'));
    await new Promise(r => setTimeout(r, 900));
    return document.querySelector('#view').innerText;
  }, tab);
  const tabHtml = () => p.evaluate(() => document.querySelector('#view').innerHTML);

  /* ---------- 1. direction ---------- */
  const dir = await p.evaluate(() => ({ html: document.documentElement.getAttribute('dir'), body: getComputedStyle(document.body).direction }));
  if (dir.html === 'rtl' || dir.body === 'rtl') ok('the page is right-to-left in Arabic'); else fail('page direction is not RTL: ' + JSON.stringify(dir));

  /* ---------- 2. Overview in Arabic ---------- */
  let t = await tabText('overview'); let h = await tabHtml();
  const leftovers = (txt) => {
    const words = ['Revenue', 'Profit', 'Cost', 'Margin', 'Outstanding', 'Expected', 'Confirmed', 'Actual', 'Client credit', 'Top clients', 'Collections', 'Days to collect', 'No invoices in', 'Set targets', 'Plan vs actual', 'above plan', 'pro-rated', 'invoices', 'Overdue', 'Ready to invoice', 'Expenses pending', 'Invoiced', 'All companies', 'All stages', 'Search', 'Excel (CSV)', 'transactions', 'Confirmed revenue', 'Confirmed cost', 'Confirmed profit', 'Pending', 'No transactions match'];
    return words.filter(w => new RegExp('(^|[^A-Za-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z]|$)').test(txt));
  };
  let left = leftovers(t);
  if (!left.length) ok('Performance tab: no English money labels left on the Arabic screen'); else fail('Performance tab still shows English: ' + JSON.stringify(left));
  const MO_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthLeft = MO_EN.filter(m => new RegExp('(^|[^A-Za-z])' + m + '([^A-Za-z]|$)').test(t));
  if (!monthLeft.length) ok('the monthly chart and period bar use Arabic month names'); else fail('English month names on the Arabic screen: ' + JSON.stringify(monthLeft));
  // Direction damage is only a real risk for a run whose ORDER can change: a signed amount, or
  // an amount sitting in the same text as a currency word. Plain digit groups (a year, 12,345)
  // are a single weak-LTR run by Unicode's own rules and cannot be reordered — checking those
  // would be a false alarm, so this looks only at the shapes that genuinely flip.
  await p.evaluate(() => {
    FIN.rows.push(Object.assign({}, FIN.rows[0], { id: 'ar-neg', invoice_no: 'AR-NEG', client_group: 'شركة الرصيد الدائن', customer_raw_name: 'شركة الرصيد الدائن', total_incl_vat_sar: -4321.5, revenue_sar: -4321.5, cost_sar: 0, profit_sar: -4321.5, amount_received_sar: 0, amount_remaining_sar: 0, integrity_status: 'verified_paid', invoice_date: '2026-03-10', month: 'March', quarter: 'Q1', year: 2026, deleted_at: null }));
    FIN.tab = 'overview'; renderFinance(document.getElementById('view'));
  });
  await p.waitForTimeout(900);
  /* 2026-09-03 (watch cycle 19): this scan used to look only at LEAF elements, and the shapes it
     hunts do not live in leaves. A tile renders "174.6K <span>SAR</span>" — the number and the
     currency word are siblings inside a parent, so the leaf holding the number has no currency in
     it and the leaf holding "SAR" has no number, and the scan found nothing at all. The probe's
     own "this check proved nothing" guard caught that rather than passing silently, which is
     exactly what it is for. It now looks at the SMALLEST element that contains both parts —
     which is the element whose bidi run actually decides the order. */
  const risky = await p.evaluate(() => {
    const out = { total: 0, isolated: 0, samples: [] };
    const AMT_CCY = /[\d,](?:\.\d+)?\s*[KM]?\s*(?:SAR|ر\.س)|(?:SAR|ر\.س)\s*[\d,]/;
    const SIGNED = /(^|\s)[-\u2212]\s?[\d,]/;
    document.querySelectorAll('#view *').forEach(el => {
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt || txt.length > 60) return;
      if (!AMT_CCY.test(txt) && !SIGNED.test(txt)) return;
      // the smallest element carrying the whole shape: no child carries it too
      if ([...el.children].some(ch => { const t = (ch.textContent || '').replace(/\s+/g, ' ').trim(); return AMT_CCY.test(t) || SIGNED.test(t); })) return;
      out.total++;
      const st = getComputedStyle(el);
      const iso = st.unicodeBidi === 'isolate' || st.unicodeBidi === 'isolate-override' || st.direction === 'ltr' || !!el.closest('[dir="ltr"],[style*="unicode-bidi"]');
      if (iso) out.isolated++; else if (out.samples.length < 5) out.samples.push(txt.slice(0, 40));
    });
    return out;
  });
  if (risky.total === 0 && process.env.DEBUG_AR) {
    const dbg = await p.evaluate(() => ({ rows: (FIN.rows || []).length, hasNeg: !!(FIN.rows || []).find(r => r.invoice_no === 'AR-NEG'), tab: FIN.tab, sample: document.querySelector('#view').innerText.slice(0, 600) }));
    console.log('DEBUG_AR', JSON.stringify(dbg));
  }
  if (risky.total === 0) fail('no signed or currency-bearing amount found on the Arabic screen — the check proved nothing');
  else if (risky.isolated === risky.total) ok(`all ${risky.total} reorderable amounts (signed, or printed next to a currency word) are direction-isolated on the Arabic screen`);
  else fail(`${risky.total - risky.isolated} of ${risky.total} reorderable amounts are not direction-isolated, e.g. ${JSON.stringify(risky.samples)}`);
  // Per-row amounts print on Clients & collections; the Performance tiles only carry aggregates.
  const negShown = await p.evaluate(async () => { FIN.tab = 'clients'; renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 900)); return document.querySelector('#view').innerText; });
  if (/-\s?4,?321/.test(negShown)) ok('a credit-note amount still reads as negative in Arabic — the minus stays on the number, exactly as in English'); else fail('the negative amount lost its sign (or is missing) on the Arabic client rows: ' + JSON.stringify((negShown.match(/[^\n]*4,?321[^\n]*/) || [''])[0]));

  /* ---------- 3. Clients & collections, Ledger, Report Builder ---------- */
  for (const [tab, label] of [['clients', 'Clients & collections'], ['ledger', 'Ledger'], ['reports', 'Report Builder']]) {
    if (tab === 'ledger') { await p.evaluate(() => { if (window.txnLoad) txnLoad(); }); await p.waitForTimeout(1500); }
    t = await tabText(tab);
    left = leftovers(t);
    if (!left.length) ok(`${label}: fully Arabic`); else fail(`${label} still shows English: ${JSON.stringify(left)}`);
    if (AR.test(t)) ok(`${label}: Arabic text is present (the tab really rendered)`); else fail(`${label}: no Arabic at all — did it render?`);
  }

  /* ---------- 4. an Arabic company name survives every export ---------- */
  const grab = async (fn) => p.evaluate(async (fn) => {
    let captured = null; const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { captured = blob; return 'blob:qa'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { window[fn](); } catch (e) { return { err: String(e) }; } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2; }
    if (!captured) return { err: 'no file produced' };
    const ab = await captured.arrayBuffer(); const u8 = new Uint8Array(ab);
    return { bom: u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf, text: new TextDecoder('utf-8').decode(u8) };
  }, fn);
  await tabText('overview');
  const led = await grab('finLedgerCSV');
  if (led.err) fail('invoice CSV: ' + led.err);
  else {
    if (led.bom) ok('invoice CSV starts with a BOM — Excel opens the Arabic names correctly'); else fail('invoice CSV has no BOM');
    if (led.text.indexOf('شركة الأمل للسفر') >= 0) ok('the Arabic company name is in the invoice CSV, unmangled'); else fail('Arabic company name missing from the invoice CSV');
    if (AR.test(led.text.split('\n')[0])) ok('…and its column titles are Arabic too'); else fail('invoice CSV header is still English in Arabic');
  }
  await tabText('ledger');
  const txn = await grab('finTxnCSV');
  if (!txn.err) { if (txn.bom) ok('Ledger CSV also starts with a BOM'); else fail('Ledger CSV has no BOM'); }

  /* ---------- 5. the honest-empty messages, in Arabic ---------- */
  const compare = await p.evaluate(async () => {
    FIN.p = { year: '2024', part: 'Q2', sector: 'all', cmp: 'prev' }; FIN.tab = 'overview';
    renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 700));
    const c = [...document.querySelectorAll('#view .card')].find(e => /المقارنة|Compare to/.test(e.textContent));
    return c ? c.innerText : '';
  });
  if (/لا توجد فواتير/.test(compare) && !/No invoices/.test(compare)) ok('Compare-to: the "that period has no invoices" message is Arabic, with no English left'); else fail('Arabic compare message: ' + JSON.stringify(compare.replace(/\n/g, ' | ').slice(0, 200)));
  const badMoney = await p.evaluate(async () => {
    FIN.rows.push(Object.assign({}, FIN.rows[0], { id: 'ar-bad', invoice_no: 'AR-BAD', total_incl_vat_sar: 'ليس رقمًا', revenue_sar: 'x', cost_sar: 0, profit_sar: 0 }));
    FIN.p = { year: 'all', part: 'all', sector: 'all', cmp: 'none' }; FIN.tab = 'overview';
    renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 700));
    return document.querySelector('#view').innerText;
  });
  if (/غير قابلة للقراءة/.test(badMoney)) ok('the unreadable-amount warning is Arabic'); else fail('unreadable-amount warning not shown in Arabic');
  if (!/NaN|undefined/.test(badMoney)) ok('…and the Arabic screen still prints no NaN'); else fail('NaN on the Arabic screen');
  const drill = await p.evaluate(async () => {
    finClient('raw:شركة الأمل للسفر', 'شركة الأمل للسفر');
    await new Promise(r => setTimeout(r, 1200));
    if (window.txnLoad) txnLoad(); await new Promise(r => setTimeout(r, 1500));
    renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 700));
    return document.querySelector('#view').innerText;
  });
  if (/لا توجد شركة مرتبطة/.test(drill)) ok('the Ledger note for a client with no linked company is Arabic'); else fail('Arabic drill-down note missing: ' + JSON.stringify(drill.slice(0, 200)));

  if (errors.length) fail(errors.length + ' page error(s): ' + JSON.stringify(errors.slice(0, 3))); else ok('no page errors through the Arabic run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
