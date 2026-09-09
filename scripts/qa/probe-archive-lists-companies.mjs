/* probe-archive-lists-companies.mjs (2026-09-09, live test finding AR1) — the Archive page lists
   the companies that were deleted, says who deleted them, and can bring one back. Attack area (ad).

   PORT NOTE: 8701–8759 are taken. This is 8760, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: "Archived leads 0" while four companies sat archived in the
   database, and a footnote admitting "Deleted companies are not listed here … no screen restores
   one". Three of the four were removed by a merge (archived_by = 'merged-into:<id>'); one was
   deleted from its card.

   Under test:
     1. Two archived rows in the table (one deleted from a card, one folded in by a merge) → the
        Archive page shows a "Deleted companies · 2" card naming both; the old "Archived leads 0"
        tile now reads "Deleted companies 2".
     2. The deleted one says who deleted it and carries a Restore button; the merged one (whose
        archived_by carries the live "(was: …)" suffix) names the company it was merged into and
        carries NO Restore button; the one archived by owner ruling says so and has NO Restore.
     3. Restore → the in-page box (no native confirm) → confirm → the row's archived_at is null in
        the table, the page reloads, and the company is back in DB.businesses on screen.
     4. A company that is NOT archived never appears on the page (the query is archived_at IS NOT
        NULL, not "everything").
     5. Sabotage marker: the footnote no longer promises that nothing can be listed.

   Run:  node scripts/qa/probe-archive-lists-companies.mjs        (port 8760)
   Sabotage: in js/76 make load() answer with STATE.rows=[] regardless — checks 1–3 go red; give the
   merged row a Restore button — check 2 goes red. Assert the sabotage APPLIED with a marker unique
   to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8760;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const H = { 'content-type': 'application/json', apikey: 'x', authorization: 'Bearer x', prefer: 'return=representation' };
const patch = (id, body) => fetch(`${BASE}/rest/v1/businesses?id=eq.${id}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) }).then((r) => r.json());
const getRow = (id) => fetch(`${BASE}/rest/v1/businesses?id=eq.${id}&select=id,archived_at`, { headers: H }).then((r) => r.json());

async function main() {
  /* archive two seed companies straight in the table — the app's loader must never fetch them */
  await patch('b57', { archived_at: '2026-09-01T09:00:00Z', archived_by: 'colleague@example.com' });
  await patch('b58', { archived_at: '2026-09-02T09:00:00Z', archived_by: 'merged-into:b3 (was: cleanup-2026-08-22-duplicate-of-direct-import)' });   // the live suffix shape
  await patch('b59', { archived_at: '2026-08-23T05:51:00Z', archived_by: 'owner-ruling-2026-08-23' });   // the company the owner ruled out of the app
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
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
  await p.goto(BASE + '/archive', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  /* wait for the TABLE rows (ids L0…L59), not the blob's built-in demo list that fills DB.businesses first,
     and for js/52 to know the role — before that, render('archive') is bounced to Today */
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded the table rows and the role'));
  await p.waitForTimeout(1500);
  await p.evaluate(() => { openLead = null; current = 'archive'; render(); });
  await p.waitForFunction(() => { const c = document.querySelector('#view .v76-archived-companies'); return c && c.getAttribute('data-count') === '3'; }, { timeout: 30000 }).catch(() => {});
  const a = await p.evaluate(() => {
    const c = document.querySelector('#view .v76-archived-companies');
    const rows = c ? [...c.querySelectorAll('[data-v76-row]')].map((r) => ({ id: r.getAttribute('data-v76-row'), kind: r.getAttribute('data-v76-kind'), txt: r.innerText.replace(/\s+/g, ' ').trim(), restore: !!r.querySelector('[data-v76-restore]') })) : null;
    const tile = [...document.querySelectorAll('#view .kl')].find((k) => /Deleted companies/.test(k.textContent));
    const tileN = tile && tile.parentNode.querySelector('.kv') ? tile.parentNode.querySelector('.kv').textContent.trim() : null;
    const oldTile = [...document.querySelectorAll('#view .kl')].some((k) => /^Archived leads$/.test(k.textContent.trim()));
    const note = document.querySelector('#view [data-v76-note]');
    const promise = /Deleted companies are not listed here/.test(document.getElementById('view').innerText);
    const inList = (id) => DB.businesses.some((x) => x.id === id || x.id === id.replace(/^b/, 'L'));   // the app keys companies by legacy_id (L57), the table by id (b57)
    return { count: c && c.getAttribute('data-count'), rows, tileN, oldTile, note: !!note, promise, b57: inList('b57'), b58: inList('b58'), b3: inList('b3') };
  });
  const del = a.rows && a.rows.find((r) => r.id === 'b57'), mer = a.rows && a.rows.find((r) => r.id === 'b58'), rul = a.rows && a.rows.find((r) => r.id === 'b59');
  if (a.count === '3' && a.rows && a.rows.length === 3 && del && mer && rul && /Test Company 57/.test(del.txt) && /Test Company 58/.test(mer.txt) && /Test Company 59/.test(rul.txt)) ok('the Archive page lists the three archived companies by name');
  else fail(`the list: ${JSON.stringify(a)} — the live-site "Archived leads 0"`);
  if (a.tileN === '3' && !a.oldTile) ok('the tile reads "Deleted companies 3" — the old "Archived leads 0" is gone');
  else fail(`tile: ${JSON.stringify({ tileN: a.tileN, oldTile: a.oldTile })}`);
  if (del && del.kind === 'deleted' && del.restore && /deleted by colleague@example.com/.test(del.txt)) ok(`the deleted company says who deleted it and offers Restore: "${del.txt.slice(0, 90)}"`);
  else fail(`deleted row: ${JSON.stringify(del)}`);
  if (mer && mer.kind === 'merged' && !mer.restore && /merged into Test Company 3/.test(mer.txt) && /Activity & Audit/.test(mer.txt)) ok(`the merged company names its survivor and has NO Restore: "${mer.txt.slice(0, 110)}"`);
  else fail(`merged row: ${JSON.stringify(mer)} — a plain Restore here would resurrect the duplicate the merge removed`);
  if (rul && rul.kind === 'ruled' && !rul.restore && /owner ruling/.test(rul.txt) && /not restorable from here/.test(rul.txt)) ok(`the company the owner ruled out says so and has NO Restore: "${rul.txt.slice(0, 100)}"`);
  else fail(`ruled-out row: ${JSON.stringify(rul)} — a Restore button here would put the excluded company back on the list`);
  if (a.note && !a.promise) ok('the footnote no longer promises that nothing can be listed');
  else fail(`footnote: note=${a.note} oldPromise=${a.promise}`);
  if (!a.b57 && !a.b58 && a.b3) ok('control: the archived rows are not in the workspace list; the survivor is');
  else fail(`control: b57=${a.b57} b58=${a.b58} b3=${a.b3}`);
  if (a.rows && !a.rows.some((r) => r.id === 'b3')) ok('control: a company that is not archived is not on the page');
  else fail('a live company is listed as deleted');

  /* ---- 3. Restore ---- */
  await p.click('[data-v76-restore="b57"]'); await p.waitForTimeout(400);
  const box = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 120) }));
  if (!dialogs.length && box.box && /Test Company 57/.test(box.txt)) ok(`Restore asks in the page: "${box.txt.slice(0, 70)}"`);
  else fail(`Restore: dialogs=${JSON.stringify(dialogs)} box=${JSON.stringify(box)}`);
  const nav = p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
  await p.evaluate(() => document.getElementById('pfConfirmYes').click());
  await p.waitForTimeout(1500);
  const row = await getRow('b57');
  if (Array.isArray(row) && row[0] && row[0].archived_at == null) ok('the table row has archived_at cleared');
  else fail(`table row after Restore: ${JSON.stringify(row)}`);
  await nav;
  await p.waitForFunction(() => typeof DB !== 'undefined' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'b57' || x.id === 'L57') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('after the reload, the restored company did not come back into the workspace list'));
  const back = await p.evaluate(() => DB.businesses.some((x) => x.id === 'b57' || x.id === 'L57'));
  if (back) ok('after the reload the company is back on the list');
  await p.waitForTimeout(1500);
  await p.evaluate(() => { openLead = null; current = 'archive'; render(); });
  await p.waitForFunction(() => { const c = document.querySelector('#view .v76-archived-companies'); return c && c.getAttribute('data-count') === '2'; }, { timeout: 30000 }).catch(() => {});
  const after = await p.evaluate(() => { const c = document.querySelector('#view .v76-archived-companies'); return c ? c.getAttribute('data-count') : null; });
  if (after === '2') ok('the Archive page now lists only the merged one and the ruled-out one');
  else fail(`Archive after restore: count=${after}`);
  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\narchive-lists-companies OK — deleted companies are listed, explained, and restorable');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
