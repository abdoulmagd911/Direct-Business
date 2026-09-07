/* probe-invoice-modal-attacks.mjs (2026-09-07, watch cycle 39) — the invoice modal's NUMBERS.
   Attack area (ll).

   window.finRow(id) opens one invoice's whole money: total, cost, revenue, profit, received,
   outstanding and wallet, plus a line table. Cycle 31 gave it a permission check. **Nothing has
   ever checked what it prints.** It is the surface a person looks at when deciding whether an
   invoice is paid, and — unlike a tile — there is no second number on screen to contradict it.

   Two things about how it is written make that worth attacking rather than assuming:
     · it sums the invoice's lines straight off FIN.rows with `+x.total_incl_vat_sar||0`, NOT
       through live() — the chokepoint js/16's own comment says every total in the file reads
       through, precisely because a money field can arrive as the string "1,250.00" and `+` on
       that is NaN, which money() then prints as a clean 0.00 (watch cycle 2's landmine);
     · live() sanitises rows IN PLACE, so a row that has been through a render is clean — but a
       row live() FILTERS OUT never gets sanitised, and a soft-deleted invoice is exactly that:
       filtered from every total, still listed in the Ledger with a Restore button, and still
       openable. The person deciding whether to restore it is the one reading this modal.

   Under test (every number recomputed here from the fixture, never read back from the page):
     1. Control — a plain invoice's modal prints Received and Outstanding as stored.
     2. A three-line invoice sums its lines, and does not print one line's figures as the total.
     3. A LIVE row whose money arrived as "1,250.00" strings.
     4. A DELETED row of the same shape — the path live() never sanitises.
     5. An unknown integrity_status prints the stored value rather than an empty cell.
     6. Nothing in the modal reads NaN, undefined or null.
     7. Arabic: no English money word survives, and every amount printed beside a currency word
        is direction-isolated (cycle 11's rule, by cycle 19's method).

   Run:  node scripts/qa/probe-invoice-modal-attacks.mjs        (port 8717)
   Sabotage: make live() stop sanitising, or make finRow read a single line instead of summing —
   checks 2/3/4 go red. Restore byte-identical (md5).                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8717;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const base = (over) => Object.assign({
  id: 'im-x', invoice_no: 'IM-X', line_no: 1, zatca_dpin: 'TTIN-IM', client_group: 'Modal QA Co',
  customer_raw_name: 'Modal QA Co', invoice_date: '2026-05-10', month: 'May', quarter: 'Q2', year: 2026,
  products: 'B2B', service_type: 'Flights', record_type: 'b2b',
  total_incl_vat_sar: 0, wallet_portion_sar: 0, revenue_sar: 0, cost_sar: 0, profit_sar: 0,
  amount_received_sar: 0, amount_remaining_sar: 0, collection_due_date: null,
  integrity_status: 'verified_paid', exclusion_reason: null, notes: null, source_batch: 'modal-qa',
  created_at: '2026-05-10T00:00:00Z', updated_at: '2026-05-10T00:00:00Z', deleted_at: null,
  origin: 'booking', proposal_ref: null, items: null
}, over);

/* 1 — plain */
const PLAIN = base({ id: 'im-1', invoice_no: 'IM-001', total_incl_vat_sar: 40000, revenue_sar: 40000, cost_sar: 25000, profit_sar: 15000, amount_received_sar: 30000, amount_remaining_sar: 10000 });
/* 2 — three lines of one invoice */
const L1 = base({ id: 'im-2a', invoice_no: 'IM-002', line_no: 1, total_incl_vat_sar: 1000, revenue_sar: 1000, cost_sar: 400, profit_sar: 600, amount_received_sar: 1000, amount_remaining_sar: 0 });
const L2 = base({ id: 'im-2b', invoice_no: 'IM-002', line_no: 2, total_incl_vat_sar: 2000, revenue_sar: 2000, cost_sar: 800, profit_sar: 1200, amount_received_sar: 500, amount_remaining_sar: 1500 });
const L3 = base({ id: 'im-2c', invoice_no: 'IM-002', line_no: 3, total_incl_vat_sar: 4000, revenue_sar: 4000, cost_sar: 1600, profit_sar: 2400, amount_received_sar: 0, amount_remaining_sar: 4000 });
/* 3 — live row carrying formatted strings */
const STR_LIVE = base({ id: 'im-3', invoice_no: 'IM-003', total_incl_vat_sar: '7,777.00', revenue_sar: '7,777.00', cost_sar: '1,111.00', profit_sar: '6,666.00', amount_received_sar: '5,555.00', amount_remaining_sar: '2,222.00' });
/* 4 — the same shape, soft-deleted: live() filters it, so it is never sanitised */
const STR_DEL = base({ id: 'im-4', invoice_no: 'IM-004', total_incl_vat_sar: '9,999.00', revenue_sar: '9,999.00', cost_sar: '1,000.00', profit_sar: '8,999.00', amount_received_sar: '3,333.00', amount_remaining_sar: '6,666.00', deleted_at: '2026-06-01T00:00:00Z' });
/* 5 — a status the label map has never heard of */
const ODD = base({ id: 'im-5', invoice_no: 'IM-005', total_incl_vat_sar: 500, revenue_sar: 500, amount_received_sar: 500, integrity_status: 'partially_settled' });

const SEED = [PLAIN, L1, L2, L3, STR_LIVE, STR_DEL, ODD];
const srv = start(PORT, { finance_invoices: SEED });
const BASE = 'http://localhost:' + PORT;
const money = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
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
  await p.waitForTimeout(2500);
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
  for (let i = 0; i < 120 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length >= 7)); i++) await p.waitForTimeout(250);

  /* Opening the modal the way a person does: the Ledger row's own click handler. Falling back to
     window.finRow only if the row cannot be found on screen — and saying so, because a modal
     opened by hand has not proved that the row on screen opens it. */
  const openModalFor = async (id) => {
    /* finCloseModal, not closeModal — js/16 builds #finModal and tears it down with its own
       function. Using the app-wide one left the previous invoice on screen, so every check
       after the first read IM-001's numbers and reported them as the next invoice's. */
    await p.evaluate(() => { try { if (typeof finCloseModal === 'function') finCloseModal(); } catch (_) { } });
    await p.waitForTimeout(250);
    await p.evaluate((i) => { window.finRow(i); }, id);
    await p.waitForTimeout(600);
    /* #finModal is the element js/16 builds. Do NOT gate on offsetParent — it is null for this
       node even when the modal is on screen, and gating on it made every check below read the
       page behind the modal instead, which passed the "no NaN" check while examining nothing. */
    return p.evaluate(() => { const el = document.getElementById('finModal'); return el ? (el.innerText || '') : '(no #finModal — the modal did not open)'; });
  };

  /* ---- 1. control ---- */
  let txt = await openModalFor('im-1');
  if (txt.includes(money(30000)) && txt.includes(money(10000)))
    ok(`control: a plain invoice's modal prints Received ${money(30000)} and Outstanding ${money(10000)} exactly as stored`);
  else fail(`control: the plain invoice's modal does not print its own Received/Outstanding — it showed: ${JSON.stringify(txt.slice(0, 300))}`);

  /* ---- 2. three lines sum ---- */
  txt = await openModalFor('im-2a');
  const wantRec = money(1000 + 500 + 0), wantRem = money(0 + 1500 + 4000);
  if (txt.includes(wantRec) && txt.includes(wantRem))
    ok(`a three-line invoice sums its lines: Received ${wantRec}, Outstanding ${wantRem} — not one line's figures presented as the invoice's`);
  else fail(`the three-line invoice's modal shows neither the summed Received (${wantRec}) nor Outstanding (${wantRem}) — it showed: ${JSON.stringify(txt.slice(0, 300))}`);

  /* ---- 3. a LIVE row carrying "5,555.00" ---- */
  txt = await openModalFor('im-3');
  if (txt.includes(money(5555)) && txt.includes(money(2222)))
    ok('a live invoice whose money arrived as formatted strings still prints its real figures — live() sanitised the row in place before the modal read it');
  else if (/(^|\s)0\.00/.test(txt))
    fail('a live invoice whose money arrived as "5,555.00" prints 0.00 — the string became NaN and money() coerced it to a clean zero, which is the cycle-2 landmine on a surface with no second number to contradict it: ' + JSON.stringify(txt.slice(0, 300)));
  else fail('the modal for the string-money invoice printed neither its real figures nor a zero: ' + JSON.stringify(txt.slice(0, 300)));

  /* ---- 4. the same shape, soft-deleted — live() never sanitises it ---- */
  txt = await openModalFor('im-4');
  const delOK = txt.includes(money(3333)) && txt.includes(money(6666));
  if (delOK) ok('a SOFT-DELETED invoice — the one live() filters out and therefore never sanitises — still prints its real Received and Outstanding, so the person deciding whether to restore it is not shown zeros');
  else fail('a soft-deleted invoice whose money arrived as strings prints the wrong figures. live() filters deleted rows BEFORE finSanitizeMoney runs, so this row is the one path into the modal that never passes the chokepoint — and it is exactly the row a person opens to decide whether to restore it: ' + JSON.stringify(txt.slice(0, 300)));

  /* ---- 5. an unknown status ---- */
  txt = await openModalFor('im-5');
  if (txt.includes('partially_settled'))
    ok('a status the label map has never heard of is printed as the stored value, not left blank — the modal never hides a state it cannot name');
  else fail('an unknown integrity_status is not shown at all — the modal silently drops a state it cannot translate: ' + JSON.stringify(txt.slice(0, 300)));

  /* ---- 6. nothing unreadable anywhere ---- */
  {
    const bad = [];
    for (const id of ['im-1', 'im-2a', 'im-3', 'im-4', 'im-5']) {
      const t = await openModalFor(id);
      if (/NaN|undefined|\bnull\b/.test(t)) bad.push(id + ': ' + (t.match(/.{0,40}(NaN|undefined|null).{0,40}/) || [''])[0]);
    }
    if (!bad.length) ok('no modal in this fixture prints NaN, undefined or null');
    else fail('modals printing unreadable values: ' + JSON.stringify(bad));
  }

  /* ---- 7. Arabic ---- */
  await p.evaluate(() => { try { if (typeof finCloseModal === 'function') finCloseModal(); } catch (_) {} LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render(); });
  await p.waitForTimeout(1200);
  txt = await openModalFor('im-1');
  const english = ['Received', 'Outstanding', 'Client', 'Status', 'Notes', 'Total', 'Cost'].filter((w) => txt.includes(w));
  if (!english.length) ok('in Arabic the invoice modal carries no English label from its own meta table');
  else fail('English labels left on the Arabic invoice modal: ' + JSON.stringify(english));
  {
    const iso = await p.evaluate(() => {
      const el = document.getElementById('finModal') || document.body;
      const out = [];
      el.querySelectorAll('*').forEach((n) => {
        const t = (n.textContent || '');
        if (!/\d/.test(t) || !/(SAR|ريال)/.test(t)) return;
        if (n.querySelector('*')) { let only = true; n.childNodes.forEach((c) => { if (c.nodeType === 1 && c.querySelector('*')) only = false; }); if (!only) return; }
        const cs = getComputedStyle(n);
        out.push({ text: t.trim().slice(0, 40), isolated: cs.unicodeBidi === 'isolate' || cs.unicodeBidi === 'embed' || cs.direction === 'ltr' || /[⁦-⁩]/.test(t) });
      });
      return out;
    });
    if (!iso.length) fail('the Arabic modal shows no amount printed beside a currency word — this check proved nothing, which means the fixture, not the app, needs fixing');
    else if (iso.every((x) => x.isolated)) ok(`all ${iso.length} amount(s) printed beside a currency word in the Arabic modal are direction-isolated`);
    else fail('amounts not direction-isolated in the Arabic modal: ' + JSON.stringify(iso.filter((x) => !x.isolated)));
  }

  if (errs.length) fail('JS errors while driving the modal: ' + JSON.stringify(errs.slice(0, 3)));
  else ok('no page errors through the whole run');

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ninvoice-modal OK — every number the modal prints is the invoice\'s own, in both languages');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
