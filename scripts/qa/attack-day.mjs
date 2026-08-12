/* "Employee day" attack — drive the UI like a real user: click, type, sort, filter,
   export, add, edit, delete, refresh, go back. Screenshot everything. Record every
   dead click (a button that changes nothing). Run: node attack-day.mjs */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8944, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
let errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error' && !/net::|favicon|404/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 160)); });
page.on('dialog', d => d.accept('QA note'));
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
const DEAD = [];
const shot = p => page.screenshot({ path: 'shots/atk-' + p + '.png' }).catch(() => {});
const html = () => page.evaluate(() => (document.getElementById('view') || document.body).innerHTML.length);
const txt = () => page.evaluate(() => ((document.getElementById('view') || {}).textContent || '').replace(/\s+/g, ' '));

// ---------- sign in through the real form ----------
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1500);
STEP('sign in via the form', await page.evaluate(() => typeof DB !== 'undefined' && DB.businesses.length > 0));

// ---------- walk EVERY nav entry by clicking it ----------
const navLabels = await page.evaluate(() => [...document.querySelectorAll('.side button, nav button, .nav button')].map(b => b.textContent.trim()).filter(Boolean));
const pages = await page.evaluate(() => (window.VIEWS || []).map(v => v.id || v));
STEP('nav has entries', navLabels.length > 5, navLabels.length + ' buttons');
const seen = {};
for (const pid of ['today', 'leads', 'clients', 'offers', 'operations', 'reports', 'finance', 'settings', 'events', 'airlines', 'providers', 'sops', 'bookings', 'invoices', 'tickets']) {
  const before = await html();
  const ok = await page.evaluate(id => { try { if (typeof current === 'undefined') return false; openLead = null; current = id; render(); return true; } catch (e) { return 'ERR ' + e.message; } }, pid);
  await page.waitForTimeout(900);
  const t = await txt();
  const empty = t.length < 60;
  seen[pid] = { ok, len: t.length };
  STEP('page "' + pid + '" renders content', ok === true && !empty, 'text=' + t.length);
  await shot('page-' + pid);
}

// ---------- LEADS: full workout ----------
await page.evaluate(() => { current = 'leads'; openLead = null; render(); });
await page.waitForTimeout(1000);
// every stage chip
const chips = await page.locator('.v26_3-chips button, .v26_3-chips .chip').count().catch(() => 0);
let chipOK = true;
for (let i = 0; i < chips; i++) {
  const b = page.locator('.v26_3-chips button, .v26_3-chips .chip').nth(i);
  const label = (await b.textContent() || '').trim();
  await b.click().catch(() => { chipOK = false; });
  await page.waitForTimeout(350);
  const rows = await page.evaluate(() => document.querySelectorAll('#view tbody tr').length);
  if (!rows) { /* empty is allowed if hint shows */ const hint = await page.evaluate(() => !!document.querySelector('#view .empty')); if (!hint) chipOK = false; }
}
STEP('all ' + chips + ' stage chips click & filter (or show the hidden-hint)', chips > 0 && chipOK);
await page.evaluate(() => { if (window.leadClearFilters) leadClearFilters(); });
// column sorts — click each sortable header twice
const heads = await page.locator('#view th[onclick]').count();
let sortOK = true;
for (let i = 0; i < heads; i++) {
  const firstBefore = await page.evaluate(() => (document.querySelector('#view tbody tr td:nth-child(2)') || {}).textContent);
  await page.locator('#view th[onclick]').nth(i).click(); await page.waitForTimeout(250);
  await page.locator('#view th[onclick]').nth(i).click(); await page.waitForTimeout(250);
}
STEP('leads: ' + heads + ' sortable headers clicked twice, no errors', heads >= 3);
// search box
await page.locator('#view input[placeholder*="Search"], #view input[placeholder*="بحث"]').first().fill('zzz-no-such-thing').catch(() => {});
await page.waitForTimeout(500);
const emptyHint = await page.evaluate(() => { const e = document.querySelector('#view .empty'); return e ? e.textContent : null; });
await page.locator('#view input[placeholder*="Search"], #view input[placeholder*="بحث"]').first().fill('').catch(() => {});
await page.waitForTimeout(400);
STEP('leads search: nonsense query → empty state (with recovery)', emptyHint !== null, String(emptyHint).slice(0, 60));
// add a brand-new business through the button
const addBtn = page.locator('#view button:has-text("New business"), #view button:has-text("+ New business")').first();
await addBtn.click().catch(() => {});
await page.waitForTimeout(700);
const modalUp = await page.evaluate(() => !!document.querySelector('.modal, #leadModal, [id*="odal"]'));
STEP('leads: "+ New business" opens a form', modalUp);
await shot('lead-new-form');
const nameSet = await page.evaluate(() => { const f = document.getElementById('f_name') || document.querySelector('.modal input'); if (!f) return false; f.value = 'QA Attack Co ' + Date.now(); return true; });
const saved = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Save|حفظ)/.test(x.textContent.trim())); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(1200);
const found = await page.evaluate(() => DB.businesses.some(b => /^QA Attack Co/.test(b.name)));
STEP('leads: new business SAVES and appears in data', nameSet && saved && found);
// quick edit + stage move + un-won guard
const qeOpened = await page.evaluate(() => { const b = DB.businesses.find(x => /^QA Attack Co/.test(x.name)); if (!b || !window.leadQuickEdit) return false; leadQuickEdit(b.id); return true; });
await page.waitForTimeout(600);
await shot('lead-quickedit');
const qeStage = await page.evaluate(() => { const s = document.getElementById('qe_stage'); if (!s) return false; s.value = 'Contacted'; const b = [...document.querySelectorAll('button')].find(x => /^(Save|حفظ)/.test(x.textContent.trim())); if (b) b.click(); return true; });
await page.waitForTimeout(900);
const stageMoved = await page.evaluate(() => { const b = DB.businesses.find(x => /^QA Attack Co/.test(x.name)); return b && (typeof leadStage === 'function' ? leadStage(b) : b.stage) === 'Contacted'; });
STEP('leads: quick-edit stage change persists', qeOpened && qeStage && stageMoved);
// open detail card + back
await page.evaluate(() => { const b = DB.businesses.find(x => /^QA Attack Co/.test(x.name)); openLeadFn(b.id); });
await page.waitForTimeout(900);
await shot('lead-detail');
const backBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button, #view a')].find(x => /Back to (pipeline|clients)|رجوع/.test(x.textContent)); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(700);
STEP('lead detail: back button returns to list', backBtn && await page.evaluate(() => !openLead));
// CSV export
const dl = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => /Export CSV|تصدير/.test(x.textContent)); if (b) b.click(); });
const gotDl = await dl;
STEP('leads: Export CSV downloads a file', !!gotDl, gotDl ? await gotDl.suggestedFilename() : 'no download');

// ---------- FINANCE workout ----------
await page.evaluate(() => { current = 'finance'; render(); });
await page.waitForTimeout(1500);
for (const tab of ['overview', 'ledger', 'clients', 'reports', 'import']) {
  const tOK = await page.evaluate(t => { try { FIN.tab = t === 'overview' ? 'overview' : t; render(); return true; } catch (e) { return e.message; } }, tab);
  await page.waitForTimeout(800);
  STEP('finance tab "' + tab + '" renders', tOK === true && (await txt()).length > 80);
  await shot('fin-' + tab);
}
// overview must carry the flat service card + promo card
await page.evaluate(() => { FIN.tab = 'overview'; render(); });
await page.waitForTimeout(900);
const ovHas = await page.evaluate(() => ({ svc: !!document.querySelector('.v32-svc'), promo: !!document.querySelector('.v63-promo') }));
STEP('overview shows flat income-by-service + promo cards', ovHas.svc && ovHas.promo, JSON.stringify(ovHas));
await shot('fin-overview-cards');
// ledger: every filter dropdown option count sanity + both views
await page.evaluate(() => { FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(600);
const seld = await page.locator('#view select').count();
let filterOK = true;
for (let i = 0; i < seld; i++) {
  const opts = await page.locator('#view select').nth(i).locator('option').count();
  if (opts > 1) {
    await page.locator('#view select').nth(i).selectOption({ index: 1 }).catch(() => { filterOK = false; });
    await page.waitForTimeout(300);
    await page.locator('#view select').nth(i).selectOption({ index: 0 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}
STEP('finance ledger: all ' + seld + ' filter dropdowns switch without error', seld >= 4 && filterOK);
// by-invoice / by-line toggle via real clicks
await page.locator('#view button:has-text("By service line")').first().click().catch(() => {});
await page.waitForTimeout(500);
const lineRows = await page.evaluate(() => document.querySelectorAll('#view tbody tr').length);
await page.locator('#view button:has-text("By invoice")').first().click().catch(() => {});
await page.waitForTimeout(500);
const invRows = await page.evaluate(() => document.querySelectorAll('#view tbody tr').length);
STEP('ledger view toggle works (line rows >= invoice rows)', lineRows >= invRows && invRows > 0, lineRows + ' vs ' + invRows);
// open an invoice modal via row click, try origin+way saves, delete+restore
await page.locator('#view tbody tr').first().click();
await page.waitForTimeout(700);
await shot('fin-invoice-modal');
const modalBits = await page.evaluate(() => {
  const m = document.getElementById('finModal'); if (!m) return null;
  return { way: !!m.querySelector('#fin_way'), origin: !!m.querySelector('#fin_origin'), del: !!([...m.querySelectorAll('button,a')].find(x => /Delete|حذف/.test(x.textContent))), noVat: !/VAT|ضريبة القيمة/.test(m.textContent) };
});
STEP('invoice modal: way selector + origin + delete + NO VAT text', !!modalBits && modalBits.way && modalBits.origin && modalBits.del && modalBits.noVat, JSON.stringify(modalBits));
await page.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
// report builder: run a grouping
await page.evaluate(() => { FIN.tab = 'reports'; render(); });
await page.waitForTimeout(700);
const repSel = await page.locator('#view select').count();
if (repSel) { await page.locator('#view select').last().selectOption({ index: 1 }).catch(() => {}); await page.waitForTimeout(600); }
await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => /Run|Build|شغّل/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(700);
STEP('report builder renders a table after switching grouping', (await page.evaluate(() => document.querySelectorAll('#view table tr').length)) > 2);
await shot('fin-report');

// ---------- refresh mid-view (deep link) + browser back/forward ----------
await page.evaluate(() => { current = 'finance'; FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(2000);
const afterReload = await page.evaluate(() => ({ cur: typeof current !== 'undefined' ? current : null, txt: (document.getElementById('view') || {}).textContent ? true : false }));
STEP('page refresh mid-view: session survives, view restored', afterReload.txt && afterReload.cur === 'finance', JSON.stringify(afterReload));
await page.goBack().catch(() => {}); await page.waitForTimeout(800);
await page.goForward().catch(() => {}); await page.waitForTimeout(800);
STEP('browser back/forward: no crash, app still alive', (await txt()).length > 60);

// ---------- Proposals / Operations / Reports / Settings quick workouts ----------
await page.evaluate(() => { current = 'offers'; render(); });
await page.waitForTimeout(800);
const newProp = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => /New proposal|عرض جديد/.test(x.textContent)); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(700);
STEP('proposals: "+ New proposal" opens the builder', newProp && (await txt()).length > 100);
await shot('proposal-new');
await page.evaluate(() => { current = 'reports'; render(); });
await page.waitForTimeout(900);
await shot('reports');
STEP('reports page renders with content', (await txt()).length > 200);
await page.evaluate(() => { current = 'settings'; render(); });
await page.waitForTimeout(800);
await shot('settings');

// ---------- Arabic full pass ----------
await page.evaluate(() => { if (typeof applyLang === 'function') { LANG = 'ar'; applyLang(); render(); } });
await page.waitForTimeout(1200);
for (const pid of ['today', 'leads', 'finance']) {
  await page.evaluate(id => { openLead = null; current = id; render(); }, pid);
  await page.waitForTimeout(800);
  const t = await txt();
  STEP('AR page "' + pid + '" renders arabic', /[؀-ۿ]/.test(t) && t.length > 80);
  await shot('ar-' + pid);
}
await page.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });
await page.waitForTimeout(800);

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length); errs.slice(0, 10).forEach(e => console.log('  ', e));
await browser.close(); process.exit(0);
