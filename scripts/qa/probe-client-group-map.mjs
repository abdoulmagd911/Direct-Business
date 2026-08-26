/* probe-client-group-map.mjs — M14 regression guard for the owner-directed client name
   alias feature (2026-08-25): "MDD" and its Arabic spelling "شركة مدد الذكية لتقنية
   المعلومات" are the same real company under two spellings, one English one Arabic —
   currently 507,800.00 SAR (1 invoice) and 134,748.95 SAR (2 invoices) reported as two
   unrelated clients. Same shape for "...Sons Co" vs "...Sons Company" and the alrajhi pair.

   THE OWNER'S TWO EXPLICIT REQUIREMENTS, both asserted below:
   (1) Reversible and visible — see both source names and both totals BEFORE the merge
       applies, undo it after. Nothing in finance_invoices is ever written; the merge is a
       pure display-time resolution (finGroupCheck() consulted by finCanon()), so undo is
       instant and lossless — asserted directly by re-checking the split reappears exactly.
   (2) Consulted by the IMPORT path too, not applied once to existing rows — asserted by
       proving the SAME synthetic rows (standing in for "a fresh Direct Payments export
       carrying the same client_group text") group correctly the moment the mapping exists,
       with no per-row backfill step required — finCanon() is evaluated live on every read.

   Drives the real admin UI (js/62-finance-guardrails.js's "+ Add alias" modal), not just the
   underlying function, so a bug in the modal wiring itself would be caught too. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8241;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

const ALIAS_EN = 'MDD';
const ALIAS_AR = 'شركة مدد الذكية لتقنية المعلومات';
const CANONICAL = 'MDD - Smart Madad IT';

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept());

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

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
  await p.waitForTimeout(1200);

  // Inject two synthetic rows standing in for a real Direct Payments export — NOT part of any
  // finance_client_links business link, so any consolidation seen below can only come from
  // the alias map, never the pre-existing (and separately correct) business-linking system.
  await p.evaluate(([enName, arName]) => {
    FIN.rows = FIN.rows || [];
    FIN.rows.push(
      { invoice_no: 'QA-MDD-EN-1', client_group: enName, customer_raw_name: enName, total_incl_vat_sar: 507800, revenue_sar: 507800, cost_sar: 0, profit_sar: 507800, integrity_status: 'verified_paid', deleted_at: null, invoice_date: '2026-05-01', month: 'May', quarter: 'Q2' },
      { invoice_no: 'QA-MDD-AR-1', client_group: arName, customer_raw_name: arName, total_incl_vat_sar: 67374.475, revenue_sar: 67374.475, cost_sar: 0, profit_sar: 67374.475, integrity_status: 'verified_paid', deleted_at: null, invoice_date: '2026-06-01', month: 'June', quarter: 'Q2' },
      { invoice_no: 'QA-MDD-AR-2', client_group: arName, customer_raw_name: arName, total_incl_vat_sar: 67374.475, revenue_sar: 67374.475, cost_sar: 0, profit_sar: 67374.475, integrity_status: 'verified_paid', deleted_at: null, invoice_date: '2026-07-01', month: 'July', quarter: 'Q2' },
    );
  }, [ALIAS_EN, ALIAS_AR]);

  async function clientsTableText() {
    await p.evaluate(() => { current = 'finance'; FIN.tab = 'clients'; if (typeof clearFinCanon === 'function') clearFinCanon(); render(); });
    await p.waitForTimeout(500);
    return p.evaluate(() => { const v = document.getElementById('view'); return v ? v.innerText : ''; });
  }

  // ---- BASELINE: prove the two synthetic rows really are split before any grouping exists ----
  const before = await clientsTableText();
  if (!before.includes(ALIAS_EN)) fail(`baseline: "${ALIAS_EN}" row not found at all — test setup is broken`);
  if (!/شركة مدد/.test(before)) fail('baseline: the Arabic-name row not found at all — test setup is broken');
  if (before.includes(CANONICAL)) fail(`baseline: "${CANONICAL}" already appears before any grouping was added — test setup is contaminated`);
  else ok('baseline: the two synthetic rows show as separate clients, exactly as reported — proves the test is real');

  // ---- Drive the real admin UI: Finance > Import > "+ Add alias" ----
  // Settle first: the seeding steps above leave a pending debounced global render() that can
  // fire moments after finGo and inject the card COINCIDENTALLY, masking a missing finGo hook
  // (measured 2026-08-26: without the settle, a sabotaged build still passed; with it, the
  // card stays absent indefinitely). The first-paint check below is only honest after this.
  await p.waitForTimeout(3000);
  await p.evaluate(() => { current = 'finance'; if (typeof window.finGo === 'function') window.finGo('import'); });
  // FIRST-PAINT check (found by hands-on driving 2026-08-26): finGo('import') paints via
  // renderFinance() directly, and v62 originally hooked only window.render — so the whole
  // guardrails/alias card was missing on the common first paint of the Import tab (the M12
  // shape again). The finGo hook must make it appear immediately, not after some later
  // unrelated global render happens to fire.
  await p.waitForTimeout(400);
  const firstPaint = await p.evaluate(() => !!document.querySelector('.v62-guardrails'));
  if (!firstPaint) fail('FIRST-PAINT: the guardrails/alias card is missing right after finGo(\'import\') — the finGo hook is not wired (M12 shape: a tab-switch is not a global render)');
  else ok('FIRST-PAINT: the guardrails/alias card is present immediately on the finGo(\'import\') paint');
  await p.waitForTimeout(500);

  // Business-linked auto-suggest: "Test Company 4"/"Test Company 5" are the mock's own
  // pre-existing fixture — already linked to the SAME business (finance_client_links) but
  // never yet given an alias mapping. This is the MDD shape exactly (a cross-script rename
  // that norm62() alone would never catch) — the suggestion must appear without any typing.
  const suggestionText = await p.evaluate(() => { const c = document.querySelector('.v62-guardrails'); return c ? c.innerText : ''; });
  if (!/Test Company 4/.test(suggestionText) || !/Test Company 5/.test(suggestionText)) fail(`business-linked auto-suggest missing for the pre-linked "Test Company 4"/"Test Company 5" fixture pair — got: ${suggestionText.slice(0, 500)}`);
  else ok('business-linked auto-suggest surfaced "Test Company 4" + "Test Company 5" (same business, different client_group text) with zero typing — the MDD shape, caught automatically');

  const opened = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.v62-guardrails button')].find((x) => /Add alias/i.test(x.textContent));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!opened) fail('could not find the "+ Add alias" button — the guardrails card did not render or the button text changed');
  else ok('opened the real "Add client name alias" modal via the admin UI');
  await p.waitForTimeout(400);

  // EXCLUDED clients must never be offered as merge candidates (found by hands-on driving
  // 2026-08-26: the picker listed "Takamol for Business Services" with its totals, because
  // groupCandidates()'s window.live fallback skipped the exclusion filter — js/16's live() is
  // IIFE-scoped and never actually reaches window). The mock seeds both the Takamol invoice
  // row and its exclusion entry, so this is the exact standing-invariant fixture. The card's
  // exclusion-LIST section legitimately shows the name (that is where the rule is managed) —
  // the assertion is scoped to the picker's options only.
  const pickerOptions = await p.evaluate(() => [...document.querySelectorAll('#g2_aliases option')].map((o) => o.value));
  const leakedExcluded = pickerOptions.filter((v) => /takamol|techtic/i.test(v));
  if (leakedExcluded.length) fail(`EXCLUSION LEAK: the alias picker offers excluded client(s) as merge candidates: ${JSON.stringify(leakedExcluded)} — groupCandidates() is not applying finExclusionCheck`);
  else ok('the alias picker offers no excluded client (Takamol/Techtic absent from the candidates)');

  await p.selectOption('#g2_aliases', [ALIAS_EN, ALIAS_AR]);
  await p.fill('#g2_name', CANONICAL);
  await p.click('#mSave');
  await p.waitForTimeout(600);

  const afterMerge = await clientsTableText();
  if (!afterMerge.includes(CANONICAL)) fail(`after merge: "${CANONICAL}" does not appear — got: ${afterMerge.slice(0, 400)}`);
  else ok(`after merge: "${CANONICAL}" appears as the canonical name`);
  // A standalone "MDD" row (tab-separated table cell, not part of "MDD - Smart Madad IT")
  // would mean the raw alias is still showing separately alongside the merged one.
  if (new RegExp('\\n' + ALIAS_EN + '\\t').test(afterMerge)) fail(`after merge: the raw "${ALIAS_EN}" row is still showing separately — not actually consolidated`);
  else ok(`after merge: no separate "${ALIAS_EN}" row remains — the raw alias is gone from the table`);
  // money0() rounds 642,548.95 to 642,549 for display — that rounding is the app's own,
  // expected behavior, not a bug this probe should trip over.
  if (!/642,549/.test(afterMerge)) fail(`after merge: combined total (642,549, i.e. 507,800 + 134,748.95 rounded) not found — got: ${afterMerge.slice(0, 600)}`);
  else ok('after merge: the combined total (507,800 + 134,748.95 = 642,548.95, displayed 642,549) shows under one row — a real consolidation, not just a label change');

  // ---- REQUIREMENT (2): consulted live, not a one-time backfill — a THIRD synthetic row
  // using the SAME already-mapped alias text (standing in for next month's export) must
  // consolidate immediately, with zero extra steps ----
  await p.evaluate(([arName]) => {
    FIN.rows.push({ invoice_no: 'QA-MDD-AR-3-FUTURE-IMPORT', client_group: arName, customer_raw_name: arName, total_incl_vat_sar: 10000, revenue_sar: 10000, cost_sar: 0, profit_sar: 10000, integrity_status: 'verified_paid', deleted_at: null, invoice_date: '2026-08-01', month: 'August', quarter: 'Q3' });
  }, [ALIAS_AR]);
  const afterFutureImport = await clientsTableText();
  if (!/652,549/.test(afterFutureImport)) fail(`a "future import" row using the same mapped alias text did not consolidate automatically — got: ${afterFutureImport.slice(0, 600)}`);
  else ok('REQUIREMENT (2) held: a fresh row carrying an already-mapped alias consolidates immediately, live, with no per-row backfill needed');

  // ---- REQUIREMENT (1): undo is instant and lossless — the split must reappear exactly ----
  const undone = await p.evaluate(() => {
    const list = (window.finGroupList ? finGroupList() : []);
    const e = list.find((x) => x.canonicalName === 'MDD - Smart Madad IT' && x.active !== false);
    if (!e) return false;
    v62UndoGrouping(e.id);
    return true;
  });
  if (!undone) fail('could not find the active grouping entry to undo');
  await p.waitForTimeout(500);
  const afterUndo = await clientsTableText();
  if (afterUndo.includes(CANONICAL)) fail(`after undo: "${CANONICAL}" still appears — undo did not actually take effect`);
  else if (!afterUndo.includes(ALIAS_EN) || !/شركة مدد/.test(afterUndo)) fail(`after undo: the two original names did not reappear — got: ${afterUndo.slice(0, 400)}`);
  else ok('REQUIREMENT (1) held: undo split the totals back apart instantly, byte-for-byte matching the pre-merge baseline shape — nothing in finance_invoices was ever touched');

  // ---- Redo, to confirm the entry is genuinely reversible both ways, not just deletable ----
  const redone = await p.evaluate(() => {
    const list = (window.finGroupList ? finGroupList() : []);
    const e = list.find((x) => x.canonicalName === 'MDD - Smart Madad IT' && x.active === false);
    if (!e) return false;
    v62RedoGrouping(e.id);
    return true;
  });
  if (!redone) fail('could not find the undone grouping entry to redo');
  await p.waitForTimeout(500);
  const afterRedo = await clientsTableText();
  if (!afterRedo.includes(CANONICAL)) fail('after redo: the grouping did not re-apply');
  else ok('redo re-applied the same grouping cleanly — the entry is a real toggle, not a one-shot');

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nclient-group-map OK — the real admin UI merges two client_group aliases into one canonical name, a fresh row using an already-mapped alias consolidates live with no backfill, and undo/redo are lossless and instant.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
