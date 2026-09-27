/* probe-guardrails-both-halves-attacks.mjs (2026-09-06, watch cycle 33; REWRITTEN for E, 2026-09-27) - the
   write surface that decides whose money is whose, driven against BOTH reasons the Finance page is refused.

   E (2026-09-27, DECISIONS D16): until E that surface was js/62 - the standing exclusion list, the
   alias grouping map, the duplicate-company finder and the merge/undo pair, all in the settings blob.
   E retired the list and the alias map (v62AddExclusion / v62OpenAddGrouping / v62OpenGrouping now
   only open Finance -> Rules; v62RemoveExclusion / v62UndoGrouping / v62RedoGrouping edit keys nobody
   reads any more). What decides whose money is whose now is Finance -> Rules (js/117): the typed
   exclusion rules (money_exclusion_rules), the customer names typed into a company
   (company_name_aliases), the client IDs (client_profiles) and discount codes a company holds. So the
   probe keeps its purpose and moves to where the writes now are. js/62's duplicate-company finder and
   merge/undo pair are unchanged and stay under test.

   Under test, for each write:
     1. Positive control - as an allowed admin it really does change stored state (read back from the
        database, not from page state). Otherwise the refusals below pass for the wrong reason.
     2. Under a read-only share view it changes nothing.
     3. Under a session whose Finance page is denied it changes nothing.
   The dialog openers (add a rule, add a client ID, add a code) are checked on whether the dialog
   appears; the rule dialog is also filled and saved; the merge pair on whether its RPC is attempted.
   Each phase gets its own fixture rule / name / client ID, because a removal is final.

   Run:  node scripts/qa/probe-guardrails-both-halves-attacks.mjs        (port 8249)
   Sabotage: SABOTAGE=1 serves js/117 to the browser with canEdit() answering true (the file on disk
   is untouched) - the share-view half goes red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8249;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);

/* one rule, one typed name and one client ID per phase: ctl (the admin control), sv (share view), role (Finance denied) */
const PH = ['ctl', 'sv', 'role'];
const RULE = (ph) => ({ id: 'gr-rule-' + ph, kind: 'name', value: 'Guardrail Rule Co ' + ph, value_norm: null, reason: 'probe fixture', active: true, created_by: null, created_by_name: 'probe seed', created_at: '2026-09-01T00:00:00Z', updated_by: null, updated_by_name: null, updated_at: null, removed_by: null, removed_by_name: null, removed_at: null });
const srv = start(PORT, {
  finance_invoices: [], finance_transactions: [],
  money_exclusion_rules: PH.map(RULE),
  company_name_aliases: PH.map((ph) => ({ id: 'gr-name-' + ph, business_id: 'b0', name: 'Guardrail Typed Name ' + ph, created_by: null, created_by_name: 'probe seed', created_at: '2026-09-01T00:00:00Z', removed_by: null, removed_by_name: null, removed_at: null })),
  client_profiles: PH.map((ph, i) => ({ id: 'gr-cp-' + ph, business_id: 'b0', direct_client_id: String(880 + i), profile_type: 'tender', status: 'active', payment_terms: null, billing_cycle: null, opened_at: '2026-09-01', closed_at: null }))
});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  const rpcCalls = [];
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (/\/rest\/v1\/rpc\/fn_(merge|unmerge)_businesses/.test(u.pathname)) rpcCalls.push(u.pathname.split('/').pop());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), r => r.abort());
  if (process.env.SABOTAGE) await p.route((u) => u.pathname === '/js/117-money-rules.js', async (r) => {
    const src = fs.readFileSync(new URL('../../js/117-money-rules.js', import.meta.url), 'utf8');
    const cut = src.replace("function canEdit(){ try{ if(window.__isShareView)return false;", "function canEdit(){ return true; try{ if(window.__isShareView)return false;");
    if (cut === src) console.log('  ! sabotage did not apply — the line moved');
    await r.fulfill({ status: 200, contentType: 'application/javascript', body: cut });
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.v117AddRule === 'function' && window.__userRole === 'admin', null, { timeout: 90000 }).catch(() => { });
  await p.evaluate(() => { try { current = 'finance'; render(); } catch (_) { } });

  /* two companies to merge, and a known starting state for the duplicate-dismissal list */
  await p.evaluate(() => {
    DB.businesses = DB.businesses || [];
    DB.businesses.push({ id: 'gr-keep', uuid: 'gr-keep', name: 'Guardrail Keep Co', isClient: true });
    DB.businesses.push({ id: 'gr-drop', uuid: 'gr-drop', name: 'Guardrail Drop Co', isClient: true });
    DB.settings = DB.settings || {};
    DB.settings.bizDupDismissed = ['seed-key'];
  });
  /* the page's own copies of the rules, names and client IDs must be in, or the remove/switch functions find nothing */
  const pageLoaded = async () => {
    await p.evaluate(() => { try { MR.rules = null; MR.loading = false; moneyRulesLoad(); } catch (_) { } try { if (window.CP) { CP.rows = null; cpLoad(function () { }); } } catch (_) { } });
    try { await p.waitForFunction(() => !!(window.MR && MR.rules && MR.aliases && window.CP && CP.rows), null, { timeout: 20000 }); return true; } catch (_) { return false; }
  };
  if (!(await pageLoaded())) fail('the page never loaded its rules, typed names and client IDs (MR / CP) — nothing below can be measured');

  /* stored state, read back from the database through the signed-in session (not from page state) */
  const stateOf = () => p.evaluate(async () => {
    const c = fc();
    const [r, a, cp] = await Promise.all([
      c.from('money_exclusion_rules').select('id,kind,value,active,removed_at').order('id', { ascending: true }),
      c.from('company_name_aliases').select('id,name,removed_at').order('id', { ascending: true }),
      c.from('client_profiles').select('id,direct_client_id').order('id', { ascending: true })]);
    return JSON.stringify({
      rules: ((r && r.data) || []).map((x) => x.id + ':' + (x.active ? 'on' : 'off') + (x.removed_at ? ':removed' : '')),
      names: ((a && a.data) || []).map((x) => x.id + (x.removed_at ? ':removed' : '')),
      ids: ((cp && cp.data) || []).map((x) => x.id),
      dup: ((DB.settings || {}).bizDupDismissed || []).slice().sort(),
      err: [r && r.error, a && a.error, cp && cp.error].filter(Boolean).map((x) => x.message)
    });
  });
  const arm = () => p.evaluate(() => {
    window.__a = null;
    window.confirm = function () { return true; };
    window.prompt = function () { return 'x'; };
    window.alert = function (m) { window.__a = String(m); };
    window.askInPage = function (m, y) { y(); };
    window.v63Notice = function (m) { window.__a = String(m); };
    try { window.__reloads = (window.__reloads || 0); const L = window.location; if (!L.__stubbed) { Object.defineProperty(L, 'reload', { configurable: true, value: function () { window.__reloads++; } }); L.__stubbed = true; } } catch (_) { }
  });
  const modalOpen = () => p.evaluate(() => { const ov = document.getElementById('ov'); return !!(ov && ov.classList && ov.classList.contains('show')); });
  const closeModal = () => p.evaluate(() => { try { if (typeof closeModal === 'function') closeModal(); } catch (_) { } const ov = document.getElementById('ov'); if (ov && ov.classList) ov.classList.remove('show'); });
  const settle = () => p.waitForTimeout(1200);

  /* the rule dialog: open it, fill it, press Save the way a person does */
  const addRule = async (ph) => {
    await arm(); await closeModal();
    await p.evaluate(() => { try { window.v117AddRule('name', ''); } catch (e) { } });
    await p.waitForTimeout(500);
    const opened = await modalOpen();
    if (opened) {
      await p.evaluate((v) => {
        const set = (id, x) => { const e = document.getElementById(id); if (e) e.value = x; };
        set('v117_kind', 'name'); set('v117_value', v); set('v117_reason', 'probe');
        const s = document.getElementById('mSave'); if (s) s.click();
      }, 'Probe Added Rule Co ' + ph);
      await settle();
    }
    await closeModal();
    return opened;
  };
  const WRITES = [
    ['v117SwitchRule', 'switch an exclusion rule off', (ph) => `window.v117SwitchRule('gr-rule-${ph}', false)`],
    ['v117RemoveRule', 'remove an exclusion rule', (ph) => `window.v117RemoveRule('gr-rule-${ph}')`],
    ['v117RemoveAlias', 'take a typed customer name out of a company', (ph) => `window.v117RemoveAlias('gr-name-${ph}')`],
    ['v117RemoveClientId', 'take a client ID out of a company', (ph) => `window.v117RemoveClientId('gr-cp-${ph}')`],
    ['v62DismissDup', 'dismiss a duplicate pair', () => `window.v62DismissDup('probe-dup-key')`],
    ['v62UndismissDups', 'clear the dismissed duplicates', () => `window.v62UndismissDups()`]
  ];
  const OPENERS = [
    ['v117AddClientId', 'the add-a-client-ID dialog', () => window.v117AddClientId('', '')],
    ['v117AddCode', 'the add-a-discount-code dialog', () => window.v117AddCode('')]
  ];
  const runWrite = async (expr) => { await arm(); await p.evaluate(`(function(){ try { ${expr}; } catch (e) { window.__threw = e.message; } })()`); await settle(); };
  const resetDup = () => p.evaluate(() => { DB.settings = DB.settings || {}; DB.settings.bizDupDismissed = ['seed-key']; });

  /* ---------- 1. positive controls ---------- */
  const worksAsAdmin = {};
  let ctlBad = 0;
  {
    const before = await stateOf();
    const opened = await addRule('ctl');
    const after = await stateOf();
    worksAsAdmin.v117AddRule = opened && before !== after && JSON.parse(after).rules.length === JSON.parse(before).rules.length + 1;
    if (worksAsAdmin.v117AddRule) ok('control: as an allowed admin, adding an exclusion rule opens its dialog and stores the new rule in the database');
    else { ctlBad++; fail(`control: adding an exclusion rule as an admin did not store anything (dialog opened: ${opened}; said ${JSON.stringify(await p.evaluate(() => window.__a))}; before ${before} after ${after})`); }
  }
  for (const [fn, label, mk] of WRITES) {
    await pageLoaded(); await resetDup();
    const before = await stateOf();
    await runWrite(mk('ctl'));
    const after = await stateOf();
    worksAsAdmin[fn] = before !== after;
    if (worksAsAdmin[fn]) ok(`control: as an allowed admin, ${label} (${fn}) really does change stored state`);
    else { ctlBad++; fail(`control: ${label} (${fn}) changed nothing even as an allowed admin (said ${JSON.stringify(await p.evaluate(() => window.__a))}) — its refusal below would prove nothing`); }
  }
  for (const [fn, label, body] of OPENERS) {
    await closeModal(); await arm();
    await p.evaluate(`(${body.toString()})()`); await p.waitForTimeout(600);
    worksAsAdmin[fn] = await modalOpen();
    await closeModal();
    if (worksAsAdmin[fn]) ok(`control: as an allowed admin, ${label} (${fn}) opens`);
    else { ctlBad++; fail(`control: ${label} (${fn}) does not open even as an allowed admin — its refusal below would prove nothing`); }
  }
  const UU = await p.evaluate(() => {
    const f = (id) => { try { return (window.__bizUuid ? window.__bizUuid(id) : id) || id; } catch (_) { return id; } };
    return { keep: f('gr-keep'), drop: f('gr-drop') };
  });
  rpcCalls.length = 0;
  await arm();
  await p.evaluate((u) => { try { window.v62MergeBiz(u.keep, u.drop); } catch (e) { } }, UU);
  await p.waitForTimeout(1500);
  worksAsAdmin.v62MergeBiz = rpcCalls.length > 0;
  const mergeAlert = await p.evaluate(() => window.__a);
  if (worksAsAdmin.v62MergeBiz) ok('control: as an allowed admin, the merge really does call fn_merge_businesses');
  else { ctlBad++; fail(`control: the merge called no RPC as an allowed admin (it said: ${JSON.stringify(mergeAlert)}) — its refusal below would prove nothing`); }
  if (ctlBad) { console.log('\nFAILED - ' + failures + ' check(s)'); await b.close(); srv.close(); process.exit(1); }
  await p.waitForTimeout(2000);

  /* ---------- 2 & 3. both halves ---------- */
  const HALVES = [
    ['sv', 'a read-only share view', () => { window.__isShareView = true; }],
    ['role', 'a session whose Finance page is denied', () => { window.__isShareView = false; window.__userTier = 'admin'; window.__accessKnown = function () { return true; }; window.myAllowedPages = function () { return ['leads']; }; }]
  ];
  for (const [ph, half, setup] of HALVES) {
    await pageLoaded();
    await p.evaluate(setup);
    const st = await p.evaluate(() => ({ canWrite: typeof window.finCanWrite === 'function' ? window.finCanWrite() : null, maySee: typeof window.finMaySeeMoney === 'function' ? window.finMaySeeMoney() : null }));
    if (st.canWrite === false) ok(`control: under ${half}, the Finance write chokepoint says no (finCanWrite ${st.canWrite}, finMaySeeMoney ${st.maySee})`);
    else fail(`control: under ${half}, finCanWrite says ${st.canWrite} — this half is not set up`);

    const beforeAdd = await stateOf();
    const openedDenied = await addRule(ph);
    const afterAdd = await stateOf();
    if (!openedDenied && beforeAdd === afterAdd) ok(`under ${half}: adding an exclusion rule neither opens its dialog nor stores anything`);
    else fail(`under ${half}: adding an exclusion rule ${openedDenied ? 'OPENED its dialog' : ''}${beforeAdd !== afterAdd ? ' and CHANGED the stored rules' : ''} — the exclusion rules decide whose money never enters any total`);

    for (const [fn, label, mk] of WRITES) {
      if (!worksAsAdmin[fn]) continue;
      await resetDup();
      const before = await stateOf();
      await runWrite(mk(ph));
      const after = await stateOf();
      if (before === after) ok(`under ${half}: ${label} changed nothing`);
      else fail(`under ${half}: ${label} (${fn}) CHANGED STORED STATE — these writes decide whose money is whose. before ${before} / after ${after}`);
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
    /* A FRESH pair for every half — a pair already merged would answer "could not find both companies" before its guard */
    await p.evaluate((id) => {
      DB.businesses = DB.businesses || [];
      ['keep', 'drop'].forEach((k) => { const bid = 'gr-' + k + '-' + id; if (!DB.businesses.some(x => x.id === bid)) DB.businesses.push({ id: bid, uuid: bid, name: 'Guardrail ' + k + ' ' + id, isClient: true }); });
    }, ph);
    const uu = await p.evaluate((id) => {
      const f = (x) => { try { return (window.__bizUuid ? window.__bizUuid(x) : x) || x; } catch (_) { return x; } };
      return { keep: f('gr-keep-' + id), drop: f('gr-drop-' + id) };
    }, ph);
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
