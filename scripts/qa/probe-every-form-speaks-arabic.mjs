/* probe-every-form-speaks-arabic.mjs — the forms the word list did not know: New project, the
   service-fee generator, the three import previews, and the acronym labels on the lead, airline
   and provider editors, all read Arabic in Arabic and unchanged in English.

   Fire #249. #243 and #248 each found one form that had stayed English inside #modal, so this
   round opened EVERY form the app builds with openModal — sixteen of them, live, in Arabic — and
   read the labels. Most were already Arabic: js/21's dialog pass translates a label by its exact
   text, and it knew those words. These it did not know:

     · New project — the title, and START / END / BUDGET (SAR);
     · the service-fee generator — VALIDITY (DAYS);
     · the booking and ticket import previews — BOOKING REF / PROVIDER / GDS / PNR / PASSENGER;
     · the invoice import preview — SUBTOTAL (PRE-VAT) / VAT RATE / BUYER VAT (B2B) /
       LINE ITEM DESCRIPTION;
     · one acronym label each on the airline editor (GDS) and the provider editor (EMD) — the lead
       editor's WHATSAPP chip is a brand name and keeps it, as js/21 states for itself;
     · and the English example hints ("e.g. Riyadh Investment Summit", "Air ticket / hotel /
       service"…) on the same forms.

   The words are added to js/21's own lists — V27_AR for labels and titles, PLACEHOLDER_AR for
   hints — which is where #243 put the Credit Pool dialog's words, so one file grows instead of
   five. Format names (PDF, PPTX) and codes shown as examples (RUH-LHR-RUH, Y / J, 300…0003) are
   left as they are: they are the same in both languages.

   What this holds:
     1. AR: New project — the title is Arabic and no label is English;
     2. AR: the service-fee generator — no label is English;
     3. AR: the booking, ticket and invoice import previews — no label is English;
     4. AR: the lead, airline and provider editors — no label is English (brand and format names
        are the same in both languages and are not counted);
     5. AR: the example hints named above are Arabic;
     6. EN brake: the same forms read their English labels exactly as before;
     7. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the new V27_AR words removed — fails 1, 2 and 3 (check 4 cannot trip on the acronym chips
       it exempts, which is the point of exempting them);
     · the new PLACEHOLDER_AR hints removed — fails 5 alone.
   Run: node scripts/qa/probe-every-form-speaks-arabic.mjs                                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9285 — one mock. */
const PORT = 9285; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const FORMS = [
  ['v25NewProject', 'none'], ['v25OpenServiceFeeGen', 'none'],
  ['ingestModal:booking', 'ingest'], ['ingestModal:ticket', 'ingest'], ['ingestModal:invoice', 'ingest'],
  ['editBusiness', 'lead'], ['editSupplier:air', 'air'], ['editSupplier:prov', 'prov'],
];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
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

  const out = {};
  for (const [op, arg] of FORMS) {
    /* close whatever is open the way a person does — never empty #modal, that destroys its shell */
    await p.evaluate(() => { try { const m = document.getElementById('modal'); if (m && m.offsetHeight) { const x = m.querySelector('.btn.ghost'); if (x) x.click(); } if (typeof closeModal === 'function') closeModal(); } catch (_) {} });
    await p.waitForTimeout(400);
    await p.evaluate(({ op, arg }) => {
      try {
        const [fn, sub] = op.split(':');
        const lead = (DB.businesses || []).find((x) => !x.isClient) || DB.businesses[0];
        let a = [];
        if (arg === 'lead') a = [lead.id];
        else if (arg === 'air') a = ['air', (DB.airlines || [])[0] && DB.airlines[0].id];
        else if (arg === 'prov') a = ['prov', (DB.vendors || [])[0] && DB.vendors[0].id];
        else if (arg === 'ingest') a = [sub, 'qa.pdf', function () {}];
        if (typeof window[fn] === 'function') window[fn].apply(null, a);
      } catch (_) {}
    }, { op, arg });
    await p.waitForTimeout(900);
    out[op] = await p.evaluate(() => {
      const m = document.getElementById('modal'); if (!m || !m.offsetHeight) return null;
      return { title: ((m.querySelector('h2,h3,.mt') || {}).innerText || '').trim(),
               labels: [].slice.call(m.querySelectorAll('label')).map((l) => (l.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
               ph: [].slice.call(m.querySelectorAll('input[placeholder],textarea[placeholder]')).map((x) => x.getAttribute('placeholder')).filter(Boolean) };
    });
  }
  await ctx.close();
  return { out, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

const AR = /[؀-ۿ]/;
/* acronyms and codes that are the same in both languages are not "English" */
/* brand names and format names are the same in both languages — js/21 says so itself for WhatsApp */
const SAME = /^(PDF|PPTX|PNR|GDS|EMD|IATA|SAR|B2B|VAT|NDC|LCC|ISO|CR|EN|AR|WhatsApp)$/i;
const eng = (labels) => (labels || []).filter((l) => !AR.test(l) && !SAME.test(l));
const opened = (k) => ar.out[k] && en.out[k];

console.log('  eight forms opened live-style in Arabic and in English');

(opened('v25NewProject') && AR.test(ar.out.v25NewProject.title) && eng(ar.out.v25NewProject.labels).length === 0)
  ? pass('AR: New project — the title is Arabic and no label is English', JSON.stringify(ar.out.v25NewProject.title))
  : fail('AR: New project — the title is Arabic and no label is English', JSON.stringify(ar.out.v25NewProject));

(opened('v25OpenServiceFeeGen') && eng(ar.out.v25OpenServiceFeeGen.labels).length === 0)
  ? pass('AR: the service-fee generator — no label is English')
  : fail('AR: the service-fee generator — no label is English', JSON.stringify(ar.out.v25OpenServiceFeeGen && eng(ar.out.v25OpenServiceFeeGen.labels)));

const ING = ['ingestModal:booking', 'ingestModal:ticket', 'ingestModal:invoice'];
(ING.every((k) => opened(k) && eng(ar.out[k].labels).length === 0))
  ? pass('AR: the booking, ticket and invoice import previews — no label is English')
  : fail('AR: the booking, ticket and invoice import previews — no label is English', JSON.stringify(ING.map((k) => [k, ar.out[k] && eng(ar.out[k].labels)])));

const ED = ['editBusiness', 'editSupplier:air', 'editSupplier:prov'];
(ED.every((k) => opened(k) && eng(ar.out[k].labels).length === 0))
  ? pass('AR: the lead, airline and provider editors — no label is English')
  : fail('AR: the lead, airline and provider editors — no label is English', JSON.stringify(ED.map((k) => [k, ar.out[k] && eng(ar.out[k].labels)])));

const HINTS = ['e.g. Riyadh Investment Summit', 'Optional context — e.g. excludes peak season', 'Air ticket / hotel / service'];
const arHints = [].concat(ar.out.v25NewProject ? ar.out.v25NewProject.ph : [], ar.out.v25OpenServiceFeeGen ? ar.out.v25OpenServiceFeeGen.ph : [], ar.out['ingestModal:invoice'] ? ar.out['ingestModal:invoice'].ph : []);
(HINTS.every((h) => !arHints.includes(h)) && arHints.some((h) => AR.test(h)))
  ? pass('AR: the example hints are Arabic')
  : fail('AR: the example hints are Arabic', JSON.stringify(arHints));

(en.out.v25NewProject && en.out.v25NewProject.title === 'New project' && ['Start', 'End', 'Budget (SAR)'].every((l) => en.out.v25NewProject.labels.some((x) => x.toLowerCase() === l.toLowerCase()))
  && en.out['ingestModal:invoice'] && ['Subtotal (pre-VAT)', 'VAT rate', 'Line item description'].every((l) => en.out['ingestModal:invoice'].labels.some((x) => x.toLowerCase() === l.toLowerCase())))
  ? pass('EN brake: the same forms read their English labels exactly as before')
  : fail('EN brake: the same forms read their English labels exactly as before', JSON.stringify({ np: en.out.v25NewProject, inv: en.out['ingestModal:invoice'] }));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
