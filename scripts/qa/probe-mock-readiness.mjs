/* probe-mock-readiness.mjs (2026-09-08, watch cycle 67) — the readiness signal, held to its
   promises. Attack area (ak).

   PORT NOTE: 8701–8736 are taken. This is 8737, verified free by scanning every PORT= in
   scripts/qa.

   Cycle 58 wrote the condition for building this and refused to build it until the condition was
   met: not until a probe repeatedly fails on data that had not arrived. It took until cycle 66.
   probe-alias-dedupe-attacks starved on app_settings in cycles 57 AND 66 with the same sentence
   both times; probe-importer-scale-attacks and probe-exclusion-not-loaded starved on the same
   table once each. sweep-buttons repeated too and was NOT this — its own navigation race, fixed
   in cycle 64 — which is why the rule asked for the same cause twice rather than any two reds.

   The machinery is small and its danger is obvious, so this probe is mostly about the danger.
   A readiness signal that says "ready" when the app has nothing is worse than a timeout: the
   probes that starve are the ones guarding the exclusion list, and their whole job is to refuse
   to conclude from an empty object. Serving a request is a fact about the WIRE. Whether js/02
   assigned it to DB.settings is a fact about the PAGE. wait-ready.mjs keeps those apart; this
   holds it to that.

   Under test:
     1. Control — the counter rises for a table the app really reads, and waitServed() returns ok.
     2. THE PROPERTY THAT MATTERS — on timeout waitServed() returns ok:false. It must never
        resolve true because it ran out of patience.
     3. It says WHICH of the two things went wrong: a table nobody asked for reads as "never
        requested at all", not as a slow answer. That distinction is the reason this exists.
     4. It is per-table: heavy traffic to another table does not satisfy a wait on app_settings.
     5. SERVING IS NOT PROOF — waitReady() with a page condition that is never true fails at the
        'app' stage and says the answer arrived and the app did not use it. A probe can never pass
        on the strength of the wire alone.

   Run:  node scripts/qa/probe-mock-readiness.mjs        (port 8737)
   Sabotage: make waitServed() return ok:true on timeout — checks 2, 3 and 5 go red. Assert the
   sabotage APPLIED **and that the checks actually turn red** (cycle 66: a marker that is present
   but inert proves nothing); confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start, settingsLoaded } from './mock-supabase.mjs';
import { waitServed, waitReady } from './wait-ready.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8737;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);

const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
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

  /* Before the app has loaded, nothing has been served — the baseline the counter is measured
     from, and the state in which "never asked" must be distinguishable. */
  const before = await (await fetch(BASE + '/__mock/served')).json();
  if (!before || !Object.keys(before).length) note('baseline: nothing served yet');
  else note('baseline already holds: ' + Object.keys(before).join(', '));

  /* ---- 3, first half: a table nobody has asked for reads as never asked ---- */
  const never = await waitServed(BASE, 'a_table_no_page_reads', { timeoutMs: 1200 });
  if (!never.ok && /never requested at all/.test(never.why || ''))
    ok(`a table nobody asked for is reported as never requested, not as a slow answer: "${never.why}"`);
  else
    fail(`a table nobody asked for did not read as never-requested (${JSON.stringify(never)}). Telling a slow answer apart from a request that was never made is the reason this signal exists — without it a probe can only say "it never arrived" and cannot say why.`);

  /* ---- 6 (added cycle 68): the shared helper adopted the signal, and reports which half ----
     settingsLoaded() is what seven probes already wait on — including probe-alias-dedupe-attacks,
     which starved twice, and probe-expense-report-capture, which starved once. Cycle 68 put the
     wire check inside it rather than copying it into each caller, so all seven gained the
     diagnosis without being edited. Called here before the page has loaded anything, so
     app_settings genuinely has not been requested: the helper must say so quickly instead of
     spending its whole budget waiting on a page that was never going to receive it. */
  const beforeLoad = await settingsLoaded(p, 1500);
  if (beforeLoad === false && /never requested at all/.test(settingsLoaded.lastWhy || ''))
    ok(`the shared settingsLoaded() helper now names the half that failed: "${settingsLoaded.lastWhy}"`);
  else
    fail(`settingsLoaded did not report the wire half (returned ${beforeLoad}, lastWhy ${JSON.stringify(settingsLoaded.lastWhy)}). Seven probes wait on this helper and three of them have starved here; without the distinction they can only say "never arrived" and cannot say whether the app ever asked.`);

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }

  /* ---- 1. control ---- */
  const served = await waitServed(BASE, 'app_settings', { timeoutMs: 60000 });
  note(`app_settings: ${JSON.stringify(served.served)} after ${served.waitedMs}ms`);
  if (served.ok && served.served && served.served.reads >= 1)
    ok(`control: waiting on the fact rather than a timeout — app_settings was answered ${served.served.reads} time(s), known after ${served.waitedMs}ms`);
  else
    fail(`control: app_settings was never reported as served (${JSON.stringify(served)}) — the counter is not recording the one table this whole cycle is about, so nothing below means anything`);

  /* ---- 2. the property that matters: a timeout is never a pass ---- */
  const impossible = await waitServed(BASE, 'app_settings', { min: 100000, timeoutMs: 1200 });
  if (impossible.ok === false)
    ok('asking for more than can be true returns ok:false — running out of patience is never reported as readiness');
  else
    fail(`waitServed returned ok:true after failing to reach its own threshold (${JSON.stringify(impossible)}). A waiter that resolves true on timeout is worse than no waiter: every probe that adopts it starts passing on data it never got.`);

  /* ---- 3, second half: an under-count says how far it got ---- */
  if (impossible.why && /fewer than the/.test(impossible.why))
    ok(`an under-count says how far it actually got: "${impossible.why}"`);
  else
    fail(`the under-count case gave no usable reason (${JSON.stringify(impossible.why)})`);

  /* ---- 4. per-table ---- */
  const other = await waitServed(BASE, 'finance_invoices', { timeoutMs: 20000 });
  const mixed = await waitServed(BASE, 'a_second_table_nobody_reads', { timeoutMs: 1200 });
  if (other.ok && !mixed.ok)
    ok('the counter is per-table: finance_invoices being busy does not satisfy a wait on a table nobody read');
  else
    fail(`the counter is not per-table (finance_invoices ${JSON.stringify(other.ok)}, unread table ${JSON.stringify(mixed.ok)}). A signal that any traffic satisfies would let a probe proceed on the wrong table's data.`);

  /* ---- 5. SERVING IS NOT PROOF ---- */
  const notInApp = await waitReady(BASE, p, 'app_settings', () => window.__a_value_the_app_will_never_set === 42, { timeoutMs: 2000, what: 'a value the app never sets' });
  if (!notInApp.ok && notInApp.stage === 'app' && /did not use it/.test(notInApp.why || ''))
    ok(`the wire carrying the data is not proof the app has it: "${notInApp.why}"`);
  else
    fail(`waitReady did not separate the wire from the page (${JSON.stringify(notInApp)}). This is the failure mode that matters: the probes that starve are the ones guarding the exclusion list, and their whole job is to refuse to conclude from an empty object. A helper that treated "served" as "ready" would hand them exactly that.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nmock-readiness OK — a probe can wait on a fact, is told which fact failed, and can never pass on the wire alone');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
