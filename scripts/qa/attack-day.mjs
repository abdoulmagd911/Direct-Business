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
/* 2026-09-02 (round 27): this script used to print its results only on the last line, so ANY
   crash mid-run threw the whole log away and the run read as "attack-day is broken" with
   nothing to say where it got to. The log now survives a crash — partial results are the
   most useful thing a stale probe can give you. */
let PRINTED = false;
const dumpLog = () => {
  if (PRINTED) return; PRINTED = true;
  console.log(LOG.join('\n'));
  console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.filter(l => !l.startsWith('SKIP')).length}`);
  console.log('ERRORS:', errs.length); errs.slice(0, 10).forEach(e => console.log('  ', e));
};
process.on('exit', dumpLog);
process.on('uncaughtException', (e) => {
  LOG.push('CRASH · run stopped here — ' + String(e && e.message || e).split('\n')[0].slice(0, 160));
  dumpLog(); process.exit(1);
});
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
/* 2026-09-03 (round 46, mutation audit) — this step said "SAVES" and checked only DB.businesses,
   the in-memory array. Proven hollow: with the businesses insert changed to write an empty array,
   so nothing at all reached the database, this step and the "persists" one below both still
   passed. In a project whose whole history is writes that look fine and never land — M13 exists
   for exactly that — a green step claiming a save is worse than no step. Ask the database. */
const dbRows = await (await fetch(BASE + '/rest/v1/businesses?select=name')).json().catch(() => []);
const inDb = Array.isArray(dbRows) && dbRows.some(r => /^QA Attack Co/.test(r && r.name || ''));
STEP('leads: new business is saved and appears in the DATABASE, not just on screen', nameSet && saved && found && inDb, 'memory=' + found + ' database=' + inDb);
// quick edit + stage move + un-won guard
const qeOpened = await page.evaluate(() => { const b = DB.businesses.find(x => /^QA Attack Co/.test(x.name)); if (!b || !window.leadQuickEdit) return false; leadQuickEdit(b.id); return true; });
await page.waitForTimeout(600);
await shot('lead-quickedit');
const qeStage = await page.evaluate(() => { const s = document.getElementById('qe_stage'); if (!s) return false; s.value = 'Contacted'; const b = [...document.querySelectorAll('button')].find(x => /^(Save|حفظ)/.test(x.textContent.trim())); if (b) b.click(); return true; });
await page.waitForTimeout(900);
const stageMoved = await page.evaluate(() => { const b = DB.businesses.find(x => /^QA Attack Co/.test(x.name)); return b && (typeof leadStage === 'function' ? leadStage(b) : b.stage) === 'Contacted'; });
/* Same audit, same fix: "persists" has to mean the database, or it does not mean anything. */
const dbStage = await (await fetch(BASE + '/rest/v1/businesses?select=name,stage')).json().catch(() => []);
const stageInDb = Array.isArray(dbStage) && dbStage.some(r => /^QA Attack Co/.test(r && r.name || '') && /contacted/i.test(String(r.stage || '')));
STEP('leads: quick-edit stage change reaches the database', qeOpened && qeStage && stageMoved && stageInDb, 'screen=' + stageMoved + ' database=' + stageInDb);
// open detail card + back
await page.evaluate(() => { const b = DB.businesses.find(x => /^QA Attack Co/.test(x.name)); openLeadFn(b.id); });
await page.waitForTimeout(900);
await shot('lead-detail');
const backBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button, #view a')].find(x => /Back to (pipeline|clients)|رجوع/.test(x.textContent)); if (!b) return false; b.click(); return true; });
await page.waitForTimeout(700);
STEP('lead detail: back button returns to list', backBtn && await page.evaluate(() => !openLead));
// CSV export
const dl = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
/* Re-pointed 2026-09-02 (round 27): the in-view button is labelled "↓ Export this view (CSV)"
   (js/09), which does NOT contain the contiguous string "Export CSV" — the old regex simply
   missed a button that was sitting right there and working. Match what it is actually called. */
const exClicked = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find(x => /Export this view|تصدير هذا العرض/.test(x.textContent)); if (!b) return null; b.click(); return b.textContent.trim(); });
const gotDl = await dl;
/* 2026-09-03 (round 46, mutation audit) — this asserted only that a download EVENT fired. An
   export producing an empty file, or a header row with nothing under it, passed just as happily,
   and "downloads a file" was true while the person got nothing usable. Open it and look: a header,
   at least one data row, and a company name that is really in the list. */
let csvNote = 'no download (button: ' + exClicked + ')', csvOk = false;
if (gotDl) {
  try {
    const pth = await gotDl.path();
    const body = pth ? fs.readFileSync(pth, 'utf8') : '';
    const lines = body.split(/\r?\n/).filter(l => l.trim().length);
    const firstName = await page.evaluate(() => { const b = (DB.businesses || []).filter(matchLead)[0]; return b ? String(b.name || '') : ''; });
    const hasRow = lines.length >= 2;
    const hasName = !!firstName && body.includes(firstName);
    csvOk = hasRow && hasName;
    csvNote = await gotDl.suggestedFilename() + ' · ' + lines.length + ' line(s) · a listed company present: ' + hasName;
  } catch (e) { csvNote = 'download could not be read: ' + String(e).slice(0, 80); }
}
STEP('leads: "Export this view (CSV)" downloads a file with the rows actually in it', csvOk, csvNote);

// ---------- FINANCE workout ----------
await page.evaluate(() => { current = 'finance'; render(); });
await page.waitForTimeout(1500);
for (const tab of ['overview', 'ledger', 'clients', 'reports', 'import']) {
  const tOK = await page.evaluate(t => { try { FIN.tab = t === 'overview' ? 'overview' : t; render(); return true; } catch (e) { return e.message; } }, tab);
  await page.waitForTimeout(800);
  STEP('finance tab "' + tab + '" renders', tOK === true && (await txt()).length > 80);
  await shot('fin-' + tab);
}
/* Promo card must be ABSENT — owner ruling 2026-08-22 took promo codes off the Finance
   overview ("for now"), gated by SHOW_PROMO_ON_FINANCE=false in js/25, because the registry's
   own figures were untrustworthy (114 of 134 used codes were flagged active AND expired at
   once). This assertion used to demand the card be PRESENT — it predated the ruling, and left
   as-is it would have pushed a future session into switching back on what the owner turned
   off. It now guards the ruling. (2026-09-02, round 27) */
await page.evaluate(() => { FIN.tab = 'overview'; render(); });
await page.waitForTimeout(900);
const ovHas = await page.evaluate(() => ({ svc: !!document.querySelector('.v32-svc'), promo: !!document.querySelector('.v63-promo') }));
STEP('overview shows the flat income-by-service card', ovHas.svc, JSON.stringify(ovHas));
STEP('promo card stays OFF the overview (owner ruling 2026-08-22)', !ovHas.promo, JSON.stringify(ovHas));
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
/* The rebuilt Ledger (Phase 2) carries exactly three filters — profile type, stage, company
   (finTxnF). The old assertion demanded 4 or more, a magic number left over from the ledger
   this one replaced. Pin it to the three that exist and name them, so a filter going missing
   is still caught. (2026-09-02, round 27) */
const ledgerFilters = await page.evaluate(() => [...document.querySelectorAll('#view select')].map((s) => (s.getAttribute('onchange') || '').replace(/^finTxnF\('([a-zA-Z]+)'.*$/, '$1')));
const wantFilters = ['profileType', 'stage', 'business'];
STEP('finance ledger: its ' + seld + ' filter dropdowns are profile type / stage / company, and all switch without error',
  filterOK && wantFilters.every((w) => ledgerFilters.includes(w)), ledgerFilters.join(', '));
/* Ledger guard (2026-09-02, round 27). This section was written against the OLD ledger — a
   by-invoice / by-service-line toggle over a flat table. Phase 2 rebuilt the Ledger tab on the
   finance_transactions tables (company-grouped, collapsible), and this script still runs on
   mock-seed-live.mjs, a legacy seed that never got those tables — so TXN.rows is 0 here and the
   tab renders no table at all. Clicking a row that cannot exist is what crashed the whole run.
   The section is SKIPPED OUT LOUD when the ledger has no rows; the rebuilt ledger is covered
   properly by probe-ledger-attacks.mjs on the maintained mock (mock-supabase.mjs).
   Recorded in the BACKLOG as harness debt: seed-live needs the Phase-2 tables, or these two
   legacy scripts should move to the maintained mock. */
const ledgerRows = await page.evaluate(() => ((window.TXN && TXN.rows) || []).length);
if (!ledgerRows) {
  LOG.push('SKIP · ledger row/modal section — this seed (mock-seed-live.mjs) predates the Phase-2 finance_transactions tables, so the Ledger has no rows to click.');
  LOG.push('SKIP ·   The rebuilt Ledger is covered by probe-ledger-attacks.mjs on mock-supabase.mjs.');
}
if (ledgerRows) {
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
}   // end ledger guard
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

dumpLog();
await browser.close(); process.exit(0);
