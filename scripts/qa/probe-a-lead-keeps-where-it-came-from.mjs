/* probe-a-lead-keeps-where-it-came-from.mjs — guards the 2026-09-20 (fire #116) fix in
   js/core/core-02-leads.js.

   The twin of fire #115, found by looking for the same shape in the form people actually use most.

   The lead form's "Funnel / source" box is built from a fixed list — SOURCES plus the custom
   funnels in settings, sixteen entries — and had NO empty option. The sources the records actually
   hold are "Contact Submission" (81 companies), "corporate_clients_import_20260821" (19), "Past
   Invoices" (3), "Partners & Tenders", "Travel Trade", "Inbound", "Website Form — Entities" and
   "Direct Payments import". ALL 108 live companies hold a source that is not in that list.

   A <select> with no matching option selects its first one, and Save reads the box and writes it
   back. Measured against the real database, in English and in Arabic: open a lead, press Save
   without touching anything, and its source changes from "Partners & Tenders" to "Old Customers".
   Every company in the app was one edit away from losing where it came from — the field the two
   August re-verification rounds were built on.

   The Category box had the same hole from the other direction: 98 of 108 companies have no
   category at all, and with no empty option the box opened on "Anchor" and Save wrote it.

   The airline form's Type box, checked here too because it is the same defect and was fixed in the
   same round: five of the 136 real carriers hold a type the box never heard of — two blank, three
   plating or GSSA platforms — and it would have recorded them as full-service carriers.

   Fixed the same way as the funnel form: an empty option for "nothing recorded", and, where the
   record holds something the list does not, that answer as its own option, selected and marked as
   what is on file. Every standard option is still offered, so changing it stays deliberate.

   Sabotage-tested 2026-09-20, each part separately, all restored byte-for-byte afterwards:
     · the source box put back to the plain list: 3 checks FAIL — the box opens on "Old Customers"
       and Save rewrites the lead's source to it, in both languages.
     · the category box put back: 3 checks FAIL — a company with no category is given "Anchor",
       and the form has no way to say that nothing is recorded.
     · the airline Type box put back: 2 checks FAIL — a plating platform becomes an FSC.
   Run: node scripts/qa/probe-a-lead-keeps-where-it-came-from.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9089; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];
const ODD_SOURCE = 'Contact Submission';   // the real one, on 81 live companies
const KNOWN_SOURCE = 'Referral';           // one the list does contain

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 1 && typeof editBusiness === 'function', { timeout: 120000 });
  await p.waitForTimeout(5000);

  /* one company in the state 81 live ones are in, and one the list can represent */
  const seed = await p.evaluate(({ odd, known }) => {
    const B = DB.businesses || [];
    B[0].name = 'Qaanoon Provenance Co'; B[0].source = odd; delete B[0].category;
    B[1].name = 'Qaanoon Known Source Co'; B[1].source = known; B[1].category = 'Convert';
    current = 'leads'; openLead = null; render();
    const list = (typeof funnelList === 'function') ? funnelList() : (typeof SOURCES !== 'undefined' ? SOURCES : []);
    return { ids: [B[0].id, B[1].id], list, firstOption: list[0],
      categories: (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []) };
  }, { odd: ODD_SOURCE, known: KNOWN_SOURCE });
  await p.waitForTimeout(1500);

  const look = async (id) => {
    const before = await p.evaluate((i) => {
      const x = (DB.businesses || []).find((y) => y.id === i);
      return { name: x.name, source: x.source || null, category: x.category || null,
        stage: x.stage || null, assignedTo: x.assignedTo || null };
    }, id);
    await p.evaluate((i) => { editBusiness(i); }, id);
    await p.waitForTimeout(1800);
    const shown = await p.evaluate(() => {
      const g = (eid) => { const e = document.getElementById(eid); if (!e) return null;
        return { value: e.value, optionTexts: [].slice.call(e.options).map((o) => (o.textContent || '').trim()),
          optionValues: [].slice.call(e.options).map((o) => o.value),
          selectedText: e.selectedIndex >= 0 ? (e.options[e.selectedIndex].textContent || '').trim() : null }; };
      return { source: g('f_source'), cat: g('f_cat') };
    });
    const after = await p.evaluate((i) => {
      const btns = [].slice.call(document.querySelectorAll('#modal button, .modal button'));
      const save = btns.find((x) => /^\s*(Save|حفظ)/.test(x.textContent || ''));
      if (save) save.click();
      const x = (DB.businesses || []).find((y) => y.id === i) || {};
      return { clicked: !!save, name: x.name, source: x.source || null, category: x.category || null,
        stage: x.stage || null, assignedTo: x.assignedTo || null };
    }, id);
    await p.waitForTimeout(1200);
    return { before, shown, after };
  };

  const odd = await look(seed.ids[0]);
  const known = await look(seed.ids[1]);

  /* the same box on the Airlines page, where five of the 136 real carriers are in the same state */
  const air = await p.evaluate(() => {
    const arr = (DB.airlines || []);
    if (!arr.length || typeof editSupplier !== 'function') return null;
    arr[0].name = 'Qaanoon Plating Platform'; arr[0].type = 'GSSA / plating';
    current = 'suppliers'; openLead = null; render();
    editSupplier('air', arr[0].id);
    const e = document.getElementById('x_type');
    const shown = e ? { value: e.value, optionValues: [].slice.call(e.options).map((o) => o.value),
      selectedText: e.selectedIndex >= 0 ? (e.options[e.selectedIndex].textContent || '').trim() : null } : null;
    const btns = [].slice.call(document.querySelectorAll('#modal button, .modal button'));
    const save = btns.find((x) => /^\s*(Save|\u062d\u0641\u0638)/.test(x.textContent || ''));
    if (save) save.click();
    const back = (DB.airlines || []).find((x) => x.id === arr[0].id) || {};
    return { shown, clicked: !!save, typeAfter: back.type || null };
  });
  await p.waitForTimeout(1200);

  await ctx.close();
  return { seed, odd, known, air };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
const diff = (r) => ['name', 'source', 'category', 'stage', 'assignedTo'].filter((k) => String(r.before[k]) !== String(r.after[k]));
console.log('  the box offers', en.seed.list.length, 'sources, first =', JSON.stringify(en.seed.firstOption));
console.log('  EN odd-source lead — box:', JSON.stringify(en.odd.shown.source && en.odd.shown.source.selectedText),
  '· changed by Save:', JSON.stringify(diff(en.odd)));
console.log('  AR odd-source lead — box:', JSON.stringify(ar.odd.shown.source && ar.odd.shown.source.selectedText),
  '· changed by Save:', JSON.stringify(diff(ar.odd)));
console.log('  EN category box on a lead with none:', JSON.stringify(en.odd.shown.cat && en.odd.shown.cat.selectedText),
  '· after Save:', JSON.stringify(en.odd.after.category));
console.log('  EN known-source lead — box:', JSON.stringify(en.known.shown.source && en.known.shown.source.value),
  '· changed by Save:', JSON.stringify(diff(en.known)));

const checks = [
  ['the lead form opened with both dropdowns on it', !!en.odd.shown.source && !!en.odd.shown.cat && !!ar.odd.shown.source,
    JSON.stringify({ en: !!en.odd.shown.source, ar: !!ar.odd.shown.source })],
  ['the source box shows the source that is on file, not the first entry in a list',
    en.odd.shown.source.value === ODD_SOURCE && ar.odd.shown.source.value === ODD_SOURCE,
    JSON.stringify({ en: en.odd.shown.source.value, ar: ar.odd.shown.source.value, firstInList: en.seed.firstOption })],
  ['and it still offers every standard source, so changing it stays a deliberate choice',
    en.seed.list.every((s) => en.odd.shown.source.optionValues.indexOf(s) >= 0),
    'offered ' + en.odd.shown.source.optionValues.length + ' of ' + (en.seed.list.length + 2)],
  ['the extra entry says, in the page\'s own language, that it is what is on file',
    /on file/.test(en.odd.shown.source.selectedText) && /المسجَّل/.test(ar.odd.shown.source.selectedText),
    JSON.stringify({ en: en.odd.shown.source.selectedText, ar: ar.odd.shown.source.selectedText })],
  ['pressing Save without touching anything leaves the lead exactly as it was, in both languages',
    diff(en.odd).length === 0 && diff(ar.odd).length === 0,
    JSON.stringify({ en: diff(en.odd), ar: diff(ar.odd), source: en.odd.after.source })],
  /* the category half — the same hole from the other side: nothing recorded, and no way to say so */
  ['a lead with no category is not quietly given one',
    !en.odd.after.category && !ar.odd.after.category,
    JSON.stringify({ en: en.odd.after.category, ar: ar.odd.after.category, firstCategory: en.seed.categories[0] })],
  ['the category box can say that nothing is recorded',
    en.odd.shown.cat.optionValues.indexOf('') >= 0 && en.odd.shown.cat.value === '',
    JSON.stringify(en.odd.shown.cat.optionTexts.slice(0, 3))],
  /* and the ordinary case is untouched — the fix must not change a record the list can represent */
  ['a source the list does contain is selected normally, with no extra entry',
    en.known.shown.source.value === KNOWN_SOURCE
    && en.known.shown.source.optionValues.filter((v) => v === KNOWN_SOURCE).length === 1,
    JSON.stringify(en.known.shown.source.value)],
  ['and that lead is unchanged by Save too', diff(en.known).length === 0 && diff(ar.known).length === 0,
    JSON.stringify({ en: diff(en.known), ar: diff(ar.known) })],
  /* Save is supposed to write — this asserts the path really ran, so "nothing changed" cannot pass
     simply because the button was never found */
  ['Save really tried to store the record, and the attempt went no further than this test',
    en.odd.after.clicked && ar.odd.after.clicked && wrote.filter((w) => /businesses|save_state/.test(w)).length >= 2,
    JSON.stringify(wrote.filter((w) => !/finance_client_links/.test(w)).slice(0, 5))],
  /* the same box on the Airlines page */
  ['an airline whose type the box never heard of shows that type, not the first entry',
    !!en.air && en.air.shown && en.air.shown.value === 'GSSA / plating' && /on file/.test(en.air.shown.selectedText),
    JSON.stringify(en.air && en.air.shown)],
  ['and saving that airline does not turn a plating platform into a full-service carrier',
    !!en.air && en.air.typeAfter === 'GSSA / plating' && !!ar.air && ar.air.typeAfter === 'GSSA / plating',
    JSON.stringify({ en: en.air && en.air.typeAfter, ar: ar.air && ar.air.typeAfter })],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
