/* probe-import-preview-phone.mjs (2026-09-08, watch cycle 53) — the money-entry screen, on the
   device the owner actually uses. Attack area (uu).

   PORT NOTE: 8701–8722 are all taken (block full since cycle 49; 8721 and 8722 went to cycles 49
   and 50). This is 8723, verified free by scanning every PORT= in scripts/qa.

   Every riyal in Finance arrives through the importer. Its preview is the last thing anyone reads
   before pressing Confirm — how many rows are new, how many are updated, and which rows were held
   back and why. Cycle 47's sweep found a dialog whose Save button was unreachable on a 390px
   screen; nothing has ever asked the same question of THIS screen, and this one writes invoices.

   A real drop from Direct Payments holds back several rows and names each one, so the preview is
   long by design. The failure mode is not subtle: if the Confirm button sits below a preview that
   does not scroll, the import cannot be completed on a phone at all; and if the reasons are
   clipped, somebody confirms a batch whose held-back rows they could not read.

   Under test, at 390x844 (a phone) and 820x1180 (a tablet), against a real Direct Payments
   invoice-export drop that holds rows back:
     1. Control — the preview renders with its counts and names the held-back rows, so the checks
        below are measured against a screen that actually drew. (If this fails, nothing else
        means anything.)
     2. The Confirm button EXISTS and is reachable: scrollable into view, and once there, the
        point at its centre actually hits it rather than something painted over it.
     3. Every held-back row's reason is readable — no element inside the preview is wider than the
        viewport without a scrollable ancestor, so no reason is cut off mid-sentence.
     4. The page itself does not scroll sideways (documentElement.scrollWidth <= innerWidth + 2).

   Run:  node scripts/qa/probe-import-preview-phone.mjs        (port 8723)
   Sabotage: give #finImpOut a fixed height with overflow:hidden in js/65 — check 2 goes red with
   the button unreachable. Assert the sabotage APPLIED before believing a green run (cycle 49),
   and restore from a POST-fix baseline (cycle 44).                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start, settingsLoaded } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8723;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const srv = start(PORT, { finance_invoices: [] });
const BASE = 'http://localhost:' + PORT;

/* The real Direct Payments invoice-export signature (cycle 28's lesson: invented column names
   make the importer answer "not recognized" and the run then exercises nothing). Several rows are
   deliberately unimportable — no date, an impossible date — so the preview is long and names each
   one, which is the shape a real drop has. */
const HEAD = 'Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman';
const rows = [];
for (let i = 1; i <= 6; i++) {
  rows.push(`invoice,Direct Flights,Phone Preview Client ${i} With A Rather Long Company Name Ltd,REF-P${i},PP-${i}01,0${(i % 9) + 1}/08/2026 10:00:00 AM,Fully Paid,,,,,${1000 * i},Riyadh,QA`);
  rows.push(`item,Direct Flights,Phone Preview Client ${i} With A Rather Long Company Name Ltd,REF-P${i},,,,Work item ${i},No,0,${1000 * i},,,`);
}
/* four rows the importer must hold back and explain — this is what makes the preview long */
for (let i = 1; i <= 4; i++) {
  rows.push(`invoice,Direct Hotels,Held Back Client ${i} Whose Reason Needs Room To Read Ltd,REF-H${i},HH-${i}01,,Fully Paid,,,,,${500 * i},Riyadh,QA`);
  rows.push(`item,Direct Hotels,Held Back Client ${i} Whose Reason Needs Room To Read Ltd,REF-H${i},,,,No date at all,No,0,${500 * i},,,`);
}
const CSV = [HEAD].concat(rows).join('\n');

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [label, vp] of [['a phone (390x844)', { width: 390, height: 844 }], ['a tablet (820x1180)', { width: 820, height: 1180 }]]) {
    const ctx = await b.newContext({ viewport: vp });
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
    await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
    try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
    try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
    /* v65IngestText, not v65Ingest — the exported entry takes (fileName, csvText) and goes
       through the same detectSignature → batch → refreshJoin → renderCombinedPreview path as a
       real File. The first draft of this probe called a name that does not exist, the preview
       came back empty, and a diagnostic read-back said so immediately rather than leaving four
       checks to fail against nothing. A setup step is a claim (cycle 45). */
    if (!(await p.waitForFunction(() => typeof window.v65IngestText === 'function', { timeout: 90000 }).then(() => true).catch(() => false)))
      fail(`${label}: window.v65IngestText never appeared, so no file could be dropped and this run examined nothing`);
    await p.evaluate(() => { try { current = 'finance'; render(); if (window.finGo) finGo('import'); } catch (_) { } });
    await p.waitForTimeout(1200);
    await p.evaluate(async (text) => { await window.v65IngestText('phone-drop.csv', text); }, CSV);
    await p.waitForTimeout(4000);

    const diag = await p.evaluate(() => ({
      hasOut: !!document.getElementById('finImpOut'),
      tab: (window.FIN && FIN.tab) || null,
      current: window.current || null,
      ingest: typeof window.v65IngestText,
      bodyHas: (document.body.innerText || '').slice(0, 160).replace(/\s+/g, ' '),
    }));
    const preview = await p.evaluate(() => { const el = document.getElementById('finImpOut'); return el ? el.innerText : ''; });
    if (!preview) console.log('  · diag: ' + JSON.stringify(diag));
    /* The app SUMMARISES a rule that catches several rows — "Excluded by rule 4 — 4 invoices: no
       readable invoice date" — rather than listing every client under it. The first draft of this
       check demanded each client by name and would have reported a defect that is really a design
       choice, and a sensible one on a small screen. Ask for what the app actually promises: the
       counts, and a reason a person can act on. (Cycle 50: a probe can invent a defect.) */
    if (/New\s+\d+/.test(preview) && /Excluded by rule\s+\d+/.test(preview) && /invoice date/i.test(preview))
      ok(`${label}: the preview drew — counts, and the held-back rows explained by rule — so the checks below are measured against a screen that rendered`);
    else { fail(`${label}: the import preview did not render its counts and held-back rows, so nothing below can be concluded. It said: ${JSON.stringify(preview.replace(/\n/g, ' | ').slice(0, 260))}`); await ctx.close(); continue; }

    /* ---- 2. the Confirm button is reachable, and the point at its centre really hits it ---- */
    const btn = await p.$('#finImpOut button');
    if (!btn) fail(`${label}: no Confirm button in the preview at all — a batch that cannot be committed`);
    else {
      /* 2026-09-08 (cycle 53): the first version of this check measured getBoundingClientRect()
         against the VIEWPORT and then asked elementFromPoint what sat at the centre. Sabotage —
         clipping #finImpOut to height:120px;overflow:hidden, which hides the button completely —
         left it GREEN, because a clipped element still reports real coordinates and the rect test
         knows nothing about a clipping ancestor. A check that cannot fail is the thing this work
         removes, so it is replaced rather than patched: Playwright's own actionability check,
         which is what a person's finger is subject to. click({trial:true}) runs every check a
         real click runs — visible, stable, receives events, not covered — and performs no click. */
      /* Re-query by selector immediately before the check: js/65 repaints #finImpOut on its own
         schedule, so a handle taken earlier can be detached by the time it is used, and
         "Element is not attached to the DOM" would be reported as "the button cannot be
         pressed" — a red for the wrong reason, which is as bad as a green for the wrong one. */
      const reach = await p.locator('#finImpOut button').first()
        .click({ trial: true, timeout: 6000 })
        .then(() => ({ ok: true }))
        .catch((e) => ({ ok: false, why: String(e.message || e).split('\n')[0] }));
      const where = await p.evaluate(() => {
        const bt = document.querySelector('#finImpOut button'); if (!bt) return null;
        const r = bt.getBoundingClientRect();
        return { rect: { t: Math.round(r.top), b: Math.round(r.bottom) }, vh: innerHeight, visible: !!(bt.offsetParent || getComputedStyle(bt).position === 'fixed') };
      });
      if (reach.ok) ok(`${label}: the Confirm button passes a real actionability check — visible, stable and not covered — so the import can actually be completed here`);
      else fail(`${label}: the Confirm button cannot be pressed: ${reach.why}. ${JSON.stringify(where)}. Every riyal in Finance arrives through this screen; a batch that can be previewed and not committed is worse than one that cannot be started.`);
    }

    /* ---- 3. no reason is cut off ---- */
    const clipped = await p.evaluate(() => {
      const host = document.getElementById('finImpOut'); if (!host) return ['(no preview)'];
      const bad = [];
      host.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= innerWidth + 2) return;
        let a = el.parentElement, contained = false;
        while (a && a !== document.body) { const s = getComputedStyle(a); if (/auto|scroll/.test(s.overflowX)) { contained = true; break; } a = a.parentElement; }
        if (!contained) bad.push((el.tagName.toLowerCase()) + ' w=' + Math.round(r.width) + ' :: ' + (el.innerText || '').replace(/\s+/g, ' ').slice(0, 50));
      });
      return bad;
    });
    if (!clipped.length) ok(`${label}: nothing in the preview is wider than the screen without somewhere to scroll — every held-back row's reason can be read to the end`);
    else fail(`${label}: ${clipped.length} element(s) in the preview overflow the screen with no scrollable ancestor, so a reason is cut off mid-sentence: ${JSON.stringify(clipped.slice(0, 3))}`);

    /* ---- 4. and the page itself does not scroll sideways ---- */
    const hscroll = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    if (hscroll.doc <= hscroll.win + 2) ok(`${label}: the page does not scroll sideways (${hscroll.doc} ≤ ${hscroll.win})`);
    else fail(`${label}: the page scrolls sideways — documentElement is ${hscroll.doc}px against a ${hscroll.win}px screen`);

    await ctx.close();
  }
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nimport-preview-phone OK — the money-entry screen can be read and committed on a phone and a tablet');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
