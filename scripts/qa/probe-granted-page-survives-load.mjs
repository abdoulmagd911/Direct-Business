/* probe-granted-page-survives-load.mjs (2026-09-10) — a page a person has been GIVEN in Team &
   Access survives the load window. Attack area (ad).

   PORT NOTE: 8701–8769 are taken. This uses 8770 and 8771 (one mock per role), verified free by
   scanning every PORT= in scripts/qa.

   Found by probe-viewer-writes the day it was reinstated (it had sat in battery-excluded.txt as
   "live-system" although it routes everything to the mock): the role arrives from js/02 first
   and the per-person page matrix from js/56 a moment later. In between, js/52's allowedPages()
   fell back to the built-in floor lists — so a team member who HAS Operations in Team & Access,
   opening /ops by address or sitting on it during a reload, was told "Not part of your access —
   ask an admin", moved to Today, and never brought back when the matrix landed.

   Under test:
     1. A team member granted ops boots at /ops (the matrix answers after the role, as live) →
        no refusal box at any point; they end on /ops with the board drawn.
     2. Control: a team member WITHOUT ops boots at /ops → moved to Today and told, in words,
        once the matrix has answered — the refusal still stands for a page they do not have.
     3. (same day) js/64's bounce gates on the same settled() — no banner and no "page refused"
        audit row (rpc log_page_denied) for a page the person has.

   Run:  node scripts/qa/probe-granted-page-survives-load.mjs
   Sabotage: in js/52 gate() and restorePending() use known() instead of settled() — check 1 goes
   red (the box shows, the person lands on Today). Assert the sabotage APPLIED with a marker
   unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
let seq = 0;

const PORT_GRANTED = 8770, PORT_DENIED = 8771;   // PORT = 8770 and PORT = 8771 — one mock per role
async function boot(role, pageAccess, PORT) {
  process.env.MOCK_ROLE = role;
  if (pageAccess) process.env.MOCK_PAGE_ACCESS = JSON.stringify(pageAccess); else delete process.env.MOCK_PAGE_ACCESS;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const boxes = []; const denials = [];
  await p.exposeFunction('__qaBox', (t) => boxes.push(String(t)));
  /* js/52's box AND js/64's banner — the other session's observation: js/64 gated on the role alone
     and could still bounce (and log a refusal) inside the window, with js/52 only restoring the page afterwards */
  await p.addInitScript(() => { const iv = setInterval(() => { const b = document.getElementById('v70box'); if (b && !b.__seen) { b.__seen = true; try { window.__qaBox(b.innerText.replace(/\s+/g, ' ')); } catch (_) { } } const n = document.getElementById('v64-access-denied'); if (n && !n.__seen) { n.__seen = true; try { window.__qaBox('BANNER: ' + n.innerText.replace(/\s+/g, ' ')); } catch (_) { } } }, 100); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      /* the matrix answers a beat after the role, as it does live */
      if (/\/rpc\/log_page_denied/.test(u.pathname)) denials.push(rq.postData());
      if (/\/rpc\/my_page_access/.test(u.pathname)) await new Promise((res) => setTimeout(res, 1500));
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded as ' + role));
  /* inside the window (role known, matrix not yet answered): a render — what an in-app click or a
     re-render does — must not bounce a page the person has */
  await p.evaluate(() => { if (window.__pageAccessLoaded !== true) { current = 'ops'; render(); } });
  await p.waitForFunction(() => window.__pageAccessLoaded === true, { timeout: 30000 }).catch(() => fail('the page matrix never arrived for ' + role));
  await p.waitForTimeout(2500);   // js/52's pass() runs on an interval; let it act on the matrix
  const state = await p.evaluate(() => ({ cur: typeof current !== 'undefined' ? current : null, path: location.pathname, board: !!document.querySelector('#view .col, #view .kanban, #view .ops-board') || /Operations|العمليات/.test((document.querySelector('#view h2, #view h3') || { textContent: '' }).textContent) }));
  await b.close(); srv.close();
  return { state, boxes, errors, denials };
}

async function main() {
  const granted = await boot('team_member', { today: 'editor', leads: 'editor', clients: 'editor', finance: 'editor', ops: 'editor' }, PORT_GRANTED);
  if (granted.state.cur === 'ops' && granted.state.path === '/ops' && !granted.boxes.some((t) => /Not part of your access|خارج نطاق|BANNER/.test(t))) ok('a team member given Operations boots straight onto /ops — no "Not part of your access" box, no js/64 banner, at any point');
  else fail(`granted: ${JSON.stringify(granted.state)} boxes=${JSON.stringify(granted.boxes)} — the live-site false refusal during the load window`);
  if (granted.denials.length === 0) ok('…and no "page refused" row was logged for a page they have'); else fail(`granted: js/64 logged ${granted.denials.length} refusal(s) for a page they have — ${JSON.stringify(granted.denials)}`);
  if (!granted.errors.length) ok('granted: no JavaScript errors'); else fail('granted: JS errors ' + granted.errors.join(' | '));

  const denied = await boot('team_member', { today: 'editor', leads: 'editor', clients: 'editor', finance: 'editor' }, PORT_DENIED);
  if (denied.state.cur === 'today' && denied.boxes.some((t) => /Not part of your access|خارج نطاق/.test(t))) ok('control: a team member without Operations is moved to Today and told, once the matrix has answered');
  else fail(`denied: ${JSON.stringify(denied.state)} boxes=${JSON.stringify(denied.boxes)}`);
  if (!denied.errors.length) ok('denied: no JavaScript errors'); else fail('denied: JS errors ' + denied.errors.join(' | '));

  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ngranted-page-survives-load OK — a page a person has been given is theirs from the first second');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
