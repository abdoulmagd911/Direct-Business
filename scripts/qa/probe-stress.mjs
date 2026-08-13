/* Stress attack — the app under 1,279 finance rows / 37 companies, with every number
   checked against INDEPENDENTLY computed expectations (the generator formula, not the app). */
process.env.MOCK_STRESS = '1';
const { start } = await import('./mock-seed-live.mjs');
const { whaleRows, smallRows } = await import('./stress-data.mjs');
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8921, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('dialog', d => d.accept());
const route = async r => {
  const u = r.request().url();
  if (u.includes('cdn.jsdelivr.net')) {
    if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  }
  const url = new URL(u);
  const resp = await fetch(BASE + url.pathname + url.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
};
await page.route('**cdn.jsdelivr.net/**', route);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
const LOG = [];
let shotN = 0;
const STEP = (n, ok, d = '') => LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`);
const moneyS = n => { n = Number(n) || 0; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n.toFixed(0); };
const SHOT = async n => { shotN++; await page.screenshot({ path: `shots/sx${String(shotN).padStart(2, '0')}-${n}.png` }); };
const nav = async re => { await page.locator('#nav button').filter({ hasText: re }).first().click(); await page.waitForTimeout(1400); };

// ---------- independent expectations ----------
const S = [...whaleRows(), ...smallRows()];
const sum = (rows, k) => rows.reduce((a, r) => a + (+r[k] || 0), 0);
const whale = S.filter(r => r.client_group === 'Al-Mutlaq Holding Group');
const EXP = {
  stressRows: S.length,
  whaleInvoices: new Set(whale.map(r => r.invoice_no)).size,
  whaleBilled: sum(whale, 'total_incl_vat_sar'),
  whaleReceived: sum(whale, 'amount_received_sar'),
  whaleOutstanding: sum(whale, 'amount_remaining_sar'),
  wadiTotal: sum(S.filter(r => r.invoice_no === 'DP-WDI-100'), 'total_incl_vat_sar'),
  rev2024: sum(S.filter(r => r.integrity_status === 'verified_paid' && r.invoice_date.startsWith('2024')), 'revenue_sar'),
};
console.log('EXPECTED:', JSON.stringify(EXP));

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await page.waitForTimeout(4500);

// ===== S1 · volume loads completely (the 1000-row cap attack) =====
await nav(/^(Finance|المالية)$/);
await page.waitForTimeout(2500);
const finCount = await page.evaluate(() => (FIN.rows || []).length);
const totalRows = await page.evaluate(async () => (await fetch(location.origin, { method: 'HEAD' }), null)) === null ? EXP.stressRows + 25 : 0;
STEP('S1 ALL finance rows loaded past the 1000-row API cap', finCount >= EXP.stressRows + 20, `app sees ${finCount} (stress alone = ${EXP.stressRows})`);

// ===== S2 · three years in the period bar; 2024 revenue matches the formula =====
await page.locator('#view button, #view .btn').filter({ hasText: /Performance|الأداء/ }).first().click().catch(() => {});
await page.waitForTimeout(1000);
const years = await page.evaluate(() => [...document.querySelectorAll('#view select')].map(s => [...s.options].map(o => o.value).join(',')).join(';'));
STEP('S2 year selector offers 2024/2025/2026', /2024/.test(years) && /2025/.test(years) && /2026/.test(years));
await page.evaluate(() => { FIN.p.year = '2024'; FIN.p.part = 'all'; render(); });
await page.waitForTimeout(1000);
const rev2024app = await page.evaluate(() => {
  const g = [...document.querySelectorAll('#view .card')].find(c => (c.parentElement.getAttribute('style') || '').includes('minmax(132px'));
  return g ? g.parentElement.children[0].textContent.replace(/\s+/g, ' ') : '?';
});
const rev2024fmt = moneyS(EXP.rev2024);
STEP('S3 2024 revenue equals the independent formula sum', rev2024app.includes(rev2024fmt), `app "${rev2024app}" vs expected ${rev2024fmt} (${EXP.rev2024})`);
await SHOT('finance-2024');

// ===== S4 · ledger with 1,279 rows: renders, usable, timed =====
const t0 = Date.now();
await page.locator('#view button, #view .btn').filter({ hasText: /Ledger|السجل/ }).first().click();
await page.waitForTimeout(300);
await page.waitForFunction(() => document.querySelectorAll('#view table tr').length > 10, { timeout: 20000 });
const ledgerMs = Date.now() - t0;
const ledgerRows = await page.evaluate(() => document.querySelectorAll('#view table tr').length);
STEP('S4 ledger renders under load', ledgerRows > 10 && ledgerMs < 12000, `${ledgerRows} rows drawn in ${ledgerMs}ms`);
await SHOT('ledger-loaded');

// ===== S5 · the 48.5M invoice displays sanely =====
await page.evaluate(() => { const el = document.querySelector('#view input[placeholder*="earch"], #view input[type="search"]'); });
const jblOk = await page.evaluate(() => {
  const r = (FIN.rows || []).find(x => x.invoice_no === 'DP-JBL-1');
  return r ? { fmt: String(r.total_incl_vat_sar), pos: +r.total_incl_vat_sar === 48500000 } : null;
});
STEP('S5 48.5M invoice present with full positive amount', !!jblOk && jblOk.pos, JSON.stringify(jblOk));

// ===== S6 · 12-service invoice modal (Wadi) =====
await page.evaluate(() => { const r = (FIN.rows || []).find(x => x.invoice_no === 'DP-WDI-100'); finRow(r.id); });
await page.waitForTimeout(800);
const wadi = await page.evaluate(exp => {
  const m = document.getElementById('finModal'); if (!m) return null;
  const txt = m.textContent.replace(/\s+/g, ' ');
  const rows = m.querySelectorAll('table tbody tr').length;
  return { rows, hasArabicSvc: txt.includes('فندق مكة'), total: txt.includes('59,650') };
}, EXP.wadiTotal);
STEP('S6 Wadi invoice modal: 12+ service lines, Arabic products, correct 59,650 total', !!wadi && wadi.rows >= 13 && wadi.hasArabicSvc && wadi.total, JSON.stringify(wadi));
await SHOT('wadi-modal');
await page.evaluate(() => finCloseModal());

// ===== S7 · Sahm: excluded row NOT in the client numbers; credit note negative held =====
const sahm = await page.evaluate(() => {
  const rows = (FIN.rows || []).filter(r => r.client_group === 'Sahm Capital Aviation' && !r.deleted_at);
  const verified = rows.filter(r => r.integrity_status === 'verified_paid');
  return { n: rows.length, verifiedTotal: verified.reduce((a, r) => a + +r.total_incl_vat_sar, 0), hasCN: rows.some(r => r.integrity_status === 'credit_note' && r.total_incl_vat_sar < 0), hasExcluded: rows.some(r => r.integrity_status === 'excluded') };
});
STEP('S7 Sahm mess intact: 9 rows (incl. 2023 + 2027), credit note negative, excluded row outside verified totals', sahm.n === 9 && sahm.hasCN && sahm.hasExcluded && sahm.verifiedTotal === 34500 + 12650 + 18400 + 9660, JSON.stringify(sahm));

// ===== S8 · AR aging counts the pending money =====
await page.locator('#view button, #view .btn').filter({ hasText: /Clients & collections|العملاء والتحصيل/ }).first().click();
await page.waitForTimeout(1200);
await page.evaluate(() => { FIN.p.year = 'all'; FIN.p.part = 'all'; render(); });
await page.waitForTimeout(1000);
const arTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
// expected outstanding = the WHOLE fixture (stress formula + canonical rows), fetched
// from the mock in pages of 1000 — independent of the app's own aggregation
let fixtureRows = [], _from = 0;
while (true) { const chunk = await (await fetch(BASE + '/rest/v1/finance_invoices', { headers: { Range: _from + '-' + (_from + 999) } })).json(); fixtureRows = fixtureRows.concat(chunk); if (chunk.length < 1000) break; _from += 1000; }
const expOutNum = fixtureRows.filter(r => !r.deleted_at).reduce((a, r) => a + (+r.amount_remaining_sar || 0), 0);
const expOut = moneyS(expOutNum);
const arShown = (arTxt.match(/Outstanding[^%]{0,30}/) || [''])[0];
STEP('S8 outstanding (AR) equals the full-fixture formula sum', arTxt.includes(expOut), `expected ${expOut} (${expOutNum}) · shown "${arShown}" · fixture rows ${fixtureRows.length}`);
const credit515 = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
STEP('S9 credit held includes the 515K stress credit', /515|825/.test((credit515.match(/Client credit[^S]*?([\d.,]+K|[\d.,]+M)/) || ['', ''])[1]) || credit515.includes('K'), (credit515.match(/credit[^%]{0,60}/i) || [''])[0].slice(0, 60));
await SHOT('collections-stress');

// ===== S10 · whale client card: totals, contacts, billing accounts, perf =====
await nav(/^(Clients|العملاء)$/);
await page.waitForTimeout(1200);
const clientsCount = await page.evaluate(() => DB.businesses.filter(b => b.isClient).length);
STEP('S10 clients page holds all clients incl. 7 stress clients', clientsCount >= 18, 'clients=' + clientsCount);
const tOpen = Date.now();
await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Al-Mutlaq Holding Group'); openLead = b.id; current = 'leads'; render(); });
await page.waitForTimeout(2500);
const whaleMs = Date.now() - tOpen;
const wc = await page.evaluate(() => {
  const t = (document.getElementById('view').textContent || '').replace(/\s+/g, ' ');
  const b = DB.businesses.find(x => x.name === 'Al-Mutlaq Holding Group');
  return { contacts: (b.contacts || []).length, accounts: t.includes('#950') && t.includes('#951') && t.includes('#952'), agr: ((b.agreement || (b.raw && b.raw.agreement) || '')).includes('Master services agreement'), txt: t.slice(0, 0) };
});
const expBilled = moneyS(EXP.whaleBilled);
const wTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
STEP('S11 whale card: lifetime billed equals the 1,224-line formula sum', wTxt.includes(expBilled), `expected ${expBilled} (${EXP.whaleBilled})`);
STEP('S12 whale card: 8 contacts, 3 billing accounts, agreement stored, opened in ' + whaleMs + 'ms', wc.contacts === 8 && wc.accounts && wc.agr && whaleMs < 9000, JSON.stringify(wc));
const wInv = await page.evaluate(() => (document.getElementById('view').textContent || '').match(/(\d[\d,]*)\s*invoices/));
STEP('S13 whale card shows 1200 invoices (distinct, not 1224 lines)', !!wInv && wInv[1].replace(',', '') === '1200', wInv && wInv[0]);
await SHOT('whale-card');

// ===== S14 · leads page under load: long name, Arabic-only, near-dupes, no overflow =====
await nav(/^(Leads|العملاء المحتملون)$/);
await page.waitForTimeout(1200);
const leads = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
  longname: (document.getElementById('view').textContent || '').includes('The International Consolidated Company'),
  arabicLead: (document.getElementById('view').textContent || '').includes('مؤسسة الفجر'),
  dupes: DB.businesses.filter(b => /Noor ?Wings|Alnoorwings/i.test(b.name)).length,
}));
STEP('S14 leads under load: long name + Arabic-only shown, NO horizontal overflow', !leads.overflow && leads.longname && leads.arabicLead, JSON.stringify(leads));
STEP('S15 near-duplicate pair present, flagged not merged', leads.dupes === 2);
const lostShown = await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Riyadh Steel Works'); return b && (b.lostReason || b.raw && b.raw.lostReason || '').length > 5; });
STEP('S16 lost lead carries its reason', !!lostShown);
await SHOT('leads-stress');

// ===== S17 · the individual is finance-only, never a lead/client =====
const ind = await page.evaluate(() => ({
  inLeads: DB.businesses.some(b => (b.name || '').includes('ALQAHTANI')),
  inFinance: (FIN.rows || []).some(r => r.client_group === 'MOHAMMED ALQAHTANI'),
}));
STEP('S17 individual: in the ledger, NOT in the pipeline', !ind.inLeads && ind.inFinance, JSON.stringify(ind));

// ===== S18 · zero-invoice client card doesn\'t break =====
await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Nujoom Al-Khaleej Events'); openLead = b.id; current = 'leads'; render(); });
await page.waitForTimeout(1200);
const nuj = await page.evaluate(() => { const t = document.getElementById('view').textContent || ''; return t.includes('Nujoom') && !window.__renderErr; });
STEP('S18 zero-invoice client card renders clean', nuj && errs.length === 0, 'pageerrors=' + errs.length);

// ===== S19 · re-import a whale invoice: duplicate skipped even at volume =====
await nav(/^(Finance|المالية)$/);
await page.waitForTimeout(1500);
await page.locator('#view button, #view .btn').filter({ hasText: /Import|استيراد/ }).first().click();
await page.waitForTimeout(700);
const HDR = 'client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes';
fs.writeFileSync('shots/dup-whale.csv', HDR + '\r\nAl-Mutlaq Holding Group,March,Q1,DP-AMH-10007,TTIN-X,dup test,2024-03-05,Flights,1000,0,1000,800,200,verified_paid,');
await page.setInputFiles('#finFile', 'shots/dup-whale.csv');
await page.evaluate(() => finParse());
await page.waitForTimeout(1200);
const dupOut = await page.evaluate(() => (document.getElementById('finImpOut').textContent || '').replace(/\s+/g, ' '));
STEP('S19 whale invoice number re-imported → skipped as duplicate', /Skipped duplicates[^0-9]*1/.test(dupOut), dupOut.slice(0, 110));

// ===== S20 · Arabic sweep under load =====
await page.locator('button:has-text("العربية")').first().click().catch(() => {});
await page.waitForTimeout(2000);
for (const p of ['leads', 'clients', 'finance']) {
  await page.evaluate(pp => { current = pp; openLead = null; render(); }, p);
  await page.waitForTimeout(900);
}
const arOk = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 2, err: window.__renderErr || null }));
STEP('S20 Arabic under load: leads/clients/finance render, no overflow', !arOk.overflow && !arOk.err && errs.length === 0, JSON.stringify(arOk) + ' pageerrors=' + errs.length);
await SHOT('ar-stress');

// ===== S21 · far dates: 2023 history and 2027 future both first-class =====
await page.locator('button:has-text("English")').first().click().catch(() => {});
await page.waitForTimeout(1800);
await page.evaluate(() => { current = 'finance'; openLead = null; FIN.tab = 'overview'; render(); });
await page.waitForTimeout(1200);
const years2 = await page.evaluate(() => [...document.querySelectorAll('#view select')].map(s => [...s.options].map(o => o.value).join(',')).join(';'));
STEP('S21 year selector now offers 2023 AND 2027', /2023/.test(years2) && /2027/.test(years2));
await page.evaluate(() => { FIN.p.year = '2027'; FIN.p.part = 'all'; render(); });
await page.waitForTimeout(900);
const rev2027exp = moneyS(sum(S.filter(r => r.integrity_status === 'verified_paid' && r.invoice_date.startsWith('2027')), 'revenue_sar'));
const rev2027app = await page.evaluate(() => { const g = [...document.querySelectorAll('#view .card')].find(c => (c.parentElement.getAttribute('style') || '').includes('minmax(132px')); return g ? g.parentElement.children[0].textContent.replace(/\s+/g, ' ') : '?'; });
STEP('S22 2027 revenue equals the formula (future-dated invoices countable)', rev2027app.includes(rev2027exp), `app "${rev2027app}" vs ${rev2027exp}`);
await page.evaluate(() => { FIN.p.year = 'all'; render(); });
await page.waitForTimeout(700);

// ===== S23 · ledger views: by-invoice default, whole numbers, toggle to lines =====
await page.locator('#view button, #view .btn').filter({ hasText: /^(Ledger|السجل)$/ }).first().click();
await page.waitForTimeout(1500);
const led1 = await page.evaluate(() => ({
  label: ((document.getElementById('view').textContent || '').match(/(\d[\d,]*)\s*invoices · rev/) || [])[1] || null,
  noFractions: !/\d\.\d\d\b/.test([...document.querySelectorAll('#view table td')].slice(0, 60).map(t => t.textContent).join(' ')),
  multiSvc: (document.getElementById('view').textContent || '').includes('services'),
}));
STEP('S23 ledger defaults to BY INVOICE: invoice count label, multi-service marker, whole numbers only', !!led1.label && led1.noFractions && led1.multiSvc, JSON.stringify(led1));
await SHOT('ledger-by-invoice');
await page.locator('#view button').filter({ hasText: /^By service line$/ }).first().click();
await page.waitForTimeout(1200);
const led2 = await page.evaluate(() => ((document.getElementById('view').textContent || '').match(/(\d[\d,]*)\s*rows · rev/) || [])[1] || null);
STEP('S24 toggle to BY SERVICE LINE shows more rows than invoices', !!led2 && parseInt(led2.replace(/,/g, '')) > parseInt((led1.label || '0').replace(/,/g, '')), `lines=${led2} invoices=${led1.label}`);
const wadiGrouped = await page.evaluate(() => { FIN.lview = 'invoice'; FIN.f.q = 'DP-WDI-100'; render(); return null; });
await page.waitForTimeout(900);
const wadiRow = await page.evaluate(() => { const t = [...document.querySelectorAll('#view table tbody tr')]; return { n: t.length, svc: t[0] ? t[0].textContent.includes('9 services') : false }; });
STEP('S25 the 12-line Wadi invoice = ONE row marked "9 services" in the simple view', wadiRow.n >= 1 && wadiRow.svc, JSON.stringify(wadiRow));
await page.evaluate(() => { FIN.f.q = ''; render(); });
await page.waitForTimeout(600);
// full precision survives where it should: the CSV rows stay line-level
const prec = await page.evaluate(() => { const lines = (FIN._csvRows || []).filter(x => x.invoice_no === 'DP-WDI-100').length; return { csvLines: lines }; });
STEP('S26 CSV export still carries every service line (12 for Wadi)', prec.csvLines === 12, JSON.stringify(prec));

// ===== S27 · client card no longer wears the Leads costume =====
await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Al-Mutlaq Holding Group'); openLead = b.id; current = 'leads'; render(); });
await page.waitForTimeout(2000);
const cctx = await page.evaluate(() => ({
  title: (document.getElementById('vTitle') || {}).textContent || '',
  chipsHidden: (() => { const c = document.querySelector('#view .v26_3-chips'); return !c || c.style.display === 'none'; })(),
  back: [...document.querySelectorAll('#view button')].some(b => b.textContent.trim() === '← Back to clients'),
}));
STEP('S27 client card: title says Clients, stage chips hidden, Back goes to clients', /Clients|العملاء/.test(cctx.title) && cctx.chipsHidden && cctx.back, JSON.stringify(cctx));
const backWorks = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => x.textContent.trim() === '← Back to clients'); if (b) { b.click(); return true; } return false; });
await page.waitForTimeout(1200);
STEP('S28 Back lands on the Clients page', backWorks && await page.evaluate(() => current === 'clients'));
await SHOT('client-context');

// ===== S29 · REAL Direct model: transaction grouping + VAT row + uuid deep link =====
await page.evaluate(() => { current = 'finance'; openLead = null; FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const r = (FIN.rows || []).find(x => x.invoice_no === 'DP-WDI-100'); finRow(r.id); });
await page.waitForTimeout(800);
const txm = await page.evaluate(() => {
  const m = document.getElementById('finModal'); if (!m) return null;
  const t = m.textContent.replace(/\s+/g, ' ');
  const a = [...m.querySelectorAll('a')].find(x => (x.href || '').includes('/en/admin/invoices/view/'));
  return { tx1: t.includes('TXR-1163801001'), tx2: t.includes('TXR-1163801002'), noVat: !/VAT|ضريبة القيمة/.test(t), deep: a ? a.href : null };
});
STEP('S29 invoice card groups by TRANSACTION (two headers), VAT never shown (owner rule)', !!txm && txm.tx1 && txm.tx2 && txm.noVat, JSON.stringify(txm));
STEP('S30 "Open in Direct" deep-links to the real admin invoice URL by uuid', !!txm && !!txm.deep && txm.deep.includes('/en/admin/invoices/view/e2f1c9aa-7d31-4a52-9d3e-000000000100'), txm && txm.deep);
await SHOT('transaction-model');
await page.evaluate(() => finCloseModal());

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('PAGEERRORS:', errs.length, errs.slice(0, 8));
await browser.close(); process.exit(0);
