/* probe-a-shared-card-keeps-our-notes-inside.mjs — a view-only link shows the pipeline, not the
   file we keep on a company.

   Fire #165, following M28 ("before putting anything on a company card, ask who else can open that
   card") through the rest of the card. Measured on a real share link against the app: a person
   holding a view-only link could open a company's card and read

     · the ACTIVITY LOG — our own call notes, each with "edit · remove" beside it. The record used
       to find this carried «call: their finance man is difficult, push the discount»;
     · COMMENTS — internal discussion about the account;
     · NOTES — free text, which **100 of the 108 live companies have**.

   None of that is what the link is for. The panel that mints one promises Today, Leads and Clients:
   the pipeline. Nothing was exposed when this was found — all four live links were switched off —
   which is exactly when to fix it.

   What this holds, for a link holder:
     1. no activity log, and none of a call note's words anywhere on the page;
     2. no comments;
     3. no notes;
     4. the jump bar offers no chip for a section that is not there — a button that scrolls to
        nothing is its own small lie;
     5. the holder is TOLD, once, in words, that internal material is not part of a shared link, so a
        missing card is never mistaken for an empty one;
     6. and what the link IS for still works: the company, its stage and its key facts are all there.
   And for a colleague:
     7. signed in, all three cards are back — this is a wall, not a deletion.

   Check 6 is the one that stops this becoming "hide everything", and check 7 is the one that stops
   it becoming a feature removal.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing the
   internal-card block from js/79 fails checks 1, 2, 3, 4 and 5, and check 1 prints the call note it
   should never have shown.
   Run: node scripts/qa/probe-a-shared-card-keeps-our-notes-inside.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9116; const BASE = 'http://localhost:' + PORT;
const TOKEN = 'qa-share-inside-token-0123456789ab';

const CALL = 'QA INTERNAL CALL NOTE their buyer is difficult push the discount';
const COMMENT = 'QA INTERNAL COMMENT undercut the incumbent by eight percent';
const NOTE = 'QA INTERNAL FREE NOTE budget signed off by their finance head do not mention';

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

const BUSINESSES = [
  row({ id: 'g1', legacy_id: 'G1', name: 'QA Shared Company', notes: NOTE,
    raw: { notes: NOTE,
      activities: [{ date: Date.parse('2026-09-01'), type: 'call', note: CALL, by: 'QA Test Account' }],
      comments: [{ at: Date.parse('2026-09-02'), by: 'QA Test Account', text: COMMENT }] } }),
  row({ id: 'g2', legacy_id: 'G2', name: 'QA Second Company' }),
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
    try { current = 'leads'; openLead = 'G1'; render(); } catch (_) { }
    return new Promise((res) => setTimeout(() => {
      const v = document.getElementById('view');
      const visibleCardTitles = [].slice.call(v.querySelectorAll('.card'))
        .filter((c) => c.offsetParent !== null)
        .map((c) => ((c.querySelector('h3') || {}).textContent || '').replace(/\s+/g, ' ').trim());
      const jump = document.getElementById('v60jump');
      const chips = jump ? [].slice.call(jump.querySelectorAll('button')).filter((x) => x.offsetParent !== null).map((x) => (x.textContent || '').trim()) : [];
      res({ page: (v.innerText || '').replace(/\s+/g, ' '), titles: visibleCardTitles, chips: chips,
        note: !!v.querySelector('.v79-internal-note'), opened: /QA Shared Company/.test(v.innerText || '') });
    }, 3000));
  });
  await ctx.close();
  return out;
}

const guest = await look(true);
const staff = await look(false);
await b.close(); srv.close?.();

const hasTitle = (o, re) => o.titles.some((t) => re.test(t));
const checks = [
  ['a link holder sees no activity log, and none of a call note\'s words',
    guest.opened && !hasTitle(guest, /activity|workflow/i) && guest.page.indexOf(CALL) < 0,
    (guest.page.match(/QA INTERNAL CALL[^.]{0,40}/) || ['(absent — right)'])[0]],
  ['no comments', !hasTitle(guest, /^comments/i) && guest.page.indexOf(COMMENT) < 0,
    (guest.page.match(/QA INTERNAL COMMENT[^.]{0,30}/) || ['(absent — right)'])[0]],
  ['no notes', !hasTitle(guest, /^notes/i) && guest.page.indexOf(NOTE) < 0,
    (guest.page.match(/QA INTERNAL FREE NOTE[^.]{0,30}/) || ['(absent — right)'])[0]],
  ['the jump bar offers no chip for a section that is not there',
    !guest.chips.some((c) => /activity|workflow|^comments|^notes/i.test(c)), JSON.stringify(guest.chips)],
  ['the holder is told, once, that internal material is not part of a shared link',
    guest.note && /not part of a shared link/i.test(guest.page), String(guest.note)],
  ['what the link IS for still works — the company, its stage and its key facts',
    guest.opened && /Contacted/.test(guest.page) && hasTitle(guest, /key facts/i),
    JSON.stringify(guest.titles.slice(0, 6))],
  ['signed in, all three cards are back — a wall, not a deletion',
    hasTitle(staff, /activity|workflow/i) && hasTitle(staff, /^comments/i) && hasTitle(staff, /^notes/i)
      && staff.page.indexOf(CALL) >= 0, JSON.stringify(staff.titles.slice(0, 8))],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
