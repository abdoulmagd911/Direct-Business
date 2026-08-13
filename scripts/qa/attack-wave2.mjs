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

// ---- Team + Access buttons
for (const b of ['Team', 'Access']) {
  await page.locator('button:has-text("' + b + '")').first().click().catch(() => {});
  await page.waitForTimeout(800);
  const up = await page.evaluate(() => { const m = [...document.querySelectorAll('body > div')].find(d => d.style && +d.style.zIndex > 999990 && d.textContent.length > 50); return m ? m.textContent.slice(0, 60) : null; });
  STEP('topbar "' + b + '" opens its panel', !!up, String(up).slice(0, 40));
  await shot('topbar-' + b);
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
await page.locator('#view tbody tr td b, #view tbody tr td:nth-child(1)').first().click();
await page.waitForTimeout(1500);
const clientOpened = await page.evaluate(() => !!openLead);
const cTxt = await txt();
STEP('client card opens with finance snapshot (billed/received numbers)', clientOpened && /Lifetime billed|Received|الفواتير/.test(cTxt));
STEP('client card is titled Clients (not pipeline)', /Clients|العملاء/.test(cTxt));
await shot('client-card');
const backOK = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button, #view a')].find(x => /Back to clients|رجوع/.test(x.textContent)); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(700);
STEP('client card back → clients list', backOK && await page.evaluate(() => current === 'clients' && !openLead));

// ---- Finance import: paste CSV → preview → commit
await page.evaluate(() => { current = 'finance'; FIN.tab = 'import'; render(); });
await page.waitForTimeout(900);
await shot('import');
const csv = 'client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes\nQA Import Co,2026-07,2026-Q3,QA-INV-1,DPIN-999901,QA Import Co,2026-07-15,Flights,1150,0,1150,900,250,verified_paid,attack test';
fs.writeFileSync('shots/qa-import.csv', csv);
await page.setInputFiles('#view input[type=file]', 'shots/qa-import.csv');
await page.waitForTimeout(600);
await page.locator('#view button:has-text("Check file")').first().click().catch(() => {});
const pasted = true;
await page.waitForTimeout(1200);
await shot('import-preview');
const commitBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => /Confirm import/.test(x.textContent)); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(1500);
const imported = await page.evaluate(() => (FIN.rows || []).some(r => r.invoice_no === 'QA-INV-1'));
STEP('import: paste → preview → commit lands the invoice in the ledger', pasted && commitBtn && imported);
// double-click cannot import twice (landmine re-check by UI)
const again = await page.evaluate(() => { if (typeof finCommit === 'function') { finCommit(); return true; } return false; });
await page.waitForTimeout(800);
const dupes = await page.evaluate(() => (FIN.rows || []).filter(r => r.invoice_no === 'QA-INV-1').length);
STEP('import: double-commit cannot duplicate', dupes === 1, dupes + ' copies');

// ---- promo card in Arabic
await page.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); FIN.tab = 'overview'; render(); });
await page.waitForTimeout(1200);
const arOv = await page.evaluate(() => ({ svc: !!document.querySelector('.v32-svc'), promo: !!document.querySelector('.v63-promo'), promoTxt: (document.querySelector('.v63-promo') || {}).textContent || '' }));
STEP('AR overview: flat services + promo card render in Arabic', arOv.svc && arOv.promo && /أكواد الخصم/.test(arOv.promoTxt));
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
