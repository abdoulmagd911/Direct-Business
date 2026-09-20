/* probe-a-record-says-where-it-came-from.mjs — provenance, and the one warning nobody could see.

   Counted on the live database on 2026-09-21 (fire #151). Every company row carries three fields
   the import and scrub pipeline writes and nobody in this app ever edits:

     · verification_source       — set on 81 of the 108 live companies, and it is a sentence, not a
                                   code: "Contact-form submission, classified with the owner
                                   2026-08-16";
     · needs_manual_confirmation — true on ONE company;
     · confirmation_reason       — which says why: "Organisation inferred from the email domain
                                   only — confirm the company before any outreach."

   None of the three was read. The team worked those 81 leads unable to see that they had already
   been classified with the owner, and the record carrying a warning about itself looked like every
   other record — so the warning reached nobody and the outreach it asks you to hold was one click
   away. js/09's OWN "needs attention" test already asks for `needsManualConfirmation`, and no raw
   blob has ever held that key (0 of 108, checked), so that branch could never fire.

   What this holds:
     1. a company with a provenance sentence shows it — the sentence itself, not a summary of it;
     2. a flagged company also shows the warning WITH its reason, and shows it first, because it is
        the line that changes what a person does next;
     3. a company with neither shows nothing — a note on every card is a note on none;
     4. the flagged company now reaches the "needs attention" filter, and an identical unflagged one
        does not: the dead branch is alive, and it is alive for the right reason;
     5. it is bilingual;
     6. exactly one of each line per card;
     7. NOTHING is written — confirming a company is a judgement about a real business and cannot be
        something a card does by being looked at.

   Check 3 is what keeps it readable and check 7 is what keeps it safe; check 4 is the one that
   proves the fix reaches the person rather than just the screen.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing the
   three column bridges from js/02 fails checks 1, 2, 4 and 5, and check 4 prints the dead branch
   it came from — every record false; removing js/86's warning box fails checks 2 and 5.
   Run: node scripts/qa/probe-a-record-says-where-it-came-from.mjs                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9105; const BASE = 'http://localhost:' + PORT;

const SOURCE = 'Contact-form submission, classified with the owner 2026-08-16';
const REASON = 'Organisation inferred from the email domain only — confirm the company before any outreach.';

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

/* all three carry a contact and no overdue action, so the ONLY thing that can make one of them
   "need attention" is the flag itself — otherwise check 4 would pass for the wrong reason */
const BUSINESSES = [
  row({ id: 'p1', legacy_id: 'P1', name: 'QA Flagged Company', verification_source: SOURCE,
    needs_manual_confirmation: true, confirmation_reason: REASON }),
  row({ id: 'p2', legacy_id: 'P2', name: 'QA Known Origin Company', verification_source: SOURCE }),
  row({ id: 'p3', legacy_id: 'P3', name: 'QA Plain Company' }),
];
const CONTACTS = ['p1', 'p2', 'p3'].map((b, i) => ({
  id: 'qo-' + i, business_id: b, name: 'QA Person ' + i, role: 'Owner', email: 'p' + i + '@qa-example.test',
  phone: '+9665000000' + i, verification_source: 'import', needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null,
}));

const srv = start(PORT, { businesses: BUSINESSES, contacts: CONTACTS, activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(lang) {
  const wrote = [];
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 2, { timeout: 120000 });
  await p.waitForFunction(() => { try { return (DB.businesses || []).some((x) => (x.contacts || []).some((c) => c && c._fromTable)); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(1500);

  const cards = {};
  for (const id of ['P1', 'P2', 'P3']) {
    await p.evaluate((i) => { try { current = 'leads'; openLead = i; render(); } catch (_) { } }, id);
    await p.waitForTimeout(1000);
    cards[id] = await p.evaluate(() => {
      const v = document.getElementById('view');
      const w = v.querySelector('.v86-confirm'), o = v.querySelector('.v86-origin');
      const boxes = [].slice.call(v.querySelectorAll('.v86-confirm,.v86-origin'));
      return { warn: w ? (w.innerText || '').replace(/\s+/g, ' ') : '', origin: o ? (o.innerText || '').replace(/\s+/g, ' ') : '',
        nWarn: v.querySelectorAll('.v86-confirm').length, nOrigin: v.querySelectorAll('.v86-origin').length,
        warnFirst: !!w && boxes.indexOf(w) === 0 && v.firstChild === w };
    });
  }
  /* the app's own "needs attention" rule, asked through the app's own matchLead */
  const attn = await p.evaluate(() => {
    const out = {};
    try {
      const keep = window.__needsAttn; window.__needsAttn = true;
      (DB.businesses || []).forEach((x) => { try { out[x.id] = !!matchLead(x); } catch (_) { out[x.id] = null; } });
      window.__needsAttn = keep;
    } catch (_) { }
    return out;
  });
  await p.evaluate(() => { try { openLead = null; render(); } catch (_) { } });
  await ctx.close();
  return { cards, attn, wrote };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

/* js/41 auto-matches finance groups on load and that write is blocked by the route above; it is not
   this layer writing, and every probe here excludes it the same way. */
const realWrites = [...new Set(en.wrote.concat(ar.wrote))].filter((w) => !/finance_client_links/.test(w));
const checks = [
  ['a company with a provenance sentence shows it — the sentence itself, not a summary',
    en.cards.P2.origin.indexOf(SOURCE) >= 0, en.cards.P2.origin.slice(0, 110)],
  ['a flagged company also shows the warning, with its reason, and shows it FIRST',
    en.cards.P1.warn.indexOf(REASON) >= 0 && en.cards.P1.warnFirst, en.cards.P1.warn.slice(0, 110)],
  ['a company with neither shows nothing — a note on every card is a note on none',
    !en.cards.P3.nOrigin && !en.cards.P3.nWarn && !en.cards.P2.nWarn,
    JSON.stringify({ P3: [en.cards.P3.nOrigin, en.cards.P3.nWarn], P2warn: en.cards.P2.nWarn })],
  ['the flagged company reaches the "needs attention" filter and an identical unflagged one does not',
    en.attn.P1 === true && en.attn.P2 === false && en.attn.P3 === false, JSON.stringify(en.attn)],
  ['it is bilingual', /[؀-ۿ]/.test(ar.cards.P1.warn) && /[؀-ۿ]/.test(ar.cards.P2.origin),
    ar.cards.P2.origin.slice(0, 70)],
  ['exactly one of each line per card — not one per render',
    ['P1', 'P2', 'P3'].every((k) => en.cards[k].nOrigin <= 1 && en.cards[k].nWarn <= 1),
    JSON.stringify(['P1', 'P2', 'P3'].map((k) => [en.cards[k].nOrigin, en.cards[k].nWarn]))],
  ['nothing was written — confirming a company cannot be something a card does by being looked at',
    realWrites.length === 0, JSON.stringify(realWrites)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
