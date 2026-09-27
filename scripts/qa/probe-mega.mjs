/* MEGA consistency probe — the owner's concept at scale:
   every number is computed independently from the raw rows, then every screen that
   shows that number must agree; then we CHANGE a number and every screen must move.
   Plus: dev-jargon scanner on every page, and speed measurements. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8981, BASE = `http://127.0.0.1:${PORT}`;
/* E (2026-09-27, D16): Finance now reads the database view money_rows together with the rows (js/16 finLoad), and a
   company's money is only what a person typed into it (a client ID, a code or a customer name). mock-seed-live.mjs has no such
   view — it answers [] — so every invoice stood alone and no client card found its money. Until that mock models the
   view, this probe answers money_rows itself, the way the view does for this seed: a row with no client ID belongs to
   the company its customer name was typed into — the seed's finance_client_links, read as typed names exactly as
   mock-supabase.mjs does (linksToNames); a row with a client ID goes by client_profiles alone; this seed has no
   exclusion rules, so only a row's own exclusion_reason leaves it out. */
const mrNorm = (t) => { let s = String(t == null ? '' : t); try { s = s.normalize('NFKC'); } catch (_) { } s = s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ''); return s || null; };
async function answerMoneyRows(r) {
  const rq = r.request(); const u = new URL(rq.url());
  if (u.pathname !== '/rest/v1/money_rows' || rq.method() !== 'GET') return false;
  const h = {}; const rh = rq.headers(); ['authorization', 'apikey'].forEach((k) => { if (rh[k]) h[k] = rh[k]; });
  const all = async (t) => { let out = []; for (let o = 0; ; o += 1000) { const x = await fetch(`${BASE}/rest/v1/${t}?select=*&offset=${o}&limit=1000`, { headers: h }); const d = await x.json().catch(() => []); if (!Array.isArray(d)) break; out = out.concat(d); if (d.length < 1000) break; } return out; };
  const [inv, links, prof, biz] = await Promise.all([all('finance_invoices'), all('finance_client_links'), all('client_profiles'), all('businesses')]);
  const nameTo = {}; links.forEach((l) => { const k = mrNorm(l.client_group); if (k && l.business_id && !nameTo[k]) nameTo[k] = l.business_id; });
  const bn = {}; biz.forEach((b) => { bn[b.id] = b.name; });
  const rows = inv.filter((i) => !i.deleted_at).map((i) => {
    const cid = mrNorm(i.payments_client_id); const cp = cid ? prof.find((p) => mrNorm(p.direct_client_id) === cid) : null;
    const bizId = cp ? cp.business_id : (!cid ? (nameTo[mrNorm(i.client_group)] || nameTo[mrNorm(i.customer_raw_name)] || null) : null);
    const excluded = i.exclusion_reason != null;
    return { id: i.id, business_id: bizId, company_key: bizId ? 'biz:' + bizId : cid ? 'cid:' + cid : 'name:' + (mrNorm(i.client_group || i.customer_raw_name) || '?'),
      company_name: bizId ? (bn[bizId] || null) : (i.client_group || i.customer_raw_name), merge_state: bizId ? 'merged' : cid ? 'not_merged' : 'no_client_id',
      profile_type: cp ? cp.profile_type : null, rule_id: null, rule_kind: null, rule_value: null, rule_reason: null, excluded, counts: !excluded && i.integrity_status === 'verified_paid', open_age_days: null };
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const off = +(u.searchParams.get('offset') || 0), lim = u.searchParams.get('limit'); const win = rows.slice(off, lim != null ? off + +lim : undefined);
  await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': off + '-' + Math.max(off + win.length - 1, 0) + '/' + rows.length, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(win) });
  return true;
}
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
page.on('dialog', d => d.accept());
const route = async r => {
  if (await answerMoneyRows(r)) return;
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
await page.route(u=>u.href.includes('cdn.jsdelivr.net'), route);
await page.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), route);
const LOG = []; const STEP = (n, ok, d = '') => LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`);
const REPORT = (n, d = '') => LOG.push(`REPORT · ${n}${d ? ' — ' + d : ''}`);
/* A check whose precondition the seed did not produce has not passed — it did not run.
   Saying so as a SKIP keeps it out of the pass total instead of padding it with a
   literal `true` that reads exactly like a real result. */
const SKIP = (n, d = '') => LOG.push(`SKIP · ${n}${d ? ' — ' + d : ''}`);

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
} else SKIP('client card cross-check', 'the seed produced no linked client with 2+ invoices, so this check did not run');

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
/* 2026-09-07 (watch cycle 37): this used to assert a 15-SECOND WALL-CLOCK BUDGET on a reload.
   In the battery it failed at 15,062 ms and passed alone — because six probes on two vCPUs is
   3x oversubscription, so the number it measured was the machine, not the app. A check whose
   verdict depends on what else the box is doing is a red for the wrong reason, and this suite
   has already lost six cycles to that class. Split in two: the part that is a fact about the
   app — the refresh really does come back to a rendered page — stays an assertion; the
   duration is REPORTED so a real slowdown is still visible to a person reading the log. */
/* E (2026-09-27) — this check went red in the battery on E and, measured, also on the tree just before E (the speed
   merge, a0d8e63), 1 run in 3 alone. It is not E: a timeline sampled every 5 ms from document start showed the same
   boot on both — DB.businesses is filled (~250 ms) BEFORE the first paint, then Today paints, then the router moves to
   the URL's page (/events here) which reads "Loading events…" (15 characters) for ~30 ms until ksa_events answers.
   The line above resolves as soon as DB.businesses is non-empty, and the check read #view at that one instant — so it
   was measuring where in that boot the poll happened to land, not whether the refresh comes back. Money is not on this
   path at all: money_rows is not requested during the refresh. The claim is unchanged and made stricter: within the
   same 40 s the refresh must come back to a rendered view ON THE PAGE THE ADDRESS NAMES (it used to accept any page). */
const __refreshed = await page.waitForFunction((p) => { try { return current === p && ((document.getElementById('view') || {}).textContent || '').length > 60; } catch (_) { return false; } },
  new URL(page.url()).pathname.replace(/^\//, '') || 'today', { timeout: 40000 }).then(() => true).catch(() => false);
STEP('SPEED: a refresh comes back to a rendered app (not a blank page) — on the page its address names', __refreshed,
  await page.evaluate(() => (typeof current !== 'undefined' ? current : '?') + ' · ' + ((document.getElementById('view') || {}).textContent || '').slice(0, 60)));
REPORT('SPEED: how long that refresh took here', (Date.now() - tR) + 'ms — wall clock on whatever machine ran this, not a property of the app; six probes at once on two vCPUs has produced 15,062ms for a page that takes ~3s alone');

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length, errs.slice(0, 6));

/* 2026-09-06 (watch cycle 35): this file counted its failures, printed them, and then exited 0.
   The battery reads exit codes, so every regression this probe could see has been reported to
   the runner as a pass for as long as it has existed. The count decides the exit code now. */
const __fails = LOG.filter((l) => l.startsWith('FAIL')).length;
await browser.close();
if (__fails) { console.log(`\nFAILED — ${__fails} check(s) did not pass.`); process.exit(1); }
process.exit(0);
