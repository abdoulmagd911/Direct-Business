/* probe-the-ingest-form-says-what-it-read.mjs — a percentage is a claim about evidence.

   Fire #183. "Ingest invoice / booking / offer" was dressed as a document reader and read nothing
   but the file NAME. Driven against the live database:

     · every field label carried a colour-coded confidence percentage, and every one of them was a
       literal typed at the call site. With NO FILE AT ALL the invoice form showed nine — a green
       "Subtotal (pre-VAT) 94%" over an empty box, and "Status 100%" over an untouched dropdown;
     · "📋 Recognised: Amadeus IUR invoice template", and the document language printed beside it,
       came from matching a word in the file name;
     · and every booking saved through the form was stamped with a fraud score rolled from
       Math.random(). Round 65 had already found that exact line in the migration path and left a
       comment saying nothing here scores fraud; the creation path was missed.

   What this holds:
     1. no field label on any of the three forms carries a percentage;
     2. the form says once, in words, that nothing inside the file has been read;
     3. given a file whose name carries digits that reach the reference box, the reference is
        marked as taken from the file name;
     4. with NO file, that mark is absent — the reference is then just a fresh number;
     5. with a file whose name carries no digits, it is absent too;
     6. the file-name badge says the NAME looks like something, and prints no document language;
     7. a booking saved through the form carries a fraud score of 0, never a rolled one;
     8. the form is otherwise untouched — the fields are all still there and Save still works;
     9. in Arabic the sentence and the mark are Arabic;
    10. no JS errors.

   Checks 4 and 5 are the brakes: a "taken from the file name" mark that always appears is the same
   untruth in a smaller font. Check 8 is the third: stripping the percentages must not have taken
   any of the form with it.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the
   confidence pill back fails check 1; dropping js/97 fails 2, 3 and 9; restoring the random fraud
   score fails 7.
   Run: node scripts/qa/probe-the-ingest-form-says-what-it-read.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9171; const BASE = 'http://localhost:' + PORT;

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'contacted', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: null, created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: null, needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const srv = start(PORT, { businesses: [row({ id: 'i1', legacy_id: 'I1', name: 'QA Ingest Probe Co' })], contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/bookings', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
await p.waitForTimeout(2500);

const open = (kind, fname) => p.evaluate(([k, f]) => {
  try { closeModal(); } catch (_) {}
  try { ingestModal(k, f, function () {}); } catch (e) { return { err: e.message }; }
  return new Promise((res) => setTimeout(() => {
    const m = document.getElementById('modal');
    const body = m.querySelector('.mb') || m;
    const labels = [].slice.call(body.querySelectorAll('label')).map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim());
    return res({
      labels,
      pctLabels: labels.filter((s) => /\d+\s*%/.test(s)),
      said: [].slice.call(body.querySelectorAll('[data-v97-said]')).map((x) => (x.textContent || '').trim()),
      fromName: [].slice.call(body.querySelectorAll('[data-v97-from]')).map((x) => (x.textContent || '').trim()),
      badge: ((body.querySelector('.template-badge') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      fields: body.querySelectorAll('input,select,textarea').length,
      hasSave: !!document.getElementById('mSave'),
    });
  }, 900));
}, [kind, fname]);

const bkNoFile = await open('booking', '');
const bkFile = await open('booking', 'Amadeus-ticket-5471.pdf');
const bkNoDigits = await open('booking', 'scan-from-the-desk.pdf');
const inv = await open('invoice', '');
const off = await open('offer', '');

/* a booking actually saved through the form */
const saved = await p.evaluate(() => {
  try { closeModal(); } catch (_) {}
  try { DB.bookings = []; ingestModal('booking', '', function () {}); } catch (e) { return { err: e.message }; }
  return new Promise((res) => setTimeout(() => {
    try {
      document.getElementById('ig_air').value = 'QA Air';
      document.getElementById('ig_pnr').value = 'QA1234';
      document.getElementById('mSave').click();
    } catch (e) { return res({ err: e.message }); }
    setTimeout(() => {
      const bk = (DB.bookings || [])[0];
      const t = bk && (bk.tickets || [])[0];
      res({ made: !!bk, fraud: t ? t.fraudScore : '(no ticket)' });
    }, 900);
  }, 900));
});

const arabic = await p.evaluate(() => {
  try { closeModal(); LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    try { ingestModal('booking', 'Amadeus-ticket-5471.pdf', function () {}); } catch (e) { return res({ err: e.message }); }
    setTimeout(() => {
      const body = document.getElementById('modal').querySelector('.mb');
      res({ said: [].slice.call(body.querySelectorAll('[data-v97-said]')).map((x) => (x.textContent || '').trim()),
        fromName: [].slice.call(body.querySelectorAll('[data-v97-from]')).map((x) => (x.textContent || '').trim()),
        badge: ((body.querySelector('.template-badge') || {}).textContent || '').trim() });
    }, 900);
  }, 800));
});
await b.close(); srv.close?.();

const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const allPct = [].concat(bkNoFile.pctLabels || [], bkFile.pctLabels || [], inv.pctLabels || [], off.pctLabels || []);
const said = (f) => (f.said || []).length === 1 && /nothing inside it has been read/i.test(f.said[0]);

const checks = [
  ['no field label on any of the three forms carries a percentage', allPct.length === 0,
    allPct.slice(0, 3).join(' | ')],
  ['the form says once that nothing inside the file has been read',
    said(bkNoFile) && said(bkFile) && said(inv) && said(off),
    (bkNoFile.said || [])[0] ? (bkNoFile.said[0].slice(0, 60) + '…') : '(nothing said)'],
  ['a reference whose digits came from the file name says so',
    (bkFile.fromName || []).length === 1 && /file name/i.test(bkFile.fromName[0]),
    JSON.stringify(bkFile.fromName)],
  ['with no file that mark is absent', (bkNoFile.fromName || []).length === 0,
    JSON.stringify(bkNoFile.fromName)],
  ['with a file name carrying no digits it is absent too', (bkNoDigits.fromName || []).length === 0,
    JSON.stringify(bkNoDigits.fromName)],
  ['the badge says the NAME looks like something, and names no document language',
    /looks like/i.test(bkFile.badge) && !/recognis|recogniz/i.test(bkFile.badge) && !/\bLang\b/i.test(bkFile.badge) && !bkNoFile.badge,
    JSON.stringify(bkFile.badge)],
  ['a booking saved through the form carries a fraud score of 0', saved.made === true && saved.fraud === 0,
    JSON.stringify(saved)],
  ['the form is otherwise untouched — fields all present, Save still there',
    bkNoFile.fields === 14 && inv.fields === 9 && off.fields === 4 && bkNoFile.hasSave && inv.hasSave,
    JSON.stringify({ booking: bkNoFile.fields, invoice: inv.fields, offer: off.fields })],
  ['in Arabic the sentence and the mark are Arabic',
    (arabic.said || []).length === 1 && hasArabic(arabic.said[0]) && !/nothing inside/i.test(arabic.said[0]) &&
    (arabic.fromName || []).length === 1 && hasArabic(arabic.fromName[0]) && !/file name/i.test(arabic.fromName[0]),
    JSON.stringify(arabic).slice(0, 120)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
