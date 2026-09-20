/* probe-view-only-on-the-generator-means-it.mjs — a permission the owner sets has to be the
   permission the screen applies.

   Fire #184. "Generator" is one of the fifteen pages in the Team & Access matrix, and each person
   can be set to Viewer or Editor on it. Driven live with the matrix saying **Viewer**, all five
   editors offered "Save draft" AND "Issue …":

       Financial proposal      Save draft · Issue offer                              18 fields
       Service fees            Save draft · Issue proposal                           17
       Technical + financial   Save both drafts · Issue technical · Issue financial  54
       Company profile         Save draft · Issue profile                             3
       Contract                Save draft · Issue contract                           28

   and nothing on screen said otherwise. Each editor gated on the coarse role only — the four-role
   list `admin / manager / bd / team_member` — and never asked the matrix. "Issue" is not a draft:
   it takes a document number from the server and puts a document out under Direct's name. The
   database does not enforce this page (only Finance, Settings and Activity are enforced there),
   so the screen is the enforcement, and it was not enforcing.

   What this holds:
     1. set to Viewer on the Generator, NONE of the five editors offers Save or Issue;
     2. and the page says in words why, once;
     3. Print / PDF and Copy stay available to that person — looking and printing were never what
        was being withheld;
     4. an admin still has Save and Issue on every editor;
     5. so does somebody set to Editor on the Generator;
     6. while the matrix has NOT loaded, nothing is withheld and nothing is said;
     7. the sentence is only on the Generator — it is gone on another page;
     8. in Arabic the sentence is Arabic;
     9. no JS errors.

   Checks 3, 4, 5 and 6 are the brakes. A layer that withheld the buttons from everybody, or took
   printing away, or apologised during a slow load before the matrix had answered, would pass
   checks 1 and 2 and be worse than the defect it replaced — 6 especially, because the matrix
   arrives a moment AFTER the page has already drawn.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the
   role-only `canWrite()` back in js/67-71 fails check 1; dropping js/98 fails 2 and 8.
   Run: node scripts/qa/probe-view-only-on-the-generator-means-it.mjs                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9172; const BASE = 'http://localhost:' + PORT;

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

const srv = start(PORT, { businesses: [row({ id: 'g1', legacy_id: 'G1', name: 'QA Generator Probe Co', is_client: true, stage: 'won', converted_date: '2026-04-01' })], contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|next_document_number/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
await p.waitForTimeout(3000);

const EDITORS = ['Financial proposal', 'Service fees', 'Technical + financial', 'Company profile', 'Contract'];

function setWho(role, docs, loaded) {
  return p.evaluate(([r, d, l]) => {
    window.__userRole = r;
    window.__userTier = (r === 'admin') ? 'admin' : (r === 'manager') ? 'manager' : 'team';
    window.__roleKnown = true;
    window.__pageAccess = d ? { today: 'editor', documents: d } : null;
    window.__pageAccessLoaded = !!l;
    try { current = 'documents'; render(); } catch (_) {}
    return { role: window.__userRole, may: (typeof window.mayEditPage === 'function') ? window.mayEditPage('documents') : '(none)' };
  }, [role, docs, loaded]);
}

async function openEditor(label) {
  await p.evaluate(() => {
    const back = [].slice.call(document.getElementById('view').querySelectorAll('button'))
      .find((x) => /All documents/i.test(x.textContent || '')); if (back) back.click();
  });
  await p.waitForTimeout(1500);
  const hit = await p.evaluate((t) => {
    const btn = [].slice.call(document.getElementById('view').querySelectorAll('button'))
      .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim().indexOf(t) === 0);
    if (btn) { btn.click(); return true; } return false;
  }, label);
  await p.waitForTimeout(3200);
  if (!hit) return { notFound: label };
  return p.evaluate(() => {
    const v = document.getElementById('view');
    const btns = [].slice.call(v.querySelectorAll('button')).map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return {
      writeBtns: btns.filter((x) => /^(Save|Issue|حفظ|إصدار)/i.test(x)),
      printBtns: btns.filter((x) => /Print|PDF|Copy|طباعة|نسخ/i.test(x)),
      note: ((document.getElementById('v98-viewonly') || {}).textContent || '').trim(),
    };
  });
}

/* ---- Viewer on the Generator: all five ---- */
await setWho('team_member', 'viewer', true);
await p.waitForTimeout(1800);
const asViewer = [];
for (const e of EDITORS) asViewer.push({ e, ...(await openEditor(e)) });

/* ---- the same person, on another page: the sentence must be gone ---- */
const elsewhere = await p.evaluate(() => {
  try { current = 'leads'; openLead = null; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => res(!!document.getElementById('v98-viewonly')), 2200));
});

/* ---- Arabic ---- */
await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); current = 'documents'; render(); } catch (_) {} });
await p.waitForTimeout(2200);
const arabicNote = await p.evaluate(() => ((document.getElementById('v98-viewonly') || {}).textContent || '').trim());
await p.evaluate(() => { try { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); current = 'documents'; render(); } catch (_) {} });
await p.waitForTimeout(1800);

/* ---- Editor on the Generator ---- */
await setWho('team_member', 'editor', true);
await p.waitForTimeout(1800);
const asEditor = await openEditor('Financial proposal');

/* ---- admin ---- */
await setWho('admin', null, true);
await p.waitForTimeout(1800);
const asAdmin = await openEditor('Financial proposal');

/* ---- matrix not loaded yet: withhold nothing, say nothing. Two shapes, because the button
       gate and the banner have to agree about BOTH: the real in-flight state (no matrix yet)
       and a matrix present but not confirmed. The second is what caught the gate withholding
       buttons while the banner stayed silent — a page refusing without saying so. ---- */
/* a MANAGER for the no-matrix-at-all shape: js/52's floor list gives a team member only
   Today/Leads/Clients/Finance when no matrix has arrived, so such a person is not on the
   Generator to be tested at all — the manager floor does include it. */
await setWho('manager', null, false);
await p.waitForTimeout(1800);
const inFlightNull = await openEditor('Financial proposal');
await setWho('team_member', 'viewer', false);
await p.waitForTimeout(1800);
const inFlight = await openEditor('Financial proposal');
await b.close(); srv.close?.();

const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const noWrites = asViewer.filter((x) => (x.writeBtns || []).length === 0 && !x.notFound);
const said = asViewer.filter((x) => /view-only|not yours to do/i.test(x.note || ''));
const printed = asViewer.filter((x) => (x.printBtns || []).length > 0);

const checks = [
  ['set to Viewer, none of the five editors offers Save or Issue',
    asViewer.length === 5 && noWrites.length === 5,
    asViewer.map((x) => x.e + ':' + (x.notFound ? 'NOT FOUND' : (x.writeBtns || []).join('/') || 'none')).join(' · ')],
  ['and the page says why, once', said.length === 5, (asViewer[0] || {}).note ? asViewer[0].note.slice(0, 70) + '…' : '(nothing said)'],
  ['Print / PDF and Copy stay available to that person', printed.length === 5,
    JSON.stringify((asViewer[0] || {}).printBtns)],
  ['an admin still has Save and Issue', (asAdmin.writeBtns || []).length >= 2 && !asAdmin.note,
    JSON.stringify(asAdmin.writeBtns)],
  ['so does somebody set to Editor on the Generator', (asEditor.writeBtns || []).length >= 2 && !asEditor.note,
    JSON.stringify(asEditor.writeBtns)],
  ['while the matrix has not loaded, nothing is withheld and nothing is said',
    (inFlightNull.writeBtns || []).length >= 2 && !inFlightNull.note &&
    (inFlight.writeBtns || []).length >= 2 && !inFlight.note,
    JSON.stringify({ noMatrix: inFlightNull.writeBtns, unconfirmed: inFlight.writeBtns,
      notes: (inFlightNull.note || '') + (inFlight.note || '') })],
  ['the sentence is only on the Generator', elsewhere === false, String(elsewhere)],
  ['in Arabic the sentence is Arabic', hasArabic(arabicNote) && !/view-only/i.test(arabicNote),
    (arabicNote || '(nothing)').slice(0, 60)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
