/* probe-lead-shortcuts-follow-the-page.mjs (2026-09-25, Phase 1b) — the "Create proposal" and
   "New booking" shortcuts on a lead's card are offered only to someone with FULL control of the page
   they write to (Proposals / Bookings).

   Why: since Phase 1b the database refuses a proposal or a booking from anyone without full control
   of that page. The lead card still offered both shortcuts to every employee — who has neither page
   — so a click produced a record on screen that the database then refused. A button that can only
   fail is worse than none.

   Under test (the stand-in answers my_page_levels from MOCK_ROLE / MOCK_PAGE_ACCESS):
     1. an employee (Today, Leads, Clients, Finance) opening a lead sees NEITHER shortcut;
     2. control: an admin sees BOTH — the shortcuts still exist for whoever may use them;
     3. a person with full Proposals but no Bookings sees only "Create proposal".
   Sabotage: drop the `_mayP('offers')?` condition in js/core/core-06 v19WireExtras — check 1 goes
   red.
   PORT = 9331, 9332, 9333 (one stand-in per person; free when written).                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

async function shortcuts(role, pageAccess, PORT) {
  process.env.MOCK_ROLE = role;
  if (pageAccess) process.env.MOCK_PAGE_ACCESS = JSON.stringify(pageAccess); else delete process.env.MOCK_PAGE_ACCESS;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__pageAccessLoaded === true && typeof render === 'function' && (DB.businesses || []).some((x) => !x.isClient), { timeout: 120000 });
  await p.waitForTimeout(1500);
  const got = await p.evaluate(async () => {
    const lead = DB.businesses.find((x) => !x.isClient && !x.archived);
    current = 'leads'; openLead = lead.id; render();
    await new Promise((res) => setTimeout(res, 1500));
    const head = document.querySelector('#view .detail-head');
    const txt = [].slice.call(document.querySelectorAll('#view .v19LeadCTA button')).map((x) => x.textContent.trim());
    return { head: !!head, buttons: txt };
  });
  await b.close(); srv.close?.();
  return { ...got, errors };
}

const emp = await shortcuts('team_member', { today: 'editor', leads: 'editor', clients: 'editor', finance: 'editor' }, 9331);
const adm = await shortcuts('admin', null, 9332);
const off = await shortcuts('team_member', { today: 'full', leads: 'full', offers: 'full' }, 9333);

(emp.head && !emp.buttons.includes('Create proposal') && !emp.buttons.includes('New booking'))
  ? ok('an employee opening a lead is offered neither shortcut') : fail('employee sees ' + JSON.stringify(emp));
(adm.buttons.includes('Create proposal') && adm.buttons.includes('New booking'))
  ? ok('an admin is still offered both') : fail('admin sees ' + JSON.stringify(adm.buttons));
(off.buttons.includes('Create proposal') && !off.buttons.includes('New booking'))
  ? ok('full on Proposals but not Bookings: only "Create proposal"') : fail('proposals-only sees ' + JSON.stringify(off.buttons));
const errs = emp.errors.concat(adm.errors, off.errors);
errs.length === 0 ? ok('no JS errors') : fail('JS errors: ' + errs.slice(0, 2).join(' | '));
console.log(failures ? 'FAILED — ' + failures : 'lead-shortcuts-follow-the-page OK — a shortcut is offered only where the database will take it');
process.exit(failures ? 1 : 0);
