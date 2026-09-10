/* probe-proposal-option-remove.mjs (2026-09-10, second live pass — Proposals) — the red "Remove"
   beside a proposal option asks first when the option carries anything. Attack area (ad).

   PORT NOTE: 8701–8775 are taken. This is 8776, verified free by scanning every PORT= in
   scripts/qa.

   Found in the proposal editor: every option (a whole priced package — items, tiers, freebies,
   base fare, provider) has a red "Remove" button that took the package on one click, no
   question, and nothing brings it back (options live in the app_state blob; only a snapshot
   restore of the whole workspace could). A blank option (just added, nothing typed) still goes
   at once — asking there would be noise.

   Under test (two options on one proposal: A filled with 2 items, B blank):
     1. Remove on A → a question in the page (js/57's box) naming the option and its line
        count; no save yet; Cancel → both options still there, no save_state call.
     2. Remove on A → Confirm → A gone, B stays, one save.
     3. Remove on B (blank) → gone at once, no question.
     4. Arabic: the question is Arabic.
     5. No native dialog; no JavaScript errors.

   Run:  node scripts/qa/probe-proposal-option-remove.mjs        (port 8776)
   Sabotage: in core-04 o_delOption replace `if(!filled){go();return;}` with `go();return;` —
   checks 1, 2 and 4 go red (the option vanishes without a question). Assert the sabotage APPLIED
   with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8776;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const W = [];

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type()); await d.dismiss(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (!['GET', 'HEAD'].includes(rq.method())) W.push({ m: rq.method(), path: u.pathname });
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/offers', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof offerEditor === 'function' && Array.isArray(DB.offers) && DB.offers.some((o) => o.id === 'off0') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the offers never loaded'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s after load

  /* two options on off0: A filled, B blank */
  await p.evaluate(() => { const o = DB.offers.find((x) => x.id === 'off0'); o.options = [
    { label: 'Hajj Economy probe', provider: 'Saudia', content: 'RUH→JED', fareFamily: '', base: '1100', taxes: '', anc: '', fee: '', refundable: 'No', baggage: '1 x 23kg', items: [{ type: 'Flight', detail: 'RUH→JED Y', price: 1100 }, { type: 'Hotel', detail: 'Makkah 7nts', price: 5500 }] },
    { label: 'Option 2', provider: '', content: '—', fareFamily: '', base: '', taxes: '', anc: '', fee: '', refundable: 'No', baggage: '1 x 23kg' }];
    current = 'offers'; openOffer = 'off0'; render(); });
  await p.waitForTimeout(900);
  const count = () => p.evaluate(() => (DB.offers.find((x) => x.id === 'off0').options || []).length);
  const box = () => p.evaluate(() => { const c = document.getElementById('pfConfirmBox'); return c ? c.innerText.replace(/\s+/g, ' ') : null; });
  const removeBtns = () => p.evaluate(() => [...document.querySelectorAll('#view button[onclick^="o_delOption("]')].length);
  const saves = (from) => W.slice(from).filter((w) => /save_state/.test(w.path)).length;
  if ((await removeBtns()) !== 2) fail(`expected two Remove buttons in the editor, found ${await removeBtns()}`);

  /* ---- 1. filled option asks; Cancel keeps it ---- */
  const w1 = W.length;
  await p.evaluate(() => document.querySelector('#view button[onclick="o_delOption(0)"]').click()); await p.waitForTimeout(400);
  const q1 = await box();
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); }); await p.waitForTimeout(600);
  if (q1 && /Hajj Economy probe/.test(q1) && /\(2\)/.test(q1) && (await count()) === 2 && saves(w1) === 0 && !(await box())) ok(`Remove on a filled option asks in the page — "${q1.slice(0, 60)}…"; Cancel keeps both options, nothing saved`);
  else fail(`filled option: box=${JSON.stringify(q1)} options=${await count()} saves=${saves(w1)} — the live-site one-click package loss`);

  /* ---- 2. Confirm removes it ---- */
  const w2 = W.length;
  await p.evaluate(() => document.querySelector('#view button[onclick="o_delOption(0)"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await p.waitForTimeout(1500);
  const left = await p.evaluate(() => (DB.offers.find((x) => x.id === 'off0').options || []).map((o) => o.label));
  if (left.length === 1 && left[0] === 'Option 2' && saves(w2) >= 1) ok('Confirm removes the filled option; the blank one stays; saved'); else fail(`after Confirm: options=${JSON.stringify(left)} saves=${saves(w2)}`);

  /* ---- 3. a blank option goes at once ---- */
  await p.evaluate(() => document.querySelector('#view button[onclick="o_delOption(0)"]').click()); await p.waitForTimeout(400);
  const q3 = await box();
  if (!q3 && (await count()) === 0) ok('a blank option is removed at once — no question for nothing'); else fail(`blank option: box=${JSON.stringify(q3)} options=${await count()}`);

  /* ---- 4. Arabic ---- */
  await p.evaluate(() => { const o = DB.offers.find((x) => x.id === 'off0'); o.options = [{ label: 'خيار الحج', provider: 'Saudia', content: 'RUH→JED', base: '900', refundable: 'No', baggage: '1 x 23kg', items: [{ type: 'Flight', detail: 'x', price: 900 }] }]; LANG = 'ar'; render(); }); await p.waitForTimeout(900);
  await p.evaluate(() => { const bt = document.querySelector('#view button[onclick="o_delOption(0)"]'); if (bt) bt.click(); }); await p.waitForTimeout(400);
  const q4 = await box();
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); }); await p.waitForTimeout(300);
  if (q4 && /[؀-ۿ]/.test(q4) && /خيار الحج/.test(q4) && !/Remove the option/.test(q4)) ok('Arabic: the question is Arabic and names the option'); else fail(`Arabic: ${JSON.stringify(q4)}`);

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nproposal-option-remove OK — a priced option is never lost to one click');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
