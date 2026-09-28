/* probe-d24-income-by-service.mjs (2026-09-28) — D24, Finance → Overview → "Income by service" and the three lists on
   Finance → Rules that decide it (js/25 part 1, js/120, js/16 FIN.svcBy; scripts/sql/d24-income-by-service.sql).
   Made-up invoices only (rule 7). What it holds:
     1. each LINE goes to one service — the item's own service (Chauffeur Service → Transportation) over its product's; a
        wallet line under a "not income" service never counts; a top-up and an unpaid invoice are not in the table;
     2. the table adds up to Revenue on the tiles (an invoice with no lines sits in "Not split by line");
     3. cost: the approved cost of an invoice is under its service; the flagged estimate (⚑, D23) is its own column;
     4. no service is a "commission service" and no row is "Wallet top-up" (punch list B6, B7); no "Gross billed" column;
     5. Rules shows the three lists; removing the Chauffeur item (the app's box, Cancel first, D19) moves its 500 to the
        product's service in place — the invoices are not reloaded (punch list A);
     6. the same in Arabic; no JS error, no native dialog.
   Sabotage: make js/25 read the invoice's service_type again (byServiceType always) → 1–4 go red.
   PORTS 9752 … 9753. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

const T = '2026-03-01T00:00:00Z';
const svc = (id, name, sort, inc) => ({ id, name, sort_order: sort, counts_as_income: inc, created_by_name: 'QA', created_at: T, removed_at: null });
const SERVICES = [svc('s-fl', 'Flights', 10, true), svc('s-tr', 'Transportation', 30, true), svc('s-js', 'Journey Solutions', 70, true), svc('s-no', 'Not income (never counted)', 900, false)];
const PRODUCTS = [['p1', 'Direct Flights', 's-fl'], ['p2', 'Journey Solutions', 's-js'], ['p3', 'Direct Wallet', 's-no']].map(([id, product, service_id]) => ({ id, product, service_id, created_by_name: 'QA', created_at: T, removed_at: null }));
const ITEMS = [{ id: 'i1', item: 'Chauffeur Service', service_id: 's-tr', created_by_name: 'QA', created_at: T, removed_at: null }];
const CLASSES = [{ id: 'c1', name: 'Flight Booking', class: 'pass_through', created_at: T, removed_at: null }, { id: 'c2', name: '3rd Party Fee', class: 'pass_through', created_at: T, removed_at: null }];
const inv = (id, no, date, rev, o) => Object.assign({ id, invoice_no: no, client_group: 'QA Svc Co', customer_raw_name: 'QA Svc Co', invoice_date: date, paid_at: date, total_incl_vat_sar: rev, wallet_portion_sar: 0,
  revenue_sar: rev, cost_sar: null, profit_sar: null, amount_received_sar: rev, amount_remaining_sar: 0, integrity_status: 'verified_paid', payments_status: 'Fully Paid', row_kind: 'sale',
  revenue_way: 'invoice', deleted_at: null, source_batch: 'qa-d24', source: 'import' }, o || {});
const INVOICES = [
  inv('d24-a', 'QA-D24-A', '2026-03-05', 1000),
  inv('d24-b', 'QA-D24-B', '2026-03-06', 500, { cost_sar: 450, profit_sar: 50 }),
  inv('d24-c', 'QA-D24-C', '2026-03-07', 600, { total_incl_vat_sar: 800, wallet_portion_sar: 200 }),
  inv('d24-d', 'QA-D24-D', '2026-03-08', 300),
  inv('d24-e', 'QA-D24-E', '2026-03-09', 0, { total_incl_vat_sar: 5000, row_kind: 'wallet_topup' }),
  inv('d24-f', 'QA-D24-F', '2026-03-10', 700, { integrity_status: 'pending', payments_status: 'Pending Payment', amount_received_sar: 0, amount_remaining_sar: 700 })];
let lid = 0; const ln = (no, product, name, amt) => ({ id: ++lid, invoice_no: no, line_no: lid, kind: 'item', product, name, item_total_sar: amt });
const LINES = [ln('QA-D24-A', 'Direct Flights', 'Flight Booking - Flight Booking', 900), ln('QA-D24-A', 'Direct Flights', 'Flight Booking - Service Fees', 100),
  ln('QA-D24-B', 'Journey Solutions', 'Chauffeur Service - 3rd Party Fee', 400), ln('QA-D24-B', 'Journey Solutions', 'Chauffeur Service - Service Fee', 100),
  ln('QA-D24-C', 'Direct Flights', 'Flight Booking - Flight Booking', 600), ln('QA-D24-C', 'Direct Wallet', 'Wallet Balance', 200),
  ln('QA-D24-E', 'Direct Wallet', 'Wallet Balance', 5000), ln('QA-D24-F', 'Direct Flights', 'Flight Booking - Flight Booking', 700)];

async function session(PORT, lang) {
  process.env.MOCK_ROLE = 'admin';
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT);
  const srv = start(PORT, { finance_invoices: JSON.parse(JSON.stringify(INVOICES)), finance_invoice_lines: JSON.parse(JSON.stringify(LINES)), money_services: JSON.parse(JSON.stringify(SERVICES)),
    money_product_services: JSON.parse(JSON.stringify(PRODUCTS)), money_item_services: JSON.parse(JSON.stringify(ITEMS)), money_item_classes: JSON.parse(JSON.stringify(CLASSES)) });
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errors = [], natives = [], reads = { inv: 0 };
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    if (rq.method() === 'GET' && /\/rest\/v1\/finance_invoices$/.test(u.pathname)) reads.inv++;
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && window.FIN && FIN.rows && FIN.m && FIN.svcBy && !FIN.loading, null, { timeout: 150000 });
  await p.evaluate(() => { current = 'finance'; FIN.p = { year: '2026', part: 'all', sector: 'all' }; finGo('overview'); }); await p.waitForTimeout(1200);
  return { p, b, srv, errors, natives, reads };
}
const table = (p) => p.evaluate(() => { const t = document.querySelector('[data-v24-svc]'); if (!t) return null;
  const rows = {}; t.querySelectorAll('[data-v24-row]').forEach((r) => { rows[r.getAttribute('data-v24-row')] = { rev: +r.getAttribute('data-rev'), cost: +r.getAttribute('data-cost'), est: +r.getAttribute('data-est') }; });
  const tot = t.querySelector('[data-v24-total]'); return { rows, total: tot ? +tot.getAttribute('data-rev') : null, text: t.closest('.card').innerText,
    tileRev: (() => { let x = 0; FIN.rows.forEach((r) => { const m = FIN.m[r.id] || {}; if (m.counts && finInPeriod(r)) x += +r.revenue_sar || 0; }); return x; })() }; });

(async () => {
  console.log('\nEnglish');
  let s = await session(9752, 'en');
  const t1 = await table(s.p);
  check(!!t1 && t1.rows.Flights && t1.rows.Flights.rev === 1600 && t1.rows.Transportation && t1.rows.Transportation.rev === 500 && !t1.rows['Journey Solutions'] && !Object.keys(t1.rows).some((k) => /wallet|not income/i.test(k)),
    '1. each line goes to one service: the item\'s own over its product\'s; the wallet line, the top-up and the unpaid invoice are not in it', JSON.stringify(t1 && t1.rows));
  check(!!t1 && t1.total === 2400 && t1.tileRev === 2400 && t1.rows['Not split by line'] && t1.rows['Not split by line'].rev === 300,
    '2. the table adds up to Revenue on the tiles (2,400), the invoice with no lines under "Not split by line"', JSON.stringify({ total: t1 && t1.total, tile: t1 && t1.tileRev }));
  check(!!t1 && Math.round(t1.rows.Transportation.cost) === 450 && t1.rows.Flights.est === 1500 && t1.rows.Flights.cost === 0,
    '3. the approved cost sits under its service; the flagged estimate (⚑) is its own column', JSON.stringify(t1 && t1.rows));
  check(!!t1 && !/commission service|Gross billed|Wallet top-up/i.test(t1.text) && /Income by service/.test(t1.text) && !/Income by service line/.test(t1.text),
    '4. no "commission service", no "Wallet top-up" row and no "Gross billed" column', t1 && t1.text.slice(0, 300));

  await s.p.evaluate(() => { finGo('rules'); }); await s.p.waitForTimeout(1500);
  const rl = await s.p.evaluate(() => { const c = document.querySelector('.v120-svc'); return c ? { text: c.innerText, svc: c.querySelectorAll('[data-v120-svc]').length, map: c.querySelectorAll('[data-v120-map]').length } : null; });
  check(!!rl && rl.svc === 4 && rl.map === 4 && /Main services/.test(rl.text) && /Payments products/.test(rl.text) && /Items → service/.test(rl.text), '5. Rules shows the three lists', JSON.stringify(rl && { svc: rl.svc, map: rl.map }));
  await s.p.evaluate(() => { window.__d24Rows = FIN.rows; }); const inv0 = s.reads.inv;
  await s.p.evaluate(() => { v120Remove('money_item_services', 'i1', 'Chauffeur Service'); });
  await s.p.waitForTimeout(300);
  const box = await s.p.evaluate(() => { const b = document.getElementById('pfConfirmBox'); return b ? { text: b.innerText, focus: document.activeElement && document.activeElement.id } : null; });
  await s.p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); });
  await s.p.waitForFunction(() => !FIN._mrBusy, null, { timeout: 20000 }).catch(() => {}); await s.p.waitForTimeout(1500);
  await s.p.evaluate(() => { finGo('overview'); }); await s.p.waitForTimeout(1200);
  const t2 = await table(s.p); const same = await s.p.evaluate(() => window.__d24Rows === FIN.rows);
  check(!!box && /Chauffeur Service/.test(box.text) && box.focus === 'pfConfirmNo' && !!t2 && t2.rows['Journey Solutions'] && t2.rows['Journey Solutions'].rev === 500 && !t2.rows.Transportation && same && s.reads.inv === inv0,
    '5. removing the item (app box, named, Cancel first) moves its 500 to the product\'s service — in place, invoices not reloaded', JSON.stringify({ box: box && box.focus, rows: t2 && t2.rows, same, invReads: s.reads.inv - inv0 }));
  check(!s.errors.length && !s.natives.length, '6. no JS error, no native dialog', JSON.stringify({ errors: s.errors, natives: s.natives }));
  await s.b.close(); try { s.srv.close(); } catch (_) { }

  console.log('\nArabic');
  s = await session(9753, 'ar');
  const ta = await table(s.p);
  check(!!ta && /الدخل حسب الخدمة/.test(ta.text) && ta.total === 2400 && ta.rows['غير موزّعة على البنود'] && ta.rows['غير موزّعة على البنود'].rev === 300, '6. the same table in Arabic', ta && ta.text.slice(0, 200));
  check(!s.errors.length && !s.natives.length, '6. no JS error, no native dialog (AR)', JSON.stringify({ errors: s.errors, natives: s.natives }));
  await s.b.close(); try { s.srv.close(); } catch (_) { }
  console.log(failures ? '\nFAILED — ' + failures + ' check(s)' : '\nPASS — D24: Income by service adds up each line under one service, decided by lists on Rules');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
