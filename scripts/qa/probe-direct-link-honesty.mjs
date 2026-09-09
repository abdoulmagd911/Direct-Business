/* probe-direct-link-honesty.mjs (2026-09-08, watch cycle 54) — a button that promises to open
   THIS invoice and opens the list of all of them, every time, in production. Attack area (vv).

   PORT NOTE: 8701–8723 are taken (block full since cycle 49; 8721–8723 went to cycles 49, 50 and
   53). This is 8724, verified free by scanning every PORT= in scripts/qa.

   How this was found: cycle 54 enumerated every window.* export in this session's lane and
   checked each against the battery. pdClientLink had NO probe touching it at all, and reading it
   led to its neighbour pdInvoiceLink — the href behind "Open in Direct ↗" on the invoice card and
   on every ledger row.

       if(r && r.direct_uuid) → https://payments.directksa.com/en/admin/invoices/view/{uuid}
       otherwise             → https://payments.directksa.com/en/admin/invoices
                               .replace('{invoice_no}', …)   ← a template with no placeholder in it

   The fallback default contains no {invoice_no}, {dpin} or {client_id}, so every replace() is a
   no-op and the link is the generic invoice LIST. Measured against the live database on
   2026-09-08: of 46 live invoices, **direct_uuid is present on 0**. So the deep-link branch never
   runs in production, and the button has been opening the list — while saying it opens this
   invoice — for every invoice, every time.

   That is not cosmetic on this button. It is the bridge between this app's number and the real
   payment system's record; somebody following it to check an amount lands on a list of hundreds
   and has to search by hand, or worse, reads whichever invoice is on top.

   The rule: a link may fail to be a deep link, but it may not SAY it is one. Either it carries
   something that identifies the invoice, or it is labelled for what it actually opens.

   Under test:
     1. Control — with direct_uuid present the link deep-links to /invoices/view/<uuid>, so the
        checks below are measured against a working builder. (If this fails, nothing else means
        anything.)
     2. THE DEFECT — with no uuid (the state of every live invoice today) the link must either
        carry the invoice number, or be labelled for what it opens. It must not read "Open in
        Direct" while going to the list.
     3. A workspace that HAS configured a template with {invoice_no} is not degraded: the link
        uses it.
     4. Whatever the link does, the invoice number is on screen beside it, so a person who lands
        on a list has the thing to search for.

   Run:  node scripts/qa/probe-direct-link-honesty.mjs        (port 8724)
   Sabotage: revert the label/href change in js/16 — checks 2 and 4 go red. Assert the sabotage
   APPLIED with a marker unique to it, and confirm the restore with git status (cycles 49, 53).  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8724;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const inv = (id, no, uuid) => ({
  id, invoice_no: no, line_no: 1, direct_uuid: uuid, zatca_dpin: 'DPIN-' + id,
  client_group: 'Link Co', customer_raw_name: 'Link Co', invoice_date: '2026-05-04',
  month: 'May', quarter: 'Q2', products: 'Flights', service_type: 'Flights', record_type: 'b2b',
  total_incl_vat_sar: 5000, wallet_portion_sar: 0, revenue_sar: 5000, cost_sar: 1000,
  profit_sar: 4000, amount_received_sar: 5000, amount_remaining_sar: 0,
  integrity_status: 'verified_paid', revenue_way: 'invoice', deleted_at: null,
  source_batch: 'qa-link', vat_sar: 0,
});
const srv = start(PORT, { finance_invoices: [inv('lk-uuid', 'LK-WITH-UUID', 'abc-123-uuid'), inv('lk-none', 'LK-NO-UUID', null)] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  if (!(await p.waitForFunction(() => typeof window.pdInvoiceLink === 'function' && typeof window.finRow === 'function', { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('pdInvoiceLink / finRow never appeared, so nothing below examined anything');
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1500);

  /* ---- 1. control: the deep-link branch works ---- */
  const deep = await p.evaluate(() => window.pdInvoiceLink({ invoice_no: 'LK-WITH-UUID', direct_uuid: 'abc-123-uuid' }));
  if (/\/invoices\/view\/abc-123-uuid$/.test(deep)) ok(`control: with a uuid the link deep-links to the invoice itself (${deep}) — the checks below are measured against a working builder`);
  else fail(`control: the deep-link branch did not build the expected URL, so nothing below can be concluded. Got ${JSON.stringify(deep)}`);

  /* ---- 2. the defect: no uuid, which is every live invoice today ---- */
  const openModal = async (id) => {
    await p.evaluate((i) => { try { if (typeof window.finCloseModal === 'function') window.finCloseModal(); } catch (_) { } window.finRow(i); }, id);
    await p.waitForTimeout(800);
    return await p.evaluate(() => {
      const m = document.getElementById('finModal'); if (!m) return null;
      const a = [...m.querySelectorAll('a')].find((x) => /direct|دايركت/i.test(x.textContent || ''));
      return a ? { href: a.getAttribute('href') || '', label: (a.textContent || '').trim(), modalText: (m.innerText || '').replace(/\s+/g, ' ') } : { href: null, label: null, modalText: (m.innerText || '').replace(/\s+/g, ' ') };
    });
  };
  const noUuid = await openModal('lk-none');
  if (!noUuid || noUuid.href === null) fail(`the invoice card offered no Direct link at all for the no-uuid invoice — ${JSON.stringify(noUuid && noUuid.modalText.slice(0, 160))}`);
  else {
    const carriesId = /LK-NO-UUID/.test(noUuid.href);
    const promisesThis = /open in direct|فتحها في دايركت/i.test(noUuid.label) && !/list|search|find|قائمة|ابحث/i.test(noUuid.label);
    if (carriesId || !promisesThis)
      ok(`without a uuid the link is honest: ${carriesId ? 'it carries the invoice number' : 'it is labelled for what it actually opens'} — label ${JSON.stringify(noUuid.label)}, href ${JSON.stringify(noUuid.href)}`);
    else
      fail(`the link says ${JSON.stringify(noUuid.label)} and goes to ${JSON.stringify(noUuid.href)} — the generic invoice list, with nothing identifying this invoice. Measured on the live database 2026-09-08: direct_uuid is present on 0 of 46 live invoices, so this is what the button does for EVERY invoice, every time. Somebody following it to check an amount lands on a list of hundreds.`);
  }

  /* ---- 3. a configured template is still used ---- */
  const configured = await p.evaluate(() => {
    DB.settings = DB.settings || {};
    DB.settings.pdInvoiceUrl = 'https://payments.directksa.com/en/admin/invoices?q={invoice_no}';
    const out = window.pdInvoiceLink({ invoice_no: 'LK-NO-UUID', zatca_dpin: 'D', direct_client_id: '' });
    delete DB.settings.pdInvoiceUrl;
    return out;
  });
  if (/q=LK-NO-UUID/.test(configured)) ok('a workspace that has configured a template with {invoice_no} still gets it filled in — the fix does not take the deep link away from anyone who has one');
  else fail(`a configured {invoice_no} template was not honoured: ${JSON.stringify(configured)}`);

  /* ---- 4. and the number is on screen to search with ---- */
  if (noUuid && /LK-NO-UUID/.test(noUuid.modalText)) ok('the invoice number is on the card beside the link, so a person who lands on a list has the thing to search for');
  else fail(`the invoice number is not on the card, so somebody sent to a list has nothing to search with: ${JSON.stringify(noUuid && noUuid.modalText.slice(0, 200))}`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ndirect-link-honesty OK — the Direct Payments link never claims to open an invoice it cannot open');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
