/* probe-settings-speaks-arabic-all-the-way-down.mjs — the Credit Pool dialog and the company
   registry read Arabic in Arabic, and the English side is untouched.

   Fire #243. Driven live in Arabic through every Settings sub-page. Two surfaces were half done:

     · the Commercial Credit Pool dialog read "POOL CAP (SAR)", an English placeholder and an
       English help sentence under an Arabic title — js/21 translates by exact text and knew the
       title and one label, nothing else. The card on Settings had the same fault one level up:
       its sub-line carries a number ("Cap currently 1,250,000 SAR. Calendar (Gregorian) month…"),
       so no exact-text list could ever have caught it;
     · the company registry (Generator → Company assets & registry) printed an English provenance
       line under every one of its 29 rows — "Official records", "Bank accounts sheet", "Company
       letterhead"… — the `source` column, which has no Arabic twin. Every row's LABEL was Arabic,
       which made the English lines stand out more, not less.

   The dialog and card choose their words in core-08 now. The registry gives its sixteen known
   source phrases their Arabic in js/66 — display only.

   What this holds:
     1. AR: the Credit Pool card's sub-line is Arabic and still carries the cap figure, and its
        buttons are Arabic. The sub-line is read through innerText, which returns hidden text:
        index.html hides every `.card .ch-sub` (line ~560), on the mock and live alike, so this
        asserts the words are translated, not that anyone sees them — the dialog is what people see;
     2. AR: the dialog's cap label, its reason placeholder and its help sentence are Arabic;
     3. EN brake: the dialog reads exactly as it did — "Pool cap (SAR)", "Why are you adjusting
        the cap?", "Calendar (Gregorian) month…" — nothing was translated that should not be;
     4. AR: a known source phrase on the registry reads Arabic;
     5. AR brake: a source phrase the list does not know still shows, in English — it does not
        vanish;
     6. EN brake: registry sources are untouched English;
     7. AR brake, the one that matters most: the row's EDITOR still holds the raw English source,
        so saving an edited row can never write the Arabic display word back over the stored value
        (M26's family — a display translation must not become a data change);
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), three real runs:
     · srcWord made to return its input — fails 4, the English line back under every Arabic label;
     · the dialog's language check forced to English — fails 2 alone, the card still right;
     · srcWord applied to the editor field as well — fails 7, the editor showing Arabic that a save
       would write to the database.
   Run: node scripts/qa/probe-settings-speaks-arabic-all-the-way-down.mjs                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9270 — one mock. */
const PORT = 9270; const BASE = 'http://localhost:' + PORT;

/* a synthetic registry — rule 7: no real number, IBAN or licence in this repository */
const reg = (key, label_en, label_ar, source, x) => Object.assign({
  key, category: 'legal', label_en, label_ar, value_en: 'QA-' + key, value_ar: '', expires_on: null, issued_on: null,
  source, sensitive: false, show_on_documents: false, sort: 10, updated_at: '2026-09-01T00:00:00Z', updated_by: null,
  proof_path: null, download_name: null,
}, x || {});
const KNOWN_A = 'Official records';
const KNOWN_B = 'Bank accounts sheet';
const UNKNOWN = 'QA9270 provenance nobody listed';
/* all three in the same section: a bank-category row is drawn in its own block with its own markup
   (IBANs are handled separately), and the first version of this probe lost it there */
const ROWS = [
  reg('qa_legal_name', 'QA legal name', 'الاسم القانوني للاختبار', KNOWN_A, { sort: 1 }),
  reg('qa_licence', 'QA licence', 'ترخيص الاختبار', KNOWN_B, { category: 'licence', sort: 2 }),
  reg('qa_odd', 'QA odd row', 'صف الاختبار الغريب', UNKNOWN, { sort: 3 }),
];

const srv = start(PORT, {
  app_state: [{ id: 1, data: { bookings: [], invoices: [], meta: { name: 'QA' }, schemaVersion: 3, settings: { commercialPool: { capSAR: 1250000 } } } }],
});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/company_identity' && m === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
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
  await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
  await p.waitForTimeout(4000);

  /* the Credit Pool card on Settings, then its dialog */
  await p.evaluate(() => { try { current = 'settings'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(2500);
  const card = await p.evaluate(() => {
    const c = document.querySelector('.v25-settings-pool'); if (!c) return null;
    return { sub: ((c.querySelector('.ch-sub') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
             buttons: [].slice.call(c.querySelectorAll('button')).map((x) => (x.innerText || '').trim()) };
  });
  await p.evaluate(() => { try { v25OpenPoolSettings(); } catch (_) {} });
  await p.waitForTimeout(1200);
  const dialog = await p.evaluate(() => {
    const m = document.getElementById('modal'); if (!m || !m.offsetHeight) return null;
    const cap = document.getElementById('v25PoolCap'); const reason = document.getElementById('v25PoolReason');
    const capLabel = cap && cap.parentNode ? ((cap.parentNode.querySelector('label') || {}).innerText || '').trim() : '';
    /* the SHORTEST div carrying the sentence is the help line itself; the first match is the whole
       dialog body, which also holds the labels — the first version of this check read that and
       called the English dialog wrong (the same trap as fire #230's tile labels) */
    const help = [].slice.call(m.querySelectorAll('div')).map((d) => (d.innerText || '').trim())
      .filter((t) => /billing period|فترة الفوترة/.test(t)).sort((a, b) => a.length - b.length)[0] || '';
    return { capLabel, placeholder: reason ? (reason.getAttribute('placeholder') || '') : '', help: help.replace(/\s+/g, ' ').slice(0, 160) };
  });
  await p.evaluate(() => { try { const x = document.querySelector('#modal .btn.ghost'); if (x) x.click(); } catch (_) {} });
  await p.waitForTimeout(500);

  /* the registry page */
  await p.evaluate(() => { try { current = 'documents'; openLead = null; if (typeof dgGo === 'function') dgGo('assets'); else render(); } catch (_) {} });
  await p.waitForFunction(() => document.querySelectorAll('#view .dg-src').length >= 3, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800);
  const sources = await p.evaluate(() => {
    const out = {};
    [].slice.call(document.querySelectorAll('#view tr')).forEach((tr) => {
      const key = (tr.querySelector('.dg-key') || {}).innerText || ''; const src = tr.querySelector('.dg-src');
      if (src) out[key.trim()] = (src.innerText || '').trim();
    });
    return out;
  });

  /* open the editor on a translated row and read the raw field */
  await p.evaluate(() => { try { dgEdit('qa_legal_name'); } catch (_) {} });
  await p.waitForTimeout(1500);
  const editorSrc = await p.evaluate(() => { const f = document.getElementById('dgE_src'); return f ? f.value : null; });

  await ctx.close();
  return { card, dialog, sources, editorSrc, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

const AR = /[؀-ۿ]/;
const noLatinSentence = (s) => !/[A-Za-z]{2,}\s+[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(String(s || '').replace(/\(SAR\)|SAR|CR\.pdf|D&B|DUNS|IATA|PCI DSS|SecurityMetrics|QA-?\w*/g, ''));

console.log('  two runs, AR then EN, with a synthetic three-row registry: two known source phrases and one nobody listed');

(ar.card && AR.test(ar.card.sub) && /\d/.test(ar.card.sub) && noLatinSentence(ar.card.sub) && ar.card.buttons.every((t) => AR.test(t)))
  ? pass('AR: the Credit Pool card\'s sub-line is Arabic, carries the cap figure, and its buttons are Arabic', JSON.stringify(ar.card.sub.slice(0, 60)))
  : fail('AR: the Credit Pool card\'s sub-line is Arabic, carries the cap figure, and its buttons are Arabic', JSON.stringify(ar.card));

(ar.dialog && AR.test(ar.dialog.capLabel) && AR.test(ar.dialog.placeholder) && AR.test(ar.dialog.help)
  && !/Pool cap|Why are you|Calendar \(Gregorian\)/i.test(ar.dialog.capLabel + ' ' + ar.dialog.placeholder + ' ' + ar.dialog.help))
  ? pass('AR: the dialog\'s cap label, reason placeholder and help sentence are Arabic', JSON.stringify(ar.dialog.capLabel))
  : fail('AR: the dialog\'s cap label, reason placeholder and help sentence are Arabic', JSON.stringify(ar.dialog));

(en.dialog && /^Pool cap \(SAR\)$/i.test(en.dialog.capLabel) && en.dialog.placeholder === 'Why are you adjusting the cap?' && /^Calendar \(Gregorian\) month is the billing period/.test(en.dialog.help))
  ? pass('EN brake: the dialog reads exactly as it did')
  : fail('EN brake: the dialog reads exactly as it did', JSON.stringify(en.dialog));

const arA = ar.sources['الاسم القانوني للاختبار']; const arB = ar.sources['ترخيص الاختبار'];
(arA && arB && AR.test(arA) && AR.test(arB) && arA !== KNOWN_A && arB !== KNOWN_B)
  ? pass('AR: a known source phrase on the registry reads Arabic', JSON.stringify([arA, arB]))
  : fail('AR: a known source phrase on the registry reads Arabic', JSON.stringify(ar.sources));

(ar.sources['صف الاختبار الغريب'] === UNKNOWN)
  ? pass('AR brake: a source phrase the list does not know still shows, in English — it does not vanish')
  : fail('AR brake: a source phrase the list does not know still shows, in English — it does not vanish', JSON.stringify(ar.sources));

(en.sources['QA legal name'] === KNOWN_A && en.sources['QA licence'] === KNOWN_B && en.sources['QA odd row'] === UNKNOWN)
  ? pass('EN brake: registry sources are untouched English')
  : fail('EN brake: registry sources are untouched English', JSON.stringify(en.sources));

(ar.editorSrc === KNOWN_A)
  ? pass('AR brake: the row\'s editor still holds the raw English source — a save can never write the display word back', JSON.stringify(ar.editorSrc))
  : fail('AR brake: the row\'s editor still holds the raw English source — a save can never write the display word back', JSON.stringify(ar.editorSrc));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
