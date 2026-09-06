/* probe-promo-revenue-attacks.mjs (2026-09-03, watch cycle 27) - the promo-code revenue way.

   Revenue reaches Direct five ways. Four of them (invoice, transaction, commission, promo_code)
   come off a Direct Payments export; the fifth (b2c_manual) is typed in by hand. Two of the five
   had never been driven by any probe, and one of them - promo_code - has a 200-row registry
   sitting behind it claiming 27,304,067 SAR against 2,030,764 SAR of real revenue. The owner
   ruled on 2026-08-22 that the registry must NOT appear bundled into Finance ("200 rows claiming
   27,304,067 SAR ... read as a live number on the page, not a footnote"). Nothing guarded that
   ruling, and nothing checked that promo money is counted once.

   Also: until this cycle no probe had ever seen a NON-EMPTY promo registry at all. The mock
   answers an unknown table with an empty list, so every existing probe loaded `promo_codes` as
   [] and proved nothing about it.

   Under test:
     1. The registry loads in full - 1200 codes, so the read must page past the 1000-row ceiling.
        (Positive control for everything below: the registry really is in memory.)
     2. The registry's money NEVER reaches the Finance page. Not the card, not a tile, not any
        rendered figure. Controlled by check 5, which proves this probe can find a number on the
        page when one is there.
     3. Promo-code revenue is counted exactly ONCE in every surface - tiles, ledger, export -
        and check 8 proves it is counted at all rather than silently dropped.
     4. A hostile registry (a zero code, a negative total, two codes with the same name, null
        totals, a code named like markup) cannot disturb one figure on the Finance page.
     5. Promo rows obey year, month and sector exactly like an invoice-way row.
     6. The revenue-way editor offers every way the DATABASE accepts. It offered four of five:
        opening a b2c_manual invoice showed "Actual invoice" selected, and one Save silently
        rewrote the stored way. Check 17 is that defect; check 16 is its positive control.

   Run:  node scripts/qa/probe-promo-revenue-attacks.mjs        (port 8231)
   Sabotage (file-level): switch SHOW_PROMO_ON_FINANCE back on in js/25 -> the withheld-registry
   checks go red; drop 'promo_code' rows out of live() in js/16 -> the counted-once checks go red;
   revert WAYS to the four-way list -> check 17 goes red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8231;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const r2 = (n) => Math.round(n * 100) / 100;

/* every way the database's CHECK constraint accepts, read off the live schema 2026-09-03:
   CHECK (revenue_way = ANY (ARRAY['invoice','transaction','commission','promo_code','b2c_manual'])) */
const DB_WAYS = ['invoice', 'transaction', 'commission', 'promo_code', 'b2c_manual'];

const CLIENTS = [
  { group: 'Promo Tender A', biz: 'pz-a', profile: 'tender' },
  { group: 'Promo Tender B', biz: 'pz-b', profile: 'tender' },
  { group: 'Promo B2B C',    biz: 'pz-c', profile: 'postpaid' },
  { group: 'Promo B2B D',    biz: 'pz-d', profile: 'postpaid' }
];
function inv(id, c, date, total, cost, way) {
  const mo = +date.slice(5, 7);
  return {
    id, invoice_no: 'PZ-' + id, line_no: 1, zatca_dpin: null,
    client_group: c.group, customer_raw_name: c.group, invoice_date: date, year: +date.slice(0, 4),
    month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: way === 'b2c_manual' ? 'b2c' : 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total, cost_sar: cost, profit_sar: total - cost,
    vat_sar: 0, amount_received_sar: total, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'pz-qa', revenue_way: way,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  };
}
/* Every client carries every way, in both years and several months, so no combination of
   year x month x sector can leave a set that happens to hold only one way. */
/* 2026-09-06 (watch cycle 29, mutation audit round four): cycle 27 added a fallback so an
   unrecognised STORED revenue way is offered back as itself rather than silently rewritten — and
   nothing exercised it, because with all five known ways in the list the fallback never fires.
   Removing it entirely changed no check. This row carries a way the editor does not know (the
   live CHECK constraint would refuse it, which is the point: it models the database gaining a way
   before this file hears about it, exactly the situation the fallback exists for) and is seeded
   directly, bypassing the write path, so the constraint is not what is under test here. */
const UNKNOWN_WAY = 'partner_rebate';
const SEED = [];
let n = 0;
[2025, 2026].forEach(y => {
  CLIENTS.forEach((c, ci) => {
    DB_WAYS.forEach((way, wi) => {
      const mo = [1, 3, 5, 7, 9][wi];
      n++;
      SEED.push(inv('i' + n, c, y + '-' + String(mo).padStart(2, '0') + '-14', 1000 + n * 7 + ci * 13, 300 + n, way));
    });
  });
});

SEED.push(inv('u1', CLIENTS[2], '2026-11-09', 4321, 1000, UNKNOWN_WAY));

/* A registry big enough to force paging, and hostile enough that any per-row handling would
   show. Its total is far larger than the real revenue in SEED - which is the whole point of the
   owner's ruling, and what makes a leak onto the page unmistakable. */
const PROMOS = [];
for (let i = 0; i < 1194; i++) {
  PROMOS.push({ id: 'pc' + i, code: 'CODE' + i, slug: 's' + i, kind: 'percent', value_pct: (i % 25) + 1,
    valid_from: '2025-01-01', valid_to: '2026-12-31', total_sales_sar: 20000 + i * 11,
    total_discount_sar: 1000 + i, active: i % 3 !== 0, expired: i % 7 === 0, created_by: 'QA' });
}
PROMOS.push({ id: 'pcz', code: 'ZEROSALES', slug: 'sz', kind: 'percent', value_pct: 5, valid_from: '2025-01-01', valid_to: '2026-12-31', total_sales_sar: 0, total_discount_sar: 0, active: true, expired: false, created_by: 'QA' });
PROMOS.push({ id: 'pcn', code: 'NEGATIVE', slug: 'sn', kind: 'percent', value_pct: 5, valid_from: '2025-01-01', valid_to: '2026-12-31', total_sales_sar: -5000, total_discount_sar: -250, active: true, expired: false, created_by: 'QA' });
PROMOS.push({ id: 'pcd1', code: 'DUPE', slug: 'sd1', kind: 'percent', value_pct: 10, valid_from: '2025-01-01', valid_to: '2026-12-31', total_sales_sar: 7777, total_discount_sar: 777, active: true, expired: false, created_by: 'QA' });
PROMOS.push({ id: 'pcd2', code: 'DUPE', slug: 'sd2', kind: 'percent', value_pct: 90, valid_from: '2025-01-01', valid_to: '2026-12-31', total_sales_sar: 8888, total_discount_sar: 888, active: true, expired: false, created_by: 'QA' });
PROMOS.push({ id: 'pcu', code: 'NULLTOTALS', slug: 'su', kind: 'percent', value_pct: 5, valid_from: null, valid_to: null, total_sales_sar: null, total_discount_sar: null, active: null, expired: null, created_by: 'QA' });
PROMOS.push({ id: 'pcx', code: '<img src=x onerror=alert(1)>', slug: 'sx', kind: 'percent', value_pct: 5, valid_from: '2025-01-01', valid_to: '2026-12-31', total_sales_sar: 123456, total_discount_sar: 1234, active: true, expired: false, created_by: 'QA' });

const REG_SALES = r2(PROMOS.reduce((a, p) => a + (+p.total_sales_sar || 0), 0));
const REG_DISC = r2(PROMOS.reduce((a, p) => a + (+p.total_discount_sar || 0), 0));

const srv = start(PORT, {
  finance_invoices: SEED,
  promo_codes: PROMOS,
  finance_client_links: CLIENTS.map((c, i) => ({ id: 'pzl' + i, client_group: c.group, business_id: c.biz, is_client: true, confirmed_by: 'auto-match' })),
  client_profiles: CLIENTS.map((c, i) => ({ id: 'pzp' + i, business_id: c.biz, direct_client_id: 'DP-' + i, profile_type: c.profile, payment_terms: 'Net 30', billing_cycle: 'monthly', status: 'active' }))
});
const BASE = 'http://localhost:' + PORT;

const sectorOf = (g) => (CLIENTS.find(c => c.group === g) || {}).profile === 'tender' ? 'tenders' : 'b2b';
function want(year, part, sector, dropWay) {
  return SEED.filter(r => {
    if (dropWay && r.revenue_way === dropWay) return false;
    if (year !== 'all' && String(r.year) !== String(year)) return false;
    if (part !== 'all') {
      if (/^Q[1-4]$/.test(part)) { if (r.quarter !== part) return false; }
      else if (part.indexOf('M:') === 0) { if (r.month !== part.slice(2)) return false; }
    }
    if (sector !== 'all' && sectorOf(r.client_group) !== sector) return false;
    return true;
  });
}
const sum = (rows) => r2(rows.reduce((a, r) => a + r.revenue_sar, 0));

async function main() {
  console.log('fixture: ' + SEED.length + ' invoices across all 5 revenue ways x 2 years x 4 clients (2 tender, 2 B2B)');
  console.log('registry: ' + PROMOS.length + ' promo codes, ' + REG_SALES.toLocaleString() + ' SAR of claimed sales vs ' + sum(SEED).toLocaleString() + ' SAR of real revenue');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
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
  await p.evaluate((cs) => { DB.businesses = DB.businesses || []; cs.forEach(c => DB.businesses.push({ id: c.biz, name: c.group, isClient: true, paymentTerms: 'Net 30' })); }, CLIENTS);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; FIN.promos = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length && FIN.promos)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); });

  const apply = async (year, part, sector, tab) => {
    await p.evaluate(([y, pt, s, tb]) => {
      FIN.p.year = y; FIN.p.part = pt; FIN.p.sector = s;
      if (typeof clearFinCanon === 'function') clearFinCanon();
      FIN.tab = tb || 'overview'; render();
    }, [year, part, sector, tab]);
    await p.waitForTimeout(900);
  };
  /* The money tiles carry title="<exact> SAR"; the Invoices tile is a COUNT and deliberately
     carries an empty title (js/16 renders title="" for the last card), so it has to be read
     from its own text. Reading it the money way returned null and the check looked red for a
     harness reason, not a real one. */
  const tile = (label) => p.evaluate((label) => {
    const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    const v = el && el.children[1]; if (!v) return null;
    const t = v.getAttribute('title');
    if (t) return +t.replace(/[^\d.-]/g, '');
    const n = +String(v.textContent).replace(/[^\d.-]/g, '');
    return isFinite(n) ? n : null;
  }, label);

  /* ---------- 1. the registry loads in full, and pages past the 1000-row ceiling ---------- */
  const promoCount = await p.evaluate(() => (window.FIN && FIN.promos) ? FIN.promos.length : -1);
  if (promoCount === PROMOS.length) ok('the promo registry loads in full — all ' + PROMOS.length + ' codes, so the read pages past the 1000-row ceiling');
  else if (promoCount === 1000) fail('the promo registry stops at 1000 codes — the read is not paging (' + PROMOS.length + ' exist)');
  else fail('the promo registry holds ' + promoCount + ' codes, ' + PROMOS.length + ' were seeded');

  /* ---------- 2. the registry's money never reaches the Finance page (owner ruling 2026-08-22) ---------- */
  await apply('all', 'all', 'all');
  const card = await p.evaluate(() => document.querySelectorAll('#view .v63-promo').length);
  if (card === 0) ok('no promo-code card is injected into Finance — the owner ruling of 2026-08-22 still holds');
  else fail('a promo-code card is on the Finance overview (' + card + ') — the owner ruled it off on 2026-08-22');

  /* Every figure the page shows, in every form it shows one: rendered text and the exact
     title="<n> SAR" attributes the tiles carry. */
  const pageNums = () => p.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('#view [title]').forEach(e => { const t = e.getAttribute('title'); if (/^-?[\d,.]+ SAR$/.test(t || '')) out.add(Math.round(+t.replace(/[^\d.-]/g, ''))); });
    const txt = (document.getElementById('view') || {}).innerText || '';
    (txt.match(/-?[\d][\d,]*(?:\.\d+)?/g) || []).forEach(s => { const v = +s.replace(/,/g, ''); if (isFinite(v)) out.add(Math.round(v)); });
    return [...out];
  });
  const nums = await pageNums();
  const leaked = [['registry sales', REG_SALES], ['registry discounts', REG_DISC]]
    .filter(([, v]) => nums.includes(Math.round(v)));
  if (!leaked.length) ok('neither the registry\'s ' + REG_SALES.toLocaleString() + ' SAR of claimed sales nor its ' + REG_DISC.toLocaleString() + ' SAR of discounts appears anywhere on the Finance page');
  else fail('the registry\'s money leaked onto the Finance page: ' + leaked.map(([k, v]) => k + ' = ' + v).join(', '));

  /* positive control for the check above: it CAN find a number that is on the page */
  const realRev = sum(want('all', 'all', 'all'));
  if (nums.includes(Math.round(realRev))) ok('control: the same scan finds the real revenue total (' + realRev.toLocaleString() + ') on the page, so a leak would have been visible to it');
  else fail('control failed: the scan cannot even find the real revenue total ' + realRev + ' — the leak check above proves nothing');

  /* ---------- 3. promo-code revenue is counted exactly once, everywhere ---------- */
  const revAll = await tile('Revenue');
  if (revAll != null && Math.abs(revAll - realRev) < 0.02) ok('Revenue counts every way once: tile ' + revAll.toLocaleString() + ' equals an independent recount of all ' + SEED.length + ' rows');
  else fail('Revenue tile ' + revAll + ', independent recount ' + realRev);

  const invTile = await tile('Invoices');
  const wantInv = new Set(SEED.map(r => r.invoice_no)).size;
  if (invTile === wantInv) ok('the Invoices tile counts ' + wantInv + ' distinct references — promo and b2c rows carry their own identity, none collapse together');
  else fail('the Invoices tile shows ' + invTile + ', there are ' + wantInv + ' distinct references');

  /* the anti-rubber-stamp control: if promo rows were silently DROPPED, check 5 would still
     pass against a recount that also dropped them. So prove the two differ. */
  const withoutPromo = sum(want('all', 'all', 'all', 'promo_code'));
  if (Math.abs(revAll - withoutPromo) > 0.02) ok('control: a recount that drops the promo-code rows gives ' + withoutPromo.toLocaleString() + ', not the tile\'s ' + revAll.toLocaleString() + ' — the promo money is genuinely being counted, not merely matching a recount that also lost it');
  else fail('control failed: dropping the promo rows changes nothing, so the tile may not be counting them at all');

  const ledgerRows = await p.evaluate(() => new Promise(res => {
    finGo('ledger');
    setTimeout(() => res((window.finLive ? finLive() : []).filter(window.finInPeriod).length), 900);
  }));
  if (ledgerRows === SEED.length) ok('the ledger lists all ' + SEED.length + ' rows — no revenue way is filtered out of it');
  else fail('the ledger sees ' + ledgerRows + ' rows, the fixture has ' + SEED.length);

  const csvRows = await p.evaluate(() => new Promise(res => {
    let captured = null;
    const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
    try { window.finLedgerCSV(); } catch (e) { }
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2;
    if (!captured) return res(null);
    captured.text().then(t => res(t.replace(/^﻿/, '').replace(/\r/g, '').trim().split('\n').length - 1));
  }));
  if (csvRows === SEED.length) ok('the invoice export carries all ' + SEED.length + ' rows — every revenue way reaches the file');
  else fail('the export holds ' + csvRows + ' rows, the fixture has ' + SEED.length);

  /* ---------- 4. a hostile registry cannot disturb one figure ---------- */
  if (!errors.length) ok('a registry holding a zero code, a negative total, two codes named DUPE, null totals and a code named like markup raised no page error and moved no figure');
  else fail('the hostile registry produced page errors: ' + errors.slice(0, 3).join(' | '));

  /* ---------- 5. promo rows obey year, month and sector like any other row ---------- */
  const COMBOS = [[2026, 'all', 'all'], [2026, 'all', 'tenders'], [2026, 'M:July', 'all'], [2025, 'M:September', 'b2b'], [2026, 'Q3', 'tenders']];
  let bad = 0;
  for (const [y, pt, s] of COMBOS) {
    await apply(y, pt, s);
    const w = want(y, pt, s), t = await tile('Revenue');
    const promoIn = w.filter(r => r.revenue_way === 'promo_code').length;
    if (t != null && Math.abs(t - sum(w)) < 0.02) ok(`${y} · ${pt} · ${s}: ${w.length} rows (${promoIn} promo-code) — the tile matches the independent recount`);
    else { bad++; fail(`${y} · ${pt} · ${s}: tile ${t}, recount ${sum(w)} over ${w.length} rows`); }
  }
  if (!bad) ok('promo-code rows scope by year, month, quarter and sector exactly like an invoice-way row');

  /* ---------- 6. the revenue-way editor offers every way the database accepts ---------- */
  await apply('all', 'all', 'all', 'ledger');
  const wayOf = async (way) => {
    await p.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
    await p.evaluate((w) => { const r = (FIN.rows || []).find(x => x.revenue_way === w); if (r) window.finRow(r.id); }, way);
    await p.waitForTimeout(700);
    return p.evaluate(() => { const s = document.getElementById('fin_way'); return s ? { value: s.value, options: [...s.options].map(o => o.value) } : null; });
  };
  const promoSel = await wayOf('promo_code');
  if (promoSel && promoSel.value === 'promo_code') ok('control: opening a promo-code invoice shows "Promo code totals" selected — the editor reflects a way it knows');
  else fail('control failed: a promo-code invoice opens showing ' + (promoSel ? promoSel.value : 'no selector') + ' — the check below cannot be trusted');

  const b2cSel = await wayOf('b2c_manual');
  if (b2cSel && b2cSel.value === 'b2c_manual') ok('opening a b2c_manual invoice shows its real stored way — one Save cannot silently rewrite it');
  else fail('a b2c_manual invoice opens showing "' + (b2cSel ? b2cSel.value : 'no selector') + '" — the stored way is not on the list, so the editor displays the wrong one and a Save overwrites it');

  const unkSel = await wayOf(UNKNOWN_WAY);
  if (unkSel && unkSel.value === UNKNOWN_WAY) ok(`an invoice carrying "${UNKNOWN_WAY}" — a way this editor has never heard of — opens showing its own stored value, so the next way the database gains cannot be silently rewritten before this file is updated`);
  else fail(`an invoice storing "${UNKNOWN_WAY}" opens showing "${unkSel ? unkSel.value : 'no selector'}" — the unknown-way fallback is not holding, and one Save would overwrite the stored way`);

  const offered = (b2cSel && b2cSel.options) || [];
  const missing = DB_WAYS.filter(w => !offered.includes(w));
  if (!missing.length) ok('the editor offers all ' + DB_WAYS.length + ' revenue ways the database CHECK constraint accepts');
  else fail('the database accepts ' + DB_WAYS.length + ' revenue ways, the editor offers ' + offered.length + ' — missing: ' + missing.join(', '));
  await p.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });

  console.log('\n' + (failures ? '✗ ' + failures + ' failed' : '✓ all checks passed'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
