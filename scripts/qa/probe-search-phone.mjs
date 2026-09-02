/* probe-search-phone.mjs — global search, in both languages and on a phone, plus the Today
   sync-alert strip (2026-09-02, attack round 21). Found while driving: the result-type words
   ("Airline / Provider / SOP / Lead") and the "No matches" line stayed English in Arabic, and
   under 780 px the search box is hidden by index.html with nothing in its place — a person on a
   phone had no search on Leads / Clients / Finance at all. Asserts:
     - EN + AR: a search finds an airline, a provider, a procedure and a lead across the seeded
       workspace; the type word is Arabic in Arabic; "no matches" is Arabic in Arabic; picking a
       result opens the right record
     - phone (390 px): the box is hidden, a 🔍 button sits in the top bar, tapping it reveals the
       box inside the viewport and focuses it, typing lists results inside the viewport, picking
       one navigates and closes the row, the page never scrolls sideways; on desktop the button
       is not shown
     - Today: the seeded failed sync event shows on the alert strip and the pill opens Sync
   Sabotage: drop the button insertion in js/74 → phone has no search → red. Drop the Arabic
   type map in core-01 → "Airline" survives in Arabic → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8377;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
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
  const setLang = (l) => p.evaluate((l) => { LANG = l; if (typeof applyLang === 'function') applyLang(); current = 'today'; render(); }, l);
  const search = async (q) => { await p.evaluate((q) => { const gs = document.getElementById('gsearch'); gs.value = q; runGlobalSearch(q); }, q); await p.waitForTimeout(300); return p.evaluate(() => [...document.querySelectorAll('#gres .gres-item')].map((e) => ({ t: (e.querySelector('.gres-t') || {}).textContent || '', l: (e.querySelector('.gres-l') || {}).textContent || '', raw: e.textContent.trim() }))); };
  const pick = async () => { await p.evaluate(() => gGo(0)); await p.waitForTimeout(500); return p.evaluate(() => current + '/' + (openSup || openLead || '')); };
  const inView = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.left >= -1 && r.right <= window.innerWidth + 1; }, sel);

  // ---- desktop, EN then AR
  const TYPES = { en: { airline: 'Airline', provider: 'Provider', sop: 'SOP', lead: 'Lead' }, ar: { airline: 'شركة طيران', provider: 'مورّد', sop: 'إجراء', lead: 'عميل محتمل' } };
  for (const lang of ['en', 'ar']) {
    await setLang(lang); await p.waitForTimeout(500);
    const T = TYPES[lang];
    const a = await search('QA National'); if (a.length && a[0].t === T.airline && /QA National Carrier/.test(a[0].l)) ok(lang.toUpperCase() + ': airline found, typed "' + T.airline + '"'); else fail(lang.toUpperCase() + ': airline search → ' + JSON.stringify(a.slice(0, 2)));
    const where = await pick(); if (where === 'airlines/air_qa1') ok(lang.toUpperCase() + ': picking it opens the airline record'); else fail(lang.toUpperCase() + ': pick landed on ' + where);
    const v = await search('QA Global'); if (v.length && v[0].t === T.provider) ok(lang.toUpperCase() + ': provider found, typed "' + T.provider + '"'); else fail(lang.toUpperCase() + ': provider search → ' + JSON.stringify(v.slice(0, 2)));
    const s = await search('Void window'); if (s.length && s[0].t === T.sop) ok(lang.toUpperCase() + ': procedure found, typed "' + T.sop + '"'); else fail(lang.toUpperCase() + ': SOP search → ' + JSON.stringify(s.slice(0, 2)));
    const l = await search('Test Company 3'); if (l.length && l[0].t === T.lead) ok(lang.toUpperCase() + ': lead found, typed "' + T.lead + '"'); else fail(lang.toUpperCase() + ': lead search → ' + JSON.stringify(l.slice(0, 2)));
    const n = await search('zzzz-nothing'); const want = lang === 'ar' ? /لا نتائج/ : /No matches/; if (n.length === 1 && want.test(n[0].raw)) ok(lang.toUpperCase() + ': no-match line reads in the right language'); else fail(lang.toUpperCase() + ': no-match line → ' + JSON.stringify(n));
  }
  const btnDesktop = await inView('#v74search');
  if (btnDesktop === false) ok('desktop: the phone search button is not shown'); else fail('desktop: phone search button state ' + btnDesktop);

  // ---- Today alert strip
  await setLang('en'); await p.waitForTimeout(800);
  const strip = await p.evaluate(() => { const s = document.querySelector('.v20-alert-strip'); return s ? s.innerText : null; });
  if (strip && /1 failed sync/.test(strip)) ok('Today shows the seeded failed sync on the alert strip'); else fail('Today alert strip: ' + JSON.stringify(strip));
  await p.evaluate(() => { const pill = document.querySelector('.v20-alert-strip .v20-alert-pill'); if (pill) pill.click(); }); await p.waitForTimeout(500);
  if ((await p.evaluate(() => current)) === 'sync') ok('tapping the pill opens Sync'); else fail('tapping the pill did not open Sync');

  // ---- phone
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  await p.evaluate(() => { current = 'leads'; render(); }); await p.waitForTimeout(600);
  const wrapHidden = await p.evaluate(() => getComputedStyle(document.querySelector('.gsearch-wrap')).display === 'none');
  const btn = await inView('#v74search');
  if (wrapHidden && btn) ok('phone: search box hidden, 🔍 button in the top bar inside the viewport'); else fail('phone: box hidden ' + wrapHidden + ', button ' + btn);
  await p.click('#v74search'); await p.waitForTimeout(300);
  const opened = await inView('.gsearch-wrap'); const focused = await p.evaluate(() => document.activeElement && document.activeElement.id === 'gsearch');
  if (opened && focused) ok('phone: tapping 🔍 reveals the search box inside the viewport and focuses it'); else fail('phone: after tap — box in view ' + opened + ', focused ' + focused);
  await p.keyboard.type('QA Global'); await p.waitForTimeout(500);
  const res = await inView('#gres'); const n = await p.evaluate(() => document.querySelectorAll('#gres .gres-item').length);
  if (res && n >= 1) ok('phone: typing lists ' + n + ' result(s) inside the viewport'); else fail('phone: results in view ' + res + ', count ' + n);
  await p.evaluate(() => { const first = document.querySelector('#gres .gres-item'); first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await p.waitForTimeout(600);
  const where = await p.evaluate(() => current + '/' + openSup); const closed = await p.evaluate(() => !document.querySelector('.gsearch-wrap').classList.contains('v74-open'));
  if (where === 'vendors/ven_qa1' && closed) ok('phone: picking the result opens the provider and closes the search row');
  else fail('phone: pick → ' + where + ', row closed ' + closed + ' · ' + JSON.stringify(await p.evaluate(() => ({ gres: (window._gres || []).map((r) => r.t + ':' + r.label), gGoWrapped: String(window.gGo).indexOf('toggle') >= 0, first: (document.querySelector('#gres .gres-item') || {}).outerHTML || null, gresDisplay: (document.getElementById('gres') || {}).style.display }))));
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 6);
  if (!over) ok('phone: no horizontal overflow'); else fail('phone: page scrolls sideways');
  await setLang('ar'); await p.waitForTimeout(500);
  const title = await p.evaluate(() => (document.getElementById('v74search') || {}).title);
  if (title === 'بحث') ok('phone AR: the button is labelled in Arabic'); else fail('phone AR: button title ' + JSON.stringify(title));

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nsearch-phone OK — search works in both languages and is reachable on a phone; Today flags the failed sync');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
