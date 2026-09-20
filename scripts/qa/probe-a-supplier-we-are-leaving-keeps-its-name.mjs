/* probe-a-supplier-we-are-leaving-keeps-its-name.mjs — a supplier you are walking away from is
   still the supplier on last year's bookings. Deleting the word for it is not a way to retire it.

   Fire #182. Direct is phasing out three suppliers. The app used to express that by DELETING
   their names: js/core/core-10 wrapped render() and, on every render, walked EVERY <select> in the
   whole document and removed any option whose text matched one of the three.

   Driven against the live database, that was:
     · the "Provider / GDS" box opened with 24 suppliers including one of the three, and ONE
       render() later it held 23 — the supplier disappeared out of an open form, silently;
     · a plain four-option box kept one option;
     · and a booking already recorded against that supplier read back as an EMPTY provider — a
       <select> handed a value with no matching option reports nothing — so a Save would have
       written the blank over the real supplier.

   The intent was right and is kept: nobody should pick a retired supplier for NEW work. The
   mechanism is now to mark, not delete.

   What this holds:
     1. the app publishes which suppliers are being phased out — without that list this whole
        layer is a no-op and every check below would pass vacuously;
     2. the option is STILL in the box after a render, and the box has not shrunk;
     3. it is disabled, so it cannot be chosen for new work;
     4. its label says, in words, that it is being phased out;
     5. its VALUE is still the plain supplier name — relabelling an <option> that carries no value
        attribute changes what a Save writes, and that would be the same data loss by another road;
     6. a box that ALREADY holds that supplier keeps it enabled and its value survives a render;
     7. a supplier that is NOT being phased out is untouched — not disabled, label unchanged;
     8. the Providers list carries the same mark the verdict card above it already claimed;
     9. in Arabic both the option label and the list mark are Arabic;
    10. no JS errors.

   Checks 5, 6 and 7 are the brakes: a layer that relabelled every option, or that disabled the
   value a record already holds, or that let the label leak into the saved value, would pass the
   rest and be worse than what it replaced.

   The supplier names are never written here — the probe reads the app's own published list, so it
   cannot drift from it and cannot go stale when the list changes.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the
   `o.remove()` line back in core-10 and dropping js/96 fails checks 2, 3, 4, 6, 8 and 9.
   Run: node scripts/qa/probe-a-supplier-we-are-leaving-keeps-its-name.mjs                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9170; const BASE = 'http://localhost:' + PORT;

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

const srv = start(PORT, { businesses: [row({ id: 'p1', legacy_id: 'P1', name: 'QA Provider Probe Co' })], contacts: [], activities: [] });
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

/* the app's own list — never written into this file */
const RETIRED = await p.evaluate(() => { try { return (window.DT_PROVIDERS_PHASING_OUT || []).slice(); } catch (_) { return []; } });
const NAME = RETIRED[0] || '';

/* put one supplier by that name into the workspace in memory (nothing is saved — writes are blocked) */
const seeded = await p.evaluate((n) => {
  try {
    if (!n) return false;
    DB.vendors = DB.vendors || [];
    if (!DB.vendors.some((v) => String(v.name || '').toLowerCase() === n.toLowerCase()))
      DB.vendors.unshift({ id: 'ven_retired', name: n, type: 'GDS/agency', source: 'QA', contacts: [] });
    return true;
  } catch (_) { return false; }
}, NAME);

const dropdown = await p.evaluate(() => {
  try { current = 'bookings'; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    try { ingestModal('booking', '', function () {}); } catch (e) { return res({ err: e.message }); }
    setTimeout(() => {
      const dump = () => { const s = document.getElementById('ig_prov'); return s ? [].slice.call(s.options)
        .map((o) => ({ t: (o.textContent || '').trim(), v: o.value, dis: !!o.disabled })) : null; };
      const before = dump();
      try { render(); } catch (_) {}
      setTimeout(() => res({ before, after: dump() }), 900);
    }, 900);
  }, 1400));
});

const held = await p.evaluate((n) => {
  try { closeModal(); } catch (_) {}
  const w = document.createElement('div'); w.id = 'v96probe';
  const o = document.createElement('option'); o.selected = true; o.textContent = n;
  const s = document.createElement('select'); s.id = 'v96sel';
  const blank = document.createElement('option'); blank.value = ''; blank.textContent = '—';
  const other = document.createElement('option'); other.textContent = 'QA Global GDS';
  s.appendChild(blank); s.appendChild(o); s.appendChild(other);
  w.appendChild(s); document.body.appendChild(w);
  const v0 = s.value;
  try { render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    const t = document.getElementById('v96sel'); if (!t) return res({ gone: true });
    const opt = [].slice.call(t.options).find((x) => String(x.value) === n);
    res({ v0, v1: t.value, stillThere: !!opt, enabled: !!(opt && !opt.disabled) });
  }, 900));
}, NAME);

const list = await p.evaluate(() => {
  try { const z = document.getElementById('v96probe'); if (z) z.remove(); current = 'vendors'; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    const v = document.getElementById('view');
    res({ rows: v.querySelectorAll('tbody tr').length,
      tags: [].slice.call(v.querySelectorAll('[data-v96-tag]')).map((x) => (x.textContent || '').trim()) });
  }, 2600));
});

const arabic = await p.evaluate(() => {
  try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); current = 'vendors'; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    const v = document.getElementById('view');
    const tags = [].slice.call(v.querySelectorAll('[data-v96-tag]')).map((x) => (x.textContent || '').trim());
    try { current = 'bookings'; render(); } catch (_) {}
    setTimeout(() => {
      try { ingestModal('booking', '', function () {}); } catch (_) {}
      setTimeout(() => {
        const s = document.getElementById('ig_prov');
        const marked = s ? [].slice.call(s.options).filter((o) => o.getAttribute('data-v96') === 'phasing')
          .map((o) => (o.textContent || '').trim()) : [];
        res({ tags, marked });
      }, 900);
    }, 1800);
  }, 2600));
});
await b.close(); srv.close?.();

const A = dropdown.after || []; const B = dropdown.before || [];
const mine = A.filter((o) => o.v === NAME);
const others = A.filter((o) => o.v && o.v !== NAME);
const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const saysPhasing = (s) => /phased out|phasing/i.test(s || '');

const checks = [
  ['the app publishes which suppliers are being phased out', RETIRED.length > 0 && !!NAME && seeded,
    RETIRED.length + ' listed'],
  ['the option is still in the box after a render, and the box has not shrunk',
    mine.length === 1 && A.length === B.length && A.length > 1,
    'before ' + B.length + ' → after ' + A.length],
  ['it is disabled, so it cannot be chosen for new work', mine.length === 1 && mine[0].dis === true,
    JSON.stringify(mine.map((o) => o.dis))],
  ['its label says it is being phased out', mine.length === 1 && saysPhasing(mine[0].t) && mine[0].t.length > NAME.length,
    (mine[0] || {}).t || '(no option)'],
  ['its value is still the plain supplier name', mine.length === 1 && mine[0].v === NAME,
    JSON.stringify((mine[0] || {}).v)],
  ['a box already holding it keeps it enabled and the value survives a render',
    held.stillThere === true && held.enabled === true && held.v1 === held.v0 && held.v1 === NAME,
    JSON.stringify(held)],
  ['a supplier that is not being phased out is untouched',
    others.length > 0 && others.every((o) => !o.dis && !saysPhasing(o.t)),
    others.length + ' others, ' + others.filter((o) => o.dis || saysPhasing(o.t)).length + ' wrongly marked'],
  ['the Providers list carries the same mark the verdict card claims',
    list.rows > 0 && list.tags.length === 1 && /phasing out/i.test(list.tags[0]),
    JSON.stringify(list.tags)],
  ['in Arabic both the list mark and the option label are Arabic',
    arabic.tags.length === 1 && hasArabic(arabic.tags[0]) && !/phasing/i.test(arabic.tags[0]) &&
    arabic.marked.length === 1 && hasArabic(arabic.marked[0]) && !/phased out/i.test(arabic.marked[0]),
    JSON.stringify(arabic).slice(0, 120)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
