/* probe-viewer-writes.mjs — a read-only viewer must not be able to CHANGE anything from the
   screen, with records on the pages (2026-09-02, attack round 13). The earlier role probes
   proved navigation and page access; this one attacks the write actions the pages expose once
   they have data (round 10 seeded them): the Ops board's "Advance →", drag-drop between
   columns, "+ New project", "Promote to project", "Add billing profile". Each must be refused
   on screen (the v73 box) with nothing changed in memory and no write sent — the database
   would refuse it anyway, but the screen must not show a move that did not happen.
   Then the same actions as a team_member must go through (so the guard is not over-blocking).
   Sabotage: drop the new names from js/49's guard list → the viewer checks go red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
let importSeq = 0;

async function run(role) {
  process.env.MOCK_ROLE = role; delete process.env.MOCK_PAGE_ACCESS;
  // MOCK_ROLE is read once at module import — a fresh query string forces a fresh evaluation
  const { start } = await import('./mock-supabase.mjs?run=' + (++importSeq) + '-' + role);
  const PORT = 8320 + importSeq;
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const writes = [];
  p.on('dialog', (d) => d.accept());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (/^\/rest\/v1\/app_(requests|projects|offers)$/.test(u.pathname) && rq.method() !== 'GET') writes.push(rq.method() + ' ' + u.pathname);
    if (u.pathname === '/rest/v1/client_profiles' && rq.method() === 'POST') writes.push('POST client_profiles');
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(1500);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(3500);
  await p.waitForFunction(() => window.__roleKnown === true, null, { timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 25; i++) { await p.waitForTimeout(400); const n = await p.evaluate(() => (DB.requests || []).length).catch(() => 0); if (n >= 7) break; }
  await p.evaluate(() => { current = 'ops'; render(); }); await p.waitForTimeout(1200);
  const seenRole = await p.evaluate(() => window.__userRole || window.__userTier || null);
  console.log(`\n[${role}] app sees role: ${seenRole}`);
  const boxShown = () => p.evaluate(() => { const b = document.getElementById('v70box'); const t = b ? b.innerText : ''; if (b) b.remove(); return t; });
  const viewer = role === 'viewer';

  // 1. Advance →
  const before = await p.evaluate(() => DB.requests.find((r) => r.id === 'req0').stage);
  await p.evaluate(() => { advanceReq('req0'); }); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => DB.requests.find((r) => r.id === 'req0').stage);
  let box = await boxShown();
  if (viewer) {
    if (after === before && /can’t change requests|لا يمكنك تعديل الطلبات/.test(box) && !writes.some((w) => /app_requests/.test(w))) ok('viewer: "Advance →" refused on screen, stage stayed ' + before + ', nothing written');
    else fail('viewer: "Advance →" — stage ' + before + '→' + after + ', box "' + box.slice(0, 40) + '", writes ' + JSON.stringify(writes));
  } else {
    if (after !== before && !box) ok(role + ': "Advance →" went through (' + before + '→' + after + ')');
    else fail(role + ': "Advance →" blocked — stage ' + after + ', box "' + box.slice(0, 40) + '"');
  }

  // 2. drag-drop a card into another column
  writes.length = 0;
  const b1 = await p.evaluate(() => DB.requests.find((r) => r.id === 'req1').stage);
  await p.evaluate(() => { _drag = { kind: 'req', id: 'req1' }; dropOn({ preventDefault() {} }, 'req', 'Booked', null); }); await p.waitForTimeout(1500);
  const a1 = await p.evaluate(() => DB.requests.find((r) => r.id === 'req1').stage);
  box = await boxShown();
  if (viewer) {
    if (a1 === b1 && /can’t change requests|لا يمكنك تعديل الطلبات/.test(box) && !writes.length) ok('viewer: drag-drop refused, stage stayed ' + b1);
    else fail('viewer: drag-drop — ' + b1 + '→' + a1 + ', box "' + box.slice(0, 40) + '", writes ' + JSON.stringify(writes));
  } else {
    if (a1 === 'Booked') ok(role + ': drag-drop went through (' + b1 + '→Booked)');
    else fail(role + ': drag-drop blocked — stage ' + a1);
  }

  // 3. + New project
  await p.evaluate(() => { current = 'projects'; render(); }); await p.waitForTimeout(900);
  const pn = await p.evaluate(() => (DB.projects || []).length);
  await p.evaluate(() => { v25NewProject(); }); await p.waitForTimeout(900);
  const pn2 = await p.evaluate(() => (DB.projects || []).length);
  const modalOpen = await p.evaluate(() => { const m = document.getElementById('ov'); const o = m && m.classList.contains('show'); try { closeModal(); } catch (_) {} return o; });
  box = await boxShown();
  if (viewer) {
    if (pn2 === pn && /can’t change proposals|لا يمكنك تعديل العروض/.test(box) && !modalOpen) ok('viewer: "+ New project" refused, no project added, no form opened');
    else fail('viewer: "+ New project" — projects ' + pn + '→' + pn2 + ', form open ' + modalOpen + ', box "' + box.slice(0, 40) + '"');
  } else {
    if (pn2 > pn || modalOpen) ok(role + ': "+ New project" opens / adds');
    else fail(role + ': "+ New project" blocked');
  }

  // 4. Add billing profile (client card)
  const cid = await p.evaluate(() => (DB.businesses.find((x) => x.isClient) || {}).id);
  await p.evaluate((id) => { v34AddProfile(id); }, cid); await p.waitForTimeout(700);
  const cpOpen = await p.evaluate(() => { const o = !!document.getElementById('cp_id'); try { closeModal(); } catch (_) {} return o; });
  box = await boxShown();
  if (viewer) {
    if (!cpOpen && /can’t change companies|لا يمكنك تعديل الشركات/.test(box)) ok('viewer: "Add billing profile" refused, no form opened');
    else fail('viewer: "Add billing profile" — form open ' + cpOpen + ', box "' + box.slice(0, 40) + '"');
  } else {
    if (cpOpen) ok(role + ': "Add billing profile" opens');
    else fail(role + ': "Add billing profile" blocked');
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  if (realErrors.length) fail(role + ': ' + realErrors.length + ' JS error(s): ' + realErrors[0]);
  await b.close(); srv.close();
}

async function main() {
  await run('viewer');
  await run('team_member');
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nviewer-writes OK — a read-only person cannot move, add or promote anything from the screen; a team member can');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
