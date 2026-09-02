/* probe-no-phantom-writes.mjs — a save that changes nothing must write nothing (2026-09-02,
   attack round 10). Found while reading the Ops board's save pill: "Saved · 20 leads updated"
   after a language toggle that touched no lead. Cause: the people bridge (js/72) created an
   empty contacts/activities array on every company whose stored record had none, so the first
   save() of the session saw those companies as changed and rewrote their rows with this tab's
   copy — on live data 29 companies, rewritten on every session's first save, a stale-overwrite
   window on rows nobody edited. Asserts:
     - after sign-in and the bridge's attach, a no-change save() sends NO businesses write
     - editing one lead's name then sends exactly ONE row, and it is that lead
   Sabotage: drop the `_v72mc` marker in js/72 or its strip in js/02 → the first check goes red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8301;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const posts = [];
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname === '/rest/v1/businesses' && rq.method() === 'POST') { try { posts.push(JSON.parse(rq.postData() || 'null')); } catch (_) {} }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  // wait for the bridge to have attached the table people
  for (let i = 0; i < 25; i++) { await p.waitForTimeout(400); const n = await p.evaluate(() => (window.__v72 && window.__v72.applied && (window.__v72.applied.contacts || 0)) || (DB.businesses || []).filter((x) => (x.contacts || []).some((c) => c && c._fromTable)).length).catch(() => 0); if (n > 0) break; }
  await p.waitForTimeout(1500);
  const bridged = await p.evaluate(() => (DB.businesses || []).filter((x) => (x.contacts || []).some((c) => c && c._fromTable) || (x.activities || []).some((a) => a && a._fromTable)).length);
  console.log('  · companies with table people attached:', bridged, '· businesses writes so far:', JSON.stringify(posts.map((x) => x.length)));
  if (!bridged) fail('fixture drift: the bridge attached nothing, the scenario is empty');
  const before = posts.length;
  if (posts.flat().length) fail('the app wrote ' + posts.flat().length + ' business row(s) during sign-in with no change made — phantom write');
  else ok('sign-in and the bridge wrote no business rows');

  await p.evaluate(() => { save(); }); await p.waitForTimeout(2500);
  const phantom = posts.slice(before).flat();
  if (phantom.length) fail('a no-change save() rewrote ' + phantom.length + ' business row(s) — ' + phantom.slice(0, 5).map((r) => r.legacy_id).join(',') + ' — a stale-overwrite window on rows nobody edited');
  else ok('a no-change save() writes nothing');

  const before2 = posts.length;
  const target = await p.evaluate(() => { const x = (DB.businesses || []).find((y) => (y.contacts || []).some((c) => c && c._fromTable)) || DB.businesses[0]; x.name = x.name + ' (edited)'; save(); return x.id; });
  await p.waitForTimeout(2500);
  const real = posts.slice(before2).flat();
  if (real.length === 1 && String(real[0].legacy_id) === String(target)) ok('editing one lead sends exactly that one row');
  else fail('editing one lead sent ' + real.length + ' row(s): ' + real.map((r) => r.legacy_id).join(',') + ' (expected only ' + target + ')');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nno-phantom-writes OK — a save writes only what changed');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
