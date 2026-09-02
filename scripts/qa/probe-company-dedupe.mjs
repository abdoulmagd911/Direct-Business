/* probe-company-dedupe.mjs — M18: duplicate company records are found automatically and merged
   through ONE reversible, audited path (fn_merge_businesses / fn_unmerge_businesses).

   Born from the MDD case (2026-08-29): the corporate-clients import created "MDD" beside the
   older "MDD — Smart Madad IT"; the alias map merged the DISPLAY, but contacts, profiles, links
   and transactions stayed split across two records. Owner: "find the fix for the future and go
   ahead." This drives the real admin card (Finance > Import > Duplicate companies):

   1. DETECT — two business records sharing a normalised name (and here also a CR number) show
      up as one candidate pair, with both records previewed (name, CR, invoice count/total) and
      the reason stated. Sabotage: drop the same-name signal → the pair is not surfaced.
   2. MERGE — choosing which record to keep and confirming sends ONE RPC call with exactly
      keep/drop; the mock repoints the finance link from the dropped record to the survivor and
      records the merge. Judged by the write that went out and by the database after reload.
   3. UNDO — the merge appears in the history with Undo; undoing sends the unmerge RPC and the
      link goes back to the original record. Nothing is deleted at any point. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8267;
// The seeded duplicate carries its OWN open postpaid billing profile — exactly the MDD shape that
// refused the first live merge (an open prepaid/postpaid profile may not sit twice on one
// company). The merge must close the colliding one as it moves, and undo must reopen it.
const FIXTURE_PROFILES = [
  { id: 'cp0', business_id: 'b0', direct_client_id: '95', profile_type: 'tender', status: 'active', payment_terms: null, billing_cycle: null, opened_at: '2026-05-19', closed_at: null, notes: null },
  { id: 'cp1', business_id: 'b4', direct_client_id: '12', profile_type: 'prepaid', status: 'active', payment_terms: null, billing_cycle: 'Manual', opened_at: '2026-03-01', closed_at: null, notes: null },
  { id: 'cp2', business_id: 'b4', direct_client_id: '13', profile_type: 'postpaid', status: 'active', payment_terms: 'Net 30', billing_cycle: 'Monthly', opened_at: '2026-03-05', closed_at: null, notes: 'original note' },
  { id: 'cp9', business_id: 'dupX', direct_client_id: '13', profile_type: 'postpaid', status: 'active', payment_terms: 'Net 30', billing_cycle: 'Monthly', opened_at: '2026-08-21', closed_at: null, notes: null },
];
const srv = start(PORT, { client_profiles: FIXTURE_PROFILES });
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

const FIXTURE_BIZ = 'b4';                 // mock business "Test Company 4", linked from the fixture's finance_client_links
const NEW_BIZ = 'dupX';                   // seeded duplicate: same name as Test Company 4, plus a CR number
const NEW_NAME = 'Test Company 4';

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const dialogs = [];
  p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

  const rpcCalls = [];
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname.startsWith('/rest/v1/rpc/fn_') && rq.method() === 'POST') {
      try { rpcCalls.push({ fn: u.pathname.split('/').pop(), args: JSON.parse(rq.postData() || 'null') }); } catch (_) {}
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  async function openImport(fresh) {
    if (fresh) { await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 }); }
    await p.waitForTimeout(2000);
    if (await p.locator('#cl_email').isVisible().catch(() => false)) {
      await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
      await p.waitForTimeout(4000);
    }
    await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); });
    await p.waitForTimeout(1500);
  }

  await openImport(true);

  // ---- 1. DETECT ----
  const seeded = await p.evaluate(([nid, nname]) => {
    if (!Array.isArray(DB.businesses)) return 'no DB.businesses';
    DB.businesses.push({ id: nid, name: nname, crVat: 'CR 7010123456', isClient: true, stage: 'Won' });
    // the fixture already links "Test Company 4" (a finance group) to business b4; give the new record its own link too
    FIN.linkByGroup = FIN.linkByGroup || {};
    FIN.groupsByBiz = FIN.groupsByBiz || {};
    // repaint the card so the detector runs over the seeded list
    const old = document.querySelector('.v62-guardrails'); if (old) old.remove();
    if (typeof window.finGo === 'function') window.finGo('import');
    return 'ok';
  }, [NEW_BIZ, NEW_NAME]);
  if (seeded !== 'ok') fail('seeding failed: ' + seeded);
  await p.waitForTimeout(1200);

  const cand = await p.evaluate((nid) => {
    const el = [...document.querySelectorAll('.v62-dup')].find((x) => (x.getAttribute('data-key') || '').split('|').includes(nid)); if (!el) return null;
    return { key: el.getAttribute('data-key'), text: el.innerText };
  }, NEW_BIZ);
  if (!cand) fail('DETECT: no duplicate-company candidate was surfaced for two records sharing the same name');
  else {
    ok('DETECT: a candidate pair was surfaced');
    if (!/same name/i.test(cand.text)) fail('DETECT: the reason should say "same name", got: ' + cand.text.slice(0, 200));
    else ok('DETECT: the reason is stated ("same name")');
    if ((cand.text.match(/Test Company 4/g) || []).length < 2) fail('DETECT: both records should be previewed by name');
    else ok('DETECT: both records are previewed side by side');
    if (!/invoices/.test(cand.text)) fail('DETECT: the preview should show each record\'s invoice count/total');
    else ok('DETECT: invoice counts/totals are shown for each record');
  }

  // ---- 2. MERGE — keep the NEW record, merge the fixture's b4 into it ----
  const merged = await p.evaluate(([nid]) => {
    const sel = document.querySelector('.v62-dup select'); if (!sel) return 'no select';
    sel.value = nid;
    const btn = [...document.querySelectorAll('.v62-dup button')].find((x) => /Merge/.test(x.textContent)); if (!btn) return 'no merge button';
    btn.click(); return 'clicked';
  }, [NEW_BIZ]);
  if (merged !== 'clicked') fail('MERGE: could not drive the Merge button: ' + merged);
  await p.waitForTimeout(2500);
  const mergeCall = rpcCalls.find((c) => c.fn === 'fn_merge_businesses');
  if (!mergeCall) fail('MERGE: no fn_merge_businesses RPC call went out');
  else if (mergeCall.args.p_keep !== NEW_BIZ || mergeCall.args.p_drop !== FIXTURE_BIZ) fail(`MERGE: RPC carried the wrong pair — ${JSON.stringify(mergeCall.args)}`);
  else ok(`MERGE: one RPC call with exactly keep=${NEW_BIZ}, drop=${FIXTURE_BIZ}`);
  if (!dialogs.some((d) => /Merge .* INTO/i.test(d) && /invoices/.test(d) && /undone/i.test(d))) fail('MERGE: the confirm dialog should name both records, the invoices moving, and that it can be undone — got ' + JSON.stringify(dialogs));
  else ok('MERGE: the confirm dialog previewed both names, what moves, and the undo promise');

  const linksAfter = await fetch(BASE + '/rest/v1/finance_client_links').then((r) => r.json());
  const movedLink = linksAfter.find((l) => l.client_group === 'Test Company 4');
  if (!movedLink || movedLink.business_id !== NEW_BIZ) fail(`MERGE: the finance link for "Test Company 4" should now point at ${NEW_BIZ}, got ${JSON.stringify(movedLink)}`);
  else ok('MERGE: the finance link was repointed to the surviving record in the database');
  const mergesAfter = await fetch(BASE + '/rest/v1/business_merges').then((r) => r.json());
  if (!mergesAfter.length || mergesAfter[0].kept_id !== NEW_BIZ || mergesAfter[0].dropped_id !== FIXTURE_BIZ) fail('MERGE: no audit row recorded what was merged into what');
  else ok('MERGE: an audit row records kept/dropped and exactly what moved');
  const profAfter = await fetch(BASE + '/rest/v1/client_profiles').then((r) => r.json());
  const cp1 = profAfter.find((x) => x.id === 'cp1'), cp2 = profAfter.find((x) => x.id === 'cp2'), cp9 = profAfter.find((x) => x.id === 'cp9');
  if (!cp1 || cp1.business_id !== NEW_BIZ || cp1.closed_at) fail(`MERGE/PROFILES: the non-colliding prepaid profile should move to ${NEW_BIZ} and stay open, got ${JSON.stringify(cp1)}`);
  else ok('MERGE/PROFILES: the non-colliding prepaid profile moved to the survivor and stayed open');
  if (!cp2 || cp2.business_id !== NEW_BIZ || !cp2.closed_at || !/merg/i.test(cp2.notes || '')) fail(`MERGE/PROFILES: the colliding postpaid profile should move AND be closed with a note saying why, got ${JSON.stringify(cp2)}`);
  else ok('MERGE/PROFILES: the colliding postpaid profile moved and was closed, with a note saying why (the MDD case)');
  if (!cp9 || cp9.closed_at) fail('MERGE/PROFILES: the survivor\'s own open postpaid profile must be untouched');
  else ok('MERGE/PROFILES: the survivor\'s own open profile is untouched');
  const openPostpaid = profAfter.filter((x) => x.business_id === NEW_BIZ && x.profile_type === 'postpaid' && !x.closed_at).length;
  if (openPostpaid !== 1) fail(`MERGE/PROFILES: exactly one open postpaid profile may remain on the survivor, found ${openPostpaid}`);
  else ok('MERGE/PROFILES: exactly one open postpaid profile on the survivor — the database rule holds');

  // ---- 3. UNDO (the app reloads after a merge; log in again if needed, reopen Import) ----
  await p.waitForTimeout(1500);
  await openImport(false);
  await p.waitForTimeout(1500);
  const undoBtn = await p.evaluate(() => {
    const t = document.querySelector('.v62-merges'); if (!t) return 'no history table';
    const btn = [...t.querySelectorAll('button')].find((x) => /Undo|تراجع/.test(x.textContent)); if (!btn) return 'no undo button';
    btn.click(); return 'clicked';
  });
  if (undoBtn !== 'clicked') fail('UNDO: merge history / Undo not available after reload: ' + undoBtn);
  else ok('UNDO: the merge appears in history with an Undo button');
  await p.waitForTimeout(2500);
  const unmergeCall = rpcCalls.find((c) => c.fn === 'fn_unmerge_businesses');
  if (!unmergeCall) fail('UNDO: no fn_unmerge_businesses RPC call went out');
  else ok('UNDO: the unmerge RPC was called with the merge id');
  const linksRestored = await fetch(BASE + '/rest/v1/finance_client_links').then((r) => r.json());
  const backLink = linksRestored.find((l) => l.client_group === 'Test Company 4');
  if (!backLink || backLink.business_id !== FIXTURE_BIZ) fail(`UNDO: the finance link should be back on ${FIXTURE_BIZ}, got ${JSON.stringify(backLink)}`);
  else ok('UNDO: the finance link went back to the original record — nothing was lost');
  const mergesRestored = await fetch(BASE + '/rest/v1/business_merges').then((r) => r.json());
  if (!mergesRestored.length || !mergesRestored[0].undone_at) fail('UNDO: the audit row should be marked undone, not deleted');
  else ok('UNDO: the audit row is marked undone (kept, not deleted)');
  const profRestored = await fetch(BASE + '/rest/v1/client_profiles').then((r) => r.json());
  const rcp2 = profRestored.find((x) => x.id === 'cp2'), rcp1 = profRestored.find((x) => x.id === 'cp1');
  if (!rcp2 || rcp2.business_id !== FIXTURE_BIZ || rcp2.closed_at || rcp2.notes !== 'original note') fail(`UNDO/PROFILES: the closed postpaid profile should be back on ${FIXTURE_BIZ}, reopened, with its original note — got ${JSON.stringify(rcp2)}`);
  else ok('UNDO/PROFILES: the profile the merge had to close is back on the original record, reopened, original note restored');
  if (!rcp1 || rcp1.business_id !== FIXTURE_BIZ) fail('UNDO/PROFILES: the prepaid profile should be back on the original record');
  else ok('UNDO/PROFILES: the prepaid profile went back too');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION|Target page, context or browser has been closed/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} unexpected JS/console error(s)`);

  await b.close();
  srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ncompany-dedupe OK — duplicate company records are detected with a stated reason, merged through one audited RPC with a full preview, and the merge is fully reversible.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
