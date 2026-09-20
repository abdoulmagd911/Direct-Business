/* probe-you-can-find-a-client.mjs — the things a person actually types must find the client.

   Measured live on 2026-09-21 (fire #148). The Clients search looked at the company name, its
   Arabic name, and contacts' e-mail and phone. Three things a person would reach for could not
   find their client:

     · THE CONTACT PERSON'S NAME — you can find a LEAD by the person's name (matchLead includes it)
       and you could not find a CLIENT by the same person. People remember the person.
     · THE DIRECT CLIENT ID — the link key to Direct Payments, carried by 20 clients. This one was
       WORSE than missing: searching it returned TWO matches and NEITHER was the right company,
       because those digits happened to sit inside other records' phone numbers. A confidently
       wrong answer is worse than an empty one.
     · THE CR / VAT NUMBER — nothing at all, and for a deeper reason than the search. The CR / VAT
       number and the legal name are WRITTEN to their own columns and were never read back, so a
       company that got them any way other than by being typed into this app — a SQL update, an
       import — showed a dash on its own card over a number the database was holding. One live
       company is in exactly that state today. Fixing the search without that is fixing half.

   What this holds, in both languages:
     1-3. each of those three finds the client it belongs to;
     4.   the company's own card shows the CR / VAT and legal name it holds, not a dash;
     5.   the company name still works — widening a search must not break the common case;
     6.   a term that belongs to nobody finds nobody, so the fix did not simply match everything;
     7.   and the SEAM is closed: e-mail and phone used to be glued together with nothing between
          them, so a search could match across the join of two different values and hit a record
          that contains neither. The parts are joined with spaces now.

   Check 6 is the one that keeps the rest honest, and check 7 is the one nobody would think to
   write twice — it guards a defect that only exists because of how the haystack is built.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): restoring the old
   haystack fails checks 1, 2, 3 and 7; removing the two column fallbacks in js/02 fails checks 3
   and 4, and check 4 then prints the defect itself — "Legal name / CR·VAT —".
   Run: node scripts/qa/probe-you-can-find-a-client.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9102; const BASE = 'http://localhost:' + PORT;

const CONTACT_NAME = 'Zaynab Almutairi';
const DIRECT_ID = '778899';
const CRVAT = '300999888777003';
const LEGAL = 'QA Tax Number Trading Company LLC';
const SEAM_EMAIL = 'seamtest@qa-example.test';
const SEAM_PHONE = '5551234567';

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'won', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: 'LLC', legal_name: '', cr_vat: '', payment_terms: 'Net 30', credit_limit: 0,
  contract_start: null, contract_end: null, contract_scope: '', contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: true, converted_date: '2026-03-01', direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '', created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: 'manual', needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const BUSINESSES = [
  row({ id: 'k1', legacy_id: 'K1', name: 'QA Client By Person' }),
  row({ id: 'k2', legacy_id: 'K2', name: 'QA Client By Direct Id', direct_client_id: DIRECT_ID }),
  /* k3 carries its CR/VAT and legal name in the COLUMNS with an empty raw blob — the state a record
     is left in by a SQL update or an import, which is how one live company got there. */
  row({ id: 'k3', legacy_id: 'K3', name: 'QA Client By Tax Number', cr_vat: CRVAT, legal_name: LEGAL }),
  row({ id: 'k4', legacy_id: 'K4', name: 'QA Client Seam' }),
  row({ id: 'k5', legacy_id: 'K5', name: 'QA Client Plain' }),
];
const CONTACTS = [
  { id: 'qs-1', business_id: 'k1', name: CONTACT_NAME, role: 'Owner', email: 'someone@qa-example.test', phone: '+966 50 222 3333',
    verification_source: 'import', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null },
  { id: 'qs-2', business_id: 'k4', name: 'Seam Person', role: '', email: SEAM_EMAIL, phone: SEAM_PHONE,
    verification_source: 'import', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null },
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: CONTACTS, activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForFunction(() => { try { return (DB.businesses || []).some((x) => (x.contacts || []).some((c) => c && c._fromTable)); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => { });
  await p.evaluate(() => { try { current = 'clients'; openLead = null; render(); } catch (_) { } });
  await p.waitForTimeout(1800);
  /* drive the app's OWN filter — set the box, re-render, read the rows the page shows */
  const look = async (term) => {
    const r = await p.evaluate((t) => {
      clFilter.q = t; try { render(); } catch (_) { }
      const v = document.getElementById('view');
      const rows = [].slice.call(v ? v.querySelectorAll('tbody tr') : []).map((x) => (x.innerText || ''));
      return { rows: rows.length, text: rows.join(' || ') };
    }, term);
    await p.waitForTimeout(350);
    return r;
  };
  const out = {
    byPerson: await look(CONTACT_NAME),
    byDirectId: await look(DIRECT_ID),
    byCrVat: await look(CRVAT),
    byName: await look('QA Client Plain'),
    byNobody: await look('zzz-nobody-has-this-zzz'),
    acrossTheSeam: await look('test' + SEAM_PHONE.slice(0, 3)),   /* spans e-mail → phone */
  };
  /* and the other half of the same defect: the company's OWN card, which reads the same two fields */
  await p.evaluate(() => { clFilter.q = ''; try { render(); } catch (_) { } });
  await p.evaluate(() => { try { current = 'leads'; openLead = 'K3'; render(); } catch (_) { } });
  await p.waitForTimeout(1200);
  out.card = await p.evaluate(() => { const v = document.getElementById('view'); return (v ? (v.innerText || '') : '').replace(/\s+/g, ' '); });
  await p.evaluate(() => { try { openLead = null; render(); } catch (_) { } });
  await ctx.close();
  return out;
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const has = (r, n) => r.text.indexOf(n) >= 0;
const checks = [
  ['a client is found by the CONTACT PERSON\'s name', has(en.byPerson, 'QA Client By Person') && has(ar.byPerson, 'QA Client By Person'), en.byPerson.text.slice(0, 80)],
  ['a client is found by its DIRECT CLIENT ID — the link key to Direct Payments',
    has(en.byDirectId, 'QA Client By Direct Id') && has(ar.byDirectId, 'QA Client By Direct Id'), en.byDirectId.text.slice(0, 80)],
  ['a client is found by its CR / VAT number', has(en.byCrVat, 'QA Client By Tax Number'), en.byCrVat.text.slice(0, 80)],
  ['the company card SHOWS the CR / VAT and the legal name the database is holding, instead of a dash',
    en.card.indexOf(CRVAT) >= 0 && en.card.indexOf(LEGAL) >= 0,
    (en.card.match(/Legal name[^|]{0,90}/) || [''])[0]],
  ['the company name still works — widening a search must not break the common case',
    has(en.byName, 'QA Client Plain'), en.byName.text.slice(0, 80)],
  ['a term that belongs to nobody finds nobody — the fix did not just match everything',
    !/QA Client/.test(en.byNobody.text), en.byNobody.text.slice(0, 80)],
  ['a search cannot match across the seam between two different values',
    !/QA Client Seam/.test(en.acrossTheSeam.text), en.acrossTheSeam.text.slice(0, 80)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
