/* probe-b2c-manual-attacks.mjs (2026-09-06, watch cycle 28) - the b2c_manual revenue way, end to end.

   The fifth way money reaches Direct. Four of the five come off a Direct Payments export; this one
   is typed in by hand through js/58's form, because an individual booking has no corporate export
   to import from. js/58 is OUTSIDE this session's P4 lane, so this probe DRIVES it - through its
   own form and its own Save button, nothing poked into state - and asserts only what the lane it
   feeds (js/16, js/25, js/65) is responsible for. Anything wrong on js/58's own side is measured
   and reported for its owner, never edited here.

   Cycle 27 proved all five ways are counted exactly once in the tiles. What was still unchecked is
   everything downstream of the write: whether a hand-entered booking ages, exports, scopes and
   survives a later import the same way an imported invoice does.

   Under test:
     1. A booking saved through the real form lands as one row and is counted exactly once in
        Revenue, in the distinct-invoice count, in the Ledger and in the CSV export.
     2. js/58's own stated guarantee, never checked by anything: two bookings saved with the
        reference field left BLANK get their own generated identities and do not collapse into one
        on the Invoices tile (which counts DISTINCT invoice_no, where several nulls count as one).
     3. An UNPAID booking reaches Outstanding and ages into the bucket its date says - the ageing
        card must treat a hand-entered debt exactly like an imported one (cycle 28's other area).
     4. The sector chips still partition everything: a booking has no client link, so it classifies
        as B2B, and All/Tenders/B2B/Academies still sum to the unfiltered total with nothing lost.
     5. A later Direct Payments import carrying the same invoice number does not silently overwrite
        a hand-entered booking without saying what it is doing.

   Run:  node scripts/qa/probe-b2c-manual-attacks.mjs        (port 8706)
   Sabotage (file-level): make live() drop revenue_way='b2c_manual'; make the ageing card skip
   record_type='b2c'. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8706;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const r2 = (n) => Math.round(n * 100) / 100;

const TODAY = new Date();
const TODAY_UTC = Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate());
const dayOffset = (n) => new Date(TODAY_UTC - n * 86400000).toISOString().slice(0, 10);
const YEAR = new Date(TODAY_UTC).getUTCFullYear();

/* a small baseline of ordinary imported invoices, so a b2c row has to survive being one row
   among others rather than being the only thing on the page */
const SEED = [];
for (let i = 0; i < 6; i++) {
  const d = dayOffset(10 + i * 3), mo = +d.slice(5, 7);
  SEED.push({
    id: 'bl' + i, invoice_no: 'BL-' + i, line_no: 1, zatca_dpin: null,
    client_group: 'Baseline Co ' + i, customer_raw_name: 'Baseline Co ' + i,
    invoice_date: d, year: +d.slice(0, 4), month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: 5000 + i * 100, wallet_portion_sar: 0, revenue_sar: 5000 + i * 100,
    cost_sar: 4000, profit_sar: 1000 + i * 100, vat_sar: 0,
    amount_received_sar: 5000 + i * 100, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'b2c-qa',
    revenue_way: 'invoice', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  });
}
const BASE_REV = r2(SEED.reduce((a, r) => a + r.revenue_sar, 0));
/* 2026-09-06 (watch cycle 28): start() takes this array BY REFERENCE and the mock pushes every
   insert into it, so SEED.length grows as the bookings are saved. The first run read it live and
   reported the app short by four rows on three checks when the app was exactly right. Snapshot it. */
const N_BASE = SEED.length;

const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  console.log(`fixture: ${N_BASE} imported invoices (${BASE_REV.toLocaleString()} SAR) — every b2c booking below is entered through js/58's own form`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);

  /* ---------- enter bookings through js/58's OWN form ---------- */
  const openB2C = async () => { await p.evaluate(() => { FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('b2c'); }); await p.waitForTimeout(1200); };
  await openB2C();
  const formThere = await p.evaluate(() => !!document.getElementById('bc_date') && !!document.getElementById('bc_amt') && !!document.getElementById('bc_name') && typeof window.b2cSave === 'function');
  if (formThere) ok('the B2C entry form renders and js/58 exposes its own Save — the bookings below go in the way a person would enter them');
  else { fail('the B2C form did not render (bc_date/bc_amt/bc_name or b2cSave missing) — nothing below can be trusted'); console.log('\n✗ ' + failures + ' failed'); await b.close(); srv.close(); process.exit(1); }

  const save = async (o) => {
    await openB2C();
    await p.evaluate((o) => {
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      set('bc_date', o.date); set('bc_name', o.name); set('bc_amt', o.amt); set('bc_cost', o.cost || '');
      set('bc_ref', o.ref || ''); set('bc_svc', o.svc || ''); set('bc_notes', o.notes || '');
      const st = document.getElementById('bc_status'); if (st) st.value = o.status || 'verified_paid';
      window.b2cSave();
    }, o);
    await p.waitForTimeout(1600);
  };
  await save({ date: dayOffset(5), name: 'Individual One', amt: '2500', cost: '2000', svc: 'Flights', ref: 'B2C-KNOWN-1', status: 'verified_paid' });
  await save({ date: dayOffset(6), name: 'Individual Two', amt: '1500', cost: '1000', svc: 'Hotels', ref: '', status: 'verified_paid' });
  await save({ date: dayOffset(7), name: 'Individual Three', amt: '900', cost: '600', svc: 'Visa', ref: '', status: 'verified_paid' });
  await save({ date: dayOffset(75), name: 'Individual Four', amt: '4000', cost: '3000', svc: 'Packages', ref: 'B2C-UNPAID-1', status: 'pending' });

  const stored = await fetch(BASE + '/rest/v1/finance_invoices?revenue_way=eq.b2c_manual').then(r => r.json());
  note(`stored b2c rows: ${stored.length} — refs [${stored.map(r => r.invoice_no).join(', ')}]`);
  if (stored.length === 4) ok('all four bookings saved as four separate rows through the real form');
  else { fail(`${stored.length} b2c rows were stored, four bookings were entered`); }

  /* ---------- 2. blank references must not collapse ---------- */
  const blanks = stored.filter(r => !/^B2C-(KNOWN|UNPAID)-/.test(r.invoice_no));
  const blankRefs = new Set(blanks.map(r => r.invoice_no));
  if (blanks.length === 2 && blankRefs.size === 2 && !blanks.some(r => r.invoice_no == null || r.invoice_no === ''))
    ok(`the two bookings saved with the reference left blank were each given their own identity (${[...blankRefs].join(', ')}) — neither is null, and they do not collapse into one on a tile that counts DISTINCT invoice_no`);
  else fail(`blank-reference bookings did not each get their own identity: ${JSON.stringify(blanks.map(r => r.invoice_no))}`);

  /* ---------- 1. counted exactly once on every surface ---------- */
  await p.evaluate(() => { FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length >= 10)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  await p.waitForTimeout(1400);
  const tile = (label) => p.evaluate((label) => {
    const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    const v = el && el.children[1]; if (!v) return null;
    const t = v.getAttribute('title');
    if (t) return +t.replace(/[^\d.-]/g, '');
    const n = +String(v.textContent).replace(/[^\d.-]/g, ''); return isFinite(n) ? n : null;
  }, label);
  /* Revenue reads verified-paid rows only, so the pending booking is deliberately outside it */
  const paidB2C = stored.filter(r => r.integrity_status === 'verified_paid');
  const wantRev = r2(BASE_REV + paidB2C.reduce((a, r) => a + (+r.revenue_sar || 0), 0));
  const gotRev = await tile('Revenue');
  if (gotRev != null && Math.abs(gotRev - wantRev) < 0.02) ok(`Revenue is ${wantRev.toLocaleString()} — the ${paidB2C.length} settled bookings are counted once each alongside the ${N_BASE} imported invoices (the unpaid one is correctly outside, as the tile's own subtitle says)`);
  else fail(`Revenue tile ${gotRev}, independent recount ${wantRev}`);
  const wantInv = N_BASE + paidB2C.length;
  const gotInv = await tile('Invoices');
  if (gotInv === wantInv) ok(`the Invoices tile counts ${wantInv} distinct references — the two blank-reference bookings count as two, not one`);
  else fail(`the Invoices tile shows ${gotInv}, expected ${wantInv} — blank-reference bookings may be collapsing`);

  const ledgerRows = await p.evaluate(() => new Promise(res => { finGo('ledger'); setTimeout(() => res((window.finLive ? finLive() : []).filter(window.finInPeriod).length), 1000); }));
  if (ledgerRows === N_BASE + stored.length) ok(`the ledger lists all ${N_BASE + stored.length} rows — hand-entered bookings are not filtered out of it`);
  else fail(`the ledger sees ${ledgerRows} rows, expected ${N_BASE + stored.length}`);
  const csv = await p.evaluate(() => new Promise(res => {
    let captured = null;
    const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
    try { window.finLedgerCSV(); } catch (e) { }
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2;
    if (!captured) return res(null);
    captured.text().then(t => res(t.replace(/^﻿/, '').replace(/\r/g, '').trim()));
  }));
  const csvLines = csv ? csv.split('\n').length - 1 : null;
  const csvHasB2C = csv ? stored.every(r => csv.indexOf(r.invoice_no) >= 0) : false;
  if (csvLines === N_BASE + stored.length && csvHasB2C) ok('the invoice export carries every hand-entered booking by its own reference — the file a manager sends out is not missing the individual bookings');
  else fail(`the export holds ${csvLines} rows (expected ${N_BASE + stored.length})${csvHasB2C ? '' : ' and does not name every b2c reference'}`);

  /* ---------- 3. an unpaid booking ages like any other debt ---------- */
  await p.evaluate(() => { finGo('clients'); }); await p.waitForTimeout(1500);
  const ageing = await p.evaluate(() => {
    const h3 = [...document.querySelectorAll('#view h3')].find(e => /Collections & ageing|التحصيل والتقادم/.test(e.textContent));
    if (!h3) return null;
    const c = h3.closest('.card'), chips = {};
    c.querySelectorAll('div').forEach(d => {
      const l = d.firstElementChild, v = d.children[1];
      if (l && v && d.children.length === 2) chips[(l.textContent || '').trim()] = (v.textContent || '').trim();
    });
    return chips;
  });
  /* the ageing chips print through moneyS(), which abbreviates at 1K and 1M — reading "4.0K" as
     4 made the app look wrong by a factor of a thousand on the first run. Undo the abbreviation. */
  const numOf = (s) => {
    if (s == null) return null;
    const m = String(s).match(/(-?[\d,.]+)\s*([KM])?/);
    if (!m) return null;
    const v = +m[1].replace(/,/g, '');
    return isFinite(v) ? v * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1) : null;
  };
  const unpaid = stored.find(r => r.integrity_status === 'pending');
  const wantOut = unpaid ? +unpaid.amount_remaining_sar : 0;
  const gotOut = ageing ? numOf(ageing['Outstanding']) : null;
  const b6190 = ageing ? numOf(ageing['61–90 days']) : null;
  if (gotOut === wantOut && wantOut > 0) ok(`the unpaid booking's ${wantOut.toLocaleString()} SAR reaches Outstanding — a hand-entered debt is collectable money like any other`);
  else fail(`Outstanding reads ${gotOut}, the unpaid booking carries ${wantOut}`);
  if (b6190 === wantOut) ok(`and it ages into 61–90 days, which is where its ${dayOffset(75)} date (75 days old) belongs — not into 0–30 and not into "No invoice date"`);
  else fail(`the 75-day-old booking is not in the 61–90 bucket (that bucket reads ${b6190}, the debt is ${wantOut}) — chips: ${JSON.stringify(ageing)}`);

  /* ---------- 4. the sector chips still partition everything ---------- */
  const bySector = {};
  for (const s of ['all', 'tenders', 'b2b', 'academies']) {
    await p.evaluate((s) => { FIN.p.sector = s; if (typeof clearFinCanon === 'function') clearFinCanon(); finGo('overview'); }, s);
    await p.waitForTimeout(1000);
    bySector[s] = await tile('Revenue');
  }
  note(`Revenue by chip: ${JSON.stringify(bySector)}`);
  const parts = r2((bySector.tenders || 0) + (bySector.b2b || 0) + (bySector.academies || 0));
  if (Math.abs(parts - (bySector.all || 0)) < 0.02) ok(`the three sector chips add up to the unfiltered total (${parts.toLocaleString()}) — a hand-entered booking has no client link and so classifies as B2B, but nothing is lost or double-counted between the chips`);
  else fail(`the chips sum to ${parts}, All sectors reads ${bySector.all} — ${Math.abs(parts - (bySector.all || 0))} is lost or double-counted, and the b2c rows are the rows with no client link`);
  if ((bySector.b2b || 0) > 0 && Math.abs((bySector.b2b || 0) - (bySector.all || 0)) < 0.02)
    note('every row in this fixture classifies as B2B, so the chips cannot distinguish an individual booking from a corporate one — there is no B2C chip. Recorded as a measurement for the owner, not asserted as a defect.');

  /* ---------- 5. an import must not silently overwrite a hand-entered booking ---------- */
  await p.evaluate(() => { FIN.p.sector = 'all'; if (typeof clearFinCanon === 'function') clearFinCanon(); });
  const known = stored.find(r => r.invoice_no === 'B2C-KNOWN-1');
  const before = JSON.stringify(known);
  /* 2026-09-06 (watch cycle 28): the first version of this check used invented column names, so
     the importer answered "not recognized — teach this file's columns" and no preview was ever
     produced. The check reported a soft note and passed, having exercised nothing. Teach the
     signature first, the way probe-importer-concurrency-attacks does, so the collision is really
     put to the app. */
  const HEADER = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
  await p.evaluate((header) => {
    DB.settings = DB.settings || {};
    DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map(h => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
  }, HEADER);
  const csvText = [HEADER.join(','),
    ['B2C-KNOWN-1', 'Some Corporate Name', dayOffset(5), 99999, 1].join(','),
    ['FRESH-1', 'Another Co', dayOffset(4), 7000, 5000].join(',')].join('\n');
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); });
  await p.waitForTimeout(800);
  await p.evaluate(([n, t]) => window.v65IngestText(n, t), ['dp-export.csv', csvText]);
  const impOut = () => p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
  let last = '', same = 0;
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(400); const cur = await impOut(); if (cur && cur === last) { if (++same >= 3) break; } else same = 0; last = cur; }
  const preview = { text: last };
  const after = await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.B2C-KNOWN-1').then(r => r.json());
  if (JSON.stringify(after[0]) === before) ok('previewing an import that names a hand-entered booking writes nothing on its own — the booking is byte-identical after the preview');
  else fail('merely previewing an import CHANGED the hand-entered booking on disk');
  /* the check must be able to fail: prove the preview really ran before reading anything off it */
  const m = (preview.text || '').match(/New\s+(\d+)\s*·\s*Updated\s+(\d+)/);
  if (!m) fail(`the import preview never produced a count, so the collision was never put to the app. Preview said: ${(preview.text || '').slice(0, 200).replace(/\s+/g, ' ')}`);
  else if (+m[1] === 1 && +m[2] === 1) ok(`the preview declares it plainly — New 1 · Updated 1 — so the person sees that one of the two rows will overwrite an existing booking before pressing Confirm, rather than it happening silently`);
  else fail(`the preview reports New ${m[1]} · Updated ${m[2]}; one genuinely new row and one collision with a hand-entered booking should read New 1 · Updated 1`);

  if (!errors.length) ok('no page error across four hand-entered bookings, a re-load, four sector chips and an import preview');
  else fail('page errors: ' + errors.slice(0, 3).join(' | '));

  console.log('\n' + (failures ? '✗ ' + failures + ' failed' : '✓ all checks passed'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
