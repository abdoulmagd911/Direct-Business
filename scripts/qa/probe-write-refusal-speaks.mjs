/* probe-write-refusal-speaks.mjs (2026-09-09, watch cycle 71) — a refusal that says nothing is
   indistinguishable from a broken button. Attack area (rr/dd).

   Cycle 32 closed the correctness half: eight Finance write paths now ask BOTH questions — is
   this a read-only share view, and does this person's role still allow the Finance page — and
   under either refusal not one row changes. probe-write-paths-both-halves-attacks holds that.

   It also recorded, without asking anything of it, what the app said while refusing: nothing.
   Every caller did the same thing when finCanWrite() said no — `return`. No alert, no console
   line, no change on screen. The database is safe and the person is told nothing at all.

   That session is ordinary, not theoretical. js/65's own guard names it — "a stale tab (or a role
   changed while it was open)" — and it is the shape cycle 32 measured: a TIER that still reads
   'admin' (so canFinEdit says yes) while the person's page access no longer includes Finance. The
   Finance page refuses that session IN WORDS. The buttons already drawn on it refused in silence.
   Someone who presses Delete and sees the invoice still sitting there cannot tell "you may not"
   from "it is broken", so they press it again — and learn nothing either time.

   And the sentence has to name the reason that actually applied. Telling an admin "only admins
   may change Finance data" is worse than saying nothing: it is a claim they can disprove in one
   glance, and it sends them to the wrong person for a fix.

   Under test:
     1. Control — as a fully allowed admin every path really does change the database AND says
        nothing. A refusal spoken to someone who is allowed is a worse defect than the silence
        this probe exists to close, so it is a control, not a footnote.
     2. THE ATTACK — under a role that no longer allows Finance, every write path SAYS SO. This
        is the load-bearing check.
     3. The reason is the true one: under that role the words are about access to the page, and
        must NOT tell an admin that only admins may do this.
     4. Under a read-only share view the words name the share link — three distinct reasons, not
        one sentence stretched over all of them.
     5. And still nothing is written under either refusal — a regression guard on cycle 32, so
        that "it speaks now" can never be bought by loosening the guard that made it refuse.

   2026-09-09 (watch cycle 72) — A FOURTH REASON, because cycle 71's sentence made a false one
   audible. canFinEdit() is `__userTier==='admin'||__userTier==='manager'`, so a tier that has not
   LOADED reads as a tier that is NOT ENOUGH, and an actual admin was being told "Changing Finance
   data is limited to admins and managers". Timed on a boot: the write functions exist 141 ms
   before __roleKnown turns true, and with ONE transient error on the role lookup — js/02's
   deliberate "let them in on the floor, keep trying" path — the window is 5.2 seconds of a fully
   drawn Finance page, repeating on every retry. Throughout it __userTier is `undefined`, never a
   string. The guard is not widened: an unknown tier still refuses and finCanWrite() still says no,
   which check 6 asserts directly, so the new sentence cannot have been bought with a weaker guard.
   The last section reboots the page with the role lookup failing and presses a write inside the
   REAL window, so the simulated state is anchored to the measured one rather than assumed.

   Run:  node scripts/qa/probe-write-refusal-speaks.mjs        (port 8739)
   Sabotage: make finRefuseWrite() return true without alerting (js/16) — checks 2, 3 and 4 go
   red while 1 and 5 stay green, which is exactly the pre-cycle-71 app. Restore byte-identical
   (md5) and confirm the marker is gone by grep, not only by hash (cycle 44).                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8739;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SEED = [];
for (let i = 0; i < 7; i++) {
  const mo = (i % 6) + 1, d = '2026-' + String(mo).padStart(2, '0') + '-1' + (i % 8);
  SEED.push({
    id: 'r' + i, invoice_no: 'RF-' + i, line_no: 1, zatca_dpin: null,
    client_group: 'Refusal Co ' + (i % 3), customer_raw_name: 'Refusal Co ' + (i % 3),
    invoice_date: d, year: 2026, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: 10000 + i * 100, wallet_portion_sar: 0, revenue_sar: 10000 + i * 100,
    cost_sar: 6000, profit_sar: 4000 + i * 100, vat_sar: 0,
    amount_received_sar: 10000 + i * 100, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'rf-qa',
    /* RF-3 and RF-4 are seeded AWAY from the values finSetOrigin/finSetWay fall back to with no
       editor on screen ('booking' / 'invoice'), or the control write would store what was already
       there and the diff would read a real write as "changed nothing" (the trap cycle 32's probe
       fell into on its first run). */
    revenue_way: i === 4 ? 'commission' : 'invoice', origin: i === 3 ? 'project' : 'booking', proposal_ref: i === 3 ? 'PR-9' : null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    deleted_at: (i === 5 || i === 6) ? '2026-08-01T00:00:00Z' : null,   /* one per restore path */
  });
}
const PRISTINE = JSON.parse(JSON.stringify(SEED));
const TARGETS = [];
const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_targets: TARGETS, finance_client_links: [], client_profiles: [] });
const resetFixture = () => { SEED.length = 0; PRISTINE.forEach((r) => SEED.push(JSON.parse(JSON.stringify(r)))); TARGETS.length = 0; };
const BASE = 'http://localhost:' + PORT;
const snapshot = async () => {
  const inv = await fetch(BASE + '/rest/v1/finance_invoices?select=*').then((r) => r.json());
  const tgt = await fetch(BASE + '/rest/v1/finance_targets?select=*').then((r) => r.json());
  return JSON.stringify({
    inv: (inv || []).map((r) => [r.invoice_no, r.deleted_at, r.origin, r.proposal_ref, r.revenue_way]).sort(),
    tgt: (tgt || []).map((t) => [t.year, t.expected_sar]).sort(),
  });
};

/* The words each reason must own, and the words it must NOT say. Kept here rather than as one
   regex per check so that "says something" and "says the right thing" cannot quietly become the
   same test.

   TWO VOCABULARIES ON PURPOSE. js/49 wraps finSetTargets and finSetWay (and nothing else on this
   list) and refuses them with its own modal before the function body is ever entered, so those
   two already spoke — in js/49's words — while the other six said nothing. This probe's first
   run reported both of them as "silent" because it was listening to window.alert and js/49 draws
   a box; the same trap the README names — a probe that reads the model cannot see what lives in
   the view. So the refusal is read from BOTH places, and either vocabulary is accepted as long
   as it names the reason that actually applied. js/49 governs every page and is not this lane's
   to rewrite, so the two mechanisms are recorded rather than merged. */
const ACCESS_WORDS = /finance page is no longer open|access no longer includes|do not have access to that page|لم تعد صفحة المالية|لم تعد تشمل|ليست لديك صلاحية/i;
const SHARE_WORDS  = /read-only share|view-only link|read-only copy|رابط مشاركة|رابط للعرض فقط|للعرض فقط/i;
const TIER_WORDS   = /admins and managers|access level is|للمدراء والمسؤولين/i;
const UNKNOWN_WORDS= /has not finished loading|try again in a moment|لم ينته تحميل|أعد المحاولة بعد لحظة/i;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); } catch (_) {}
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  try { await p.waitForFunction(() => typeof window.finRefuseWrite === 'function' || typeof window.finCanWrite === 'function', { timeout: 90000 }); } catch (_) {}
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 160 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  await p.waitForTimeout(900);

  if (!(await p.evaluate(() => typeof window.finRefuseWrite === 'function'))) {
    fail('window.finRefuseWrite does not exist — the eight write paths have no way to say why they refused, so every check below would be measuring the wrong thing');
    console.log('\nFAILED — 1 check did not pass.'); await b.close(); srv.close(); process.exit(1);
  }

  /* Every confirm and prompt answered yes, so a guard is the only thing that can stop a write —
     and the alert is captured rather than swallowed, because it is the thing under test. */
  const arm = () => p.evaluate(() => {
    window.__said = [];
    window.confirm = function () { return true; };
    window.prompt = function () { return '123456'; };
    window.alert = function (m) { window.__said.push(String(m)); };
    if (window.pfConfirm) window.pfConfirm = function (msg, onYes) { onYes(); };
    /* clear any modal left over from the previous attempt, or the next one inherits its words */
    try { const b = document.getElementById('v70box'); if (b) b.remove(); } catch (_) {}
  });
  const WRITES = [
    ['finSetTargets',  'the targets editor',      () => window.finSetTargets(2026)],
    ['finDelInv',      'delete by invoice number', () => window.finDelInv('RF-1')],
    ['finRestoreInv',  'restore by invoice number',() => window.finRestoreInv('RF-5')],
    ['finDel',         'delete by id',            () => { const r = (FIN.rows || []).find((x) => x.invoice_no === 'RF-2'); if (r) window.finDel(r.id); }],
    ['finRestore',     'restore by id',           () => { const r = (FIN.rows || []).find((x) => x.invoice_no === 'RF-6'); if (r) window.finRestore(r.id); }],
    ['finSetOrigin',   'the origin editor',       () => window.finSetOrigin('RF-3')],
    ['finSetWay',      'the revenue-way editor',  () => window.finSetWay('RF-4')],
  ];
  /* v65Commit is the eighth path and cannot be a write control: with no reviewed batch on screen
     it returns on `if(!FILES_STATE)return;` whatever the guard says. It is carried through the
     refusal rounds only, where the guard runs first — and it is the path where silence costs the
     most, because the person has just reviewed a batch and pressed Commit. */
  const COMMIT = ['v65Commit', 'the import commit', () => { if (typeof window.v65Commit === 'function') window.v65Commit(); }];

  /* Everything the app said, from both places it can say it: the alert this lane writes, and the
     modal js/49 draws over the page for the two functions it wraps. */
  const run = async (body) => {
    await arm();
    await p.evaluate(`(${body.toString()})()`);
    await p.waitForTimeout(1500);
    return p.evaluate(() => {
      const said = (window.__said || []).slice();
      try { const b = document.getElementById('v70box'); if (b && b.innerText) said.push('ON SCREEN: ' + b.innerText.replace(/\s+/g, ' ').trim()); } catch (_) {}
      return said.join(' | ');
    });
  };
  const reload = async () => {
    resetFixture();
    await p.evaluate(() => { FIN.rows = null; FIN.targets = null; finLoad(); });
    for (let i = 0; i < 90 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(200);
  };
  const setHalf = (setup) => p.evaluate(setup);
  const clearHalf = () => p.evaluate(() => {
    window.__isShareView = false; window.__userTier = 'admin';
    try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; }
    try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; }
  });

  /* ---------- 1. control: allowed, so it writes AND stays quiet ---------- */
  let ctlBad = 0;
  for (const [fn, label, body] of WRITES) {
    await reload();
    const before = await snapshot();
    const said = await run(body);
    const after = await snapshot();
    if (before === after) { ctlBad++; fail(`control: as an allowed admin, ${label} (${fn}) changed nothing — every refusal below would then pass for the wrong reason`); }
    else if (ACCESS_WORDS.test(said) || SHARE_WORDS.test(said) || TIER_WORDS.test(said) || UNKNOWN_WORDS.test(said)) { ctlBad++; fail(`control: as an allowed admin, ${label} (${fn}) wrote the row and STILL read out a refusal: ${JSON.stringify(said.slice(0, 160))}. Telling someone who is allowed that they are not is a worse fault than the silence this probe closes`); }
    else ok(`control: as an allowed admin, ${label} (${fn}) changes the database and says no refusal`);
    await reload();
  }
  {
    await reload();
    const said = await run(COMMIT[2]);
    if (ACCESS_WORDS.test(said) || SHARE_WORDS.test(said) || TIER_WORDS.test(said) || UNKNOWN_WORDS.test(said)) { ctlBad++; fail(`control: as an allowed admin, ${COMMIT[1]} (${COMMIT[0]}) read out a refusal with nothing wrong: ${JSON.stringify(said.slice(0, 160))}`); }
    else ok(`control: as an allowed admin, ${COMMIT[1]} (${COMMIT[0]}) says no refusal (it writes nothing here — there is no reviewed batch on screen — so it is carried for the refusal rounds only)`);
    await reload();
  }
  if (ctlBad) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); await b.close(); srv.close(); process.exit(1); }

  /* ---------- 2, 3, 4, 5. the two refusals ---------- */
  const HALVES = [
    ['a role that no longer allows the Finance page', ACCESS_WORDS, TIER_WORDS,
      'told an admin that only admins and managers may change Finance data — a claim they can disprove at a glance, and it sends them to the wrong person',
      () => { window.__isShareView = false; window.__userTier = 'admin'; window.__accessKnown = function () { return true; }; window.myAllowedPages = function () { return ['leads']; }; }],
    ['a read-only share view', SHARE_WORDS, null, null,
      () => { window.__isShareView = true; }],
    /* The measured boot state, reproduced exactly: __userTier absent and __roleKnown absent, which
       is what a timed sign-in shows for 141 ms on a healthy connection and 5.2 s after one failed
       role lookup. Not a guess about what "loading" looks like — the last section of this probe
       reboots into the real thing and checks the same sentence comes out. */
    ['a tier that has not finished loading', UNKNOWN_WORDS, TIER_WORDS,
      'told someone whose access level had not arrived yet that only admins and managers may change Finance data — for the admin this actually is, that is false, and it sends them to ask for a permission they already have',
      () => {
        window.__isShareView = false;
        try { delete window.__userTier; } catch (_) { window.__userTier = undefined; }
        try { delete window.__roleKnown; } catch (_) { window.__roleKnown = undefined; }
        try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; }
        try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; }
      }],
  ];
  for (const [half, wanted, forbidden, forbiddenWhy, setup] of HALVES) {
    await clearHalf(); await setHalf(setup); await reload();
    const st = await p.evaluate(() => ({
      canFinEdit: typeof window.canFinEdit === 'function' ? window.canFinEdit() : null,
      finCanWrite: typeof window.finCanWrite === 'function' ? window.finCanWrite() : null,
      maySee: typeof window.finMaySeeMoney === 'function' ? window.finMaySeeMoney() : null,
      block: typeof window.finWriteBlock === 'function' ? window.finWriteBlock() : null,
    }));
    note(`under ${half}: canFinEdit ${st.canFinEdit} · finCanWrite ${st.finCanWrite} · finMaySeeMoney ${st.maySee} · finWriteBlock '${st.block}'`);
    if (st.finCanWrite === false) ok(`control: under ${half} the session really is refused (finCanWrite says no), so what follows is about what it SAYS, not whether it refuses`);
    else { fail(`control: under ${half} finCanWrite says ${st.finCanWrite} — this half is not set up and nothing below is tested`); await clearHalf(); await reload(); continue; }

    let mute = 0, wrong = 0, leaked = 0;
    for (const [fn, label, body] of WRITES.concat([COMMIT])) {
      await reload();
      const before = await snapshot();
      const said = await run(body);
      const after = await snapshot();
      if (before !== after) { leaked++; fail(`under ${half}: ${label} (${fn}) CHANGED THE DATABASE — cycle 32's guard has been loosened, and a spoken refusal bought with a real write is not a fix`); }
      if (!said) { mute++; fail(`under ${half}: ${label} (${fn}) refused in complete silence. Nothing was written and nothing was said, so the person cannot tell "you may not" from "this button is broken" — they will press it again`); }
      else if (!wanted.test(said)) { wrong++; fail(`under ${half}: ${label} (${fn}) said something, but not the reason that applied: ${JSON.stringify(said.slice(0, 200))}`); }
      else if (forbidden && forbidden.test(said)) { wrong++; fail(`under ${half}: ${label} (${fn}) ${forbiddenWhy}. It said: ${JSON.stringify(said.slice(0, 200))}`); }
      else ok(`under ${half}: ${label} (${fn}) refuses and says why — "${said.slice(0, 90)}${said.length > 90 ? '…' : ''}"`);
      await reload();
    }
    const REASON_NAME = { 'a read-only share view': 'the share link', 'a tier that has not finished loading': 'the answer not having arrived yet' };
    if (!mute && !wrong) ok(`all ${WRITES.length + 1} write paths name ${REASON_NAME[half] || 'the page access'} as the reason — one sentence per reason, not one sentence for every refusal`);
    if (!leaked) ok(`and under ${half} not one of the ${WRITES.length + 1} paths changed the database — cycle 32's guard still holds`);
    await clearHalf(); await reload();
  }

  /* ---------- 7. the anchor: the same sentence, from a real boot rather than a simulation ----------
     Everything above deleted two globals to reproduce a state. This reboots the page with the role
     lookup failing once — js/02 hides the overlay and retries in 5 s, so the Finance page is drawn
     and interactive with no tier — and presses a write inside that window. If the simulated state
     and the real one ever diverge, this is what says so. */
  /* A FRESH CONTEXT, not this page. Re-navigating the page that has been driven for the whole
     probe did not re-run the sign-in flow at all — no role lookup was issued, so the injected
     failure had nothing to land on and the anchor reported "0 role lookups were failed": a setup
     that had stopped setting up while still looking like a check. A second context boots the app
     from nothing, which is the only honest way to stand inside a boot-time window. */
  {
    const ctx2 = await b.newContext({ viewport: { width: 1440, height: 1100 } });
    const p2 = await ctx2.newPage();
    let failRole2 = 1, roleFails2 = 0;
    await p2.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
      const rq = r.request(); const u = new URL(rq.url());
      if (failRole2 > 0 && /app_users/.test(u.pathname) && /must_change_password/.test(u.search)) {
        failRole2--; roleFails2++;
        return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"probe: transient failure on the role lookup"}' });
      }
      try {
        const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
        const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
        await r.fulfill({ status: resp.status, headers: h, body });
      } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
    });
    await p2.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
    await p2.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await p2.route('**fonts.gstatic.com/**', (r) => r.abort());
    await p2.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p2.waitForSelector('#cl_email', { timeout: 60000 });
    await p2.fill('#cl_email', 'test@directksa.com'); await p2.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
    await p2.click('#cl_go');
    /* Sample tightly: on a healthy boot this window is ~150 ms; with the failure it is ~5 s. */
    let st2 = null;
    for (let i = 0; i < 600; i++) {
      st2 = await p2.evaluate(() => ({
        hasFn: typeof window.finDelInv === 'function' && typeof window.finWriteBlock === 'function',
        tier: (typeof window.__userTier === 'undefined') ? null : String(window.__userTier),
        roleKnown: window.__roleKnown === true,
        block: (typeof window.finWriteBlock === 'function') ? window.finWriteBlock() : null,
      })).catch(() => null);
      /* Wait for the failure to have been SENT, not merely for the page to look empty. js/16
         defines the write functions at page load, long before sign-in, so the first sample already
         reads "functions present, no tier, role not known" — the earlier version broke there, on a
         window the role lookup had not even opened yet, and then failed itself for having failed
         no lookups. The window only exists once js/02 has asked and been refused. */
      if (roleFails2 === 1 && st2 && st2.hasFn && !st2.roleKnown && st2.tier === null) break;
      if (st2 && st2.roleKnown) break;
      await p2.waitForTimeout(20);
    }
    if (roleFails2 !== 1)
      fail(`the anchor did not set itself up: ${roleFails2} role lookup(s) were failed, expected exactly 1 — no window was opened, so nothing here is measuring the boot`);
    else if (!st2 || !st2.hasFn || st2.roleKnown || st2.tier !== null)
      fail(`the anchor did not set itself up: the boot never reached a "signed in, tier not yet known" moment (write functions ${st2 && st2.hasFn} · __userTier ${JSON.stringify(st2 && st2.tier)} · __roleKnown ${st2 && st2.roleKnown}). Nothing is concluded from it either way`);
    else {
      note(`inside the real window: __userTier ${JSON.stringify(st2.tier)} · __roleKnown ${st2.roleKnown} · finWriteBlock() '${st2.block}'`);
      const said2 = await p2.evaluate(() => {
        const out = [];
        window.confirm = () => true; window.prompt = () => '123456';
        window.alert = (m) => out.push(String(m));
        if (window.pfConfirm) window.pfConfirm = (msg, onYes) => onYes();
        try { window.finDelInv('RF-1'); } catch (e) { out.push('THREW ' + e.message); }
        try { const bx = document.getElementById('v70box'); if (bx && bx.innerText) out.push('ON SCREEN: ' + bx.innerText.replace(/\s+/g, ' ').trim()); } catch (_) {}
        return out.join(' | ');
      });
      if (UNKNOWN_WORDS.test(said2) && !TIER_WORDS.test(said2))
        ok(`anchor: on a real boot whose role lookup failed once, a write inside the window says the answer has not arrived — not that the person is not an admin. The simulated half above is the same state, not a convenient one: "${said2.slice(0, 90)}${said2.length > 90 ? '…' : ''}"`);
      else if (TIER_WORDS.test(said2))
        fail(`anchor: on a real boot, a write inside the window told the admin that only admins and managers may change Finance data — false, and it sends them to ask for a permission they already hold: ${JSON.stringify(said2.slice(0, 200))}`);
      else
        fail(`anchor: on a real boot, a write inside the window said ${said2 ? JSON.stringify(said2.slice(0, 200)) : 'nothing at all'} — neither the loading sentence nor the tier one, so what a person actually meets here is untested by everything above`);
    }
    await ctx2.close();
  }

  if (errors.length) note(`page errors seen: ${errors.slice(0, 3).join(' ; ')}`);
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nwrite-refusal-speaks OK — every Finance write path refuses in words, and the words name the reason that actually applied');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) {} process.exit(1); });
