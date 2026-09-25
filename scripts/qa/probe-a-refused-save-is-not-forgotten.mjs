/* probe-a-refused-save-is-not-forgotten.mjs — a change the database refused is not quietly
   discarded: the badge says where the change actually is, and the next visit says what was lost.

   Fire #206. Driven end to end against the real database with every write answered 500. The moment
   of failure was handled well — red pill "Save issue: …", red badge, retry with backoff, a browser
   warning on closing the tab, and the edit genuinely on the device (localStorage
   `directBusinessData_v29`, checked at that second). One step later it was not:

       AFTER RELOAD: {"editStillInApp":false,"editStillOnDevice":false,"badge":"Synced 9h ago"}

   The workspace loads from the cloud, the edit is gone from the app AND from the device, nothing
   on the screen says a change was lost, and the badge is green again because the last confirmed
   save is still the last confirmed save. Meanwhile the badge at the moment of failure had said
   **"Not synced — saved on this device"** — which invites exactly the action that loses the work.

   Fixed as a pair: the badge now says "Not synced — in this tab only" (js/75), js/02 remembers the
   refusal in `db_unsent_v1` where a reload cannot erase it, and js/102 says what was lost on the
   way back in, through the app's existing notice card.

   What this holds:
     1. a refused save turns the badge red and says the change is in this tab only — never that it
        is "saved on this device";
     2. the refusal is remembered with the count, the record's name and the database's own reason;
     3. the brake, and the whole risk of this fix: when the app's OWN retry lands a few seconds
        later, the change did reach the server after all, so the refusal must be forgotten and the
        next visit must be silent. A version that only ever wrote the key would pass every other
        check here and then cry wolf about work that is perfectly safe;
     4. a refusal that nothing rescues IS said on the next load, naming the company and the
        database's reason;
     5. and it is said ONCE — a second load is silent, or the message becomes furniture;
     6. a save that simply succeeds leaves nothing behind;
     7. in Arabic the badge says the same thing in Arabic;
     8. no JS errors.

   The writes are answered by this probe, not by the mock, so both outcomes are exact: a refusal is
   a real 500 with a message, and a success echoes back every row the app sent (fewer rows would
   trip the app's own M13 "silent refusal" check and make the success case lie).

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both real runs:
     · putting "saved on this device" back — fails 1 and 7, printing the phrase in both languages;
     · removing the clearUnsent() call on a successful save — fails 3, and the failure line shows
       the refusal that was never forgotten beside the green badge that says the work is safe.
   The probe's own first cut tested the green state with /Synced/i, which matches "**Not** synced"
   — it broke out of the recovery wait immediately and reported a working app as broken. The green
   state is anchored (/^Synced\b/i) for exactly that reason.
   Run: node scripts/qa/probe-a-refused-save-is-not-forgotten.mjs                                 */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9236 — one mock. */
const PORT = 9236; const BASE = 'http://localhost:' + PORT;
const REASON = 'the database said no (QA)';

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
/* a beforeunload prompt must be ACCEPTED or the reload never happens — dismissing it keeps the
   page, which looks exactly like a hung probe */
p.on('dialog', (d) => { try { if (d.type() === 'beforeunload') return d.accept(); } catch (_) {} return d.dismiss(); });

/* step F's helper: on a load that asks for it, a refusal note appears AFTER the page has started —
   exactly what this page's own failed save writes — so js/102 must not report it as a lost reload */
await p.addInitScript(() => {
  try {
    if (localStorage.getItem('qa_write_late') !== '1') return;
    localStorage.removeItem('qa_write_late');
    document.addEventListener('DOMContentLoaded', () => {
      try { localStorage.setItem('db_unsent_v1', JSON.stringify({ at: new Date().toISOString(), n: 1, names: ['QA late company'], why: 'written during this page (QA)' })); } catch (_) {}
    });
  } catch (_) {}
});

const WRITES = { refuse: true };
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname));
  if (isWrite) {
    if (WRITES.refuse) { await r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: REASON, code: 'XX000' }) }); return; }
    if (isRpc) { await r.fulfill({ status: 200, contentType: 'application/json', body: '""' }); return; }
    /* echo every row back, the shape the app selects — anything shorter is a silent refusal to it */
    let rows = []; try { rows = JSON.parse(rq.postData() || '[]'); } catch (_) { rows = []; }
    if (!Array.isArray(rows)) rows = [rows];
    const back = rows.map((x, i) => ({ id: x.id || ('qa-uuid-' + i), legacy_id: x.legacy_id || null, archived_at: null }));
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(back) }); return;
  }
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3500);

const MARK = 'QA-UNSENT-';
const editAndSave = (tag) => p.evaluate((mk) => {
  try {
    const b2 = (DB.businesses || [])[0]; if (!b2) return 'no record';
    b2.notes = String(b2.notes || '') + ' ' + mk;
    if (typeof save === 'function') { save(); return 'saved:' + (b2.name || ''); }
    return 'no save()';
  } catch (e) { return 'ERR ' + e.message; }
}, MARK + tag);
const badge = () => p.evaluate(() => { const el = document.getElementById('v26_3SyncPill'); return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null; });
const unsent = () => p.evaluate(() => { try { const r = JSON.parse(localStorage.getItem('db_unsent_v1') || 'null'); return r ? { n: r.n, names: (r.names || []).length, why: r.why } : null; } catch (_) { return 'unreadable'; } });
const notice = () => p.evaluate(() => {
  const d = document.getElementById('v63Notice'); const t = d ? (d.innerText || '').replace(/\s+/g, ' ').trim() : null;
  return { shown: !!d,
    saysLost: !!t && /never reached the server|لم يصل إلى الخادم/.test(t),
    namesACompany: !!t && /this company|these companies|هذه الشركة|هذه الشركات/.test(t),
    saysWhy: !!t && t.indexOf('the database said no (QA)') >= 0,
    arabic: !!t && /[؀-ۿ]/.test(t) };
});
const reload = async () => {
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(6000);
};

/* A — the save is refused */
const editedName = await editAndSave('A');
await p.waitForTimeout(4000);
const failBadge = await badge();
const remembered = await unsent();

/* B — the Arabic wording of the same state */
await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render(); } catch (_) {} });
await p.waitForTimeout(1500);
const failBadgeAr = await badge();
await p.evaluate(() => { try { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); } catch (_) {} });
await p.waitForTimeout(1200);

/* C — the brake that matters: the app's own retry lands, so the change DID reach the server in the
   end. The refusal must be forgotten, or the next visit cries wolf about work that is safe. */
WRITES.refuse = false;
let recovered = null;
for (let i = 0; i < 14; i++) { await p.waitForTimeout(3000); recovered = await badge(); if (/^Synced\b/i.test(String(recovered))) break; }
const afterRecovery = await unsent();
await reload();
const quietAfterRecovery = await notice();

/* D — refused again, and this time nothing rescues it: the next load must say so, once */
WRITES.refuse = true;
await editAndSave('D');
await p.waitForTimeout(4000);
const rememberedAgain = await unsent();
await reload();
const told = await notice();
const afterTold = await unsent();
await reload();
const toldTwice = await notice();

/* E — a save that simply succeeds leaves nothing behind */
WRITES.refuse = false;
await editAndSave('E');
await p.waitForTimeout(5000);
const okBadge = await badge();
const okUnsent = await unsent();
await reload();
const quiet = await notice();

/* F — 2026-09-25: a note written while THIS page is open (a save that failed in its first seconds) is
   not "the page was loaded again before it could be sent". js/102 used to read the note only after
   sign-in, so on a slow machine it caught this page's own failure and reported it as a lost reload —
   the cause of probe-two-people-one-record-are-told's load-only failures. Now it reads what was there
   when the page started; this page's note waits for the next load, where it is true. */
await p.evaluate(() => { try { localStorage.setItem('qa_write_late', '1'); } catch (_) {} });
await reload();
const lateSilent = await notice();
const lateKept = await p.evaluate(() => { try { return !!localStorage.getItem('db_unsent_v1'); } catch (_) { return null; } });
await p.evaluate(() => { try { const n = document.getElementById('v63Notice'); if (n) n.remove(); } catch (_) {} });
await reload();
const lateToldNext = await p.evaluate(() => { const d = document.getElementById('v63Notice'); return d ? (d.innerText || '').indexOf('QA late company') >= 0 : false; });
await b.close(); srv.close?.();

const checks = [
  ['a refused save says the change is in this tab only — never "saved on this device"',
    /in this tab only/i.test(String(failBadge)) && !/saved on this device/i.test(String(failBadge)),
    JSON.stringify({ badge: failBadge, edit: String(editedName).slice(0, 6) })],
  ['the refusal is remembered with the count, the name and the database\'s reason',
    !!remembered && remembered !== 'unreadable' && remembered.n >= 1 && remembered.names >= 1 && remembered.why === REASON,
    JSON.stringify(remembered)],
  ['brake: the app\'s own retry lands, so the refusal is forgotten and the next visit is silent',
    /^Synced\b/i.test(String(recovered)) && afterRecovery === null && !quietAfterRecovery.shown,
    JSON.stringify({ badge: recovered, memory: afterRecovery, message: quietAfterRecovery.shown })],
  ['the next load says what was lost, names the company and gives the reason',
    !!rememberedAgain && told.shown && told.saysLost && told.namesACompany && told.saysWhy,
    JSON.stringify({ remembered: rememberedAgain, told })],
  ['it is said once — the load after that is silent, and the memory is cleared',
    !toldTwice.shown && afterTold === null, JSON.stringify({ secondLoad: toldTwice.shown, memory: afterTold })],
  ['a save that simply SUCCEEDS leaves nothing behind — green badge, no memory, no message',
    /^Synced\b/i.test(String(okBadge)) && okUnsent === null && !quiet.shown,
    JSON.stringify({ badge: okBadge, memory: okUnsent, message: quiet.shown })],
  ['in Arabic the badge says the same thing in Arabic',
    /[؀-ۿ]/.test(String(failBadgeAr)) && String(failBadgeAr).indexOf('في هذا التبويب فقط') >= 0 &&
    String(failBadgeAr).indexOf('محفوظ على هذا الجهاز') < 0,
    JSON.stringify(failBadgeAr)],
  ['a note written while this page is open is not reported as a lost reload — it waits, and the next load says it',
    !lateSilent.shown && lateKept === true && lateToldNext === true,
    JSON.stringify({ shownThisPage: lateSilent.shown, keptForNext: lateKept, toldNextLoad: lateToldNext })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
