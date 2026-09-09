/* probe-deeplink-survives-role-wait.mjs (2026-09-09, live test finding N1) — an address typed
   into the browser opens that page, once the app knows who is asking. Attack area (ad).

   PORT NOTE: 8701–8751 are taken. This is 8752 (admin run) and 8753 (employee run), verified
   free by scanning every PORT= in scripts/qa.

   Found on the live site, by hand, as an ADMIN: /reports, /settings and /ops all landed on
   Today; /finance, /leads and /clients worked. Reproduced in the harness: while the role is
   still unknown js/52 holds to the employee floor (Today, Leads, Clients, Finance) and its gate
   moved the person to Today "for now" — but nothing ever moved them back, and js/03 had already
   rewritten the address to /today. Finance survived only because js/16 re-applies its own deep
   link.

   Under test:
     1. Admin opens /reports, /settings, /ops (each in a fresh page), signs in at the form →
        within a few seconds the page IS the one asked for, and the address bar says so.
     2. Employee (team_member, floor pages only) opens /settings → stays on Today, and is told
        once in words (the refusal that stands once the role is known is unchanged).
     3. Employee opens /leads (allowed) → lands on Leads.

   Run:  node scripts/qa/probe-deeplink-survives-role-wait.mjs        (ports 8752 + 8753)
   Sabotage: in js/52 gate() drop the `window.__pendingDeepPage=was` line (or make
   restorePending return at once) — check 1 goes red for all three addresses. Assert the
   sabotage APPLIED with a marker unique to it; confirm the restore by marker count and git
   status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const UID = '11111111-1111-1111-1111-111111111111';

async function drive(b, BASE, path) {
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
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
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  /* settle: sample every 500 ms for 8 s and keep the last reading — the role arrives on its own
     schedule and js/52 passes every 3 s, so the final state is what a person ends up seeing. */
  let last = null;
  for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); last = await p.evaluate(() => ({ cur: typeof current !== 'undefined' ? current : null, path: location.pathname, known: window.__roleKnown === true, told: /Not part of your access|admin accounts|not part of it|خارج نطاق/.test(document.body.innerText || '') })); }
  await p.close();
  return last;
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  /* ---- 1. admin ---- */
  const srvA = start(8752); const BA = 'http://localhost:8752';
  for (const path of ['/reports', '/settings', '/ops']) {
    const r = await drive(b, BA, path);
    const want = path.slice(1);
    if (r.cur === want && r.path === path && r.known) ok(`admin typed ${path} → on "${r.cur}" at ${r.path} once the role was known`);
    else fail(`admin typed ${path} → ended on "${r.cur}" at ${r.path} (role known: ${r.known}) — the live-site defect: the address bounced to Today`);
  }
  srvA.close();

  /* ---- 2 + 3. employee ---- */
  const srvE = start(8753, { app_users: [
    { id: UID, email: 'test@directksa.com', full_name: 'QA Test Account', role: 'team_member', active: true, created_at: '2026-08-08T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: { today: 'editor', leads: 'editor', clients: 'editor', finance: 'editor' } },
  ] });
  const BE = 'http://localhost:8753';
  let r = await drive(b, BE, '/settings');
  if (r.cur === 'today' && r.known && r.told) ok(`employee typed /settings → held on Today and told in words (role known)`);
  else if (r.cur === 'today' && r.known) fail(`employee typed /settings → held on Today but NOT told: the refusal went silent (${JSON.stringify(r)})`);
  else fail(`employee typed /settings → ended on "${r.cur}" (role known: ${r.known}) — an employee reached a page outside their access, or the role never arrived`);
  r = await drive(b, BE, '/leads');
  if (r.cur === 'leads' && r.path === '/leads') ok('employee typed /leads → on Leads');
  else fail(`employee typed /leads → ended on "${r.cur}" at ${r.path}`);
  srvE.close();

  await b.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ndeeplink-survives-role-wait OK — a typed address opens its page once the app knows who is asking');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
