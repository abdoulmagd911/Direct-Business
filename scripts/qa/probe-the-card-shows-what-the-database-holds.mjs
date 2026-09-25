/* probe-the-card-shows-what-the-database-holds.mjs — the Corporate account card, and the round trip
   back out of it.

   Found live on 2026-09-21 (fire #149), one round after the CR/VAT half of the same defect. The
   client handover fields are WRITTEN to their own columns by appToRow and most of them were never
   read back, so a company that received them any way other than by being typed into this app — a
   SQL update, the August import — showed a dash on its own card over a value the database is
   holding. Counted live in `businesses` the same day:

     · payment_terms  — 20 companies carry it in the column with nothing in the raw blob;
     · contract_start and contract_end — 19 each;
     · credit_limit — 8;  entity_type — 1.

   Twenty clients, every one of them showing "Payment terms —" over an answer that was right there.

   Reading a column back brings its own trap, and it is the second half of this probe: the writer
   only ever SET these columns and never cleared one, so once the reader prefers the column, a value
   you DELETE in the form comes back on the next reload — the column still holds it. A field you
   cannot empty is worse than a field that was never shown.

   What this holds:
     1. a company whose handover facts are in the COLUMNS ONLY shows them on its card — payment
        terms, both contract dates, the entity type;
     2. the raw blob still WINS where both exist, so nothing that worked before changes;
     3. deleting a value in the form actually clears the column in the database;
     4. and a fresh load of the app then shows it empty — the round trip a person would see;
     5. a value typed into the form reaches its column, not only the raw blob;
     6. the neighbours are untouched by that save — clearing one field must not null the rest.

   Checks 3 and 6 are the pair that keeps the fix honest: the cheap way to pass 3 is to write null
   for everything, which would quietly empty twenty companies' columns on their next save.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched). Removing the
   column fallbacks from rowToApp fails checks 1 and 7, and check 7 is the interesting one: with the
   reader gone and the writer still nulling, the save WIPED both contract dates — which is exactly
   why the two halves belong in the same change. Putting back the old `if(value)` writer in
   appToRow fails checks 4 and 5, and check 5 prints the deleted value back on the card.
   2026-09-25 — made reliable: it went red on two crowded battery runs (checks 4–5, the stored row
   still held the old payment terms) after a fixed 2.5 s wait. The edit pass now waits until the
   page's company saves have actually landed and gone quiet; a red run prints what the form held at
   Save and every write sent for the company, so the cause is visible rather than guessed.
   Run: node scripts/qa/probe-the-card-shows-what-the-database-holds.mjs                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9103; const BASE = 'http://localhost:' + PORT;

const TERMS_COL = 'Net 45 from the column';
const TERMS_RAW = 'Pre-paid from the raw blob';
const START = '2026-04-01', END = '2027-03-31';
const ENTITY = 'Government entity';
const SCOPE_COL = 'Air and hotel from the column';
const SCOPE_TYPED = 'Air, hotel, transfer — typed in the form';
const CR = '300111222333004';

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'won', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: true, converted_date: '2026-03-01', direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '', created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: 'manual', needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const BUSINESSES = [
  /* e1 — the live shape: everything in the columns, an empty raw blob */
  row({ id: 'e1', legacy_id: 'E1', name: 'QA Column Only Client', entity_type: ENTITY,
    payment_terms: TERMS_COL, credit_limit: 77000, contract_start: START, contract_end: END,
    contract_scope: SCOPE_COL, contract_sla: 'Quote within 2h' }),
  /* e2 — both places disagree on purpose: the raw blob must still win */
  row({ id: 'e2', legacy_id: 'E2', name: 'QA Both Places Client', payment_terms: TERMS_COL,
    raw: { paymentTerms: TERMS_RAW } }),
  /* e3 — the one the probe edits: a value to delete, and neighbours that must survive it */
  row({ id: 'e3', legacy_id: 'E3', name: 'QA Round Trip Client', payment_terms: TERMS_COL,
    cr_vat: CR, contract_start: START, contract_end: END, raw: { paymentTerms: TERMS_COL } }),
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

/* read a stored row straight out of the mock, which is the closest this harness gets to asking the
   database what it actually holds after a save */
const stored = async (legacy) => {
  const r = await fetch(BASE + '/rest/v1/businesses?legacy_id=eq.' + legacy);
  const j = await r.json();
  return Array.isArray(j) ? j[0] : j;
};

async function open(lang, edit) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.accept());
  let inFlight = 0, lastWriteAt = 0;
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    /* 2026-09-25: every company write is counted in and out, and its payment terms noted, so the
       edit pass can wait until the page's saves have REALLY landed (see below) and a red run can say
       what was sent */
    const isBizWrite = /\/rest\/v1\/businesses/.test(u.pathname) && m !== 'GET';
    if (isBizWrite) { inFlight++; try { const bd = JSON.parse(rq.postData() || 'null'); (Array.isArray(bd) ? bd : [bd]).forEach((x) => { if (x && (x.legacy_id === 'E3' || x.id === 'e3')) SENT.push({ pass: lang + (edit ? '-edit' : ''), payment_terms: x.payment_terms, contract_scope: x.contract_scope }); }); } catch (_) { } }
    const done = () => { if (isBizWrite) { inFlight--; lastWriteAt = Date.now(); } };
    /* company writes are LET THROUGH here — the mock persists them, and the round trip is the
       whole point of this probe. Only the app_state blob is stubbed. */
    if (/save_state/.test(u.pathname)) { await r.fulfill({ status: 200, contentType: 'application/json', body: '""' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      done(); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { done(); await r.fulfill({ status: 500, body: '{}' }).catch(() => { }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const card = async (id) => {
    await p.evaluate((i) => { try { current = 'leads'; openLead = i; render(); } catch (_) { } }, id);
    await p.waitForTimeout(1000);
    return p.evaluate(() => { const v = document.getElementById('view'); return (v ? (v.innerText || '') : '').replace(/\s+/g, ' '); });
  };
  const out = { e1: await card('E1'), e2: await card('E2'), e3: await card('E3') };
  if (edit) {
    /* delete the payment terms and type a contract scope, through the real form */
    await p.evaluate(() => { try { editCorporate('E3'); } catch (_) { } });
    await p.waitForSelector('#c_pt', { timeout: 30000 });
    /* 2026-09-25: on crowded runs the form was found still holding the old payment terms at Save —
       the clear had not taken (diagnosed by recording the form at Save and every write: one write,
       carrying the old value; no rebuild of the form, no change to the box ever observed). So the
       edit is typed, read back, and typed again until the form really holds it (up to 5 tries),
       and the number of retries is printed — the precondition of this test is "the person
       cleared the box", and it is now checked rather than assumed. */
    let refills = 0;
    for (;;) {
      await p.fill('#c_pt', '');
      await p.fill('#c_scope', SCOPE_TYPED);
      const f = await p.evaluate(() => ({ pt: (document.getElementById('c_pt') || {}).value, scope: (document.getElementById('c_scope') || {}).value }));
      if ((f.pt === '' && f.scope === SCOPE_TYPED) || refills >= 4) break;
      refills++; await p.waitForTimeout(300);
    }
    FORM = await p.evaluate(() => ({ pt: (document.getElementById('c_pt') || {}).value, scope: (document.getElementById('c_scope') || {}).value }));
    FORM.refills = refills;
    await p.click('#mSave');
    /* 2026-09-25 — made reliable. This used to wait a fixed 2.5 s and close: on crowded battery runs
       (twice) the check read the stored row before the page's save had landed. Now: wait until a
       save for this company has been sent, then until no company write is in flight and none has
       finished for 1.5 s (up to 30 s). The checks below are unchanged. */
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      await p.waitForTimeout(250);
      const sentEdit = SENT.some((x) => x.pass === lang + '-edit');
      if (sentEdit && inFlight === 0 && Date.now() - lastWriteAt > 1500) break;
    }
  }
  await ctx.close();
  return out;
}

const SENT = []; let FORM = null;
const before = await open('en', false);
const storedBefore = await stored('E3');
await open('en', true);
const storedAfter = await stored('E3');
const after = await open('en', false);
await b.close(); srv.close?.();

const hasAll = (t, vals) => vals.every((v) => t.indexOf(v) >= 0);
const checks = [
  ['a company whose handover facts are in the COLUMNS ONLY shows them on its card',
    hasAll(before.e1, [TERMS_COL, START, END, ENTITY]),
    (before.e1.match(/Payment terms[^|]{0,40}/) || [''])[0] + ' / ' + (before.e1.match(/Contract[^|]{0,40}/) || [''])[0]],
  ['the raw blob still WINS where both places disagree — nothing that worked before changes',
    before.e2.indexOf(TERMS_RAW) >= 0 && before.e2.indexOf(TERMS_COL) < 0,
    (before.e2.match(/Payment terms[^|]{0,50}/) || [''])[0]],
  ['the value was really there to begin with, or check 3 proves nothing',
    (storedBefore || {}).payment_terms === TERMS_COL, JSON.stringify((storedBefore || {}).payment_terms)],
  ['deleting it in the form CLEARS the column in the database',
    storedAfter && (storedAfter.payment_terms === null || storedAfter.payment_terms === ''),
    JSON.stringify((storedAfter || {}).payment_terms) + ' · the form held ' + JSON.stringify(FORM) + ' at Save · writes for this company: ' + JSON.stringify(SENT)],
  ['and a fresh load of the app shows it empty — the round trip a person would see',
    after.e3.indexOf(TERMS_COL) < 0, (after.e3.match(/Payment terms[^|]{0,50}/) || [''])[0]],
  ['a value typed into the form reaches its column, not only the raw blob',
    (storedAfter || {}).contract_scope === SCOPE_TYPED, JSON.stringify((storedAfter || {}).contract_scope)],
  ['the neighbours survived that save — clearing one field must not null the rest',
    storedAfter && storedAfter.cr_vat === CR && String(storedAfter.contract_start).slice(0, 10) === START
      && String(storedAfter.contract_end).slice(0, 10) === END,
    JSON.stringify({ cr: (storedAfter || {}).cr_vat, s: (storedAfter || {}).contract_start, e: (storedAfter || {}).contract_end })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
