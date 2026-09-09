/* probe-revenue-way-attacks.mjs (2026-09-07, watch cycle 44) — the one write in js/25 that
   nothing has ever attacked. Attack area (qq).

   "How did this revenue arrive?" is a dropdown on the invoice card that writes revenue_way to
   finance_invoices. It is careful about the things this session has taught it to be careful
   about — it guards the function and not just the button (cycle 2026-09-02), chains .select()
   and refuses to claim a save the database did not confirm (M13/B2), and never offers a value
   the row does not hold. Nothing has ever asked what the VALUE means once written.

   It means more than a label. js/58's own header says it plainly: "revenue_way='b2c_manual' and
   record_type='b2c' are the only things that mark it as this pattern" — and js/58 then lists the
   B2C hand-entered bookings with

       .eq('revenue_way','b2c_manual').is('deleted_at',null)

   keyed on the WAY ALONE. So this dropdown decides membership of a page it knows nothing about,
   in both directions:

     · Change a hand-entered B2C booking to any other way and it vanishes from the only page
       that lists it. The row is still there, still counted in the totals, and unreachable from
       the screen built to manage it — one dropdown away, no warning, and nothing on screen
       afterwards to say where it went.
     · Change a B2B invoice TO b2c_manual and it appears among the hand-entered bookings while
       record_type still says b2b — a row on that page that no one on this system created.

   The checks below use js/58's OWN query rather than its rendering, so what is measured is the
   page's definition of its contents, not a screenshot of them.

   Under test:
     1. Control — the seeded hand-entered booking is in the B2C page's own query, and the
        selector saves an ordinary change normally. (If this fails, nothing below means
        anything.)
     2. Moving a b2c row AWAY from b2c_manual must not silently remove it from that page.
     3. Moving a b2b invoice TO b2c_manual must not silently add it there.
     4. Whatever the guard does, it must say so — a refusal a person can act on, not a dropdown
        that quietly does nothing when they press Save.

   Run:  node scripts/qa/probe-revenue-way-attacks.mjs        (port 8715)
   Sabotage: remove the record_type/way agreement check from finSetWay in js/25 — checks 2, 3
   and 4 go red. Restore byte-identical (md5).                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8715;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const base = (o) => Object.assign({
  client_group: 'Way Test Co', customer_raw_name: 'Way Test Co', invoice_date: '2026-05-04',
  month: 'May', quarter: 'Q2', products: 'Flights', service_type: 'Flights',
  total_incl_vat_sar: 4000, wallet_portion_sar: 0, revenue_sar: 4000, cost_sar: 1000,
  profit_sar: 3000, amount_received_sar: 4000, amount_remaining_sar: 0,
  integrity_status: 'verified_paid', deleted_at: null, source_batch: 'qa-way', vat_sar: 0,
}, o);

const srv = start(PORT, {
  finance_invoices: [
    base({ id: 'way-b2c', invoice_no: 'WAY-B2C-1', record_type: 'b2c', revenue_way: 'b2c_manual', notes: 'hand-entered booking' }),
    base({ id: 'way-b2b', invoice_no: 'WAY-B2B-1', record_type: 'b2b', revenue_way: 'invoice', notes: 'ordinary invoice' }),
    base({ id: 'way-ord', invoice_no: 'WAY-ORD-1', record_type: 'b2b', revenue_way: 'invoice', notes: 'ordinary invoice 2' }),
  ],
});
const BASE = 'http://localhost:' + PORT;

/* js/58's own query for "what is on the hand-entered B2C page" */
const b2cPage = async () => (await fetch(BASE + '/rest/v1/finance_invoices?revenue_way=eq.b2c_manual&deleted_at=is.null&select=invoice_no,record_type').then((r) => r.json())) || [];
const wayOf = async (no) => {
  const r = (await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + no + '&select=invoice_no,revenue_way,record_type').then((x) => x.json())) || [];
  return r[0] || {};
};

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
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
  try { await p.waitForFunction(() => typeof window.finRow === 'function' && typeof window.finSetWay === 'function', { timeout: 90000 }); } catch (_) { }
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(2000);

  /* Drive it exactly as a person does: open the card, choose in the dropdown, press Save. */
  const setWay = async (id, invNo, want) => {
    const opened = await p.evaluate(({ id }) => {
      try { if (typeof window.finCloseModal === 'function') window.finCloseModal(); } catch (_) { }
      try { window.finRow(id); return true; } catch (e) { return String(e.message); }
    }, { id });
    await p.waitForTimeout(900);
    const picked = await p.evaluate((want) => {
      const s = document.getElementById('fin_way');
      if (!s) return 'no selector';
      if (![...s.options].some((o) => o.value === want)) return 'no such option: ' + want;
      s.value = want; return 'set';
    }, want);
    let alerted = [];
    await p.evaluate(() => { window.__al = []; const oa = window.alert; window.alert = (m) => window.__al.push(String(m)); window.__ra = () => { window.alert = oa; }; });
    await p.evaluate((no) => { try { window.finSetWay(no); } catch (e) { window.__al.push('THREW ' + e.message); } }, invNo);
    await p.waitForTimeout(2500);
    alerted = await p.evaluate(() => { try { window.__ra(); } catch (_) { } return window.__al || []; });
    try { await p.evaluate(() => { if (typeof window.finCloseModal === 'function') window.finCloseModal(); }); } catch (_) { }
    return { opened, picked, alerted };
  };

  /* ---- 1. control ---- */
  const page0 = await b2cPage();
  const c1 = await setWay('way-ord', 'WAY-ORD-1', 'commission');
  const ordAfter = await wayOf('WAY-ORD-1');
  if (page0.some((r) => r.invoice_no === 'WAY-B2C-1') && c1.picked === 'set' && ordAfter.revenue_way === 'commission')
    ok('control: the hand-entered booking is on the B2C page by its own query, and the selector saves an ordinary b2b change (invoice → commission) normally — so the guard below is measured against a working editor');
  else
    fail(`control failed, so nothing below can be concluded: b2c page=${JSON.stringify(page0)} picked=${JSON.stringify(c1.picked)} opened=${JSON.stringify(c1.opened)} WAY-ORD-1 now ${JSON.stringify(ordAfter)} alerts=${JSON.stringify(c1.alerted)}`);

  /* ---- 2. a hand-entered booking must not silently leave its own page ---- */
  const r2 = await setWay('way-b2c', 'WAY-B2C-1', 'invoice');
  const page2 = await b2cPage();
  const b2cRow = await wayOf('WAY-B2C-1');
  if (page2.some((r) => r.invoice_no === 'WAY-B2C-1'))
    ok('a hand-entered B2C booking cannot be moved off the only page that lists it — the change is held back rather than making the row unreachable from the screen built to manage it');
  else
    fail(`the hand-entered booking WAY-B2C-1 is gone from the B2C page: its way is now ${JSON.stringify(b2cRow.revenue_way)} while record_type is still ${JSON.stringify(b2cRow.record_type)}. js/58 lists that page with .eq('revenue_way','b2c_manual') alone, so the row still exists, is still counted in every total, and no longer appears anywhere a person can open it. One dropdown, no warning.`);

  /* ---- 3. and an ordinary invoice must not silently join it ---- */
  const r3 = await setWay('way-b2b', 'WAY-B2B-1', 'b2c_manual');
  const page3 = await b2cPage();
  const b2bRow = await wayOf('WAY-B2B-1');
  if (!page3.some((r) => r.invoice_no === 'WAY-B2B-1'))
    ok('an ordinary b2b invoice cannot be dropped into the hand-entered B2C list by the dropdown alone — the two fields that mark that pattern stay in agreement');
  else
    fail(`WAY-B2B-1 now appears among the hand-entered B2C bookings while record_type is ${JSON.stringify(b2bRow.record_type)} — a row on that page that nobody entered there, on a screen whose whole purpose is bookings someone typed in by hand`);

  /* ---- 4. and it says so ---- */
  const said = ((r2.alerted || []).concat(r3.alerted || [])).join(' | ');
  if (/b2c|هذا الحجز|hand-entered|المدخلة يدويًا/i.test(said) && said.trim().length > 20)
    ok('both refusals explain themselves, naming the B2C page and what would have happened — a person can act on that, unlike a Save button that appears to do nothing');
  else
    fail(`the change was held back but nothing explained it. Pressing Save appeared to do nothing at all, which is its own defect. It said: ${JSON.stringify(said.slice(0, 300))}`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nrevenue-way OK — the dropdown cannot move a booking off the only page that lists it, nor put one there that nobody entered');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
