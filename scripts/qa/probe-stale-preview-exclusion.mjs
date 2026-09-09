/* probe-stale-preview-exclusion.mjs (2026-09-07, watch cycle 42) — the gate cycle 41 added is on
   the WRONG SIDE of the decision. Attack area (oo).

   Cycle 41 made v65Commit refuse while the exclusion list is unknown. It asks whether
   DB.settings is loaded AT COMMIT TIME. But every exclusion decision in the batch was made in
   the PREVIEW — possibly before the app_settings blob landed. Land the blob in between and the
   gate sees a loaded list, waves the batch through, and writes rows that were sorted under no
   list at all.

   This is not hypothetical. probe-importer-attacks went red under six-way battery load in cycle
   41 with exactly this signature — "Excluded by rule count not 3", "exclusion not named in
   preview", "excluded partner row was written" — while being green standalone, green in cycles
   39 and 40, and green standalone with cycle 41's diff in the tree. The excluded partner WAS
   written, so the gate did not fire, so DB.settings was non-empty by the time Confirm ran. The
   preview is where it went wrong.

   THREE VERSIONS OF THIS ATTACK, AND THE THIRD IS THE ONLY HONEST ONE.
   Cycle 42 blinded the preview by emptying DB.settings by hand; cycle 43 gave js/62 its own
   authoritative copy, so that stopped blinding anything. Cycle 43 then held the app_settings
   response back from boot; under six-way load the page had the list anyway — measured, 2
   requests held and the exclusion still known at the moment the file was sorted — and three
   batteries paid for a red that was never about the app.

   Both of those were tricks: ways to manufacture a state the app does not normally reach. The
   guarantee under test does not need one. THE OWNER ADDS AN EXCLUSION BETWEEN THE PREVIEW AND
   THE CONFIRM. That is an ordinary Tuesday — a file is previewed, someone rules a partner out,
   the file is confirmed — and it produces exactly the same stale preview with nothing held back,
   nothing emptied, and no timing to lose. The list is written where the app keeps it, and the
   commit must read it there.

   Under test:
     1. Control — the preview run under a KNOWN list holds the excluded client back, and the
        ordinary row still imports. (If this fails, nothing below means anything.)
     2. THE ATTACK — preview under an unknown list, list lands, Confirm: the excluded client's
        invoice must not reach finance_invoices.
     3. The refusal is honest about scope: it does not report a count it did not write. Either
        nothing is written and it says why, or the preview's own numbers are what land.
     4. The ordinary row in that same batch is not silently kept while the excluded one is
        dropped — a batch previewed against no list at all is untrustworthy whole, and the
        person is told to drop the file again rather than handed a partial import.

   Run:  node scripts/qa/probe-stale-preview-exclusion.mjs        (port 8718)
   Sabotage: remove the commit-time re-check from v65Commit — checks 2 and 4 go red with the
   excluded client's invoice in the table. Restore byte-identical (md5).                       */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8718;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const EXCLUDED = 'Takamol for Business Services';   // the mock seed's standing exclusion
/* The client nobody has ruled out yet. It is ordinary while the file is previewed, and excluded
   by the time Confirm is pressed — which is the whole attack. */
const LATE = 'Late Ruling Partner Co';

/* Write the exclusion where the app keeps it, exactly as v62AddExclusion does: into the
   app_settings blob. Nothing in the page is touched. */
async function addExclusionOnServer(name) {
  const cur = (await fetch(BASE + '/rest/v1/app_settings?id=eq.main&select=data').then((r) => r.json())) || [];
  const blob = (cur[0] && cur[0].data) || {};
  const list = (blob.financeExclusions || []).slice();
  list.push({ id: 'fx-late-ruling', clientId: 'late', matchNames: [name], reason: 'ruled out between preview and confirm (QA)', addedBy: 'probe', addedAt: new Date().toISOString() });
  blob.financeExclusions = list;
  await fetch(BASE + '/rest/v1/app_settings?id=eq.main', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ data: blob }),
  });
  /* Read it back. The first version of this trusted the 201 and the write had not happened at
     all — the mock answered success for a table its PATCH did not cover — and this probe then
     reported a defect in the importer that did not exist. A setup step is a claim like any
     other. */
  const back = (await fetch(BASE + '/rest/v1/app_settings?id=eq.main&select=data').then((r) => r.json())) || [];
  const names = (((back[0] || {}).data || {}).financeExclusions || []).map((e) => (e.matchNames || [])[0]);
  if (!names.includes(name)) { fail(`the setup could not add "${name}" to the exclusion list on the server — the list still reads ${JSON.stringify(names)}, so nothing below is a finding about the app`); return false; }
  return true;
}   // the mock seed's own standing exclusion
const srv = start(PORT, { finance_invoices: [] });
/* held true only for the attack page's boot — released between its preview and its Confirm */

const BASE = 'http://localhost:' + PORT;

/* The real Direct Payments invoice-export signature. Cycle 28's lesson, met again in cycle 41:
   invented column names make the importer answer "not recognized", no preview runs, and a check
   then passes having exercised nothing. */
const HEAD = 'Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman';
const csvFor = (n, who) => [HEAD,
  'invoice,Direct Flights,' + who + ',REF-S' + n + ',SX-' + n + '1,05/08/2026 10:00:00 AM,Fully Paid,,,,,777000,Riyadh,QA',
  'item,Direct Flights,' + who + ',REF-S' + n + ',,,,Partner work,No,0,777000,,,',
  'invoice,Direct Hotels,Ordinary Client Co,REF-N' + n + ',NM-' + n + '2,06/08/2026 10:00:00 AM,Fully Paid,,,,,1500,Riyadh,QA',
  'item,Direct Hotels,Ordinary Client Co,REF-N' + n + ',,,,Ordinary work,No,0,1500,,,'
].join('\n');

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  let p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  const wire = async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  };
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', wire);
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(2500);
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForTimeout(4000);
  /* 2026-09-07 (cycle 43): this was settingsLoaded()'s fixture-marker guard, and it produced a
     false red twice in a row on runs where the list demonstrably HAD arrived (the control right
     below passed both times, and it cannot pass without one). A guard that fails while the thing
     it guards is working is noise in front of a real result. Wait for the fact this probe
     actually depends on instead, and let the control — which fails with the preview and the
     alerts in hand — be the assertion. */
  await p.waitForFunction(() => { try { return !!finExclusionCheck('Takamol for Business Services'); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => { });
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1200);

  const invoicesInDb = async () => (await fetch(BASE + '/rest/v1/finance_invoices?select=invoice_no,client_group,total_incl_vat_sar').then((r) => r.json())) || [];

  /* Drive the importer the way the page does. `blindPreview` is the whole attack: the exclusion
     list is unknown while the file is being sorted, and known again by the time Confirm runs. */
  const runImport = async (csv, blindPreview) => {
    await p.evaluate(() => { try { if (typeof window.finGo === 'function') window.finGo('import'); } catch (_) { } });
    await p.waitForTimeout(800);
    /* 2026-09-07 (cycle 43): record whether the list really was unknown AT THE MOMENT the file
       was sorted. Under six-way load the setup sometimes loses its own race, and cycle 35's rule
       applies — one honest failure naming the cause beats three cascaded reds blaming the app
       for a run that never set itself up. */
    const blindAtSort = await p.evaluate((n) => { try { return { chk: !!finExclusionCheck(n), known: window.finExclusionsKnown ? window.finExclusionsKnown() : null }; } catch (e) { return { err: String(e.message) }; } }, LATE);
    const preview = await p.evaluate(async (text) => {
      const f = new File([text], 'aug.csv', { type: 'text/csv' });
      if (typeof window.v65Ingest === 'function') { await window.v65Ingest([f]); return 'ingested'; }
      const dz = document.getElementById('finDrop');
      if (dz) { const dt = new DataTransfer(); dt.items.add(f); dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true })); return 'dropped'; }
      return 'no entry point';
    }, csv);
    await p.waitForTimeout(3500);
    const previewText = await p.evaluate(() => { const el = document.getElementById('finImpOut'); return el ? el.innerText : ''; });
    /* THE ONLY THING THAT CHANGES BETWEEN THE PREVIEW AND THE CONFIRM: someone rules the client
       out, in the place the app keeps that decision. No page state is touched and nothing is
       held back — this is the sequence as a person would produce it. */
    if (blindPreview) await addExclusionOnServer(LATE);
    /* the page's own local view at commit time: with the blob restored this reads as a perfectly
       healthy exclusion list, which is the whole point — nothing local is left to notice that the
       preview was made blind. */
    const readyAtCommit = await p.evaluate(() => { try { return !!finExclusionCheck('Takamol for Business Services'); } catch (_) { return null; } });
    const pageStillBlind = await p.evaluate((n) => { try { return !finExclusionCheck(n); } catch (_) { return null; } }, LATE);
    await p.evaluate(() => { window.__alerts = []; const oa = window.alert; window.alert = (m) => { window.__alerts.push(String(m)); }; window.__restoreAlert = () => { window.alert = oa; }; });
    await p.evaluate(() => { try { if (typeof window.v65Commit === 'function') window.v65Commit(); } catch (e) { window.__alerts.push('THREW ' + e.message); } });
    await p.waitForTimeout(3000);
    const alerted = await p.evaluate(() => { try { window.__restoreAlert(); } catch (_) { } return window.__alerts || []; });
    const done = await p.evaluate(() => { const el = document.getElementById('finImpOut'); return el ? el.innerText : ''; });
    return { preview, previewText, readyAtCommit, pageStillBlind, alerted, done, blindAtSort };
  };

  /* ---- 1. control: the list is known throughout ---- */
  const before1 = await invoicesInDb();
  const r1 = await runImport(csvFor(1, EXCLUDED), false);
  const after1 = await invoicesInDb();
  const wrote1 = after1.filter((x) => !before1.some((y) => y.invoice_no === x.invoice_no));
  const excl1 = wrote1.filter((x) => /takamol/i.test(x.client_group || ''));
  if (wrote1.length && !excl1.length)
    ok(`control: with the list known throughout, the import writes ${wrote1.length} row(s) and the excluded client is held back — the attack below is measured against a working importer`);
  else if (excl1.length) fail(`control: the excluded client was written with the list known throughout (${JSON.stringify(excl1)}) — a defect this probe was not written for, but a worse one`);
  else fail(`control: nothing was written at all — the importer did not run, so nothing below can be concluded. preview=${JSON.stringify(r1.preview)} alerts=${JSON.stringify(r1.alerted)}`);

  /* ---- 2 + 3 + 4. THE ATTACK: previewed blind, committed sighted ----
     A fresh page whose app_settings response is held back from boot, so NEITHER the page copy
     nor js/62's authoritative copy exists while the file is sorted. */
  const before2 = await invoicesInDb();
  const r2 = await runImport(csvFor(2, LATE), true);
  const after2 = await invoicesInDb();
  const wrote2 = after2.filter((x) => !before2.some((y) => y.invoice_no === x.invoice_no));
  const excl2 = wrote2.filter((x) => new RegExp(LATE, 'i').test(x.client_group || ''));

  /* The setup holds when the late-excluded client was ORDINARY while the file was sorted, and
     the page still thinks so at Confirm — so the only thing that knows better is the server. */
  const setUp = (r2.blindAtSort && r2.blindAtSort.chk === false && r2.pageStillBlind === true && !new RegExp(LATE, 'i').test(r2.previewText || ''));
  if (setUp)
    ok(`the preview sorted "${LATE}" as an ordinary client and the page still thinks so at Confirm — so the attack is set up: only the server knows the partner has since been ruled out`);
  else
    fail(`the attack did not set itself up, so nothing below is a finding about the app: at sort time the late-excluded client read as ${JSON.stringify(r2.blindAtSort)} and the page was still unaware of it at commit = ${JSON.stringify(r2.pageStillBlind)}. Preview said: ${JSON.stringify((r2.previewText || '').slice(0, 200))}`);

  if (!setUp)
    console.log('  · the attack, the refusal and the whole-file rule are REPORTED not asserted this run — the setup above did not hold, and a check that examined nothing has not passed');
  else if (!excl2.length)
    ok('THE ATTACK FAILS: a client ruled out AFTER the preview and BEFORE the Confirm still never reaches finance_invoices — the decision that gets written is the decision made against the list as it stands at the moment of writing, not the one the preview happened to see');
  else
    fail(`the ruled-out client's invoice WAS written: ${JSON.stringify(excl2.map((x) => x.invoice_no + ' / ' + x.client_group + ' / ' + x.total_incl_vat_sar))}. Someone excluded that partner while the file sat in preview, and the commit wrote it anyway — the preview's decision, not the owner's. The Takamol incident by an ordinary Tuesday.`);

  const said2 = ((r2.alerted || []).join(' | ') + ' ' + (r2.done || '')).trim();
  if (!setUp) { /* reported above */ }
  else if (!wrote2.length) {
    if (/exclusion|استبعاد/i.test(said2) && /(again|nothing was written|drop|أعد|لم يُكتب)/i.test(said2))
      ok('nothing was written and the person is told why, in words naming the exclusion list — a refusal that can be acted on, not a silent no-op');
    else fail(`nothing was written but nothing explained it either. The screen said: ${JSON.stringify(said2.slice(0, 400))}`);
    ok('the ordinary row in the same batch was not kept while the excluded one was dropped — a batch sorted against no list at all is untrustworthy whole, so the file is refused rather than half-imported');
  } else if (!excl2.length) {
    const ordinary = wrote2.filter((x) => !/takamol/i.test(x.client_group || ''));
    fail(`the excluded row was held back but ${ordinary.length} ordinary row(s) were still written from a preview made against no list at all: ${JSON.stringify(ordinary.map((x) => x.invoice_no))}. Every decision in that preview is suspect, not only the ones still visible — a partial import hides that from the person, who has no reason to drop the file again.`);
    fail('the preview\'s own numbers are not what landed — M13 requires the database to report exactly what the preview promised, and a silent drop breaks that too');
  }

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nstale-preview-exclusion OK — a preview made without the exclusion list cannot be committed once the list arrives');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
