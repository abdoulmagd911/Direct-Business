/* probe-an-empty-answer-is-not-a-zero.mjs — when no finance rows reach the browser, Finance says
   so instead of reporting that the company earned nothing.

   Fire #196, found by driving the LIVE app signed in as a **team_member** — the role 7 of the 11
   real accounts have, and the role this project's own rules say to test as. Finance is offered in
   that role's navigation. Opening it showed:

       0 invoices · data through —
       Revenue 0 SAR · Cost 0 SAR · Profit 0 SAR · Received 0 SAR
       Of expected achieved · 0%          ← against a real, correctly-loaded target
       a twelve-month revenue-and-profit chart of zeros

   The book at that moment held 46 invoices and 2,030,764 SAR. Nothing was broken and nothing
   errored: PostgREST answers a row-level-security refusal with **HTTP 200 and an empty list**.
   Captured on the wire during that drive — `GET finance_invoices -> 200 rows: 0 bytes: 2`, eight
   times — while `finance_targets` came back with 2 rows, which is why the page could draw a target
   and report 0% of it achieved.

   So every figure on the tab was a statement about the company derived from a list that only ever
   described what this account is allowed to read. Seven of eleven people see that page.

   Fire #56 found the signed-OUT twin of this — Finance rendering before sign-in, caching the empty
   answer — and fixed it by keeping `FIN.rows` null until a session exists. This is the signed-IN
   one: the session is real, the answer is final, and it is empty because of who is asking. The page
   cannot tell "nothing was earned" from "not yours to read", because nothing in the response
   distinguishes them, so it must not pick one. It now says both, and the attainment percentage —
   the one figure that is pure inference from an absent numerator — stands down to "—".

   What this holds:
     1. with rows loaded, there is no such notice and the tab reports normally;
     2. when the load finishes and brings NOTHING, the notice is on screen;
     3. and the attainment reads "—" with its reason, not a percentage;
     4. the notice is in Arabic in Arabic;
     5. while the rows are still loading (`FIN.rows` null — fire #56's state), the notice stays
        away: "not arrived yet" is a different sentence from "not arrived at all";
     6. a period filter that legitimately matches no invoices does NOT raise it — a true zero must
        never be dressed up as an unreadable one;
     7. no JS errors in either language.

   Checks 5 and 6 are the brakes, and they are the whole reason the trigger is "FIN.rows is an
   empty ARRAY" rather than "the figures are zero". A version keyed off zero totals would pass 1 to
   4 and fail both: it would fire during loading, and it would fire on any quarter nobody invoiced
   in — telling a manager his own empty quarter might be a permissions problem.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both runs real:
     · removing the notice from the Performance header — fails 2 and 4;
     · keying the trigger off the FILTERED set (`verified().filter(finInPeriod).length===0`) rather
       than the loaded-and-empty test — fails 6 alone, and that is worth knowing precisely: it
       still passes 5, because with `FIN.rows` null that expression throws and the catch returns
       false, so the loading brake is satisfied by accident rather than by design. Check 6 is the
       one that actually holds this trigger honest.
   Run: node scripts/qa/probe-an-empty-answer-is-not-a-zero.mjs                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9229 — one mock. */
const PORT = 9229; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
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

await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(4000);
await p.evaluate(() => { current = 'finance'; render(); });
await p.waitForTimeout(4000);

/* Hold the loader off before touching FIN. `finLoad` returns immediately when FIN.loading is
   true, and without that every render() re-fetches and puts the harness's 17 rows (and its own
   targets) straight back — the first run of this probe set FIN.rows=null, rendered, and read
   array:17 back. The state under test has to survive the render that displays it.
   The attainment line also only exists when a target for the year does, so it gets one here:
   check 3 is about the wording, not about the harness's target table. */
await p.evaluate(() => {
  try {
    FIN.loading = true;
    const y = (new Date()).getFullYear();
    FIN.targets = FIN.targets || [];
    if (!FIN.targets.some((t) => +t.year === y)) FIN.targets.push({ year: y, expected_sar: 1000000, confirmed_sar: 500000 });
    window.__qaTargets = FIN.targets.slice();
    FIN.p.year = 'all'; FIN.p.part = 'all';
    render();
  } catch (_) {}
});
await p.waitForTimeout(2500);
/* every later state change goes through this, so the loader can never quietly undo it */
const setRows = async (mk) => { await p.evaluate((how) => {
  try { FIN.loading = true; FIN.targets = (window.__qaTargets || FIN.targets || []).slice();
    FIN.rows = (how === 'null') ? null : (how === 'empty') ? [] : (window.__qaKept || FIN.rows);
    current = 'finance'; render(); } catch (_) {}
}, mk); await p.waitForTimeout(2500); };

const look = () => p.evaluate(() => {
  const v = document.querySelector('#view'); const t = v ? (v.innerText || '') : '';
  return { notice: !!document.querySelector('[data-fin-norows]'),
    noticeAr: (() => { const n = document.querySelector('[data-fin-norows]'); return !!(n && /[؀-ۿ]/.test(n.textContent || '')); })(),
    standDown: /Cannot be worked out|لا يمكن حسابها/.test(t),
    attainmentPct: /Of expected achieved · \d+%|نسبة تحقق المتوقع · \d+%/.test(t),
    rowsState: (() => { try { return FIN.rows === null ? 'null' : (Array.isArray(FIN.rows) ? ('array:' + FIN.rows.length) : typeof FIN.rows); } catch (_) { return '?'; } })() };
});

const withRows = await look();

/* a period nobody invoiced in — rows still loaded, the zero is a true zero */
await p.evaluate(() => { try { FIN.loading = true; FIN.p.year = '1999'; render(); } catch (_) {} });
await p.waitForTimeout(2500);
const emptyPeriod = await look();
await p.evaluate(() => { try { FIN.loading = true; FIN.p.year = 'all'; render(); } catch (_) {} });
await p.waitForTimeout(1500);

/* still loading — fire #56's state */
const kept = await p.evaluate(() => { try { window.__qaKept = FIN.rows; return true; } catch (_) { return false; } });
await setRows('null');
const loading = await look();

/* the load finished and brought nothing at all */
await setRows('empty');
const empty = await look();

await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) {} });
await p.waitForTimeout(800);
await setRows('empty');
const emptyAr = await look();

await b.close(); srv.close?.();

const checks = [
  ['with rows loaded there is no such notice, and the tab reports normally',
    withRows.notice === false && withRows.standDown === false && withRows.attainmentPct === true,
    JSON.stringify(withRows)],
  ['when the load finishes and brings nothing, the notice is on screen',
    empty.notice === true, JSON.stringify({ rows: empty.rowsState, notice: empty.notice })],
  ['and the attainment reads "—" with its reason, not a percentage',
    empty.standDown === true && empty.attainmentPct === false,
    JSON.stringify({ standDown: empty.standDown, stillAPercentage: empty.attainmentPct })],
  ['the notice is in Arabic in Arabic',
    emptyAr.notice === true && emptyAr.noticeAr === true && emptyAr.standDown === true,
    JSON.stringify({ notice: emptyAr.notice, arabic: emptyAr.noticeAr, standDown: emptyAr.standDown })],
  ['while the rows are still loading the notice stays away',
    loading.notice === false && loading.rowsState === 'null',
    JSON.stringify({ rows: loading.rowsState, notice: loading.notice })],
  ['a period that legitimately matches no invoices does not raise it',
    emptyPeriod.notice === false && emptyPeriod.rowsState.indexOf('array:') === 0 && emptyPeriod.rowsState !== 'array:0',
    JSON.stringify({ rows: emptyPeriod.rowsState, notice: emptyPeriod.notice })],
  ['the fixture really did exercise all three states',
    withRows.rowsState.indexOf('array:') === 0 && withRows.rowsState !== 'array:0' && kept === true && empty.rowsState === 'array:0',
    JSON.stringify({ loaded: withRows.rowsState, empty: empty.rowsState })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
