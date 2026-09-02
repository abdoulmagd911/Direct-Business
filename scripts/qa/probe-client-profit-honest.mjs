/* probe-client-profit-honest.mjs — "Top clients by revenue" must not present an unrecorded cost
   as 100% margin (2026-09-02, round 35). Found by a live read-only sweep, not by reading code.

   THE LIVE FACTS THAT PROMPTED IT (counts only — no names, no amounts beyond the aggregate,
   rule 7): of 46 live invoices, 19 carry cost_sar = 0 rather than NULL, and for every one of
   those the trigger derives profit = revenue. Grouped by client that is 5 of 18 client groups
   with NO recorded cost on ANY invoice, appearing in this table as 131,871 SAR of revenue at
   100% margin.

   The Finance overview headline already warned honestly ("N of M invoices in this period carry
   no recorded cost — margin may read higher than reality"). But THIS is the table where a
   manager decides which client is worth the effort, and it showed those clients a Cost of 0 and
   a Profit equal to their whole revenue with nothing to mark it. The warning was in the room;
   it just was not next to the number being misread.

   Same rule as rounds 29 / 31 / 33 (M8): a cost nobody has recorded is not zero, and a profit
   derived from it is not a profit.

     - a client with NO cost on any invoice: Cost reads "not recorded", Profit reads "unknown"
     - a client with SOME: the real numbers, plus a ⚠ so the reader knows they are partial
     - a client with ALL costs recorded: untouched, no marker
     - the Total row keeps the true arithmetic (it must still reconcile against the ledger) but
       says the profit total is an upper bound

   Sabotage: put money0(byC[k].c) / money0(byC[k].p) back in the row -> the all-missing client
   reads 0 and its whole revenue as profit -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8390;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

/* Three client groups, shaped like the live data:
     Test Company 0 — 3 invoices, NONE with a cost      (the 5-of-18 case)
     Test Company 1 — 3 invoices, 1 without a cost      (the partly-missing case)
     Test Company 2 — 3 invoices, all costed            (the healthy case)          */
const PLAN = [
  ['Test Company 0', [[20000, 0], [30000, 0], [10000, 0]]],
  ['Test Company 1', [[20000, 14000], [30000, 21000], [10000, 0]]],
  ['Test Company 2', [[20000, 15000], [30000, 24000], [10000, 8000]]],
];
const INV = [];
PLAN.forEach(([client, rows], ci) => rows.forEach((r, ri) => {
  const [rev, cost] = r;
  INV.push({
    id: 'pc' + ci + ri, invoice_no: 'PC-' + ci + ri, zatca_dpin: null,
    client_group: client, customer_raw_name: client,
    invoice_date: '2026-08-1' + ri, month: 'August', quarter: 'Q3', year: 2026,
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: rev, wallet_portion_sar: 0, revenue_sar: rev,
    cost_sar: cost, profit_sar: rev - cost,
    amount_received_sar: rev, amount_remaining_sar: 0, collection_due_date: '2026-09-15',
    integrity_status: 'verified_paid', exclusion_reason: null, notes: null, source_batch: 'seed',
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', deleted_at: null,
  });
}));

async function main() {
  const srv = start(PORT, { finance_invoices: INV });
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.waitForTimeout(8000);

  async function clientRows() {
    await p.evaluate(() => { openLead = null; current = 'finance'; render(); });
    await p.waitForTimeout(2200);
    await p.evaluate(() => {
      if (typeof finTab === 'function') return finTab('clients');
      const t = [...document.querySelectorAll('#view button, #view .fin-tab, #view .tab')].find((x) => /Clients & collections/.test(x.textContent || ''));
      if (t) t.click();
    });
    await p.waitForTimeout(2000);
    return p.evaluate(() => {
      let table = null;
      document.querySelectorAll('#view table').forEach((t) => { if (/Top clients|أعلى العملاء/.test((t.closest('.card') || {}).textContent || '')) table = t; });
      if (!table) return null;
      const card = table.closest('.card');
      return {
        rows: [...table.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
        note: (card.textContent || '').replace(/\s+/g, ' ').match(/⚠[^⚠]{0,150}/g) || [],
      };
    });
  }

  const t = await clientRows();
  if (!t) { fail('could not find the "Top clients by revenue" table'); }
  else {
    const byName = {};
    t.rows.forEach((r) => { if (r.length >= 4) byName[r[0].replace(/#\d+/, '').trim()] = r; });

    const none = byName['Test Company 0'];
    if (none && /not recorded/i.test(none[2])) ok('a client with NO cost recorded on any invoice shows Cost "not recorded" — not a 0');
    else fail('the all-missing client\'s Cost cell reads ' + JSON.stringify(none && none[2]));
    if (none && /unknown/i.test(none[3])) ok('…and Profit "unknown" — not its whole revenue presented as margin');
    else fail('the all-missing client\'s Profit cell reads ' + JSON.stringify(none && none[3]) + ' — it should be unknown, not the full sale');
    if (none && /60,?000/.test(none[1])) ok('…while its Revenue (60,000) is still shown in full, because that part IS known');
    else fail('the revenue was hidden too: ' + JSON.stringify(none && none[1]));

    const part = byName['Test Company 1'];
    if (part && /⚠/.test(part[2]) && /35,?000/.test(part[2])) ok('a client with SOME costs recorded still shows the real 35,000, marked ⚠ so the reader knows it is partial');
    else fail('the partly-missing client\'s Cost cell reads ' + JSON.stringify(part && part[2]));
    if (part && /⚠/.test(part[3])) ok('…and its Profit is marked the same way');
    else fail('the partly-missing client\'s Profit is unmarked: ' + JSON.stringify(part && part[3]));

    const full = byName['Test Company 2'];
    if (full && !/⚠|not recorded|unknown/.test(full[2] + full[3])) ok('a client with every cost recorded is untouched — no marker, no noise');
    else fail('a fully-costed client was marked anyway: ' + JSON.stringify(full));
    if (full && /47,?000/.test(full[2]) && /13,?000/.test(full[3])) ok('…and its real numbers are intact (cost 47,000, profit 13,000)');
    else fail('the healthy client\'s numbers changed: ' + JSON.stringify(full));

    const total = t.rows[t.rows.length - 1];
    if (total && /180,?000/.test(total[1])) ok('the Total row still carries the true revenue (180,000), so it reconciles against the ledger');
    else fail('total revenue row: ' + JSON.stringify(total));
    if (t.note.some((n) => /upper bound/i.test(n))) ok('…and it says the profit total is an upper bound, because part of it rests on costs nobody has recorded');
    else fail('the Total row does not warn that the profit is an upper bound: ' + JSON.stringify(t.note));
  }

  // Arabic
  await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); });
  const ar = await clientRows();
  if (ar && JSON.stringify(ar.rows).includes('غير مسجّلة') && JSON.stringify(ar.rows).includes('غير معروف')) ok('in Arabic the same cells read «غير مسجّلة» and «غير معروف»');
  else fail('the Arabic table does not carry the wording: ' + JSON.stringify((ar && ar.rows || []).slice(0, 3)));
  if (ar && ar.note.some((n) => /حدّ أقصى/.test(n))) ok('…and the Total note is Arabic too');
  else fail('the Arabic total note is missing: ' + JSON.stringify(ar && ar.note));
  await p.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); });

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nclient-profit-honest OK — an unrecorded cost is never presented as a client being 100% profitable');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
