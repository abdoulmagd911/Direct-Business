/* probe-every-hint-speaks-arabic.mjs — the example hints inside the boxes (placeholders) read Arabic in
   Arabic on the forms the form sweep did not reach, English in English, and codes stay codes.

   Fire #255. #249 opened sixteen forms and read their labels and three hints; a survey of every
   placeholder in the layers then found 50 set in English with no dictionary entry. Half are codes
   and brand names that read the same in both languages (A320, RUH-LHR-RUH, Y / J, SV-1234567,
   Amadeus / Duffel, DIRECT10, SA…). The other half are words: the airline editor's rule hints
   ("Same-day before cut-off", "Fare diff + penalty", "Per fare rules; penalty", "Original method /
   airline wallet", "BSP / card / credit / wallet"), the provider editor's, the corporate-deal rows
   ("Discount", "Markup / fee", "Notes (min vol, blackout)"), the offer editor's item, freebie and
   tier hints ("detail / vendor / pax", "price", "our cost", "from", "to", "threshold", "suggest…"),
   the booking editor's source, the onboarding form's people rows ("ID number", "Passport"), the
   team dialog ("Full name"), the lead page's quick note ("What happened?") and the Events filter
   ("Search name, city, venue…"). Read live in Arabic, every one of them was English.

   The words are added to js/21's PLACEHOLDER_AR — the one dictionary — so the existing pass paints
   them on every render and the flip back restores them (#249's mechanism, no new one).

   Read live before the fix (real database, Arabic): 19 English hints on the airline editor, 8 on the
   provider editor, and the offer editor's passenger example ("e.g. Mr. Mohammed Almasar (2 pax)").
   The lead page's quick note and the Events filter were already Arabic on the live app, so they
   are not claimed here; the offer editor's tier and item rows only exist once an option is added,
   so their words are in the dictionary but not asserted.

   What this holds:
     1. AR airline editor: no hint is one of the English words (codes are not counted), and the
        cut-off rule reads Arabic;
     2. AR provider editor: the same, and "Role" reads Arabic;
     3. AR booking editor (a seeded record): the same;
     4. AR onboarding form and team dialog (reached through the profile chip's menu): the same;
     5. AR offer editor: the passenger example hint is Arabic and nothing English is left;
     6. EN brake: the airline, provider and offer editors read their English hints exactly;
     7. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): the fire-#255
   words absent from the dictionary (the tree before this fire) — fails 1, 2, 3 and 5 (the booking
   editor's "GDS / NDC / OTA / Direct" among them); 4 and 6 stay green (the onboarding form and the
   team dialog show only codes, and the brake is English).
   Run: node scripts/qa/probe-every-hint-speaks-arabic.mjs                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9305 — one mock. */
const PORT = 9305; const BASE = 'http://localhost:' + PORT;

const EN = ['Same-day before cut-off', 'Fare diff + penalty', 'Per fare rules; penalty', 'Original method / airline wallet', 'BSP / card / credit / wallet',
  'GDS / NDC / Direct portal / Aggregator (Travel Fusion)', 'GDS / NDC / OTA / Direct', 'Duffel → short-haul EU LCCs', 'Role', 'Tour/Acct code', 'Discount',
  'Notes (min vol, blackout)', 'Markup / fee', 'detail / vendor / pax', 'price', 'e.g. airport transfer / upgrade', 'our cost', 'from', 'to', 'threshold',
  'suggest…', 'What happened?', 'passphrase', 'ID number', 'Passport', 'Full name', 'Search name, city, venue…', 'account / deeplink / agreement', 'version / status / contact'];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method(); const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(4000);

  /* close the way a person does, and CHECK it closed — the first run of this probe read the previous
     dialog's hints twice over when an opener silently did nothing (trap: a stale box reads as a new one) */
  const closeAll = async () => { for (let i = 0; i < 3; i++) { await p.evaluate(() => { try { const m = document.getElementById('modal'); if (m && m.offsetHeight) { const x = m.querySelector('.btn.ghost'); if (x) x.click(); } if (typeof closeModal === 'function') closeModal(); } catch (_) {} }); await p.waitForTimeout(350);
    if (!(await p.evaluate(() => { const m = document.getElementById('modal'); return !!(m && m.offsetHeight); }))) return; } };
  const hints = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel + ' input[placeholder], ' + sel + ' textarea[placeholder]')].map((x) => x.getAttribute('placeholder')).filter(Boolean), sel);
  const openModalWith = async (fn) => { await closeAll(); await p.evaluate(fn); await p.waitForTimeout(900);
    const open = await p.evaluate(() => { const m = document.getElementById('modal'); return !!(m && m.offsetHeight); }); return open ? await hints('#modal') : null; };
  const out = {};
  out.air = await openModalWith(() => { try { editSupplier('air', (DB.airlines || [])[0] && DB.airlines[0].id); } catch (_) {} });
  out.prov = await openModalWith(() => { try { editSupplier('prov', (DB.vendors || [])[0] && DB.vendors[0].id); } catch (_) {} });
  out.booking = await openModalWith(() => { try { editBooking((DB.bookings || [])[0] && DB.bookings[0].id); } catch (_) {} });
  out.onboard = await openModalWith(() => { try { const c = (DB.businesses || []).find((x) => x.isClient) || DB.businesses[0]; v22OpenClientOnboarding(c.id); } catch (_) {} });
  /* the team dialog's opener is private to js/02 — reach it the way a person does, through the profile chip's menu */
  await closeAll();
  await p.evaluate(() => { try { document.getElementById('v68me').click(); } catch (_) {} }); await p.waitForTimeout(400);
  await p.evaluate(() => { try { const m = document.getElementById('v68menu'); const first = m && m.querySelector('button'); if (first) first.click(); } catch (_) {} }); await p.waitForTimeout(1000);
  out.team = await p.evaluate(() => { const m = document.getElementById('modal'); const box = (m && m.offsetHeight) ? m : document.querySelector('#teamModal, #v48ov'); return box ? [...box.querySelectorAll('input[placeholder],textarea[placeholder]')].map((x) => x.getAttribute('placeholder')).filter(Boolean) : null; });
  await p.evaluate(() => { try { document.querySelectorAll('#teamModal, #v48ov').forEach((x) => x.remove()); } catch (_) {} });
  await closeAll();
  /* the offer editor lives in the working area, not a box */
  await p.evaluate(() => { try { current = 'offers'; openLead = null; render(); newOffer(); } catch (_) {} }); await p.waitForTimeout(1500);
  out.offer = await hints('#view');
  await ctx.close();
  return { out, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

const eng = (arr) => (arr || []).filter((t) => EN.includes(t) || t === 'e.g. Mr. Mohammed Almasar (2 pax)');
const opened = (k) => (ar.out[k] || []).length > 0 && (en.out[k] || []).length > 0;
console.log('  six surfaces opened in Arabic and in English; hints read as attributes');

(opened('air') && eng(ar.out.air).length === 0 && ar.out.air.some((t) => /في نفس اليوم/.test(t)))
  ? pass('AR airline editor: no hint is one of the English words', ar.out.air.length + ' hints')
  : fail('AR airline editor: no hint is one of the English words', JSON.stringify({ english: eng(ar.out.air).slice(0, 4), n: (ar.out.air || []).length }));
(opened('prov') && eng(ar.out.prov).length === 0 && ar.out.prov.some((t) => /الدور/.test(t)))
  ? pass('AR provider editor: the same', ar.out.prov.length + ' hints')
  : fail('AR provider editor: the same', JSON.stringify({ english: eng(ar.out.prov).slice(0, 4), n: (ar.out.prov || []).length }));
(opened('booking') && eng(ar.out.booking).length === 0)
  ? pass('AR booking editor: the same', ar.out.booking.length + ' hints')
  : fail('AR booking editor: the same', JSON.stringify({ english: eng(ar.out.booking || []).slice(0, 3), n: (ar.out.booking || []).length }));
(opened('onboard') && opened('team') && eng(ar.out.onboard).length === 0 && eng(ar.out.team).length === 0)
  ? pass('AR onboarding form and team dialog: the same', ar.out.onboard.length + ' + ' + ar.out.team.length + ' hints')
  : fail('AR onboarding form and team dialog: the same', JSON.stringify({ onboard: eng(ar.out.onboard || []).slice(0, 3), team: eng(ar.out.team || []).slice(0, 3), n: [ (ar.out.onboard || []).length, (ar.out.team || []).length ] }));
(opened('offer') && eng(ar.out.offer).length === 0 && ar.out.offer.some((t) => /راكبان/.test(t)))
  ? pass('AR offer editor: the passenger example hint is Arabic and nothing English is left', ar.out.offer.length + ' hints')
  : fail('AR offer editor: the passenger example hint is Arabic and nothing English is left', JSON.stringify({ english: eng(ar.out.offer || []).slice(0, 4), all: (ar.out.offer || []).slice(0, 6) }));
(en.out.air && en.out.air.includes('Same-day before cut-off') && en.out.air.includes('Fare diff + penalty') && en.out.prov && en.out.prov.includes('Role') && en.out.offer.includes('e.g. Mr. Mohammed Almasar (2 pax)'))
  ? pass('EN brake: the airline, provider and offer editors read their English hints exactly')
  : fail('EN brake: the airline, provider and offer editors read their English hints exactly', JSON.stringify({ air: (en.out.air || []).slice(0, 6), prov: (en.out.prov || []).slice(0, 6), offer: (en.out.offer || []).slice(0, 6) }));
const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
