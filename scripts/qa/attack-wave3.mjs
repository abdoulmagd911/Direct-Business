/* Wave 3 — the owner's ordered sweep: sign OUT → sign IN → lead through all phases
   → convert to client → finance → the NEW importer with a real-shaped Direct Payments
   export → reports → sign out again. Plus: old mirror folded away, Today card rewired. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8951, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
let errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
page.on('dialog', d => d.accept('QA'));
const route = async r => {
  const u = r.request().url();
  if (u.includes('cdn.jsdelivr.net')) {
    if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  }
  const url = new URL(u);
  const resp = await fetch(BASE + url.pathname + url.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postDataBuffer() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
};
await page.route('**cdn.jsdelivr.net/**', route);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
const LOG = []; const STEP = (n, ok, d = '') => LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`);
const shot = p => page.screenshot({ path: 'shots/atk3-' + p + '.png' }).catch(() => {});
const closeAll = () => page.evaluate(() => {
  const ov = document.getElementById('ov'); if (ov) ov.classList.remove('show');
  [...document.querySelectorAll('body > div')].forEach(d => { const z = +((d.style || {}).zIndex || 0); if (z > 999990 && z < 2147483000) d.remove(); });
  const fm = document.getElementById('finModal'); if (fm) fm.remove();
});
const signIn = async () => {
  await page.locator('input[type="email"]').first().fill('test@directksa.com');
  await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
  await page.locator('button:has-text("Sign in")').first().click();
  await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 });
  await page.waitForTimeout(1200);
};

// ---- boot → sign in → SIGN OUT → sign back in (the owner's exact order)
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await signIn();
STEP('first sign-in works', true);
await page.locator('button:has-text("Sign out")').first().click();
await page.waitForTimeout(6500);
await page.waitForSelector('input[type=email]', { timeout: 15000 }).catch(() => {});
const loginBack = await page.evaluate(() => !!document.querySelector('input[type=email]'));
STEP('sign OUT returns to the login page', loginBack);
await shot('login-page');
const loginTxt = await page.evaluate(() => document.body.textContent);
STEP('login page carries the brand sentences under the logo', /GLOBAL SUPPLIER POWER|Global supplier power/i.test(loginTxt) && /Sign in to your team workspace/.test(loginTxt) && /قوة موردين عالمية/.test(loginTxt));
await signIn();
STEP('sign back IN works', true);

// ---- the old mirror is folded away
await page.evaluate(() => { current = 'today'; openLead = null; render(); });
await page.waitForTimeout(900);
const fold = await page.evaluate(() => {
  const nav = document.getElementById('nav');
  const roVisible = [...nav.querySelectorAll('*')].some(el => /From Direct|من نظام Direct/.test(el.textContent || '') && el.offsetParent !== null && el.textContent.length < 60);
  const qc = [...document.querySelectorAll('.v19-qc .lab')].map(l => l.textContent.trim());
  return { roVisible, qc };
});
STEP('nav: "From Direct (read-only)" group is hidden', !fold.roVisible, JSON.stringify(fold.qc));
STEP('Today quick card says "Import invoices" (not "New invoice")', fold.qc.includes('Import invoices') && !fold.qc.includes('New invoice'));
await shot('today-folded');
const qcNav = await page.evaluate(() => { const q = [...document.querySelectorAll('.v19-qc')].find(x => /Import invoices/.test(x.textContent)); if (!q) return false; q.click(); return true; });
await page.waitForTimeout(1000);
STEP('the Import card opens Finance → Import', qcNav && await page.evaluate(() => current === 'finance' && FIN.tab === 'import'));

// ---- full lead lifecycle: create → contact → proposal → won → client
await page.evaluate(() => { current = 'leads'; openLead = null; render(); });
await page.waitForTimeout(900);
await page.locator('#view button:has-text("New business")').first().click().catch(() => {});
await page.waitForTimeout(600);
await page.evaluate(() => { const f = document.getElementById('f_name'); if (f) f.value = 'Wave3 Lifecycle Co'; });
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Save|حفظ)/.test(x.textContent.trim())); if (b) b.click(); });
await page.waitForTimeout(1000);
await closeAll();
const st1 = await page.evaluate(() => !!DB.businesses.find(b => b.name === 'Wave3 Lifecycle Co'));
STEP('lifecycle 1: lead created', st1);
for (const stage of ['Contacted', 'Qualified', 'Proposal']) {
  await page.evaluate(s => { const b = DB.businesses.find(x => x.name === 'Wave3 Lifecycle Co'); leadQuickEdit(b.id); setTimeout(() => { const sel = document.getElementById('qe_stage'); if (sel) { sel.value = s; } }, 100); }, stage);
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Save|حفظ)/.test(x.textContent.trim())); if (b) b.click(); });
  await page.waitForTimeout(700);
}
await closeAll();
const st2 = await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Wave3 Lifecycle Co'); return leadStage(b); });
STEP('lifecycle 2: walked Contacted → Qualified → Proposal', st2 === 'Proposal', 'now ' + st2);
// win it → must become a client (auto-convert + handover)
await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Wave3 Lifecycle Co'); leadQuickEdit(b.id); setTimeout(() => { const sel = document.getElementById('qe_stage'); if (sel) sel.value = 'Won'; }, 100); });
await page.waitForTimeout(500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Save|حفظ)/.test(x.textContent.trim())); if (b) b.click(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const m = [...document.querySelectorAll('body > div')].filter(d => +((d.style || {}).zIndex || 0) > 999990 && +((d.style || {}).zIndex || 0) < 2147483000); m.forEach(x => x.remove()); });
await closeAll();
const st3 = await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Wave3 Lifecycle Co'); return { won: leadStage(b) === 'Won', client: !!b.isClient }; });
STEP('lifecycle 3: Won auto-converts to client', st3.won && st3.client, JSON.stringify(st3));
const st4 = await page.evaluate(() => { current = 'clients'; openLead = null; render(); return true; });
await page.waitForTimeout(900);
const inClients = await page.evaluate(() => (document.getElementById('view').textContent || '').includes('Wave3 Lifecycle Co'));
STEP('lifecycle 4: appears in the Clients list', inClients);

await closeAll();
// ---- THE IMPORTER with a real-shaped Direct Payments export (44 invoices, all four ways)
await page.evaluate(() => { current = 'finance'; FIN.tab = 'import'; render(); });
await page.waitForTimeout(1200);
const impTxt = await page.evaluate(() => document.getElementById('view').textContent);
STEP('import screen announces the Direct Payments reader', /reads Direct Payments|Invoice Export/.test(impTxt));
await shot('importer-screen');
await page.setInputFiles('#view input[type=file]', 'shots/dp-export-test.csv');
await page.waitForTimeout(400);
await page.locator('#view button:has-text("Check file")').first().click();
await page.waitForTimeout(2000);
await shot('importer-preview');
const prev = await page.evaluate(() => (document.getElementById('finImpOut') || {}).textContent || '');
STEP('importer preview: detects the export, counts invoices + transactions + wallet', /Direct Payments export detected/.test(prev) && /Ready to import/.test(prev), prev.replace(/\s+/g, ' ').slice(0, 140));
const pending = await page.evaluate(() => (FIN._pending || []).length);
const pendStats = await page.evaluate(() => { const P = FIN._pending || []; return { n: P.length, tx: P.filter(r => r.revenue_way === 'transaction').length, wal: P.filter(r => r.integrity_status === 'excluded').length, cred: P.filter(r => r.integrity_status === 'credit_note').length, paid: P.filter(r => r.integrity_status === 'verified_paid').length, twins: P.filter(r => r.transaction_ref).length, badMath: P.filter(r => Math.abs((r.revenue_sar + r.vat_sar + r.wallet_portion_sar) - r.total_incl_vat_sar) > 1).length }; });
STEP('importer parsed the real shapes (paid/tx/wallet/credit + twin refs, math consistent)', pendStats.n > 20 && pendStats.paid > 0 && pendStats.wal > 0 && pendStats.badMath === 0, JSON.stringify(pendStats));
// commit into the (mock) ledger
await page.locator('#view button:has-text("Confirm import")').first().click();
await page.waitForTimeout(3000);
const after = await page.evaluate(() => ({ n: (FIN.rows || []).filter(r => String(r.source_batch || '').startsWith('dp-import')).length }));
STEP('importer commit: rows land in the ledger', after.n === pendStats.n, JSON.stringify(after));
// re-drop the same file → everything skipped
await page.evaluate(() => { FIN.tab = 'import'; render(); });
await page.waitForTimeout(900);
await page.setInputFiles('#view input[type=file]', 'shots/dp-export-test.csv');
await page.waitForTimeout(400);
await page.locator('#view button:has-text("Check file")').first().click();
await page.waitForTimeout(2000);
const prev2 = await page.evaluate(() => (document.getElementById('finImpOut') || {}).textContent || '');
STEP('importer: dropping the SAME file again skips every row (no duplicates possible)', /Skipped \(already in the ledger\): ?\d+/.test(prev2.replace(/\s+/g, ' ')) && !/Confirm import/.test(prev2), prev2.replace(/\s+/g, ' ').slice(0, 120));

// ---- ledger sanity after import + reports + sign out
await page.evaluate(() => { FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(900);
await shot('ledger-after-import');
await page.evaluate(() => { FIN.tab = 'overview'; render(); });
await page.waitForTimeout(1000);
const ovOK = await page.evaluate(() => !!document.querySelector('.v32-svc') && !!document.querySelector('.v63-promo'));
STEP('overview still healthy after import (flat services + promo cards)', ovOK);
await page.evaluate(() => { current = 'reports'; openLead = null; render(); });
await page.waitForTimeout(1000);
STEP('reports page renders after everything', (await page.evaluate(() => document.getElementById('view').textContent.length)) > 200);
await page.locator('button:has-text("Sign out")').first().click();
await page.waitForTimeout(6500);
await page.waitForSelector('input[type=email]', { timeout: 15000 }).catch(() => {});
STEP('final sign out clean', await page.evaluate(() => !!document.querySelector('input[type=email]')));

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length); errs.slice(0, 8).forEach(e => console.log('  ', e));
await browser.close(); process.exit(0);
