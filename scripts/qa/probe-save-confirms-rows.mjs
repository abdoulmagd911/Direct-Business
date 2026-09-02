/* probe-save-confirms-rows.mjs — M13 on the app's own SAVE path (js/02): a new lead saved to the
   cloud gets its database id back and is remembered; when the database silently refuses the
   write (no error, no rows), the app must show a save error — never "Cloud synced".
   Run with MOCK_REFUSE_BUSINESS_WRITES=1 to exercise the refusal path (the mock returns [] for
   every businesses write). Written 2026-09-02, attack round 7. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const REFUSE = process.env.MOCK_REFUSE_BUSINESS_WRITES === '1';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = REFUSE ? 8277 : 8276;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const bizPosts = [], rpcs = [];
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname.startsWith('/rest/v1/rpc/')) { rpcs.push(u.pathname.split('/').pop()); }
    if (u.pathname === '/rest/v1/businesses' && rq.method() === 'POST') { try { bizPosts.push(JSON.parse(rq.postData() || 'null')); } catch (_) {} }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(3000);

  // a brand-new lead created the way the app does it (an object in DB.businesses) then saved
  const newId = 'NEWLEAD-' + Date.now();
  // capture every status-pill change the cloud layer makes (setPill → window.__pillHook)
  await p.evaluate(() => { window.__pillLog = []; const o = window.__pillHook; window.__pillHook = function (t, c) { window.__pillLog.push(String(t)); if (o) o(t, c); }; });
  await p.evaluate((id) => { DB.businesses.push({ id, name: 'Probe New Lead ' + id, stage: 'Prospect', contacts: [], activities: [] }); if (typeof save === 'function') save(); }, newId);
  // Sample as soon as the save settles. On a refusal js/49 shows its box and RELOADS the page
  // 4.5 s later, which wipes every in-page witness — a fixed 3 s wait landed after that reload
  // on the first run of this probe and blamed the app for a screen it never saw.
  let state = null;
  for (let i = 0; i < 25; i++) {
    await p.waitForTimeout(200);
    state = await p.evaluate((id) => ({ rowid: (window.__ROWID || {})[id] || null, pill: (window.__pillLog || []).join(' | '), box: /That change was not saved|لم يتم حفظ التعديل/.test(document.body.innerText || ''), reset: !window.__pillLog }), newId).catch(() => null);
    if (state && (state.reset || /Saved|Save issue|Save error/.test(state.pill))) break;
  }
  if (!state) state = { rowid: null, pill: '', box: false, reset: true };
  if (state.reset) fail('the page reloaded before the save settled — the probe could not observe the outcome');

  const posted = bizPosts.flat().some((row) => row && row.legacy_id === newId);
  if (!posted) fail('the new lead never left the browser — no businesses write went out after save()');
  else ok('the new lead was sent to the database');

  console.log('  · rpcs after save:', JSON.stringify(rpcs), 'pills:', JSON.stringify(state.pill));
  if (!REFUSE) {
    if (!state.rowid) fail('after a confirmed save the lead has no database id remembered (ROWID) — the next save would insert it again');
    else ok('the database id came back and is remembered for the new lead');
    if (state.box || /Save issue|Save error/.test(state.pill)) fail('a confirmed save shows "Save error": ' + state.pill);
    else ok('no false error on a confirmed save');
  } else {
    if (state.rowid) fail('REFUSAL: the mock refused every businesses write, yet the app remembered an id for the lead: ' + state.rowid);
    else ok('REFUSAL: no id was invented for a refused write');
    if (!state.box && !/Save issue|Save error|خطأ/.test(state.pill)) fail('REFUSAL: the database accepted 0 of 1 records (no error, no rows) and the app did NOT show a save error — pill: ' + JSON.stringify(state.pill));
    else ok('REFUSAL: a silent refusal is shown as a save error, never as "Cloud synced"');
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS error(s)`);
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log(`\nsave-confirms-rows OK (${REFUSE ? 'refusal path' : 'happy path'})`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
