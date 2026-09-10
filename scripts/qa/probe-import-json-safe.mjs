/* probe-import-json-safe.mjs (2026-09-10, second live pass — Settings) — the two Settings tools that
   replace or clear the workspace ask first, in the page, and never touch the company table.
   Attack area (ad). Measured on the wire, not from the code.

   PORT NOTE: 8701–8773 are taken. This is 8774, verified free by scanning every PORT= in
   scripts/qa.

   Found by reading the Settings card after the snapshot-restore hardening of 2 Sep: the
   "⬆ Import JSON" button right beside "Browse snapshots" had none of it. importFullState() did
   `DB = file` with no question, and only kept the live companies when the FILE had none — and
   every "⬇ Export JSON" file carries all of them. So: export on Monday, import on Friday, and the
   next save (any save — a note, a stage change) archived every company added since Monday and
   wrote Monday's values over the week's edits. Nobody was asked, nobody was told. The snapshot
   restore got the rule on 2 Sep ("leads and clients are NOT part of a snapshot — they stay
   exactly as they are"); the import now follows the same rule and asks the same question. The
   legacy importData()/resetData() (no button, console-only) keep the table for the same reason.
   And "🗑 Wipe local data" asked with the browser's own confirm()+prompt() (freezes the tab) and
   said "This cannot be undone" about a browser cache — the workspace lives in the cloud and
   reloads from it. It now asks in the page and says so. Writing this probe found that the button
   never worked at all: after the person typed WIPE it threw a ReferenceError on an undefined
   BK_KEY_LAST — four keys cleared, then no notice and no reload, nothing on screen. Fixed.

   Under test:
     1. Settings shows "Import JSON" (#v21impFull) and "Wipe local data".
     2. Picking a file whose db has 3 renamed companies and a new bundle template → a question in
        the page (js/57's box) saying leads and clients are NOT imported; NO write yet; Cancel →
        nothing changed (no template, 60 companies, no tag inserted).
     3. Pick again → Confirm → the template is in; the 60 companies are untouched (names as
        before); a tag "auto: before import" was inserted first.
     4. save() afterwards → zero archive PATCHes on businesses, zero upserts carrying the file's
        names; every mock row still archived_at = null.
     5. An invalid file → the in-page notice says "Invalid file", no native box.
     6. Wipe local data: the question is in the page; Cancel → nothing; Confirm → the typed word
        is asked in the page; a wrong word → "Cancelled." notice, nothing cleared; "WIPE" → the
        local copy is cleared and the app reloads from the cloud with all 60 companies; across the
        whole flow no non-GET request to businesses or app_state, no DELETE anywhere.
     7. No native dialog at any point; no JavaScript errors.

   Run:  node scripts/qa/probe-import-json-safe.mjs        (port 8774)
   Sabotage: in core-06 importFullState restore the old `if(!Array.isArray(DB.businesses)||
   !DB.businesses.length)DB.businesses=_keepBiz;` in place of the unconditional keep — checks 3
   and 4 go red (the file's names win; the save archives 57 companies). In v21WipeLocalData put
   `confirm(` back — check 6 and the no-native-dialog check go red. Assert the sabotage APPLIED
   with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import { tapNotices } from './notice-tap.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8774;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const W = [];   // every non-GET request to the mock: {m, path, body}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 40)); await d.dismiss(); });
  const notices = []; await tapNotices(p, (t) => notices.push(t));   // process-side: survives the reload
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (!['GET', 'HEAD'].includes(rq.method())) W.push({ m: rq.method(), path: u.pathname, body: rq.postData() || '' });
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  const boot = async () => {
    await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
    await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded'));
    await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s after load
    await p.evaluate(() => { openLead = null; current = 'settings'; render(); }); await p.waitForTimeout(800);
  };
  await boot();
  const box = () => p.evaluate(() => { const c = document.getElementById('pfConfirmBox'); return c ? c.innerText.replace(/\s+/g, ' ') : null; });
  const notice = () => p.evaluate(() => { const c = document.getElementById('v63Notice'); return c ? [...c.querySelectorAll('[data-v63-text]')].map((x) => x.textContent.trim()).join(' | ') : null; });
  const closeNotice = () => p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); });
  const bizNames = () => p.evaluate(() => DB.businesses.map((x) => x.id + ':' + x.name).sort().join(','));

  /* ---- 1. the two tools are on the page ---- */
  const tools = await p.evaluate(() => ({ imp: !!document.getElementById('v21impFull'), wipe: !!document.querySelector('button[onclick*="v21WipeLocalData"]') }));
  if (tools.imp && tools.wipe) ok('Settings shows "Import JSON" and "Wipe local data"'); else fail(`tools on the page: ${JSON.stringify(tools)}`);

  /* the file: the live db, three companies renamed, most companies dropped, a new template */
  const before = await bizNames();
  const fileDb = await p.evaluate(() => { const d = JSON.parse(JSON.stringify(DB)); d.businesses = d.businesses.slice(0, 3).map((x) => Object.assign(x, { name: 'FILE-' + x.name })); d.bundleTemplates = (d.bundleTemplates || []).concat([{ id: 'tpl_probe', name: 'IMPORT-PROBE-TPL', items: [] }]); return d; });
  const file = { name: 'direct-business-state-v21-2026-01-01.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 'v21', ts: '2026-01-01T00:00:00.000Z', db: fileDb })) };
  const hasTpl = () => p.evaluate(() => (DB.bundleTemplates || []).some((t) => t && t.name === 'IMPORT-PROBE-TPL'));

  /* ---- 2. the question, then Cancel ---- */
  const w0 = W.length;
  await p.setInputFiles('#v21impFull', file); await p.waitForTimeout(700);
  const q2 = await box();
  const writesDuringQuestion = W.length - w0;
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); }); await p.waitForTimeout(500);
  const tagsAfterCancel = W.filter((w) => /app_state_bak/.test(w.path)).length;
  if (q2 && /Leads and clients are NOT imported|NOT part/.test(q2) && writesDuringQuestion === 0 && !(await hasTpl()) && (await bizNames()) === before && tagsAfterCancel === 0 && !(await box()))
    ok('Import JSON asks in the page ("leads and clients are NOT imported"), writes nothing while asking; Cancel changes nothing');
  else fail(`import question: box=${JSON.stringify(q2)} writesWhileAsking=${writesDuringQuestion} tpl=${await hasTpl()} sameCompanies=${(await bizNames()) === before} tags=${tagsAfterCancel} — the live-site silent full replace`);

  /* ---- 3. Confirm: settings in, companies untouched, tag first ---- */
  await p.setInputFiles('#v21impFull', file); await p.waitForTimeout(700);
  const q3 = await box();
  await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await p.waitForTimeout(1500);
  const tag = W.find((w) => /app_state_bak/.test(w.path) && /before import/.test(w.body));
  const after3 = await bizNames();
  if (q3 && (await hasTpl()) && after3 === before && !!tag) ok('Confirm: the file\'s template is in, the 60 companies are exactly as they were, and a tag "auto: before import" went in first');
  else fail(`after Confirm: box=${!!q3} tpl=${await hasTpl()} sameCompanies=${after3 === before} tag=${!!tag} — companies: ${after3.slice(0, 120)}`);

  /* ---- 4. the save afterwards archives nothing ---- */
  const w4 = W.length;
  await p.evaluate(() => { try { save(); } catch (_) { } }); await p.waitForTimeout(3000);
  const later = W.slice(w4);
  const archives = later.filter((w) => /\/rest\/v1\/businesses/.test(w.path) && /archived_at/.test(w.body));
  const fileNames = later.filter((w) => /\/rest\/v1\/businesses/.test(w.path) && /FILE-/.test(w.body));
  const rows = await fetch(`${BASE}/rest/v1/businesses?select=id,archived_at`, { headers: { apikey: 'x' } }).then((r) => r.json()).catch(() => []);
  const archivedRows = rows.filter((r) => r.archived_at != null).length;
  if (archives.length === 0 && fileNames.length === 0 && archivedRows === 0 && rows.length >= 60) ok('the save after the import archives nothing and carries none of the file\'s names — all 60 rows still live in the table');
  else fail(`after save: archivePatches=${archives.length} fileNameUpserts=${fileNames.length} archivedRows=${archivedRows}/${rows.length} — the live-site mass archive`);

  /* ---- 5. an invalid file ---- */
  await p.setInputFiles('#v21impFull', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not json') }); await p.waitForTimeout(700);
  const n5 = await notice();
  if (n5 && /Invalid file/.test(n5) && !dialogs.length) ok(`an invalid file: "${n5.slice(0, 40)}" in the in-page notice, no box`); else fail(`invalid file: notice=${JSON.stringify(n5)} dialogs=${JSON.stringify(dialogs)}`);
  await closeNotice(); await p.waitForTimeout(200);

  /* ---- 6. Wipe local data ---- */
  const w6 = W.length;
  await p.evaluate(() => v21WipeLocalData()); await p.waitForTimeout(400);
  const q6 = await box();
  await p.evaluate(() => { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); }); await p.waitForTimeout(300);
  const keyAfterCancel = await p.evaluate(() => localStorage.getItem('db_cloud_ts') !== null);
  await p.evaluate(() => v21WipeLocalData()); await p.waitForTimeout(400);
  await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await p.waitForTimeout(400);
  const prompt6 = await p.evaluate(() => !!document.getElementById('pfPromptBox'));
  await p.evaluate(() => { const i = document.getElementById('pfPromptInput'); if (i) i.value = 'nope'; const o = document.getElementById('pfPromptOk'); if (o) o.click(); }); await p.waitForTimeout(400);
  const n6 = await notice(); await closeNotice();
  const stillThere = await p.evaluate(() => localStorage.getItem('db_cloud_ts') !== null);
  if (q6 && /local copy|Cloud|cloud|السحاب/.test(q6) && keyAfterCancel && prompt6 && n6 && /Cancelled/.test(n6) && stillThere)
    ok('Wipe local data asks in the page and says the cloud copy is untouched; Cancel keeps everything; the typed word is asked in the page; a wrong word → "Cancelled.", nothing cleared');
  else fail(`wipe flow: box=${JSON.stringify(q6)} keptAfterCancel=${keyAfterCancel} prompt=${prompt6} notice=${JSON.stringify(n6)} keptAfterWrongWord=${stillThere} — the live-site confirm()/prompt() boxes`);
  await p.evaluate(() => { window.__beforeWipe = 1; v21WipeLocalData(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) y.click(); }); await p.waitForTimeout(400);
  const nBefore = notices.length;
  await p.evaluate(() => { const i = document.getElementById('pfPromptInput'); if (i) i.value = 'WIPE'; const o = document.getElementById('pfPromptOk'); if (o) o.click(); });
  await p.waitForTimeout(2000);   // the notice, then the reload 300 ms later
  const noticeWiped = notices.slice(nBefore).join(' | ') || null;
  /* the page is navigating: poll from outside rather than hold one evaluate across the reload */
  let back = false;
  for (let i = 0; i < 90 && !back; i++) { await p.waitForTimeout(1000); try { back = await p.evaluate(() => window.__beforeWipe === undefined && typeof DB !== 'undefined' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3') && window.__roleKnown === true); } catch (_) { back = false; } }
  if (!back) fail('the app did not come back after the wipe');
  await p.waitForTimeout(1500);
  const countAfter = await p.evaluate(() => DB.businesses.length);
  const wipeWrites = W.slice(w6).filter((w) => /\/rest\/v1\/(businesses|app_state)\b/.test(w.path) || w.m === 'DELETE');
  if (noticeWiped && /wiped|reload/i.test(noticeWiped) && countAfter >= 60 && wipeWrites.length === 0) ok(`"WIPE" clears the browser copy and the app reloads from the cloud with ${countAfter} companies — no write to businesses or app_state, no DELETE anywhere`);
  else fail(`wipe: notice=${JSON.stringify(noticeWiped)} companiesAfter=${countAfter} writes=${JSON.stringify(wipeWrites.map((w) => w.m + ' ' + w.path))}`);

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nimport-json-safe OK — Import JSON and Wipe local data ask first, in the page, and the company table is never theirs to replace');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
