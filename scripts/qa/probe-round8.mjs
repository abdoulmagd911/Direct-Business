/* Round-8 probe: auto-link (v66), importer verification-skip, service catalog in dropdowns,
   Takamol absent everywhere, manual link button hidden. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8971, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
let errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
page.on('dialog', d => d.accept('QA'));
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
const LOG = []; const STEP = (n, ok, d = '') => LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`);

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button:has-text("Sign in")').first().click();
await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 });
await page.waitForTimeout(1500);

// ---- load finance
await page.evaluate(() => { current = 'finance'; render(); });
await page.waitForFunction(() => window.FIN && FIN.rows && FIN.rows.length > 0, null, { timeout: 20000 });
await page.waitForTimeout(800);

// 1) v66 auto-link: plant an unlinked group matching a client's exact name → link appears without any clicks
const planted = await page.evaluate(() => {
  const cl = (DB.businesses || []).find(b => b.isClient && !(FIN.linkByGroup || {})[b.name]);
  if (!cl) return null;
  FIN.rows.push({ id: 'qa-al-1', invoice_no: 'QA-AL-1', client_group: cl.name, customer_raw_name: cl.name, invoice_date: '2026-08-01', month: 'August', quarter: 'Q3', revenue_sar: 1000, total_incl_vat_sar: 1000, cost_sar: 800, profit_sar: 200, amount_received_sar: 1000, amount_remaining_sar: 0, integrity_status: 'verified_paid', record_type: 'b2b', service_type: 'Flights', revenue_way: 'invoice' });
  render();
  return cl.name;
});
await page.waitForTimeout(2500);
const linked = await page.evaluate(n => { const l = (FIN.linkByGroup || {})[n]; return l ? { biz: !!l.business_id, by: l.confirmed_by } : null; }, planted);
STEP('v66: unlinked invoice group auto-links to the client by name (no clicks)', !!linked && linked.biz && linked.by === 'auto-match', planted + ' → ' + JSON.stringify(linked));
const srvRows = await (await fetch(BASE + '/rest/v1/finance_client_links')).json();
STEP('v66: auto-link is SAVED to the database (not just on screen)', srvRows.some(r => r.client_group === planted && r.confirmed_by === 'auto-match'));

// 2) v66 variant: pure-B2C group auto-marks as Individuals
const b2cName = await page.evaluate(() => {
  FIN.rows.push({ id: 'qa-al-2', invoice_no: 'QA-AL-2', client_group: 'Ahmed Individual Person', customer_raw_name: 'Ahmed Individual Person', invoice_date: '2026-08-02', month: 'August', quarter: 'Q3', revenue_sar: 500, total_incl_vat_sar: 500, cost_sar: 400, profit_sar: 100, amount_received_sar: 500, amount_remaining_sar: 0, integrity_status: 'verified_paid', record_type: 'b2c', service_type: 'Flights', revenue_way: 'invoice' });
  render(); return 'Ahmed Individual Person';
});
await page.waitForTimeout(2500);
const indiv = await page.evaluate(n => { const l = (FIN.linkByGroup || {})[n]; return l ? l.is_client : undefined; }, b2cName);
STEP('v66: an individuals-only group auto-marks "Individuals / not a client"', indiv === false);

// 3) manual "Link finance to clients" button is hidden
const btnHidden = await page.evaluate(() => { const b = document.getElementById('v53btn'); return !b || b.style.display === 'none' || b.offsetParent === null; });
STEP('manual "Link finance to clients" button is gone from Finance', btnHidden);

// 4) importer skips verification services (Techtic Support) with a visible note
const dpCsv = ['Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman',
 'invoice,Direct Flights,QA Verif Co,REF-Q1,INV-88001,01/08/2026 10:00:00 AM,Fully Paid,,,,,5750,Riyadh,QA',
 'item,Direct Flights,QA Verif Co,REF-Q1,,,,Ticket RUH-DXB,No,0,5000,,,',
 'item,Direct Flights,QA Verif Co,REF-Q1,,,,Service fee,Yes,0,750,,,',
 'invoice,Techtic Support,QA Verif Co,REF-Q2,INV-88002,02/08/2026 10:00:00 AM,Fully Paid,,,,,1150,Riyadh,QA',
 'item,Techtic Support,QA Verif Co,REF-Q2,,,,Verification service,Yes,0,1150,,,',
 'invoice,Direct Wallet,QA Verif Co,REF-Q3,INV-88003,03/08/2026 10:00:00 AM,Fully Paid,,,,,2000,Riyadh,QA',
 'item,Direct Wallet,QA Verif Co,REF-Q3,,,,Wallet Balance,No,0,2000,,,'].join('\n');
fs.writeFileSync('shots/dp-verif-test.csv', dpCsv);
await page.evaluate(() => { FIN.tab = 'import'; render(); });
await page.waitForTimeout(900);
await page.setInputFiles('#view input[type=file]', 'shots/dp-verif-test.csv');
await page.locator('#view button:has-text("Check file")').first().click().catch(() => {});
await page.waitForTimeout(1500);
const impOut = await page.evaluate(() => (document.getElementById('finImpOut') || {}).textContent || '');
STEP('importer: verification services are skipped with a plain-language note', /verification services skipped/i.test(impOut), impOut.slice(0, 180));
STEP('importer: wallet top-up still skipped too', /wallet top-ups skipped/i.test(impOut));
STEP('importer: only the real invoice remains importable (1 of 3)', /Ready to import:\s*1\b/.test(impOut.replace(/\s+/g, ' ')));
const pendOK = await page.evaluate(() => (FIN._pending || []).every(r => r.service_type !== 'Verification services' && !/techtic/i.test(r.products || '')));
STEP('importer: nothing verification-related sits in the pending batch', pendOK);

// 5) Requests form service dropdown now carries the full catalog
await page.evaluate(() => { if (typeof editRequest === 'function') editRequest(); });
await page.waitForTimeout(700);
const svcOpts = await page.evaluate(() => [...(document.querySelectorAll('#r_service option') || [])].map(o => o.value));
STEP('Requests form: Insurance is a service choice', svcOpts.includes('Insurance'), svcOpts.length + ' options');
STEP('Requests form: International driving permit is a service choice', svcOpts.includes('Intl driving permit'));
STEP('Requests form: Translation + eSIM + Umrah also offered', ['Translation', 'eSIM', 'Umrah'].every(s => svcOpts.includes(s)));
STEP('Requests form: no wallet/jargon entries offered', !svcOpts.includes('Wallet top-up') && !svcOpts.includes('(unspecified)'));
await page.evaluate(() => { const o = document.getElementById('ov'); if (o) o.classList.remove('show'); });

// 6) Lead form "Services they use" suggests the catalog
await page.evaluate(() => { current = 'leads'; openLead = null; render(); if (typeof editBusiness === 'function') editBusiness(); });
await page.waitForTimeout(700);
const dl = await page.evaluate(() => { const d = document.getElementById('svclist'); return d ? [...d.querySelectorAll('option')].map(o => o.value) : null; });
STEP('Lead form: service suggestions include Insurance + Intl driving permit', !!dl && dl.includes('Insurance') && dl.includes('Intl driving permit'), (dl || []).length + ' suggestions');
await page.evaluate(() => { const o = document.getElementById('ov'); if (o) o.classList.remove('show'); });

// 7) Takamol appears nowhere in any page text
let takHits = [];
for (const pid of ['today', 'leads', 'clients', 'finance', 'reports']) {
  await page.evaluate(id => { openLead = null; current = id; render(); }, pid);
  await page.waitForTimeout(700);
  const t = await page.evaluate(() => document.body.textContent || '');
  if (/takamol|تكامل لخدمات/i.test(t)) takHits.push(pid);
}
STEP('Takamol appears on no page', takHits.length === 0, takHits.join(','));

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length); errs.slice(0, 8).forEach(e => console.log('  ', e));
await browser.close(); process.exit(0);
