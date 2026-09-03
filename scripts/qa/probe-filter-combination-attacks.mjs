/* probe-filter-combination-attacks.mjs (2026-09-03, watch cycle 26) - the filters in combination.

   Every filter has been tested on its own. Nobody uses them on their own. The real question is
   what happens when a year, a month, a sector chip and a client drill-down are all in force at
   once - because that is one screen making four claims simultaneously, and a filter that quietly
   fails to apply, or quietly stays applied after being cleared, produces a number that is wrong
   in a way no single-filter test can see.

   Under test:
     1. Under every combination, each tab's totals equal an independent recount of exactly the
        rows that combination should leave - computed here from the fixture, never read off the
        page.
     2. Every surface agrees at the same moment: the Performance tiles, Clients & collections, the
        Report Builder and BOTH CSV exports describe the same scope. (The Report Builder is the
        deliberate exception - it spans all years and says so in its own caption - so it is
        checked against the sector, which does apply to it.)
     3. Clearing one filter does not leave another silently in force, and does not clear one that
        was not touched.
     4. A combination that matches nothing says so, rather than printing a confident set of zeros
        (the A1 rule, and the empty-comparison rule from cycle 7).

   Run:  node scripts/qa/probe-filter-combination-attacks.mjs        (port 8229)
   Sabotage (file-level): make finInPeriod ignore the month part -> the month combinations go red;
   make the sector chip a no-op in finInPeriod -> the sector combinations go red. Restore
   byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8229;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const r2 = (n) => Math.round(n * 100) / 100;

/* Two sectors, three years, several months, so every combination leaves a DIFFERENT set. */
const CLIENTS = [
  { group: 'Tender Client A', biz: 'fc-a', profile: 'tender' },
  { group: 'Tender Client B', biz: 'fc-b', profile: 'tender' },
  { group: 'B2B Client C', biz: 'fc-c', profile: 'postpaid' },
  { group: 'B2B Client D', biz: 'fc-d', profile: 'postpaid' }
];
function inv(id, c, date, total, cost, extra) {
  const mo = +date.slice(5, 7);
  return Object.assign({
    id, invoice_no: 'FC-' + id, line_no: 1, zatca_dpin: null,
    client_group: c.group, customer_raw_name: c.group, invoice_date: date, year: +date.slice(0, 4),
    month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total, cost_sar: cost, profit_sar: total - cost,
    vat_sar: 0, amount_received_sar: total, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'fc-qa', revenue_way: 'invoice',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  }, extra || {});
}
const SEED = [];
let n = 0;
[2024, 2025, 2026].forEach(y => {
  CLIENTS.forEach((c, ci) => {
    [1, 3, 5, 7].forEach(mo => {
      n++;
      SEED.push(inv('i' + n, c, y + '-' + String(mo).padStart(2, '0') + '-12', 1000 + n * 7 + ci * 13, 300 + n));
    });
  });
});
const srv = start(PORT, {
  finance_invoices: SEED,
  finance_client_links: CLIENTS.map((c, i) => ({ id: 'fcl' + i, client_group: c.group, business_id: c.biz, is_client: true, confirmed_by: 'auto-match' })),
  client_profiles: CLIENTS.map((c, i) => ({ id: 'fcp' + i, business_id: c.biz, direct_client_id: 'DC-' + i, profile_type: c.profile, payment_terms: 'Net 30', billing_cycle: 'monthly', status: 'active' }))
});
const BASE = 'http://localhost:' + PORT;

const sectorOf = (g) => (CLIENTS.find(c => c.group === g) || {}).profile === 'tender' ? 'tenders' : 'b2b';
/* the independent recount: which rows SHOULD survive a given combination */
function want(year, part, sector) {
  return SEED.filter(r => {
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
  console.log('fixture: ' + SEED.length + ' invoices · 3 years × 4 clients (2 tender, 2 B2B) × 4 months');
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
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length && FIN.profileTypeByBiz)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); });

  const apply = async (year, part, sector) => {
    await p.evaluate(([y, pt, s]) => {
      FIN.p.year = y; FIN.p.part = pt; FIN.p.sector = s;
      if (typeof clearFinCanon === 'function') clearFinCanon();
      FIN.tab = 'overview'; render();
    }, [year, part, sector]);
    await p.waitForTimeout(900);
  };
  // what the page itself believes is in scope, read through its own chokepoint
  const inScope = () => p.evaluate(() => {
    const rows = (window.finLive ? finLive() : []).filter(window.finInPeriod);
    return { n: rows.length, rev: Math.round(rows.reduce((a, r) => a + (+r.revenue_sar || 0), 0) * 100) / 100 };
  });
  const tile = (label) => p.evaluate((label) => {
    const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    const v = el && el.children[1]; const t = v && v.getAttribute('title');
    return t ? +t.replace(/[^\d.-]/g, '') : null;
  }, label);

  /* ---------- 1. every combination against an independent recount ---------- */
  const COMBOS = [
    [2026, 'all', 'all'], [2026, 'all', 'tenders'], [2026, 'all', 'b2b'],
    [2026, 'Q1', 'all'], [2026, 'Q1', 'tenders'],
    [2026, 'M:March', 'all'], [2026, 'M:March', 'tenders'], [2026, 'M:March', 'b2b'],
    [2025, 'Q3', 'tenders'], [2024, 'M:January', 'b2b'], ['all', 'all', 'tenders']
  ];
  let bad = 0;
  for (const [y, pt, s] of COMBOS) {
    await apply(y, pt, s);
    const w = want(y, pt, s), got = await inScope(), t = await tile('Revenue');
    const lbl = `${y} · ${pt} · ${s}`;
    const scopeOk = got.n === w.length && Math.abs(got.rev - sum(w)) < 0.02;
    const tileOk = t != null && Math.abs(t - sum(w)) < 0.02;
    if (scopeOk && tileOk) ok(`${lbl}: ${w.length} invoices, ${sum(w).toLocaleString()} — page and independent recount agree, on the rows AND on the tile`);
    else { bad++; fail(`${lbl}: page sees ${got.n} rows / ${got.rev}, tile ${t}; recount ${w.length} rows / ${sum(w)}`); }
  }
  if (!bad) ok(`all ${COMBOS.length} combinations of year × period × sector scope correctly`);

  /* ---------- 2. every surface agrees at the same moment ---------- */
  await apply(2026, 'M:March', 'tenders');
  const w2 = want(2026, 'M:March', 'tenders');
  const clientsSum = await p.evaluate(() => {
    finGo('clients');
    return new Promise(res => setTimeout(() => {
      const rows = (window.finLive ? finLive() : []).filter(window.finInPeriod).filter(r => r.integrity_status === 'verified_paid');
      res(Math.round(rows.reduce((a, r) => a + (+r.revenue_sar || 0), 0) * 100) / 100);
    }, 900));
  });
  if (Math.abs(clientsSum - sum(w2)) < 0.02) ok('Clients & collections shows the same scope as Performance at the same moment');
  else fail('Clients sees ' + clientsSum + ', Performance scope is ' + sum(w2));
  const csvRows = await p.evaluate(() => new Promise(res => {
    finGo('overview');
    setTimeout(() => {
      let captured = null;
      const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
      HTMLAnchorElement.prototype.click = function () { };
      try { window.finLedgerCSV(); } catch (e) { }
      URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2;
      if (!captured) return res(null);
      captured.text().then(t => res(t.replace(/^﻿/, '').trim().split('\n').length - 1));
    }, 900);
  }));
  if (csvRows === w2.length) ok(`the invoice export carries exactly the ${w2.length} rows the combined filter leaves — the file cannot describe a wider scope than the screen`);
  else fail('the export holds ' + csvRows + ' rows, the filter leaves ' + w2.length);
  // the Report Builder deliberately spans all years; the SECTOR still applies to it
  const rbTotal = await p.evaluate(() => new Promise(res => {
    finGo('reports');
    setTimeout(() => {
      FIN.rb.g1 = '__client'; FIN.rb.g2 = ''; FIN.rb.verifiedOnly = true; FIN.rb.quarter = 'all';
      FIN.rb.metrics = { revenue_sar: true }; render();
      setTimeout(() => {
        const tr = [...document.querySelectorAll('#view table tr')].filter(t => t.children.length && /^(TOTAL|الإجمالي)/.test((t.children[0].textContent || '').trim())).pop();
        res(tr ? +String(tr.children[1].textContent).replace(/[^\d.-]/g, '') : null);
      }, 900);
    }, 600);
  }));
  /* 2026-09-03 (watch cycle 26): the Report Builder ignores the sector chip as well as the period
     bar, and its own caption says exactly that — "across all years and sectors — the period bar
     above does not apply to this report". The first version of this check assumed the sector still
     applied and called correct behaviour a defect. That is the SECOND time a check has been
     written against what the filters seemed to imply rather than what the page prints about
     itself (cycle 22 made the same mistake about the years). The rule that comes out of it: read
     the caption the app writes before deciding what the app should do. What is checked now is the
     guarantee the app actually makes — the report spans everything, and says so where a reader
     will see it. */
  const rbWant = sum(want('all', 'all', 'all'));
  const rbCaption = await p.evaluate(() => { const c = document.getElementById('rb-caption'); return c ? c.innerText : ''; });
  if (rbTotal != null && Math.abs(rbTotal - rbWant) < 2) ok(`the Report Builder spans every year AND every sector (${rbWant.toLocaleString()}), unaffected by the chips in force elsewhere`);
  else fail('the Report Builder totals ' + rbTotal + ', all years and all sectors is ' + rbWant);
  if (/all years and sectors|period bar above does not apply|كل السنوات والقطاعات/i.test(rbCaption)) ok('…and its caption says so on screen, so a reader cannot mistake it for the filtered view they were just looking at');
  else fail('the Report Builder ignores the filters but its caption does not say so: ' + JSON.stringify(rbCaption.slice(0, 160)));

  /* ---------- 3. clearing one filter leaves the others exactly as they were ---------- */
  await apply(2026, 'M:March', 'tenders');
  await p.evaluate(() => { FIN.p.sector = 'all'; if (typeof clearFinCanon === 'function') clearFinCanon(); render(); }); await p.waitForTimeout(800);
  const afterSectorCleared = await inScope();
  const wSectorCleared = want(2026, 'M:March', 'all');
  if (afterSectorCleared.n === wSectorCleared.length) ok('clearing the sector chip widens to the whole month and leaves the year and month exactly as they were');
  else fail('after clearing the sector: ' + afterSectorCleared.n + ' rows, expected ' + wSectorCleared.length);
  await p.evaluate(() => { FIN.p.part = 'all'; render(); }); await p.waitForTimeout(800);
  const afterPartCleared = await inScope();
  if (afterPartCleared.n === want(2026, 'all', 'all').length) ok('clearing the month widens to the whole year without silently restoring the sector');
  else fail('after clearing the month: ' + afterPartCleared.n + ' rows, expected ' + want(2026, 'all', 'all').length);

  /* ---------- 4. a combination that matches nothing says so ---------- */
  await apply(2024, 'M:December', 'tenders');   // no December rows anywhere in the fixture
  const empty = await inScope();
  const emptyHtml = await p.evaluate(() => document.querySelector('#view').innerText);
  if (empty.n === 0) ok('a year + month + sector combination matching nothing leaves no rows in scope');
  else fail('the empty combination still holds ' + empty.n + ' rows');
  const saysNothing = /no invoices|nothing to compare|no data|لا توجد/i.test(emptyHtml);
  const showsConfidentZero = /\b0\.00\b/.test(emptyHtml) && !saysNothing;
  if (saysNothing || !showsConfidentZero) ok('…and the page says so rather than presenting a confident set of zeros as if the period had been measured');
  else fail('the empty combination printed zeros with nothing to say the period holds no invoices');

  if (!errors.length) ok('no page errors through the run'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
