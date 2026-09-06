/* probe-export-access-attacks.mjs (2026-09-06, watch cycle 30) - the exports, called by someone
   who may not see the page.

   Cycle 12 checked all ten Finance WRITE paths against every tier and a read-only share link, and
   found five with no permission check of their own: their buttons were hidden, but "a stale tab, a
   role changed while it was open, or a share view leaves the function one call away". Every one of
   those is now guarded. The READ-OUT paths were never checked at all, and they have exactly the
   same shape: finLedgerCSV, finTxnCSV and finCSV are functions on window that build a file out of
   FIN._csvRows / TXN._csvRows / FIN._lastReport - state the page fills in as it renders.

   The realistic case is not an attacker with a console. It is a person who had Finance open when
   their access changed, or a read-only share link whose Finance page is refused in words while the
   export button's function is still sitting on window with the rows already in memory. js/16
   already owns the answer: canFinView() is the check the Finance page applies to itself before it
   will render at all (line ~1497). The claim under test is simply that the file obeys the same
   rule as the screen it came from.

   Note on what this does and does not cover: once rows are in a browser tab, someone determined
   can read them from devtools whatever any function does. This is not a security boundary against
   that, and is not claimed as one - it is the same symmetry cycle 12 applied to the write paths,
   so a person who may not see Finance cannot produce Finance's file by pressing something.

   Under test:
     1. Positive control: as an admin with Finance rendered, all three exports really do produce a
        file with rows in it - otherwise every refusal below would pass for the wrong reason.
     2. In a read-only share view, each of the three refuses and produces no file.
     3. The stale-tab case, which is the one that actually happens: build the state as an admin,
        flip to a share view WITHOUT re-rendering, then call each export directly.
     4. Whatever they do, they must not half-work - no empty-but-downloaded file, no file naming
        the invoices with the numbers blanked.

   Run:  node scripts/qa/probe-export-access-attacks.mjs        (port 8708)
   Sabotage (file-level): remove the canFinView guard from any one export. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8708;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SEED = [];
for (let i = 0; i < 8; i++) {
  const mo = (i % 6) + 1, d = '2026-' + String(mo).padStart(2, '0') + '-1' + (i % 8);
  SEED.push({
    id: 'x' + i, invoice_no: 'XP-' + i, line_no: 1, zatca_dpin: null,
    client_group: 'Export Co ' + (i % 3), customer_raw_name: 'Export Co ' + (i % 3),
    invoice_date: d, year: 2026, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: 10000 + i * 111, wallet_portion_sar: 0, revenue_sar: 10000 + i * 111,
    cost_sar: 7000, profit_sar: 3000 + i * 111, vat_sar: 0,
    amount_received_sar: 10000 + i * 111, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'xp-qa',
    revenue_way: 'invoice', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  });
}
const TXN = [];
for (let i = 0; i < 5; i++) {
  TXN.push({ id: 't' + i, transaction_ref: 'TR-' + i, invoice_no: i < 3 ? 'XP-' + i : null, company: 'Export Co ' + (i % 3),
    business_id: null, service_type: 'Flights', amount_sar: 4000 + i * 100, cost_confirmed_sar: 3000,
    cost_estimate_sar: null, amount_received_sar: 4000 + i * 100, amount_remaining_sar: 0,
    expense_status: 'ready', overdue: false, created_at_source: '2026-04-0' + (i + 1), deleted_at: null });
}
const srv = start(PORT, { finance_invoices: SEED, finance_transactions: TXN, finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  console.log(`fixture: ${SEED.length} invoices and ${TXN.length} transactions, all of them real money on screen`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);

  /* build the state the exports read, the way the page builds it */
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { finGo('ledger'); }); await p.waitForTimeout(1400);
  await p.evaluate(() => { finGo('reports'); FIN.rb.g1 = '__client'; FIN.rb.g2 = ''; FIN.rb.verifiedOnly = true; FIN.rb.metrics = { revenue_sar: true }; render(); });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { finGo('overview'); }); await p.waitForTimeout(900);

  /* capture whatever an export produces, without letting it actually download */
  const tryExport = (fn) => p.evaluate((fn) => new Promise((res) => {
    let captured = null, clicked = false, alerted = null;
    const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click, oa = window.alert;
    URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { clicked = true; };
    window.alert = function (m) { alerted = String(m); };
    let threw = null;
    try { if (typeof window[fn] === 'function') window[fn](); else threw = 'not a function'; } catch (e) { threw = String(e && e.message || e); }
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2; window.alert = oa;
    if (!captured) return res({ file: null, clicked, alerted, threw });
    captured.text().then((t) => res({ file: t.replace(/^﻿/, ''), clicked, alerted, threw }));
  }), fn);
  const EXPORTS = [['finLedgerCSV', 'the invoice export'], ['finTxnCSV', 'the ledger export'], ['finCSV', 'the Report Builder export']];

  /* ---------- 1. positive control: as an admin they really do produce a file ---------- */
  const baseline = {};
  let ctlBad = 0;
  for (const [fn, label] of EXPORTS) {
    const r = await tryExport(fn);
    baseline[fn] = r;
    const lines = r.file ? r.file.trim().split('\n').length - 1 : 0;
    if (r.file && lines > 0) ok(`control: as an admin, ${label} (${fn}) produces a file with ${lines} row(s) — so a refusal below means something`);
    else { ctlBad++; fail(`control: as an admin, ${label} (${fn}) produced no file (alert: ${r.alerted}, threw: ${r.threw}) — every check below would pass for the wrong reason`); }
  }
  if (ctlBad) { console.log('\nFAILED - ' + failures + ' check(s)'); await b.close(); srv.close(); process.exit(1); }
  note(`each export names real money — e.g. ${(baseline.finLedgerCSV.file || '').split('\n')[1].slice(0, 80)}`);

  /* ---------- 3. the stale tab: state built as admin, access removed, no re-render ---------- */
  await p.evaluate(() => { window.__isShareView = true; });
  const stale = {};
  for (const [fn, label] of EXPORTS) {
    const r = await tryExport(fn);
    stale[fn] = r;
    const lines = r.file ? r.file.trim().split('\n').length - 1 : 0;
    if (!r.file && !r.clicked) ok(`a stale tab turned into a read-only share view: ${label} refuses and produces no file${r.alerted ? ' — it says why: "' + r.alerted.slice(0, 90) + '"' : ''}`);
    else fail(`a stale tab turned into a read-only share view: ${label} still produced a ${lines}-row file of money the viewer may not see — the page itself refuses to render for this session (canFinView), but the export function on window does not apply the same rule. Cycle 12 closed exactly this shape on all ten WRITE paths; the read-out paths were never checked`);
  }

  /* ---------- 4. no half-working file ---------- */
  const half = EXPORTS.filter(([fn]) => stale[fn].file && stale[fn].file.trim().split('\n').length <= 1);
  if (!half.length) ok('no export produced a header-only or blanked file — each either works fully or refuses, never a download that looks like an answer');
  else fail(half.map(([, l]) => l).join(' and ') + ' produced a header-only file — a download that looks like an answer and is not');

  /* ---------- 3b. the OTHER half of the stale tab: a role that denies Finance (2026-09-06, round 50)
     Cycle 30 guarded these with canFinView(), which asks one question: is this a read-only share
     link. The Finance page is refused for a second reason as well — a role that does not allow it,
     enforced by js/49's mayOpen('finance'). Measured before the fix: with a denying role and NO
     share view, the page refused in words while finLedgerCSV still produced 16 rows and finTxnCSV
     4. That is the likelier half of the very case cycle 30 set out to close — a revoked role is an
     ordinary event; a share link is the rarer one. */
  await p.evaluate(() => {
    window.__isShareView = false;                 // explicitly NOT a share view
    window.__userTier = 'viewer';
    window.__accessKnown = function () { return true; };
    window.myAllowedPages = function () { return ['leads']; };   // Finance not among them
  });
  const roleState = await p.evaluate(() => ({
    canFinView: typeof canFinView === 'function' ? canFinView() : null,
    mayOpen: window.__v73MayOpen ? window.__v73MayOpen('finance') : null,
  }));
  if (roleState.canFinView === true && roleState.mayOpen === false)
    ok('control: the session is refused Finance by ROLE and is not a share view — canFinView() says yes, mayOpen("finance") says no, so this is the half canFinView alone cannot see');
  else fail(`control: expected canFinView true and mayOpen false, got ${JSON.stringify(roleState)} — the role case below is not actually set up`);
  for (const [fn, label] of EXPORTS) {
    const r = await tryExport(fn);
    const lines = r.file ? r.file.trim().split('\n').length - 1 : 0;
    if (!r.file && !r.clicked) ok(`a role that denies Finance: ${label} refuses and produces no file${r.alerted ? ' — "' + r.alerted.slice(0, 70) + '"' : ''}`);
    else fail(`a role that denies Finance: ${label} produced a ${lines}-row file. The page refuses this session in words, but the export does not ask the same question — canFinView() only covers a share link`);
  }
  await p.evaluate(() => { window.__userTier = 'admin'; try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; } try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; } });

  /* ---------- 2. a share view from the start ---------- */
  await p.evaluate(() => { window.__isShareView = true; FIN._csvRows = null; TXN._csvRows = null; FIN._lastReport = null; current = 'finance'; render(); });
  await p.waitForTimeout(1200);
  const refusedText = await p.evaluate(() => ((document.getElementById('view') || {}).innerText || '').slice(0, 200));
  if (/not available in shared view-only links/i.test(refusedText)) ok('a read-only share link is refused Finance in words, exactly as cycle 12 recorded — so the export is the only way out of the page');
  else fail('the share view no longer refuses the Finance page in words: ' + JSON.stringify(refusedText));
  let fresh = 0;
  for (const [fn, label] of EXPORTS) {
    const r = await tryExport(fn);
    if (!r.file && !r.clicked) ok(`in a share view opened cold, ${label} produces no file`);
    else { fresh++; fail(`in a share view opened cold, ${label} produced a file`); }
  }
  if (!fresh) ok('none of the three exports is a way around the refused page');

  if (!errors.length) ok('no page error'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
