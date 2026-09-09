/* probe-proposal-editor-honesty.mjs (2026-09-09, live test findings O1, O3, O4) — the proposal
   editor says what it knows about the client, previews the right document, and names the
   system its buttons call into. Attack area (ad).

   PORT NOTE: 8701–8758 are taken. This is 8759, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand:
     · O1 — a saved proposal's CLIENT box read "— pick a client —" although it had a client
       (the linked company was a practice record no longer in the workspace).
     · O4 — a "Business solution" proposal (an annual corporate agreement) was previewed as a
       flight quote: "Passenger: Corporate travel rates", Airline/Class/Route "—", a table of
       ticket-price dashes, fare rules — under "this is what the client sees".
     · O3 — an orange bar "Draft booking (push to source on confirm)": developer wording.

   Under test:
     1. Orphaned link → the Client box shows the stored name with "company no longer in the
        list", selected — never the empty "pick a client".
     2. Linked to a LEAD (not yet a client) → the box shows the lead's name, marked as a lead.
     3. Business-solution proposal → the preview is the branded-proposal note (no "Passenger",
        no "Airline", no ticket-price table) with the Generate button.
     4. Travel quote → the flight-quote preview is still there (the note only replaces it for
        non-travel types).
     5. No button on the editor says "push to source"; the booking button names Direct Payments.

   Run:  node scripts/qa/probe-proposal-editor-honesty.mjs        (port 8759)
   Sabotage: in core-04 define `extra` as the empty string (it is a const — reassigning it throws) — checks 1 and 2 go red; make `travel`
   always true — check 3 goes red; in core-06 put 'Draft booking (push to source on confirm)'
   back — check 5 goes red. Assert the sabotage APPLIED with a marker unique to it; confirm the
   restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8759;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const today = new Date().toISOString().slice(0, 10);
const srv = start(PORT, { app_offers: [
  { id: 'o-orphan', data: { id: 'o-orphan', ref: 'PR-ORPHAN', client: 'Harbor Lantern Probe', linkedLeadId: 'gone-0000-0000', proposalType: 'Business solution', subject: 'Corporate travel rates — annual agreement', status: 'Sent', date: today, currency: 'SAR' } },
  { id: 'o-travel', data: { id: 'o-travel', ref: 'PR-TRAVEL', client: 'Quill Meadow Probe', proposalType: 'Travel — flights', subject: 'Mr Probe (2 pax)', airline: 'XY', route: 'RUH → JED → RUH', ticketPrice: 1200, total: 1500, status: 'Draft', date: today, currency: 'SAR' } },
] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
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
  await p.goto(BASE + '/offers', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof offerEditor === 'function' && Array.isArray(DB.offers) && DB.offers.some((o) => o.id === 'o-orphan'), { timeout: 90000 }).catch(() => fail('the offers never loaded from the table'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s (see probe-today-queue-card)

  const openEditor = (id) => p.evaluate((oid) => new Promise((res) => { current = 'offers'; openOffer = oid; render(); setTimeout(() => {
    const view = document.getElementById('view'); const sel = [...view.querySelectorAll('select')].find((s) => /pick a client/.test(s.innerHTML));
    const chosen = sel && sel.options[sel.selectedIndex];
    const doc = document.getElementById('offerDoc'); const dtxt = doc ? doc.innerText.replace(/\s+/g, ' ') : '';
    const btns = [...view.querySelectorAll('button')].map((x) => x.textContent.trim());
    res({ chosen: chosen ? { value: chosen.value, text: chosen.textContent, orphan: chosen.getAttribute('data-orphan'), lead: chosen.getAttribute('data-lead') } : null, preview: doc && doc.getAttribute('data-preview'), dtxt: dtxt.slice(0, 220), passenger: /Passenger:/.test(dtxt), airline: /Airline:/.test(dtxt), ticketTable: /Ticket price/.test(dtxt), pushToSource: btns.filter((t) => /push to source/i.test(t)), booking: btns.find((t) => /Draft booking/i.test(t)) || '' });
  }, 900); }), id);

  /* ---- 1 + 3 + 5: the orphaned business-solution proposal ---- */
  const a = await openEditor('o-orphan');
  if (a.chosen && a.chosen.orphan === '1' && /Harbor Lantern Probe/.test(a.chosen.text) && /no longer in the list/.test(a.chosen.text))
    ok(`orphaned link: the Client box reads "${a.chosen.text}" — the stored name, and why it is not in the list`);
  else fail(`orphaned link: Client box shows ${JSON.stringify(a.chosen)} — the live-site "— pick a client —"`);
  if (a.preview === 'branded' && !a.passenger && !a.airline && !a.ticketTable && /branded proposal/i.test(a.dtxt))
    ok('business-solution proposal: the preview is the branded-proposal note — no Passenger, no Airline, no ticket-price table');
  else fail(`business-solution proposal previewed as a flight quote: ${JSON.stringify({ preview: a.preview, passenger: a.passenger, airline: a.airline, ticketTable: a.ticketTable, dtxt: a.dtxt })}`);
  if (!a.pushToSource.length && /Direct Payments/.test(a.booking)) ok(`no "push to source" wording; the booking button reads "${a.booking}"`);
  else fail(`developer wording on the editor: pushToSource=${JSON.stringify(a.pushToSource)} booking="${a.booking}"`);

  /* ---- 2: linked to a lead ---- */
  const leadId = await p.evaluate(() => { const l = DB.businesses.find((x) => !x.isClient); const o = DB.offers.find((x) => x.id === 'o-orphan'); o.linkedLeadId = l.id; return l.id; });
  const b2 = await openEditor('o-orphan');
  if (b2.chosen && b2.chosen.lead === '1' && b2.chosen.value === leadId && /lead, not yet a client/.test(b2.chosen.text)) ok(`linked to a lead: the box reads "${b2.chosen.text}"`);
  else fail(`linked to a lead: ${JSON.stringify(b2.chosen)}`);

  /* ---- 4: a travel quote keeps the flight preview ---- */
  const t = await openEditor('o-travel');
  if (t.preview !== 'branded' && t.passenger && t.airline) ok('travel quote: the flight-quote preview is still shown');
  else fail(`travel quote lost its preview: ${JSON.stringify({ preview: t.preview, passenger: t.passenger, airline: t.airline, ticketTable: t.ticketTable })}`);

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nproposal-editor-honesty OK — the editor names its client, previews the right document, and names the system it calls');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
