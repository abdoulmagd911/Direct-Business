/* probe-export-arabic.mjs — exports in Arabic must be readable by an Arabic user (2026-09-02,
   attack round 8). Drives the REAL Export ▾ buttons and the Leads page's own "Export this view"
   button under LANG='ar', and reads the REAL downloaded files:
     - Leads CSV: column titles are Arabic with the key kept in brackets — "الاسم (name)",
       "المرحلة (stage)" — and every stage cell is an Arabic word, never "Prospect"/"Won"
     - Clients Excel: the <th> titles are Arabic the same way
     - Finance CSV: "رقم الفاتورة (invoice_no)" — and the probe arrives at Finance for the first
       time straight on the Ledger tab (as a client card's "Open in Finance ledger ↗" does):
       before the js/16 fix that path answered "No rows to export — open the Ledger tab first"
       to a person already on the Ledger tab, because only the Overview/Clients tabs filled
       the export rows
     - Events CSV: "الفعالية (Event)"
     - Leads page "↓ تصدير هذا العرض (CSV)": Arabic titles, نعم/لا in the client column
     - English is untouched: the Leads CSV header is still the raw keys, no Arabic anywhere
   Sabotage: drop js/73's script line → the Arabic checks go red; break js/09's head → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8281;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function readDownload(download) {
  const tmp = path.join(os.tmpdir(), 'arexp-' + Math.random().toString(36).slice(2) + '-' + download.suggestedFilename());
  await download.saveAs(tmp);
  const buf = fs.readFileSync(tmp); fs.unlinkSync(tmp);
  return { filename: download.suggestedFilename(), text: buf.toString('utf8').replace(/^﻿/, '') };
}
// minimal quoted-CSV reader (every cell the app writes is quoted; inner quotes doubled)
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim().length));
}
const AR = /[؀-ۿ]/;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const dialogs = [];
  p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4000);

  async function goto(view, lang) {
    await p.evaluate(({ view, lang }) => { LANG = lang; if (typeof applyLang === 'function') applyLang(); current = view; if (view === 'finance' && typeof FIN !== 'undefined') { FIN.tab = 'ledger'; } render(); }, { view, lang });
    await p.waitForTimeout(1200);
    // Finance loads its rows on first open; the export honestly says "No rows" until they land.
    if (view === 'finance') for (let i = 0; i < 20; i++) { const n = await p.evaluate(() => (typeof FIN !== 'undefined' && FIN._csvRows) ? FIN._csvRows.length : 0); if (n > 0) break; await p.waitForTimeout(400); }
  }
  async function exportVia(fn) {
    const before = dialogs.length;
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      p.evaluate(fn),
    ]);
    if (dialogs.length > before) return { alert: dialogs[dialogs.length - 1] };
    return download ? await readDownload(download) : null;
  }

  // ---- Leads, Arabic, Export ▾ CSV summary
  await goto('leads', 'ar');
  let f = await exportVia(() => { window.expGo('list'); });
  if (!f || f.alert) fail('Leads AR CSV: no file (' + (f && f.alert) + ')');
  else {
    const rows = parseCSV(f.text); const head = rows[0] || [];
    if (head.includes('الاسم (name)') && head.includes('المرحلة (stage)')) ok('Leads AR CSV: Arabic column titles with the key kept — ' + head.slice(0, 3).join(' | '));
    else fail('Leads AR CSV: header is not Arabic — ' + head.slice(0, 6).join(' | '));
    const si = head.indexOf('المرحلة (stage)');
    const data = rows.slice(1);
    if (data.length < 1) fail('Leads AR CSV: no data rows');
    const eng = si >= 0 ? data.filter((r) => r[si] && !AR.test(r[si])) : data;
    if (si >= 0 && eng.length === 0) ok('Leads AR CSV: every stage cell is Arabic (' + data.length + ' rows)');
    else fail('Leads AR CSV: ' + eng.length + ' stage cell(s) still English, e.g. "' + (eng[0] && eng[0][si]) + '"');
  }

  // ---- Leads page's own "Export this view" button (js/09), Arabic
  f = await exportVia(() => { const btns = [...document.querySelectorAll('button')]; const bt = btns.find((x) => /تصدير هذا العرض/.test(x.textContent || '')); if (!bt) throw new Error('no Export-this-view button'); bt.click(); });
  if (!f || f.alert) fail('Leads AR "Export this view": no file');
  else {
    const rows = parseCSV(f.text); const head = rows[0] || [];
    if (head[0] === 'الاسم' && head.includes('المرحلة') && head.includes('عميل؟')) ok('Leads AR "Export this view": Arabic titles');
    else fail('Leads AR "Export this view": header not Arabic — ' + head.slice(0, 5).join(' | '));
    const ci = head.indexOf('عميل؟'); const si = head.indexOf('المرحلة');
    const data = rows.slice(1);
    const badClient = data.filter((r) => r[ci] !== 'نعم' && r[ci] !== 'لا');
    const badStage = data.filter((r) => r[si] && !AR.test(r[si]));
    if (!badClient.length && !badStage.length && data.length) ok('Leads AR "Export this view": نعم/لا and Arabic stage words in every row (' + data.length + ')');
    else fail('Leads AR "Export this view": ' + badClient.length + ' client cell(s) not نعم/لا, ' + badStage.length + ' stage cell(s) English');
  }

  // ---- Clients, Arabic, Excel summary
  await goto('clients', 'ar');
  f = await exportVia(() => { window.expGo('xlsList'); });
  if (!f || f.alert) fail('Clients AR Excel: no file');
  else if (/<th>الاسم \(name\)<\/th>/.test(f.text) && /<th>الفئة \(tier\)<\/th>/.test(f.text)) ok('Clients AR Excel: Arabic <th> titles');
  else fail('Clients AR Excel: titles not Arabic — ' + (f.text.match(/<th>[^<]*<\/th>/g) || []).slice(0, 4).join(' '));

  // ---- Finance, Arabic, CSV summary
  await goto('finance', 'ar');
  f = await exportVia(() => { window.expGo('list'); });
  if (!f || f.alert) fail('Finance AR CSV: no file (' + (f && f.alert) + ')');
  else {
    const head = parseCSV(f.text)[0] || [];
    if (head.includes('رقم الفاتورة (invoice_no)') && head.includes('الربح (ريال) (profit_sar)')) ok('Finance AR CSV: Arabic titles — ' + head.slice(0, 3).join(' | '));
    else fail('Finance AR CSV: header not Arabic — ' + head.slice(0, 5).join(' | '));
  }

  // ---- Events, Arabic, CSV
  await goto('events', 'ar');
  await p.waitForTimeout(1500);
  f = await exportVia(() => { window.expGo('list'); });
  if (!f || f.alert) fail('Events AR CSV: no file (' + (f && f.alert) + ')');
  else {
    const head = parseCSV(f.text)[0] || [];
    if (head.includes('الفعالية (Event)') && head.includes('الحالة (Status)')) ok('Events AR CSV: Arabic titles');
    else fail('Events AR CSV: header not Arabic — ' + head.slice(0, 5).join(' | '));
  }

  // ---- English untouched
  await goto('leads', 'en');
  f = await exportVia(() => { window.expGo('list'); });
  if (!f || f.alert) fail('Leads EN CSV: no file');
  else {
    const rows = parseCSV(f.text); const head = rows[0] || [];
    if (head[0] === 'name' && head.includes('stage') && !AR.test(head.join(''))) ok('Leads EN CSV: raw keys, no Arabic in the header');
    else fail('Leads EN CSV: header changed — ' + head.slice(0, 5).join(' | '));
    const si = head.indexOf('stage');
    const arStage = rows.slice(1).filter((r) => AR.test(r[si] || ''));
    if (!arStage.length) ok('Leads EN CSV: stage cells stay English');
    else fail('Leads EN CSV: ' + arStage.length + ' stage cell(s) Arabic in English mode');
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS error(s)`);
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexport-arabic OK — Arabic files readable, English files unchanged');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
