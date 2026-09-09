/* probe-sop-sla-tidy.mjs (2026-09-09, live test findings SOP1, SOP2) — the SOP page's edge icon
   is icon-sized and the Service Levels table is a table, not a grid of resize handles.
   Attack area (ad). Measured on screen (bounding boxes), not from the code.

   PORT NOTE: 8701–8765 are taken. This is 8766, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: SOP1 opening an SOP drew a giant orange star that filled half
   the screen (an unsized SVG in a flex heading). SOP2 the Service Levels table cut the Event
   column off, showed a red ✕ on every row, and every cell was a live text box with a resize
   handle.

   Under test:
     1. Open the first SOP → the "Direct Business edge" heading's icon is at most 20 px tall
        and wide.
     2. Service Levels: no ".x" glyph on any row; every textarea has resize: none; the Event
        input's right edge stays inside its cell; each row has a "Delete" button.
     3. Delete → js/57's in-page box (no native confirm); Cancel keeps the row; Confirm removes
        it and the table has one row fewer.
     4. SOP editor, empty title → toast, no native alert.
     5. Airlines (same evening): the Void and Refund rule cells read in full — no 24-character cut.

   Run:  node scripts/qa/probe-sop-sla-tidy.mjs        (port 8766)
   Sabotage: in index.html delete the `.vs .box .h svg{…}` rule — check 1 goes red; in core-03
   put the `<span class="x" onclick="if(confirm(…` cell back — checks 2 and 3 go red. Assert the
   sabotage APPLIED with a marker unique to it; confirm the restore by marker count and git
   status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8766;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type()); await d.dismiss(); });
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
  await p.goto(BASE + '/sopsla', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.slas) && DB.slas.length > 0 && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.waitForTimeout(1500);

  /* ---- 1. the SOP edge icon ---- */
  await p.evaluate(() => { openLead = null; current = 'sopsla'; window.sopslaTab = 'sops'; render(); }); await p.waitForTimeout(800);
  const star = await p.evaluate(() => { const d = document.querySelector('#view details.sop'); if (!d) return null; d.open = true; const svg = d.querySelector('.box.edge .h svg'); if (!svg) return { noSvg: true }; const r = svg.getBoundingClientRect(); const box = d.querySelector('.box.edge').getBoundingClientRect(); return { w: r.width, h: r.height, boxH: box.height }; });
  if (star && !star.noSvg && star.w <= 20 && star.h <= 20) ok(`the edge icon is ${Math.round(star.w)}×${Math.round(star.h)} px inside a ${Math.round(star.boxH)} px box`);
  else fail(`the edge icon: ${JSON.stringify(star)} — the live-site giant star`);

  /* ---- 2. the Service Levels table ---- */
  await p.evaluate(() => { window.sopslaTab = 'slas'; render(); }); await p.waitForTimeout(800);
  const t = await p.evaluate(() => {
    const tbl = document.querySelector('#view table.sla-table'); if (!tbl) return null;
    const rows = [...tbl.querySelectorAll('tbody tr')];
    const xs = tbl.querySelectorAll('.x').length;
    const tas = [...tbl.querySelectorAll('textarea')]; const resizable = tas.filter((x) => getComputedStyle(x).resize !== 'none').length;
    const overflow = rows.filter((tr) => { const td = tr.querySelector('td'); const inp = td && td.querySelector('input.cell'); if (!inp) return false; return inp.getBoundingClientRect().right > td.getBoundingClientRect().right + 1; }).length;
    const dels = tbl.querySelectorAll('[data-sla-del]').length;
    const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
    return { rows: rows.length, xs, tas: tas.length, resizable, overflow, dels, wide };
  });
  if (t && t.rows > 0 && t.xs === 0 && t.resizable === 0 && t.overflow === 0 && t.dels === t.rows && !t.wide) ok(`Service Levels: ${t.rows} rows, no ✕, ${t.tas} text boxes none resizable, the Event input inside its cell, a Delete button per row, no sideways scroll`);
  else fail(`Service Levels: ${JSON.stringify(t)} — the live-site cut column, red ✕ and resize handles`);

  /* ---- 3. Delete asks in the page ---- */
  const before = await p.evaluate(() => DB.slas.length);
  const firstId = await p.evaluate(() => DB.slas[0].id);
  await p.click(`#view [data-sla-del="${firstId}"]`); await p.waitForTimeout(400);
  const box = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 100) }));
  if (!dialogs.length && box.box && /Delete the service level/.test(box.txt)) ok(`Delete asks in the page: "${box.txt.slice(0, 60)}…"`); else fail(`Delete: ${JSON.stringify(box)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => document.getElementById('pfConfirmNo').click()); await p.waitForTimeout(300);
  const kept = await p.evaluate(() => DB.slas.length);
  if (kept === before) ok('Cancel keeps the row'); else fail(`Cancel: ${kept} of ${before}`);
  await p.click(`#view [data-sla-del="${firstId}"]`); await p.waitForTimeout(400); await p.evaluate(() => document.getElementById('pfConfirmYes').click()); await p.waitForTimeout(700);
  const after = await p.evaluate((id) => ({ n: DB.slas.length, gone: !DB.slas.some((s) => s.id === id), rows: document.querySelectorAll('#view table.sla-table tbody tr').length }), firstId);
  if (!dialogs.length && after.n === before - 1 && after.gone && after.rows === before - 1) ok('Confirm removes the row (table one shorter) — no native dialog'); else fail(`Confirm: ${JSON.stringify(after)} dialogs=${JSON.stringify(dialogs)}`);

  /* ---- 4. SOP editor, empty title ---- */
  await p.evaluate(() => { window.sopslaTab = 'sops'; render(); }); await p.waitForTimeout(600);
  await p.evaluate(() => editSop()); await p.waitForSelector('#s_title', { timeout: 5000 }).catch(() => fail('the SOP editor never opened'));
  await p.evaluate(() => { document.getElementById('s_title').value = ''; document.getElementById('mSave').click(); }); await p.waitForTimeout(500);
  const t4 = await p.evaluate(() => [...document.querySelectorAll('.toast, #toast, [class*="toast"]')].map((x) => x.textContent.trim()).filter(Boolean).join(' | '));
  if (!dialogs.length && /Title required|العنوان/.test(t4)) ok(`SOP editor, empty title: toast "${t4.slice(0, 30)}", no native alert`); else fail(`SOP editor: dialogs=${JSON.stringify(dialogs)} toast="${t4}"`);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });

  /* ---- 5. Airlines (2026-09-09, live test "Airlines cells are truncated"): the Void and Refund rules read in full ---- */
  await p.evaluate(() => { const a = (DB.airlines || [])[0]; if (a) { a.voidRule = 'Same-day void via BSP link before 23:59 local, no fee, agent must cancel PNR first'; a.refundRule = 'Refund to original form of payment within 14 working days minus the airline penalty'; a.type = a.type === 'LCC' ? 'FSC' : a.type; } openLead = null; current = 'airlines'; supView = 'list'; render(); });
  await p.waitForTimeout(900);
  const air = await p.evaluate(() => { const a0 = (DB.airlines || [])[0]; const tr = [...document.querySelectorAll('#view table tbody tr')].find((x) => a0 && x.innerText.includes(a0.name)); if (!tr) return { noRow: true, rows: document.querySelectorAll('#view table tbody tr').length }; const tds = [...tr.querySelectorAll('td')]; const cut = tds.filter((td) => td.scrollWidth > td.clientWidth + 1 && getComputedStyle(td).overflow === 'hidden').length; const full = /agent must cancel PNR first/.test(tr.innerText) && /minus the airline penalty/.test(tr.innerText); const ell = tds.filter((td) => /…$/.test(td.innerText.trim())).length; return { cut, full, ell }; });
  if (air && air.full && air.cut === 0 && air.ell === 0) ok('Airlines: the Void and Refund rules read in full on the row — no clipped cell, no ellipsis');
  else fail(`Airlines: ${JSON.stringify(air)} — the live-site "Same-day void via …"`);

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nsop-sla-tidy OK — the icon is an icon and the table is a table');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
