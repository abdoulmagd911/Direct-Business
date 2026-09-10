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
     6. Won (same night): convertToClient asks in the page; Cancel keeps the lead; Confirm converts
        it and the client handover still opens (js/14 now listens for 'lead-converted').
     7–10. proposal delete, Team reset link, guardrails exclusion, supplier editor (see the blocks).
     11. Reports: the achievement form's empty-title refusal is a toast (was alert()); deleting an
        achievement (core-10 rptDelAch) asks in the page; Cancel keeps it, Confirm removes it.
     12. The prompt() boxes (2026-09-10): the Lost reason (core-01 captureLostReason) and quick
        edit's "add a team member" (core-10 qeAddOwner) ask in js/57's pfPrompt box; Enter/OK
        saves the answer, Cancel leaves the lead Lost with no reason.

   Run:  node scripts/qa/probe-no-native-dialogs.mjs        (port 8756)
   Sabotage: in core-02 put `alert("Business name required.")` back — check 1 goes red (a
   native dialog fired); put `if(confirm(_delWarn()))` back — check 2 goes red; in core-10 put
   `if(!confirm('Delete this achievement?'))return;` back — check 11 goes red; in core-01 put
   `prompt(q,…)` back in captureLostReason — block 12's first checks go red. Assert the
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

  /* ---- 6. Won (2026-09-09): the busiest question in the app asks in the page; the handover still opens ---- */
  const wonId = await p.evaluate(() => { const l = DB.businesses.find((x) => !x.isClient); openLead = l.id; current = 'leads'; leadDetailView = 'detail'; render(); return l.id; });
  await p.waitForTimeout(600);
  await p.evaluate((id) => convertToClient(id), wonId); await p.waitForTimeout(400);
  const w1 = await p.evaluate((id) => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 100), client: !!getLead(id).isClient }), wonId);
  if (!dialogs.length && w1.box && /won client/.test(w1.txt) && !w1.client) ok(`Won asks in the page ("${w1.txt.slice(0, 50)}…"); nothing converted yet`);
  else fail(`Won: dialogs=${JSON.stringify(dialogs)} ${JSON.stringify(w1)} — the live-site native confirm() on the Won path`);
  await p.evaluate(() => document.getElementById('pfConfirmNo').click()); await p.waitForTimeout(300);
  const w2 = await p.evaluate((id) => !!getLead(id).isClient, wonId);
  if (!w2) ok('…Cancel keeps it a lead'); else fail('Cancel converted the lead');
  await p.evaluate((id) => convertToClient(id), wonId); await p.waitForTimeout(400); await p.evaluate(() => document.getElementById('pfConfirmYes').click()); await p.waitForTimeout(900);
  const w3 = await p.evaluate((id) => ({ client: !!getLead(id).isClient, handover: !!document.getElementById('c_ln'), title: (document.querySelector('#modal .mh h3') || { textContent: '' }).textContent }), wonId);
  if (!dialogs.length && w3.client && w3.handover && /handover/i.test(w3.title)) ok(`…Confirm converts it and the client handover opens ("${w3.title.slice(0, 40)}") — no native dialog`);
  else fail(`Confirm: ${JSON.stringify(w3)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });

  /* ---- 7. the proposal delete, one of ten confirm() sites moved to askInPage() ---- */
  const offId = await p.evaluate(() => { DB.offers = DB.offers || []; DB.offers.push({ id: 'o-nd-del', ref: 'PR-DEL', client: 'Quill Meadow Probe', subject: 'delete probe', status: 'Draft', date: '2026-09-01' }); current = 'offers'; openOffer = 'o-nd-del'; render(); return 'o-nd-del'; });
  await p.waitForTimeout(500); await p.evaluate((id) => o_del(id), offId); await p.waitForTimeout(300);
  const d7 = await p.evaluate((id) => ({ box: !!document.getElementById('pfConfirmBox'), still: DB.offers.some((o) => o.id === id) }), offId);
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); }); await p.waitForTimeout(200);
  const d7b = await p.evaluate((id) => DB.offers.some((o) => o.id === id), offId);
  await p.evaluate((id) => o_del(id), offId); await p.waitForTimeout(300); await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await p.waitForTimeout(400);
  const d7c = await p.evaluate((id) => DB.offers.some((o) => o.id === id), offId);
  if (!dialogs.length && d7.box && d7.still && d7b && !d7c) ok('delete proposal: in-page box, Cancel keeps it, Confirm removes it — no native dialog');
  else fail(`delete proposal: ${JSON.stringify({ d7, d7b, d7c })} dialogs=${JSON.stringify(dialogs)}`);

  /* ---- 8. Team & Access "Send reset link" asks in the page (js/31) ---- */
  await p.evaluate(() => { try { closeModal(); } catch (_) { } v48Users(); });
  await p.waitForSelector('#v48list [data-rst]', { timeout: 15000 }).catch(() => fail('Team & Access never listed a Send-reset button'));
  await p.evaluate(() => { const b = document.querySelector('#v48list [data-rst]'); if (b) b.click(); }); await p.waitForTimeout(400);
  const r8 = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 80) }));
  if (!dialogs.length && r8.box && /password reset link/.test(r8.txt)) ok(`Send reset link asks in the page: "${r8.txt.slice(0, 60)}"`); else fail(`Send reset link: ${JSON.stringify(r8)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); const o = document.getElementById('v48ov'); if (o) o.remove(); });

  /* ---- 9. the Finance guardrails card (js/62): removing an exclusion asks in the page ---- */
  await p.evaluate(() => { DB.settings = DB.settings || {}; DB.settings.financeExclusions = DB.settings.financeExclusions || []; DB.settings.financeExclusions.push({ id: 'fx-nd', clientId: 'x', matchNames: ['Probe Excluded Co'], reason: 'probe', addedBy: 'QA', addedAt: new Date().toISOString() }); v62RemoveExclusion('fx-nd'); });
  await p.waitForTimeout(400);
  const r9 = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 80), still: (DB.settings.financeExclusions || []).some((e) => e.id === 'fx-nd') }));
  if (!dialogs.length && r9.box && /Remove this exclusion/.test(r9.txt) && r9.still) ok(`guardrails: removing an exclusion asks in the page ("${r9.txt.slice(0, 50)}…"), nothing removed yet`);
  else fail(`guardrails exclusion: ${JSON.stringify(r9)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await p.waitForTimeout(400);
  const r9b = await p.evaluate(() => (DB.settings.financeExclusions || []).some((e) => e.id === 'fx-nd'));
  if (!r9b) ok('…Confirm removes the exclusion'); else fail('Confirm did not remove the exclusion');

  /* ---- 10. the Airlines / Suppliers editor (core-03 editSupplier, flagged by the other session) ---- */
  await p.evaluate(() => { openLead = null; current = 'airlines'; render(); editSupplier('air'); });
  await p.waitForSelector('#x_name', { timeout: 5000 }).catch(() => fail('the supplier editor never opened'));
  await p.evaluate(() => { document.getElementById('x_name').value = ''; document.getElementById('mSave').click(); }); await p.waitForTimeout(500);
  const t10 = await toastText();
  if (!dialogs.length && /Name required|الاسم/.test(t10)) ok(`supplier editor, empty name: toast "${t10.slice(0, 30)}", no native alert`); else fail(`supplier editor empty name: dialogs=${JSON.stringify(dialogs)} toast="${t10}"`);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });
  const airId = await p.evaluate(() => (DB.airlines || [])[0] && DB.airlines[0].id);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);   // the event form from block 5 may still be up
  await p.evaluate((id) => editSupplier('air', id), airId); await p.waitForSelector('#mDel', { timeout: 5000 }).catch(() => fail('no Delete on the supplier editor'));
  await p.evaluate(() => document.getElementById('mDel').click()); await p.waitForTimeout(400);
  const r10 = await p.evaluate((id) => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 80), still: (DB.airlines || []).some((a) => a.id === id) }), airId);
  if (!dialogs.length && r10.box && /Delete "/.test(r10.txt) && r10.still) ok(`delete airline: in-page box ("${r10.txt.slice(0, 50)}…"), nothing removed yet`); else fail(`delete airline: ${JSON.stringify(r10)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); }); await p.waitForTimeout(200);
  const r10b = await p.evaluate((id) => (DB.airlines || []).some((a) => a.id === id), airId);
  if (r10b) ok('…Cancel keeps the airline'); else fail('Cancel removed the airline');

  /* ---- 11. Reports: the achievement form's empty-title refusal is a toast; deleting an achievement (core-10 rptDelAch) asks in the page ---- */
  await p.evaluate(() => { try { closeModal(); } catch (_) { } openLead = null; current = 'reports'; render(); rptOpenAch(); });
  await p.waitForSelector('#rf_title', { timeout: 5000 }).catch(() => fail('the achievement form never opened'));
  await p.evaluate(() => { document.getElementById('rf_title').value = ''; document.getElementById('mSave').click(); }); await p.waitForTimeout(500);
  const t11 = await toastText();
  const f11 = await p.evaluate(() => ({ open: document.getElementById('ov').classList.contains('show'), focused: document.activeElement && document.activeElement.id }));
  if (!dialogs.length && /what was achieved/i.test(t11) && f11.open) ok(`achievement form, empty title: toast "${t11.slice(0, 36)}", form stays open, no native alert`);   // focus is not asserted: headless Chromium drops it under load else fail(`achievement form empty title: dialogs=${JSON.stringify(dialogs)} toast="${t11}" ${JSON.stringify(f11)}`);
  await p.evaluate(() => { document.getElementById('rf_title').value = 'QA probe achievement'; document.getElementById('mSave').click(); }); await p.waitForTimeout(500);
  const achId = await p.evaluate(() => { try { const d = JSON.parse(localStorage.getItem('directReportsData_v1')); const a = (d.achievements || []).find((x) => x.title === 'QA probe achievement'); return a && a.id; } catch (_) { return null; } });
  if (achId) ok('…with a title, the achievement is logged'); else fail('the achievement was not logged');
  const achCount = () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('directReportsData_v1')).achievements.filter((x) => x.title === 'QA probe achievement').length; } catch (_) { return -1; } });
  await p.evaluate((id) => rptDelAch(id), achId); await p.waitForTimeout(400);
  const r11 = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 80) }));
  if (!dialogs.length && r11.box && /Delete this achievement/.test(r11.txt) && (await achCount()) === 1) ok(`delete achievement: in-page box ("${r11.txt.slice(0, 40)}…"), nothing removed yet`); else fail(`delete achievement: ${JSON.stringify(r11)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); }); await p.waitForTimeout(200);
  if ((await achCount()) === 1) ok('…Cancel keeps the achievement'); else fail('Cancel removed the achievement');
  await p.evaluate((id) => rptDelAch(id), achId); await p.waitForTimeout(300);
  await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await p.waitForTimeout(400);
  if (!dialogs.length && (await achCount()) === 0) ok('…Confirm removes it — no native dialog'); else fail(`Confirm: count=${await achCount()} dialogs=${JSON.stringify(dialogs)}`);

  /* ---- 12. the browser's prompt() boxes: the Lost reason (core-01) and quick edit's "add a team member" (core-10) ask in the page ---- */
  const lostId = await p.evaluate(() => { const l = DB.businesses.find((x) => !x.isClient && leadStage(x) !== 'Lost'); return l ? l.id : null; });
  await p.evaluate((id) => { openLead = null; current = 'leads'; render(); leadQuickEdit(id); }, lostId); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('qe_stage').value = 'Lost'; document.getElementById('mSave').click(); }); await p.waitForTimeout(500);
  const r12 = await p.evaluate(() => ({ box: !!document.getElementById('pfPromptBox'), q: (document.querySelector('#pfPromptBox [data-pf-prompt-text]') || { textContent: '' }).textContent, focused: document.activeElement && document.activeElement.id }));
  if (!dialogs.length && r12.box && /Why did we lose|لماذا خسرنا/.test(r12.q)) ok(`Lost: the reason is asked in the page ("${r12.q.slice(0, 40)}…"), no native prompt`); else fail(`Lost reason: ${JSON.stringify(r12)} dialogs=${JSON.stringify(dialogs)}`);
  await p.fill('#pfPromptInput', 'Budget cut, probe reason'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  const r12b = await p.evaluate((id) => { const b = getLead(id); return { stage: leadStage(b), reason: b.lostReason || '', act: (b.activities || []).some((a) => /probe reason/.test(a.note || '')), box: !!document.getElementById('pfPromptBox') }; }, lostId);
  if (r12b.stage === 'Lost' && r12b.reason === 'Budget cut, probe reason' && r12b.act && !r12b.box) ok('…Enter saves the reason on the record with a Lost activity; the box is gone'); else fail(`Lost reason saved: ${JSON.stringify(r12b)}`);
  const lostId2 = await p.evaluate(() => { const l = DB.businesses.find((x) => !x.isClient && leadStage(x) !== 'Lost'); return l ? l.id : null; });
  await p.evaluate((id) => { leadQuickEdit(id); }, lostId2); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('qe_stage').value = 'Lost'; document.getElementById('mSave').click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const n = document.getElementById('pfPromptNo'); if (n) n.click(); }); await p.waitForTimeout(400);
  const r12c = await p.evaluate((id) => { const b = getLead(id); return { stage: leadStage(b), reason: b.lostReason || '' }; }, lostId2);
  if (!dialogs.length && r12c.stage === 'Lost' && r12c.reason === '') ok('…Cancel: the lead is still Lost, with no reason — what the old box\'s Cancel did'); else fail(`Lost + Cancel: ${JSON.stringify(r12c)}`);
  await p.evaluate((id) => { qeAddOwner(id); }, lostId2); await p.waitForTimeout(400);
  const r12d = await p.evaluate(() => ({ box: !!document.getElementById('pfPromptBox'), q: (document.querySelector('#pfPromptBox [data-pf-prompt-text]') || { textContent: '' }).textContent }));
  if (!dialogs.length && r12d.box && /team member/i.test(r12d.q)) ok('quick edit "add a team member": asks the name in the page'); else fail(`add owner: ${JSON.stringify(r12d)} dialogs=${JSON.stringify(dialogs)}`);
  await p.fill('#pfPromptInput', 'Probe Person'); await p.evaluate(() => document.getElementById('pfPromptOk').click()); await p.waitForTimeout(500);
  const r12e = await p.evaluate(() => ({ inTeam: (typeof teamList === 'function' ? teamList() : []).indexOf('Probe Person') >= 0, formOpen: document.getElementById('ov').classList.contains('show'), owner: (document.getElementById('qe_owner') || {}).value }));
  if (r12e.inTeam && r12e.formOpen && r12e.owner === 'Probe Person') ok('…OK adds the person to the team and re-opens the quick edit with them selected'); else fail(`add owner OK: ${JSON.stringify(r12e)}`);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nno-native-dialogs OK — the create and delete forms speak in the page');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
