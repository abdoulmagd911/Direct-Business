/* probe-finance-one-estimate.mjs (2026-09-28) — QA on live #60, 12:45 UTC (made-up invoices only, rule 7). What it holds:
     1. ONE estimate on the screen: the band under the tiles, the Cost tile's note and Income by service's Est. column read
        the same figure (1,500 here) — a billing link (paid, zero revenue, the same lines as the transaction it re-bills) and
        a wallet top-up add nothing to it (live read 4.15M against 2.87M);
     2. a service whose revenue has no cost at all (Other income) says "cost missing", never a profit of 0;
     3. the Cost tile names the estimate beside the approved cost; the Profit tile says what it reads with the estimates;
     4. the monthly chart draws a Profit bar when the only cost is an estimate, and the legend says ⚑;
     5. adding an item already on the list, spelled another way, is refused in the app's box, naming it — nothing is sent;
     6. a new item saves and its dialog closes; no JS error, no native dialog.
   Sabotage (run 28 Sep): drop `!finCounts(r)||` from finEstimateBand → 1 goes red (band 2,400).
   PORT 9764. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

const T = '2026-03-01T00:00:00Z';
const svc = (id, name, sort, inc) => ({ id, name, sort_order: sort, counts_as_income: inc, created_by_name: 'QA', created_at: T, removed_at: null });
const SERVICES = [svc('s-fl', 'Flights', 10, true), svc('s-tr', 'Transportation', 30, true), svc('s-js', 'Journey Solutions', 70, true), svc('s-no', 'Not income (never counted)', 900, false), svc('s-ot', 'Other income', 80, true)];
const PRODUCTS = [['p1', 'Direct Flights', 's-fl'], ['p2', 'Journey Solutions', 's-js'], ['p3', 'Direct Wallet', 's-no'], ['p4', 'Other Income', 's-ot']].map(([id, product, service_id]) => ({ id, product, service_id, created_by_name: 'QA', created_at: T, removed_at: null }));
const ITEMS = [{ id: 'i1', item: 'Chauffeur Service', service_id: 's-tr', created_by_name: 'QA', created_at: T, removed_at: null }];
const CLASSES = [{ id: 'c1', name: 'Flight Booking', class: 'pass_through', created_at: T, removed_at: null }, { id: 'c2', name: '3rd Party Fee', class: 'pass_through', created_at: T, removed_at: null }];
const inv = (id, no, date, rev, o) => Object.assign({ id, invoice_no: no, client_group: 'QA Svc Co', customer_raw_name: 'QA Svc Co', invoice_date: date, paid_at: date, total_incl_vat_sar: rev, wallet_portion_sar: 0,
  revenue_sar: rev, cost_sar: null, profit_sar: null, amount_received_sar: rev, amount_remaining_sar: 0, integrity_status: 'verified_paid', payments_status: 'Fully Paid', row_kind: 'sale',
  revenue_way: 'invoice', deleted_at: null, source_batch: 'qa-d24', source: 'import', month: 'March', quarter: 'Q1' }, o || {});
const INVOICES = [
  inv('d24-a', 'QA-D24-A', '2026-03-05', 1000),
  inv('d24-b', 'QA-D24-B', '2026-03-06', 500, { cost_sar: 450, profit_sar: 50 }),
  inv('d24-c', 'QA-D24-C', '2026-03-07', 600, { total_incl_vat_sar: 800, wallet_portion_sar: 200 }),
  inv('d24-d', 'QA-D24-D', '2026-03-08', 300),
  inv('d24-e', 'QA-D24-E', '2026-03-09', 0, { total_incl_vat_sar: 5000, row_kind: 'wallet_topup' }),
  inv('d24-f', 'QA-D24-F', '2026-03-10', 700, { integrity_status: 'pending', payments_status: 'Pending Payment', amount_received_sar: 0, amount_remaining_sar: 700 }),
  /* a billing link: paid, zero revenue, and the SAME item lines as the transaction it re-bills (QA-D24-A) */
  inv('d24-l', 'QA-D24-L', '2026-03-20', 0, { total_incl_vat_sar: 1000, row_kind: 'billing_link', revenue_way: 'invoice' }),
  /* Other income, no cost and no pass-through */
  inv('d24-g', 'QA-D24-G', '2026-03-11', 400)];
let lid = 0; const ln = (no, product, name, amt) => ({ id: ++lid, invoice_no: no, line_no: lid, kind: 'item', product, name, item_total_sar: amt });
const LINES = [ln('QA-D24-A', 'Direct Flights', 'Flight Booking - Flight Booking', 900), ln('QA-D24-A', 'Direct Flights', 'Flight Booking - Service Fees', 100),
  ln('QA-D24-B', 'Journey Solutions', 'Chauffeur Service - 3rd Party Fee', 400), ln('QA-D24-B', 'Journey Solutions', 'Chauffeur Service - Service Fee', 100),
  ln('QA-D24-C', 'Direct Flights', 'Flight Booking - Flight Booking', 600), ln('QA-D24-C', 'Direct Wallet', 'Wallet Balance', 200),
  ln('QA-D24-E', 'Direct Wallet', 'Wallet Balance', 5000), ln('QA-D24-F', 'Direct Flights', 'Flight Booking - Flight Booking', 700),
  ln('QA-D24-L', 'Direct Flights', 'Flight Booking - Flight Booking', 900), ln('QA-D24-L', 'Direct Flights', 'Flight Booking - Service Fees', 100),
  ln('QA-D24-G', 'Other Income', 'Other Income - Misc', 400)];

async function session(PORT, lang) {
  process.env.MOCK_ROLE = 'admin';
  const { start } = await import('./mock-supabase.mjs?one-est=' + (++seq) + '-' + PORT);
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

(async () => {
  const s = await session(9764, 'en');
  const r = await s.p.evaluate(() => { const band = document.querySelector('[data-fin-estimate-band]'); const tbl = document.querySelector('[data-v24-svc]');
    let colEst = 0; if (tbl) tbl.querySelectorAll('[data-v24-row]').forEach((x) => { colEst += +x.getAttribute('data-est') || 0; });
    const tiles = [...document.querySelectorAll('.card')].filter((c) => /^(Cost|Profit)$/.test(((c.firstElementChild || {}).innerText || '').trim()));
    const note = (lbl) => { const c = tiles.find((t) => t.firstElementChild.innerText.trim() === lbl); const n = c && c.querySelector('[data-fin-tile-note]'); return n ? n.innerText : ''; };
    const other = tbl && tbl.querySelector('[data-v24-row="Other income"]');
    const chart = [...document.querySelectorAll('.card')].find((c) => /Monthly revenue & profit/.test(c.innerText));
    const prof = chart ? [...chart.querySelectorAll('[title^="Profit"]')].map((x) => parseInt(x.style.height, 10)) : []; window.__qaT = chart ? [...chart.querySelectorAll('[title]')].map((x) => x.title + "=" + x.style.height).join(" | ") : "";
    return { band: band ? +band.getAttribute('data-est') : null, colEst: Math.round(colEst * 100) / 100, costNote: note('Cost'), profNote: note('Profit'),
      other: other ? other.innerText : null, otherMissing: !!(other && other.querySelector('[data-v24-cost-missing]')), chartLegend: chart ? chart.innerText.slice(-80) : '', profBars: prof, titles: window.__qaT }; });
  check(r.band === 1500 && r.colEst === 1500 && /est\. 1,500/.test(r.costNote), '1. one estimate: the band, the table\'s Est. column and the Cost tile all read 1,500 (the billing link and the top-up add nothing)', JSON.stringify(r));
  check(r.otherMissing && !/\b0\b\s*$/.test(r.other || ''), '2. Other income (no cost at all) says "cost missing", not a profit of 0', JSON.stringify(r.other));
  check(/approved/.test(r.costNote) && /with estimates/.test(r.profNote), '3. the Cost tile names the estimate beside the approved cost; Profit says what it reads with the estimates', JSON.stringify({ c: r.costNote, p: r.profNote }));
  check(r.profBars.some((h) => h > 2) && /incl\. estimates/.test(r.chartLegend), '4. the monthly chart draws a Profit bar from the estimate, and the legend says so', JSON.stringify({ bars: r.profBars, t: r.titles }));
  /* 5 + 6: the Items list on Rules */
  await s.p.evaluate(() => { finGo('rules'); }); await s.p.waitForTimeout(1500);
  let posts = 0; s.p.on('request', (q) => { if (q.method() === 'POST' && /money_item_services/.test(q.url())) posts++; });
  const notices = []; await s.p.exposeFunction('__qaNotice', (t) => notices.push(t)); await s.p.evaluate(() => document.addEventListener('v63-notice', (e) => window.__qaNotice(e.detail.text)));
  await s.p.evaluate(() => window.v120AddItem()); await s.p.waitForSelector('#v120_key', { timeout: 10000 });
  await s.p.fill('#v120_key', 'chauffeur  service'); await s.p.click('#mSave'); await s.p.waitForTimeout(800);
  check(posts === 0 && notices.some((t) => /Chauffeur Service" is already on the list/.test(t)), '5. an item already on the list, spelled another way, is refused in the app\'s box by name — nothing is sent', JSON.stringify({ posts, notices }));
  await s.p.fill('#v120_key', 'Railway Ticket'); await s.p.click('#mSave');
  await s.p.waitForFunction(() => !document.getElementById('ov').classList.contains('show'), null, { timeout: 8000 }).catch(() => {}); await s.p.waitForTimeout(1200);
  const after = await s.p.evaluate(() => ({ open: document.getElementById('ov').classList.contains('show'), listed: /Railway Ticket/.test(document.body.innerText) }));
  check(posts === 1 && !after.open && after.listed, '6. a new item saves once, its dialog closes, and it is on the list', JSON.stringify({ posts, after }));
  check(!s.errors.length && !s.natives.length, '7. no JS error, no native dialog', JSON.stringify({ e: s.errors, n: s.natives }));
  await s.b.close(); try { s.srv.close(); } catch (_) { }
  console.log(failures ? '\nFAILED — ' + failures + ' check(s)' : '\nPASS — one estimate on every Finance figure, and the Rules lists say what they do');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
