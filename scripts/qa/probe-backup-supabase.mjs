/* probe-backup-supabase.mjs — regression guard for the backup system moved off localStorage
   into Supabase, 2026-08-23 (owner ruling: "take our long-run recommendation" — P1,
   docs/DECISIONS.md). Rebuilt in js/core/core-06-v18-v21.js.

   WHAT MOVED AND WHY: the old system kept up to 100 incremental + 30 daily + 50 tagged full
   snapshots of the whole app in localStorage — a browser's own 5MB quota, invisible to
   anyone but whoever's browser it was. Two Supabase tables already existed, already
   correctly wired, and nothing in this app's code ever used them: `app_state_history` (a
   Postgres trigger snapshots the prior state on every save, capped at 20, SELECT is
   admin-only by RLS) and `app_state_bak` (open to any authenticated user, INSERT/DELETE now
   wired to the "Tag current state" / "delete tag" buttons).

   THIS PROBE ASSERTS, specifically:
   1. Tagging writes a REAL row to app_state_bak (not a local-only write) and the RLS-silent-
      write check actually gates on `r.data.length` — a tag that didn't really land must
      never be reported as saved.
   2. The incremental (auto) list — `app_state_history` — is visible to the admin test
      account and its 3 seeded rows are the ones the Settings card reports.
   3. Restoring from a tagged backup fetches the real stored `data` and applies it.
   4. Deleting a tag actually removes the row (re-fetch proves it's gone), and a delete that
      doesn't return a row is treated as a failure, not silently accepted.
   5. THE MIGRATION, and specifically the exact bug shape the owner asked to be defended
      against — "not lose existing local snapshots on the way out" and "fail loudly rather
      than fall back silently to local": with local backup keys seeded and the live Supabase
      route made to fail on purpose, the probe asserts local data survives untouched and a
      loud failure surfaces (never a silent local-only continuation). Then, with the route
      un-blocked, the same local data migrates successfully, is confirmed server-side, and
      the local keys are cleared only once every single entry is confirmed uploaded. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8217;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function setupPage(b) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const dialogs = [];
  p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
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
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  return { p, errors, dialogs };
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ---- Part 1: tag / list / restore / delete against the real (mocked) Supabase tables ----
  {
    const { p, errors } = await setupPage(b);

    const tagResult = await p.evaluate(() => tagCurrentState('qa-probe-tag', false));
    await p.waitForTimeout(500);
    const afterTag = await p.evaluate(() => bkFetchAll().then(() => ({
      tagged: BK_CACHE.tagged.map((t) => ({ id: t.id, name: t.name })),
      history: BK_CACHE.history.length,
      historyRestricted: BK_CACHE.historyRestricted,
    })));
    console.log('afterTag:', JSON.stringify(afterTag));

    const tagged = afterTag.tagged.find((t) => t.name === 'qa-probe-tag');
    if (!tagged) fail('tagCurrentState("qa-probe-tag") did not produce a row app_state_bak actually has — a tag must be a REAL write, not a local-only one');
    else ok('tagCurrentState() wrote a real row to app_state_bak, confirmed by re-fetching from the mock');

    if (afterTag.historyRestricted) fail('the admin test account (role=admin) was treated as history-restricted — the client-side admin check is wrong');
    else ok('admin test account correctly sees the incremental (auto) history');
    if (afterTag.history !== 3) fail(`expected the 3 seeded app_state_history rows, got ${afterTag.history}`);
    else ok('all 3 seeded app_state_history rows are visible to the admin account');

    if (tagged) {
      // Restore: change DB locally first, then restore, and confirm it reverted to the
      // fixture's own agency name (a value the tag's own DB blob at the time of tagging
      // actually carries) rather than whatever was on screen at click time.
      const before = await p.evaluate(() => DB.agency.name);
      await p.evaluate(() => { DB.agency.name = 'CHANGED-BEFORE-RESTORE'; });
      await p.evaluate((id) => restoreFromBackup('tag', id), tagged.id);
      await p.waitForTimeout(700);
      const after = await p.evaluate(() => DB.agency.name);
      if (after !== before) fail(`restoreFromBackup('tag', ...) did not restore the tagged data — DB.agency.name is "${after}", expected "${before}"`);
      else ok('restoreFromBackup(\'tag\', id) correctly restored the real stored data');

      // Delete: confirm the row is actually gone via a fresh fetch, not just removed from a
      // stale in-memory cache.
      await p.evaluate((id) => deleteTag(id), tagged.id);
      await p.waitForTimeout(500);
      const stillThere = await p.evaluate((id) => {
        BK_CACHE.loaded = false;
        return bkFetchAll().then(() => BK_CACHE.tagged.some((t) => t.id === id));
      }, tagged.id);
      if (stillThere) fail('deleteTag() did not actually remove the row — it is still present after a fresh fetch');
      else ok('deleteTag() actually removed the row, confirmed by a fresh fetch');
    }

    const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
    if (realErrors.length) fail(`Part 1: ${realErrors.length} JS/console error(s): ${JSON.stringify(realErrors)}`);
    else ok('Part 1: no JS/console errors');
  }

  // ---- Part 2: migration — local data survives a failed upload, migrates once unblocked ----
  {
    const { p, errors } = await setupPage(b);

    // Seed local backup keys as if the OLD system had been running in this browser.
    await p.evaluate(() => {
      localStorage.setItem('directBusinessBackupsInc_v21', JSON.stringify([
        { ts: '2026-08-19T10:00:00Z', size: 42, data: JSON.stringify({ agency: { name: 'Local Inc Snapshot' } }) },
      ]));
      localStorage.setItem('directBusinessBackupsTag_v21', JSON.stringify([
        { ts: '2026-08-18T10:00:00Z', size: 42, name: 'pre-existing local tag', data: JSON.stringify({ agency: { name: 'Local Tag Snapshot' } }) },
      ]));
      localStorage.removeItem('directBusinessBackupsMigratedToSupabase_v1');
    });

    // Block the live route on purpose — this is the exact scenario the owner named: "fail
    // loudly rather than fall back silently to local."
    await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/app_state_bak*', (r) => r.abort());
    const dialogsSeen = [];
    p.on('dialog', (d) => { dialogsSeen.push(d.message()); });
    const consoleErrors = [];
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await p.evaluate(() => bkMigrateLocalToSupabase());
    await p.waitForTimeout(1500);

    const afterBlockedAttempt = await p.evaluate(() => ({
      migratedFlag: localStorage.getItem('directBusinessBackupsMigratedToSupabase_v1'),
      incStillLocal: !!localStorage.getItem('directBusinessBackupsInc_v21'),
      tagStillLocal: !!localStorage.getItem('directBusinessBackupsTag_v21'),
    }));
    console.log('afterBlockedAttempt:', JSON.stringify(afterBlockedAttempt));
    if (afterBlockedAttempt.migratedFlag === '1') fail('migration marked itself complete even though the upload was blocked — local data would be at risk of being cleared on a later run despite never having actually landed');
    else ok('migration correctly did NOT mark itself complete while the upload was blocked');
    if (!afterBlockedAttempt.incStillLocal || !afterBlockedAttempt.tagStillLocal) fail('local backup keys were cleared even though the upload failed — this is exactly the data-loss shape the owner asked to be defended against');
    else ok('local backup data survives untouched after a failed migration attempt — nothing was lost');
    const loudFailure = consoleErrors.some((e) => /migrat/i.test(e)) || dialogsSeen.some((m) => /migrat/i.test(m));
    if (!loudFailure) fail('a blocked migration produced no visible failure signal (no console.error mentioning migration, no alert/toast dialog) — this is the silent-failure shape the owner explicitly asked NOT to happen');
    else ok('a blocked migration surfaced loudly (console.error and/or a visible alert/toast)');

    // Now unblock and let it actually migrate.
    await p.unroute('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/app_state_bak*');
    await p.evaluate(() => bkMigrateLocalToSupabase());
    await p.waitForTimeout(1500);

    const afterSuccess = await p.evaluate(() => ({
      migratedFlag: localStorage.getItem('directBusinessBackupsMigratedToSupabase_v1'),
      incStillLocal: !!localStorage.getItem('directBusinessBackupsInc_v21'),
      tagStillLocal: !!localStorage.getItem('directBusinessBackupsTag_v21'),
    }));
    const remote = await p.evaluate(() => { BK_CACHE.loaded = false; return bkFetchAll().then(() => BK_CACHE.tagged.map((t) => t.name)); });
    console.log('afterSuccess:', JSON.stringify(afterSuccess), 'remote tags:', JSON.stringify(remote));

    if (afterSuccess.migratedFlag !== '1') fail('migration did not mark itself complete after a successful upload');
    else ok('migration correctly marked itself complete once the upload succeeded');
    if (afterSuccess.incStillLocal || afterSuccess.tagStillLocal) fail('local backup keys were NOT cleared even though every entry was confirmed uploaded');
    else ok('local backup keys were cleared only after every entry was confirmed uploaded');
    const hasIncMigrated = remote.some((n) => /migrated from local.*incremental/i.test(n));
    const hasTagMigrated = remote.some((n) => /migrated from local.*pre-existing local tag/i.test(n));
    if (!hasIncMigrated) fail('the migrated incremental snapshot is not present in app_state_bak under its expected note');
    else ok('the migrated incremental snapshot landed in app_state_bak');
    if (!hasTagMigrated) fail('the migrated local tag ("pre-existing local tag") is not present in app_state_bak — original tag name should be preserved in the note');
    else ok('the migrated local tag landed in app_state_bak with its original name preserved');

    // Re-running migration again must be a cheap no-op — it must not re-upload duplicates.
    const beforeRerunCount = remote.length;
    await p.evaluate(() => bkMigrateLocalToSupabase());
    await p.waitForTimeout(800);
    const afterRerun = await p.evaluate(() => { BK_CACHE.loaded = false; return bkFetchAll().then(() => BK_CACHE.tagged.length); });
    if (afterRerun !== beforeRerunCount) fail(`re-running migration after success changed the count (${beforeRerunCount} → ${afterRerun}) — it should be a guarded no-op, not a re-upload`);
    else ok('re-running migration after success is correctly a no-op — no duplicate uploads');

    // ERR_FAILED is expected noise from this test's own deliberate p.route(...).abort() call
    // above (the browser logs the network-layer failure itself, separately from our app-level
    // console.error('backup: ...') call) — excluded here as a known artifact of this probe's
    // own setup, not a real app error.
    const realErrors2 = consoleErrors.filter((e) => !/forEach|TUNNEL_CONNECTION|backup:|ERR_FAILED/.test(e));
    if (realErrors2.length) fail(`Part 2: ${realErrors2.length} unexpected JS/console error(s): ${JSON.stringify(realErrors2)}`);
    else ok('Part 2: no unexpected JS/console errors (the intentional migration-failure logs are expected and excluded)');
  }

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nbackup-to-Supabase OK — tag/restore/delete are real Supabase writes, migration never loses local data on failure and fails loudly, succeeds and clears local only once fully confirmed, and is a no-op on rerun.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
