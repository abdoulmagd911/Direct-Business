/* probe-delete-sticks.mjs — a record you delete must stay deleted (2026-09-02, round 32).

   js/35 moved requests / proposals / projects / bookings / invoices out of the workspace blob
   into real tables. It loads them once, then — because the blob loader can finish LATER and put
   its stale copy back — it re-asserts the table copy every 1.5 s for ~20 s, triggered by
   `DB.requests !== window.__v59ref`, i.e. by the array's IDENTITY changing.

   The trap: deleting a request is `DB.requests = DB.requests.filter(...)`, which makes a NEW
   array. To the guard that is indistinguishable from the clobber it defends against. So a
   delete in the first ~20 seconds after the page loads could be undone by the guard 1.5 s
   later — and worse, `apply()` also rebuilds the snapshot, so the pending DELETE was erased
   before it was ever sent to the database. The person saw the row vanish, saw it come back,
   and nothing was written. Editing a request is safe by luck: it assigns into the array in
   place (`DB.requests[i] = r`), which keeps the identity.

   This probe deletes a request in that window and asserts it is gone on screen, gone from
   DB.requests, and gone from the table.

   Sabotage: drop the save-wrapper's re-point of __v59ref -> the guard resurrects the row -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8394;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

const ROWS = [
  ['QA keep one', 'Test Company 1', 'New', 1000, 700],
  ['QA delete me', 'Test Company 2', 'Quoting', 2000, 1500],
  ['QA keep two', 'Test Company 3', 'Booked', 3000, 2400],
];
const SEED = {
  app_requests: ROWS.map((r, i) => ({
    id: 'qa-del' + i,
    data: { id: 'qa-del' + i, client: r[1], service: 'Flights', detail: r[0], stage: r[2], owner: 'QA', priority: 'Normal', createdAt: 1788300000000, supplier: 'Provider 1', pnr: '', sell: r[3], cost: r[4], notes: '' },
    updated_at: '2026-08-01T00:00:00Z', updated_by: 'QA',
  })),
};

async function main() {
  const srv = start(PORT, SEED);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.accept());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');

  // deliberately act INSIDE the ~20 s re-assert window — that is the whole point
  await p.waitForTimeout(5200);
  const loaded = await p.evaluate(() => {
    openLead = null; openSup = null; current = 'ops'; render();
    return { n: (DB.requests || []).length, ids: (DB.requests || []).map((r) => r.id), reasserting: DB.requests === window.__v59ref };
  });
  if (loaded.n === 3) ok('three requests loaded from the table');
  else { fail('expected 3 seeded requests, got ' + loaded.n + ' (' + JSON.stringify(loaded.ids) + ')'); }
  if (loaded.reasserting) ok('…and the anti-clobber guard is live right now, which is exactly when a delete is at risk');
  else console.log('  · note: guard reference not set — the window may have closed already');

  // Delete the middle one the way the app does it, then edit another one, still inside the
  // window. The edit matters because a run of apply() also REBUILDS THE SYNC BASELINE (SNAP)
  // from the rows as they stand — and since those rows are the same objects the app mutates in
  // place, an edit made moments earlier is already in the rebuilt baseline. The next sync then
  // sees no difference and never writes it: the note is on the screen and not in the database,
  // and it disappears on the next reload. (The edit itself is not lost from memory — the shared
  // object references carry it through apply(). It is the WRITE that goes missing.)
  await p.evaluate(() => { DB.requests = (DB.requests || []).filter((x) => x.id !== 'qa-del1'); save(); render(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { const r = (DB.requests || []).find((x) => x.id === 'qa-del0'); if (r) { r.notes = 'QA note typed after a delete'; save(); } });
  await p.waitForTimeout(400);
  const straightAfter = await p.evaluate(() => (DB.requests || []).map((r) => r.id));
  if (!straightAfter.includes('qa-del1')) ok('immediately after the delete the request is gone from the screen’s data');
  else fail('the delete did not even take effect locally');

  // now wait out several re-assert ticks — this is where it used to come back
  await p.waitForTimeout(6000);
  const later = await p.evaluate(() => ({
    ids: (DB.requests || []).map((r) => r.id),
    onScreen: /QA delete me/.test((document.getElementById('view') || {}).innerText || ''),
    note: ((DB.requests || []).find((r) => r.id === 'qa-del0') || {}).notes,
  }));
  if (later.note === 'QA note typed after a delete') ok('a note typed straight after the delete is still on screen');
  else fail('the note typed after the delete is gone from the screen: ' + JSON.stringify(later.note));
  const noteRow = await fetch(BASE + '/rest/v1/app_requests?select=id,data').then((r) => r.json()).then((rows) => (Array.isArray(rows) ? rows.find((x) => String(x.id) === 'qa-del0') : null)).catch(() => null);
  if (noteRow && noteRow.data && noteRow.data.notes === 'QA note typed after a delete') ok('…and it actually reached the database — a re-assert would have rebuilt the sync baseline over it, so the next sync would have seen no change and never written it');
  else fail('the note is on screen but NOT in the table (' + JSON.stringify(noteRow && noteRow.data && noteRow.data.notes) + ') — it will vanish on the next reload');
  if (!later.ids.includes('qa-del1')) ok('six seconds and four re-assert ticks later it is still gone — the guard no longer treats a legitimate delete as a clobber');
  else fail('the deleted request CAME BACK ' + JSON.stringify(later.ids) + ' — the ~20 s re-assert window resurrected it and the pending delete was dropped');
  if (!later.onScreen) ok('…and it is not back on the Operations board either');
  else fail('the deleted request is showing on the board again');
  if (later.ids.length === 2 && later.ids.includes('qa-del0') && later.ids.includes('qa-del2')) ok('the other two requests are untouched');
  else fail('collateral damage: ' + JSON.stringify(later.ids));

  // and it must actually be gone from the TABLE, not just from this tab
  const inTable = await fetch(BASE + '/rest/v1/app_requests?select=id').then((r) => r.json()).catch(() => null);
  if (Array.isArray(inTable)) {
    const ids = inTable.map((r) => String(r.id));
    if (!ids.includes('qa-del1')) ok('the row is gone from the table too, so it stays gone after a reload (' + ids.length + ' rows left)');
    else fail('the row is still in the table — the delete never reached the database, so it comes back on reload');
  } else console.log('  · note: could not read the table back directly');

  // a reload must agree
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6500);
  const afterReload = await p.evaluate(() => { openLead = null; current = 'ops'; render(); return (DB.requests || []).map((r) => r.id); });
  if (!afterReload.includes('qa-del1')) ok('after a full reload it is still gone — the delete was durable, not just visual');
  else fail('the request is back after a reload: ' + JSON.stringify(afterReload));

  // editing a request in place must still work and still sync
  await p.evaluate(() => { const r = (DB.requests || [])[0]; if (r) { r.notes = 'QA edited note'; save(); } });
  await p.waitForTimeout(1800);
  const edited = await fetch(BASE + '/rest/v1/app_requests?select=id,data').then((r) => r.json()).catch(() => null);
  const row = Array.isArray(edited) ? edited.find((x) => String(x.id) === 'qa-del0') : null;
  if (row && row.data && row.data.notes === 'QA edited note') ok('an ordinary edit still saves through to the table — the fix did not break the normal path');
  else fail('an edit did not reach the table: ' + JSON.stringify(row && row.data && row.data.notes));

  // the guard must still do the job it was written for: if something OUTSIDE save() swaps the
  // array (the late blob loader), the table copy is re-asserted — minus anything deleted since.
  await p.evaluate(() => { DB.requests = [{ id: 'stale-blob-row', client: 'Stale blob copy', stage: 'New', sell: 1, cost: 1 }]; });
  await p.waitForTimeout(3400);
  const defended = await p.evaluate(() => (DB.requests || []).map((r) => r.id));
  if (!defended.includes('stale-blob-row')) ok('a swap that did NOT go through save() is still overruled — the anti-clobber guard still defends against the late blob loader');
  else fail('the stale blob copy stuck: ' + JSON.stringify(defended) + ' — the guard has been disabled, not corrected');
  if (!defended.includes('qa-del1')) ok('…and re-asserting the table copy still does not resurrect the deleted request');
  else fail('the re-assert brought the deleted request back: ' + JSON.stringify(defended));

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ndelete-sticks OK — a deleted request stays deleted, on screen and in the database');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
