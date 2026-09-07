/* probe-txn-exclusion-attacks.mjs (2026-09-07, round 68) — the standing exclusion on the OTHER
   money table.

   js/16's own header states the doctrine, in the words the Takamol incident taught: "a standing
   exclusion must hold no matter how a row arrived, so live() — the one chokepoint every total and
   export in this file reads through — re-checks client_group/customer_raw_name against the
   exclusion list on every call, not just once at load." Ten Takamol invoices had reached
   finance_invoices by a path outside this app entirely and rendered in every total until they were
   found and removed by hand.

   That is `live()`, and it covers finance_INVOICES. Transactions are a second money table, loaded
   from the same source system, with its own chokepoint:

     function txnLive(){
       var rows=(TXN.rows||[]);
       for(var i=0;i<rows.length;i++)txnSanitizeMoney(rows[i]);
       return rows;                          // ← sanitised, and nothing else
     }

   No exclusion re-check. Every transaction total, the Transactions tab's KPI strip, and
   window.finTxnCSV()'s exported file read through it. If a standing-excluded client has a
   transaction — and transactions arrive from Direct Payments the same way invoices do — its money
   is counted on screen and written into a file that leaves the building.

   Transactions carry a stronger key than invoices do, which is why this is fixable rather than
   merely reportable: an exclusion entry has a `clientId`, and a transaction's client_profile row
   has `direct_client_id`. That is the real client-ID bridge js/62's own comment says it is waiting
   for, already present on this table. The company NAME is checked too, for a transaction whose
   profile is missing or whose id was never filled in.

   Under test:
     1. A transaction belonging to a standing-excluded client is not counted in the Transactions
        tab's confirmed-revenue figure.
     2. It is not written into the exported CSV.
     3. Matching by client ID works on its own — a row whose company name is spelled differently
        but whose profile carries the excluded clientId is still held out.
     4. CONTROL: an ordinary client's transaction IS counted and IS exported. Without this, every
        check above would pass on a Transactions tab that rendered nothing.
     5. The exclusion list actually arrived before any of this was measured; if it never does, say
        so in one line rather than reporting a world where nothing is excluded as a pass.

   Run:  node scripts/qa/probe-txn-exclusion-attacks.mjs        (port 9027)
   Sabotage — measured, and it corrected the prediction written here first. Each half covers a row
   the other cannot see, so each removal reddens two checks:
     · remove the ID test   → the differently-spelled company gets through, on screen and in the
       file (2 red);
     · remove the name test → the row with NO client profile gets through, on screen and in the
       file (2 red).
   The fixture needed a fourth row before that was true. With only the first three, both excluded
   transactions also carried the excluded clientId, so removing the name test changed nothing and
   that half was untested — the two-halves trap, in my own fixture, one round after finding it in
   someone else's.
   Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start, settingsLoaded } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9027;
const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);

/* The standing exclusion the harness seeds is clientId '7', matchNames ['Takamol for Business
   Services','Techtic Support'] — the real one, from the real incident. */
const EXCLUDED_NAME = 'Takamol for Business Services';
const PROFILES = [
  { id: 'xp0', business_id: 'xb0', direct_client_id: '55', profile_type: 'postpaid', status: 'active', payment_terms: 'Net 30', billing_cycle: 'Monthly', opened_at: '2026-03-01', closed_at: null },
  { id: 'xp1', business_id: 'xb1', direct_client_id: '7', profile_type: 'postpaid', status: 'active', payment_terms: 'Net 30', billing_cycle: 'Monthly', opened_at: '2026-03-01', closed_at: null },
  { id: 'xp2', business_id: 'xb2', direct_client_id: '7', profile_type: 'postpaid', status: 'active', payment_terms: 'Net 30', billing_cycle: 'Monthly', opened_at: '2026-03-01', closed_at: null },
];
const txn = (o) => Object.assign({
  id: 'x', transaction_ref: 'X', invoice_no: null, zatca_dpin: null, direct_uuid: null,
  business_id: 'xb0', client_profile_id: 'xp0', product: 'Direct Flights', service_type: 'Flights',
  amount_sar: 0, expense_status: 'ready', cost_confirmed_sar: 0, cost_estimate_sar: null,
  amount_received_sar: 0, amount_remaining_sar: 0, overdue: null,
  created_at_source: '2026-05-10T10:00:00Z', origin: 'booking', proposal_ref: null, source: 'probe'
}, o);
/* ORDINARY — must be counted and exported (the control) */
const OK_TXN = txn({ id: 'xt0', transaction_ref: 'TXN-OK-1', business_id: 'xb0', client_profile_id: 'xp0', amount_sar: 1000, cost_confirmed_sar: 400 });
/* EXCLUDED BY NAME — company is named exactly as the standing exclusion */
const EXCL_NAME = txn({ id: 'xt1', transaction_ref: 'TXN-EXCL-NAME', business_id: 'xb1', client_profile_id: 'xp1', amount_sar: 500000, cost_confirmed_sar: 100000 });
/* EXCLUDED BY ID ONLY — company spelled differently, profile carries the excluded clientId */
const EXCL_ID = txn({ id: 'xt2', transaction_ref: 'TXN-EXCL-ID', business_id: 'xb2', client_profile_id: 'xp2', amount_sar: 250000, cost_confirmed_sar: 50000 });

/* EXCLUDED BY NAME ONLY — no client profile at all, so the ID bridge cannot see it and the name
   test is the only thing that can. Without this row both excluded transactions also carried the
   excluded clientId, so removing the name test changed nothing and that half of the fix was
   untested — the two-halves trap, in my own fixture. */
const EXCL_NAME_ONLY = txn({ id: 'xt3', transaction_ref: 'TXN-EXCL-NAMEONLY', business_id: 'xb1', client_profile_id: null, amount_sar: 90000, cost_confirmed_sar: 10000 });

const srv = start(PORT, { finance_transactions: [OK_TXN, EXCL_NAME, EXCL_ID, EXCL_NAME_ONLY], client_profiles: PROFILES });

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const alerts = [];
  p.on('dialog', (d) => { alerts.push(d.message()); d.dismiss().catch(() => { }); });
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(2500);
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForTimeout(5000);

  /* the companies the transactions point at — one ordinary, two that are the same excluded client */
  await p.evaluate((n) => {
    DB.businesses = DB.businesses || [];
    DB.businesses.push(
      { id: 'xb0', name: 'Ordinary Travel Co', isClient: true },
      { id: 'xb1', name: n, isClient: true },
      { id: 'xb2', name: 'Takamol Business Svcs (other spelling)', isClient: true });
  }, EXCLUDED_NAME);

  /* 5 — the list must be there before anything is measured */
  const ready = await settingsLoaded(p, 90000, () => { try { return !!(typeof finExclusionCheck === 'function' && finExclusionCheck('Takamol for Business Services')); } catch (_) { return false; } });
  if (!ready) {
    fail('the exclusion list never arrived from app_settings — every check here is about whether the transactions table respects it, so measuring without it would report a world where nothing is excluded as a pass');
    await b.close(); srv.close(); console.log('\nFAILED - ' + failures + ' check(s)'); process.exit(1);
  }
  ok('the standing exclusion is loaded, so the checks below are measured against it');

  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('ledger'); });
  for (let i = 0; i < 120 && !(await p.evaluate(() => window.TXN && TXN.rows && TXN.rows.length >= 4)); i++) await p.waitForTimeout(250);
  await p.waitForTimeout(1500);

  /* what the tab actually counted, read from the same array the export is built from */
  const seen = await p.evaluate(() => {
    const live = (typeof txnLive === 'function') ? txnLive() : (TXN.rows || []);
    return {
      loaded: (TXN.rows || []).map((r) => r.transaction_ref),
      live: live.map((r) => r.transaction_ref),
      csv: ((TXN._csvRows) || []).map((r) => r.transaction_ref),
      revenue: live.filter((r) => (typeof txnConfirmed === 'function') ? txnConfirmed(r) : true).reduce((s, r) => s + (+r.amount_sar || 0), 0),
    };
  });

  if (seen.loaded.length >= 4) ok(`all four fixture transactions reached the app (${seen.loaded.join(', ')}), so what follows is about the filter and not about the load`);
  else fail(`only ${seen.loaded.length} of 4 fixture transaction(s) loaded (${seen.loaded.join(', ')}) — the checks below would pass by having nothing to exclude`);

  /* 4 — the control first */
  if (seen.live.includes('TXN-OK-1') && seen.revenue >= 1000) ok(`control: the ordinary client's transaction is counted (confirmed revenue ${seen.revenue.toLocaleString('en-US')} SAR includes its 1,000)`);
  else fail(`control: the ordinary client's transaction is NOT counted (live=${JSON.stringify(seen.live)}, revenue=${seen.revenue}) — every check below would pass on a tab that shows nothing`);

  /* 1 + 3 — the two excluded rows */
  const byName = seen.live.includes('TXN-EXCL-NAME');
  const byId = seen.live.includes('TXN-EXCL-ID');
  if (!byName) ok(`a transaction on "${EXCLUDED_NAME}" — the standing exclusion, by name — is held out of the Transactions totals`);
  else fail(`a transaction belonging to "${EXCLUDED_NAME}" is counted in the Transactions tab: confirmed revenue reads ${seen.revenue.toLocaleString('en-US')} SAR and 500,000 of it is the excluded client's. js/16's own header says a standing exclusion must hold no matter how a row arrived — live() re-checks it for invoices on every call, and txnLive() does not check it at all.`);

  const byNameOnly = seen.live.includes('TXN-EXCL-NAMEONLY');
  if (!byNameOnly) ok('a transaction on the excluded company with NO client profile at all is held out by the name test — the half the ID bridge cannot cover');
  else fail(`a transaction on "${EXCLUDED_NAME}" with no client profile is counted (${seen.revenue.toLocaleString('en-US')} SAR total). The ID bridge cannot see a row with no profile, so the company-name test is the only thing standing between an excluded client and the totals here.`);

  if (!byId) ok('a transaction whose company is spelled differently but whose profile carries the excluded client ID is held out too — the ID bridge holds where the name would miss');
  else fail(`a transaction is counted whose company name does not match the exclusion list but whose client profile carries direct_client_id "7", the excluded client's own ID (${seen.revenue.toLocaleString('en-US')} SAR total). A rename or a second spelling should not be enough to bring an excluded client's money back.`);

  /* 2 — and the file that leaves the building */
  await p.evaluate(() => { try { window.finTxnCSV(); } catch (_) { } });
  await p.waitForTimeout(1200);
  const csvRefs = await p.evaluate(() => ((window.TXN && TXN._csvRows) || []).map((r) => r.transaction_ref));
  const leaked = csvRefs.filter((r) => /EXCL/.test(String(r)));
  if (!leaked.length && csvRefs.includes('TXN-OK-1')) ok(`the exported file carries the ordinary transaction and neither excluded one (${JSON.stringify(csvRefs)})`);
  else if (!csvRefs.includes('TXN-OK-1')) fail(`the export carries no ordinary transaction at all (${JSON.stringify(csvRefs)}) — it cannot show a leak either, so this check proved nothing`);
  else fail(`the export written for the owner to send onward contains ${leaked.length} excluded transaction(s): ${JSON.stringify(leaked)}. This is a file that leaves the building, not a number on a screen.`);

  await b.close(); srv.close();
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
