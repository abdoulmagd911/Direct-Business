/* probe-client-group-map.mjs — M14 regression guard for the owner-directed client name merge (2026-08-25): one real
   company appears in Direct Payments under two spellings — a short English name and its full Arabic legal name — and
   was reported as two unrelated clients. (Made-up names and amounts here; the real pair stays in the database.)

   THE OWNER'S TWO EXPLICIT REQUIREMENTS, both asserted below:
   (1) Reversible and visible — see both source names and both totals BEFORE the merge applies, undo it after. Nothing in
       finance_invoices is ever written by a merge.
   (2) Consulted by the IMPORT path too, not applied once to existing rows — a later row carrying the same name (in any
       spelling) lands under the company with nothing to do.

   E (2026-09-27, DECISIONS D16): js/62's alias map and its "+ Add alias" modal are retired. A spelling now joins a company
   only when a person TYPES it there — Finance → Rules → "Needs a decision" → Belongs to [company], which writes one row
   in company_name_aliases, applied by the view money_rows. So this probe now drives that control: both spellings sit in
   Needs a decision before (split, with their totals); pressing Belongs to for each puts both under one company with the
   combined total; a later import row in a third spelling (ة written ه) lands there at once; "Remove" takes a name out
   again and the split reappears (a removal is final, so "redo" is typing the name again — a new row, the old stays
   removed); an EXCLUDED client is never offered for a decision; finance_invoices is byte-identical throughout the merge
   and the undo; the page itself never writes a name (only the button does). Rows are seeded through the table, because
   the company now comes from the view, not from FIN.rows. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8241;
const ALIAS_EN = 'Qamar Test';
const ALIAS_AR = 'شركة قمر التجريبية للأنظمة';
const ALIAS_AR_VARIANT = 'شركه قمر التجريبيه للأنظمه';   // the same name with ة written ه — as a later export may carry it
const TARGET = 'Test Company 8';                          // a harness company with no money of its own
const inv = (id, no, g, v, d) => ({ id, invoice_no: no, client_group: g, customer_raw_name: g, invoice_date: d, month: 'May', quarter: 'Q2', year: 2026, products: 'Flights', service_type: 'Flights', record_type: 'b2b',
  total_incl_vat_sar: v, wallet_portion_sar: 0, revenue_sar: v, cost_sar: 0, profit_sar: v, amount_received_sar: v, amount_remaining_sar: 0, integrity_status: 'verified_paid', exclusion_reason: null, notes: null,
  source_batch: 'qa-cgm', revenue_way: 'invoice', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z', deleted_at: null });
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const api = (q) => fetch(BASE + '/rest/v1/' + q).then((r) => r.json());

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  const nameWrites = []; let clicking = false;
  p.on('request', (rq) => { if (/\/rest\/v1\/company_name_aliases/.test(rq.url()) && rq.method() !== 'GET' && !clicking) nameWrites.push(rq.method()); });

  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && (DB.businesses || []).length > 0 && typeof window.v117Decide === 'function' && window.FIN && typeof finLoad === 'function', null, { timeout: 90000 }).catch(() => {});

  // Seed the two spellings through the table (as an import would): one EN invoice, two AR invoices — no client ID, no code.
  await p.evaluate(async (rows) => { const r = await fc().from('finance_invoices').insert(rows.map((x) => { const y = Object.assign({}, x); delete y.year; return y; })).select('id'); window.__seeded = (r.data || []).length; },
    [inv('cgm-en-1', 'QA-CGM-EN-1', ALIAS_EN, 400000, '2026-05-01'), inv('cgm-ar-1', 'QA-CGM-AR-1', ALIAS_AR, 55555.5, '2026-06-01'), inv('cgm-ar-2', 'QA-CGM-AR-2', ALIAS_AR, 55555.5, '2026-07-01')]);
  const reload = async () => { await p.evaluate(() => { FIN.rows = null; if (typeof clearFinCanon === 'function') clearFinCanon(); finLoad(); }); await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(500); };
  await reload();

  async function clientsTableText() {
    await p.evaluate(() => { current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all', cmp: 'none' }; FIN.tab = 'clients'; if (typeof clearFinCanon === 'function') clearFinCanon(); render(); });
    await p.waitForTimeout(600);
    return p.evaluate(() => { const v = document.getElementById('view'); return v ? v.innerText : ''; });
  }
  const loose = () => p.evaluate(() => [...document.querySelectorAll('tr[data-v117-loose]')].map((tr) => tr.getAttribute('data-v117-loose')));
  async function decide(name) {
    await p.evaluate(() => { current = 'finance'; finGo('rules'); }); await p.waitForTimeout(700);
    const picked = await p.evaluate(([n, target]) => { const tr = [...document.querySelectorAll('tr[data-v117-loose]')].find((x) => x.getAttribute('data-v117-loose') === n); if (!tr) return 'no row';
      const sel = tr.querySelector('select'); const o = [...sel.options].find((x) => x.textContent.trim().startsWith(target)); if (!o) return 'no option'; sel.value = o.value; return o.value; }, [name, TARGET]);
    if (/^no /.test(picked)) return picked;
    clicking = true;
    await p.evaluate((n) => { const tr = [...document.querySelectorAll('tr[data-v117-loose]')].find((x) => x.getAttribute('data-v117-loose') === n); tr.querySelector('[data-v117-decide="belongs"]').click(); }, name);
    await p.waitForTimeout(400); clicking = false;
    await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading && window.MR && MR.rules, null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(700);
    return picked;
  }

  // ---- BASELINE: the two spellings really are split before anyone decides ----
  if (await p.evaluate(() => window.__seeded) !== 3) fail('setup: the three seed rows did not land');
  const before = await clientsTableText();
  if (!before.includes(ALIAS_EN) || !/شركة قمر/.test(before)) fail('baseline: one of the two spellings is missing from the Clients tab — test setup is broken');
  else if (/511,111/.test(before)) fail('baseline: the combined total already shows before any decision — test setup is contaminated');
  else ok('baseline: the two spellings show as separate clients with their own totals — proves the test is real');

  // ---- FIRST PAINT + the decision list ----
  await p.waitForTimeout(1500);
  await p.evaluate(() => { current = 'finance'; if (typeof window.finGo === 'function') window.finGo('rules'); });
  await p.waitForTimeout(400);
  const firstPaint = await p.evaluate(() => !!document.querySelector('.v117-merges'));
  if (!firstPaint) fail('FIRST-PAINT: the Rules tab (Company merges card) is missing right after finGo(\'rules\') — a tab switch is not a global render (M12 shape)');
  else ok('FIRST-PAINT: the Company merges card is present immediately on the finGo(\'rules\') paint');
  const L0 = await loose();
  if (L0.includes(ALIAS_EN) && L0.includes(ALIAS_AR)) ok('both spellings wait under "Needs a decision" — visible, with their totals, before anything is merged');
  else fail('both spellings should be under Needs a decision: ' + JSON.stringify(L0));
  const leaked = L0.filter((v) => /tawthiq|techtic/i.test(v));
  if (leaked.length) fail('EXCLUSION LEAK: an excluded client is offered for a merge decision: ' + JSON.stringify(leaked));
  else ok('no excluded client (Tawthiq/Techtic, caught by the harness rule) is offered for a decision');

  // ---- the merge, through the real control ----
  const fiBefore = JSON.stringify(await api('finance_invoices?order=id.asc'));
  const d1 = await decide(ALIAS_EN), d2 = await decide(ALIAS_AR);
  if (/^no /.test(d1) || /^no /.test(d2)) fail('could not press Belongs to: ' + d1 + ' / ' + d2);
  else ok('pressed Belongs to "' + TARGET + '" for both spellings in Needs a decision');
  const typed = (await api('company_name_aliases')).filter((a) => [ALIAS_EN, ALIAS_AR].includes(a.name) && !a.removed_at);
  if (typed.length === 2 && typed.every((a) => a.business_id === d1)) ok('two typed names landed in company_name_aliases, both in the chosen company');
  else fail('typed names after the decisions: ' + JSON.stringify(typed));
  const afterMerge = await clientsTableText();
  if (!afterMerge.includes(TARGET)) fail(`after merge: "${TARGET}" does not appear — got: ${afterMerge.slice(0, 400)}`);
  else ok(`after merge: the company "${TARGET}" appears`);
  if (new RegExp('\\n' + ALIAS_EN + '\\t').test(afterMerge) || /\nشركة قمر[^\n]*\t/.test(afterMerge)) fail('after merge: a raw spelling is still showing as its own client');
  else ok('after merge: neither raw spelling shows as its own client any more');
  if (!/511,111/.test(afterMerge)) fail(`after merge: the combined total (400,000 + 111,111 = 511,111) not found — got: ${afterMerge.slice(0, 600)}`);
  else ok('after merge: the combined total 511,111 shows under the one company — a real consolidation, not a label');
  if (JSON.stringify(await api('finance_invoices?order=id.asc')) === fiBefore) ok('finance_invoices is byte-identical after the merge — a merge never writes money');
  else fail('the merge changed finance_invoices');

  // ---- REQUIREMENT (2): a later import row, in a third spelling, lands under the company with nothing to do ----
  await p.evaluate(async (row) => { const y = Object.assign({}, row); delete y.year; await fc().from('finance_invoices').insert([y]).select('id'); }, inv('cgm-ar-3', 'QA-CGM-AR-3-FUTURE', ALIAS_AR_VARIANT, 10000, '2026-08-01'));
  await reload();
  const afterFuture = await clientsTableText();
  if (!/521,111/.test(afterFuture)) fail(`a later row spelled "${ALIAS_AR_VARIANT}" (ة written ه) did not join the company — got: ${afterFuture.slice(0, 600)}`);
  else ok('REQUIREMENT (2) held: a later import row in another spelling (ة/ه) joins the company at once, with no step and no backfill');
  const fiWithFuture = JSON.stringify(await api('finance_invoices?order=id.asc'));

  // ---- REQUIREMENT (1): undo — take both names out; the split reappears ----
  for (const n of [ALIAS_EN, ALIAS_AR]) {
    await p.evaluate(() => { current = 'finance'; finGo('rules'); }); await p.waitForTimeout(600);
    clicking = true;
    const hit = await p.evaluate((nm) => { const a = (MR.aliases || []).find((x) => x.name === nm); if (!a) return false; v117RemoveAlias(a.id); return true; }, n);
    await p.waitForSelector('#pfConfirmYes', { timeout: 5000 }).catch(() => {}); await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); });
    await p.waitForTimeout(400); clicking = false;
    if (!hit) fail('could not find the typed name "' + n + '" to remove');
    await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading && window.MR && MR.rules, null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(700);
  }
  const afterUndo = await clientsTableText();
  if (/521,111|511,111/.test(afterUndo)) fail('after undo: the combined total still shows — the removal did not take effect');
  else if (!afterUndo.includes(ALIAS_EN) || !/شركة قمر/.test(afterUndo)) fail(`after undo: the original spellings did not reappear — got: ${afterUndo.slice(0, 400)}`);
  else ok('REQUIREMENT (1) held: removing the typed names split the totals back apart at once');
  const removed = (await api('company_name_aliases')).filter((a) => [ALIAS_EN, ALIAS_AR].includes(a.name));
  if (removed.length === 2 && removed.every((a) => a.removed_at)) ok('the removed names are kept, marked removed (who and when) — nothing is deleted');
  else fail('removed names: ' + JSON.stringify(removed));
  if (JSON.stringify(await api('finance_invoices?order=id.asc')) === fiWithFuture) ok('finance_invoices is byte-identical after the undo too');
  else fail('the undo changed finance_invoices');

  // ---- redo: a removal is final, so the person types the name again — it merges again ----
  const r1 = await decide(ALIAS_EN), r2 = await decide(ALIAS_AR);
  const afterRedo = await clientsTableText();
  const rows2 = (await api('company_name_aliases')).filter((a) => [ALIAS_EN, ALIAS_AR].includes(a.name));
  if (!/^no /.test(r1) && !/^no /.test(r2) && /521,111/.test(afterRedo) && rows2.length === 4 && rows2.filter((a) => !a.removed_at).length === 2)
    ok('redo = typing the names again: they merge again as NEW rows, and the removed ones stay removed');
  else fail('redo did not re-merge cleanly: ' + JSON.stringify({ r1, r2, rows: rows2.length, total: /521,111/.test(afterRedo) }));

  if (nameWrites.length) fail('the page wrote to company_name_aliases without a button being pressed: ' + JSON.stringify(nameWrites));
  else ok('every typed-name write came from a button a person pressed — nothing written on its own (D17)');

  const realErrors = errors.filter((e) => !/net::ERR_|forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nclient-group-map OK — two spellings merge only when a person types them into a company, a later spelling joins at once, and undo/redo are visible and lossless.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
