/* probe-ageing-printed-arithmetic.mjs (2026-09-08, watch cycle 62) — the ageing buckets, added up
   the way the person chasing a late invoice adds them up. Attack area (af).

   PORT NOTE: 8701–8731 are taken. This is 8732, verified free by scanning every PORT= in
   scripts/qa.

   Fourth surface in the class cycles 59–61 opened: a promise that is arithmetic performed by eye,
   never checked in printed text. The Collections & ageing card on the Clients tab shows
   Outstanding, then six amounts under it — 0–30, 31–60, 61–90, 90+, and where they exist "No
   invoice date" and "Dated in the future". Every riyal in Outstanding is in exactly one of those
   six, by construction: the loop adds `out` to arOut and then to exactly one bucket.

   So the six must come to Outstanding, and this card is the one place in the app where they are
   read that way — a person deciding who to call reads down the buckets and expects the total
   above to be their sum.

   Cycle 49 already fought a rounding battle here and won it: moneyS() renders 8,755,055 as
   "8.76M", so finExactUnder() prints the exact figure underneath whenever the short form hides
   anything. That fix is about ONE number being legible. It says nothing about whether six of them
   still add up to a seventh, because finExactUnder rounds to the whole riyal (money0) — so six
   buckets each rounded up a few hallalas can miss the Outstanding figure they belong to.

   Fixtures are seeded the way the app's own write paths write (cycle 61: js/65 and js/41 both
   store Math.round(x*100)/100 — a value with more than two decimals never reaches a stored row,
   and a fixture carrying one would be this probe inventing a defect). Two decimals is exactly
   what makes the question real here: a hallala is below the riyal the card prints.

   Under test:
     1. Control — whole-riyal outstanding amounts: the printed buckets sum exactly to the printed
        Outstanding. (If this fails the probe is misreading the card and nothing below means
        anything.)
     2. THE QUESTION — amounts carrying hallalas: the printed buckets must still sum to the
        printed Outstanding, or the card must say why they cannot.
     3. "No invoice date" and "Dated in the future" are inside Outstanding too — a row in either
        must be counted in the total above, never quietly dropped from it. (Cycles 6 and 28 put
        those rows there deliberately; this holds them to it in printed text.)
     4. Nothing moved: Outstanding's own underlying figure is unchanged by whatever this cycle
        does to the card.

   Run:  node scripts/qa/probe-ageing-printed-arithmetic.mjs        (port 8732)
   Sabotage: whatever this cycle adds, remove it — check 2 goes red. Assert the sabotage APPLIED
   with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8732;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);

const srv = start(PORT, {});
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
  if (!(await p.waitForFunction(() => typeof window.finGo === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('the Finance page never loaded, so nothing below examined anything');

  /* Ages chosen to land one row in each bucket, plus the two that are not ages at all. */
  const seed = (amounts) => p.evaluate((am) => {
    const r2 = (n) => Math.round(n * 100) / 100;                    // exactly how js/65 and js/41 store
    const ago = (d) => { const t = new Date(Date.now() - d * 86400000); return t.toISOString().slice(0, 10); };
    const ahead = (d) => { const t = new Date(Date.now() + d * 86400000); return t.toISOString().slice(0, 10); };
    const base = { integrity_status: 'partly_paid', record_type: 'invoice', deleted_at: null, service_type: 'flights', cost_sar: 0, profit_sar: 0, quarter: 'Q1', year: 2026, month: 'March' };
    const mk = (id, date, out) => Object.assign({}, base, {
      id, invoice_no: id.toUpperCase(), client_group: 'Marlow Freight', customer_raw_name: 'Marlow Freight',
      invoice_date: date, total_incl_vat_sar: r2(out), revenue_sar: r2(out),
      amount_received_sar: 0, amount_remaining_sar: r2(out), collection_due_date: null,
    });
    FIN.rows = [
      mk('ag-a', ago(10), am[0]), mk('ag-b', ago(45), am[1]), mk('ag-c', ago(75), am[2]),
      mk('ag-d', ago(200), am[3]), Object.assign(mk('ag-e', null, am[4]), { invoice_date: null }),
      mk('ag-f', ahead(20), am[5]),
    ];
    FIN.p = { year: 'all', part: 'all' };
    FIN.tab = 'clients';
    if (window.finGo) finGo('clients'); else render();
  }, amounts);

  /* Printed text only. For each amount the card shows a short form ("8.76M") and, when the short
     form hides something, an exact line beneath it. The figure a person would use is the exact
     line where there is one, and the short form otherwise — so that is what gets added up. */
  const readCard = () => p.evaluate(() => {
    const view = document.getElementById('view');
    const cards = [].slice.call(view.querySelectorAll('.card'));
    const card = cards.find((c) => /Collections|التحصيل/.test(c.textContent || ''));
    if (!card) return { err: 'the Collections & ageing card is not on screen' };
    const unshort = (s) => {
      s = String(s || '').trim().replace(/,/g, '');
      const m = s.match(/^(-?[\d.]+)([KM])?$/);
      if (!m) return null;
      return Number(m[1]) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1);
    };
    /* A displayed amount = the first number in the block, plus an optional exact line under it. */
    const figureOf = (el) => {
      const txt = (el.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const exactLine = txt.find((l) => /^[\d,]+ SAR$/.test(l));
      if (exactLine) return { used: 'exact', v: Number(exactLine.replace(/[^\d]/g, '')) };
      const shortLine = txt.find((l) => /[\d.]+[KM]?\s*SAR/.test(l)) || txt[1] || '';
      return { used: 'short', v: unshort(String(shortLine).replace(/SAR/, '')) };
    };
    const buckets = [].slice.call(card.querySelectorAll('div[style*="background:#F9FAFB"]')).map((d) => {
      const lines = (d.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
      return { label: lines[0] || '', ...figureOf(d) };
    });
    /* Outstanding sits in the mini row, labelled. */
    const minis = [].slice.call(card.querySelectorAll('div[style*="min-width:110px"]'));
    const outEl = minis.find((d) => /Outstanding|المستحق/.test(d.innerText || ''));
    const outstanding = outEl ? figureOf(outEl) : null;
    return { buckets, outstanding, prose: (card.innerText || '').replace(/\s+/g, ' ') };
  });

  const run = async (amounts, label) => {
    await seed(amounts);
    await p.waitForTimeout(1400);
    const c = await readCard();
    if (c.err) return { err: c.err };
    const sum = c.buckets.reduce((a, x) => a + (x.v || 0), 0);
    note(`${label}: buckets ${c.buckets.map((x) => x.label + '=' + x.v).join(', ')} → ${sum}; Outstanding ${c.outstanding && c.outstanding.v}`);
    return { ...c, sum };
  };

  /* ---- 1. control: whole riyals ---- */
  const ctl = await run([1000, 2000, 3000, 4000, 500, 250], 'control');
  if (ctl.err) fail(`control: ${ctl.err} — nothing below can be concluded`);
  else if (ctl.buckets.length === 6 && ctl.outstanding && ctl.sum === ctl.outstanding.v && ctl.sum === 10750)
    ok('control: six whole-riyal buckets are printed and they sum exactly to the printed Outstanding (10,750) — the card adds up, and this probe can read it');
  else
    fail(`control: could not read a clean ageing card (buckets ${ctl.buckets.length}, sum ${ctl.sum}, outstanding ${JSON.stringify(ctl.outstanding)}) — nothing below can be concluded`);

  /* ---- 3. the two non-age amounts are inside Outstanding ---- */
  if (!ctl.err) {
    const hasNoDate = ctl.buckets.some((x) => /No invoice date|بدون تاريخ/.test(x.label));
    const hasFuture = ctl.buckets.some((x) => /future|مستقبلي/.test(x.label));
    if (hasNoDate && hasFuture && ctl.outstanding && ctl.outstanding.v === ctl.sum)
      ok('a row with no invoice date and a row dated in the future are both shown as their own amounts AND counted inside Outstanding — cycles 6 and 28 put them there rather than in a bucket that claims an age, and the total still owns them');
    else
      fail(`the two non-age amounts are not both shown and counted (no-date shown: ${hasNoDate}, future shown: ${hasFuture}, sum ${ctl.sum} vs Outstanding ${ctl.outstanding && ctl.outstanding.v}). Money that is outstanding must be visible somewhere on this card.`);
  }

  /* ---- 2. THE QUESTION: hallalas ---- */
  const frac = await run([1000.4, 2000.4, 3000.4, 4000.4, 500.4, 250.4], 'with hallalas');
  const outV = frac.outstanding && frac.outstanding.v;
  /* Not a word-search: the card's prose must carry the EXACT outstanding total, which is the
     substantive thing a person needs when the printed figures disagree. A generic phrase would
     pass a word-search and tell nobody anything, and a probe must not search for a word it could
     have planted (cycle 57). */
  const saysWhy = new RegExp(String(10752.4.toFixed(2)).replace('.', '\\.')).test(frac.prose || '');
  if (frac.err) fail(`with fractional amounts: ${frac.err}`);
  else if (frac.sum === outV)
    ok(`amounts carrying hallalas still add up on screen: the six buckets print ${frac.sum} and Outstanding prints ${outV}`);
  else if (saysWhy)
    ok(`the printed buckets cannot add up (${frac.sum} against an Outstanding of ${outV}) and the card says so`);
  else
    fail(`six buckets holding hallalas print figures summing to ${frac.sum} under an Outstanding printed as ${outV}, with nothing on the card accounting for the difference. Every riyal in Outstanding is in exactly one bucket by construction, so this is the one card where a person reads down and expects the total above to be the sum. Cycle 49 made each number legible on its own; it did not make six of them add up to a seventh, because the exact line is itself rounded to the whole riyal.`);

  /* ---- 4. nothing moved ---- */
  const raw = await p.evaluate(() => (FIN.rows || []).reduce((a, r) => a + (+r.amount_remaining_sar || 0), 0));
  if (Math.abs(raw - 10752.4) < 0.005 && outV === Math.round(raw))
    ok(`nothing moved: the outstanding money behind the card is still exactly ${raw.toFixed(2)} and Outstanding still prints ${outV}`);
  else
    fail(`the underlying outstanding total or the printed headline moved: raw ${raw}, printed ${outV}. This cycle may change what is said about a number, never the number.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nageing-printed-arithmetic OK — the buckets a person reads down come to the Outstanding above them, or the card says why not');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
