/* probe-role-nav.mjs — Spec 7b (2026-08-21): what does the SIDEBAR actually show, per role,
   with no password and no second account?

   mock-supabase.mjs now answers app_role()/my_page_access() from MOCK_ROLE/MOCK_PAGE_ACCESS
   env vars, reading the SAME app_users row the login layer reads (see that file's comment).
   This script drives the real app against that mock, once per role, and reads which nav
   buttons actually rendered.

   ONLY VISIBLE buttons count (offsetParent!==null). The access layer hides a forbidden page
   with display:none, not by removing it from the DOM — a script that queries all buttons by
   selector, ignoring visibility, can "click" one a real person would never see and report
   nav gating as broken when it isn't. (That was this script's own first version. Fixed here.)

   admin/manager/team_member are today's three REAL roles, each with a real page_access
   matrix already read from the live database on 2026-08-21:
     manager     = leads,today,events,offers,archive,clients,finance,activity,airlines,settings — all editor
     team_member = leads,today,clients,finance — all editor
   bd/operations/viewer have no live page_access matrix (zero real accounts hold those roles
   today — verified against app_users). For those three this script passes NO
   MOCK_PAGE_ACCESS, which is exactly what a real freshly-assigned account with no matrix
   entry looks like — my_page_access() legitimately returns null, and the app's own
   documented fallback (js/52-v76-access-model.js: allowedPages()) takes over: manager gets
   PAGES_MANAGER, every other non-admin role gets PAGES_EMPLOYEE. This script checks that
   REAL fallback path, not an invented expectation for a role nobody has yet.

   Run: node probe-role-nav.mjs   (spawns itself once per role; each child sets MOCK_ROLE
   itself, so nothing here is a guess about env-var wiring elsewhere). */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const SELF = fileURLToPath(import.meta.url);

const REAL_MATRIX = {
  admin:       null, // admin ignores the matrix entirely (my_page_access() returns null for admin too)
  manager:     { leads:'editor', today:'editor', events:'editor', offers:'editor', archive:'editor', clients:'editor', finance:'editor', activity:'editor', airlines:'editor', settings:'editor' },
  team_member: { leads:'editor', today:'editor', clients:'editor', finance:'editor' },
  bd:          null, // no live matrix — tests the real no-matrix-yet fallback
  operations:  null,
  viewer:      null,
};
const PAGES_MANAGER  = ['today','leads','clients','finance','offers','events','airlines','settings','activity','archive'];
const PAGES_EMPLOYEE = ['today','leads','clients','finance'];
const EXPECTED_FALLBACK = { admin: null, manager: PAGES_MANAGER, bd: PAGES_EMPLOYEE, operations: PAGES_EMPLOYEE, viewer: PAGES_EMPLOYEE, team_member: PAGES_EMPLOYEE };

async function childRun(role) {
  const { chromium } = await import('/tmp/node_modules/playwright/index.mjs');
  const { start } = await import('./mock-supabase.mjs');
  const fs = await import('fs');
  const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
  const PORT = 8700 + Math.floor(Math.random() * 500);
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());

  await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.waitForFunction(() => window.__roleKnown === true, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1000); // let my_page_access() settle and re-render

  // The "▸ Reference" group (Events/Airlines/Providers/SOPs & SLAs) starts collapsed for
  // whoever has it at all — a UX default, not a permission. A real person just clicks it.
  // Expanding it (if present and visible) before reading nav is the difference between
  // testing "what's reachable" and testing "what's already expanded" — the latter would
  // have reported Airlines as forbidden for a manager who can plainly open it in one click.
  await p.evaluate(() => {
    const tog = document.querySelector('#nav .v25-more-tog');
    if (tog && tog.offsetParent !== null) tog.click();
  });
  await p.waitForTimeout(200);

  const result = await p.evaluate((expectRole) => {
    // Build label -> page id from the live VIEWS array (accurate to whatever the nav
    // actually contains at test time, not a hand-maintained copy that can rot), plus the
    // handful of pages injected by later layers outside VIEWS entirely (finance/activity/
    // archive/events/settings all get their nav button appended by a separate script, per
    // this project's own "new pages need a nav entry" convention).
    const idToLabel = { finance: 'Finance', activity: 'Activity & Audit', archive: 'Archive', events: 'Events', settings: 'Settings' };
    try { (typeof VIEWS !== 'undefined' ? VIEWS : []).forEach(v => { idToLabel[v.id] = v.label; }); } catch (e) {}
    const labelToId = {}; Object.keys(idToLabel).forEach(id => { labelToId[idToLabel[id]] = id; });

    const visibleLabels = [...document.querySelectorAll('#nav button, .nav button, .side button')]
      .filter(btn => btn.offsetParent !== null)
      .map(btn => (btn.querySelector('span') ? btn.querySelector('span').textContent : btn.textContent).trim())
      .filter(Boolean);
    const reachablePageIds = [...new Set(visibleLabels.map(l => labelToId[l]).filter(Boolean))];

    return {
      userRole: window.__userRole || null,
      roleKnown: window.__roleKnown === true,
      pageAccess: window.__pageAccess || null,
      visibleNav: visibleLabels,
      reachablePageIds,
      matches: window.__userRole === expectRole,
    };
  }, role);

  await b.close(); srv.close();
  return result;
}

async function main() {
  const role = process.env.MOCK_ROLE;
  if (role) {
    // child mode: test exactly this one role, print JSON, exit
    const r = await childRun(role);
    process.stdout.write(JSON.stringify({ role, ...r }) + '\n');
    return;
  }

  // orchestrator mode: spawn one clean child process per role
  console.log('=== probe-role-nav — spawning one clean process per role (no shared state) ===\n');
  const rows = [];
  for (const roleLabel of Object.keys(REAL_MATRIX)) {
    const env = { ...process.env, MOCK_ROLE: roleLabel };
    if (REAL_MATRIX[roleLabel]) env.MOCK_PAGE_ACCESS = JSON.stringify(REAL_MATRIX[roleLabel]);
    else delete env.MOCK_PAGE_ACCESS;

    const out = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [SELF], { env });
      let stdout = '', stderr = '';
      child.stdout.on('data', d => stdout += d);
      child.stderr.on('data', d => stderr += d);
      child.on('close', code => {
        if (code !== 0) return reject(new Error(`child for role ${roleLabel} exited ${code}\n${stderr}`));
        try { resolve(JSON.parse(stdout.trim().split('\n').pop())); }
        catch (e) { reject(new Error(`child for role ${roleLabel} produced unparseable output: ${stdout}\n${stderr}`)); }
      });
    });
    rows.push({ role: roleLabel, ...out });
    console.log(`${roleLabel.padEnd(12)} userRole=${out.userRole}  reachable=[${out.reachablePageIds.join(', ')}]`);
  }

  console.log('\n=== checks ===');
  console.log('(Comparing sets of reachable PAGE IDS, not exact label lists or nav position/grouping —');
  console.log(' the nav is rebuilt by several layers with their own primary/collapsible groupings, and');
  console.log(' asserting a specific layout would break on the next harmless nav reshuffle. What has to');
  console.log(' stay true regardless of layout: every page a role IS allowed reaches a button somewhere,');
  console.log(' and no page it is NOT allowed does — a collapsed group a real person can expand in one');
  console.log(' click still counts as reachable, which is why the toggle above gets clicked first.)\n');
  let failures = 0;
  const fail = (m) => { failures++; console.log('  ✗ ' + m); };
  const ok = (m) => console.log('  ✓ ' + m);
  // 'activity' and 'archive' are deliberately NOT in this list. Checked live during this
  // build (2026-08-21): neither page has a nav button anywhere in the app — grepping the
  // whole js/ tree for `current='activity'` / `current='archive'` outside the two render
  // dispatchers finds zero hits. They ARE reachable (both are in the URL router's VALID
  // list, js/03-clean-url-routing...), just by direct URL/deep-link only, same as this
  // project's documented deep-address-reload convention — not a nav-button gate this script
  // can meaningfully test. Separately worth a look, not fixed here: window.mayOpenPage()
  // (js/52-v76-access-model.js) is defined but never called anywhere, so nothing client-side
  // stops a direct URL visit to a forbidden page — the real backstop is server-side RLS, and
  // it's uneven: finance/settings/activity are the three pages js/56-access-matrix.js itself
  // calls out as "the database also enforces" (can_edit_page/can_see_page-gated), but
  // 'archive' isn't on that list and the businesses table's own SELECT policy
  // (`app_role() IS NOT NULL`) has no per-page restriction at all — so archived records may
  // be readable by direct URL regardless of role. Flagging for a product decision, not
  // assuming it's a bug: maybe Archive is meant to be open to any signed-in employee.
  /* 'offers' removed from the gated-nav scope 2026-08-26: commit e572cd3 (owner feedback
     round, 25 Aug) deliberately took Proposals/Offers out of the primary nav for every role
     — reversible, the page itself still lives at /offers by URL. This script tests NAV
     visibility, so expecting an entry the nav intentionally no longer carries produced two
     permanent false failures (admin + manager). */
  const ALL_GATED_PAGES = ['today', 'leads', 'clients', 'finance', 'events', 'airlines', 'settings'];

  for (const row of rows) {
    if (!row.roleKnown) { fail(`${row.role}: BLIND SPOT — role never settled (window.__roleKnown stayed false), nav read is meaningless`); continue; }
    if (!row.matches) { fail(`${row.role}: the mock signed in as a different role than requested (userRole=${row.userRole})`); continue; }

    if (row.role === 'admin') {
      // admin is unrestricted — every gated page should be reachable
      const missing = ALL_GATED_PAGES.filter(id => row.reachablePageIds.indexOf(id) < 0);
      if (!missing.length) ok(`${row.role}: unrestricted nav confirmed — every gated page reachable`);
      else fail(`${row.role}: expected an unrestricted nav, but these are unreachable: [${missing.join(', ')}] — reachable=[${row.reachablePageIds.join(', ')}]`);
      continue;
    }

    // filter both sides through ALL_GATED_PAGES — 'activity'/'archive' are excluded from
    // this script's scope (see the comment above ALL_GATED_PAGES), not just from what's read
    const expected = new Set(EXPECTED_FALLBACK[row.role].filter(id => ALL_GATED_PAGES.indexOf(id) >= 0));
    const reachable = new Set(row.reachablePageIds.filter(id => ALL_GATED_PAGES.indexOf(id) >= 0)); // ignore non-gated ids like 'ops','reports'
    const missing = [...expected].filter(id => !reachable.has(id));
    const forbidden = [...reachable].filter(id => !expected.has(id));
    if (!missing.length && !forbidden.length) ok(`${row.role}: reachable set matches expected {${[...expected].join(', ')}}`);
    else fail(`${row.role}: mismatch — missing=[${missing.join(', ')}] forbidden-but-reachable=[${forbidden.join(', ')}] — full reachable=[${row.reachablePageIds.join(', ')}]`);
  }

  // self-promotion note: this script tests nav visibility only. The RLS-level guard against
  // a non-admin ever writing role='admin' onto their own (or anyone's) app_users row belongs
  // in rls-matrix.sql / a real-database check — a mock has no RLS to test that against.
  console.log('\n(Self-promotion-to-admin is a database-level guard, not a nav question — see rls-matrix.sql for that check, not this script.)');

  console.log(`\n${failures ? 'FAILED' : 'PASSED'} — ${rows.length} roles checked, ${failures} failure(s).`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
