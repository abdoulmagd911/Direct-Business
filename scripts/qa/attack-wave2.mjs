/* Attack wave 2: topbar (search / Export / Share / Team / Access), clients page,
   finance import end-to-end commit, promo card AR, mobile viewport. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8947, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
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
const shot = p => page.screenshot({ path: 'shots/atk2-' + p + '.png' }).catch(() => {});
const txt = () => page.evaluate(() => ((document.getElementById('view') || {}).textContent || '').replace(/\s+/g, ' '));

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button:has-text("Sign in")').first().click();
await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 });
await page.waitForTimeout(1500);

// ---- global search
await page.locator('input[placeholder*="Search everything"], input[placeholder*="بحث"]').first().fill('Nadeem').catch(() => {});
await page.waitForTimeout(900);
const searchHits = await page.evaluate(() => { const b = document.getElementById('gres'); if (!b || b.style.display === 'none') return null; const l = b.querySelector('.gres-l'); return l ? { label: l.textContent, clipped: l.scrollWidth > l.clientWidth + 2 } : null; });
STEP('global search dropdown shows the match with a readable name', !!searchHits && /Nadeem/.test(searchHits.label) && !searchHits.clipped, JSON.stringify(searchHits));
await shot('global-search');
await page.keyboard.press('Escape').catch(() => {});

// ---- topbar Export menu
await page.locator('button:has-text("Export")').first().click().catch(() => {});
await page.waitForTimeout(600);
await shot('export-menu');
const expItems = await page.evaluate(() => [...document.querySelectorAll('button,a')].filter(b => /Excel|CSV|PDF|Print/i.test(b.textContent)).length);
STEP('Export menu opens with options', expItems > 0, expItems + ' options');
await page.keyboard.press('Escape').catch(() => {});
await page.evaluate(() => document.body.click());

// ---- Team & Access (re-pointed 2026-09-02: the topbar "Team"/"Access" buttons were folded into
// Settings → "Open Team & Access" (js/31 v48Users) during the topbar tidy — the old check drove
// buttons that no longer exist by design)
{
  await page.evaluate(() => { if (typeof window.v48Users === 'function') window.v48Users(); });
  await page.waitForTimeout(1000);
  const up = await page.evaluate(() => { const m = [...document.querySelectorAll('body > div')].find(d => d.style && +d.style.zIndex > 999990 && d.textContent.length > 50); return m ? m.textContent.slice(0, 60) : null; });
  STEP('Team & Access page opens from Settings (v48Users)', !!up, String(up).slice(0, 40));
  await shot('team-access');
  await page.evaluate(() => { [...document.querySelectorAll('body > div')].forEach(d => { if (d.style && +d.style.zIndex > 999990 && +d.style.zIndex < 2147483000) d.remove(); }); });
}

// ---- Share view-only
await page.locator('button:has-text("Share")').first().click().catch(() => {});
await page.waitForTimeout(700);
await shot('share');
await page.evaluate(() => { [...document.querySelectorAll('body > div')].forEach(d => { if (d.style && +d.style.zIndex > 999990 && +d.style.zIndex < 2147483000) d.remove(); }); });

// ---- Clients page: open a client, check finance snapshot + back
await page.evaluate(() => { current = 'clients'; openLead = null; render(); });
await page.waitForTimeout(1000);
await shot('clients');
// re-pointed 2026-09-02: the snapshot (js/38) renders only for a client whose finance group is
// linked or name-matched, and its labels are "Invoices / Last invoice / Open in Finance ledger"
// — open such a client on purpose instead of whichever row happens to be first
// finance rows (and the client links) load on the first Finance visit — ask for them explicitly
await page.evaluate(() => { if (typeof FIN !== 'undefined' && !FIN.rows && typeof finLoad === 'function') finLoad(); });
await page.waitForFunction(() => typeof FIN !== 'undefined' && Array.isArray(FIN.rows) && FIN.rows.length > 0 && FIN.groupsByBiz, null, { timeout: 15000 }).catch(() => {});
const picked = await page.evaluate(() => {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
  const groups = new Set((FIN.rows || []).map(r => norm(r.client_group)));
  const linked = FIN.groupsByBiz || {};
  const uuid = b => (window.__bizUuid ? window.__bizUuid(b.id) : b.id);
  const c = (DB.businesses || []).find(b => b.isClient && ((linked[uuid(b)] || []).length || groups.has(norm(b.name))));
  const dbg = 'rows=' + (FIN.rows || []).length + ' linkedBiz=' + Object.keys(linked).length + ' clients=' + (DB.businesses || []).filter(b => b.isClient).length;
  // the detail card renders under the leads route for leads and clients alike (js/38 re-titles it "Clients")
  if (!c) return 'NONE (' + dbg + ')'; openLead = c.id; current = 'leads'; render(); return c.name;
});
await page.waitForTimeout(1500);
const clientOpened = await page.evaluate(() => !!openLead);
const cTxt = await txt();
STEP('client card opens with finance snapshot (invoices / last invoice)', !!picked && clientOpened && /Last invoice|Open in Finance ledger|آخر فاتورة/.test(cTxt), String(picked) + ' · ' + cTxt.slice(0, 160));
STEP('client card is titled Clients (not pipeline)', /Clients|العملاء/.test(cTxt));
await shot('client-card');
const backOK = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button, #view a')].find(x => /Back to clients|رجوع/.test(x.textContent)); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(700);
STEP('client card back → clients list', backOK && await page.evaluate(() => current === 'clients' && !openLead));

// ---- Finance import: paste CSV → preview → commit
await page.evaluate(() => { current = 'finance'; FIN.tab = 'import'; render(); });
await page.waitForTimeout(900);
await shot('import');
// re-pointed 2026-09-02: the old 15-column ledger CSV is no longer a recognised source — the
// universal importer (js/65) takes the Direct Payments export, the two capture files, the tax
// file, or a file whose columns were taught once. Drive the taught-once path the way a real
// hand-made sheet goes through: mapping seeded, ingest → preview → confirm → the mock table.
await page.evaluate(() => {
  const header = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
  DB.settings = DB.settings || {}; DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
  DB.settings.importSignatureMappings.push({ key: header.slice().sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'attack', addedAt: new Date().toISOString() });
});
const csv = 'Ref,Customer,Date,Total,Cost\nQA-INV-1,QA Import Co,2026-07-15,1150,900';
await page.evaluate((t) => window.v65IngestText('qa-import.csv', t), csv);
await page.waitForTimeout(1500);
await shot('import-preview');
const commitBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => /Confirm import/.test(x.textContent)); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(2000);
const stored = await (await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.QA-INV-1')).json();
STEP('import: taught file → preview → confirm lands the invoice in the table', commitBtn && stored.length === 1, stored.length + ' row(s)');
// re-dropping the SAME file must report it unchanged and never create a second row
await page.evaluate((t) => window.v65IngestText('qa-import.csv', t), csv);
await page.waitForTimeout(1500);
const again = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => /Confirm import/.test(x.textContent)); if (b) b.click(); return { btn: !!b, txt: (document.getElementById('finImpOut') || {}).innerText || '' }; });
await page.waitForTimeout(1500);
const stored2 = await (await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.QA-INV-1')).json();
STEP('import: re-dropping the same file cannot duplicate', stored2.length === 1 && /unchanged|0 new|بدون تغيير/i.test(again.txt), stored2.length + ' copies');

// ---- promo card in Arabic
await page.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); FIN.tab = 'overview'; render(); });
await page.waitForTimeout(1200);
// re-pointed 2026-09-02: the promo-code card was removed from the Overview on purpose (owner
// direction, see the round-8/notes re-points) — it must stay ABSENT; the flat services table stays
const arOv = await page.evaluate(() => ({ svc: !!document.querySelector('.v32-svc'), promo: !!document.querySelector('.v63-promo'), svcTxt: (document.querySelector('.v32-svc') || {}).textContent || '' }));
STEP('AR overview: flat services render in Arabic, promo card absent', arOv.svc && !arOv.promo && /[؀-ۿ]/.test(arOv.svcTxt));
await shot('ar-fin-overview');
await page.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });
await page.waitForTimeout(600);

// ---- mobile viewport walk
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
for (const pid of ['today', 'leads', 'finance']) {
  await page.evaluate(id => { openLead = null; current = id; render(); }, pid);
  await page.waitForTimeout(900);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 6);
  STEP('mobile "' + pid + '": no horizontal page overflow', !over, 'scrollW=' + await page.evaluate(() => document.documentElement.scrollWidth));
  await shot('mobile-' + pid);
}

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length); errs.slice(0, 8).forEach(e => console.log('  ', e));
await browser.close(); process.exit(0);
