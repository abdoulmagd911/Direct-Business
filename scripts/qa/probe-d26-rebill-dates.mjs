/* probe-d26-rebill-dates.mjs (2026-09-28) — D26: a one-to-one re-bill shows BOTH dates (oversight, 28 Sep).
   The import merges a numbered billing invoice and the unnumbered transaction it re-bills (same customer, same total) into
   one row, counted in the billing invoice's month. Made-up names and numbers only (rule 7). What it holds:
     1. one row is written for the pair, carrying the transaction's number and the transaction's own date (10 Apr) beside
        the invoice's date (22 Sep, the month it counts in);
     2. the invoice's detail window says "re-bills transaction … of 2026-04-10";
     3. the same file again writes nothing new and keeps the date (fill only);
     4. no JS error, no native dialog.
   Sabotage (run 28 Sep): drop `transaction_date:i.txDate` from js/41 toRows → checks 1 and 2 go red.
   PORT 9763. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

/* ---------- the made-up export ---------- */
const HDR = ['Type', 'Invoice Reference #', 'Invoice Number', 'Customer Name', 'Customer Email', 'Invoice Create Date', 'Invoice Generate Date',
  'Last Payment Date', 'Invoice Status', 'Last Status At', 'Invoice Total', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Sale Branch', 'Salesman'];
const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function inv(ref, o) {
  const rows = [['invoice', ref, o.dpin || '', o.cust, o.email || '', o.created, o.gen || '', o.paid || '', o.status, o.statusAt || (o.created + ' 10:00:00 AM'), o.total, '', '', '', '', '', 'Riyadh', 'QA Seller']];
  (o.items || []).forEach((it) => rows.push(['item', ref, '', '', '', '', '', '', '', '', '', it.product || 'Direct Flights', it.name, it.tax ? 'Yes' : 'No', 0, it.total, '', '']));
  return rows;
}
const csv = (rows) => [HDR].concat(rows).map((r) => r.map(q).join(',')).join('\n');
const TW = inv('QA-D26-TX', { cust: 'QA Rebill Co', created: '10/04/2026 09:00:00 AM', paid: '10/04/2026', status: 'Fully Paid', total: 777, items: [{ name: 'Flight Booking - Flight Booking', total: 777 }] });
const DP = inv('QA-D26-INV', { dpin: 'DPIN-QA-D26', cust: 'QA Rebill Co', created: '22/09/2026 09:00:00 AM', gen: '22/09/2026', paid: '22/09/2026', status: 'Fully Paid', total: 777, items: [{ name: 'Flight Booking - Flight Booking', total: 777 }] });
const FILE = csv([].concat(TW, DP));

async function session(PORT, lang) {
  process.env.MOCK_ROLE = 'admin'; process.env.MOCK_KPI_FROM_MONEY = '1';
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT); const srv = start(PORT, { finance_invoices: [] }); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errors = [], natives = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang || 'en');
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  const ready = await p.waitForFunction(() => window.__roleKnown === true && window.FIN && FIN.rows && FIN.m && typeof window.v65IngestText === 'function', null, { timeout: 150000 }).then(() => true).catch(() => false);
  if (!ready) { console.log('NOT READY', await p.evaluate(() => JSON.stringify({ role: window.__roleKnown, fin: !!window.FIN, rows: !!(window.FIN && FIN.rows), m: !!(window.FIN && FIN.m), mErr: window.FIN && FIN.mErr, loadErr: window.FIN && FIN.loadErr, ingest: typeof window.v65IngestText, cur: typeof current !== 'undefined' ? current : '?' })), errors.slice(0, 3)); throw new Error('not ready'); }
  await p.evaluate(() => { current = 'finance'; finGo('import'); }); await p.waitForTimeout(900);
  return { p, b, srv, BASE, errors, natives };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };
const rows = async (s) => (await fetch(s.BASE + '/rest/v1/finance_invoices?select=*').then((r) => r.json())).filter((r) => /^QA-D26-/.test(r.invoice_no)).sort((a, b) => a.invoice_no.localeCompare(b.invoice_no));
async function ingest(s, name, text, tickAll) {
  await s.p.evaluate(({ n, t }) => window.v65IngestText(n, t), { n: name, t: text });
  await s.p.waitForFunction(() => { const o = document.getElementById('finImpOut'); return o && /Confirm import|تأكيد الاستيراد|Nothing new|no rows/i.test(o.innerText); }, null, { timeout: 60000 }).catch(() => {});
  await s.p.waitForTimeout(600);
  const pv = await s.p.evaluate(() => { const o = document.getElementById('finImpOut'); const card = o && o.querySelector('[data-v65-billing]');
    return { text: o ? o.innerText : '', d1: o && o.querySelector('[data-v65-d1]') ? o.querySelector('[data-v65-d1]').innerText : '', proposals: card ? +card.getAttribute('data-v65-billing') : 0,
      ticked: [...document.querySelectorAll('[data-v65-bl]')].filter((x) => x.checked).length }; });
  if (tickAll) await s.p.evaluate(() => window.v65BlTickAll(true));
  const hasBtn = await s.p.evaluate(() => typeof window.v65Commit === 'function' && /Confirm import|تأكيد الاستيراد/.test((document.getElementById('finImpOut') || {}).innerText || ''));
  if (hasBtn) { await s.p.evaluate(() => window.v65Commit()); await s.p.waitForFunction(() => /Done\.|تم\.|FAILED|فشل/.test((document.getElementById('finImpOut') || {}).innerText || ''), null, { timeout: 60000 }).catch(() => {}); }
  await s.p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }).catch(() => {}); await s.p.waitForTimeout(700);
  return Object.assign(pv, { done: await s.p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || ''), committed: hasBtn });
}
const shape = (list) => list.map((r) => [r.invoice_no, r.row_kind, r.integrity_status, r.payments_status, String(r.revenue_sar), r.cost_sar == null ? '∅' : r.cost_sar, r.billed_by_ref || '', r.paid_at || '', r.audit_required ? 'A' : ''].join('|')).join('\n');

(async () => {
  const s = await session(9763, 'en');
  const pv = await ingest(s, 'invoices-d26.csv', FILE, false);
  let list = await rows(s);
  check(list.length === 1 && list[0].invoice_no === 'QA-D26-INV' && list[0].transaction_ref === 'QA-D26-TX' && list[0].transaction_date === '2026-04-10' && String(list[0].invoice_date).slice(0, 10) === '2026-09-22',
    '1. the pair is one row: the invoice\'s date (the month it counts in) and the re-billed transaction\'s own date', JSON.stringify(list.map((r) => [r.invoice_no, r.transaction_ref, r.transaction_date, r.invoice_date])) + ' · ' + pv.done.slice(0, 200));
  const det = await s.p.evaluate(() => { try { const r = FIN.rows.find((x) => x.invoice_no === 'QA-D26-INV'); if (!r) return 'no row'; finRow(r.id); } catch (e) { return 'ERR ' + e.message; }
    return ''; });
  await s.p.waitForTimeout(700);
  const txt = await s.p.evaluate(() => document.body.innerText);
  check(/re-bills transaction QA-D26-TX of 2026-04-10/.test(txt), '2. the invoice\'s window says which transaction it re-bills, and that transaction\'s date', det || (txt.match(/Date[^\n]*/) || [''])[0]);
  await s.p.evaluate(() => { const o = document.querySelector('.modal-ov,[data-fin-inv-ov]'); if (o) o.remove(); current = 'finance'; finGo('import'); }); await s.p.waitForTimeout(700);
  await ingest(s, 'invoices-d26-again.csv', FILE, false);
  list = await rows(s);
  check(list.length === 1 && list[0].transaction_date === '2026-04-10', '3. the same file again: still one row, the date kept', JSON.stringify(list.map((r) => [r.invoice_no, r.transaction_date])));
  check(!s.errors.length && !s.natives.length, '4. no JS error, no native dialog', JSON.stringify({ e: s.errors, n: s.natives }));
  await done(s);
  console.log(failures ? '\nFAILED — ' + failures + ' check(s)' : '\nPASS — a merged re-bill shows both dates');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
