/* probe-activity-edit-remove.mjs (2026-09-09, live test findings A2, A5) — a logged activity can
   be corrected or removed from the card, and "Last contact" follows what is actually on the
   record. Attack area (ad).

   PORT NOTE: 8701–8762 are taken. This is 8763, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: A2 a logged activity could never be corrected or removed (two
   duplicate 13 Aug "Rehearsal" calls were stuck on a client for that reason). A5 logging a note
   moved "Last contact" to today, and removing the note (in the database, by hand) did not move
   it back — the app never recomputes it.

   Under test, on a lead with two activities (an old call, a fresh note):
     1. Each timeline entry carries data-act-i and an edit and a remove control (admin here).
     2. Remove the fresh note through the in-page box (no native confirm) → the entry is gone,
        lastContact falls back to the old call's date, the record saved to the table carries the
        recomputed value.
     3. Edit the remaining call: change the note text and the type → the entry shows the new
        words and an "(edited)" mark; the date is kept.
     4. Cancel on the remove box keeps the entry.
     5. Control: a viewer (mayEditPage false) sees the entries but no controls.

   Run:  node scripts/qa/probe-activity-edit-remove.mjs        (port 8763)
   Sabotage: in core-02 make recomputeLastContact() a no-op — check 2 goes red (lastContact stays
   at the removed note's date); delete the remove control from _actMeta — check 1 goes red. Assert
   the sabotage APPLIED with a marker unique to it; confirm the restore by marker count and git
   status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8763;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const OLD = Date.now() - 20 * 864e5, FRESH = Date.now() - 3600e3;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type()); await d.dismiss(); });
  const saved = [];   // what the app writes to the businesses table
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (/\/rest\/v1\/businesses/.test(u.pathname) && !['GET', 'HEAD'].includes(rq.method())) { try { saved.push(JSON.parse(rq.postData() || 'null')); } catch (_) { } }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s (see probe-today-queue-card)
  const id = await p.evaluate(({ OLD, FRESH }) => { const l = DB.businesses.find((x) => !x.isClient && x.id === 'L5'); l.activities = [{ date: OLD, type: 'Call', note: 'old call probe', by: 'QA' }, { date: FRESH, type: 'Note', note: 'fresh note probe', by: 'QA' }]; l.lastContact = FRESH; openLead = l.id; current = 'leads'; leadDetailView = 'detail'; render(); return l.id; }, { OLD, FRESH });
  await p.waitForSelector('#view .tl-item[data-act-i]', { timeout: 15000 }).catch(() => fail('the timeline never rendered'));
  const a = await p.evaluate(() => [...document.querySelectorAll('#view .timeline .tl-item')].map((x) => ({ i: x.getAttribute('data-act-i'), edit: !!x.querySelector('[data-act-edit]'), remove: !!x.querySelector('[data-act-remove]'), txt: x.innerText.replace(/\s+/g, ' ').slice(0, 80) })));
  if (a.length === 2 && a.every((x) => x.edit && x.remove) && a[0].i === '1' && a[1].i === '0') ok('both entries carry their index and an edit / remove control');
  else fail(`timeline: ${JSON.stringify(a)} — the live-site card with no way to correct an entry`);

  /* ---- 4. cancel keeps it ---- */
  await p.click('#view [data-act-remove="1"]'); await p.waitForTimeout(400);
  const box = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 140) }));
  if (box.box && /fresh note probe/.test(box.txt) && /Last contact/.test(box.txt)) ok(`remove asks in the page and says last contact is recomputed: "${box.txt.slice(0, 80)}…"`);
  else fail(`remove box: ${JSON.stringify(box)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => document.getElementById('pfConfirmNo').click()); await p.waitForTimeout(300);
  const kept = await p.evaluate((id) => getLead(id).activities.length, id);
  if (kept === 2) ok('Cancel keeps the entry'); else fail(`Cancel: ${kept} entries left`);

  /* ---- 2. remove the fresh note → last contact falls back ---- */
  await p.click('#view [data-act-remove="1"]'); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('pfConfirmYes').click()); await p.waitForTimeout(2500);
  const r2 = await p.evaluate(({ id, OLD }) => { const l = getLead(id); return { n: l.activities.length, lc: l.lastContact, old: OLD, items: document.querySelectorAll('#view .timeline .tl-item').length }; }, { id, OLD });
  if (!dialogs.length && r2.n === 1 && r2.lc === OLD && r2.items === 1) ok(`removed: one entry left, lastContact fell back to the old call (${new Date(r2.lc).toISOString().slice(0, 10)})`);
  else fail(`remove: ${JSON.stringify(r2)} dialogs=${JSON.stringify(dialogs)} — the live-site last contact that never moved back`);
  const savedRow = saved.flat().reverse().find((row) => row && row.legacy_id === id);
  const savedLc = savedRow && savedRow.raw && savedRow.raw.lastContact;
  if (savedRow && savedLc === OLD && Array.isArray(savedRow.raw.activities) && savedRow.raw.activities.length === 1) ok('the record saved to the table carries the recomputed last contact and one activity');
  else fail(`saved row: ${JSON.stringify(savedRow ? { lc: savedLc, acts: savedRow.raw && savedRow.raw.activities && savedRow.raw.activities.length } : null)}`);

  /* ---- 3. edit the remaining call ---- */
  await p.click('#view [data-act-edit="0"]'); await p.waitForSelector('#ae_note', { timeout: 5000 }).catch(() => fail('the edit form never opened'));
  await p.fill('#ae_note', 'corrected call probe'); await p.selectOption('#ae_type', 'Meeting'); await p.click('#mSave'); await p.waitForTimeout(900);
  const r3 = await p.evaluate(({ id, OLD }) => { const l = getLead(id); const a = l.activities[0]; const it = document.querySelector('#view .timeline .tl-item'); return { type: a.type, note: a.note, date: a.date, old: OLD, edited: !!a.edited, mark: !!(it && it.querySelector('[data-act-edited]')), txt: it ? it.innerText.replace(/\s+/g, ' ') : '' }; }, { id, OLD });
  if (r3.type === 'Meeting' && r3.note === 'corrected call probe' && r3.date === OLD && r3.edited && r3.mark && /corrected call probe/.test(r3.txt) && /edited/.test(r3.txt)) ok(`edited: "${r3.txt.slice(0, 90)}" — new words, new type, same date, marked (edited)`);
  else fail(`edit: ${JSON.stringify(r3)}`);

  /* ---- 5. a viewer sees no controls ---- */
  const v = await p.evaluate(() => { window.__pageAccess = { leads: 'viewer' }; window.__userRole = 'team_member'; render(); return new Promise((res) => setTimeout(() => res({ items: document.querySelectorAll('#view .timeline .tl-item').length, ctrls: document.querySelectorAll('#view [data-act-edit],#view [data-act-remove]').length }), 700)); });
  if (v.items === 1 && v.ctrls === 0) ok('control: a viewer sees the entry but no edit / remove control');
  else fail(`viewer: ${JSON.stringify(v)}`);

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nactivity-edit-remove OK — a logged activity can be corrected or removed, and last contact follows the record');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
