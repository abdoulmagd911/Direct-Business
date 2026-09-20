/* probe-the-leads-strip-counts-leads.mjs — the warning strip on Leads must count the thing it names.

   Found live on 2026-09-20 (fire #145). The strip at the top of the Leads page read
   "⚠️ 20 worked leads with no owner · 25 with no movement for 14+ days" — and ALL TWENTY of the
   first number were CLIENTS. Not one of them was in the 78-row list underneath it. Somebody acting
   on that line had nothing to click, and no way to find out why.

   attention() skipped vendors and never skipped clients, while the strip renders only when
   current === 'leads' and speaks of "worked leads". It is the same shape as the stage chips that
   counted one population and filtered another (found and fixed 2026-08-09) — a count that names a
   population the page does not show.

   What this holds:
     1. a worked LEAD with no owner is counted;
     2. a CLIENT with no owner is NOT counted, however loudly it qualifies on every other test —
        this is the whole defect;
     3. the strip still finds the leads that have gone quiet, so fixing the label did not silence
        the half that was right;
     4. the examples it names are records the page actually lists — a name in the strip must be
        findable below it.

   Check 4 is the one that would have caught the original defect on its own: the strip was naming
   companies that were not in the list, and nothing asked whether it could.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): with the
   `if(b.isClient)return;` line removed from attention(), checks 2 and 4 FAIL and the report shows
   the client's name back in the strip.
   Run: node scripts/qa/probe-the-leads-strip-counts-leads.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9100; const BASE = 'http://localhost:' + PORT;

const OLD = '2026-01-05T10:00:00Z';            /* far past the 14-day line, whatever day this runs */
const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: 'X', source: 'Import', stage: 'contacted', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: '', account_manager: '', tier: 'A',
  entity_type: 'LLC', legal_name: 'X LLC', cr_vat: '300123456700003', payment_terms: 'Net 30', credit_limit: 0,
  contract_start: null, contract_end: null, contract_scope: '', contract_sla: '', next_review: null,
  total_sar: 0, website: '', corp_email_flag: 'no', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '', created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: 'manual', needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

/* One of each, so the probe can tell "counts leads" from "counts everything". The client is made
   to qualify on every other test the strip applies: worked stage, no owner, and an old activity. */
const BUSINESSES = [
  row({ id: 'b0', legacy_id: 'L0', name: 'QA Lead No Owner', stage: 'contacted', is_client: false }),
  row({ id: 'b1', legacy_id: 'L1', name: 'QA Client No Owner', stage: 'won', is_client: true, converted_date: '2026-03-01' }),
  row({ id: 'b2', legacy_id: 'L2', name: 'QA Lead Gone Quiet', stage: 'contacted', is_client: false, assigned_to: 'QA Test Account', account_manager: 'QA Test Account' }),
  row({ id: 'b3', legacy_id: 'L3', name: 'QA Lead Fresh', stage: 'contacted', is_client: false, assigned_to: 'QA Test Account', account_manager: 'QA Test Account' }),
];
const ACTIVITIES = [
  { id: 'qa-act-1', business_id: 'b1', type: 'note', note: 'client, long ago', by_user: 'QA', at: OLD },
  { id: 'qa-act-2', business_id: 'b2', type: 'note', note: 'lead, long ago', by_user: 'QA', at: OLD },
  { id: 'qa-act-3', business_id: 'b3', type: 'note', note: 'lead, today', by_user: 'QA', at: new Date(Date.now() - 86400000).toISOString() },
];

const srv = start(PORT, { businesses: BUSINESSES, activities: ACTIVITIES, contacts: [] });
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  /* the strip's "last touched" comes from the activities bridge */
  await p.waitForFunction(() => { try { return (DB.businesses || []).some((x) => (x.activities || []).some((a) => a && a._fromTable)); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => { });
  await p.evaluate(() => { try { current = 'leads'; openLead = null; render(); } catch (_) { } });
  await p.waitForTimeout(2200);
  const out = await p.evaluate(() => {
    const s = document.getElementById('v39strip');
    const listed = [].slice.call(document.querySelectorAll('#view tbody tr')).map((tr) => (tr.innerText || '').replace(/\s+/g, ' '));
    return { text: s ? (s.innerText || '').replace(/\s+/g, ' ') : '', shown: !!s, listed };
  });
  await ctx.close();
  return out;
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const num = (t, re) => { const m = t.match(re); return m ? Number(m[1]) : null; };
const noOwnerEn = num(en.text, /(\d+)\s+worked lead/i);
const quietEn = num(en.text, /(\d+)\s+with no movement/i);
const listedText = en.listed.join(' | ');
const checks = [
  ['the strip is on screen at all, or nothing below means anything', en.shown, en.text.slice(0, 120)],
  ['a worked LEAD with no owner is counted', noOwnerEn === 1, 'counted ' + noOwnerEn + ', expected 1 (only QA Lead No Owner qualifies)'],
  ['a CLIENT with no owner is NOT counted — this is the whole defect',
    !/QA Client No Owner/.test(en.text) && noOwnerEn !== 2, en.text.slice(0, 140)],
  ['the leads that have gone quiet are still found — fixing the label did not silence the half that was right',
    quietEn >= 1 && /QA Lead Gone Quiet/.test(en.text), 'quiet=' + quietEn],
  ['every company the strip names is one the page actually lists',
    (en.text.match(/QA [A-Za-z ]+/g) || []).filter((n) => n.trim().length > 6)
      .every((n) => listedText.includes(n.trim())), en.text.slice(0, 160)],
  ['the Arabic strip counts the same things', (num(ar.text, /(\d+)\s+فرصة/) || noOwnerEn) === noOwnerEn && !/QA Client No Owner/.test(ar.text), ar.text.slice(0, 120)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
