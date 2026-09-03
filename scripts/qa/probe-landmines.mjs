/* Landmine probe — adversarial scenarios: bad files, hostile names, undo paths,
   double-clicks, Excel-mangled CSVs, Arabic digits, two tabs on one record. */
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
await page.route('**cdn.jsdelivr.net/**', route);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
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
nextDialogAction = 'accept';
await page.evaluate(id => leadQuickEdit(id), hid);
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Contacted'; });
await page.locator('#mSave').click();
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
nextDialogAction = 'dismiss';
await page.evaluate(id => leadQuickEdit(id), hid);
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Qualified'; });
await page.locator('#mSave').click();
await page.waitForTimeout(900);
const unwon2 = await page.evaluate(id => { const b = getLead(id); return { client: b.isClient, stage: b.stage }; }, hid);
STEP('L5 un-Won + Cancel: stays a client (stage change kept)', unwon2.client === true && unwon2.stage === 'Qualified', JSON.stringify(unwon2));
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
const tryFile = async (name, content) => {
  fs.writeFileSync('shots/' + name, content);
  await page.setInputFiles('#finFile', 'shots/' + name);
  await page.evaluate(() => finParse());
  await page.waitForTimeout(900);
  return await page.evaluate(() => (document.getElementById('finImpOut').textContent || '').replace(/\s+/g, ' '));
};
const HDRB = 'client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes';
// L6 binary junk pretending to be a CSV
let out = await tryFile('junk.csv', '%PDF-1.4\x00\x01\x02 binary junk not a csv \xff\xfe');
STEP('L6 binary junk .csv: clear header error, no crash', /Header does not match/.test(out), out.slice(0, 90));
// L7 header-only
out = await tryFile('empty.csv', HDRB);
STEP('L7 header-only CSV: 0 rows, no confirm button, no crash', /Ready to import: 0/.test(out) && !/Confirm import/.test(out));
// L8 Excel-mangled: semicolons and uppercase
out = await tryFile('semi.csv', HDRB.replace(/,/g, ';') + '\nA;B');
const semiOK = /Header does not match/.test(out);
out = await tryFile('upper.csv', HDRB.toUpperCase() + '\na,b');
STEP('L8 semicolon + UPPERCASE headers: both rejected with the found-header shown', semiOK && /Header does not match/.test(out));
// L9 Arabic-Indic digits in amounts → flagged, never silently zeroed into the ledger
out = await tryFile('ardigits.csv', HDRB + '\nTest Co,August,Q3,DP-AR01,,Test Co,2026-08-05,Hotel booking,٢٣٠٠٠,0,23000,20000,3000,verified_paid,');
STEP('L9 Arabic-numeral amount: row FLAGGED (revenue mismatch), not imported wrong', /Flagged for review.*1/.test(out) && /DP-AR01/.test(out), out.slice(0, 160));
// L10 unknown proposal_ref soft warning
out = await tryFile('unkref.csv', HDRB + ',origin,proposal_ref\nTest Co,August,Q3,DP-UR01,,Test Co,2026-08-05,Visa run,4600,0,4600,4000,600,verified_paid,,project,DB-DOES-NOT-EXIST');
STEP('L10 unknown proposal ref: imports but WARNS it does not exist yet', /Ready to import: 1/.test(out) && /not in the app yet/.test(out), out.slice(0, 200));
await SHOT('import-warnings');
// L11 1,000-row file: parses fast, single confirm, double-click cannot double-import
const big = [HDRB];
for (let i = 0; i < 1000; i++) big.push(`Bulk Co ${i % 7},August,Q3,DP-BULK-${i},TTIN-B${i},Bulk Co,2026-08-0${(i % 8) + 1},Flight ticket,${1000 + i},0,${1000 + i},${800 + i},200,verified_paid,`);
const t0 = Date.now();
out = await tryFile('big.csv', big.join('\r\n'));
const parseMs = Date.now() - t0;
STEP('L11 1000-row CSV parses + previews fast', /Ready to import: 1000/.test(out) && parseMs < 8000, parseMs + 'ms');
await page.evaluate(() => { finCommit(); finCommit(); finCommit(); }); // hammer the button
await page.waitForTimeout(4000);
const bulkCount = await page.evaluate(async () => {
  // page through the API (it caps at 1000 rows per request, like real PostgREST)
  let all = [], from = 0;
  while (true) { const r = await fetch('http://127.0.0.1:8919/rest/v1/finance_invoices', { headers: { Range: from + '-' + (from + 999) } }).then(x => x.json()); all = all.concat(r); if (r.length < 1000) break; from += 1000; }
  return all.filter(x => String(x.invoice_no || '').startsWith('DP-BULK-')).length;
});
STEP('L12 triple-click Confirm: exactly 1000 rows land, not 2000/3000', bulkCount === 1000, 'rows=' + bulkCount);

// ===== L13 · Two tabs, same company, both save — what really happens =====
const page2 = await ctx.newPage();
await page2.route('**cdn.jsdelivr.net/**', route);
await page2.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
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
