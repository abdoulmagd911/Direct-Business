/* probe-no-native-dialogs.mjs (2026-09-09, live test finding D1) — the create and delete forms
   for leads and requests speak in the page, never through the browser's own alert()/confirm()
   boxes. Attack area (ad).

   PORT NOTE: 8701–8755 are taken. This is 8756, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: saving a new business with an empty name raised a native
   alert("Business name required.") and deleting a lead raised a native confirm(). A native
   dialog freezes the whole tab — two of the owner's own test tabs froze on exactly this — and
   the later chapters (js/57 pfConfirm, js/16 finConfirm, js/45) had already moved off it.

   Under test (Playwright's dialog event catches every native alert/confirm/prompt — if one
   fires, the check is red whatever else happens):
     1. New business, empty name, Save → no native dialog; a toast says the name is required
        and the name box is focused; nothing was added.
     2. Edit an existing lead → Delete → no native dialog; the in-page confirm box appears with
        the honest archive text; Cancel keeps the lead; Confirm removes it.
     3. New request, empty client, Save → no native dialog; toast; nothing added.
     4. Edit a request → Delete → in-page box; Confirm removes it.
     5. Events (added the same evening): the row button reads "Delete" not "Del"; deleting asks in
        the page and says it cannot be undone; Cancel keeps it, Confirm removes the table row; the
        form's empty-name refusal is a toast.

   Run:  node scripts/qa/probe-no-native-dialogs.mjs        (port 8756)
   Sabotage: in core-02 put `alert("Business name required.")` back — check 1 goes red (a
   native dialog fired); put `if(confirm(_delWarn()))` back — check 2 goes red. Assert the
   sabotage APPLIED with a marker unique to it; confirm the restore by marker count and git
   status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8756;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT, { app_requests: [{ id: 'r-nd-1', data: { id: 'r-nd-1', client: 'Quill Meadow Probe', service: 'Flights', stage: 'New', owner: 'QA', priority: 'Normal', sell: 0, createdAt: Date.now() } }] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 60)); await d.dismiss(); });
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof editBusiness === 'function' && Array.isArray(DB.requests) && DB.requests.some((r) => r.id === 'r-nd-1'), { timeout: 90000 }).catch(() => fail('the app never finished loading'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s (see probe-today-queue-card)
  const toastText = () => p.evaluate(() => [...document.querySelectorAll('.toast, #toast, [class*="toast"]')].map((t) => t.textContent.trim()).filter(Boolean).join(' | '));

  /* ---- 1. new business, empty name ---- */
  let n0 = await p.evaluate(() => { current = 'leads'; openLead = null; render(); return DB.businesses.length; });
  await p.evaluate(() => editBusiness());
  await p.waitForSelector('#f_name', { timeout: 5000 });
  await p.click('#mSave'); await p.waitForTimeout(600);
  let r1 = await p.evaluate(() => ({ n: DB.businesses.length, focused: document.activeElement && document.activeElement.id, modalOpen: document.getElementById('ov').classList.contains('show') }));
  let t1 = await toastText();
  if (!dialogs.length && r1.n === n0 && /name required|اسم/i.test(t1) && /⚠/.test(t1) && r1.focused === 'f_name') ok(`empty name: no native dialog, toast "${t1.slice(0, 40)}", name box focused, nothing added`);
  else fail(`empty name: dialogs=${JSON.stringify(dialogs)} added=${r1.n - n0} toast="${t1}" focused=${r1.focused} — the live-site alert("Business name required.")`);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });

  /* ---- 2. delete a lead ---- */
  const target = await p.evaluate(() => { const l = DB.businesses.find((x) => !x.isClient); return l ? l.id : null; });
  await p.evaluate((id) => editBusiness(id), target);
  await p.waitForSelector('#mDel', { timeout: 5000 });
  await p.click('#mDel'); await p.waitForTimeout(500);
  let r2 = await p.evaluate((id) => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 160), still: DB.businesses.some((x) => x.id === id) }), target);
  if (!dialogs.length && r2.box && /archived|Undo/i.test(r2.txt) && r2.still) ok(`delete lead: in-page box with the honest archive text ("${r2.txt.slice(0, 60)}…"), lead still there until confirmed`);
  else fail(`delete lead: dialogs=${JSON.stringify(dialogs)} box=${r2.box} still=${r2.still} txt="${r2.txt}" — the live-site native confirm()`);
  await p.click('#pfConfirmNo'); await p.waitForTimeout(300);
  let r2b = await p.evaluate((id) => ({ box: !!document.getElementById('pfConfirmBox'), still: DB.businesses.some((x) => x.id === id) }), target);
  if (!r2b.box && r2b.still) ok('…Cancel closes the box and keeps the lead');
  else fail(`Cancel: ${JSON.stringify(r2b)}`);
  await p.evaluate((id) => editBusiness(id), target); await p.waitForSelector('#mDel', { timeout: 5000 }); await p.click('#mDel'); await p.waitForTimeout(400); await p.click('#pfConfirmYes'); await p.waitForTimeout(600);
  let r2c = await p.evaluate((id) => ({ still: DB.businesses.some((x) => x.id === id) }), target);
  if (!dialogs.length && !r2c.still) ok('…Confirm removes the lead — no native dialog at any point');
  else fail(`Confirm: dialogs=${JSON.stringify(dialogs)} still=${r2c.still}`);

  /* ---- 3. new request, empty client ---- */
  const q0 = await p.evaluate(() => { current = 'ops'; render(); return DB.requests.length; });
  await p.evaluate(() => editRequest()); await p.waitForSelector('#r_client', { timeout: 5000 });
  await p.click('#mSave'); await p.waitForTimeout(600);
  const r3 = await p.evaluate(() => ({ n: DB.requests.length, focused: document.activeElement && document.activeElement.id }));
  const t3 = await toastText();
  if (!dialogs.length && r3.n === q0 && /Client required|العميل/i.test(t3)) ok(`empty request client: no native dialog, toast "${t3.slice(0, 40)}", nothing added`);
  else fail(`empty request client: dialogs=${JSON.stringify(dialogs)} added=${r3.n - q0} toast="${t3}"`);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });

  /* ---- 4. delete a request ---- */
  await p.evaluate(() => editRequest('r-nd-1')); await p.waitForSelector('#mDel', { timeout: 5000 }); await p.click('#mDel'); await p.waitForTimeout(400);
  const r4 = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 80) }));
  if (r4.box) { await p.click('#pfConfirmYes'); await p.waitForTimeout(600); }
  const r4b = await p.evaluate(() => ({ still: DB.requests.some((x) => x.id === 'r-nd-1') }));
  if (!dialogs.length && r4.box && !r4b.still) ok(`delete request: in-page box ("${r4.txt}"), Confirm removes it`);
  else fail(`delete request: dialogs=${JSON.stringify(dialogs)} box=${r4.box} still=${r4b.still}`);

  /* ---- 5. Events (2026-09-09, live test "Del"): the delete button reads Delete, asks in the page, says it cannot be undone ---- */
  await p.evaluate(() => { openLead = null; current = 'events'; render(); });
  await p.waitForFunction(() => [...document.querySelectorAll('#view button')].some((b) => /^Delete$|^حذف$/.test(b.textContent.trim())), { timeout: 30000 }).catch(() => {});
  const ev = await p.evaluate(() => { const btns = [...document.querySelectorAll('#view button')]; return { del: btns.filter((b) => /^Delete$/.test(b.textContent.trim())).length, abbrev: btns.filter((b) => /^Del$/.test(b.textContent.trim())).length, n: (DB.ksaEvents || []).length }; });
  if (ev.del > 0 && ev.abbrev === 0) ok(`Events: ${ev.del} rows carry a "Delete" button — no "Del"`); else fail(`Events buttons: ${JSON.stringify(ev)} — the live-site red "Del"`);
  const evId = await p.evaluate(() => (DB.ksaEvents || [])[0] && DB.ksaEvents[0].id);
  await p.evaluate((id) => evDelete(id), evId); await p.waitForTimeout(400);
  const r5 = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 140) }));
  if (!dialogs.length && r5.box && /cannot be undone/.test(r5.txt) && /whole team/.test(r5.txt)) ok(`delete event: in-page box, honest text ("${r5.txt.slice(0, 70)}…")`);
  else fail(`delete event: dialogs=${JSON.stringify(dialogs)} ${JSON.stringify(r5)} — the live-site native confirm()`);
  await p.evaluate(() => document.getElementById('pfConfirmNo').click()); await p.waitForTimeout(300);
  const r5b = await p.evaluate((id) => ({ still: (DB.ksaEvents || []).some((e) => e.id === id), box: !!document.getElementById('pfConfirmBox') }), evId);
  if (r5b.still && !r5b.box) ok('…Cancel keeps the event'); else fail(`Cancel: ${JSON.stringify(r5b)}`);
  await p.evaluate((id) => evDelete(id), evId); await p.waitForTimeout(400); await p.evaluate(() => document.getElementById('pfConfirmYes').click()); await p.waitForTimeout(1500);
  const r5c = await p.evaluate((id) => ({ still: (DB.ksaEvents || []).some((e) => e.id === id), n: (DB.ksaEvents || []).length }), evId);
  const stored = await fetch(`${BASE}/rest/v1/ksa_events?id=eq.${evId}`, { headers: { apikey: 'x' } }).then((r) => r.json()).catch(() => null);
  if (!dialogs.length && !r5c.still && Array.isArray(stored) && stored.length === 0) ok('…Confirm deletes the event (table row gone) — no native dialog'); else fail(`Confirm: ${JSON.stringify({ r5c, stored })} dialogs=${JSON.stringify(dialogs)}`);
  /* the empty-name refusal in the event form speaks through the toast */
  await p.evaluate(() => evOpenModal()); await p.waitForSelector('#ev_n', { timeout: 5000 }).catch(() => fail('the event form never opened'));
  await p.evaluate(() => { document.getElementById('ev_n').value = ''; document.getElementById('ev_save').click(); }); await p.waitForTimeout(600);
  const t5 = await toastText();
  if (!dialogs.length && /name is required|مطلوب/i.test(t5)) ok(`event form, empty name: toast "${t5.slice(0, 40)}", no native alert`); else fail(`event form empty name: dialogs=${JSON.stringify(dialogs)} toast="${t5}"`);
  await p.evaluate(() => { const c = document.getElementById('ev_close') || [...document.querySelectorAll('button')].find((b) => /^(Cancel|إلغاء)$/.test(b.textContent.trim())); if (c) c.click(); });

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nno-native-dialogs OK — the create and delete forms speak in the page');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
