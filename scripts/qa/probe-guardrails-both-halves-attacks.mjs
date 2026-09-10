/* probe-guardrails-both-halves-attacks.mjs (2026-09-06, watch cycle 33) - js/62's own write surface,
   driven against BOTH reasons the Finance page is refused.

   The guardrails file owns the standing exclusion list, the alias grouping map, the duplicate-company
   finder and the merge/undo pair - the machinery that decides whose money is whose. Its eight write
   functions all route through canEdit62(), which delegates to finCanWrite(), so they SHOULD have
   inherited cycle 32's fix for free. "Should have" is exactly the claim this watch does not accept
   on inspection: cycle 32 found five write paths open after four cycles of guarding write paths, and
   the same missing question has now been found on five surfaces. So it is measured.

   js/62 is IN this lane, which is why it is checked here rather than flagged.

   Under test, for each of the eight:
     1. Positive control - as an allowed admin it really does change stored state, proved by diffing
        the settings blob and the business tables before and after. Otherwise the refusals below pass
        for the wrong reason.
     2. Under a read-only share view it changes nothing.
     3. Under a role that denies the Finance page it changes nothing.
   The two dialog openers are checked on whether the dialog appears, since they store nothing
   themselves; the merge pair is checked on whether the RPC is even attempted.

   Run:  node scripts/qa/probe-guardrails-both-halves-attacks.mjs        (port 8249)
   Sabotage (file-level): make canEdit62 fall back to canFinEdit. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8249;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);

const srv = start(PORT, { finance_invoices: [], finance_transactions: [] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  const rpcCalls = [];
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (/\/rest\/v1\/rpc\/fn_(merge|unmerge)_businesses/.test(u.pathname)) rpcCalls.push(u.pathname.split('/').pop());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);

  /* two companies to merge, and a known starting state for the settings blob */
  await p.evaluate(() => {
    DB.businesses = DB.businesses || [];
    DB.businesses.push({ id: 'gr-keep', uuid: 'gr-keep', name: 'Guardrail Keep Co', isClient: true });
    DB.businesses.push({ id: 'gr-drop', uuid: 'gr-drop', name: 'Guardrail Drop Co', isClient: true });
    DB.settings = DB.settings || {};
    DB.settings.financeExclusions = [{ id: 'fx-seed', clientId: '99', matchNames: ['Seed Excluded Co'], reason: 'QA seed', addedBy: 'probe', addedAt: '2026-01-01T00:00:00Z' }];
    DB.settings.bizDupDismissed = ['seed-key'];
    current = 'finance'; render();
  });
  await p.waitForTimeout(1000);

  /* state that any of the eight could move */
  const stateOf = () => p.evaluate(() => JSON.stringify({
    excl: ((DB.settings || {}).financeExclusions || []).map(e => e.id).sort(),
    dup: ((DB.settings || {}).bizDupDismissed || []).slice().sort(),
    groups: ((DB.settings || {}).financeGroups || (DB.settings || {}).clientAliases || []).length,
    /* only the two fixture companies: the rest of DB.businesses moves for reasons unrelated to
       the function under test */
    biz: (DB.businesses || []).filter(x => /^gr-(keep|drop)$/.test(x.id || '')).map(x => (x.id) + ':' + (x.archived ? 'A' : 'L')).sort()
  }));
  /* The merge calls location.reload() 600ms after its RPC succeeds. In the first working run that
     reload landed in the MIDDLE of the later loop and tore the fixture down, so a check that had
     nothing to do with it (remove-an-exclusion under a share view) reported a change that was
     really the page reloading. What is under test is whether the RPC is reached, not the reload,
     so it is stubbed — and every arm() re-stubs it, because a reload would restore the real one. */
  const arm = () => p.evaluate(() => {
    window.__a = null;
    window.confirm = function () { return true; };
    window.prompt = function () { return 'x'; };
    window.alert = function (m) { window.__a = String(m); };
    /* 2026-09-09 (live test D1 family): js/62 asks through askInPage (js/57's box) and reports
       through js/63's notice now — stub both the same way the native pair is stubbed above */
    window.askInPage = function (m, y) { y(); };
    window.v63Notice = function (m) { window.__a = String(m); };
    try { window.__reloads = (window.__reloads || 0); const L = window.location; if (!L.__stubbed) { Object.defineProperty(L, 'reload', { configurable: true, value: function () { window.__reloads++; } }); L.__stubbed = true; } } catch (_) { }
  });
  const modalOpen = () => p.evaluate(() => {
    const ov = document.getElementById('ov');
    return !!(ov && ov.classList && ov.classList.contains('show'));
  });
  const closeModal = () => p.evaluate(() => { try { if (typeof closeModal === 'function') closeModal(); } catch (_) { } const ov = document.getElementById('ov'); if (ov && ov.classList) ov.classList.remove('show'); });

  /* the modal-driven exclusion add: open it, fill it, press Save the way a person does */
  const addExclusion = async () => {
    await arm();
    await p.evaluate(() => { try { window.v62AddExclusion(); } catch (e) { } });
    await p.waitForTimeout(500);
    const opened = await modalOpen();
    if (opened) {
      await p.evaluate(() => {
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
        set('x_id', '4242'); set('x_reason', 'probe'); set('x_names', 'Probe Excluded Co');
        const s = document.getElementById('mSave'); if (s) s.click();
      });
      await p.waitForTimeout(700);
    }
    await closeModal();
    return opened;
  };

  const SIMPLE = [
    ['v62RemoveExclusion', 'remove an exclusion', () => window.v62RemoveExclusion('fx-seed')],
    ['v62DismissDup', 'dismiss a duplicate pair', () => window.v62DismissDup('probe-dup-key')],
    ['v62UndismissDups', 'clear the dismissed duplicates', () => window.v62UndismissDups()],
    ['v62UndoGrouping', 'undo a grouping', () => window.v62UndoGrouping('any')],
    ['v62RedoGrouping', 'redo a grouping', () => window.v62RedoGrouping('any')]
  ];
  const OPENERS = [
    ['v62OpenAddGrouping', 'the add-grouping dialog', () => window.v62OpenAddGrouping(['a'], 'n')],
    ['v62OpenGrouping', 'the grouping dialog', () => window.v62OpenGrouping()]
  ];
  const runSimple = async (body) => { await arm(); await p.evaluate(`(${body.toString()})()`); await p.waitForTimeout(900); };
  /* The merge control's RPC makes the app re-read app_settings, and that reload can land BETWEEN a
     before-snapshot and its after-snapshot — which is what produced the first "v62RemoveExclusion
     changed stored state" red. The diff gave it away: the exclusion list did not lose fx-seed, it
     came back holding fx-qa-takamol, the MOCK SEED's own entry, which no guard failure could
     produce. So resetState now verifies the value it wrote is still there, and retries once. */
  const resetState = async () => {
    for (let i = 0; i < 3; i++) {
      await p.evaluate(() => {
        DB.settings = DB.settings || {};
        DB.settings.financeExclusions = [{ id: 'fx-seed', clientId: '99', matchNames: ['Seed Excluded Co'], reason: 'QA seed', addedBy: 'probe', addedAt: '2026-01-01T00:00:00Z' }];
        DB.settings.bizDupDismissed = ['seed-key'];
      });
      await p.waitForTimeout(350);
      const stuck = await p.evaluate(() => ((DB.settings || {}).financeExclusions || []).length === 1 && ((DB.settings || {}).financeExclusions || [])[0].id === 'fx-seed');
      if (stuck) return true;
    }
    fail('the fixture could not be held still — DB.settings keeps being replaced from the database, so no check below can distinguish a guard from a reload');
    return false;
  };

  /* ---------- 1. positive controls ---------- */
  const worksAsAdmin = {};
  let ctlBad = 0;
  await resetState();
  const addedAsAdmin = await addExclusion();
  const afterAdd = await stateOf();
  worksAsAdmin.v62AddExclusion = afterAdd.indexOf('fx-seed') >= 0 && afterAdd.length > 0 && (JSON.parse(afterAdd).excl.length > 1);
  if (addedAsAdmin && worksAsAdmin.v62AddExclusion) ok('control: as an allowed admin, adding an exclusion opens its dialog and stores the new entry');
  else { ctlBad++; fail(`control: adding an exclusion as an admin did not store anything (dialog opened: ${addedAsAdmin})`); }
  for (const [fn, label, body] of SIMPLE) {
    await resetState();
    const before = await stateOf();
    await runSimple(body);
    const after = await stateOf();
    worksAsAdmin[fn] = before !== after;
    if (before !== after) ok(`control: as an allowed admin, ${label} (${fn}) really does change stored state`);
    else note(`${label} (${fn}) changes nothing even as an allowed admin here — it has no work to do in this fixture, so its refusal below is NOT evidence and is reported as a measurement`);
  }
  for (const [fn, label, body] of OPENERS) {
    await closeModal(); await arm();
    await p.evaluate(`(${body.toString()})()`); await p.waitForTimeout(600);
    worksAsAdmin[fn] = await modalOpen();
    await closeModal();
    if (worksAsAdmin[fn]) ok(`control: as an allowed admin, ${label} (${fn}) opens`);
    else note(`${label} (${fn}) does not open even as an allowed admin here — its refusal below is not evidence`);
  }
  /* js/62 identifies a company by bizUuid(b) = __bizUuid(b.id) when that mapper exists, which
     returns undefined for an id it has never seen — the first run passed the raw ids and the merge
     answered "Could not find both companies" before reaching its RPC, so the control failed for a
     fixture reason. Ask the page what it calls them. */
  const UU = await p.evaluate(() => {
    const f = (id) => { try { return (window.__bizUuid ? window.__bizUuid(id) : id) || id; } catch (_) { return id; } };
    return { keep: f('gr-keep'), drop: f('gr-drop') };
  });
  note(`the page identifies the two fixture companies as ${JSON.stringify(UU)}`);
  rpcCalls.length = 0;
  await arm();
  await p.evaluate((u) => { try { window.v62MergeBiz(u.keep, u.drop); } catch (e) { } }, UU);
  await p.waitForTimeout(1500);
  worksAsAdmin.v62MergeBiz = rpcCalls.length > 0;
  const mergeAlert = await p.evaluate(() => window.__a);
  if (worksAsAdmin.v62MergeBiz) ok('control: as an allowed admin, the merge really does call fn_merge_businesses');
  else { ctlBad++; fail(`control: the merge called no RPC as an allowed admin (it said: ${JSON.stringify(mergeAlert)}) — its refusal below would prove nothing`); }
  if (ctlBad) { console.log('\nFAILED - ' + failures + ' check(s)'); await b.close(); srv.close(); process.exit(1); }
  /* let the merge control's own settings reload finish before anything is measured against it */
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    DB.businesses = DB.businesses || [];
    if (!DB.businesses.some(x => x.id === 'gr-keep')) DB.businesses.push({ id: 'gr-keep', uuid: 'gr-keep', name: 'Guardrail Keep Co', isClient: true });
    if (!DB.businesses.some(x => x.id === 'gr-drop')) DB.businesses.push({ id: 'gr-drop', uuid: 'gr-drop', name: 'Guardrail Drop Co', isClient: true });
  });

  /* ---------- 2 & 3. both halves ---------- */
  const HALVES = [
    ['a read-only share view', () => { window.__isShareView = true; }],
    ['a role that denies the Finance page', () => { window.__isShareView = false; window.__userTier = 'admin'; window.__accessKnown = function () { return true; }; window.myAllowedPages = function () { return ['leads']; }; }]
  ];
  for (const [half, setup] of HALVES) {
    await p.evaluate(setup);
    const st = await p.evaluate(() => ({ canEdit62: typeof window.finCanWrite === 'function' ? window.finCanWrite() : null, maySee: typeof window.finMaySeeMoney === 'function' ? window.finMaySeeMoney() : null }));
    if (st.canEdit62 === false) ok(`control: under ${half}, the chokepoint canEdit62 delegates to says no (finCanWrite ${st.canEdit62}, finMaySeeMoney ${st.maySee})`);
    else fail(`control: under ${half}, finCanWrite says ${st.canEdit62} — this half is not set up`);

    await resetState();
    const beforeAdd = await stateOf();
    const openedDenied = await addExclusion();
    const afterAddDenied = await stateOf();
    if (!openedDenied && beforeAdd === afterAddDenied) ok(`under ${half}: adding an exclusion neither opens its dialog nor stores anything`);
    else fail(`under ${half}: adding an exclusion ${openedDenied ? 'opened its dialog' : ''}${beforeAdd !== afterAddDenied ? ' and CHANGED the stored exclusions' : ''} — the standing exclusion list decides whose money never enters Finance`);

    for (const [fn, label, body] of SIMPLE) {
      if (!worksAsAdmin[fn]) continue;   /* no admin control ⇒ a refusal here is not evidence */
      await resetState();
      const before = await stateOf();
      await runSimple(body);
      const after = await stateOf();
      if (before === after) ok(`under ${half}: ${label} changed nothing`);
      else fail(`under ${half}: ${label} (${fn}) CHANGED STORED STATE — js/62's guardrails decide whose money is whose. before ${before} / after ${after}`);
    }
    for (const [fn, label, body] of OPENERS) {
      if (!worksAsAdmin[fn]) continue;
      await closeModal(); await arm();
      await p.evaluate(`(${body.toString()})()`); await p.waitForTimeout(600);
      const opened = await modalOpen();
      await closeModal();
      if (!opened) ok(`under ${half}: ${label} does not open`);
      else fail(`under ${half}: ${label} (${fn}) opened`);
    }
    /* A FRESH pair for every half. The first version reused the pair the admin control had already
       merged, so by then the drop company was archived, js/62 answered "could not find both
       companies" and returned before its RPC — the check could not fail, and sabotaging the merge
       guard proved it: 0 red. Same "nothing left to do" rubber stamp cycle 32 found in the write
       probe, in a new place. */
    const pairId = half.indexOf('share') >= 0 ? 'sv' : 'role';
    await p.evaluate((id) => {
      DB.businesses = DB.businesses || [];
      ['keep', 'drop'].forEach((k) => { const bid = 'gr-' + k + '-' + id; if (!DB.businesses.some(x => x.id === bid)) DB.businesses.push({ id: bid, uuid: bid, name: 'Guardrail ' + k + ' ' + id, isClient: true }); });
    }, pairId);
    const uu = await p.evaluate((id) => {
      const f = (x) => { try { return (window.__bizUuid ? window.__bizUuid(x) : x) || x; } catch (_) { return x; } };
      return { keep: f('gr-keep-' + id), drop: f('gr-drop-' + id) };
    }, pairId);
    rpcCalls.length = 0;
    await arm();
    await p.evaluate((u) => { try { window.v62MergeBiz(u.keep, u.drop); } catch (e) { } try { window.v62UnmergeBiz('any'); } catch (e) { } }, uu);
    await p.waitForTimeout(1400);
    const mergeSaid = await p.evaluate(() => window.__a);
    if (/[Cc]ould not find both companies|تعذّر العثور/.test(String(mergeSaid || '')))
      fail(`under ${half}: the merge answered "could not find both companies" — it never reached the guard, so this check proved nothing about it`);
    else if (!rpcCalls.length) ok(`under ${half}: neither the merge nor the undo reaches its RPC`);
    else fail(`under ${half}: the merge/undo called ${JSON.stringify(rpcCalls)} — one client's invoices can be moved under another client's name`);

    await p.evaluate(() => { window.__isShareView = false; window.__userTier = 'admin'; try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; } try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; } });
  }

  if (!errors.length) ok('no page error'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
