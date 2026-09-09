/* probe-proposal-link-honesty.mjs (2026-09-08, watch cycle 55) — "No proposal with ref X" said
   about a proposal that exists. Attack area (ww).

   PORT NOTE: 8701–8724 are taken (block full since cycle 49; 8721–8724 went to cycles 49, 50, 53
   and 54). This is 8725, verified free by scanning every PORT= in scripts/qa.

   Found by finishing cycle 54's enumeration: of every window.* export in this session's lane,
   five had no probe driving them at all. finOpenProposal is the one with something riding on it —
   it is the jump from an invoice to the proposal that priced it.

       window.finOpenProposal=function(ref){
         var o=(DB.offers||[]).find(x => (x.ref||'')===ref);
         var m=document.getElementById('finModal'); if(m)m.remove();      ← card closed FIRST
         if(o){ … open it … }
         else toast('No proposal with ref '+ref);                          ← stated as fact
       }

   DB.offers is filled by js/35 from app_offers, on the same lazy schedule as the exclusion list
   that cycles 41–43 were spent on. Before it lands, DB.offers is empty — and this function
   answers a question it cannot yet answer, in the definite: the proposal does not exist. It is
   the same mistake as finExclusionCheck()'s null meaning both "not on the list" and "no list
   yet", except that this one prints the wrong half out loud, to a person, as a fact about their
   own records.

   And it removes the invoice card BEFORE it looks, so the answer arrives with nowhere to go
   back to: whoever pressed the button loses the invoice they were reading and is told, wrongly,
   that its proposal is gone.

   The scenario is an ordinary Tuesday, not a manufactured state (cycles 42/43/45): open Finance
   on a slow morning, click an invoice, press "Open proposal" before the offers table has
   finished loading.

   Under test:
     1. Control — with the offers loaded and a ref that matches, the proposal opens. (If this
        fails, nothing below means anything.)
     2. Control — with the offers loaded and a ref that genuinely is not there, saying so is
        correct and must keep working.
     3. THE DEFECT — with the offers not yet loaded, it must NOT claim the proposal does not
        exist. "I cannot tell yet" is the only true answer available.
     4. And the invoice card must survive that: an answer of "not yet" with the card already
        closed is an answer nobody can act on.

   Run:  node scripts/qa/probe-proposal-link-honesty.mjs        (port 8725)
   Sabotage: revert the guard in js/16 — checks 3 and 4 go red. Assert the sabotage APPLIED with
   a marker unique to it, and confirm the restore with marker count and git status (53, 54).   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8725;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const REF = 'PRO-2026-0042';
const inv = (id, no, ref) => ({
  id, invoice_no: no, line_no: 1, proposal_ref: ref, direct_uuid: null, zatca_dpin: 'D-' + id,
  client_group: 'Proposal Co', customer_raw_name: 'Proposal Co', invoice_date: '2026-05-04',
  month: 'May', quarter: 'Q2', products: 'Flights', service_type: 'Flights', record_type: 'b2b',
  total_incl_vat_sar: 9000, wallet_portion_sar: 0, revenue_sar: 9000, cost_sar: 2000,
  profit_sar: 7000, amount_received_sar: 9000, amount_remaining_sar: 0,
  integrity_status: 'verified_paid', revenue_way: 'invoice', deleted_at: null,
  source_batch: 'qa-proposal', vat_sar: 0,
});
/* The proposal really does exist, in the table the app loads offers from. */
const srv = start(PORT, {
  finance_invoices: [inv('pl-1', 'PL-HAS-PROPOSAL', REF), inv('pl-2', 'PL-NO-PROPOSAL', 'PRO-NEVER-EXISTED')],
  app_offers: [{ id: 'off-1', data: { id: 'off-1', ref: REF, client: 'Proposal Co', title: 'The proposal that priced it' } }],
});
const BASE = 'http://localhost:' + PORT;
const HOLD = { offers: true };

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    /* the whole attack: app_offers is simply slow, as it is on a busy morning */
    if (/app_offers/.test(u.pathname + u.search)) { while (HOLD.offers) await new Promise((x) => setTimeout(x, 200)); }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  if (!(await p.waitForFunction(() => typeof window.finOpenProposal === 'function' && typeof window.finRow === 'function', { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('finOpenProposal / finRow never appeared, so nothing below examined anything');
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1500);

  const press = async (id, ref) => {
    await p.evaluate((i) => { try { if (typeof window.finCloseModal === 'function') window.finCloseModal(); } catch (_) { } window.finRow(i); }, id);
    await p.waitForTimeout(700);
    const openedBefore = await p.evaluate(() => !!document.getElementById('finModal'));
    await p.evaluate(() => { window.__toasts = []; const ot = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); if (typeof ot === 'function') { try { ot(m); } catch (_) { } } }; });
    await p.evaluate((r) => { try { window.finOpenProposal(r); } catch (e) { window.__toasts.push('THREW ' + e.message); } }, ref);
    await p.waitForTimeout(1200);
    return await p.evaluate(() => ({
      said: (window.__toasts || []).join(' | '),
      modalStillOpen: !!document.getElementById('finModal'),
      wentToOffers: (typeof current !== 'undefined' && current === 'offers'),
      offersLoaded: Array.isArray(DB.offers) && DB.offers.length > 0,
    })).then((s) => Object.assign(s, { openedBefore }));
  };

  /* ---- 3 + 4 first, while the offers are genuinely still in flight ---- */
  const blind = await press('pl-1', REF);
  if (blind.offersLoaded)
    fail(`the attack did not set itself up: DB.offers had already loaded (${JSON.stringify(blind)}), so this run did not measure the not-yet-loaded case at all`);
  else if (/no proposal|لا يوجد عرض/i.test(blind.said))
    fail(`with the offers still loading, the app stated as fact that the proposal does not exist: ${JSON.stringify(blind.said)}. It does exist — it is in app_offers, which had not arrived yet. This is finExclusionCheck's null all over again ("not found" and "not loaded" are different answers), except this one says the wrong half out loud, to a person, about their own records.`);
  else if (/moment|loading|not finished|yet|جارٍ|لحظة|لم تكتمل/i.test(blind.said))
    ok(`with the offers still loading the app says it cannot tell yet rather than denying the proposal exists: ${JSON.stringify(blind.said)}`);
  else
    fail(`with the offers still loading the app said ${JSON.stringify(blind.said)} — neither a true "not yet" nor a recognisable answer, so a person is left guessing`);

  if (!blind.openedBefore) fail('the invoice card was not open before the button was pressed, so check 4 examined nothing');
  else if (blind.modalStillOpen) ok('and the invoice card is still open, so the person can try again from where they were rather than losing the invoice they were reading');
  else fail('the invoice card was closed before the answer was known, so "not yet" arrives with nowhere to go back to — the invoice being read is gone and the person is told, wrongly, that its proposal is missing');

  /* ---- release, then the two controls ---- */
  HOLD.offers = false;
  await p.waitForFunction(() => Array.isArray(DB.offers) && DB.offers.length > 0, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(800);

  const hit = await press('pl-1', REF);
  if (hit.wentToOffers) ok(`control: with the offers loaded, a matching ref opens the proposal — so the guard above is measured against a working jump`);
  else fail(`control: with the offers loaded, a matching ref did NOT open the proposal (${JSON.stringify(hit)}), so nothing above can be concluded`);

  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(800);
  const miss = await press('pl-2', 'PRO-NEVER-EXISTED');
  if (/no proposal|لا يوجد عرض/i.test(miss.said)) ok('control: with the offers loaded, a ref that genuinely is not there is still reported as missing — the honest "no" is intact');
  else fail(`control: a genuinely absent ref no longer reports as missing (${JSON.stringify(miss.said)}) — the fix must not silence a true answer`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nproposal-link-honesty OK — the app never denies a proposal it has not finished looking for');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
