/* probe-clause-template-asks.mjs (2026-09-10, second live pass — Generator, contract tab) — the two
   clause buttons that discard or overwrite wording ask first, in the page. Attack area (ad).

   PORT NOTE: 8701–8776 are taken. This is 8777, verified free by scanning every PORT= in
   scripts/qa.

   Found in the contract editor (js/70): once a clause has been reworded for one contract, two
   buttons appear beside it. "Reset to template" threw the typed wording away on one click.
   "Save to shared template" (admin/manager) overwrote, on one click, the clause that every
   future contract for the whole team starts from — and contract_clauses keeps no history
   (record_history covers six tables; this is not one of them), so there was no way back to the
   company's wording (the CONTRACT CLAUSES note of 2 Sep). Both now ask in the page and say what
   they do.

   Under test (the 'scope' clause reworded for this contract first):
     1. "Save to shared template" → a question in the page naming the clause and saying every
        future contract starts from it; NO PATCH to contract_clauses while asking; Cancel → zero
        PATCHes, the clause still marked as this contract's own wording (override).
     2. Confirm → exactly one PATCH to contract_clauses carrying the new body; override cleared.
     3. Reword again → "Reset to template" → a question; Cancel keeps the wording; Confirm puts
        the template body back.
     4. Arabic: both questions are Arabic.
     5. No native dialog; no JavaScript errors.

   Run:  node scripts/qa/probe-clause-template-asks.mjs        (port 8777)
   Sabotage: in js/70 ctClauseSaveTemplate replace `if(typeof askInPage==='function')askInPage(q,go); else go();`
   with `go();` — check 1 goes red (a PATCH with no question). Assert the sabotage APPLIED with a
   marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8777;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CLAUSES = [
  { id: 'cl-1', key: 'scope', sort: 1, enabled: true, optional: false, title_en: 'Scope of services', title_ar: 'نطاق الخدمات', body_en: 'TEMPLATE scope wording.', body_ar: 'صياغة القالب للنطاق.' },
  { id: 'cl-2', key: 'term', sort: 2, enabled: true, optional: false, title_en: 'Term', title_ar: 'المدة', body_en: 'One year, renewable.', body_ar: 'سنة واحدة قابلة للتجديد.' },
];
const patches = [];

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
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
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/contract_clauses**', (r) => {
    const rq = r.request();
    if (rq.method() === 'PATCH') { let body = {}; try { body = JSON.parse(rq.postData() || '{}'); } catch (_) { } patches.push(body); Object.assign(CLAUSES[0], body); return json(r, [CLAUSES[0]]); }
    return json(r, CLAUSES);
  });
  await p.goto(BASE + '/documents/contract', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  const form = await p.$('#cl_email');
  if (form && await form.isVisible()) { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); }
  await sleep(5000);
  await p.evaluate(() => { window.__userRole = window.__userRole || 'admin'; current = 'documents'; render(); });
  /* the editor, by deep link or — if js/03 dropped the address during boot — the way a card click opens it */
  let up = false;
  for (let i = 0; i < 25 && !up; i++) { up = await p.evaluate(() => !!document.querySelector('#ctWrap .ct-form')); if (!up) { await p.evaluate(() => { try { current = 'documents'; render(); } catch (_) { } }); await sleep(400); } }
  for (let i = 0; i < 25 && !up; i++) { await p.evaluate(() => { try { current = 'documents'; if (typeof dgGo === 'function') dgGo('contract'); else render(); } catch (_) { } }); await sleep(400); up = await p.evaluate(() => !!document.querySelector('#ctWrap .ct-form')); }
  if (!up) fail('the contract editor never opened');
  await sleep(800);

  const box = () => p.evaluate(() => { const c = document.getElementById('pfConfirmBox'); return c ? c.innerText.replace(/\s+/g, ' ') : null; });
  const yes = () => p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); });
  const no = () => p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); });
  const reword = async (text) => { await p.evaluate(() => ctClauseEdit('scope')); await sleep(200); await p.evaluate((t) => { const en = document.getElementById('ctE_ben'); if (en) en.value = t; }, text); await p.evaluate(() => ctClauseSave('scope')); await sleep(200); };
  const state = () => p.evaluate(() => { const btns = [...document.querySelectorAll('#ctWrap button')].map((x) => x.textContent.trim()); return { saveBtn: btns.some((t) => /Save to shared template|حفظ في القالب المشترك/.test(t)), resetBtn: btns.some((t) => /Reset to template|إعادة للقالب/.test(t)) }; });

  /* ---- 1. Save to shared template asks; Cancel writes nothing ---- */
  await reword('THIS CONTRACT ONLY wording.');
  const st1 = await state();
  if (!st1.saveBtn || !st1.resetBtn) fail(`after rewording, the two buttons did not appear: ${JSON.stringify(st1)}`);
  await p.evaluate(() => ctClauseSaveTemplate('scope')); await sleep(400);
  const q1 = await box(); const pAsk = patches.length;
  await no(); await sleep(400);
  const st1b = await state();
  if (q1 && /Scope of services/.test(q1) && /future contract/i.test(q1) && pAsk === 0 && patches.length === 0 && st1b.saveBtn) ok(`"Save to shared template" asks in the page — "${q1.slice(0, 70)}…"; Cancel writes nothing and the contract keeps its own wording`);
  else fail(`save-to-template: box=${JSON.stringify(q1)} patchesWhileAsking=${pAsk} patchesAfterCancel=${patches.length} stillOverride=${st1b.saveBtn} — the live-site one-click overwrite of the company wording`);

  /* ---- 2. Confirm → exactly one PATCH ---- */
  await p.evaluate(() => ctClauseSaveTemplate('scope')); await sleep(400);
  await yes(); await sleep(1200);
  const st2 = await state();
  if (patches.length === 1 && patches[0].body_en === 'THIS CONTRACT ONLY wording.' && !st2.saveBtn) ok('Confirm → one PATCH to contract_clauses with the new body; the clause is the template again'); else fail(`after Confirm: patches=${JSON.stringify(patches)} state=${JSON.stringify(st2)}`);

  /* ---- 3. Reset to template asks ---- */
  await reword('SECOND custom wording.');
  await p.evaluate(() => ctClauseReset('scope')); await sleep(400);
  const q3 = await box(); await no(); await sleep(300);
  const kept = await p.evaluate(() => { ctClauseEdit('scope'); const v = (document.getElementById('ctE_ben') || {}).value; ctClauseEditCancel(); return v; });
  await p.evaluate(() => ctClauseReset('scope')); await sleep(400); await yes(); await sleep(400);
  const back = await p.evaluate(() => { ctClauseEdit('scope'); const v = (document.getElementById('ctE_ben') || {}).value; ctClauseEditCancel(); return v; });
  if (q3 && /Reset/.test(q3) && /discarded/.test(q3) && kept === 'SECOND custom wording.' && back === 'THIS CONTRACT ONLY wording.') ok('"Reset to template" asks; Cancel keeps the wording; Confirm puts the template body back');
  else fail(`reset: box=${JSON.stringify(q3)} afterCancel=${JSON.stringify(kept)} afterConfirm=${JSON.stringify(back)}`);

  /* ---- 4. Arabic ---- */
  await p.evaluate(() => { LANG = 'ar'; try { render(); } catch (_) { } }); await sleep(1200);
  await p.evaluate(() => { try { current = 'documents'; if (typeof dgGo === 'function') dgGo('contract'); } catch (_) { } }); await sleep(800);
  await reword('صياغة خاصة بهذا العقد');
  await p.evaluate(() => ctClauseSaveTemplate('scope')); await sleep(400);
  const q4a = await box(); await no(); await sleep(300);
  await p.evaluate(() => ctClauseReset('scope')); await sleep(400);
  const q4b = await box(); await no(); await sleep(300);
  if (q4a && /[؀-ۿ]/.test(q4a) && !/future contract/.test(q4a) && q4b && /[؀-ۿ]/.test(q4b) && !/discarded/.test(q4b)) ok('Arabic: both questions are Arabic'); else fail(`Arabic: save=${JSON.stringify(q4a)} reset=${JSON.stringify(q4b)}`);

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nclause-template-asks OK — the company\'s contract wording is never overwritten or discarded on one click');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
