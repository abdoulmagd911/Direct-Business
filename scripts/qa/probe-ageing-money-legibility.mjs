/* probe-ageing-money-legibility.mjs (2026-09-07, watch cycle 49) — money the owner chases people
   for, rounded off with no way to see the real figure. Attack area (ss).

   PORT NOTE: this session's block 8701–8720 is full. 8721 is taken outside it (nothing in
   scripts/qa claims it — verified by scanning every PORT= in the tree), and recorded here so the
   next cycle does not have to rediscover the block is full.

   Finance's "Collections & ageing" card prints four buckets — 0-30, 31-60, 61-90, 90+ — through
   moneyS(), which renders anything over a million as e.g. "8.76M" and anything over a thousand
   as "999.9K". The credit tile eight lines above it in the same file carries the exact figure in
   a title attribute; the buckets carry nothing. Two standards on one screen.

   That rounding is not cosmetic on this card. These four numbers are how much money is late and
   by how long — the figures somebody works from when deciding who to call. "8.76M" is anywhere
   between 8,755,000 and 8,764,999: a ten-thousand riyal band, invisible, with no hover, no tap,
   and nothing in the DOM that holds the real number.

   And a title attribute would not fix it. The owner reads this on a phone, where there is no
   hover at all — so the exact figure has to be ON the card, not behind a pointer.

   Under test, at 390x844 (a phone) and at desktop width:
     1. Control — the card renders with its buckets and the fixture's own money is in the page,
        so the checks below are measured against a screen that actually drew. (If this fails,
        nothing else means anything.)
     2. Every bucket that is abbreviated has its exact value present as TEXT on the card — not in
        a title, not behind a hover — so a phone can read it.
     3. The exact values are right: each bucket's text total matches an independent recount of
        the fixture's own outstanding rows.
     4. Nothing regressed for the reader: the abbreviation is still there, so the card is still
        scannable rather than four long numbers.

   Run:  node scripts/qa/probe-ageing-money-legibility.mjs        (port 8721)
   Sabotage: drop the exact line from _agc in js/16 — checks 2 and 3 go red. Restore from a
   POST-fix baseline and verify by grepping the fix's own comment, not only by hash (cycle 44). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8721;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

/* Outstanding money, spread across the four ageing buckets, at sizes that force every branch of
   moneyS(): millions, hundreds of thousands, thousands, and one under a thousand. */
const DAY = 24 * 60 * 60 * 1000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
const inv = (id, total, dueDaysAgo) => ({
  id, invoice_no: 'AG-' + id, line_no: 1, client_group: 'Ageing Co ' + id, customer_raw_name: 'Ageing Co ' + id,
  invoice_date: iso(dueDaysAgo + 5), due_date: iso(dueDaysAgo), month: 'May', quarter: 'Q2',
  products: 'Flights', service_type: 'Flights', record_type: 'b2b',
  total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total, cost_sar: 0, profit_sar: total,
  amount_received_sar: 0, amount_remaining_sar: total, integrity_status: 'pending',
  revenue_way: 'invoice', deleted_at: null, source_batch: 'qa-ageing', vat_sar: 0,
});
const FIX = [
  inv('m1', 8755055, 120),   // 90+      → "8.76M", real 8,755,055
  inv('k1', 999999, 75),     // 61-90    → "1000.0K", real 999,999
  inv('k2', 12345, 45),      // 31-60    → "12.3K", real 12,345
  inv('s1', 640, 10),        // 0-30     → "640"    (not abbreviated — the control for check 4)
];
const srv = start(PORT, { finance_invoices: FIX });
const BASE = 'http://localhost:' + PORT;
const exact = (n) => Math.round(n).toLocaleString('en-US');

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [label, vp] of [['a phone', { width: 390, height: 844 }], ['desktop', { width: 1500, height: 950 }]]) {
    const ctx = await b.newContext({ viewport: vp });
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
    try { await p.waitForFunction(() => typeof window.finGo === 'function', { timeout: 90000 }); } catch (_) { }
    await p.evaluate(() => { try { current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all' }; render(); if (window.finGo) finGo('clients'); } catch (_) { } });
    await p.waitForTimeout(2500);

    const card = await p.evaluate(() => {
      const heads = [...document.querySelectorAll('h3')].filter((h) => /Collections|التحصيل/i.test(h.textContent || ''));
      const host = heads.length ? heads[0].closest('.card') : null;
      return host ? { text: host.innerText, html: host.innerHTML } : null;
    });

    if (card && /90\+|0-30|٠|١/.test(card.text) && /8\.76M|8,755,055/.test(card.text))
      ok(`${label}: the Collections & ageing card rendered with its buckets and the fixture's own money — the checks below are measured against a screen that drew`);
    else { fail(`${label}: the ageing card did not render its buckets, so nothing below can be concluded. Saw: ${JSON.stringify((card && card.text || '(no card)').slice(0, 220))}`); continue; }

    /* 2 + 3: every abbreviated bucket carries its exact figure as text */
    const missing = [];
    for (const n of [8755055, 999999, 12345]) {
      if (!card.text.includes(exact(n))) missing.push(exact(n));
    }
    if (!missing.length)
      ok(`${label}: every abbreviated bucket shows its exact figure as text on the card — ${[8755055, 999999, 12345].map(exact).join(' · ')} — readable with no hover, which is the only kind of reading a phone does`);
    else
      fail(`${label}: ${missing.length} bucket(s) round money off with no exact figure anywhere on the card: ${JSON.stringify(missing)}. moneyS() renders 8,755,055 as "8.76M" — a band ten thousand riyals wide — and these four numbers are how much is late and by how long, which is what somebody works from when deciding who to chase. A title attribute would not fix it either: there is no hover on a phone. Card text: ${JSON.stringify(card.text.replace(/\n/g, ' | ').slice(0, 320))}`);

    /* 4: the abbreviation is still there — the card stays scannable */
    if (/8\.76M/.test(card.text))
      ok(`${label}: and the short form is still on the card, so it reads at a glance as well as exactly — the fix adds a line, it does not replace the number`);
    else
      fail(`${label}: the abbreviated form is gone. Four full-length numbers is not an improvement on a phone; the point was to add the exact figure, not to swap one unreadable card for another.`);

    await ctx.close();
  }
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nageing-money-legibility OK — every rounded bucket on the collections card carries its exact figure, on a phone as well as a desktop');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
