/* probe-a-person-says-where-they-came-from.mjs — a warning that lives in a hover is not a warning.

   Fire #177. Fire #151 surfaced three fields on the COMPANY record — where it came from, whether it
   needs confirming, and why. The people table carries the same three, and they had never been
   carried across.

   Counted live: of the 45 contacts, **10 carry a verification source** — the same sentence the
   companies carry, "Contact-form submission, classified with the owner 2026-08-16" — and **2 are
   flagged with a reason** (a possible duplicate left behind by a company merge).

   What was on screen before:
     · the provenance sentence — NOTHING. js/72 never asked the database for the column, so ten
       people whose record was already vetted with the owner looked like a name typed in yesterday;
     · the reason — a `title` tooltip on a small amber badge, which is invisible on a phone,
       invisible to anyone not hovering, and invisible in print.

   What this holds, on a company card:
     1. a flagged person's reason is in the page's own words, not only in a hover;
     2. and it is marked as something to do before using the details;
     3. a person with a verification source shows where the record came from;
     4. a person with neither gets NO line — the card does not fill with notes about everybody;
     5. the amber badge and its tooltip are still there — this adds, it does not replace;
     6. the lines attach to the right person, not to the first row;
     7. a share-link holder sees none of it (M28/M29 — our own notes about a third party);
     8. in Arabic the labels are Arabic — the stored reason stays as written, because translating a
        recorded judgement would be inventing it;
     9. no JS errors.

   Checks 4, 5 and 7 are the brakes: writing a line under every contact, or replacing the badge,
   would pass the rest and make the card worse.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/95's
   script line fails checks 1, 2, 3, 6 and 8.
   Run: node scripts/qa/probe-a-person-says-where-they-came-from.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9156; const BASE = 'http://localhost:' + PORT;
const TOKEN = 'qa-people-note-token-0123456789ab';

const SOURCE = 'Contact-form submission, classified with the owner 2026-08-16';
const REASON = 'Possible duplicate of another contact after a company merge — confirm which record to keep.';

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

const BID = 'p1000000-0000-4000-8000-000000000001';
const BUSINESSES = [row({ id: BID, legacy_id: 'P1', name: 'QA People Company' })];
/* deliberately: PLAIN first, so a layer that writes under "the first row" fails check 6 */
const CONTACTS = [
  { id: 'ct1', business_id: BID, name: 'QA Plain Person', role: 'Ops', email: 'plain@qa.test', phone: '+966500000001',
    needs_manual_confirmation: false, confirmation_reason: null, verification_source: null },
  { id: 'ct2', business_id: BID, name: 'QA Flagged Person', role: 'Finance', email: 'flag@qa.test', phone: '+966500000002',
    needs_manual_confirmation: true, confirmation_reason: REASON, verification_source: null },
  { id: 'ct3', business_id: BID, name: 'QA Sourced Person', role: 'Owner', email: 'src@qa.test', phone: '+966500000003',
    needs_manual_confirmation: false, confirmation_reason: null, verification_source: SOURCE },
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: CONTACTS, activities: [],
  share_links: [{ token: TOKEN, scope: 'all', active: true, created_by: 'u-qa', created_at: new Date().toISOString(), last_used_at: null }] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function look(asShareLink) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push((asShareLink ? 'share' : 'signed-in') + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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

  if (asShareLink) {
    await p.goto(BASE + '/s/' + TOKEN + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => document.body.getAttribute('data-share') === '1' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 60000 });
  } else {
    await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('#cl_email', { timeout: 60000 });
    await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
    /* js/72 brings the people across on its own timer — wait for them */
    await p.waitForFunction(() => { try { const x = getLead('P1'); return !!(x && x.contacts && x.contacts.length >= 3); } catch (_) { return false; } }, { timeout: 60000 }).catch(() => {});
  }
  await p.waitForTimeout(3000);
  const read = async () => {
    await p.evaluate(() => { try { current = 'leads'; openLead = 'P1'; render(); } catch (_) { } });
    await p.waitForTimeout(2600);
    return p.evaluate(() => {
      const v = document.getElementById('view');
      const rows = [].slice.call(v.querySelectorAll('.contact-row'));
      return { rows: rows.length,
        perRow: rows.map((r) => ({ who: (r.textContent || '').replace(/\s+/g, ' ').slice(0, 30),
          notes: [].slice.call(r.querySelectorAll('.v95-note')).map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()) })),
        badges: v.querySelectorAll('.v72-confirm').length,
        badgeTitle: (v.querySelector('.v72-confirm') || {}).title || '',
        total: v.querySelectorAll('.v95-note').length };
    });
  };
  const out = await read();
  let arabic = null;
  if (!asShareLink) {
    await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) { } });
    arabic = await read();
  }
  await ctx.close();
  return { out, arabic };
}

const staff = await look(false);
const guest = await look(true);
await b.close(); srv.close?.();

const S = staff.out;
const rowOf = (re) => S.perRow.find((r) => re.test(r.who)) || { notes: [] };
const flagged = rowOf(/QA Flagged/), sourced = rowOf(/QA Sourced/), plain = rowOf(/QA Plain/);
const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const arNotes = staff.arabic ? staff.arabic.perRow.flatMap((r) => r.notes) : [];

const checks = [
  ['a flagged person\'s reason is in the page\'s own words, not only in a hover',
    flagged.notes.some((n) => n.indexOf('confirm which record to keep') >= 0),
    JSON.stringify(flagged.notes).slice(0, 120)],
  ['and it is marked as something to do before using the details',
    flagged.notes.some((n) => /Confirm this person before using the details/i.test(n)), String(flagged.notes.length)],
  ['a person with a verification source shows where the record came from',
    sourced.notes.some((n) => n.indexOf('classified with the owner') >= 0), JSON.stringify(sourced.notes).slice(0, 110)],
  ['a person with neither gets no line', plain.notes.length === 0, JSON.stringify(plain.notes)],
  ['the amber badge and its tooltip are still there',
    S.badges >= 1 && /confirm which record to keep/i.test(S.badgeTitle),
    JSON.stringify({ badges: S.badges, title: S.badgeTitle.slice(0, 40) })],
  ['the lines attach to the right person', flagged.notes.length === 1 && sourced.notes.length === 1 && S.total === 2,
    JSON.stringify(S.perRow.map((r) => r.who.slice(0, 16) + '=' + r.notes.length))],
  ['a share-link holder sees none of it', guest.out.total === 0, String(guest.out.total)],
  /* the LABELS must translate; the stored reason is a sentence the pipeline wrote and is shown
     as written, because translating somebody's recorded judgement would be inventing it */
  ['in Arabic the labels are Arabic (the stored reason stays as written)',
    arNotes.length === 2 && arNotes.every(hasArabic),
    JSON.stringify(arNotes).slice(0, 110)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
