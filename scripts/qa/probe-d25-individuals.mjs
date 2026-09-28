/* probe-d25-individuals.mjs (2026-09-28) — F22 / D25: "Individual (not a company)" in Finance → Rules → Needs a decision
   (js/117), and the individuals' imported invoices on Finance → Individual bookings (js/58). Made-up names only (rule 7).
     1. an unlinked customer name waits in Needs a decision with an "Individual (not a company)" button;
     2. pressing it asks in the app's box, naming the customer; yes → the name leaves Needs a decision;
     3. Individual bookings lists that customer's imported invoice (read-only), and Revenue does not move (it still counts);
     4. taking the name back (×, the app's box) returns it to Needs a decision;
     5. no JS error, no native dialog.
   Sabotage: skip the filter in js/117 (loose list) → 2 goes red; drop the imported card in js/58 → 3 goes red.
   PORT 9762. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const inv = (id, no, cust, rev) => ({ id, invoice_no: no, client_group: cust, customer_raw_name: cust, invoice_date: '2026-03-05', paid_at: '2026-03-05', total_incl_vat_sar: rev, wallet_portion_sar: 0,
  revenue_sar: rev, cost_sar: null, profit_sar: null, amount_received_sar: rev, amount_remaining_sar: 0, integrity_status: 'verified_paid', payments_status: 'Fully Paid', row_kind: 'sale',
  revenue_way: 'invoice', deleted_at: null, source_batch: 'qa-d25', source: 'import', service_type: 'Flights' });
const INVOICES = [inv('d25-a', 'QA-D25-A', 'Qa Person Samplename', 1234), inv('d25-b', 'QA-D25-B', 'QA Company Ltd', 5000)];

async function session(PORT, lang) {
  process.env.MOCK_ROLE = 'admin';
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT);
  const srv = start(PORT, { finance_invoices: JSON.parse(JSON.stringify(INVOICES)) });
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
  await p.waitForFunction(() => window.__roleKnown === true && window.FIN && FIN.rows && FIN.m && !FIN.loading, null, { timeout: 150000 });
  await p.evaluate(() => { current = 'finance'; FIN.p = { year: '2026', part: 'all', sector: 'all' }; finGo('overview'); }); await p.waitForTimeout(1200);
  return { p, b, srv, errors, natives, reads };
}

const revenue = (p) => p.evaluate(() => { let x = 0; FIN.rows.forEach((r) => { const m = FIN.m[r.id] || {}; if (m.counts) x += +r.revenue_sar || 0; }); return x; });
const looseNames = (p) => p.evaluate(() => [...document.querySelectorAll('[data-v117-loose]')].map((r) => r.getAttribute('data-v117-loose')));
(async () => {
  const s = await session(9762, 'en');
  await s.p.evaluate(() => { finGo('rules'); }); await s.p.waitForTimeout(1800);
  const l0 = await looseNames(s.p); const rev0 = await revenue(s.p);
  const hasBtn = await s.p.evaluate(() => !!document.querySelector('[data-v117-loose="Qa Person Samplename"] [data-v117-decide="individual"]'));
  check(l0.includes('Qa Person Samplename') && hasBtn, '1. the unlinked name waits in Needs a decision with an "Individual (not a company)" button', JSON.stringify({ l0, hasBtn }));
  await s.p.evaluate(() => document.querySelector('[data-v117-loose="Qa Person Samplename"] [data-v117-decide="individual"]').click()); await s.p.waitForTimeout(300);
  const box = await s.p.evaluate(() => { const b = document.getElementById('pfConfirmBox'); return b ? b.innerText : null; });
  await s.p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); });
  await s.p.waitForTimeout(2500);
  const l1 = await looseNames(s.p);
  check(!!box && /Qa Person Samplename/.test(box) && !l1.includes('Qa Person Samplename') && l1.includes('QA Company Ltd'), '2. it asks in the app\'s box, naming the customer; yes → the name leaves Needs a decision', JSON.stringify({ box: box && box.slice(0, 80), l1 }));
  await s.p.evaluate(() => { finGo('b2c'); }); await s.p.waitForTimeout(1500);
  const card = await s.p.evaluate(() => { const c = document.querySelector('[data-b2c-imported]'); return c ? { n: +c.getAttribute('data-b2c-imported'), t: c.innerText } : null; });
  const rev1 = await revenue(s.p);
  check(!!card && card.n === 1 && /QA-D25-A/.test(card.t) && !/QA-D25-B/.test(card.t) && rev1 === rev0, '3. Individual bookings lists the individual\'s imported invoice; Revenue does not move', JSON.stringify({ card: card && { n: card.n }, rev0, rev1 }));
  await s.p.evaluate(() => { const a = document.querySelector('[data-b2c-ind="Qa Person Samplename"] a'); if (a) a.click(); }); await s.p.waitForTimeout(300);
  await s.p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await s.p.waitForTimeout(2500);
  await s.p.evaluate(() => { finGo('rules'); }); await s.p.waitForTimeout(1800);
  const l2 = await looseNames(s.p);
  check(l2.includes('Qa Person Samplename'), '4. taking the name back returns it to Needs a decision', JSON.stringify(l2));
  check(!s.errors.length && !s.natives.length, '5. no JS error, no native dialog', JSON.stringify({ errors: s.errors, natives: s.natives }));
  await s.b.close(); try { s.srv.close(); } catch (_) { }
  console.log(failures ? '\nFAILED — ' + failures + ' check(s)' : '\nPASS — D25: a customer marked Individual leaves Needs a decision and shows on Individual bookings');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
