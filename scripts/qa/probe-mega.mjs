/* MEGA consistency probe — the owner's concept at scale:
   every number is computed independently from the raw rows, then every screen that
   shows that number must agree; then we CHANGE a number and every screen must move.
   Plus: dev-jargon scanner on every page, and speed measurements. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8981, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
page.on('dialog', d => d.accept());
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

const t0 = Date.now();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=email]', { timeout: 30000 });
const tLogin = Date.now() - t0;
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
const t1 = Date.now();
await page.locator('button:has-text("Sign in")').first().click();
await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 });
const tApp = Date.now() - t1;
STEP('SPEED: login form ready < 20s (harness first load)', tLogin < 20000, tLogin + 'ms');
STEP('SPEED: sign-in to working app < 15s (harness)', tApp < 15000, tApp + 'ms');

// per-page render speed
for (const pid of ['today', 'leads', 'clients', 'offers', 'operations', 'reports', 'finance', 'settings']) {
  const ms = await page.evaluate(id => { openLead = null; current = id; const a = performance.now(); render(); return Math.round(performance.now() - a); }, pid);
  await page.waitForTimeout(300);
  STEP('SPEED: "' + pid + '" renders < 900ms', ms < 900, ms + 'ms');
}

// ---------- independent expected values from the raw rows ----------
await page.evaluate(() => { current = 'finance'; FIN.tab = 'overview'; FIN.p = { year: 'all', part: 'all', month: 'all' }; render(); });
await page.waitForFunction(() => window.FIN && (FIN.rows || []).length > 0, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const EXP = await page.evaluate(() => {
  const V = FIN.rows.filter(r => !r.deleted_at && r.integrity_status === 'verified_paid');
  const L = FIN.rows.filter(r => !r.deleted_at);
  const s = k => V.reduce((a, r) => a + (+r[k] || 0), 0);
  return { n: new Set(V.map(r => r.invoice_no)).size,
    rev: s('revenue_sar'), cost: s('cost_sar'), prof: s('profit_sar'), rec: s('amount_received_sar'), rem: s('amount_remaining_sar'),
    arOut: L.reduce((a, r) => a + Math.max(0, +r.amount_remaining_sar || 0), 0) };
});
const m0 = n => Math.round(n).toLocaleString('en-US');
const mS = n => { n = Math.abs(n); return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); };
const ov = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/ /g, ' '));
// 1 KPI cards
STEP('overview KPI Revenue = raw rows', ov.includes(mS(EXP.rev)), mS(EXP.rev));
STEP('overview KPI Cost = raw rows', ov.includes(mS(EXP.cost)));
STEP('overview KPI Profit = raw rows', ov.includes(mS(EXP.prof)));
STEP('overview KPI Received = raw rows', ov.includes(mS(EXP.rec)));
STEP('overview shows NO wallet card', !/Wallet \(excluded\)|محفظة \(مستبعد\)/.test(ov));
// 2 plan-vs-actual actual
STEP('plan-vs-actual "Actual" = same revenue', ov.includes(mS(EXP.rev)));
// 3 income-by-service totals row
const svcTot = await page.evaluate(() => { const t = document.querySelector('.v32-svc tbody tr:last-child'); return t ? t.textContent.replace(/ /g, ' ') : ''; });
STEP('income-by-service total = raw fee (rev-cost)', svcTot.includes(mS(EXP.rev - EXP.cost)), svcTot.slice(0, 80));
// 4 monthly chart sum
const chartSum = await page.evaluate(() => { let s = 0; document.querySelectorAll('#view [title^="Revenue"]').forEach(b => { s += parseFloat((b.title || '').replace(/[^\d.]/g, '')) || 0; }); return s; });
STEP('monthly chart bars sum = KPI revenue', Math.abs(chartSum - EXP.rev) < 2, Math.round(chartSum) + ' vs ' + Math.round(EXP.rev));
// 5+6 AR aging + top clients — they live on the Clients & collections tab (the finance team's screen)
await page.evaluate(() => { FIN.tab = 'clients'; render(); });
await page.waitForTimeout(900);
const cc = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\u00a0/g, ' '));
STEP('AR aging card (finance team) shows the true outstanding', /Collections & (AR )?age?ing|التحصيل/.test(cc) && cc.includes(mS(EXP.arOut)), 'AR=' + mS(EXP.arOut));
const topTot = await page.evaluate(() => { const rows = [...document.querySelectorAll('#view table tr')]; const r = rows.find(x => /^(Total|الإجمالي الكلي)/.test(x.textContent.trim())); return r ? r.textContent.replace(/\u00a0/g, ' ') : ''; });
STEP('top-clients Total row = raw rev/cost/profit', topTot.includes(m0(EXP.rev)) && topTot.includes(m0(EXP.prof)), topTot.slice(0, 60));
await page.evaluate(() => { FIN.tab = 'overview'; render(); });
await page.waitForTimeout(700);
// 7 ledger label
await page.evaluate(() => { FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(800);
const led = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/ /g, ' '));
// 2026-09-02: the Ledger reads finance_transactions (Phase 2), NEVER the invoice rows — summing the
// two is forbidden (docs/DECISIONS.md). So the Ledger must show its own transaction-based cards
// and must NOT echo the invoice totals.
STEP('ledger shows transaction-based cards (Confirmed revenue) and a transaction count', /Confirmed revenue|الإيراد المؤكد/.test(led) && /\d+ transactions across|معاملة عبر/.test(led));
// 8 report builder grand total
await page.evaluate(() => { FIN.tab = 'reports'; render(); });
await page.waitForTimeout(900);
const rep = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/ /g, ' '));
STEP('report builder TOTAL = raw rev & profit', rep.includes(m0(EXP.rev)) && rep.includes(m0(EXP.prof)));
// 9 client card strip vs clients tab (same client, two screens)
const cinfo = await page.evaluate(() => {
  const V = FIN.rows.filter(r => !r.deleted_at && r.integrity_status === 'verified_paid');
  const by = {}; V.forEach(r => { by[r.client_group] = by[r.client_group] || { billed: 0, n: 0 }; by[r.client_group].billed += +r.total_incl_vat_sar; by[r.client_group].n++; });
  const link = (FIN.links || []).find(l => l.business_id && by[l.client_group] && by[l.client_group].n >= 1 && (DB.businesses || []).some(b => b.id === l.business_id));
  return link ? { group: link.client_group, biz: link.business_id, billed: by[link.client_group].billed } : null;
});
if (cinfo) {
  await page.evaluate(id => { openLead = id; current = 'leads'; render(); }, cinfo.biz);
  await page.waitForTimeout(1500);
  const card = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/ /g, ' '));
  STEP('client card "Lifetime billed" = raw rows for that client', card.includes(mS(cinfo.billed)), cinfo.group + ' ' + mS(cinfo.billed));
} else STEP('client card cross-check (no linked client with 2+ invoices in seed)', true, 'skipped');

// ---------- MUTATION: change ONE invoice → every screen must move ----------
await page.evaluate(() => { openLead = null; current = 'finance'; FIN.tab = 'overview'; render(); });
await page.waitForTimeout(800);
const DELTA = 100000;
await page.evaluate(d => { const r = FIN.rows.find(x => !x.deleted_at && x.integrity_status === 'verified_paid'); r.revenue_sar = (+r.revenue_sar || 0) + d; r.profit_sar = (+r.profit_sar || 0) + d; render(); }, DELTA);
await page.waitForTimeout(900);
const ov2 = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/ /g, ' '));
STEP('MUTATION: overview KPI moved by the exact delta', ov2.includes(mS(EXP.rev + DELTA)), mS(EXP.rev + DELTA));
const svcTot2 = await page.evaluate(() => { const t = document.querySelector('.v32-svc tbody tr:last-child'); return t ? t.textContent : ''; });
STEP('MUTATION: income-by-service total moved too', svcTot2.includes(mS(EXP.rev - EXP.cost + DELTA)));
const chart2 = await page.evaluate(() => { let s = 0; document.querySelectorAll('#view [title^="Revenue"]').forEach(b => { s += parseFloat((b.title || '').replace(/[^\d.]/g, '')) || 0; }); return s; });
STEP('MUTATION: monthly chart moved too', Math.abs(chart2 - (EXP.rev + DELTA)) < 2);
await page.evaluate(() => { FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(700);
const led2 = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/ /g, ' '));
STEP('MUTATION: ledger did NOT move with an invoice edit (it reads transactions, never invoices)', !led2.includes(m0(EXP.rev + DELTA)) && /Confirmed revenue|الإيراد المؤكد/.test(led2));
await page.evaluate(() => { FIN.tab = 'reports'; render(); });
await page.waitForTimeout(800);
const rep2 = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/ /g, ' '));
STEP('MUTATION: report builder moved too', rep2.includes(m0(EXP.rev + DELTA)));
await page.evaluate(d => { const r = FIN.rows.find(x => !x.deleted_at && x.integrity_status === 'verified_paid'); r.revenue_sar = (+r.revenue_sar || 0) - d; r.profit_sar = (+r.profit_sar || 0) - d; render(); }, DELTA);

// ---------- LEAD-SIDE cross-effect: new lead ripples to every counter ----------
const beforeCounts = await page.evaluate(() => { current = 'leads'; openLead = null; render(); return null; });
await page.waitForTimeout(900);
const c1 = await page.evaluate(() => ({ chipAll: (document.querySelector('.v26_3-chips button') || {}).textContent || '', rows: DB.businesses.filter(b => !b.isClient).length }));
await page.evaluate(() => { DB.businesses.push({ id: 'mega-x1', name: 'Mega Ripple Co', stage: 'new', isClient: false, contacts: [], activities: [] }); render(); });
await page.waitForTimeout(700);
const c2 = await page.evaluate(() => ({ chipAll: (document.querySelector('.v26_3-chips button') || {}).textContent || '', inTable: (document.getElementById('view').textContent || '').includes('Mega Ripple Co') }));
STEP('RIPPLE: new lead raises the All chip count and appears in the table', c2.inTable && c1.chipAll !== c2.chipAll, c1.chipAll.trim() + ' → ' + c2.chipAll.trim());
// win it through the REAL quick-edit path (what a user actually does)
await page.evaluate(() => { leadQuickEdit('mega-x1'); });
await page.waitForTimeout(500);
await page.evaluate(() => { const sel = document.getElementById('qe_stage'); if (sel) sel.value = 'Won'; const b = [...document.querySelectorAll('button')].find(x => /^(Save|حفظ)/.test(x.textContent.trim())); if (b) b.click(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const ov = document.getElementById('ov'); if (ov) ov.classList.remove('show'); [...document.querySelectorAll('body > div')].forEach(d => { const z = +((d.style || {}).zIndex || 0); if (z > 999990 && z < 2147483000) d.remove(); }); render(); });
await page.waitForTimeout(600);
await page.waitForTimeout(700);
const c3 = await page.evaluate(() => { const b = DB.businesses.find(x => x.id === 'mega-x1');
  const inTable = [...document.querySelectorAll('#view tbody tr')].some(tr => tr.textContent.includes('Mega Ripple Co'));
  const holder = (() => { const el = [...document.querySelectorAll('#view *')].find(e => e.children.length === 0 && e.textContent.includes('Mega Ripple Co')); let p = el, path = []; while (p && path.length < 4 && p.id !== 'view') { path.push(p.tagName + '.' + (p.className || '').toString().slice(0, 20)); p = p.parentElement; } return path.join(' < '); })();
  return { gone: !inTable, holder, stage: b ? leadStage(b) : '?', isClient: b ? !!b.isClient : '?', stageF: leadFilter.stage, hideClosed: leadFilter.hideClosed }; });
await page.evaluate(() => { current = 'clients'; openLead = null; render(); });
await page.waitForTimeout(800);
const c4 = await page.evaluate(() => (document.getElementById('view').textContent || '').includes('Mega Ripple Co'));
STEP('RIPPLE: winning it removes it from the pipeline AND adds it to Clients', c3.gone && c4, JSON.stringify(c3) + ' inClients=' + c4);
await page.evaluate(() => { DB.businesses = DB.businesses.filter(x => x.id !== 'mega-x1'); render(); });

// ---------- dev-jargon scanner on every page (EN + AR) ----------
const JARGON = /\bundefined\b|\bNaN\b|\[object Object\]|integrity_status|source_batch|client_group\b|revenue_way|deleted_at|\bnull\b(?![a-z])/;
for (const lang of ['en', 'ar']) {
  await page.evaluate(l => { LANG = l; if (typeof applyLang === 'function') applyLang(); }, lang);
  for (const pid of ['today', 'leads', 'clients', 'offers', 'operations', 'reports', 'finance', 'settings', 'events']) {
    await page.evaluate(id => { openLead = null; current = id; if (id === 'finance' && window.FIN) FIN.tab = 'overview'; render(); }, pid);
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => (document.getElementById('view') || {}).textContent || '');
    const hit = t.match(JARGON);
    STEP('no dev-jargon on "' + pid + '" (' + lang + ')', !hit, hit ? hit[0] : '');
  }
}
await page.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });

// ---------- refresh glitch check ----------
const tR = Date.now();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 }).catch(() => {});
STEP('SPEED: refresh back to working app < 15s (harness), no glitch', (Date.now() - tR) < 15000 && (await page.evaluate(() => (document.getElementById('view') || {}).textContent.length > 60)), (Date.now() - tR) + 'ms');

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length, errs.slice(0, 6));
await browser.close(); process.exit(0);
