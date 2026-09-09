/* probe-employee-signin-shape.mjs (2026-09-09) — what a TEAM MEMBER's session looks like when
   they sign in the way people do: by typing, not by autofill.

   Found by driving the real app against the real database as the QA account switched to
   team_member (7 of the 11 live accounts are that role). Three things, none visible to an admin:

     1. js/56 asked for the person's page matrix at 1.2 s and 5 s after the PAGE loaded — before
        anyone had typed a password. Anonymous, refused (401), swallowed, never asked again. So
        on a normal sign-in the matrix never arrived and whatever the owner set in Team & Access
        was not in effect until a reload. js/54 did the same with nicknames. The live server log
        showed 31 of 39 my_page_access calls in a day answered 401 for exactly this reason.
     2. js/64's "You do not have access to that page" banner was re-asserted on EVERY render for
        eight seconds after a bounce — including the render of Leads or Finance the person opened
        next — and never removed, so it sat above pages they were allowed on until the next full
        render. Pressing "New request" on a lead card is enough to trigger it.
     3. js/35 fired a write to the shared settings row on every save, and the database refused
        every one of them (403) — right, but one failing request per save, forever.

   Under test, with the account seeded as team_member and a 7-second pause at the sign-in form:
     A. Nothing asks the database for the page matrix or the nicknames before sign-in.
     B. After sign-in the matrix arrives anyway (__pageAccessLoaded, with the seeded pages) and so
        do the nicknames.
     C. Control: a bounce (Operations is not granted) lands on Today WITH the banner.
     D. The next render of an allowed page has no banner; and on Today itself the banner is gone
        within nine seconds.
     E. Two saves by the employee produce at most ONE settings write, and it was refused by the
        mock (the control — if the mock stopped refusing, the count would prove nothing).

   Run:  node scripts/qa/probe-employee-signin-shape.mjs        (port 9034)
   Sabotage (file-level): put js/56's two setTimeout(loadMine, …) calls back without the
   __roleKnown gate — A and B go red. Drop js/64's hideBanner() — D goes red. Drop js/35's
   _settingsRefused latch — E goes red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9034;
const BASE = 'http://localhost:' + PORT;
const UID = '11111111-1111-1111-1111-111111111111';
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const srv = start(PORT, {
  app_users: [
    { id: UID, email: 'test@directksa.com', full_name: 'QA Test Account', role: 'team_member', active: true, created_at: '2026-08-08T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: { today: 'editor', leads: 'editor', clients: 'editor', finance: 'editor' } },
    { id: 'u-assem', email: 'assem.alsweed@directksa.com', full_name: 'Assem Alsweed', nickname: 'Assem', role: 'team_member', active: true, created_at: '2026-08-09T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: { today: 'editor', leads: 'editor' } },
  ],
});

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p.on('dialog', (d) => d.accept().catch(() => { }));
  let apikey = null, signedInAt = 0;
  const early = [];            // matrix / nickname calls made before sign-in
  const settingsWrites = [];   // status of every POST to app_settings
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const h = rq.headers();
    if (h.apikey) apikey = h.apikey;
    const anon = !h.authorization || h.authorization.replace(/^Bearer\s+/i, '') === apikey;
    if (/rpc\/(my_page_access|team_nicknames)/.test(u.pathname) && (anon || !signedInAt)) early.push((anon ? 'ANON ' : '') + u.pathname.replace('/rest/v1/rpc/', ''));
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: h, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const rh = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) rh[k] = v; });
      if (rq.method() === 'POST' && /\/rest\/v1\/app_settings/.test(u.pathname)) settingsWrites.push(resp.status);
      await r.fulfill({ status: resp.status, headers: rh, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 90000 });
  await p.waitForTimeout(7000);   /* the typing window — longer than every timer the old code used */
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  signedInAt = Date.now();

  /* A */
  if (!early.length) ok('nothing asked for the page matrix or the nicknames before sign-in — no anonymous calls, no 401s');
  else fail(`${early.length} call(s) went out before sign-in: ${JSON.stringify(early)} — each one is refused by the real database, swallowed, and (for the matrix) never retried`);

  /* B */
  let got = null;
  for (let i = 0; i < 40; i++) {
    got = await p.evaluate(() => ({ loaded: window.__pageAccessLoaded === true, pages: Object.keys(window.__pageAccess || {}), nick: Object.keys(window.__nickMap || {}).length, role: window.__userRole })).catch(() => null);
    if (got && got.loaded && got.nick) break;
    await p.waitForTimeout(500);
  }
  if (got && got.role !== 'team_member') fail(`the fixture did not take: the app holds role ${got.role}, so nothing below is about an employee`);
  if (got && got.loaded && got.pages.length === 4) ok(`after a typed sign-in the page matrix arrived on its own (${got.pages.join(', ')})`);
  else fail(`after sign-in + 20s the page matrix is ${got && got.loaded ? 'loaded with ' + got.pages.length + ' pages' : 'NOT loaded'} — the owner's Team & Access settings are not in effect for this session`);
  if (got && got.nick) ok(`the nickname map arrived too (${got.nick} name(s))`);
  else fail('the nickname map never arrived after a typed sign-in');

  /* C — control */
  await p.waitForTimeout(1500);
  const bounced = await p.evaluate(() => { current = 'ops'; render(); return { current: current, banner: !!document.getElementById('v64-access-denied') }; });
  if (bounced.current === 'today' && bounced.banner) ok('control: opening Operations bounces the employee to Today with the explanation showing');
  else fail(`control failed: opening Operations left current=${bounced.current} banner=${bounced.banner} — the bounce itself is not working, so D means nothing`);

  /* D */
  await p.waitForTimeout(400);
  const onLeads = await p.evaluate(() => { current = 'leads'; render(); return { current: current, banner: !!document.getElementById('v64-access-denied') }; });
  await p.waitForTimeout(600);
  const onLeads2 = await p.evaluate(() => ({ current: current, banner: !!document.getElementById('v64-access-denied'), text: (document.getElementById('view').innerText || '').slice(0, 80) }));
  if (onLeads.current === 'leads' && !onLeads.banner && !onLeads2.banner) ok('opening Leads right after the bounce shows Leads with NO "no access" banner');
  else fail(`the "You do not have access" banner is sitting on Leads (${JSON.stringify(onLeads2)}) — a page the matrix grants`);

  await p.evaluate(() => { current = 'ops'; render(); });
  await p.waitForTimeout(300);
  const t0 = await p.evaluate(() => ({ current: current, banner: !!document.getElementById('v64-access-denied') }));
  await p.waitForTimeout(9200);
  const t9 = await p.evaluate(() => ({ current: current, banner: !!document.getElementById('v64-access-denied') }));
  if (t0.banner && !t9.banner) ok('on Today the banner shows for its eight seconds and then goes away by itself');
  else fail(`banner on Today: at 0.3s=${t0.banner}, at 9.5s=${t9.banner} — ${t0.banner ? 'it never leaves' : 'it did not show at all'}`);

  /* E */
  const before = settingsWrites.length;
  /* make the tab's settings differ from the row, the way the funnel layer and the workspace
     blob do on a real load — otherwise no write is attempted and the count proves nothing */
  await p.evaluate(() => { DB.settings = DB.settings || {}; DB.settings.__probeDrift = Date.now(); const b0 = (DB.businesses || [])[0]; if (b0) { b0.nextActionNote = 'employee probe 1'; save(); } });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const b0 = (DB.businesses || [])[0]; if (b0) { b0.nextActionNote = 'employee probe 2'; save(); } });
  await p.waitForTimeout(3000);
  const mine = settingsWrites.slice();   /* the whole session: a refusal latched earlier counts, and so does any retry */
  const refused = mine.filter((s) => s === 403).length;
  if (!mine.length) fail('no settings write was attempted in the whole session, so the latch was never exercised — the drift this probe injects is not reaching syncOps');
  else if (!refused) fail(`the mock ACCEPTED an employee's settings write (${JSON.stringify(mine)}) — the live policy refuses it, so this run measured the wrong world`);
  else if (mine.length === 1) ok(`the whole session produced exactly one settings write (refused 403, before=${before}) and the two saves after it produced none — the refusal is remembered, not repeated`);
  else fail(`two employee saves produced ${mine.length} settings writes (${JSON.stringify(mine)}) — every save fires a request the database is going to refuse`);

  await b.close();
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
