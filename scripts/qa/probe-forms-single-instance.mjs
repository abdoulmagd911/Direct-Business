/* probe-forms-single-instance.mjs (2026-09-10) — every form and question box in the app is one
   at a time: a second open (a double-click, a form left up) never stacks a dead copy. Attack area (ad).

   PORT NOTE: 8701–8771 are taken. This is 8772, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand (second live pass): the Events edit form, opened while one was
   already up, drew a second form whose Cancel and Save did nothing — its handlers were wired
   through document.getElementById, which answered the FIRST form's buttons. That form is fixed
   in js/10 (probe-events holds it). This probe holds the same rule for everything else that
   opens over the page, so the class of defect cannot come back one form at a time:

     1. Log activity ×2 → one #a_note, Save writes the note and closes.
     2. New business ×2 → one #f_name, Save adds exactly one company and closes.
     3. Quick edit ×2 → one #qe_stage, Save writes the next action and closes.
     4. Edit business ×2 (an existing one) → one #f_name.
     5. pfConfirm ×2 → one box; Confirm runs the LAST question's callback only.
     6. pfPrompt ×2 → one box; OK answers the LAST question only.
     7. The Share panel ×2 → one panel; Close leaves none.
     8. The Events form ×2 → one form (js/10's own fix, held here as well as in probe-events).
     No native dialog anywhere.

   Run:  node scripts/qa/probe-forms-single-instance.mjs        (port 8772)
   Sabotage: in js/57 pfConfirm remove `var old=document.getElementById('pfConfirmBox'); if(old)old.remove();`
   — check 5 goes red (two boxes); in js/10 evOpenModal remove the `[data-ev-form]` sweep — check 8
   goes red. Assert the sabotage APPLIED with a marker unique to it; confirm the restore by marker
   count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8772;
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && window.__roleKnown === true && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3'), { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s after load
  const wait = (ms) => p.waitForTimeout(ms);
  const ovOpen = () => p.evaluate(() => document.getElementById('ov').classList.contains('show'));

  /* ---- 1. Log activity ---- */
  await p.evaluate(() => { current = 'leads'; openLead = 'L3'; render(); }); await wait(600);
  await p.evaluate(() => { logActivity('L3'); logActivity('L3'); }); await wait(400);
  const n1 = await p.evaluate(() => document.querySelectorAll('#a_note').length);
  await p.evaluate(() => { document.getElementById('a_note').value = 'stacked probe note'; document.getElementById('mSave').click(); }); await wait(600);
  const r1 = await p.evaluate(() => (getLead('L3').activities || []).some((a) => /stacked probe note/.test(a.note || '')));
  if (n1 === 1 && r1 && !(await ovOpen())) ok('Log activity ×2: one form; Save writes the note and closes'); else fail(`Log activity ×2: forms=${n1} saved=${r1}`);

  /* ---- 2. New business ---- */
  const n0 = await p.evaluate(() => DB.businesses.length);
  await p.evaluate(() => { editBusiness(); editBusiness(); }); await wait(400);
  const n2 = await p.evaluate(() => document.querySelectorAll('#f_name').length);
  await p.evaluate(() => { document.getElementById('f_name').value = 'Stacked Probe Co'; document.getElementById('mSave').click(); }); await wait(600);
  const added = (await p.evaluate(() => DB.businesses.length)) - n0;
  if (n2 === 1 && added === 1 && !(await ovOpen())) ok('New business ×2: one form; Save adds exactly one company and closes'); else fail(`New business ×2: forms=${n2} added=${added}`);

  /* ---- 3. Quick edit ---- */
  await p.evaluate(() => { leadQuickEdit('L4'); leadQuickEdit('L4'); }); await wait(400);
  const n3 = await p.evaluate(() => document.querySelectorAll('#qe_stage').length);
  await p.evaluate(() => { document.getElementById('qe_next').value = 'stacked next'; document.getElementById('mSave').click(); }); await wait(600);
  const r3 = await p.evaluate(() => getLead('L4').nextAction === 'stacked next');
  if (n3 === 1 && r3 && !(await ovOpen())) ok('Quick edit ×2: one form; Save writes and closes'); else fail(`Quick edit ×2: forms=${n3} saved=${r3}`);

  /* ---- 4. Edit business ---- */
  await p.evaluate(() => { editBusiness('L5'); editBusiness('L5'); }); await wait(400);
  const n4 = await p.evaluate(() => document.querySelectorAll('#f_name').length);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });
  if (n4 === 1) ok('Edit business ×2: one form'); else fail(`Edit business ×2: forms=${n4}`);

  /* ---- 5. pfConfirm ---- */
  const r5 = await p.evaluate(async () => { let ran = 0; window.pfConfirm('q1', () => { ran += 1; }); window.pfConfirm('q2', () => { ran += 10; }); await new Promise((r) => setTimeout(r, 200)); const boxes = document.querySelectorAll('#pfConfirmBox').length; document.getElementById('pfConfirmYes').click(); await new Promise((r) => setTimeout(r, 200)); return { boxes, ran, left: document.querySelectorAll('#pfConfirmBox').length }; });
  if (r5.boxes === 1 && r5.ran === 10 && r5.left === 0) ok('pfConfirm ×2: one box; Confirm runs the last question only'); else fail(`pfConfirm ×2: ${JSON.stringify(r5)}`);

  /* ---- 6. pfPrompt ---- */
  const r6 = await p.evaluate(async () => { const got = []; window.pfPrompt('p1', '', (v) => got.push('1:' + v)); window.pfPrompt('p2', '', (v) => got.push('2:' + v)); await new Promise((r) => setTimeout(r, 200)); const boxes = document.querySelectorAll('#pfPromptBox').length; document.getElementById('pfPromptInput').value = 'x'; document.getElementById('pfPromptOk').click(); await new Promise((r) => setTimeout(r, 200)); return { boxes, got, left: document.querySelectorAll('#pfPromptBox').length }; });
  if (r6.boxes === 1 && r6.got.length === 1 && r6.got[0] === '2:x' && r6.left === 0) ok('pfPrompt ×2: one box; OK answers the last question only'); else fail(`pfPrompt ×2: ${JSON.stringify(r6)}`);

  /* ---- 7. Share panel ---- */
  const r7 = await p.evaluate(async () => { if (!window.shareLinksPanel) return null; shareLinksPanel(); shareLinksPanel(); await new Promise((r) => setTimeout(r, 300)); const boxes = document.querySelectorAll('#shareBox').length; document.querySelector('#shareBox [data-share-close]').click(); await new Promise((r) => setTimeout(r, 200)); return { boxes, left: document.querySelectorAll('#shareBox').length }; });
  if (r7 && r7.boxes === 1 && r7.left === 0) ok('Share panel ×2: one panel; Close leaves none'); else fail(`Share panel ×2: ${JSON.stringify(r7)}`);

  /* ---- 8. Events form ---- */
  await p.evaluate(() => { openLead = null; current = 'events'; render(); });
  await p.waitForFunction(() => Array.isArray(DB.ksaEvents) && DB.ksaEvents.length > 0, { timeout: 30000 }).catch(() => {});
  const r8 = await p.evaluate(async () => { await new Promise((r) => setTimeout(r, 400)); const id = (DB.ksaEvents || [])[0] && DB.ksaEvents[0].id; if (!id) return null; evOpenModal(id); evOpenModal(id); await new Promise((r) => setTimeout(r, 400)); const forms = document.querySelectorAll('[data-ev-form]').length; const c = document.querySelector('[data-ev-form] #ev_cancel'); if (c) c.click(); await new Promise((r) => setTimeout(r, 300)); return { forms, left: document.querySelectorAll('[data-ev-form]').length }; });
  if (r8 && r8.forms === 1 && r8.left === 0) ok('Events form ×2: one form; its Cancel closes it'); else fail(`Events form ×2: ${JSON.stringify(r8)} — the live-site dead second form`);

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nforms-single-instance OK — every form and box is one at a time, and the one on screen works');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
