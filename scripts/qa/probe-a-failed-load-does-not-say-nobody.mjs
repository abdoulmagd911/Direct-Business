/* probe-a-failed-load-does-not-say-nobody.mjs — "no contacts" must mean no contacts.

   Found on 2026-09-21 (fire #155) by failing one request on purpose against the real database. When
   js/72's contacts fetch fails, `r.data` is null, the rows become an empty list, and a refused load
   becomes indistinguishable from an empty table. The company card then said:

       No contacts yet.

   about a company that has a contact sitting in the database — the same six words it uses for one
   that genuinely has nobody. Two things follow from that, and both are worse than the wrong line:
   somebody reads it and adds the person again, creating a duplicate on a real company; and the
   app's own "needs attention" rule, which counts a company with no people, quietly names the whole
   pipeline, so the one list meant to say what to do next says "all of it".

   Unknown is not the same as none. That is the whole of this probe.

   What this holds — with the fetch failing:
     1. the card does NOT say the record has nobody, and says plainly that it could not load;
     2. it offers a way to try again, because the honest answer to "could not reach it" is usually
        one more attempt;
     3. the "needs attention" rule stops counting that company as missing its people;
     4. and it says all of it in Arabic on the Arabic side.
   And with nothing failing, which is what keeps the fix from being a blanket:
     5. a company with people shows them;
     6. a company that genuinely has none still gets the ordinary "No contacts yet." — the two
        states must stop looking the same, in BOTH directions;
     7. and that company is still counted by the attention rule, so the term itself still works.

   Checks 6 and 7 are the ones that matter over time: the cheap way to pass 1-3 is to never say
   "no contacts" again, which would hide a real and useful fact.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): restoring js/72's
   old `var rows=(r&&r.data)||[]` — a failed page silently becoming an empty one — fails checks 1,
   2, 3 and 4.
   Run: node scripts/qa/probe-a-failed-load-does-not-say-nobody.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9108; const BASE = 'http://localhost:' + PORT;

const PERSON = 'Hanadi Alqahtani';
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

/* f1's only contact lives in the TABLE — the shape the bridge exists for, and the shape that a
   failed fetch turns into "nobody". f2 genuinely has none. Neither has a next action, so the
   attention rule can only fire on the people term. */
const BUSINESSES = [
  row({ id: 'f1', legacy_id: 'F1', name: 'QA Has A Person' }),
  row({ id: 'f2', legacy_id: 'F2', name: 'QA Has Nobody' }),
];
const CONTACTS = [{ id: 'qf-1', business_id: 'f1', name: PERSON, role: 'Owner', email: 'hq@qa-example.test',
  phone: '+966500000012', verification_source: 'import', needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null }];

const srv = start(PORT, { businesses: BUSINESSES, contacts: CONTACTS, activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(lang, failContacts) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (failContacts && /\/rest\/v1\/contacts/.test(u.pathname)) {
      await r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'simulated outage' }) }); return; }
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
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 1, { timeout: 120000 });
  /* give the bridge its run either way — success or the failure under test */
  await p.waitForTimeout(6000);

  const card = async (id) => {
    await p.evaluate((i) => { try { current = 'leads'; openLead = i; render(); } catch (_) { } }, id);
    await p.waitForTimeout(1400);
    return p.evaluate(() => {
      const v = document.getElementById('view');
      let c = null;
      [].slice.call(v.querySelectorAll('.card')).forEach((x) => { const h = x.querySelector('h3'); if (h && /contact|جهات|الاتصال/i.test(h.textContent || '')) c = x; });
      return { text: c ? (c.innerText || '').replace(/\s+/g, ' ') : '(no contacts card)',
        retry: !!(c && c.querySelector('.empty a')) };
    });
  };
  const f1 = await card('F1');
  const f2 = await card('F2');
  const attn = await p.evaluate(() => {
    const out = {};
    try { const keep = window.__needsAttn; window.__needsAttn = true;
      (DB.businesses || []).forEach((x) => { try { out[x.id] = !!matchLead(x); } catch (_) { out[x.id] = null; } });
      window.__needsAttn = keep; } catch (_) { }
    return out;
  });
  await p.evaluate(() => { try { openLead = null; render(); } catch (_) { } });
  await ctx.close();
  return { f1, f2, attn };
}

const broken = await run('en', true);
const brokenAr = await run('ar', true);
const fine = await run('en', false);
await b.close(); srv.close?.();

const checks = [
  ['with the fetch failing, the card does not say the record has nobody, and says it could not load',
    !/No contacts yet/i.test(broken.f1.text) && /Could not load/i.test(broken.f1.text), broken.f1.text.slice(0, 110)],
  ['and it offers a way to try again', broken.f1.retry, JSON.stringify(broken.f1.retry)],
  ['the "needs attention" rule stops counting that company as missing its people',
    broken.attn.F1 === false, JSON.stringify(broken.attn)],
  ['it says so in Arabic on the Arabic side',
    /[؀-ۿ]/.test(brokenAr.f1.text) && !/No contacts yet/i.test(brokenAr.f1.text), brokenAr.f1.text.slice(0, 80)],
  ['with nothing failing, a company with people shows them',
    fine.f1.text.indexOf(PERSON) >= 0, fine.f1.text.slice(0, 90)],
  ['a company that genuinely has none still gets the ordinary line — the two states must differ',
    /No contacts yet/i.test(fine.f2.text) && !/Could not load/i.test(fine.f2.text), fine.f2.text.slice(0, 90)],
  ['and it is still counted by the attention rule, so the term itself still works',
    fine.attn.F2 === true && fine.attn.F1 === false, JSON.stringify(fine.attn)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
