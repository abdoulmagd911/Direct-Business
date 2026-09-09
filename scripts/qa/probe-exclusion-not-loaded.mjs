/* probe-exclusion-not-loaded.mjs (2026-09-07, watch cycle 41; REWRITTEN cycle 42) — a write
   must never happen against an exclusion list nobody could read. Attack area (nn).

   CYCLE 41's VERSION OF THIS PROBE PASSED WHILE THE GUARD IT TESTED COULD NOT FIRE. It emptied
   DB.settings by hand to mean "the list has not loaded", and asserted that the commit refused.
   It did. But the running app is never in that state: js/09's ensureFunnel() writes funnels and
   funnelSubs at load and the app sets lang and currency for itself, so with the app_settings
   response held back 25 seconds the measurement is

       DB.settings keys  ["lang","currency","funnels","funnelSubs"]
       finExclusionsReady()      true
       finExclusionCheck(...)    false

   — the guard reading "loaded" at exactly the moment the list is absent. The probe had built a
   world to suit the guard. probe-importer-scale-attacks writing an excluded client's invoice
   under six-way load is what exposed it.

   So the guard no longer infers. js/62's finExclusionGateRows() READS app_settings and checks
   the rows about to be written against the server's own list, and this probe tests that
   guarantee instead: when the list cannot be read, nothing is written and the person is told.
   Fail-closed, not fail-open, and no page state is trusted to answer the question.

   Under test:
     1. Control — with the list readable, an excluded client's row is held back and an ordinary
        row still imports. (If this fails, nothing below means anything.)
     2. THE GATE — with the app_settings read failing at commit time, the commit writes NOTHING.
     3. The refusal says why, rather than being a silent no-op.
     4. It fails closed on a read that never answers, not only on one that errors.

   Run:  node scripts/qa/probe-exclusion-not-loaded.mjs        (port 8720)
   Sabotage: make finExclusionGateRows call back with null on a read error — checks 2 and 3 go
   red with the batch written. Restore byte-identical (md5).                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start, settingsLoaded } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8720;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const EXCLUDED = 'Takamol for Business Services';   // the mock seed's own standing exclusion
const srv = start(PORT, { finance_invoices: [] });
const BREAK = { settings: false, mode: 'error' };
const BASE = 'http://localhost:' + PORT;

/* The real Direct Payments invoice-export signature. Cycle 28's lesson: invented column names
   make the importer answer "not recognized", no preview runs, and a check then passes having
   exercised nothing. */
const HEAD = 'Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman';
const csvFor = (n) => [HEAD,
  'invoice,Direct Flights,' + EXCLUDED + ',REF-X' + n + ',XL-' + n + '1,05/08/2026 10:00:00 AM,Fully Paid,,,,,500000,Riyadh,QA',
  'item,Direct Flights,' + EXCLUDED + ',REF-X' + n + ',,,,Excluded partner work,No,0,500000,,,',
  'invoice,Direct Hotels,Ordinary Client Co,REF-O' + n + ',OK-' + n + '2,06/08/2026 10:00:00 AM,Fully Paid,,,,,1000,Riyadh,QA',
  'item,Direct Hotels,Ordinary Client Co,REF-O' + n + ',,,,Ordinary work,No,0,1000,,,'
].join('\n');

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    /* switched on AFTER boot, so the app loads normally and only the commit-time read fails —
       otherwise the control below would be measuring an app that never had a list at all */
    if (BREAK.settings && /app_settings/.test(u.pathname + u.search)) {
      if (BREAK.mode === 'hang') { await new Promise((x) => setTimeout(x, 40000)); }
      await r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"deliberate failure (probe)"}' });
      return;
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  /* 2026-09-07 (cycle 42): was a flat 2500 ms, and twice in three runs the login fields were not
     there yet — the control then failed with preview="dropped" (v65Ingest undefined), which is a
     probe reporting the machine. index.html loads 68 blocking scripts; wait for the form. */
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  /* synchronise on the importer being present rather than on a stopwatch. Deliberately NOT an
     assertion: v65Ingest is defined as the Finance layer evaluates, so a timeout here does not
     by itself mean the run is worthless — check 1 below is the honest guard, and it fails with
     the preview and the alerts in hand. */
  try { await p.waitForFunction(() => typeof window.v65Ingest === 'function', { timeout: 90000 }); } catch (_) { }
  if (!(await settingsLoaded(p, 90000, () => { try { return !!(typeof finExclusionCheck === 'function' && finExclusionCheck('Takamol for Business Services')); } catch (_) { return false; } })))
    fail('the exclusion list never arrived — this probe is entirely about what happens with and without it, so it cannot run. ' + (settingsLoaded.lastWhy || ''));
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1200);

  const invoicesInDb = async () => (await fetch(BASE + '/rest/v1/finance_invoices?select=invoice_no,client_group,total_incl_vat_sar').then((r) => r.json())) || [];

  /* drive the importer the way the page does: ingest the file, then press Confirm */
  const runImport = async (csv, breakRead) => {
    await p.evaluate(() => { try { if (typeof window.finGo === 'function') window.finGo('import'); } catch (_) { } });
    await p.waitForTimeout(800);
    const preview = await p.evaluate(async (text) => {
      const f = new File([text], 'aug.csv', { type: 'text/csv' });
      if (typeof window.v65Ingest === 'function') { await window.v65Ingest([f]); return 'ingested'; }
      const dz = document.getElementById('finDrop');
      if (dz) { const dt = new DataTransfer(); dt.items.add(f); dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true })); return 'dropped'; }
      return 'no entry point';
    }, csv);
    await p.waitForTimeout(3500);
    let alerted = null;
    await p.evaluate(() => { window.__alerts = []; const oa = window.alert; window.alert = (m) => { window.__alerts.push(String(m)); }; window.__restoreAlert = () => { window.alert = oa; }; });
    BREAK.settings = !!breakRead;
    await p.evaluate(() => { try { if (typeof window.v65Commit === 'function') window.v65Commit(); } catch (e) { window.__alerts.push('THREW ' + e.message); } });
    await p.waitForTimeout(4000);
    alerted = await p.evaluate(() => { try { window.__restoreAlert(); } catch (_) { } return window.__alerts || []; });
    const done = await p.evaluate(() => { const el = document.getElementById('finImpOut'); return el ? el.innerText : ''; });
    BREAK.settings = false;
    return { preview, alerted, done };
  };

  /* ---- 1. control: list loaded ---- */
  const before1 = await invoicesInDb();
  const r1 = await runImport(csvFor(1), false);
  const after1 = await invoicesInDb();
  const wrote1 = after1.filter((x) => !before1.some((y) => y.invoice_no === x.invoice_no));
  const excl1 = wrote1.filter((x) => /takamol/i.test((x.client_group || '')));
  if (wrote1.length && !excl1.length)
    ok(`control: with the list loaded the import writes ${wrote1.length} row(s) and the excluded client is held back — so the gate below is being measured against a working importer`);
  else if (excl1.length) fail(`control: the excluded client was written even with the list loaded (${JSON.stringify(excl1)}) — a defect this probe was not written for, but a worse one`);
  else fail(`control: nothing was written at all with the list loaded — the importer did not run, so nothing below can be concluded. preview=${JSON.stringify(r1.preview)} alerts=${JSON.stringify(r1.alerted)}`);

  /* ---- 2 + 3. the gate: list unknown ---- */
  const before2 = await invoicesInDb();
  const r2 = await runImport(csvFor(2), true);
  const after2 = await invoicesInDb();
  const wrote2 = after2.filter((x) => !before2.some((y) => y.invoice_no === x.invoice_no));
  if (!wrote2.length)
    ok('with the exclusion list UNREADABLE (the app_settings read fails at commit time) the commit writes nothing at all — it fails closed rather than importing a batch it could not check');
  else fail(`with the exclusion list unknown the commit wrote ${wrote2.length} row(s): ${JSON.stringify(wrote2.map((x) => x.invoice_no + ' / ' + x.client_group))}. finExclusionCheck() answers the same null for "not on the list" and "no list yet", so every excluded client in the batch read as ordinary — the Takamol incident by a different road, and this time into the database.`);

  const said = ((r2.alerted || []).join(' | ') + ' ' + (r2.done || '')).trim();
  if (/exclusion list|قائمة الاستبعاد/i.test(said) && /nothing was written|لم يُكتب/i.test(said))
    ok('…and it says why, naming the exclusion list and stating that nothing was written — a refusal a person can act on, not a silent no-op');
  else fail(`the commit refused but did not explain itself. It said: ${JSON.stringify(said.slice(0, 300))}`);

  /* ---- 4. fails closed on a read that never answers, not only on one that errors ---- */
  /* An error has an obvious code path. A read that simply never comes back is the one that
     quietly proceeds, because nothing ever calls the callback — which is why the gate carries
     its own timeout rather than trusting the network to fail politely. */
  BREAK.mode = 'hang';
  const before3 = await invoicesInDb();
  const r3 = await runImport(csvFor(3), true);
  /* the gate gives the read 20 s before refusing; a probe that looks after 4 s would read
     "nothing written" from a commit that simply had not got there yet — sabotage proved exactly
     that, passing this check while the guard was disabled. Outlast the timeout, then look. */
  await p.waitForTimeout(26000);
  BREAK.mode = 'error';
  const after3 = await invoicesInDb();
  const wrote3 = after3.filter((x) => !before3.some((y) => y.invoice_no === x.invoice_no));
  if (!wrote3.length) ok('a read that never answers is refused too — the gate times out and writes nothing, rather than waiting forever or falling through');
  else fail(`the commit wrote ${wrote3.length} row(s) while the exclusion-list read was still hanging: ${JSON.stringify(wrote3.map((x) => x.invoice_no + ' / ' + x.client_group))}`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexclusion-not-loaded OK — a write refuses, and says why, whenever the standing exclusion list cannot be read');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
