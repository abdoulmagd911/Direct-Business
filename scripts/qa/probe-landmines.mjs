/* Landmine probe — adversarial scenarios: bad files, hostile names, undo paths,
   double-clicks, Excel-mangled CSVs, Arabic digits, two tabs on one record.

   2026-09-19 (fire #102) — the import half (L7-L12) was rewritten. It used to call `finParse()`,
   which reached js/16's legacy ledger-CSV importer. That importer is not something a person can
   reach any more: js/65's router owns the drop zone, the file input and the button. Worse, it was
   a path that should not exist — with js/41's stand-down disabled, dropping the app's OWN Finance
   ledger export back in was refused on the first drop and offered as "Confirm import of 3 rows" on
   the second, which would have fed the app's derived revenue, cost and profit back in as though
   Direct Payments had said them. These checks now hand each file to the input the way the picker
   does, so the router answers, and L10 guards that exact hazard instead of the retired importer's
   soft warning. L9 moved its Arabic-Indic amount into a Direct Payments export and reads the
   stored figure back from the database, because in the ledger format the file is refused outright
   and the money would never have been read at all. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8919, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
let nextDialog = null, nextDialogAction = 'accept';
page.on('dialog', async d => {
  const act = nextDialogAction; nextDialogAction = 'accept';
  if (act === 'dismiss') return d.dismiss();
  if (nextDialog !== null) { const v = nextDialog; nextDialog = null; if (d.type() === 'prompt') await d.accept(v); else await d.accept(); }
  else await d.accept();
});
const route = async r => {
  const u = r.request().url();
  if (u.includes('cdn.jsdelivr.net')) {
    if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  }
  const url = new URL(u);
  const resp = await fetch(BASE + url.pathname + url.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
};
await page.route(u=>u.href.includes('cdn.jsdelivr.net'), route);
await page.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), route);
const LOG = [];
let shotN = 0;
const STEP = (name, ok, detail = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ' — ' + detail : ''}`); };
const SHOT = async (name) => { shotN++; await page.screenshot({ path: `shots/lm${String(shotN).padStart(2, '0')}-${name}.png` }); };
const nav = async (re) => { await page.locator('#nav button').filter({ hasText: re }).first().click(); await page.waitForTimeout(1100); };
const login = async (p) => {
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.locator('input[type="email"]').first().fill('test@directksa.com');
  await p.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
  await p.locator('button[type="submit"], button:has-text("Sign in")').first().click();
  await p.waitForTimeout(4000);
};
await login(page);

// ===== L1 · Hostile company name: apostrophe + HTML =====
await nav(/^(Leads|العملاء المحتملون)$/);
await page.locator('#view button', { hasText: '+ New business' }).first().click();
await page.waitForTimeout(600);
await page.fill('#f_name', `O'Brien & Sons <b>travel</b>`);
await page.fill('#f_seg', 'Hostile-name test');
await page.locator('#mSave').click();
await page.waitForTimeout(900);
const hostile = await page.evaluate(() => {
  const b = DB.businesses.find(x => x.name.includes("O'Brien"));
  const html = document.getElementById('view').innerHTML;
  return { created: !!b, injected: /<b>travel<\/b>/.test(html), shown: (document.getElementById('view').textContent || '').includes("O'Brien & Sons") };
});
STEP('L1 hostile name: created, shown as text, no HTML injection', hostile.created && hostile.shown && !hostile.injected, JSON.stringify(hostile));
await page.fill('#lq', "O'Brien");
await page.waitForTimeout(700);
STEP('L1 search survives an apostrophe', await page.evaluate(() => (document.getElementById('view').textContent || '').includes("O'Brien")));
await page.fill('#lq', '');
await page.waitForTimeout(500);

// ===== L2 · Win through the FULL edit form (the path that used to half-convert) =====
const hid = await page.evaluate(() => DB.businesses.find(x => x.name.includes("O'Brien")).id);
await page.evaluate(id => { openLead = id; render(); }, hid);
await page.waitForTimeout(900);
await page.evaluate(id => editBusiness(id), hid);
await page.waitForTimeout(700);
await page.evaluate(() => { document.getElementById('f_stage').value = 'Won'; });
await page.locator('#mSave').click();
await page.waitForTimeout(1200);
const fullWin = await page.evaluate(id => { const b = getLead(id); return { client: b.isClient === true, stage: b.stage, handover: !!document.getElementById('c_did') }; }, hid);
STEP('L2 full-edit Won: converts for real AND opens the handover (was half-converting)', fullWin.client && fullWin.stage === 'Won' && fullWin.handover, JSON.stringify(fullWin));
await SHOT('fulledit-won-handover');
// Cancel the handover — must stay a client, strip must offer Add later
await page.locator('.modal button, #modal button').filter({ hasText: /Cancel|إلغاء/ }).first().click().catch(() => {});
await page.waitForTimeout(800);
const afterCancel = await page.evaluate(id => { const b = getLead(id); return { client: b.isClient, did: b.directClientId || '' }; }, hid);
STEP('L3 handover Cancel: stays a client, Direct ID simply empty (add later)', afterCancel.client === true && afterCancel.did === '', JSON.stringify(afterCancel));

// ===== L4 · Un-Won: change a client back — confirm moves it back to leads =====
await page.evaluate(id => { current = 'clients'; openLead = null; render(); }, hid);
await page.waitForTimeout(700);
// 2026-09-09 (D1 family): the question asks in the page (js/57's box) — answer it there, never a native dialog
await page.evaluate(id => leadQuickEdit(id), hid);
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Contacted'; });
await page.locator('#mSave').click();
await page.waitForTimeout(500);
const askedL4 = await page.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), formOpen: document.getElementById('ov').classList.contains('show') }));
STEP('L4 un-Won asks in the page, form still open', askedL4.box && askedL4.formOpen, JSON.stringify(askedL4));
await page.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); });
await page.waitForTimeout(1000);
const unwon = await page.evaluate(id => { const b = getLead(id); return { client: b.isClient, stage: b.stage, logged: (b.activities || []).some(a => /back from clients|أُعيدت/.test(a.note || '')) }; }, hid);
STEP('L4 un-Won + OK: back to the pipeline, with an activity note', unwon.client === false && unwon.stage === 'Contacted' && unwon.logged, JSON.stringify(unwon));
// Win again via quick edit, then un-Won but CANCEL the confirm — must stay a client
await page.evaluate(id => leadQuickEdit(id), hid);
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Won'; });
await page.locator('#mSave').click();
await page.waitForTimeout(1100);
await page.locator('.modal button, #modal button').filter({ hasText: /Cancel|إلغاء/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
await page.evaluate(id => leadQuickEdit(id), hid);
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Qualified'; });
await page.locator('#mSave').click();
await page.waitForTimeout(500);
await page.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); });
await page.waitForTimeout(400);
// Cancel saves nothing: still a client, still Won, the form is still open for a different answer (was: stage change kept — the old half-save)
const unwon2 = await page.evaluate(id => { const b = getLead(id); return { client: b.isClient, stage: b.stage, formOpen: document.getElementById('ov').classList.contains('show') }; }, hid);
STEP('L5 un-Won + Cancel: stays a client, nothing saved, form still open', unwon2.client === true && unwon2.stage === 'Won' && unwon2.formOpen, JSON.stringify(unwon2));
await page.evaluate(() => { try { closeModal(); } catch (_) { } });
await page.waitForTimeout(300);
// bring it to Qualified for L5b's baseline: move it back to the pipeline, this time with Yes
await page.evaluate(id => leadQuickEdit(id), hid);
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Qualified'; });
await page.locator('#mSave').click();
await page.waitForTimeout(500);
await page.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); });
await page.waitForTimeout(900);
// L5b an out-of-list stage (empty select) must never be persisted
await page.evaluate(id => leadQuickEdit(id), hid);
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'NOT-A-STAGE'; });
await page.locator('#mSave').click();
await page.waitForTimeout(900);
const emptyStage = await page.evaluate(id => getLead(id).stage, hid);
STEP('L5b invalid/empty stage in the dropdown: previous stage kept, never blank', emptyStage === 'Qualified', 'stage=' + JSON.stringify(emptyStage));

// ===== L6-L11 · Import abuse =====
await nav(/^(Finance|المالية)$/);
await page.waitForTimeout(1400);
await page.locator('#view button, #view .btn').filter({ hasText: /Import|استيراد/ }).first().click();
await page.waitForTimeout(800);
/* 2026-09-19 (fire #102): these used to call finParse() directly, which reached js/16's legacy
   ledger-CSV importer. That importer is no longer something a person can reach — js/65's router
   owns the drop zone, the file input and the button — and reaching it by calling the function was
   measuring a path nobody has. Worse, it was measuring a path that should not exist: with js/41's
   stand-down disabled, dropping the app's OWN Finance-ledger export back in was refused on the
   first drop and offered as "Confirm import of 3 rows" on the second, which would put the app's
   derived revenue/cost/profit back in as though they were figures from Direct Payments.
   These now hand the file to the input the way the file picker does, so the router answers, and
   they wait for its reply rather than a fixed 900ms. */
const ingest = async (name, content) => {
  fs.writeFileSync('shots/' + name, content);
  await page.evaluate(() => { const b = document.getElementById('finImpOut'); if (b) b.innerHTML = ''; });
  await page.setInputFiles('#finFile', 'shots/' + name);
  await page.waitForFunction(() => /Files dropped|Ready to import|Header does not match/.test(
    (document.getElementById('finImpOut') || {}).textContent || ''), { timeout: 30000 }).catch(() => { });
  await page.waitForTimeout(1200);
  return await page.evaluate(() => ({
    text: (document.getElementById('finImpOut').textContent || '').replace(/\s+/g, ' '),
    confirm: !![].slice.call(document.querySelectorAll('#finImpOut button')).find(x => /Confirm import|تأكيد الاستيراد/.test(x.textContent || '')),
  }));
};
const tryFile = async (name, content) => (await ingest(name, content)).text;
/* one Direct Payments export, built the way the real one is shaped: an invoice row and its item
   row per invoice. This is the format the router imports, so the checks below that need a file it
   WILL take use this rather than the retired ledger format. */
const DPHEAD = ['Type', 'Invoice Reference #', 'Invoice Number', 'Invoice Create Date', 'Invoice Status',
  'Customer Name', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Invoice Total', 'Sale Branch', 'Salesman'];
const dpCsv = (invoices) => {
  const q = (r) => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',');
  const out = [q(DPHEAD)];
  invoices.forEach(({ no, cust, date, total }) => {
    out.push(q(['invoice', no, no, date, 'Paid', cust, 'Direct Flights', '', '', '', '', total, 'QA Branch', 'QA Seller']));
    out.push(q(['item', no, '', '', '', cust, 'Direct Flights', 'Service fee', 'Yes', '0', total, total, 'QA Branch', 'QA Seller']));
  });
  return out.join('\r\n');
};
const HDRB = 'client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes';
// L6 binary junk pretending to be a CSV
let out = await tryFile('junk.csv', '%PDF-1.4\x00\x01\x02 binary junk not a csv \xff\xfe');
STEP('L6 binary junk .csv: clear header error, no crash', /Header does not match/.test(out), out.slice(0, 90));
// L7 header-only
let res = await ingest('empty.csv', HDRB);
STEP('L7 header-only file: nothing offered for import, no confirm button, no crash',
  !res.confirm && /not recognized|Ready to import: 0|New 0/.test(res.text), res.text.slice(0, 120));
// L8 Excel-mangled: semicolons and uppercase
out = await tryFile('semi.csv', HDRB.replace(/,/g, ';') + '\nA;B');
const semiOK = /Header does not match|not recognized/.test(out);
out = await tryFile('upper.csv', HDRB.toUpperCase() + '\na,b');
STEP('L8 semicolon + UPPERCASE headers: both rejected, and the app says the header did not match',
  semiOK && /Header does not match|not recognized/.test(out), out.slice(0, 120));
/* L9 Arabic-Indic digits in an amount. The old fixture put them in a ledger-format file, which is
   now refused outright, so the money would never have been read at all and the check could not
   fail for the reason it names. It goes in a Direct Payments export instead, is imported for real,
   and the stored figure is read back from the database — 23,000, never a silent 0. */
res = await ingest('ardigits.csv', dpCsv([{ no: 'QA-AR01', cust: 'Arabic Digits Co', date: '05/08/2026', total: '٢٣٠٠٠' }]));
await page.evaluate(() => { if (typeof v65Commit === 'function') v65Commit(); });
await page.waitForTimeout(3500);
const arStored = await page.evaluate(async () => {
  const r = await fetch('http://127.0.0.1:8919/rest/v1/finance_invoices?invoice_no=eq.QA-AR01').then(x => x.json());
  return Array.isArray(r) && r.length ? Number(r[0].total_incl_vat_sar) : null;
});
STEP('L9 an amount written in Arabic-Indic digits is read as the number it is, never a silent zero',
  arStored === 23000, 'stored=' + JSON.stringify(arStored));
/* L10 replaces the old unknown-proposal-ref warning, which belonged to the retired importer. This
   is the hazard that retirement closed: the app's OWN ledger export, dropped back in. Before
   2026-09-19 it was refused the first time and offered as "Confirm import" the second, which would
   have fed the app's derived revenue, cost and profit back in as if Direct Payments had said them.
   It must be refused EVERY time, with no confirm button either time. */
const ledgerExport = HDRB + '\r\n' + [0, 1, 2].map(i =>
  `Ledger Co,August,Q3,QA-LED-${i},,Ledger Co,2026-08-05,Flight ticket,${1000 + i},0,${1000 + i},${800 + i},200,verified_paid,`).join('\r\n');
const led1 = await ingest('ledger-export.csv', ledgerExport);
const led2 = await ingest('ledger-export-again.csv', ledgerExport);
STEP('L10 the app\'s own ledger export, dropped back in, is refused BOTH times and never offers a confirm button',
  !led1.confirm && !led2.confirm && /report|not recognized/i.test(led1.text) && /report|not recognized/i.test(led2.text),
  JSON.stringify({ first: led1.confirm, second: led2.confirm }));
await SHOT('import-warnings');
// L11 1,000-invoice file: parses fast, single confirm, double-click cannot double-import
const bulk = []; for (let i = 0; i < 1000; i++) bulk.push({ no: 'QA-BULK-' + i, cust: 'Bulk Co ' + (i % 7), date: '0' + ((i % 8) + 1) + '/08/2026', total: String(1000 + i) });
const t0 = Date.now();
res = await ingest('big.csv', dpCsv(bulk));
const parseMs = Date.now() - t0;
STEP('L11 a 1000-invoice export parses and previews fast', /New 1000|1000 new/.test(res.text) && parseMs < 60000, parseMs + 'ms · ' + res.text.slice(0, 120));
/* What actually protects a person here is that the Confirm button is REPLACED by "Done. Imported
   N new…" the moment the import succeeds — driven 2026-09-19: after one commit there is no button
   left to click, so the double-submit this check is named for cannot be performed by hand at all.
   Calling the commit function three times in one tick is not something a person can do; it is kept
   because it drives the invariant underneath — the database's UNIQUE (invoice_no, line_no), which
   fn_commit_finance_import meets with a plain INSERT inside one transaction, so a clash lands
   nothing. (Until 2026-09-19 the seed mock pushed every row regardless and this "proved" 3000 rows
   the real database cannot hold; it now answers 23505 the way Postgres does.) */
const confirmGone = await page.evaluate(async () => {
  v65Commit(); await new Promise(r => setTimeout(r, 5000));
  const btn = [].slice.call(document.querySelectorAll('#finImpOut button')).find(x => /Confirm import|تأكيد الاستيراد/.test(x.textContent || ''));
  return { gone: !btn, said: (document.getElementById('finImpOut').textContent || '').replace(/\s+/g, ' ').slice(0, 80) };
});
STEP('L11b once the import succeeds the Confirm button is gone, so it cannot be pressed twice by hand',
  confirmGone.gone && /Done|تم/.test(confirmGone.said), JSON.stringify(confirmGone));
await page.evaluate(() => { v65Commit(); v65Commit(); }); // and the invariant underneath it
await page.waitForTimeout(6000);
const bulkCount = await page.evaluate(async () => {
  // page through the API (it caps at 1000 rows per request, like real PostgREST)
  let all = [], from = 0;
  while (true) { const r = await fetch('http://127.0.0.1:8919/rest/v1/finance_invoices', { headers: { Range: from + '-' + (from + 999) } }).then(x => x.json()); all = all.concat(r); if (r.length < 1000) break; from += 1000; }
  return all.filter(x => String(x.invoice_no || '').startsWith('QA-BULK-')).length;
});
STEP('L12 committing the same batch again cannot duplicate it: exactly 1000 rows, not 2000/3000', bulkCount === 1000, 'rows=' + bulkCount);

// ===== L13 · Two tabs, same company, both save — what really happens =====
const page2 = await ctx.newPage();
await page2.route(u=>u.href.includes('cdn.jsdelivr.net'), route);
await page2.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), route);
await page2.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(3500);
const tid = await page.evaluate(() => DB.businesses.find(x => x.name === 'Rawasi Holding').id);
// tab A changes the next action; tab B (stale copy) changes the segment afterwards
await page.evaluate(id => { const b = getLead(id); b.nextAction = 'TAB-A action'; save(); }, tid);
await page.waitForTimeout(800);
const tabB = await page2.evaluate(id => { const b = DB.businesses.find(x => x.id === id); if (!b) return 'no-session'; b.segment = 'TAB-B segment'; save(); return 'saved'; }, tid).catch(() => 'no-session');
await page.waitForTimeout(900);
STEP('L13 two tabs, same record, both save without error (same-section conflict = last-write-wins BY DESIGN — see playbook)', tabB === 'saved', 'tabB=' + tabB);
await page2.close();

// ===== L14 · Arabic pass on the NEW surfaces =====
await page.locator('button:has-text("العربية")').first().click().catch(() => {});
await page.waitForTimeout(2000);
await page.evaluate(() => { current = 'finance'; render(); });
await page.waitForTimeout(1200);
await page.locator('#view button, #view .btn').filter({ hasText: /استيراد/ }).first().click();
await page.waitForTimeout(800);
// 2026-09-02: the "two optional columns" filler line was dropped on purpose in the 2026-08-25
// density pass (js/16-finance-ledger.js) — the probe no longer demands it. It now checks the
// surfaces that exist, and that no English leaked into them.
const arImport = await page.evaluate(() => { const t = document.getElementById('view').textContent || ''; return { drop: t.includes('أفلت هنا') || t.includes('أفلت ملف'), noEnglishDrop: !/Drop (files|here)|Check file/i.test(t), check: t.includes('فحص الملف') }; });
STEP('L14 Arabic import page: drop zone + check button Arabic, no English leak', arImport.drop && arImport.noEnglishDrop && arImport.check, JSON.stringify(arImport));
await SHOT('ar-import');
await page.evaluate(() => { current = 'offers'; render(); });
await page.waitForTimeout(900);
await page.locator('#otb tr').first().click();
await page.waitForTimeout(900);
const arOffer = await page.evaluate(() => (document.getElementById('view').textContent || '').includes('محفوظ داخل التطبيق'));
STEP('L15 Arabic proposal editor: stored-file label in Arabic', arOffer);
// Arabic handover
await page.evaluate(() => { current = 'leads'; openOffer = null; render(); });
await page.waitForTimeout(800);
await page.evaluate(() => { const b = { id: 'lm-ar1', name: 'شركة اختبار التسليم', stage: 'Proposal', status: 'Proposal', contacts: [], activities: [] }; DB.businesses.push(b); setLeadStage('lm-ar1', 'Won'); });
await page.waitForTimeout(1000);
const arHand = await page.evaluate(() => { const t = document.body.textContent || ''; return { title: t.includes('تسليم العميل الجديد'), did: !!document.getElementById('c_did') }; });
STEP('L16 Arabic handover modal opens with Arabic labels', arHand.title && arHand.did, JSON.stringify(arHand));
await SHOT('ar-handover');
await page.locator('.modal button, #modal button').filter({ hasText: /إلغاء|Cancel/ }).first().click().catch(() => {});
await page.waitForTimeout(500);

// ===== L17 · Upload abuse (wrong type / oversize) =====
await page.locator('button:has-text("English")').first().click().catch(() => {});
await page.waitForTimeout(1800);
await page.evaluate(() => { current = 'offers'; render(); });
await page.waitForTimeout(800);
await page.locator('#otb tr').first().click();
await page.waitForTimeout(900);
fs.writeFileSync('shots/evil.exe', 'MZ fake executable');
await page.setInputFiles('#o_file', 'shots/evil.exe');
await page.waitForTimeout(800);
const typeMsg = await page.evaluate(() => (document.getElementById('o_fileMsg') || {}).textContent || '');
STEP('L17 .exe upload: rejected with a clean message, nothing stored', /Accepted types/.test(typeMsg) && !(await page.evaluate(() => (DB.offers || []).some(o => (o.fileName || '').includes('evil')))), typeMsg);
fs.writeFileSync('shots/huge.pdf', Buffer.alloc(26 * 1024 * 1024, 65));
await page.setInputFiles('#o_file', 'shots/huge.pdf');
await page.waitForTimeout(1200);
const sizeMsg = await page.evaluate(() => (document.getElementById('o_fileMsg') || {}).textContent || '');
STEP('L18 26MB upload: rejected client-side before any network', /larger than 25MB/.test(sizeMsg), sizeMsg);

// ===== L19 · Global search with hostile input =====
await page.evaluate(() => { current = 'today'; render(); });
await page.waitForTimeout(700);
/* Target the box by its id, not by its placeholder wording. The old selector looked for the
   English string "Search everything" — which cycle 5 deliberately removed, because the box
   does not search everything and saying so was the defect. From that moment the selector
   matched nothing, L19's hostile-input test stopped running, and the vacuous `else` below
   recorded the silence as a PASS. `#gsearch` is what the app's own Arabic layer (js/21)
   keys on, so it survives any rewording in either language. */
const gs = page.locator('#gsearch').first();
/* PROBE-INTEGRITY FIX (2026-09-03, second meta-pass): this used to end
   `else STEP('L19 global search box present', true, 'not visible ... skipped')` — a missing
   search box was recorded as a PASS. That is the "element missing, call it a pass" shape, and
   it hid the hostile-input test entirely: if the box ever disappeared, L19 would go quiet and
   the suite would stay green. The box is not optional — the app's own header promises
   "Search everything" on every page — so its absence is a defect, and the injection test runs
   only once its presence has been asserted in its own right. Found by the meta-guard only
   after decomment() was fixed; the naive version had blanked this line. */
const gsVisible = await gs.isVisible().catch(() => false);
STEP('L19 the global search box is present on Today (the header promises it — a missing box is a defect, not a skip)', gsVisible);
if (gsVisible) {
  await gs.fill(`<script>alert(1)</script>' OR 1=1`);
  await page.waitForTimeout(900);
  STEP('L19 global search with script/SQL text: no crash, no injection', errs.length === 0);
  await gs.fill('');
}

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('PAGEERRORS:', errs.length, errs.slice(0, 6));
const _fails = LOG.filter(l => l.startsWith('FAIL')).length;
/* PROBE-INTEGRITY FIX (meta-audit, 2026-09-03): this line was `process.exit(0)`. The probe
   counted FAILs and printed them, then exited 0 regardless — so a real regression read as a
   pass to anything using the exit code. Sabotage-proven: with the .exe and 25MB upload guards
   disabled, L17/L18 printed FAIL and the process still exited 0. */
await browser.close(); process.exit(_fails ? 1 : 0);
