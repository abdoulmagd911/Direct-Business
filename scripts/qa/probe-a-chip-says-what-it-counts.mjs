/* probe-a-chip-says-what-it-counts.mjs — a label that is just a dash is not a label.

   Found live on 2026-09-21 (fire #146). The Clients page groups clients by city and falls back to
   the em dash when a client has none. No client in the live data has a city recorded, so the strip
   rendered exactly one tag:

       —: 28

   Which tells a person nothing, and reads like a broken label rather than a fact. `area` IS a real
   writable field — the lead form's "Area (city)" dropdown — so the breakdown is worth keeping; the
   unknown bucket simply has to say what it means, in the page's own language.

   What this holds:
     1. clients WITH a city are grouped under that city's own name, with the right count — the fix
        must not flatten a real breakdown into one bucket;
     2. clients WITHOUT one are counted under words, not a dash, so the strip says something true
        ("No city recorded: N");
     3. it says it in Arabic on the Arabic side;
     4. the buckets add up to the number of clients — a breakdown that loses or invents records is
        worse than no breakdown.

   Check 4 is the quiet one: the cheap way to pass 1-3 is to relabel the dash and stop thinking, and
   this notices if the grouping itself ever drifts.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the em
   dash back as the fallback fails checks 2 and 3 and prints the dash it found.
   Run: node scripts/qa/probe-a-chip-says-what-it-counts.mjs                                       */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9101; const BASE = 'http://localhost:' + PORT;

/* `area` is not a column — it lives in the record's raw, which is where the lead form writes it */
const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: 'X', source: 'Import', stage: 'won', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: 'LLC', legal_name: 'X LLC', cr_vat: '300123456700003', payment_terms: 'Net 30',
  credit_limit: 0, contract_start: null, contract_end: null, contract_scope: '', contract_sla: '', next_review: null,
  total_sar: 0, website: '', corp_email_flag: 'no', is_client: true, converted_date: '2026-03-01', direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '', created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: 'manual', needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

/* two in one city, one in another, two with none — so a real breakdown and the unknown bucket both
   have to survive, and the totals have something to add up to */
const BUSINESSES = [
  row({ id: 'c1', legacy_id: 'C1', name: 'QA Client Riyadh A', raw: { area: 'Riyadh' } }),
  row({ id: 'c2', legacy_id: 'C2', name: 'QA Client Riyadh B', raw: { area: 'Riyadh' } }),
  row({ id: 'c3', legacy_id: 'C3', name: 'QA Client Jeddah', raw: { area: 'Jeddah' } }),
  row({ id: 'c4', legacy_id: 'C4', name: 'QA Client Nowhere A', raw: {} }),
  row({ id: 'c5', legacy_id: 'C5', name: 'QA Client Nowhere B', raw: {} }),
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [] });
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
  await p.evaluate(() => { try { current = 'clients'; openLead = null; render(); } catch (_) { } });
  await p.waitForTimeout(2600);
  const out = await p.evaluate(() => {
    const d = document.getElementById('cl_dash');
    const tags = d ? [].slice.call(d.querySelectorAll('.tag')).map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim()) : [];
    const clients = (DB.businesses || []).filter((x) => x.isClient).length;
    return { tags, clients, shown: !!d };
  });
  await ctx.close();
  return out;
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const numOf = (tags, re) => { const t = tags.find((x) => re.test(x)); return t ? Number((t.match(/(\d+)\s*$/) || [])[1]) : null; };
const sum = (tags) => tags.reduce((a, t) => a + (Number((t.match(/(\d+)\s*$/) || [])[1]) || 0), 0);
const checks = [
  ['the breakdown is on screen at all, or nothing below means anything', en.shown && en.tags.length >= 2, JSON.stringify(en.tags)],
  ['clients WITH a city are grouped under that city, with the right count',
    numOf(en.tags, /Riyadh/) === 2 && numOf(en.tags, /Jeddah/) === 1, JSON.stringify(en.tags)],
  ['clients WITHOUT one are counted under words, not a dash',
    /No city recorded/i.test(en.tags.join(' ')) && numOf(en.tags, /No city recorded/i) === 2
      && !en.tags.some((t) => /^\s*[—-]\s*:/.test(t)), JSON.stringify(en.tags)],
  ['and it says so in Arabic on the Arabic side',
    /بلا مدينة/.test(ar.tags.join(' ')) && !ar.tags.some((t) => /^\s*[—-]\s*:/.test(t)), JSON.stringify(ar.tags)],
  ['the buckets add up to the number of clients — a breakdown that loses or invents records is worse than none',
    sum(en.tags) === en.clients, sum(en.tags) + ' counted across buckets vs ' + en.clients + ' clients'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
