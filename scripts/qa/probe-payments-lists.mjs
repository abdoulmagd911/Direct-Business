/* probe-payments-lists.mjs (2026-09-28) — D28, the Direct Payments client list and promo codes exports through js/122 (on
   js/121's reader) into the stand-in, which mirrors fn_payments_clients_import / fn_promo_codes_import
   (scripts/sql/clients-promo-import.sql). Made-up IDs (90…), companies, emails and amounts only (rule 7); the header rows
   are the real 27 Sep ones, as the oversight gave them on 28 Sep.

   What it holds:
     1. both lists, with the REAL 27 Sep header rows, are RECOGNISED and every column matched (none reported missing), never js/65's
        "not recognized"; an invoice export dropped with them still goes to js/65;
     2. the preview: 5 clients new; codes: 1 new, 1 changed, 1 new code whose type cannot be read left out; 1 Client Name
        kept as a suggestion;
     3. Import: the client register holds every column; NOT ONE invoice row is written (matching a row to a company is a
        live view over the company identifiers, never a stamp — the owner, 28 Sep); the known code (another case) takes
        Payments' figures while its company link and notes stay; the new fixed-amount, expired code is created; the
        unreadable one is not;
     4. the same files twice: "Nothing new", no Import button;
     5. an OLDER client list only fills blanks (the name stays, the missing phone is filled); a newer one with a blank never wipes;
     6. the block reads Arabic;
     7. a View-only person has no Import card, and the database refuses both imports;
     8. no JS error, no native dialog.
   Sabotage (SABOTAGE=A|B|C|D|E swaps in a broken layer; each run 28 Sep, each caught):
     A  js/122 reads the Legal Name from the Trading Name column   → 3, 5 red (the register holds the wrong name)
     B  js/122 sends "now" instead of the file's export time       → 5 red (the older file's name wins)
     C  js/122 never plugs into js/121                            → 1–6 red (the files are "not recognized")
     D  js/122 guesses "percent" for a type it cannot read         → 2, 3 red (the unreadable code is created)
     E  js/122 names one column differently from the real export  → 1, 3 red (reported missing; the contact name is not stored)
   PORTS 9871 … 9873. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const XLSXLIB = fs.readFileSync('/tmp/node_modules/xlsx/dist/xlsx.full.min.js', 'utf8');
const XLSX = (await import('/tmp/node_modules/xlsx/xlsx.mjs'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SAB = process.env.SABOTAGE || '';
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

/* ---------- the made-up world ---------- */
const money = (no, o) => Object.assign({ id: 'qa-pl-' + no, invoice_no: no, line_no: 1, client_group: 'QA List Co', invoice_date: '2026-07-10',
  total_incl_vat_sar: 1000, revenue_sar: 1000, cost_sar: null, profit_sar: null, integrity_status: 'verified_paid', row_kind: 'sale', revenue_way: 'invoice',
  source: 'import', payments_status: 'Fully Paid', deleted_at: null, payments_client_id: null }, o || {});
const I = { A: '9900000201', B: '9900000202', HAND: '9900000203', LINKED: '9900000204', STAFF: '9900000205', SHARED: '9900000206', RULED: '9900000207' };
const SEED_INV = [money(I.A, { customer_email: 'buyer@one.test' }), money(I.B, { customer_email: ' BUYER@One.test ' }),
  money(I.HAND, { customer_email: 'buyer@one.test', source: 'manual' }), money(I.LINKED, { customer_email: 'buyer@one.test', payments_client_id: '9999' }),
  money(I.STAFF, { customer_email: 'person@directksa.com' }), money(I.SHARED, { customer_email: 'shared@two.test' }),
  money(I.RULED, { customer_email: 'test@qa-client.test', total_incl_vat_sar: 500, revenue_sar: 500 })];
const SEED_RULES = [{ id: 'qa-rule-1', kind: 'client_id', value: '9005', value_norm: null, reason: 'QA test client', active: true, created_by: 'mock-user-qa',
  created_by_name: 'QA seed', created_at: '2026-09-01T00:00:00Z', removed_at: null }];
const SEED_CODES = [{ id: 'qa-code-1', code: 'QASIX', kind: 'percent', value_pct: 5, valid_from: null, valid_to: null, total_sales_sar: 0, total_discount_sar: 0,
  active: true, expired: false, partner_business_id: 'qa-partner-biz', notes: 'kept note', payments_seen_at: null }];

/* the header rows exactly as the 27 Sep exports carry them (the oversight, 28 Sep) */
const PCH = ['ID', 'Legal Name', 'Legal Name (Arabic)', 'Trading Name', 'Customer Type', 'Client Payment Configuration', 'Payment Mode', 'Billing Cycle', 'Tender No.',
  'Registration Numbers', 'Has VAT Number', 'ID Type', 'ID Number', 'VAT Number', 'Contact Information', 'Contact Full Name', 'Contact Email', 'Contact Phone', 'Credit Limit',
  'Credit Term Days', 'Block On Overdue', 'Tender Amount', 'Expected COGS', 'Expected GP', 'Pricing Setting', 'Created By', 'Updated By', 'Created At', 'Updated At'];
const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (h, rows) => [h].concat(rows).map((r) => r.map(q).join(',')).join('\n');
const pc = (id, name, email, o) => { const v = Object.assign({ 'ID': id, 'Legal Name': name, 'Legal Name (Arabic)': 'شركة تجريبية', 'Trading Name': name + ' Trading',
  'Customer Type': 'Corporate', 'Client Payment Configuration': 'Postpaid', 'Payment Mode': 'Postpaid', 'Billing Cycle': 'Monthly', 'Tender No.': '',
  'Registration Numbers': '1010000000', 'Has VAT Number': 'Yes', 'ID Type': 'CR', 'ID Number': '1010000000', 'VAT Number': '300000000000003',
  'Contact Information': '', 'Contact Full Name': 'QA Contact', 'Contact Email': email, 'Contact Phone': '', 'Credit Limit': '50,000.00', 'Credit Term Days': 30,
  'Block On Overdue': 'No', 'Tender Amount': '', 'Expected COGS': '', 'Expected GP': '', 'Pricing Setting': 'Standard', 'Created By': 'QA Admin', 'Updated By': 'QA Admin',
  'Created At': '01/01/2026 09:00:00 AM', 'Updated At': '20/09/2026 10:00:00 AM' }, o || {}); return PCH.map((h) => v[h]); };
const PC1 = [pc('9001', 'QA One Co', 'Buyer@One.test'), pc('9002', 'QA Staff Test', 'person@directksa.com'), pc('9003', 'QA Two A', 'shared@two.test'),
  pc('9004', 'QA Two B', 'SHARED@two.test'), pc('9005', 'QA Test Client', 'test@qa-client.test')];
const FILE_PC1 = { name: '2026-09-27_10-00-00-corporate-clients-QA.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(PCH, PC1)) };
const PC0 = [pc('9001', 'QA One Co (old name)', 'buyer@one.test', { 'Contact Phone': '+966500000001' })];
const FILE_PC0 = { name: '2026-09-20_10-00-00-corporate-clients-QA.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(PCH, PC0)) };   // OLDER
const PC2 = [pc('9001', 'QA One Co', 'buyer@one.test', { 'Credit Limit': '', 'Credit Term Days': 45 })];
const FILE_PC2 = { name: '2026-09-28_10-00-00-corporate-clients-QA.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(PCH, PC2)) };   // NEWER, blank credit limit

const PRH = ['Code', 'Promocode Type', 'Client Name', 'Type', 'Discount', 'Product', 'Status', 'Total Sales', 'Total Discount', 'Valid From', 'Valid To', 'Created At', 'Created By'];
const xlsxBuf = (h, rows) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h].concat(rows)), 'Sheet1'); return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }); };
const FILE_PR = { name: '2026-09-27_10-05-00-promo-codes-QA.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: xlsxBuf(PRH, [['qasix', 'Corporate', 'QA Partner', 'Percentage', '12%', 'Direct Flights', 'Active', '15,000.50 SAR', '1,800.00 SAR', '01/01/2026', '31/12/2026', '01/01/2026 09:00:00 AM', 'QA Admin'],
    ['QANEW', 'General', '', 'Fixed', 100, 'Direct Hotels', 'Expired', 900, 0, '01/01/2026', '30/06/2026', '01/01/2026 09:00:00 AM', 'QA Admin'],
    ['QAODD', 'General', '', 'Mystery', 3, '', 'Active', 0, 0, '', '', '', '']]) };
const INVH = ['Type', 'Invoice Reference #', 'Invoice Number', 'Customer Name', 'Customer Email', 'Invoice Create Date', 'Invoice Generate Date', 'Last Payment Date', 'Invoice Status',
  'Last Status At', 'Invoice Total', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Sale Branch', 'Salesman'];
const FILE_INV = { name: 'QA-invoice-export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(INVH, [['invoice', '9900000900', '', 'QA Paper Co', '', '10/03/2026 09:00:00 AM', '', '12/03/2026', 'Fully Paid', '12/03/2026 10:00:00 AM', 1000, '', '', '', '', '', 'Riyadh', 'QA']])) };

/* ---------- a session on the stand-in ---------- */
async function session(PORT, lang, pageAccess) {
  process.env.MOCK_ROLE = pageAccess ? 'team_member' : 'admin'; if (pageAccess) process.env.MOCK_PAGE_ACCESS = JSON.stringify(pageAccess); else delete process.env.MOCK_PAGE_ACCESS;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT);
  const srv = start(PORT, { finance_invoices: SEED_INV.map((x) => Object.assign({}, x)), money_exclusion_rules: SEED_RULES.map((x) => Object.assign({}, x)),
    promo_codes: SEED_CODES.map((x) => Object.assign({}, x)), payments_clients: [] });
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } }); const p = await ctx.newPage();
  const errors = [], natives = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang || 'en');
  await ctx.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await ctx.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: /xlsx/.test(r.request().url()) ? XLSXLIB : LIB }));
  await ctx.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  const swap = (file, fn) => ctx.route((u) => u.pathname === '/js/' + file, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fn(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8')) }));
  if (SAB === 'A') await swap('122-payments-lists.js', (s) => s.replace("legal_name:'Legal Name',", "legal_name:'Trading Name',"));
  if (SAB === 'B') await swap('122-payments-lists.js', (s) => s.replace('p_seen_at:j.F.asOf,', 'p_seen_at:new Date().toISOString(),'));
  if (SAB === 'C') await swap('122-payments-lists.js', (s) => s.replace('window.v121Register({ match:', '({ match:'));
  if (SAB === 'E') await swap('122-payments-lists.js', (s) => s.replace("contact_name:'Contact Full Name'", "contact_name:'Contact Name'"));
  if (SAB === 'D') await swap('122-payments-lists.js', (s) => s.replace("if(!t&&/%\\s*$/.test(String(disc||''))) return 'percent'; return null; }", "return 'percent'; }"));
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  const ready = await p.waitForFunction(() => window.__roleKnown === true && window.FIN && FIN.rows && typeof window.v121Route === 'function' && !!window.v122, null, { timeout: 150000 }).then(() => true).catch(() => false);
  if (!ready) { failures++; console.log('NOT READY', JSON.stringify(await p.evaluate(() => ({ role: window.__roleKnown, fin: !!(window.FIN && FIN.rows), v121: typeof window.v121Route, v122: !!window.v122, url: location.pathname }))), errors.slice(0, 3)); }
  await p.evaluate(() => { current = 'finance'; finGo('import'); }); await p.waitForTimeout(900);
  return { p, b, srv, errors, natives };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };
const drop = async (s, files) => { await s.p.evaluate(() => { if (window.v122Clear) v122Clear(); if (window.v121Clear) v121Clear(); }); await s.p.setInputFiles('#finFile', files); };
const phase = (s, want, ms) => s.p.waitForFunction((w) => { const e = document.querySelector('#v122Out [data-v122-phase]'); return e && w.includes(e.getAttribute('data-v122-phase')); }, want, { timeout: ms || 30000 }).then(() => true).catch(() => false);
const attr = (s, sel, a) => s.p.evaluate(([qq, n]) => { const e = document.querySelector(qq); return e ? e.getAttribute(n) : null; }, [sel, a]);
const importNow = async (s) => { if (!(await s.p.$('#v122Out [data-v122-go]'))) return false; await s.p.click('#v122Out [data-v122-go]', { timeout: 15000 }); return phase(s, ['done', 'error'], 30000); };
const invIds = (s) => s.p.evaluate(async () => { const r = await fc().from('finance_invoices').select('invoice_no,payments_client_id').is('deleted_at', null); const o = {}; (r.data || []).forEach((x) => { o[x.invoice_no] = x.payments_client_id || '∅'; }); return o; });
const codes = (s) => s.p.evaluate(async () => { const r = await fc().from('promo_codes').select('*'); return r.data || []; });
const clientRow = (s, id) => s.p.evaluate(async (k) => { const r = await fc().from('payments_clients').select('*').eq('client_id', k); return (r.data || [])[0] || null; }, id);

/* ================= 1–5, 8: one admin session ================= */
{
  console.log('— the client list and the promo codes, an admin, English —');
  const s = await session(9871, 'en');
  await drop(s, [FILE_PC1, FILE_PR, FILE_INV]);
  const okP = await phase(s, ['preview', 'error']);
  const kinds = await s.p.evaluate(() => [...document.querySelectorAll('#v122Out [data-v122-kind]')].map((e) => e.getAttribute('data-v122-kind')).sort().join(','));
  await s.p.waitForFunction(() => /Invoice Export|not recogni[sz]ed/i.test((document.getElementById('finImpOut') || {}).innerText || ''), null, { timeout: 60000 }).catch(() => {});   // js/65 reads its file at its own pace
  const js65 = await s.p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
  const missing = await s.p.evaluate(() => [...document.querySelectorAll('#v122Out [data-v122-missing]')].map((e) => e.innerText).join(' | '));
  check(okP && kinds === 'pc,pr' && !missing && !/not recogni[sz]ed/i.test(js65) && /Invoice Export/.test(js65),
    '1. both lists, with the real 27 Sep header rows, are read by js/122 with every column matched (none reported missing); an invoice export dropped with them still goes to js/65', JSON.stringify({ okP, kinds, missing, js65: js65.slice(0, 140) }));
  const P = { clients: await attr(s, '#v122Out [data-v122-clients]', 'data-v122-clients'), link: await attr(s, '#v122Out [data-v122-link]', 'data-v122-link'),
    codes: await attr(s, '#v122Out [data-v122-codes]', 'data-v122-codes'), suggest: await attr(s, '#v122Out [data-v122-suggest]', 'data-v122-suggest') };
  check(P.clients === '5,0,0' && P.link === null && P.codes === '1,1,0,1' && P.suggest === '1',
    '2. the preview: 5 clients new, no invoice-link line; codes 1 new, 1 changed, 1 unreadable type left out; 1 suggestion', JSON.stringify(P));
  const before = await invIds(s);
  const ok1 = await importNow(s); await s.p.waitForTimeout(600);
  const ids = await invIds(s);
  const cs = await codes(s), six = cs.find((c) => c.code === 'QASIX') || {}, nw = cs.find((c) => c.code === 'QANEW') || null, odd = cs.find((c) => /qaodd/i.test(c.code));
  const untouched = JSON.stringify(ids) === JSON.stringify(before) && Object.keys(ids).length === SEED_INV.length;
  const sixOk = six.kind === 'percent' && +six.value_pct === 12 && +six.total_sales_sar === 15000.5 && +six.total_discount_sar === 1800 && six.valid_to === '2026-12-31'
    && six.payments_client_name === 'QA Partner' && six.partner_business_id === 'qa-partner-biz' && six.notes === 'kept note';
  const newOk = !!nw && nw.kind === 'fixed' && +nw.value_pct === 100 && nw.active === false && nw.expired === true;
  const c1 = await clientRow(s, '9001');
  const colsOk = !!c1 && c1.legal_name === 'QA One Co' && c1.trading_name === 'QA One Co Trading' && c1.has_vat_number === 'Yes' && c1.pricing_setting === 'Standard'
    && c1.block_on_overdue === 'No' && c1.contact_name === 'QA Contact' && c1.contact_email === 'buyer@one.test'
    && Date.parse(c1.payments_updated_at) === Date.parse('2026-09-20T10:00:00+03:00') && six.payments_created_by === 'QA Admin';
  check(ok1 && untouched && sixOk && newOk && !odd && colsOk,
    '3. Import: the client register holds every column; not one invoice row is written (matching is live, never a stamp); the known code (another case) takes Payments\' figures and keeps its company link and notes; the new fixed, expired code is made; the unreadable one is not',
    JSON.stringify({ ok1, untouched, colsOk, c1: c1 && [c1.legal_name, c1.trading_name, c1.has_vat_number, c1.pricing_setting, c1.contact_email, c1.payments_updated_at], six: [six.kind, six.value_pct, six.total_sales_sar, six.valid_to, six.payments_client_name, six.partner_business_id], nw: nw && [nw.kind, nw.value_pct, nw.active, nw.expired], odd: !!odd }));

  await drop(s, [FILE_PC1, FILE_PR]); await phase(s, ['preview', 'error']);
  const nothing = await attr(s, '#v122Out [data-v122-nothing]', 'data-v122-nothing'), btn = await s.p.$('#v122Out [data-v122-go]');
  check(nothing === '1' && !btn, '4. the same files twice: "Nothing new", no Import button', JSON.stringify({ nothing, button: !!btn }));

  await drop(s, [FILE_PC0]); await phase(s, ['preview', 'error']); await importNow(s); await s.p.waitForTimeout(400);
  const c0 = await clientRow(s, '9001');
  await drop(s, [FILE_PC2]); await phase(s, ['preview', 'error']); await importNow(s); await s.p.waitForTimeout(400);
  const c2 = await clientRow(s, '9001');
  check(c0 && c0.legal_name === 'QA One Co' && c0.contact_phone === '+966500000001' && +c0.credit_limit_sar === 50000 && c2 && +c2.credit_limit_sar === 50000 && c2.credit_term_days === 45,
    '5. an OLDER client list only fills blanks (the name stays, the missing phone is filled); a newer one wins but its blank credit limit never wipes the stored one',
    JSON.stringify({ older: c0 && [c0.legal_name, c0.contact_phone, c0.credit_limit_sar], newer: c2 && [c2.credit_limit_sar, c2.credit_term_days] }));
  check(s.errors.length === 0 && s.natives.length === 0, '8a. no JS error, no native dialog', JSON.stringify({ e: s.errors.slice(0, 3), n: s.natives }));
  await done(s);
}
/* ================= 6: Arabic; 7: a View-only person ================= */
{
  console.log('— Arabic —');
  const s = await session(9872, 'ar');
  await drop(s, [FILE_PC1, FILE_PR]); await phase(s, ['preview', 'error']);
  const t = await s.p.evaluate(() => (document.getElementById('v122Out') || {}).innerText || '');
  check(/قوائم المدفوعات/.test(t) && /العملاء:/.test(t) && /الأكواد:/.test(t) && !/Clients:|Codes:|clients read|codes read|Import the lists/.test(t), '6. the block reads Arabic, with no English left in it', t.slice(0, 160));
  check(s.errors.length === 0 && s.natives.length === 0, '8b. no JS error, no native dialog (Arabic)', JSON.stringify({ e: s.errors.slice(0, 3) }));
  await done(s);
}
{
  console.log('— a View-only person —');
  const s = await session(9873, 'en', { finance: 'view', leads: 'view', clients: 'view' });
  const card = await s.p.$('#finFile');
  const r = await s.p.evaluate(async () => { const a = await fc().rpc('fn_payments_clients_import', { p_rows: [{ client_id: '9101', contact_email: 'buyer@one.test' }] });
    const b = await fc().rpc('fn_promo_codes_import', { p_rows: [{ code: 'QAVIEW', kind: 'percent', discount: 5 }] });
    return [a.error ? String(a.error.message) : 'WROTE', b.error ? String(b.error.message) : 'WROTE']; });
  const ids = await invIds(s), cs = await codes(s);
  check(!card && /Full control of Finance/.test(r[0]) && /Full control of Finance/.test(r[1]) && ids[I.A] === '∅' && !cs.some((c) => c.code === 'QAVIEW'),
    '7. a View-only person has no Import card, and the database refuses both imports (nothing written)', JSON.stringify({ card: !!card, r }));
  await done(s);
}

console.log(failures ? `\nFAILED — ${failures} check(s) did not pass.` + (SAB ? ' (sabotage ' + SAB + ')' : '') : '\npayments lists OK' + (SAB ? ' — but this was sabotage ' + SAB + ', which should have failed' : ''));
process.exit(failures ? 1 : 0);
