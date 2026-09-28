/* probe-import-receipts-and-reasons.mjs (2026-09-28) — the oversight's import findings of 28 Sep, through the real importer
   (js/41 + js/65) into the stand-in. Made-up companies and numbers only (rule 7). What it holds:
     1. F21 — payment_receipt rows of the invoice export are counted in the preview and, after the commit, kept in
        payment_receipts (method, amount allocated, the reference at the method, who paid, the date) and shown read-only on
        Finance → Payment proofs; the same file twice keeps them once;
     2. defect (a) — a credit note (Payments says "Fully Paid") is on its own line, never under "Not paid yet";
     3. defect (b) — "Excluded by rule" counts only rows that are NOT written, and names each one's reason (a Techtic
        verification invoice here); a receipt is never revenue;
     4. no JS error, no native dialog.
   Sabotage: stop js/65 saving the receipts (v65SaveReceipts returns early) → 1 goes red; put the rule-flagged rows back
   into the excluded count → nothing here (no rule is loaded); drop the credit-note branch → 2 goes red.
   PORT 9761. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const HDR = ['Type', 'Invoice Reference #', 'Invoice Number', 'Customer Name', 'Customer Email', 'Invoice Create Date', 'Invoice Generate Date',
  'Last Payment Date', 'Invoice Status', 'Last Status At', 'Invoice Total', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Sale Branch', 'Salesman',
  'Payment Method', 'Allocation', 'Ref # At Payment Method', 'Payment By', 'Notes'];
const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const pad = (r) => { while (r.length < HDR.length) r.push(''); return r; };
function inv(ref, o) {
  const rows = [pad([o.type || 'invoice', ref, o.dpin || '', o.cust, '', o.created, '', o.paid || '', o.status, o.created + ' 10:00:00 AM', o.total, '', '', '', '', '', 'Riyadh', 'QA Seller'])];
  (o.items || []).forEach((it) => rows.push(pad(['item', ref, '', '', '', '', '', '', '', '', '', it.product || 'Direct Flights', it.name, 'No', 0, it.total, '', ''])));
  (o.receipts || []).forEach((p) => rows.push(pad(['payment_receipt', ref, '', '', '', '', '', '', '', p.at + ' 11:00:00 AM', '', '', '', '', '', '', '', '', p.method, p.amount, p.refAt, p.by, p.notes || ''])));
  return rows;
}
const csv = (rows) => [HDR].concat(rows).map((r) => r.map(q).join(',')).join('\n');
const FILE = csv([].concat(
  inv('QA-RC-A', { cust: 'QA Receipt Co', created: '10/03/2026 09:00:00 AM', paid: '12/03/2026', status: 'Fully Paid', total: 1000, items: [{ name: 'Flight Booking - Flight Booking', total: 1000 }],
    receipts: [{ at: '12/03/2026', method: 'Bank Transfer', amount: 600, refAt: 'BT-QA-1', by: 'QA Payer' }, { at: '13/03/2026', method: 'QA Receipt Co Credit', amount: 400, refAt: 'CR-QA-2', by: 'QA Payer' }] }),
  inv('QA-RC-CN', { type: 'credit_note', cust: 'QA Receipt Co', created: '14/03/2026 09:00:00 AM', paid: '14/03/2026', status: 'Fully Paid', total: 50 }),
  inv('QA-RC-TT', { cust: 'QA Verify Co', created: '15/03/2026 09:00:00 AM', paid: '15/03/2026', status: 'Fully Paid', total: 700, items: [{ product: 'Techtic Support', name: 'Verification - Service', total: 700 }] })));

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
const rows = async (s) => (await fetch(s.BASE + '/rest/v1/finance_invoices?select=*').then((r) => r.json())).filter((r) => /^QA-RC-/.test(r.invoice_no)).sort((a, b) => a.invoice_no.localeCompare(b.invoice_no));
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

(async () => {
  console.log('\nThe invoice export with payment receipts, a credit note and a Techtic invoice');
  const s = await session(9761, 'en');
  const pv = await ingest(s, 'qa-receipts.csv', FILE, false);
  const pvReceipts = (pv.text.match(/Payment receipts in the file: (\d+)/) || [])[1] ? +(pv.text.match(/Payment receipts in the file: (\d+)/))[1] : null;
  check(/Credit notes[^\n]*1/.test(pv.d1) && !/Not paid yet[^\n]*Fully Paid/.test(pv.d1), '2. the credit note is on its own line, not under "Not paid yet"', pv.d1.replace(/\n/g, ' | '));
  check(/Excluded by rule 1\b/.test(pv.text) && /QA-RC-TT/.test(pv.text) && /verification service/i.test(pv.text), '3. "Excluded by rule" counts the one row not written and names its reason', (pv.text.match(/Excluded by rule[^\n]*/) || [''])[0]);
  const mine = (list) => list.filter((x) => (x.allocations || []).some((a) => /^QA-RC-/.test(a.invoice_no || '')));
  const rc = mine(await fetch(s.BASE + '/rest/v1/payment_receipts?select=*').then((r) => r.json()));
  check(pvReceipts === 2 && rc.length === 2 && rc.some((x) => +x.amount_sar === 600 && x.payment_method === 'Bank Transfer' && x.allocations[0].invoice_no === 'QA-RC-A' && x.allocations[0].ref_at_method === 'BT-QA-1'),
    '1. the two receipts are counted in the preview and kept after the commit (method, amount, reference, invoice)', JSON.stringify({ pvReceipts, rc: rc.map((x) => [x.payment_method, x.amount_sar]) }));
  await ingest(s, 'qa-receipts-again.csv', FILE, false);
  const rc2 = mine(await fetch(s.BASE + '/rest/v1/payment_receipts?select=*').then((r) => r.json()));
  check(rc2.length === 2, '1. the same file twice keeps each receipt once', 'receipts: ' + rc2.length);
  const rows = await fetch(s.BASE + '/rest/v1/finance_invoices?select=invoice_no,revenue_sar').then((r) => r.json());
  check(!rows.some((r) => r.invoice_no === 'QA-RC-TT') && (rows.find((r) => r.invoice_no === 'QA-RC-A') || {}).revenue_sar === 1000, '3. the Techtic invoice is not written; the receipts leave revenue as the invoice total', JSON.stringify(rows));
  await s.p.evaluate(() => { current = 'finance'; FIN.tab = 'proofs'; render(); }); await s.p.waitForTimeout(1500);
  const card = await s.p.evaluate(() => { const c = document.querySelector('[data-proof-receipts]'); return c ? { n: [...c.querySelectorAll('tbody tr')].filter((tr) => /QA-RC-/.test(tr.innerText)).length, text: c.textContent } : null; });
  check(!!card && card.n === 2 && /Bank Transfer/.test(card.text) && /BT-QA-1/.test(card.text) && /read-only/i.test(card.text), '1. Payment proofs shows them read-only', JSON.stringify(card && { n: card.n, bt: /Bank Transfer/.test(card.text), ref: /BT-QA-1/.test(card.text), ro: /read-only/i.test(card.text) }));
  check(!s.errors.length && !s.natives.length, '4. no JS error, no native dialog', JSON.stringify({ errors: s.errors, natives: s.natives }));
  await done(s);
  console.log(failures ? '\nFAILED — ' + failures + ' check(s)' : '\nPASS — receipts kept and shown; credit notes and exclusions said plainly');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
