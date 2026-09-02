/* probe-two-tabs.mjs — two people, two tabs, one workspace (2026-09-02, attack round 17).
   The owner's team works in parallel; the app promises (js/02 row-level saves, js/19 partial
   blob saves) that two people editing DIFFERENT things never overwrite each other. Driven
   for real with two browser contexts on one mock:
     - A renames lead L1 and saves; B — whose copy of L1 is stale — edits lead L2's notes and
       saves. Both must land: L1 keeps A's name, L2 carries B's note (row-level upserts).
     - A changes a setting; B adds a service-level row. Both must land in the workspace blob
       (each tab patches only the section it changed).
   The one documented limit (same record, two tabs = last write wins) is not asserted here.
   Sabotage: make js/19 send the whole blob instead of the changed sections → B's stale settings
   wipe A's flag → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8351;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function tab(b, label) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  p.__errors = []; p.on('pageerror', (e) => p.__errors.push(label + ' JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(1500);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(7000);   // sign-in + the people bridge's settle
  return p;
}
const biz = async (legacy) => (await (await fetch(BASE + '/rest/v1/businesses?legacy_id=eq.' + legacy)).json())[0] || {};
const blob = async () => ((await (await fetch(BASE + '/rest/v1/app_state?id=eq.1')).json())[0] || {}).data || {};

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const A = await tab(b, 'A');
  const B = await tab(b, 'B');   // B loads AFTER A, but before A changes anything — both start equal

  // ---- rows: A renames L1, then B (stale L1) edits L2
  await A.evaluate(() => { const x = DB.businesses.find((y) => y.id === 'L1'); x.name = 'Tab A renamed L1'; save(); });
  await A.waitForTimeout(2500);
  await B.evaluate(() => { const x = DB.businesses.find((y) => y.id === 'L2'); x.notes = 'Tab B note on L2'; save(); });
  await B.waitForTimeout(2500);
  const l1 = await biz('L1'), l2 = await biz('L2');
  if (l1.name === 'Tab A renamed L1') ok("A's rename of L1 is in the table after B's later save (B did not write its stale copy of L1)");
  else fail("A's rename of L1 was lost — table has name " + JSON.stringify(l1.name));
  if ((l2.notes || (l2.raw || {}).notes) === 'Tab B note on L2') ok("B's note on L2 is in the table");
  else fail("B's note on L2 did not land — table notes " + JSON.stringify(l2.notes) + ' raw.notes ' + JSON.stringify((l2.raw || {}).notes));
  const bSeesA = await B.evaluate(() => DB.businesses.find((y) => y.id === 'L1').name);
  console.log("  · B's in-memory copy of L1 (stale by design until reload): " + JSON.stringify(bSeesA));

  // ---- blob: A changes a setting, B adds a service-level row
  await A.evaluate(() => { DB.settings = DB.settings || {}; DB.settings.qaTwoTabsA = 'A-flag'; save(); });
  await A.waitForTimeout(2500);
  await B.evaluate(() => { DB.slas = DB.slas || []; DB.slas.push({ id: 'sla-two-tabs', event: 'Two tabs', direct: '', market: '', whale: '', rank: 'meet' }); save(); });
  await B.waitForTimeout(2500);
  const d = await blob();
  const hasFlag = d.settings && d.settings.qaTwoTabsA === 'A-flag';
  const hasSla = Array.isArray(d.slas) && d.slas.some((s) => s && s.id === 'sla-two-tabs');
  if (hasFlag && hasSla) ok("both blob changes landed — A's setting survived B's later save, B's service-level row is there (partial saves)");
  else fail('blob after both saves — A flag present: ' + hasFlag + ', B sla present: ' + hasSla + ' (sections sent by B must not carry its stale settings)');

  const errs = [...A.__errors, ...B.__errors].filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  if (errs.length) fail(errs.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ntwo-tabs OK — two people editing different things never overwrite each other');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
