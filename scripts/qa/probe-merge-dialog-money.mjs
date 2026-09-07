/* probe-merge-dialog-money.mjs (2026-09-07, watch cycle 40) — the money the MERGE CONFIRMATION
   prints. Attack area (mm).

   js/62's v62MergeBiz builds a confirm() that reads, for both companies:

     … invoice links (2 invoices, 20,000 SAR) … moves to "Merge B" (1 invoices, 500 SAR).

   That is the fact a person reads when deciding which of two company records to KEEP and which
   to ARCHIVE. Nothing had ever checked it.

   It is computed by bizFinance(), which sums FIN.rows with the raw `+r.total_incl_vat_sar||0` —
   and FIN.rows is only clean as a side effect of live() having run, because live() is where
   finSanitizeMoney happens and it sanitises IN PLACE. The duplicate-companies card is reachable
   without ever opening Finance. Measured that way before the fix, the dialog said:

     Merge A (2 invoices, 0 SAR)          ← holding 20,000

   The COUNT is right and the money is zero, which is worse than an obvious error: it reads as a
   coherent fact — "this record has invoices but no value" — at the moment someone chooses which
   record survives. Cycle 39 found the same hole in js/16's invoice modal; this is one file over,
   on a surface where the number decides an irreversible-looking action.

   Under test:
     1. Control — with Finance rendered first, both companies' figures are the fixture's own.
     2. THE DEFECT — with Finance NEVER rendered, the same dialog prints the same figures.
     3. The invoice COUNT is right in both cases (it always was; that is what made the wrong
        money read as a fact rather than a glitch).
     4. A soft-deleted invoice is not counted into either company's total.
     5. An EXCLUDED client's invoices are not counted — the standing exclusion holds here too.

   Run:  node scripts/qa/probe-merge-dialog-money.mjs        (port 8719)
   Sabotage: drop the finSanitizeMoney call from bizFinance in js/62 — check 2 goes red with
   "2 invoices, 0 SAR". Restore byte-identical (md5).                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start, settingsLoaded } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8719;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const base = (o) => Object.assign({
  id: 'x', invoice_no: 'X', line_no: 1, zatca_dpin: 'T', client_group: 'G', customer_raw_name: 'G',
  invoice_date: '2026-05-10', month: 'May', quarter: 'Q2', year: 2026, products: 'B2B',
  service_type: 'Flights', record_type: 'b2b', total_incl_vat_sar: 0, wallet_portion_sar: 0,
  revenue_sar: 0, cost_sar: 0, profit_sar: 0, amount_received_sar: 0, amount_remaining_sar: 0,
  collection_due_date: null, integrity_status: 'verified_paid', exclusion_reason: null, notes: null,
  source_batch: 'merge-qa', created_at: '2026-05-10T00:00:00Z', updated_at: '2026-05-10T00:00:00Z',
  deleted_at: null, origin: 'booking', proposal_ref: null, items: null
}, o);

/* Company A's money arrives as formatted strings — the shape live() exists to clean. B's is
   numeric, so a failure on A alone cannot be blamed on the harness. */
const SEED = [
  base({ id: 'mm-1', invoice_no: 'MM-001', client_group: 'Merge A', customer_raw_name: 'Merge A', total_incl_vat_sar: '12,345.00', revenue_sar: '12,345.00' }),
  base({ id: 'mm-2', invoice_no: 'MM-002', client_group: 'Merge A', customer_raw_name: 'Merge A', total_incl_vat_sar: '7,655.00', revenue_sar: '7,655.00' }),
  base({ id: 'mm-3', invoice_no: 'MM-003', client_group: 'Merge B', customer_raw_name: 'Merge B', total_incl_vat_sar: 500, revenue_sar: 500 }),
  /* deleted — must reach neither total */
  base({ id: 'mm-4', invoice_no: 'MM-004', client_group: 'Merge A', customer_raw_name: 'Merge A', total_incl_vat_sar: 999999, revenue_sar: 999999, deleted_at: '2026-06-01T00:00:00Z' }),
  /* the standing exclusion, linked to company B — must reach neither total */
  base({ id: 'mm-5', invoice_no: 'MM-005', client_group: 'Takamol for Business Services', customer_raw_name: 'Takamol for Business Services', total_incl_vat_sar: 888888, revenue_sar: 888888 })
];
const LINKS = [
  { id: 'ml1', client_group: 'Merge A', business_id: 'bizA', is_client: true, confirmed_by: 'auto-match' },
  { id: 'ml2', client_group: 'Merge B', business_id: 'bizB', is_client: true, confirmed_by: 'auto-match' },
  { id: 'ml3', client_group: 'Takamol for Business Services', business_id: 'bizB', is_client: true, confirmed_by: 'auto-match' }
];
const srv = start(PORT, { finance_invoices: SEED, finance_client_links: LINKS });
const BASE = 'http://localhost:' + PORT;
const WANT_A = '20,000', WANT_B = '500';

async function dialogFigures(b, renderFinanceFirst) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  /* deliberately NOT the Finance page — the duplicate-companies card is reached from elsewhere */
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(2500);
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForTimeout(5000);
  await p.evaluate(() => { DB.businesses = DB.businesses || []; DB.businesses.push({ id: 'bizA', name: 'Merge A', isClient: true }, { id: 'bizB', name: 'Merge B', isClient: true }); });
  for (let i = 0; i < 200 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length >= 5)); i++) {
    await p.evaluate(() => { try { if (typeof finLoad === 'function' && !(FIN.rows && FIN.rows.length)) finLoad(); } catch (_) { } });
    await p.waitForTimeout(250);
  }
  if (renderFinanceFirst) { await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1800); }
  /* Wait for the standing exclusion before opening the dialog. Without this the checks below
     measure whichever side of the settings load the run happened to land on: in one run out of
     three the dialog offered "2 invoices, 889,388 SAR" for a company whose own money is 500,
     the rest being the excluded partner's — a real fail-open, guarded by its own check further
     down rather than left to redden these ones at random. */
  const exclReady = await settingsLoaded(p, 90000, () => { try { return !!(typeof finExclusionCheck === 'function' && finExclusionCheck('Takamol for Business Services')); } catch (_) { return false; } });
  const msg = await p.evaluate(() => {
    let captured = null; const oc = window.confirm; window.confirm = (m) => { captured = m; return false; };
    try { window.v62MergeBiz('bizB', 'bizA'); } catch (e) { captured = 'THREW ' + e.message; }
    window.confirm = oc; return captured;
  });
  await ctx.close();
  if (!exclReady) return { msg: '(the exclusion list never arrived — this run could not measure the dialog against the standing exclusion)', pairs: [], exclReady: false };
  const pairs = String(msg || '').match(/\((\d+) invoices, ([\d,\.]+) SAR\)/g) || [];
  return { msg: String(msg || ''), pairs, exclReady: true };
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  const rendered = await dialogFigures(b, true);
  const cold = await dialogFigures(b, false);
  /* If either run never got the exclusion list, no check below can mean anything — say that
     once, plainly, instead of letting it cascade into four failures that name the wrong cause. */
  if (!rendered.exclReady || !cold.exclReady) {
    fail('the exclusion list never arrived from app_settings in ' + (!rendered.exclReady && !cold.exclReady ? 'either run' : (!rendered.exclReady ? 'the rendered run' : 'the cold run')) + ' — every check here is about whether the merge dialog respects the standing exclusion, so measuring without it would blame the app for the harness');
    await b.close(); srv.close();
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  if (rendered.pairs.length === 2 && rendered.pairs[0].includes(WANT_A) && rendered.pairs[1].includes(WANT_B))
    ok(`control: with Finance rendered first the merge dialog prints ${rendered.pairs.join(' and ')} — the fixture's own figures, so a failure below is about the path and not the fixture`);
  else fail(`control: the merge dialog did not print the fixture's figures even with Finance rendered — got ${JSON.stringify(rendered.pairs)} from: ${JSON.stringify(rendered.msg.slice(0, 220))}`);

  if (cold.pairs.length === 2 && cold.pairs[0].includes(WANT_A) && cold.pairs[1].includes(WANT_B))
    ok('with Finance NEVER rendered the merge dialog prints the same figures — bizFinance sanitises the rows it sums instead of trusting that some other screen already did');
  else fail(`with Finance never rendered the merge dialog prints ${JSON.stringify(cold.pairs)} instead of ${WANT_A} and ${WANT_B} SAR. bizFinance sums FIN.rows with the raw \`+\`, and FIN.rows is only clean as a side effect of live() having run — so the company holding 20,000 reads as "0 SAR" with its invoice COUNT still right, which is the shape someone believes. This is the number they use to choose which record survives a merge. Dialog: ${JSON.stringify(cold.msg.slice(0, 260))}`);

  const counts = cold.pairs.map((s) => (s.match(/\((\d+) invoices/) || [])[1]);
  if (counts[0] === '2' && counts[1] === '1')
    ok('the invoice COUNT is right on the cold path too (2 and 1) — it always was, which is exactly what made the wrong money read as a fact rather than a glitch');
  else fail(`the invoice counts on the cold path are ${JSON.stringify(counts)}, expected 2 and 1`);

  if (!/999,999|999999/.test(cold.msg) && !/999,999|999999/.test(rendered.msg))
    ok("a soft-deleted invoice's 999,999 reaches neither company's total in the dialog");
  else fail('a soft-deleted invoice reached a merge-dialog total: ' + JSON.stringify(cold.msg.slice(0, 220)));

  /* 2026-09-07: the first version of this check hunted the literal 888,888 — and the excluded
     money does not appear as itself, it is SUMMED INTO company B's total (500 + 888,888 =
     889,388). The check passed while the leak it names was on screen, which is cycle 28's
     lesson repeated. Test the TOTAL against the fixture instead of scanning for the amount. */
  const bTotals = [rendered, cold].map((r) => (r.pairs[1] || '').match(/([\d,]+) SAR/) || []).map((m) => m[1] || null);
  if (bTotals.every((t) => t === WANT_B))
    ok(`the excluded client's money is in neither dialog's total for company B — both read ${WANT_B} SAR, its own money, so the standing exclusion holds inside the merge dialog`);
  else fail(`an EXCLUDED client's money is summed into a merge-dialog total: company B reads ${JSON.stringify(bTotals)} where its own money is ${WANT_B} SAR. 500 + the excluded partner's 888,888 = 889,388, and nothing on the dialog says so. This is the owner's hardest ruling failing open on the surface that decides which company record survives.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nmerge-dialog-money OK — the figures that decide which company record survives are the records\' own, whether or not Finance was ever opened');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
