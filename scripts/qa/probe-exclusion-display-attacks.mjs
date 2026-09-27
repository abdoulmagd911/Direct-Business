/* probe-exclusion-display-attacks.mjs (2026-09-07, watch cycle 43; REWRITTEN for E, 2026-09-27) — the
   DISPLAY half of the exclusion fail-open, and the predicate that cannot be false. Attack area (pp).

   E (2026-09-27, DECISIONS D16): until E the rules were js/62's name list in the app_settings blob,
   and the surface that OFFERED a merge was js/62's alias picker (finGroupCandidates) — an entry in
   it was an offer to merge two company records, so it must never list a client it could not check.
   E retired both: the rules are typed rows (money_exclusion_rules, the page's copy in MR.rules —
   which is what finExclusionCheck / finExclusionsKnown now answer from), applied by the database
   view money_rows; and the merge offer is now Finance → Rules' "Needs a decision" list (a client
   ID or customer name no company holds, with a "Belongs to [company]" control). The purpose is
   unchanged and moves with it: while the rules are in flight, nothing offers an excluded client as
   something to merge and nothing presents its money; the predicate that says "not known yet" can
   actually be false; and a read-only share view cannot add a rule — now measured where it matters,
   in the STORED rules (the old version could only report this, because js/35's settings save was
   out of a probe's reach; a rule is a table row, so it can be asserted).

   Reproduced by holding the answers back (the rules read and the view read), never by emptying
   page state by hand — a hand-built state proved guards that could not fire in the real app.

   Under test:
     1. The rules really are unknown — finExclusionCheck() answers null for the standing-excluded
        client while its rule is in flight.
     2. A predicate exists that is FALSE in this state — finExclusionsKnown().
     3. Finance → Rules offers no merge decision at all while the rules and the view are in flight
        (it says it is loading) — nothing it could not check.
     4. The Clients tab does not present the excluded partner.
     5. With the view answered but the page's rules still in flight, the Rules screen still offers
        nothing, and Clients still shows no excluded partner.
     6. Control — once both land, "Needs a decision" offers candidates again and none of them is
        the excluded client; the excluded client sits in the Excluded list with its rule.
     7. Under a read-only share view the add-a-rule dialog does not open, and the stored rules do
        not change even when Save is pressed anyway.

   Run:  node scripts/qa/probe-exclusion-display-attacks.mjs        (port 8714)
   Sabotage: SABOTAGE=1 serves js/117 to the browser with moneyStats() not skipping excluded rows
   (the file on disk is untouched) — check 6 goes red with the excluded client offered for a merge. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8714;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const EXCLUDED = 'Tawthiq Test Services';
const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;
/* held true until we choose to let the blob through */
const HOLD = { rules: true, view: true };


async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    /* the whole attack: the rules and the view are simply slow, exactly as they are under load */
    if (rq.method() === 'GET' && /\/money_exclusion_rules/.test(u.pathname)) { while (HOLD.rules) await new Promise((x) => setTimeout(x, 200)); }
    if (rq.method() === 'GET' && /\/money_rows/.test(u.pathname)) { while (HOLD.view) await new Promise((x) => setTimeout(x, 200)); }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  if (process.env.SABOTAGE) await p.route((u) => u.pathname === '/js/117-money-rules.js', async (r) => {
    const src = fs.readFileSync(new URL('../../js/117-money-rules.js', import.meta.url), 'utf8');
    const cut = src.replace("      if(m.excluded)return;\n", "\n");
    if (cut === src) console.log('  ! sabotage did not apply — the line moved');
    await r.fulfill({ status: 200, contentType: 'application/javascript', body: cut });
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  try { await p.waitForFunction(() => typeof window.finExclusionCheck === 'function' && typeof window.moneyRulesLoad === 'function', { timeout: 90000 }); } catch (_) { }
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(3500);

  /* what Finance → Rules offers, and what the Clients tab shows, right now — read from the screen */
  const rulesTab = () => p.evaluate(() => {
    try { current = 'finance'; FIN.tab = 'rules'; render(); } catch (_) { }
    const v = document.getElementById('view'); const txt = (v && v.innerText) || '';
    const offers = Array.prototype.map.call((v && v.querySelectorAll('[data-v117-loose]')) || [], (tr) => tr.getAttribute('data-v117-loose') + ' / ' + ((tr.children[1] && tr.children[1].innerText) || ''));
    const ex = v && v.querySelector('.v117-excluded');
    return { offers, loading: /Loading|جاري التحميل/.test(txt), excluded: ex ? ex.innerText : '' };
  });
  const clientsTab = () => p.evaluate(() => {
    try { current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all' }; if (window.finGo) finGo('clients'); else render(); } catch (_) { }
    const v = document.getElementById('view'); return (v && v.innerText) || '';
  });

  /* ---- 1 + 2. the state under test is real ---- */
  const st = await p.evaluate((n) => ({
    check: (typeof finExclusionCheck === 'function') ? !!finExclusionCheck(n) : 'no fn',
    known: (typeof window.finExclusionsKnown === 'function') ? window.finExclusionsKnown() : 'no fn',
    rowsNull: !(window.FIN && FIN.rows),
  }), EXCLUDED);
  if (st.check === false) ok(`the rules really are unknown right now — finExclusionCheck("${EXCLUDED}") answers null while its rule is still in flight`);
  else fail(`the attack did not set itself up: finExclusionCheck answered ${JSON.stringify(st.check)}, so the rules are not actually unknown and nothing below is measuring the case under test`);
  if (st.known === false) ok('finExclusionsKnown() is FALSE while the rules are in flight — a predicate that can actually distinguish the two states');
  else fail(`no predicate reports the rules as unknown: finExclusionsKnown() said ${JSON.stringify(st.known)} while finExclusionCheck() was answering null`);

  /* ---- 3 + 4. nothing offered, nothing presented ---- */
  const r1 = await rulesTab();
  if (!r1.offers.length && r1.loading) ok('Finance → Rules offers no merge decision while the rules and the view are in flight, and says it is loading — an offer to merge is a write, so it is not something to guess at');
  else fail(`Finance → Rules offered ${r1.offers.length} merge decision(s) while the rules were in flight (loading shown=${r1.loading}): ${JSON.stringify(r1.offers.slice(0, 5))}`);
  const c1 = await clientsTab();
  if (!/Tawthiq/i.test(c1)) ok('the Clients tab does not show the excluded partner while the rules are in flight');
  else fail('the excluded partner is on the Clients tab while the rules were in flight');

  /* ---- 5. the view answers, the page's rules still in flight ---- */
  HOLD.view = false;
  await p.waitForFunction(() => window.FIN && FIN.rows != null, null, { timeout: 60000 }).catch(() => { });
  await p.waitForTimeout(800);
  const r2 = await rulesTab();
  const c2 = await clientsTab();
  if (!r2.offers.length && r2.loading) ok('with the view answered but the page\'s rules still in flight, Finance → Rules still offers nothing and says it is loading');
  else fail(`with the page's rules still in flight Finance → Rules offered ${r2.offers.length} decision(s) (loading shown=${r2.loading}): ${JSON.stringify(r2.offers.slice(0, 5))}`);
  if (!/Tawthiq/i.test(c2)) ok('…and the Clients tab still shows no excluded partner — the view, not the page\'s copy, decides what counts');
  else fail('with the view answered, the Clients tab shows the excluded partner — the view did not leave it out');

  /* ---- 6. control: both land ---- */
  HOLD.rules = false;
  await p.waitForFunction(() => { try { return !!finExclusionCheck('Tawthiq Test Services'); } catch (_) { return false; } }, null, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(1500);
  const r3 = await rulesTab();
  const known3 = await p.evaluate(() => window.finExclusionsKnown ? window.finExclusionsKnown() : 'no fn');
  if (known3 === true && r3.offers.length > 0 && !r3.offers.some((n) => /tawthiq/i.test(n)))
    ok(`once the rules land "Needs a decision" works normally again — ${r3.offers.length} decision(s) offered, none of them the excluded client — so this was a wait while unknown, not a feature switched off`);
  else fail(`after the rules landed: known=${known3}, ${r3.offers.length} decision(s) offered${r3.offers.some((n) => /tawthiq/i.test(n)) ? ' — INCLUDING the excluded client, offered for a merge into a real company record' : ''}: ${JSON.stringify(r3.offers.slice(0, 8))}`);
  if (/Tawthiq Test Services/.test(r3.excluded) && /verification services/i.test(r3.excluded))
    ok('the excluded client sits in Finance → Rules\' Excluded list, with the rule that caught it');
  else fail(`the excluded client is not in the Excluded list with its rule: ${JSON.stringify(r3.excluded.slice(0, 300))}`);

  /* ---- 7. a share view cannot add a rule — measured in the stored rules ---- */
  const storedRules = () => p.evaluate(async () => { const r = await fc().from('money_exclusion_rules').select('id,kind,value,active,removed_at').order('id', { ascending: true }); return JSON.stringify((r && r.data) || r.error); });
  const shareBefore = await storedRules();
  const shareAttempt = await p.evaluate(() => {
    const out = { opened: null, threw: null, canWrite: null };
    try {
      window.__isShareView = true;
      out.canWrite = (typeof window.finCanWrite === 'function') ? window.finCanWrite() : null;
      window.confirm = () => true; window.prompt = () => 'x'; window.alert = () => { };
      try { window.v117AddRule('name', ''); } catch (e) { out.threw = String(e.message); }
      const ov = document.getElementById('ov');
      out.opened = !!(ov && ov.classList && ov.classList.contains('show'));
      /* and press Save anyway, in case the dialog is merely hidden rather than absent */
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      set('v117_kind', 'name'); set('v117_value', 'Share View Should Not Add Co'); set('v117_reason', 'probe');
      const sv = document.getElementById('mSave'); if (sv) sv.click();
    } catch (e) { out.threw = String(e.message); }
    return out;
  });
  let shareAfter = shareBefore;
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); shareAfter = await storedRules(); if (shareAfter !== shareBefore) break; }
  await p.evaluate(() => { try { window.__isShareView = false; } catch (_) { } });
  if (shareAttempt.canWrite !== false)
    fail(`the share-view check did not set itself up: finCanWrite() answered ${JSON.stringify(shareAttempt.canWrite)} rather than false, so a refusal below would prove nothing`);
  else {
    if (!shareAttempt.opened) ok('under a read-only share view the add-a-rule dialog does not open at all');
    else fail('a read-only share view opened the add-a-rule dialog — the rules decide whose money never enters Finance, and this surface may not edit anything');
    if (shareAfter === shareBefore) ok('…and the STORED rules are unchanged after Save was pressed anyway');
    else fail(`a read-only share view changed the stored rules: before ${shareBefore.slice(0, 200)} / after ${shareAfter.slice(0, 200)}`);
  }

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexclusion-display-attacks OK — while the rules are in flight nothing offers or presents an excluded client, everything recovers when they land, and a read-only share view cannot add a rule');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
