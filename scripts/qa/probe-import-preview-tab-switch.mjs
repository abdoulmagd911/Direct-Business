/* probe-import-preview-tab-switch.mjs (2026-09-09, watch cycle 74) — the importer must not blame
   the file for its own painting. Attack area (dd).

   js/65 paints the import preview into #finImpOut from three places. Two of them look the element
   up and check it, and both explain why in their own comments: this app re-runs the full render()
   chain from a dozen unrelated setInterval pollers, and rImport() regenerates the tab with a BLANK
   #finImpOut. The third — renderCombinedPreview, the one that paints the preview while the file is
   still streaming — looked it up again and did not check.

   Measured through the real file input, no probe-only entry point, before anything was changed:
   a 3.17 MB / 40,000-row export dropped, then a click on another tab

       at   20 ms  →  Cannot set properties of null (setting 'innerHTML')
       at   60 ms  →  same
       at  400 ms  →  same
       at 1500 ms  →  no error (the preview has painted by then)

   so the window is about the first second after a drop — exactly when a person looks away from a
   file they have just handed over.

   AND IT DID NOT STOP AT A CONSOLE ERROR. The throw lands in the streaming parser's onError,
   which records it as THIS FILE'S error, so returning to the tab reads

       c74-import.csv - not recognized - Cannot set properties of null (setting 'innerHTML')

   on a perfectly valid file, and it stays there: the import never happens and the person is told
   their data is bad. js/65 already names this failure for a different cause a few hundred lines
   further down — "it never says 'not ready', it says 'your file is wrong', in red, and teaches the
   next person to distrust correct data." Same lie, different cause, same tab.

   Under test:
     1. Control — dropped and left alone, the file is recognized and its preview appears. If this
        fails, nothing below is measuring anything.
     2. THE ATTACK — dropped, then straight to another tab and back: the preview is there and the
        file is recognized. This is the load-bearing check.
     3. And the importer never blames the file: no "not recognized", and no JavaScript error text
        anywhere in what it says about the file.
     4. Nothing was thrown at all during the parse.
     5. The preview is still there a moment later — the unrelated background renders that rebuild
        this tab repaint it rather than wiping it.

   The 60 ms switch is not a guess at a tight race: it is one of the three delays measured above
   that threw, against 1500 ms which did not. The file is large on purpose — a real Direct Payments
   export is this size, and a small one finishes parsing before a person could switch at all, which
   is precisely how this survived every previous import probe.

   Run:  node scripts/qa/probe-import-preview-tab-switch.mjs        (port 8741)
   Sabotage: drop the element check from renderCombinedPreview in js/65 — checks 2, 3, 4 and 5 go
   red and the control stays green. Restore byte-identical (md5) and confirm the marker is gone by
   grep, not only by hash (cycle 44).                                                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8741;
const ROWS = 20000;          /* 40,000 CSV lines, ~3.2 MB — the size the window depends on */
const SWITCH_MS = 60;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);

const HEAD = 'Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman';
const lines = [HEAD];
for (let i = 0; i < ROWS; i++) {
  lines.push('invoice,Direct Flights,Client ' + (i % 50) + ',REF-' + i + ',INV-' + i + ',05/08/2026 10:00:00 AM,Fully Paid,,,,,' + (1000 + i) + ',Riyadh,QA');
  lines.push('item,Direct Flights,Client ' + (i % 50) + ',REF-' + i + ',,,,Work,No,0,' + (1000 + i) + ',,,');
}
/* Written to the OS temp directory, never into the repository — rule 7's habit even for synthetic
   rows, and it keeps a 3 MB file out of anybody's git status. */
const CSV = path.join(os.tmpdir(), 'probe-import-preview-tab-switch-' + process.pid + '.csv');
fs.writeFileSync(CSV, lines.join('\n'));

const srv = start(PORT, { finance_invoices: [], finance_transactions: [], finance_targets: [], finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;
const cleanup = () => { try { fs.unlinkSync(CSV); } catch (_) {} try { srv.close(); } catch (_) {} };

/* Anything that reads like a thrown JavaScript error rather than a sentence about a file. */
const JS_ERROR_WORDS = /Cannot set propert|Cannot read propert|is not a function|undefined is not|null \(setting|TypeError|ReferenceError/i;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  let errors = []; p.on('pageerror', (e) => errors.push(String(e.message)));
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

  const openImport = async () => {
    await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
    /* Sign in only when there is a form to sign in with — on the second boot the session is
       already in storage and waiting for it is how two probes have died (cycles 72 and 73). */
    try {
      await p.waitForSelector('#cl_email', { timeout: 8000 });
      await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    } catch (_) { /* already signed in */ }
    await p.waitForFunction(() => window.FIN && typeof finGo === 'function', { timeout: 90000 });
    await p.evaluate(() => { current = 'finance'; finGo('import'); });
    await p.waitForSelector('#finFile', { timeout: 30000 });
    await p.waitForFunction(() => !!document.getElementById('finImpOut'), { timeout: 30000 });
  };
  /* Read the SCREEN — what the person meets on the tab — not FILES_STATE. The whole defect was
     visible only in what the tab said (cycle 63's rule). */
  const importText = () => p.evaluate(() => {
    const o = document.getElementById('finImpOut');
    return (o ? o.innerText : '(no #finImpOut on the page)').replace(/\s+/g, ' ').trim();
  });

  /* ---------- 1. control: dropped and left alone ---------- */
  await openImport();
  errors = [];
  await p.setInputFiles('#finFile', CSV);
  await p.waitForFunction(() => { const o = document.getElementById('finImpOut'); return o && /recognized: 1/.test(o.innerText || ''); }, { timeout: 120000 }).catch(() => {});
  const ctl = await importText();
  if (/recognized: 1/.test(ctl) && /New\s+20000|New 20,000/.test(ctl))
    ok(`control: dropped and left alone, the export is recognized and previews its 20,000 new rows — "${ctl.slice(0, 80)}…"`);
  else {
    fail(`control: dropped and left alone, the importer did not preview the file at all: "${ctl.slice(0, 200)}". Everything below would be measuring a broken fixture, not the tab switch`);
    console.log(`\nFAILED — ${failures} check(s) did not pass.`); await b.close(); cleanup(); process.exit(1);
  }

  /* ---------- 2-5. the attack: drop, look away, come back ---------- */
  await openImport();
  errors = [];
  note(`dropping ${ROWS * 2} CSV rows (${(fs.statSync(CSV).size / 1024 / 1024).toFixed(2)} MB) and switching tab ${SWITCH_MS} ms later — one of the three delays measured to throw, against 1500 ms which did not`);
  await p.setInputFiles('#finFile', CSV);
  await p.waitForTimeout(SWITCH_MS);
  const gone = await p.evaluate(() => { finGo('overview'); return !document.getElementById('finImpOut'); });
  if (!gone) { fail(`the attack did not set itself up: #finImpOut is still on the page after switching to the Overview, so the tab was never actually left and nothing below is tested`); }
  await p.waitForTimeout(12000);
  await p.evaluate(() => finGo('import'));
  const back = await importText();

  if (/recognized: 1/.test(back) && /New\s+20000|New 20,000/.test(back))
    ok('coming back to the Import tab, the preview is there and the file is recognized — the parse survived the person looking away from it');
  else
    fail(`coming back to the Import tab, the preview is not there: "${back.slice(0, 220)}". The person dropped a valid export, glanced at another tab, and the import did not happen`);

  if (!/not recognized/i.test(back) && !JS_ERROR_WORDS.test(back))
    ok('and the importer says nothing about the file being wrong — no "not recognized", no JavaScript error text where a sentence about a file should be');
  else
    fail(`the importer blamed the file for its own failure: "${back.slice(0, 220)}". The export is valid; this is a painting error reported as a data error, which is the thing js/65's own comment says teaches people to distrust correct data`);

  if (!errors.length)
    ok('nothing was thrown during the parse');
  else
    fail(`${errors.length} uncaught error(s) during the parse, the first being: ${JSON.stringify(errors[0].slice(0, 160))}. An import that throws while the person is on another tab is an import that silently did not happen`);

  await p.waitForTimeout(1800);
  const later = await importText();
  if (/recognized: 1/.test(later) && !/not recognized/i.test(later) && !JS_ERROR_WORDS.test(later))
    ok('and it is still there a moment later — the unrelated background renders that rebuild this tab repaint the preview rather than wiping it');
  else
    fail(`the preview did not survive: "${later.slice(0, 220)}". Something that rebuilds this tab replaced it after the fact, which is the failure paintPersisted() exists to prevent`);

  await b.close(); cleanup();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nimport-preview-tab-switch OK — a valid export dropped and left for another tab still imports, and the importer never blames the file for its own painting');
  process.exit(0);
}
main().catch((e) => { console.error(e); cleanup(); process.exit(1); });
