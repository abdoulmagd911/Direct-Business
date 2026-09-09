/* probe-restore-scope-attacks.mjs (2026-09-07, watch cycle 46) — Restore is not the inverse of
   Delete. Attack area (rr).

   The unique key on finance_invoices is (invoice_no, line_no) — verified against the live schema
   and mirrored in the mock as finance_invoices_invoice_line_key — so ONE invoice number
   legitimately holds several rows. The invoice card's two buttons key on the number:

       finDelInv(invNo)      .eq('invoice_no',invNo).is('deleted_at',null)
       finRestoreInv(invNo)  .eq('invoice_no',invNo).not('deleted_at','is',null)

   Delete is careful — it only touches rows that are currently live, so a line deleted last month
   is left where it is. Restore has no such limit. It un-deletes EVERY deleted row for that
   number, whenever it was deleted and whoever deleted it.

   So: a duplicate line is deleted deliberately in August. In September someone deletes the
   invoice and immediately presses Restore to undo it. The invoice comes back — and so does the
   August line, silently, into every total. Nothing on screen says three rows were restored where
   two were removed, and the row nobody meant to bring back is the one that was deleted on
   purpose. Money that was ruled out a month ago is back in the numbers and there is nothing to
   read that says so.

   Under test:
     1. Control — a single-line invoice deletes and restores normally, and the money returns.
        (If this fails, nothing below means anything.)
     2. THE ATTACK — an old deliberate deletion must survive a delete/restore of the same
        invoice number. Restore undoes the delete that was just made, not every deletion ever
        made to that number.
     3. The totals agree: after the round trip the invoice is worth exactly what it was worth
        before it was deleted, not more.
     4. Whatever is restored, the person is told what happened — including that an older
        deletion was deliberately left alone, so "why is line 1 still gone?" has an answer on
        screen rather than in the database.

   Run:  node scripts/qa/probe-restore-scope-attacks.mjs        (port 8716)
   Sabotage: drop the deleted_at window from finRestoreInv in js/16 — checks 2, 3 and 4 go red
   with the August line resurrected. Restore byte-identical (md5), and verify by grepping for the
   fix's own comment, not only by hash (cycle 44).                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8716;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const OLD_DELETE = '2026-08-20T09:00:00.000Z';   // the deliberate one, a month ago
const line = (o) => Object.assign({
  client_group: 'Restore Test Co', customer_raw_name: 'Restore Test Co', invoice_date: '2026-05-04',
  month: 'May', quarter: 'Q2', products: 'Flights', service_type: 'Flights', record_type: 'b2b',
  wallet_portion_sar: 0, cost_sar: 0, amount_remaining_sar: 0, integrity_status: 'verified_paid',
  revenue_way: 'invoice', source_batch: 'qa-restore', vat_sar: 0, deleted_at: null,
}, o);

const srv = start(PORT, {
  finance_invoices: [
    /* the invoice under attack: three lines, one of them already deleted on purpose in August */
    line({ id: 'rs-1', invoice_no: 'RS-MULTI', line_no: 1, total_incl_vat_sar: 100000, revenue_sar: 100000, profit_sar: 100000, amount_received_sar: 100000, deleted_at: OLD_DELETE, notes: 'duplicate line, deleted on purpose in August' }),
    line({ id: 'rs-2', invoice_no: 'RS-MULTI', line_no: 2, total_incl_vat_sar: 3000, revenue_sar: 3000, profit_sar: 3000, amount_received_sar: 3000, notes: 'real line' }),
    line({ id: 'rs-3', invoice_no: 'RS-MULTI', line_no: 3, total_incl_vat_sar: 2000, revenue_sar: 2000, profit_sar: 2000, amount_received_sar: 2000, notes: 'real line' }),
    /* the control: an ordinary one-line invoice */
    line({ id: 'rs-solo', invoice_no: 'RS-SOLO', line_no: 1, total_incl_vat_sar: 1500, revenue_sar: 1500, profit_sar: 1500, amount_received_sar: 1500 }),
  ],
});
const BASE = 'http://localhost:' + PORT;
const rowsOf = async (no) => (await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + no + '&select=id,line_no,deleted_at,total_incl_vat_sar').then((r) => r.json())) || [];
const liveTotal = (rows) => rows.filter((r) => r.deleted_at == null).reduce((a, r) => a + (+r.total_incl_vat_sar || 0), 0);

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
  try { await p.waitForFunction(() => typeof window.finDelInv === 'function' && typeof window.finRestoreInv === 'function', { timeout: 90000 }); } catch (_) { }
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(2000);

  /* Say yes to the confirm, and capture anything said back — the flow as a person drives it,
     with only the "are you sure" answered for them. */
  const drive = async (fn, arg, settleFor) => {
    await p.evaluate(() => {
      window.__said = [];
      window.__oc = window.confirm; window.__oa = window.alert;
      window.confirm = () => true;
      window.alert = (m) => window.__said.push(String(m));
      try { window.pfConfirm = (m, y) => { window.__said.push('CONFIRM: ' + m); y(); }; } catch (_) { }
    });
    await p.evaluate(({ fn, arg }) => { try { window[fn](arg); } catch (e) { window.__said.push('THREW ' + e.message); } }, { fn, arg });
    /* 2026-09-08 (watch cycle 52): was a flat 2500 ms, and under six-way battery load the delete
       had not reached the database when the next line read it back — the run then reported
       "before 1500, after delete 1500" as though the app had ignored the click. Wait for the
       table to actually change, and give up only after a budget long enough for the slowest
       honest case; a poll costs nothing when the value is already there. If it never changes,
       the check below still fails, with the same evidence it always had. */
    if (settleFor) {
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        await p.waitForTimeout(250);
        if (await settleFor()) break;
      }
    } else {
      await p.waitForTimeout(2500);
    }
    return await p.evaluate(() => { try { window.confirm = window.__oc; window.alert = window.__oa; } catch (_) { } return window.__said || []; });
  };

  /* ---- 1. control ---- */
  const soloBefore = liveTotal(await rowsOf('RS-SOLO'));
  await drive('finDelInv', 'RS-SOLO', async () => liveTotal(await rowsOf('RS-SOLO')) === 0);
  const soloMid = liveTotal(await rowsOf('RS-SOLO'));
  await drive('finRestoreInv', 'RS-SOLO', async () => liveTotal(await rowsOf('RS-SOLO')) === 1500);
  const soloAfter = liveTotal(await rowsOf('RS-SOLO'));
  if (soloBefore === 1500 && soloMid === 0 && soloAfter === 1500)
    ok('control: a one-line invoice deletes to 0 and restores to its own 1,500 — delete and restore both work, so the attack below is measured against a working pair');
  else
    fail(`control failed, so nothing below can be concluded: before ${soloBefore}, after delete ${soloMid}, after restore ${soloAfter}`);

  /* ---- 2 + 3 + 4. the attack ---- */
  const before = await rowsOf('RS-MULTI');
  const beforeTotal = liveTotal(before);            // 5,000 — the August line is not in it
  const delSaid = await drive('finDelInv', 'RS-MULTI', async () => liveTotal(await rowsOf('RS-MULTI')) === 0);
  const mid = await rowsOf('RS-MULTI');
  const restSaid = await drive('finRestoreInv', 'RS-MULTI', async () => liveTotal(await rowsOf('RS-MULTI')) > 0);
  const after = await rowsOf('RS-MULTI');
  const afterTotal = liveTotal(after);
  const augustLine = after.find((r) => String(r.line_no) === '1');

  if (beforeTotal !== 5000 || liveTotal(mid) !== 0)
    fail(`the attack did not set itself up: the invoice was worth ${beforeTotal} live before (expected 5000, the August line excluded) and ${liveTotal(mid)} after the delete (expected 0)`);
  else if (augustLine && augustLine.deleted_at != null)
    ok('the August deletion survives the round trip — Restore undoes the delete that was just made, not every deletion ever made to that invoice number');
  else
    fail(`the line deleted deliberately on ${OLD_DELETE} was resurrected by Restore: it now reads deleted_at=${JSON.stringify(augustLine && augustLine.deleted_at)}. finRestoreInv un-deletes every deleted row for the number, so undoing today's delete also undid August's — money the owner ruled out a month ago is back in the totals.`);

  if (afterTotal === beforeTotal)
    ok(`and the money agrees: ${afterTotal} live after the round trip, exactly what it was worth before — a restore that gives back more than was taken is a silent revenue increase`);
  else
    fail(`the invoice is worth ${afterTotal} after being deleted and restored, against ${beforeTotal} before — the round trip changed the money by ${afterTotal - beforeTotal}`);

  const said = (restSaid || []).join(' | ');
  if (/older|earlier|left|August|أقدم|سابق|تُرك/i.test(said))
    ok('and the restore says what it did, including that an older deletion was left alone — so "why is that line still gone?" has an answer on screen rather than in the database');
  else
    fail(`the restore said nothing about scope. A person who deleted three lines' worth of invoice and got two back has no way to know that was deliberate. It said: ${JSON.stringify(said.slice(0, 300))}`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nrestore-scope OK — Restore undoes the delete that was made, not every deletion the invoice number has ever had');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
