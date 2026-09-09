/* probe-exclusion-unchecked-surfaces.mjs (2026-09-09, watch cycle 73) — cycle 43's rule, applied
   to the tabs cycle 43 did not visit. Attack area (nn).

   Cycle 43 gave the Clients tab a refusal while the exclusion list is still outstanding, and the
   reason it gave was general: "a display may degrade to 'not checked yet'; it may not present
   money the owner ruled out as somebody's revenue." Nothing else in js/16 mentioned the list.
   probe-exclusion-display-attacks holds the Clients tab and the alias picker. Nothing held the
   other two money tabs.

   Measured before anything was changed, with the app_settings response held back 4 seconds, one
   ordinary client at 100,000 SAR beside a standing-excluded partner at 900,000:

     Overview   shows 1,000,000 — ten times the truth — says nothing, corrects itself silently
     Reports    shows 1,000,000 AND NAMES the excluded partner in its table, says nothing
     Clients    refuses, in words                                            (cycle 43)
     Ledger     reads finance_transactions, a different source — outside this finding either way

   The fixture is 90% excluded on purpose. The real case behind the rule was Takamol: 6.7M SAR,
   77% of displayed revenue. At that share a wrong total cannot be mistaken for rounding, and the
   two figures (1,000,000 and 100,000) cannot be confused with each other on screen.

   THE TWO TABS ARE HELD TO DIFFERENT STANDARDS, ON PURPOSE, AND THIS PROBE ENCODES BOTH.
   Reports must refuse: it groups BY CLIENT by default, so it attributes the money to a named
   partner, which is the fault cycle 43 forbade. The Overview must NOT blank: it names no one, it
   is the landing tab, and exclLoad() gives up after five tries — so finExclusionsKnown() can be
   false permanently in a workspace whose app_settings never answers, and a permanently blank
   Finance page is a worse bargain than a permanently caveated one. It must say so instead, and
   say it ABOVE the figures: a caveat read after the number is read after the number is believed.

   Under test:
     1. Control — with the list loaded, all three tabs show the correct 100,000, name nobody, and
        carry no notice. Otherwise every refusal below passes for the wrong reason.
     2. THE ATTACK — with the list outstanding, Reports neither names the excluded partner nor
        prints its money. This is the load-bearing check.
     3. And it says why, rather than going quietly blank.
     4. The Overview keeps its figures and says they are unchecked, with the notice ABOVE the
        first money card, not under it.
     5. The Clients tab still refuses — a regression guard on cycle 43.
     6. When the list lands, all three show the correct 100,000 and the notice is gone: the
        refusal is a moment, not a state.

   Run:  node scripts/qa/probe-exclusion-unchecked-surfaces.mjs        (port 8740)
   Sabotage: make rReports' gate unable to fire (`if(false&&…`) — checks 2 and 3 go red and
   nothing else does, because the Overview and Clients have their own gates. Restore
   byte-identical (md5) and confirm by grepping for the marker, not only by hash (cycle 44).  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8740;
const HOLD_MS = 30000;   /* long enough to read three tabs unhurried; the app re-renders on arrival */
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
  /* seeded through the app's own settings blob, never written into the page by hand — cycle 42's
     lesson: a fixture written before js/35 merges the blob is silently replaced by the server's */
  __settings: { financeExclusions: [{ id: 'fx-c73', clientId: 'c73', matchNames: ['Excluded Partner Co'], reason: 'QA fixture — standing exclusion', addedBy: 'probe', addedAt: '2026-01-01T00:00:00Z' }] },
});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  let hold = true, held = 0;
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    /* Hold the app_settings ANSWER back rather than emptying DB.settings by hand — cycle 42
       established that a hand-built state proves a guard that cannot fire in the running app. */
    if (hold && /app_settings/.test(u.pathname) && rq.method() === 'GET') { held++; await new Promise((s) => setTimeout(s, HOLD_MS)); }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  const boot = async () => {
    await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
    /* The second boot reuses the context, so the session is already in storage and the login form
       never appears — waiting 60 s for it and then throwing is how the first run of this probe
       died after passing all three of its controls. Sign in when there is a form to sign in with,
       and otherwise carry on; the page still reloads and still re-requests app_settings, which is
       the only thing this probe needs from the boot. */
    try {
      await p.waitForSelector('#cl_email', { timeout: 8000 });
      await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    } catch (_) { /* already signed in */ }
    await p.waitForFunction(() => window.FIN && FIN.rows && FIN.rows.length, { timeout: 90000 });
    await p.evaluate(() => { current = 'finance'; if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; });
  };
  /* Read the SCREEN, not the model: what a person meets on the tab, including where the notice
     sits relative to the first money card (cycle 63's rule, which caught cycle 71's own probe). */
  const read = (tab) => p.evaluate((t) => {
    finGo(t);
    const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
    const el = document.getElementById('ov-unchecked');
    let noticeAboveFigures = null;
    if (el) {
      const kpi = Array.prototype.find.call(document.querySelectorAll('h3'), (h) => /Key indicators|مؤشرات الأداء/.test(h.textContent || ''));
      noticeAboveFigures = kpi ? (el.getBoundingClientRect().top < kpi.getBoundingClientRect().top) : null;
    }
    return {
      known: (typeof window.finExclusionsKnown === 'function') ? window.finExclusionsKnown() : null,
      /* Both forms, because the tabs print money differently and a probe that knows only one of
         them reports a correct screen as empty: the Overview's cards go through moneyS() and read
         "1.00M" and "100.0K", while the Reports table uses money0() and reads "1,000,000" and
         "100,000". The first run of this probe knew only the long form and failed its own control
         on the Overview. Neither pattern is a substring of the other, and "100,000" is not a
         substring of "1,000,000" — the commas fall differently — so the two cannot be confused. */
      inflated: /1,000,000|1\.00M/.test(txt),
      correct: /100,000|100\.0K/.test(txt),
      namesExcluded: /Excluded Partner Co/.test(txt),
      excludedMoney: /900,000|900\.0K/.test(txt),
      saysUnchecked: /Not checked yet|has not finished loading|لم تُفحص بعد/.test(txt),
      hasNotice: !!el,
      noticeAboveFigures,
    };
  }, tab);

  /* ---------- 1. control: the list loaded, everything correct and nothing caveated ---------- */
  hold = false;
  await boot();
  await p.waitForFunction(() => typeof window.finExclusionsKnown === 'function' && window.finExclusionsKnown(), { timeout: 60000 });
  let ctlBad = 0;
  for (const tab of ['overview', 'reports', 'clients']) {
    const s = await read(tab);
    if (!s.correct || s.inflated || s.namesExcluded || s.excludedMoney || s.saysUnchecked) {
      ctlBad++;
      fail(`control: with the exclusion list loaded, ${tab} should show the ordinary client's 100,000 alone and say nothing about checking — it showed correct=${s.correct} inflated=${s.inflated} names-the-partner=${s.namesExcluded} its-900,000=${s.excludedMoney} caveat=${s.saysUnchecked}. Every refusal below would pass for the wrong reason`);
    } else ok(`control: with the list loaded, ${tab} shows 100,000, names no excluded partner, and carries no caveat`);
  }
  if (ctlBad) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); await b.close(); srv.close(); process.exit(1); }

  /* ---------- 2-5. the window ---------- */
  hold = true;
  await boot();
  const st = await p.evaluate(() => (typeof window.finExclusionsKnown === 'function') ? window.finExclusionsKnown() : null);
  note(`app_settings held back ${HOLD_MS} ms (${held} request(s) held so far) · finExclusionsKnown() ${st}`);
  if (st === false) ok('control: the exclusion list really is outstanding, so what follows is about what each tab does with a question it cannot answer');
  else { fail(`control: finExclusionsKnown() is ${st} with the settings response held back — the window is not open and nothing below is tested`); console.log(`\nFAILED — ${failures} check(s) did not pass.`); await b.close(); srv.close(); process.exit(1); }

  const rep = await read('reports');
  if (!rep.namesExcluded && !rep.excludedMoney)
    ok('Reports names no excluded partner and prints none of its money while the list is outstanding');
  else
    fail(`Reports put the excluded partner on screen while the exclusion list was still outstanding — named=${rep.namesExcluded}, its 900,000 printed=${rep.excludedMoney}. The Report Builder groups by client by default, so this is money the owner ruled out, attributed by name to a partner, on a tab that can be exported`);
  if (rep.saysUnchecked)
    ok('and Reports says why rather than going quietly blank — a report that vanishes with no explanation reads as a broken tab');
  else
    fail('Reports said nothing about the exclusion list not having loaded — so either it withheld the report with no explanation, which is indistinguishable from a tab that failed to load, or it built one from figures it could not check and let them stand unqualified');

  const ov = await read('overview');
  if (ov.hasNotice && ov.saysUnchecked && ov.inflated && ov.noticeAboveFigures === true)
    ok('the Overview keeps its figures and says, above them, that they are not checked yet — it names nobody, and it is the landing tab, so blanking it would hide the page behind a caveat (exclLoad gives up after five tries, so this state can be permanent)');
  else if (!ov.hasNotice)
    fail(`the Overview showed its figures with nothing said (inflated 1,000,000 on screen: ${ov.inflated}). It is the tab everyone lands on and the number people quote, and it corrects itself silently a moment later, so nobody who read it ever learns it was wrong`);
  else if (ov.noticeAboveFigures !== true)
    fail(`the Overview's caveat is not above the figures it qualifies (position check: ${ov.noticeAboveFigures}). A caveat read after the number is read after the number is believed`);
  else
    fail(`the Overview's notice is present but the tab is not in the state described: notice=${ov.hasNotice} caveat-words=${ov.saysUnchecked} inflated-figure-still-shown=${ov.inflated}`);

  const cl = await read('clients');
  if (cl.saysUnchecked && !cl.namesExcluded && !cl.excludedMoney)
    ok('and the Clients tab still refuses in words — cycle 43 holds');
  else
    fail(`the Clients tab no longer refuses while the list is outstanding: caveat=${cl.saysUnchecked} named=${cl.namesExcluded} its-900,000=${cl.excludedMoney}. Cycle 43's guard has been lost`);

  /* ---------- 6. and it is a moment, not a state ---------- */
  await p.waitForFunction(() => typeof window.finExclusionsKnown === 'function' && window.finExclusionsKnown(), { timeout: HOLD_MS + 30000 });
  await p.waitForTimeout(400);
  let after = 0;
  for (const tab of ['overview', 'reports', 'clients']) {
    const s = await read(tab);
    if (s.correct && !s.inflated && !s.namesExcluded && !s.saysUnchecked) continue;
    after++;
    fail(`after the exclusion list arrived, ${tab} did not come back to the right answer: correct=${s.correct} inflated=${s.inflated} named=${s.namesExcluded} caveat-still-showing=${s.saysUnchecked}. A refusal that does not lift is an outage`);
  }
  if (!after) ok('once the list lands, all three tabs show 100,000 with no caveat — the refusal is a moment, not a state');

  if (errors.length) note(`page errors seen: ${errors.slice(0, 3).join(' ; ')}`);
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexclusion-unchecked-surfaces OK — no Finance tab presents an excluded partner while the list that defines it is still outstanding');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) {} process.exit(1); });
