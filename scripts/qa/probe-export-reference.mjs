/* probe-export-reference.mjs — the top-bar Export on the Reference pages, summary AND "full
   details", CSV and Excel, EN and AR (2026-09-02, attack round 22). First time these exports ran
   with rows in the harness. Found: the airlines "full details" file wrote the NDC matrix as six
   "[object Object]" per carrier (both languages), and in Arabic 24 of the 26 full-details
   columns came out as bare keys, "ksa" was titled as the country, and the code-list values
   (ticketing authority, ADM risk, API status) stayed English. Asserts:
     - no "[object Object]" anywhere in any file; the NDC column reads "Amadeus: Active | …"
     - the servicing flags column of a provider reads as the flags that are on
     - Arabic files: every column title carries an Arabic label AND the original key in brackets
       (machine-readable), and the code-list values are Arabic; English files carry raw keys and
       English values (byte-for-byte unaffected by the Arabic layer)
     - the Excel variant carries the same cells as the CSV
   Sabotage: revert core-05's exportFlat to the one-level join → "[object Object]" → red. Drop
   the full-details labels from js/73 → bare keys in Arabic → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8379;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
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

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6000);

  // drive the real menu: Export ▾ → the option whose text matches
  async function exportFile(view, lang, optRe) {
    await p.evaluate(([v, l]) => { LANG = l; if (typeof applyLang === 'function') applyLang(); openSup = null; openLead = null; current = v; render(); }, [view, lang]); await p.waitForTimeout(600);
    await p.evaluate(() => { const b = [...document.querySelectorAll('.top button')].find((x) => /Export|تصدير/.test(x.textContent)); if (b) b.click(); }); await p.waitForTimeout(300);
    const dl = p.waitForEvent('download', { timeout: 6000 }).catch(() => null);
    const clicked = await p.evaluate((src) => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button,a')].find((x) => x.offsetParent !== null && re.test(x.textContent)); if (!b) return null; b.click(); return b.textContent.trim(); }, optRe);
    const d = await dl; await p.evaluate(() => document.body.click());
    if (!d) return { clicked, text: null };
    return { clicked, name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8') };
  }
  const csvRows = (t) => t.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.slice(1, -1).split('","'));
  const xlsCells = (t) => [...t.matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<'));

  // ---- airlines, full details, EN
  const enFull = await exportFile('airlines', 'en', 'CSV.*full');
  if (!enFull.text) fail('EN airlines full-details CSV did not download (clicked ' + enFull.clicked + ')');
  else {
    const rows = csvRows(enFull.text); const head = rows[0]; const ndcI = head.indexOf('ndc');
    if (!/\[object Object\]/.test(enFull.text)) ok('EN airlines full: no "[object Object]" anywhere (' + (rows.length - 1) + ' rows × ' + head.length + ' columns)'); else fail('EN airlines full: "[object Object]" ' + (enFull.text.match(/\[object Object\]/g) || []).length + ' times');
    const r1 = rows.find((r) => r[0] === 'QA National Carrier') || [];
    if (ndcI >= 0 && /Amadeus: Active/.test(r1[ndcI] || '') && /Babylon: Pending/.test(r1[ndcI] || '')) ok('EN airlines full: NDC column reads "source: status" — ' + r1[ndcI].slice(0, 80)); else fail('EN airlines full: NDC column → ' + JSON.stringify(r1[ndcI]));
    const cI = head.indexOf('contacts');
    if (cI >= 0 && /Sales Desk/.test(r1[cI] || '') && !/\[object/.test(r1[cI] || '')) ok('EN airlines full: contacts column carries the contact, not an object'); else fail('EN airlines full: contacts column → ' + JSON.stringify(r1[cI]));
    if (head.every((h) => /^[a-zA-Z_]+$/.test(h))) ok('EN airlines full: column titles are the raw keys (English export untouched by the Arabic layer)'); else fail('EN airlines full: unexpected column titles ' + JSON.stringify(head.slice(0, 6)));
  }
  // ---- providers, full details, EN — flags column
  const enProv = await exportFile('vendors', 'en', 'CSV.*full');
  if (!enProv.text) fail('EN providers full-details CSV did not download');
  else {
    const rows = csvRows(enProv.text); const head = rows[0]; const capI = head.indexOf('caps'); const r1 = rows.find((r) => r[0] === 'QA Global GDS') || [];
    if (capI >= 0 && r1[capI] === 'Book, Reissue, Refund, EMD, Seats, Split PNR') ok('EN providers full: servicing flags column lists the flags that are on'); else fail('EN providers full: flags column → ' + JSON.stringify(r1[capI]));
    if (!/\[object Object\]/.test(enProv.text)) ok('EN providers full: no "[object Object]"'); else fail('EN providers full has "[object Object]"');
  }
  // ---- airlines, full details, AR
  const arFull = await exportFile('airlines', 'ar', 'CSV.*(full|كل التفاصيل)');
  if (!arFull.text) fail('AR airlines full-details CSV did not download (clicked ' + arFull.clicked + ')');
  else {
    const rows = csvRows(arFull.text); const head = rows[0];
    const bare = head.filter((h) => !/[؀-ۿ]/.test(h) && !/^GDS \(gds\)$/.test(h));
    if (!bare.length) ok('AR airlines full: every one of the ' + head.length + ' column titles is Arabic'); else fail('AR airlines full: bare-key columns ' + JSON.stringify(bare));
    const keyed = head.filter((h) => !/\([a-zA-Z_]+\)$/.test(h));
    if (!keyed.length) ok('AR airlines full: every title keeps the original key in brackets (machine-readable)'); else fail('AR airlines full: titles without the key ' + JSON.stringify(keyed.slice(0, 5)));
    const ksa = head.find((h) => /\(ksa\)$/.test(h));
    if (ksa === 'BSP السعودية (ksa)') ok('AR airlines: the KSA column is titled as the BSP flag, not the country'); else fail('AR airlines: ksa title → ' + JSON.stringify(ksa));
    const taI = head.findIndex((h) => /\(ticketingAuthority\)$/.test(h)); const admI = head.findIndex((h) => /\(admRisk\)$/.test(h)); const ndcI = head.findIndex((h) => /\(ndc\)$/.test(h));
    const r1 = rows.find((r) => r[0] === 'QA National Carrier') || []; const r3 = rows.find((r) => r[0] === 'QA Budget Wings') || [];
    if (r1[taI] === 'مصرّح (الإصدار عبر BSP)' && r3[taI] === 'بدون صلاحية — مستهدف' && r3[admI] === 'مرتفع') ok('AR airlines: code-list values (authority, ADM risk) are Arabic'); else fail('AR airlines: code-list values → ' + JSON.stringify([r1[taI], r3[taI], r3[admI]]));
    if (!/\[object Object\]/.test(arFull.text) && /Amadeus: Active/.test(r1[ndcI] || '')) ok('AR airlines full: NDC column readable, no objects'); else fail('AR airlines full: NDC → ' + JSON.stringify(r1[ndcI]));
    if (r1[0] === 'QA National Carrier') ok('AR airlines: names and free text are left as data'); else fail('AR airlines: name cell → ' + JSON.stringify(r1[0]));
  }
  // ---- providers + SOPs, full, AR — titles
  for (const [view, must] of [['vendors', ['(accountManager)', '(caps)', '(incidents)']], ['sopsla', ['(cmd)', '(body)', '(edge)']]]) {
    const f = await exportFile(view, 'ar', 'CSV.*(full|كل التفاصيل)');
    if (!f.text) { fail('AR ' + view + ' full-details CSV did not download'); continue; }
    const head = csvRows(f.text)[0];
    const bare = head.filter((h) => !/[؀-ۿ]/.test(h) && !/^GDS \(gds\)$/.test(h));
    if (!bare.length && must.every((k) => head.some((h) => h.endsWith(' ' + k)))) ok('AR ' + view + ' full: all ' + head.length + ' titles Arabic + keyed'); else fail('AR ' + view + ' full: bare ' + JSON.stringify(bare) + ' / keyed-check ' + must.map((k) => head.some((h) => h.endsWith(' ' + k))).join(','));
    if (!/\[object Object\]/.test(f.text)) ok('AR ' + view + ' full: no "[object Object]"'); else fail('AR ' + view + ' full has "[object Object]"');
  }
  // ---- Excel variant carries the same cells (airlines full, EN)
  const xls = await exportFile('airlines', 'en', 'Excel.*full');
  if (!xls.text) fail('EN airlines full Excel did not download');
  else {
    const cells = xlsCells(xls.text);
    if (!/\[object Object\]/.test(xls.text) && cells.some((c) => /Amadeus: Active/.test(c))) ok('EN airlines full Excel: same flattening, no objects'); else fail('EN airlines full Excel: objects ' + (xls.text.match(/\[object Object\]/g) || []).length + ', ndc cell ' + JSON.stringify(cells.find((c) => /Amadeus/.test(c))));
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexport-reference OK — reference exports are readable in both languages, summary and full, CSV and Excel');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
