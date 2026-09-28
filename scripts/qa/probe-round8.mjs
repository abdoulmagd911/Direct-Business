/* Round-8 probe: auto-link (v66), importer verification-skip, service catalog in dropdowns,
   Tawthiq absent everywhere, manual link button hidden.
   E (2026-09-27, DECISIONS D16/D17): the v66 auto-linker is switched off — nothing merges by name and no code writes a
   record. Checks 1-2 now assert the opposite of what they used to: a Finance row named exactly like a client stays
   UNMERGED (money_rows merge_state 'no_client_id', not in FIN.linkByGroup), NOTHING is written to any link/name/ID
   table by the page, and Finance → Rules lists it under "Needs a decision" with the same-name company only SUGGESTED;
   an individuals-only group is not auto-marked either. The seed moved from mock-seed-live.mjs (which has no money_rows
   view) to mock-supabase.mjs, whose Tawthiq fixture row is caught by a name rule — so "Tawthiq appears on no page" now
   runs with the excluded row really in the ledger. The rows are planted through the table (as an import would), not
   pushed into FIN.rows, because the company now comes from the view. */
import { start } from './mock-supabase.mjs';
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
await page.route(u=>u.href.includes('cdn.jsdelivr.net'), route);
await page.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), route);
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

// 1) E: no automatic merge by name. Plant (through the table, as an import would) a row named exactly like a client and a
//    private person's row; reload; render several times past the old linker's timers.
const WATCH = ['finance_client_links', 'company_name_aliases', 'client_profiles', 'company_discount_codes', 'money_exclusion_rules'];
const writes = []; page.on('request', (rq) => { const m = rq.url().match(/\/rest\/v1\/([a-z_]+)/); if (m && WATCH.includes(m[1]) && !['GET', 'HEAD'].includes(rq.method())) writes.push(rq.method() + ' ' + m[1]); });
const planted = await page.evaluate(async () => {
  const used = new Set((FIN.rows || []).map((r) => r.client_group));
  const cl = (DB.businesses || []).find(b => b.isClient && b.name && !used.has(b.name) && !(FIN.linkByGroup || {})[b.name]);   // a client with no money yet, so the row is the only thing under its name
  if (!cl) return null;
  const base = { invoice_date: '2026-08-01', month: 'August', quarter: 'Q3', total_incl_vat_sar: 1000, wallet_portion_sar: 0, revenue_sar: 1000, cost_sar: 800, profit_sar: 200, amount_received_sar: 1000, amount_remaining_sar: 0, integrity_status: 'verified_paid', service_type: 'Flights', revenue_way: 'invoice', deleted_at: null };
  const r = await fc().from('finance_invoices').insert([
    Object.assign({ id: 'qa-al-1', invoice_no: 'QA-AL-1', client_group: cl.name, customer_raw_name: cl.name, record_type: 'b2b' }, base),
    Object.assign({ id: 'qa-al-2', invoice_no: 'QA-AL-2', client_group: 'Ahmed Individual Person', customer_raw_name: 'Ahmed Individual Person', record_type: 'b2c' }, base)]).select('id');
  FIN.rows = null; finLoad(); return { name: cl.name, wrote: (r.data || []).length };
});
const mOf = "(no) => { const r = (FIN.rows || []).find((x) => x.invoice_no === no); return r ? FIN.m[r.id] || null : null; }";
await page.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading && (FIN.rows || []).some((x) => x.invoice_no === 'QA-AL-1'), null, { timeout: 30000 }).catch(() => {});
for (let i = 0; i < 4; i++) { await page.waitForTimeout(1200); await page.evaluate(() => { try { render(); } catch (_) {} }); }
await page.waitForTimeout(2500);
const st = await page.evaluate(([n, src]) => { const mOf = eval(src); return ({ link: (FIN.linkByGroup || {})[n] || null, m1: mOf('QA-AL-1'), m2: mOf('QA-AL-2'), indiv: (FIN.linkByGroup || {})['Ahmed Individual Person'] || null }); }, [planted && planted.name, mOf]);
STEP('E: a row named exactly like a client is NOT merged by name (it stands alone until a person types it)', !!planted && planted.wrote === 2 && !st.link && st.m1 && st.m1.merge_state === 'no_client_id' && !st.m1.business_id, (planted && planted.name) + ' → ' + JSON.stringify({ link: st.link, m: st.m1 && st.m1.merge_state }));
STEP('E: the page wrote NOTHING to any link, name, client-ID, code or rule table (D17)', writes.length === 0, writes.join(', '));
STEP('E: an individuals-only group is not auto-marked either — it stands alone, counted', !st.indiv && st.m2 && st.m2.merge_state === 'no_client_id' && st.m2.counts === true);
await page.evaluate(() => { current = 'finance'; finGo('rules'); });
await page.waitForTimeout(1200);
const dec = await page.evaluate((n) => { const tr = [...document.querySelectorAll('tr[data-v117-loose]')].find((x) => x.getAttribute('data-v117-loose') === n); if (!tr) return null;
  const sel = tr.querySelector('select'); return { sug: /Suggested:/.test(tr.innerText), pre: sel ? sel.value : '' }; }, planted && planted.name);
STEP('E: Finance → Rules lists it under "Needs a decision", the same-name company only suggested (pre-selected, not applied)', !!dec && dec.sug && !!dec.pre && !st.link, JSON.stringify(dec));

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
// 2026-09-02: wording follows the universal importer's five-count preview (Spec 9) — the two
// non-revenue rows (verification service, wallet top-up) land under "Excluded by rule", and
// exactly one real invoice is offered for import.
const impFlat = impOut.replace(/\s+/g, ' ');
// D21 (28 Sep): a wallet top-up is STORED as its own kind (never revenue, never counted) — not dropped. The verification
// service is still never imported.
STEP('importer: the verification service is excluded by rule (1)', /Excluded by rule\s*1\b/.test(impFlat), impOut.slice(0, 180));
STEP('importer: the wallet top-up is stored as a top-up, named in the preview', /Wallet top-ups[^0-9]*1(?!\d)/.test(impFlat), impOut.slice(0, 400));
STEP('importer: the real invoice and the top-up are offered (New 2), the verification service never is', /New\s*2\b/.test(impFlat) && /Confirm import\s*[—-]\s*2 new/.test(impFlat));
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

// 7) Tawthiq appears nowhere in any page text
let takHits = [];
for (const pid of ['today', 'leads', 'clients', 'finance', 'reports']) {
  await page.evaluate(id => { openLead = null; current = id; render(); }, pid);
  await page.waitForTimeout(700);
  const t = await page.evaluate(() => document.body.textContent || '');
  if (/tawthiq|تكامل لخدمات/i.test(t)) takHits.push(pid);
}
STEP('Tawthiq appears on no page', takHits.length === 0, takHits.join(','));

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length); errs.slice(0, 8).forEach(e => console.log('  ', e));

/* 2026-09-06 (watch cycle 35): this file counted its failures, printed them, and then exited 0.
   The battery reads exit codes, so every regression this probe could see has been reported to
   the runner as a pass for as long as it has existed. The count decides the exit code now. */
const __fails = LOG.filter((l) => l.startsWith('FAIL')).length;
await browser.close();
if (__fails) { console.log(`\nFAILED — ${__fails} check(s) did not pass.`); process.exit(1); }
process.exit(0);
