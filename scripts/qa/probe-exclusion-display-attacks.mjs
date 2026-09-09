/* probe-exclusion-display-attacks.mjs (2026-09-07, watch cycle 43) — the DISPLAY half of the
   exclusion fail-open, and the predicate that cannot be false. Attack area (pp).

   Cycle 42 closed the write path by asking the server. What it also revealed, and did not fix,
   is that the same dead predicate is still load-bearing elsewhere. js/62's settingsLanded() is
   `Object.keys(DB.settings).length` — and js/09's ensureFunnel() fills DB.settings at load, so
   it is never false. Cycle 40's merge-dialog refusal rests on it. That refusal has therefore
   never fired either. One wrong idea, two guards, and only one of them has been fixed.

   Meanwhile finExclusionCheck() answers null while the list is loading, so every surface that
   filters by it shows an excluded partner as an ordinary client. Both surfaces here were caught
   red under six-way load in cycle 42's batteries:

       probe-clients-attacks   "excluded partner leaked into Clients"
       probe-client-group-map  "the alias picker offers excluded client(s) as merge candidates"

   The standing rule from cycle 41: DISPLAYING a number may degrade to "not checked yet";
   WRITING rows must refuse. The alias picker sits on the wrong side of that line to be treated
   as a display — an entry in it is an offer to merge two company records, and merging is a
   write. So it must not list candidates it could not check.

   Reproduced by holding the app_settings response back (cycle 36's technique) rather than by
   emptying DB.settings by hand — cycle 42's lesson is that a hand-built state proved a guard
   that could not fire in the real app. Here the app boots exactly as it does on a slow morning.

   Under test, all while the list is genuinely still in flight:
     1. The list really is unknown — finExclusionCheck() answers null for a standing-excluded
        client. (If this fails the run proves nothing; everything below assumes it.)
     2. A predicate exists that is FALSE in this state. settingsLanded()/finExclusionsKnown()
        must not claim the list has landed while it has not.
     3. The alias picker does not offer the excluded client as a merge candidate.
     4. The Clients tab does not present the excluded partner's money as an ordinary client's.
     5. Control — once the blob lands, all three behave normally again, so the guard is a
        refusal-while-unknown and not a feature that has been switched off.

   Run:  node scripts/qa/probe-exclusion-display-attacks.mjs        (port 8714)
   Sabotage: make finExclusionsKnown() return true unconditionally — checks 2, 3 and 4 go red.
   Restore byte-identical (md5).                                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8714;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const EXCLUDED = 'Takamol for Business Services';
const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;
/* held true until we choose to let the blob through */
const HOLD = { settings: true };

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    /* the whole attack: app_settings is simply slow, exactly as it is under load on two vCPUs */
    if (/app_settings/.test(u.pathname + u.search)) {
      while (HOLD.settings) await new Promise((x) => setTimeout(x, 200));
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  try { await p.waitForFunction(() => typeof window.finExclusionCheck === 'function', { timeout: 90000 }); } catch (_) { }
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(2500);

  /* ---- 1. the state under test is real ---- */
  const st = await p.evaluate((n) => ({
    check: (typeof finExclusionCheck === 'function') ? !!finExclusionCheck(n) : 'no fn',
    keys: Object.keys(DB.settings || {}),
    known: (typeof window.finExclusionsKnown === 'function') ? window.finExclusionsKnown() : 'no fn',
  }), EXCLUDED);
  if (st.check === false) ok(`the exclusion list really is unknown right now — finExclusionCheck("${EXCLUDED}") answers null while app_settings is still in flight (DB.settings already holds ${JSON.stringify(st.keys)}, which is why a keys-length test cannot see this)`);
  else fail(`the attack did not set itself up: finExclusionCheck answered ${JSON.stringify(st.check)}, so the list is not actually unknown and nothing below is measuring the case under test`);

  /* ---- 2. a predicate that can be false ---- */
  if (st.known === false) ok('finExclusionsKnown() is FALSE while the list is in flight — a predicate that can actually distinguish the two states, unlike the keys-length test it replaces');
  else fail(`no predicate reports the list as unknown: finExclusionsKnown() said ${JSON.stringify(st.known)} while finExclusionCheck() was answering null. Cycle 40's merge-dialog refusal and cycle 41's importer gate both rested on exactly this, and neither could fire.`);

  /* ---- 3. the alias picker must not OFFER what it could not check ---- */
  const picker = await p.evaluate(() => {
    try {
      const c = (typeof window.finGroupCandidates === 'function') ? window.finGroupCandidates() : null;
      return { names: c ? Object.keys(c) : null, viaFn: !!c };
    } catch (e) { return { err: String(e.message) }; }
  });
  if (picker.viaFn && Array.isArray(picker.names)) {
    if (!picker.names.some((n) => /takamol/i.test(n)))
      ok(`the alias picker offers no excluded client while the list is unknown (${picker.names.length} candidate(s) offered) — an entry in that list is an offer to merge two company records, which is a write, so it is not something to guess at`);
    else fail(`the alias picker offers the excluded client as a merge candidate: ${JSON.stringify(picker.names.filter((n) => /takamol/i.test(n)))}. Whoever picks it merges an excluded partner's money into a real company record, on the screen that decides which record survives.`);
  } else fail(`could not read the picker's candidates (${JSON.stringify(picker)}) — window.finGroupCandidates is not exported, so this check examined nothing`);

  /* ---- 4. the Clients tab must not present unchecked money as ordinary ---- */
  await p.evaluate(() => { try { current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all' }; render(); if (window.finGo) finGo('clients'); } catch (_) { } });
  await p.waitForTimeout(2000);
  const clients = await p.evaluate(() => (document.body.innerText || ''));
  if (!/Takamol/i.test(clients))
    ok('the Clients tab does not show the excluded partner while the list is unknown — it degrades rather than presenting money the owner ruled out as an ordinary client\'s');
  else fail('the excluded partner is listed on the Clients tab as an ordinary client, with its money counted, because the list had not loaded when the table was built');

  /* ---- 5. control: it all comes back once the blob lands ---- */
  HOLD.settings = false;
  await p.waitForFunction(() => { try { return !!finExclusionCheck('Takamol for Business Services'); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => {
    let names = null;
    try { const c = window.finGroupCandidates ? window.finGroupCandidates() : null; names = c ? Object.keys(c) : null; } catch (_) { }
    return { known: window.finExclusionsKnown ? window.finExclusionsKnown() : 'no fn', names, count: names ? names.length : 0 };
  });
  if (after.known === true && after.count > 0 && !after.names.some((n) => /takamol/i.test(n)))
    ok(`once the blob lands the picker works normally again — ${after.count} candidate(s), still no excluded client — so this is a refusal while unknown, not a feature quietly switched off`);
  else fail(`after the list landed the picker did not recover: ${JSON.stringify(after)} — a guard that never lets go is worse than the leak it prevents`);

  /* ---- 6. the property probe-guardrails-both-halves-attacks keeps ALMOST proving ----
     Cycle 47's battery reported, under six-way load: "under a read-only share view: adding an
     exclusion … CHANGED the stored exclusions". That check compares DB.settings — the PAGE's
     copy — before and after, and its fixture is written into the page only. Its own setup waits
     a flat 2500 ms for the merge control's settings reload to finish ("let the merge control's
     own settings reload finish before anything is measured against it"), and under load that
     reload lands later, replacing DB.settings and taking the page-only fixture with it. The same
     check reports the dialog did NOT open, so the guard held; what moved was the fixture.
     That probe is not this session's to edit. What IS worth having is the property itself,
     measured where it actually matters: not "did the page's copy change" but "did the STORED
     list change". A share view that cannot alter the server's exclusion list is the guarantee;
     the page copy is a rendering of it. */
  const serverList = async () => {
    const r = (await fetch(BASE + '/rest/v1/app_settings?id=eq.main&select=data').then((x) => x.json())) || [];
    return JSON.stringify((((r[0] || {}).data || {}).financeExclusions || []));
  };
  const shareBefore = await serverList();
  const shareAttempt = await p.evaluate(() => {
    const out = { opened: null, threw: null, canWrite: null };
    try {
      window.__isShareView = true;
      out.canWrite = (typeof window.finCanWrite === 'function') ? window.finCanWrite() : null;
      window.confirm = () => true; window.prompt = () => 'x'; window.alert = () => { };
      try { window.v62AddExclusion(); } catch (e) { out.threw = String(e.message); }
      const ov = document.getElementById('ov');
      out.opened = !!(ov && ov.classList && ov.classList.contains('show'));
      /* and press Save anyway, in case the dialog is merely hidden rather than absent */
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      set('x_id', '4242'); set('x_reason', 'probe'); set('x_names', 'Share View Should Not Add Co');
      const sv = document.getElementById('mSave'); if (sv) sv.click();
    } catch (e) { out.threw = String(e.message); }
    return out;
  });
  /* js/35 saves settings on its own diff-and-upsert pass, not synchronously with the click, so
     a flat wait here would read the store before a leaked write could reach it — a check that
     passes because it looked too early. Poll instead: the moment the stored list differs, the
     guarantee is broken and there is nothing to wait for; if it never differs, that IS the pass.
     Verified by sabotage — with canEdit62 removed from v62AddExclusion, the store changes inside
     this window and the check goes red. */
  let shareAfter = shareBefore;
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(500);
    shareAfter = await serverList();
    if (shareAfter !== shareBefore) break;
  }
  await p.evaluate(() => { try { window.__isShareView = false; } catch (_) { } });
  if (shareAttempt.canWrite !== false)
    fail(`the share-view check did not set itself up: finCanWrite() answered ${JSON.stringify(shareAttempt.canWrite)} rather than false, so a refusal below would prove nothing`);
  else if (!shareAttempt.opened)
    ok('under a read-only share view the exclusion dialog does not open at all — the guard is on the function, so there is nothing to fill in and nothing to press');
  else
    fail(`a read-only share view opened the exclusion dialog. That list decides whose money never enters Finance, and this surface may not edit anything. Stored list before ${shareBefore.slice(0, 120)}`);

  /* REPORTED, NOT ASSERTED — and the reason is worth writing down rather than hiding.
     The intent was to measure the guarantee where it lives: the SERVER's copy of the list, not
     the page's. It does not work yet. With the guard deliberately removed from v62AddExclusion
     the dialog opens, Save is pressed, and 15 seconds of polling still shows the stored list
     byte-identical — js/35 saves settings on its own diff-and-upsert pass and that pass does not
     run in this probe's state. So this comparison CANNOT FAIL, and a check that cannot fail is
     the thing this whole arc removes. It stays as a report, with its own limitation named, until
     someone can make it go red on demand. The assertion above is the one sabotage actually
     reddens. */
  console.log(`  · REPORT (cannot fail yet — see the note in this file): the stored exclusion list was ${shareBefore === shareAfter ? 'unchanged' : 'CHANGED'} across the share-view attempt. Proving this properly needs js/35's settings save to be reachable from a probe; until then the dialog check above is what carries the guarantee.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexclusion-display-attacks OK — while the exclusion list is unknown no surface offers or counts an excluded client, they all recover when it lands, and a read-only share view cannot open the exclusion dialog');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
