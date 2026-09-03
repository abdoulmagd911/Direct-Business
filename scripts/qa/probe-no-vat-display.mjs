/* probe-no-vat-display.mjs — regression guard for M1 (docs/DECISIONS.md), corrected
   2026-08-23. M1 was never a rule about the glyph "VAT" appearing on a screen — owner
   verbatim, dissolving what earlier wording had turned into a recurring question: "I dont
   care weither vat shows or not, what i want is a clean cost, profit, and revenue." The real
   rule: VAT may legitimately appear on a client-facing document (a quotation, a tax invoice)
   where it's legally expected; it must never appear IN, or be mixed INTO, an internal
   cost/profit/revenue figure or report.

   THIS PROBE USED TO BE A TEXT SCAN — it asserted the string "VAT" never appeared in
   `document.body.innerText`. That was testing the wrong thing, and gave false comfort: it
   would happily pass on a Finance page whose Profit KPI was silently computed with a
   vat_sar term baked in, so long as nothing printed the literal word "VAT" on screen. A
   contaminated number with no label is exactly as wrong as a contaminated number WITH a
   label — arguably worse, since nobody would even know to look.

   WHAT THIS PROBE NOW ASSERTS, as the primary, build-failing checks: for every live
   finance_invoices row that actually carries VAT (`vat_sar > 0` — the pre-existing 15-row
   seed batch carries none at all, which was its own gap; a dedicated VAT-bearing canary row
   was added to scripts/qa/mock-supabase.mjs, `i-qa-vatclean`, specifically so this probe has
   a real figure to check),
     1. `revenue_sar` must not include the VAT amount — it must be at most
        `total_incl_vat_sar - vat_sar` (plus a hair of rounding tolerance).
     2. `profit_sar` must reconcile from the two already-clean numbers alone —
        `profit_sar == revenue_sar - cost_sar`, with no vat_sar term anywhere in that sum.
   Before trusting these against the live app, the check function is proven against a
   synthetic, deliberately-contaminated row built in this script (never touching the shared
   fixture) — if the checker didn't actually catch a real violation, that would be exactly
   the "gives false comfort" failure this rewrite exists to fix, so it's asserted directly,
   not assumed.

   The old page/tab render sweep is kept, because "does this page even render" is still a
   real and separate concern from M1 — but the on-screen "VAT" text scan is now purely
   OBSERVATIONAL (printed, never fails the build): the owner has explicitly said the glyph
   itself doesn't matter, so gating the build on its absence would be enforcing a rule that
   no longer exists. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8163;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

const FIN_TABS = ['overview', 'clients', 'ledger', 'reports', 'import', 'expenses', 'proofs', 'b2c'];

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
function note(msg) { console.log('  · ' + msg); }

// The actual M1 check, as plain arithmetic — deliberately independent of the app's own code,
// so this probe can't be fooled by a bug shared between the checker and the thing it checks.
function vatContaminationIssues(row) {
  const issues = [];
  const vat = +row.vat_sar || 0;
  if (vat <= 0) return issues; // nothing to check — this row carries no VAT at all
  const total = +row.total_incl_vat_sar || 0;
  const revenue = +row.revenue_sar || 0;
  const cost = +row.cost_sar || 0;
  const profit = +row.profit_sar || 0;
  const maxCleanRevenue = total - vat + 0.02;
  if (revenue > maxCleanRevenue) {
    issues.push(`revenue_sar (${revenue}) exceeds total_incl_vat_sar minus vat_sar (${(total - vat).toFixed(2)}) — VAT looks baked into revenue`);
  }
  const expectedProfit = revenue - cost;
  if (Math.abs(profit - expectedProfit) > 0.02) {
    issues.push(`profit_sar (${profit}) does not equal revenue_sar - cost_sar (${expectedProfit.toFixed(2)}) — a term other than the two clean numbers is in play, most likely vat_sar`);
  }
  return issues;
}

// Self-test: prove the checker actually catches a contaminated row before trusting it
// against the live app. A synthetic object only — never written to the shared fixture.
function selfTestChecker() {
  const clean = { total_incl_vat_sar: 11500, vat_sar: 1500, revenue_sar: 10000, cost_sar: 6000, profit_sar: 4000 };
  const contaminatedRevenue = { ...clean, revenue_sar: 11500 }; // VAT left inside revenue
  const contaminatedProfit = { ...clean, profit_sar: 4000 + 1500 }; // VAT added back onto profit
  const cleanIssues = vatContaminationIssues(clean);
  const revIssues = vatContaminationIssues(contaminatedRevenue);
  const profitIssues = vatContaminationIssues(contaminatedProfit);
  if (cleanIssues.length) fail(`self-test: checker flagged a genuinely clean row as contaminated — ${cleanIssues.join('; ')}`);
  else ok('self-test: a genuinely clean VAT-bearing row passes');
  if (!revIssues.length) fail('self-test: checker did NOT catch a revenue figure with VAT left inside it — this would be exactly the false-comfort failure this rewrite exists to fix');
  else ok(`self-test: checker correctly catches VAT-inclusive revenue (${revIssues[0]})`);
  if (!profitIssues.length) fail('self-test: checker did NOT catch a profit figure with a vat_sar term added back in');
  else ok(`self-test: checker correctly catches a VAT-contaminated profit (${profitIssues[0]})`);
}

async function settleContent(p, timeoutMs) {
  const start = Date.now();
  let prev = null, stableCount = 0;
  while (Date.now() - start < timeoutMs) {
    const cur = await p.evaluate(() => {
      const v = document.getElementById('view');
      return v ? v.innerHTML.length : -1;
    });
    if (cur === prev && cur > 40) {
      stableCount++;
      if (stableCount >= 2) return { length: cur, timedOut: false };
    } else stableCount = 0;
    prev = cur;
    await p.waitForTimeout(60);
  }
  return { length: prev, timedOut: true };
}

// Observational only now (see header) — printed for visibility, never calls fail().
const BANNED = [/\bVAT\b/i, /value[\s-]added tax/i, /ضريبة\s*القيمة\s*المضافة/, /ض\.?\s*ق\.?\s*م/];
const CR_VAT_EXEMPT = /CR[\s,/·-]{0,4}$/i;
function findVatMention(text) {
  const vatHits = [...text.matchAll(/\bVAT\b/gi)];
  const realVat = vatHits.find((m) => !CR_VAT_EXEMPT.test(text.slice(Math.max(0, m.index - 6), m.index)));
  if (realVat) return realVat[0];
  for (const re of BANNED.slice(1)) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

async function main() {
  selfTestChecker();

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
  await p.waitForTimeout(1200);

  // ---- THE REAL CHECK: read every live row's own numbers and run the arithmetic. This is
  // data-layer, not render-layer — it holds regardless of which tab happens to be open. ----
  const rows = await p.evaluate(() => (window.FIN && FIN.rows ? FIN.rows.filter((r) => !r.deleted_at) : []).map((r) => ({
    invoice_no: r.invoice_no, total_incl_vat_sar: r.total_incl_vat_sar, vat_sar: r.vat_sar,
    revenue_sar: r.revenue_sar, cost_sar: r.cost_sar, profit_sar: r.profit_sar,
  })));
  const vatBearing = rows.filter((r) => (+r.vat_sar || 0) > 0);
  if (!vatBearing.length) fail('no live row carries vat_sar > 0 — the VAT canary fixture (i-qa-vatclean) is missing, this probe cannot actually test the rule it exists for');
  else ok(`${vatBearing.length} live VAT-bearing row(s) found to check`);
  for (const row of vatBearing) {
    const issues = vatContaminationIssues(row);
    if (issues.length) fail(`invoice ${row.invoice_no}: ${issues.join('; ')}`);
    else ok(`invoice ${row.invoice_no}: revenue_sar and profit_sar are both clean of VAT`);
  }

  // ---- THE CHECK THAT WAS MISSING (added 2026-09-03, probe-integrity round). Everything above
  // reads STORED columns — revenue_sar / profit_sar as the fixture seeded them. The app never
  // computes those, so the arithmetic above holds no matter what the Finance page actually
  // prints. Proven by sabotage: baking vat_sar into the Revenue and Profit totals in
  // js/16-finance-ledger.js (the two sums at ~line 200 and ~line 535) left this probe printing
  // "PASSED — no live cost/profit/revenue figure is VAT-contaminated (M1)" and exiting 0.
  // M1 is the owner's first money rule, and its only guard could not fail — the same
  // rule-nothing-consults shape P5 exists to catch. So: read what the OVERVIEW ACTUALLY SHOWS
  // and compare it both ways — it must equal the VAT-clean sum, and must NOT equal the
  // VAT-inclusive one whenever a VAT-bearing row is present to tell them apart. ----
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('overview'); });
  await p.waitForTimeout(900);
  const kpiM1 = await p.evaluate(() => {
    const num = (el) => el ? parseFloat((el.getAttribute('title') || el.textContent || '').replace(/[^0-9.\-]/g, '')) : null;
    const cards = [...document.querySelectorAll('#view .card')];
    const pick = (label) => {
      const c = cards.find((x) => x.firstElementChild && x.firstElementChild.textContent.trim() === label);
      return c ? num(c.children[1]) : null;
    };
    const live = (window.FIN && FIN.rows ? FIN.rows : []).filter((r) => !r.deleted_at
      && r.integrity_status === 'verified_paid' && r.id !== 'i-qa-takamol');
    const sum = (f) => live.reduce((s, r) => s + (+r[f] || 0), 0);
    return { revShown: pick('Revenue'), profShown: pick('Profit'),
             revClean: sum('revenue_sar'), profClean: sum('profit_sar'), vat: sum('vat_sar') };
  });
  if (kpiM1.revShown == null || kpiM1.profShown == null) {
    fail('Finance/overview: could not read the Revenue and Profit tiles — DOM shape changed, this M1 check needs updating (do NOT delete it: it is the only thing that tests what the page prints)');
  } else if (!(kpiM1.vat > 0)) {
    fail('no VAT-bearing row is live, so the displayed figure cannot be told apart from a VAT-inclusive one — the M1 render check is blind without the VAT canary');
  } else {
    const near = (a, b) => Math.abs(a - b) < 0.01;
    if (near(kpiM1.revShown, kpiM1.revClean)) ok(`Finance/overview: Revenue tile (${kpiM1.revShown.toFixed(2)}) equals the VAT-clean sum, not the VAT-inclusive ${(kpiM1.revClean + kpiM1.vat).toFixed(2)}`);
    else fail(`M1 VIOLATED on screen: Revenue tile shows ${kpiM1.revShown.toFixed(2)}; VAT-clean is ${kpiM1.revClean.toFixed(2)} and VAT-inclusive is ${(kpiM1.revClean + kpiM1.vat).toFixed(2)}`);
    if (near(kpiM1.profShown, kpiM1.profClean)) ok(`Finance/overview: Profit tile (${kpiM1.profShown.toFixed(2)}) equals the VAT-clean sum, not the VAT-inclusive ${(kpiM1.profClean + kpiM1.vat).toFixed(2)}`);
    else fail(`M1 VIOLATED on screen: Profit tile shows ${kpiM1.profShown.toFixed(2)}; VAT-clean is ${kpiM1.profClean.toFixed(2)} and VAT-inclusive is ${(kpiM1.profClean + kpiM1.vat).toFixed(2)}`);
  }

  // ---- Page/tab render sweep — still real, still worth keeping; VAT text mentions are now
  // OBSERVATIONAL only (see header), never fail the build. ----
  for (const lang of [{ code: 'en', label: 'EN' }, { code: 'ar', label: 'AR' }]) {
    console.log(`\n=== ${lang.label} ===`);
    if (lang.code === 'ar') {
      await p.evaluate((code) => {
        try {
          if (typeof setLang === 'function') { setLang(code); return; }
          if (typeof LANG !== 'undefined') { LANG = code; if (typeof render === 'function') render(); }
        } catch (e) {}
      }, lang.code);
      await p.waitForTimeout(700);
    }

    const navLabels = await p.evaluate(() => [...document.querySelectorAll('#nav button')].map((x) => x.textContent.trim()).filter(Boolean));
    for (const label of navLabels) {
      const clicked = await p.evaluate((l) => {
        const btn = [...document.querySelectorAll('#nav button')].find((x) => x.textContent.trim() === l);
        if (btn) { btn.click(); return true; }
        return false;
      }, label);
      if (!clicked) { fail(`${lang.label} nav "${label}": button not found`); continue; }
      const settled = await settleContent(p, 4000);
      const pageLabel = `${lang.label} page "${label}"`;
      if (settled.timedOut || settled.length <= 40) fail(`${pageLabel}: BLIND SPOT — page did not render (length ${settled.length})`);
      else {
        ok(`${pageLabel}: rendered`);
        const text = await p.evaluate(() => document.body.innerText);
        const hit = findVatMention(text);
        if (hit) note(`${pageLabel}: mentions VAT on screen (${JSON.stringify(hit)}) — no longer a violation per the corrected M1, informational only`);
      }
    }

    await p.evaluate(() => { const btn = [...document.querySelectorAll('#nav button')].find((x) => /Finance|المالية/.test(x.textContent)); if (btn) btn.click(); });
    await settleContent(p, 4000);
    for (const tab of FIN_TABS) {
      const clicked = await p.evaluate((k) => { if (typeof window.finGo === 'function') { window.finGo(k); return true; } return false; }, tab);
      if (!clicked) { fail(`${lang.label} Finance/${tab}: window.finGo is not a function`); continue; }
      const settled = await settleContent(p, 4000);
      const tabLabel = `${lang.label} Finance/${tab}`;
      if (settled.timedOut || settled.length <= 40) fail(`${tabLabel}: BLIND SPOT — tab did not render (length ${settled.length})`);
      else {
        ok(`${tabLabel}: rendered`);
        const text = await p.evaluate(() => document.getElementById('view').innerText);
        const hit = findVatMention(text);
        if (hit) note(`${tabLabel}: mentions VAT on screen (${JSON.stringify(hit)}) — no longer a violation per the corrected M1, informational only`);
      }
    }
  }

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nPASSED — no live cost/profit/revenue figure is VAT-contaminated (M1), every page + all 8 Finance tabs render, EN+AR, no blind spots.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
