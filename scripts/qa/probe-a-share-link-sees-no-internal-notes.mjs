/* probe-a-share-link-sees-no-internal-notes.mjs — what we say to ourselves is not what we hand out.

   Fire #164. Two lines added earlier the same day are notes to ourselves about a third party:

     · js/85 — "The same person is on another company", which NAMES the other company;
     · js/86 — "Confirm this company before reaching out — organisation inferred from the email
       domain only", our own unfinished judgement about a business we have not checked.

   A view-only share link puts Today, Leads and Clients in front of somebody OUTSIDE the company,
   and a card opens from that list. Measured: neither line appears there today — but only by luck.
   The share loader (`shareRowToApp`, js/10) copies a record's WHOLE raw blob to the link holder,
   and fire #151 had just started putting those three fields onto the app's record object, so **one
   in-app save of any company** would have written them into that blob and handed them out with it.

   Two locks, because this is not the kind of thing to be clever about: js/02 keeps those fields out
   of the blob at the source (they are column-owned and the column always wins, so a copy there was
   only ever noise), and both layers stay silent in a share view whatever the data says.

   What this holds:
     1. the link holder can open a company card at all — otherwise nothing below means anything;
     2. no "same person on another company" line, and the other company's name appears NOWHERE on
        the page;
     3. no provenance line and no confirmation warning, and none of their words appear either;
     4. **even when the record's raw blob carries all three fields** — the state one save would have
        created — nothing appears;
     5. and a signed-in colleague on the same record still sees all of it, so this is a wall, not a
        deletion;
     6. no JS errors.

   Check 5 is what keeps the fix from being a quiet removal of two useful lines, and check 4 is the
   one that tests the lock rather than the luck.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing the
   share-view guard from js/85 and js/86 fails checks 2, 3 and 4, and names the other company in its
   own failure line.
   Run: node scripts/qa/probe-a-share-link-sees-no-internal-notes.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9115; const BASE = 'http://localhost:' + PORT;
const TOKEN = 'qa-share-notes-token-0123456789abcd';

const SOURCE = 'Contact-form submission, classified with the owner 2026-08-16';
const REASON = 'Organisation inferred from the email domain only — confirm before outreach.';
const OTHER = 'QA Other Company Secret Name';
const SHARED_EMAIL = 'dup@qa-example.test';

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'contacted', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '', created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: null, needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

/* the blob carries the three fields AND the people — the state one in-app save would leave behind,
   and the only state in which the share loader could ever hand them out */
const RAW_WITH_NOTES = {
  verificationSource: SOURCE, needsManualConfirmation: true, confirmationReason: REASON,
  contacts: [{ name: 'Shared Person', role: 'Owner', email: SHARED_EMAIL, phone: '+966 50 111 2222' }],
};
const BUSINESSES = [
  row({ id: 's1', legacy_id: 'S1', name: 'QA Shared Lead', raw: RAW_WITH_NOTES,
    verification_source: SOURCE, needs_manual_confirmation: true, confirmation_reason: REASON }),
  row({ id: 's2', legacy_id: 'S2', name: OTHER,
    raw: { contacts: [{ name: 'Shared Person', role: 'Owner', email: SHARED_EMAIL, phone: '+966 50 111 2222' }] } }),
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [],
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
    await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 1, { timeout: 120000 });
  }
  await p.waitForTimeout(5000);
  const out = await p.evaluate(() => {
    try { current = 'leads'; openLead = 'S1'; render(); } catch (_) { }
    return new Promise((res) => setTimeout(() => {
      const v = document.getElementById('view');
      res({ share: document.body.getAttribute('data-share') === '1',
        cardOpened: /QA Shared Lead/.test(v.innerText || ''),
        v85: !!v.querySelector('.v85-shared'), v86o: !!v.querySelector('.v86-origin'), v86c: !!v.querySelector('.v86-confirm'),
        page: (v.innerText || '').replace(/\s+/g, ' ') });
    }, 2600));
  });
  await ctx.close();
  return out;
}

const shared = await look(true);
const inside = await look(false);
await b.close(); srv.close?.();

const checks = [
  ['the link holder can open a company card at all', shared.share && shared.cardOpened, JSON.stringify({ share: shared.share, card: shared.cardOpened })],
  ['no "same person on another company" line, and the other company is named nowhere on the page',
    !shared.v85 && shared.page.indexOf(OTHER) < 0, shared.page.slice(0, 90)],
  ['no provenance line, no confirmation warning, and none of their words anywhere',
    !shared.v86o && !shared.v86c && shared.page.indexOf(SOURCE) < 0 && shared.page.indexOf(REASON) < 0,
    (shared.page.match(/Confirm this company[^.]{0,40}/) || ['(absent — right)'])[0]],
  ['even with the record\'s raw blob carrying all three fields, nothing appears',
    !shared.v86o && !shared.v86c && shared.page.indexOf('inferred from the email domain') < 0,
    (shared.page.match(/inferred[^.]{0,40}/) || ['(absent — right)'])[0]],
  ['a signed-in colleague on the same record still sees all of it — a wall, not a deletion',
    inside.v86o && inside.v86c && inside.v85, JSON.stringify({ v85: inside.v85, origin: inside.v86o, confirm: inside.v86c })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
