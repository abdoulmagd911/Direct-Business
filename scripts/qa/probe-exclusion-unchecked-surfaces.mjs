/* probe-exclusion-unchecked-surfaces.mjs (2026-09-09, watch cycle 73; REWRITTEN for E, 2026-09-27) — no
   Finance tab may present money the rules leave out while the thing that applies the rules has not
   answered. Attack area (nn).

   E (2026-09-27, DECISIONS D16): until E the rules were js/62's name list in the app_settings blob,
   applied in the page, so there was a real window — blob outstanding, rows loaded — in which the
   Overview printed 1,000,000 for a 100,000 truth and Reports named the excluded partner; this probe
   held each tab to its own answer for that window (Reports refuses, Overview caveats above the
   figures, Clients refuses). Under E the rules are typed rows (money_exclusion_rules) applied by the
   database view money_rows, and js/16 does not set FIN.rows until the rows AND the view have both
   answered. So the window is now "the view is outstanding", and the right behaviour is simpler and
   stricter: every tab waits — nothing is shown, so nothing can be wrong — and says it is loading.
   The page's own copy of the rules (MR.rules, what finExclusionsKnown() now reports) no longer
   decides any total; a second window holds THAT back and requires every tab to be right anyway.

   The fixture stays 90% excluded on purpose (the real case behind the rule was 77% of revenue): one
   ordinary client at 100,000 SAR beside an excluded partner at 900,000, excluded by a typed name rule
   (converted by the harness from the probe's settings seed).

   Under test:
     1. Control — with everything answered, Overview, Reports and Clients show the correct 100,000,
        name nobody excluded, print none of its 900,000, and carry no caveat.
     2. THE ATTACK — with the money_rows answer held back, none of the three tabs names the excluded
        partner or prints its money (or the inflated 1,000,000) …
     3. … and each says it is loading rather than going quietly blank or showing a zero.
     4. When the view answers, all three show 100,000 — the wait is a moment, not a state.
     5. With the page's copy of the RULES held back instead (finExclusionsKnown() false): no tab
        shows excluded money (hard), and — since that copy decides no total any more — every tab
        is already right with no "list not loaded" caveat (the old js/16 gates keyed on it).

   Run:  node scripts/qa/probe-exclusion-unchecked-surfaces.mjs        (port 8740)
   Sabotage: SABOTAGE=1 serves js/16 to the browser setting FIN.rows as soon as the invoices arrive
   (before the view) — check 2 goes red with the 1,000,000 and the partner on screen.            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8740;
const HOLD_MS = 30000;   /* long enough to read three tabs unhurried; released early by setting hold = null */
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);

const inv = (o) => Object.assign({
  line_no: 1, invoice_date: '2026-05-04', year: 2026, month: 'May', quarter: 'Q2',
  products: 'Flights', service_type: 'Flights', record_type: 'b2b', vat_sar: 0,
  wallet_portion_sar: 0, amount_remaining_sar: 0, integrity_status: 'verified_paid',
  revenue_way: 'invoice', source_batch: 'c73-qa', deleted_at: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}, o);
const SEED = [
  inv({ id: 'c73-a', invoice_no: 'C73-A', client_group: 'Ordinary Co', customer_raw_name: 'Ordinary Co', total_incl_vat_sar: 100000, revenue_sar: 100000, cost_sar: 40000, profit_sar: 60000, amount_received_sar: 100000 }),
  inv({ id: 'c73-x', invoice_no: 'C73-X', client_group: 'Excluded Partner Co', customer_raw_name: 'Excluded Partner Co', total_incl_vat_sar: 900000, revenue_sar: 900000, cost_sar: 300000, profit_sar: 600000, amount_received_sar: 900000 }),
];
const srv = start(PORT, {
  finance_invoices: SEED, finance_transactions: [], finance_targets: [], finance_client_links: [], client_profiles: [],
  /* seeded through start(), never written into the page by hand — the harness turns this old-style entry into typed
     rules (a name rule for 'Excluded Partner Co', a client-ID rule for 'c73'), the way a person would now enter it */
  __settings: { financeExclusions: [{ id: 'fx-c73', clientId: 'c73', matchNames: ['Excluded Partner Co'], reason: 'QA fixture — standing exclusion', addedBy: 'probe', addedAt: '2026-01-01T00:00:00Z' }] },
});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  /* HOLD: which answer is held back — 'view' (money_rows) or 'rules' (money_exclusion_rules, the page's copy) */
  let hold = null, held = 0;
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    const isView = /\/money_rows/.test(u.pathname), isRules = /\/money_exclusion_rules/.test(u.pathname);
    if (rq.method() === 'GET' && ((hold === 'view' && isView) || (hold === 'rules' && isRules))) {
      held++; const t0 = Date.now(); while (hold && Date.now() - t0 < HOLD_MS) await new Promise((s) => setTimeout(s, 200));
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());
  if (process.env.SABOTAGE) await p.route((u) => u.pathname === '/js/16-finance-ledger.js', async (r) => {
    const src = fs.readFileSync(new URL('../../js/16-finance-ledger.js', import.meta.url), 'utf8');
    const cut = src.replace("var got=r;", "var got=r; if(!got.error){ FIN.rows=got.data||[]; FIN.m={}; FIN.loading=false; try{ if(current==='finance')render(); }catch(_){} }");
    if (cut === src) console.log('  ! sabotage did not apply — the line moved');
    await r.fulfill({ status: 200, contentType: 'application/javascript', body: cut });
  });

  const boot = async (waitRows) => {
    await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
    try {
      await p.waitForSelector('#cl_email', { timeout: 8000 });
      await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    } catch (_) { /* already signed in */ }
    if (waitRows) await p.waitForFunction(() => window.FIN && FIN.rows && FIN.rows.length, null, { timeout: 90000 });
    else await p.waitForFunction(() => typeof window.finGo === 'function' && window.FIN, null, { timeout: 90000 });
    await p.evaluate(() => { current = 'finance'; if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; });
  };
  /* Read the SCREEN, not the model. Both money forms: the Overview's cards read "1.00M" / "100.0K", the Reports table
     "1,000,000" / "100,000"; neither pattern is a substring of the other. */
  const read = (tab) => p.evaluate((t) => {
    finGo(t);
    const v = document.getElementById('view');
    const txt = ((v && v.innerText) || '').replace(/\s+/g, ' ');
    return {
      known: (typeof window.finExclusionsKnown === 'function') ? window.finExclusionsKnown() : null,
      rowsNull: !(window.FIN && FIN.rows),
      inflated: /1,000,000|1\.00M/.test(txt),
      correct: /100,000|100\.0K/.test(txt),
      namesExcluded: /Excluded Partner Co/.test(txt),
      excludedMoney: /900,000|900\.0K/.test(txt),
      saysLoading: /Loading|جاري التحميل|جارٍ تحميل|جاري تحميل/.test(txt),
      saysUnchecked: /Not checked yet|has not finished loading|لم تُفحص بعد|could not be applied/.test(txt),
    };
  }, tab);
  const TABS = ['overview', 'reports', 'clients'];

  /* ---------- 1. control ---------- */
  hold = null;
  await boot(true);
  let ctlBad = 0;
  for (const tab of TABS) {
    const s = await read(tab);
    if (!s.correct || s.inflated || s.namesExcluded || s.excludedMoney || s.saysUnchecked) {
      ctlBad++;
      fail(`control: with everything answered, ${tab} should show the ordinary client's 100,000 alone and say nothing about checking — it showed correct=${s.correct} inflated=${s.inflated} names-the-partner=${s.namesExcluded} its-900,000=${s.excludedMoney} caveat=${s.saysUnchecked}. Every check below would pass for the wrong reason`);
    } else ok(`control: ${tab} shows 100,000, names no excluded partner, and carries no caveat`);
  }
  if (ctlBad) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); await b.close(); srv.close(); process.exit(1); }

  /* ---------- 2-4. the view held back ---------- */
  hold = 'view'; held = 0;
  await boot(false);
  const t0 = Date.now(); while (!held && Date.now() - t0 < 60000) await p.waitForTimeout(200);
  await p.waitForTimeout(2500);   // the invoices have long answered; only the view is outstanding
  note(`money_rows held back (${held} request(s) held)`);
  if (!held) { fail('control: the page never asked for the money_rows view — the window is not open and nothing below is tested'); console.log(`\nFAILED — ${failures} check(s) did not pass.`); await b.close(); srv.close(); process.exit(1); }
  for (const tab of TABS) {
    const s = await read(tab);
    if (!s.namesExcluded && !s.excludedMoney && !s.inflated)
      ok(`${tab}: with the view outstanding, names no excluded partner and prints neither its 900,000 nor the inflated 1,000,000`);
    else fail(`${tab} put excluded money on screen while the view that applies the rules had not answered — named=${s.namesExcluded}, its 900,000=${s.excludedMoney}, 1,000,000=${s.inflated} (rows loaded=${!s.rowsNull}). The Tawthiq incident, by a slow answer`);
    if (s.saysLoading || s.saysUnchecked) ok(`${tab}: …and says it is loading, rather than going quietly blank or showing a zero`);
    else fail(`${tab} said nothing while the view was outstanding (correct figure shown=${s.correct}) — a blank or a zero reads as "no money", not as "not ready"`);
  }
  hold = null;
  await p.waitForFunction(() => window.FIN && FIN.rows && FIN.rows.length, null, { timeout: HOLD_MS + 30000 });
  await p.waitForTimeout(400);
  let after = 0;
  for (const tab of TABS) {
    const s = await read(tab);
    if (s.correct && !s.inflated && !s.namesExcluded && !s.saysUnchecked) continue;
    after++;
    fail(`after the view answered, ${tab} did not come back to the right answer: correct=${s.correct} inflated=${s.inflated} named=${s.namesExcluded} caveat=${s.saysUnchecked}. A wait that does not lift is an outage`);
  }
  if (!after) ok('once the view answers, all three tabs show 100,000 with no caveat — the wait is a moment, not a state');

  /* ---------- 5. the page's copy of the rules held back ---------- */
  hold = 'rules'; held = 0;
  await boot(true);
  const st = await p.evaluate(() => (typeof window.finExclusionsKnown === 'function') ? window.finExclusionsKnown() : null);
  note(`money_exclusion_rules held back (${held} request(s) held) · finExclusionsKnown() ${st}`);
  if (st !== false) fail(`control: finExclusionsKnown() is ${st} with the rules held back — this window is not open and check 5 is not tested`);
  else {
    let bad = 0, stale = [];
    for (const tab of TABS) {
      const s = await read(tab);
      if (s.inflated || s.namesExcluded || s.excludedMoney) { bad++; fail(`with only the page's copy of the rules outstanding, ${tab} shows excluded money: inflated=${s.inflated} named=${s.namesExcluded} its-900,000=${s.excludedMoney}`); continue; }
      if (!s.correct || s.saysUnchecked) stale.push(`${tab} (figure shown=${s.correct}, "not loaded" caveat=${s.saysUnchecked})`);
    }
    if (!bad) ok('with the page\'s copy of the rules outstanding (finExclusionsKnown() false), no tab shows the excluded partner or its money');
    if (!stale.length) ok('…and every tab already shows the right 100,000 with no caveat — the rules that decide a total are the database\'s, not the page\'s copy');
    else fail(`with only the page's copy of the rules outstanding — which under E decides no total — these tabs still refuse or caveat on the old "exclusion list has not finished loading" gate: ${stale.join('; ')}. Nothing wrong is shown, but a Finance page that withholds correct figures (permanently, if that read never answers) and tells the reader they "may still include a partner this workspace excludes" is saying something that is no longer true`);
  }
  hold = null;

  if (errors.length) note(`page errors seen: ${errors.slice(0, 3).join(' ; ')}`);
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexclusion-unchecked-surfaces OK — no Finance tab presents an excluded partner while the view that applies the rules is outstanding');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) {} process.exit(1); });
