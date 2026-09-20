/* probe-you-can-click-to-the-undo-screens.mjs — the two screens that undo a mistake belong in the
   sidebar, not only in a list inside Settings.

   Fire #169. The app routes by address (js/03's list) but the sidebar is built from somewhere else
   entirely, and nothing keeps the two in step — "this is how the finance ledger sat
   live-but-unreachable for two days" (CLAUDE.md).

   Swept every routable address against the LIVE database as an admin, who may open everything, so
   nothing was hidden by permission. Two pages drew real content and appeared nowhere in the
   sidebar — not on the rail, not inside either collapsed group:

     · **Activity & Audit** — 41,636 characters of page on the live data. The audit trail AND the
       Undo screen (js/63): the only place a change made in the last 24 hours can be reversed.
     · **Archive** — the only screen that can bring a deleted company back (js/76). **Four
       companies are archived in the live database right now.**

   They ARE linked from inside Settings -> "Admin & history", with working buttons, and always have
   been -- the first write-up of this fire wrongly said they were reachable only by typing the
   address, because the sweep behind it ignored everything inside a page (DECISIONS M31 carries the
   correction). What was true, and what this probe holds, is that the sidebar did not offer them.

   What this holds:
     1. both buttons exist in the sidebar;
     2. they carry the same name the access matrix uses — "Activity & Audit", not a second, older
        string — and each name is printed ONCE (the first attempt wrote the label into the icon's
        span and every name came out twice);
     3. clicking each one actually lands on that page, with its content;
     4. in Arabic both buttons are in Arabic — no raw key, no English left behind;
     5. the rail is not longer than it was: they live inside the collapsed Reference group with the
        other reference pages, not on the daily-driver rail;
     6. no JS errors.

   Check 5 is the brake. Two more always-visible buttons would pass 1-4 and quietly undo the
   6-8 item sidebar the v25 layer exists to produce.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/90's
   script line from index.html fails checks 1, 2, 3 and 4.
   Run: node scripts/qa/probe-you-can-click-to-the-undo-screens.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9123; const BASE = 'http://localhost:' + PORT;

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

const srv = start(PORT, {
  businesses: [
    row({ id: 'b1', legacy_id: 'B1', name: 'QA Lead One' }),
    row({ id: 'b2', legacy_id: 'B2', name: 'QA Deleted Company', archived_at: '2026-09-01T09:00:00Z', archived_by: 'QA Test Account' }),
  ],
  contacts: [], activities: [],
});
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

await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
await p.waitForTimeout(5000);

/* open the Reference group so the buttons can be clicked, exactly as a person would */
await p.evaluate(() => { try {
  const t = document.querySelector('#nav button.v25-more-tog');
  if (t && /▸/.test(t.textContent || '')) t.click();
} catch (_) { } });
await p.waitForTimeout(900);

const nav = await p.evaluate(() => {
  const vis = (el) => { try { return !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'); } catch (_) { return false; } };
  const n = document.getElementById('nav');
  const btn = (id) => n ? n.querySelector('button[data-v90="' + id + '"]') : null;
  const railText = () => {
    /* the rail = buttons that are NOT inside a collapsible group wrap */
    if (!n) return [];
    const wraps = [].slice.call(n.querySelectorAll('button.v25-more-tog')).map((t) => t.nextSibling).filter((x) => x && x.nodeType === 1);
    return [].slice.call(n.querySelectorAll('button')).filter(vis)
      .filter((x) => !wraps.some((w) => w.contains(x)))
      .map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim());
  };
  const read = (id) => { const x = btn(id); return x ? { there: true, text: (x.textContent || '').replace(/\s+/g, ' ').trim(), shown: vis(x) } : { there: false }; };
  return { activity: read('activity'), archive: read('archive'), rail: railText() };
});

async function clickAndLand(id) {
  await p.evaluate((i) => { const b = document.querySelector('#nav button[data-v90="' + i + '"]'); if (b) b.click(); }, id);
  await p.waitForTimeout(2600);
  return p.evaluate(() => { const v = document.getElementById('view');
    return { landed: (typeof current !== 'undefined' ? current : '?'), len: (v.innerText || '').trim().length }; });
}
const toActivity = await clickAndLand('activity');
const toArchive = await clickAndLand('archive');

/* Arabic */
await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); if (typeof render === 'function') render(); } catch (_) { } });
await p.waitForTimeout(2600);
const arabic = await p.evaluate(() => {
  const n = document.getElementById('nav');
  const t = (id) => { const x = n ? n.querySelector('button[data-v90="' + id + '"]') : null; return x ? (x.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  return { activity: t('activity'), archive: t('archive') };
});
await b.close(); srv.close?.();

const once = (t, w) => { const n = (t.match(new RegExp(w.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&'), 'g')) || []).length; return n === 1; };
const hasArabic = (s) => /[؀-ۿ]/.test(s) && !/[A-Za-z]{3,}/.test(s);

const checks = [
  ['both buttons exist in the sidebar', nav.activity.there && nav.archive.there,
    JSON.stringify({ activity: nav.activity.there, archive: nav.archive.there })],
  ['they carry the access matrix\'s name, printed once',
    /Activity & Audit/.test(nav.activity.text || '') && once(nav.activity.text || '', 'Activity & Audit')
      && once(nav.archive.text || '', 'Archive'),
    JSON.stringify({ activity: nav.activity.text, archive: nav.archive.text })],
  ['clicking each one lands on that page, with its content',
    toActivity.landed === 'activity' && toActivity.len > 200 && toArchive.landed === 'archive' && toArchive.len > 200,
    JSON.stringify({ activity: toActivity, archive: toArchive })],
  ['in Arabic both buttons are in Arabic — no raw key, no English left behind',
    hasArabic(arabic.activity) && hasArabic(arabic.archive), JSON.stringify(arabic)],
  ['the rail is not longer — they live inside the collapsed Reference group',
    !nav.rail.some((t) => /Activity & Audit|^·?Archive$/.test(t)), JSON.stringify(nav.rail)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
