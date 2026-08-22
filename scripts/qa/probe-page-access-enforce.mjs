/* probe-page-access-enforce.mjs — 2026-08-21. window.mayOpenPage() was defined and never
   called by anything (grep confirms — zero call sites outside its own definition), so a
   direct URL visit to a forbidden page rendered it anyway; only the nav BUTTON was hidden.
   js/64-page-access-enforce.js wraps render() to redirect to Today with a plain message and
   log the attempt via the log_page_denied RPC. This probe drives that for real: forces
   `current` to a page the role cannot see (the way a bookmark or typed URL would), and
   checks the redirect, the banner text, and that the RPC round-tripped — not just that
   `current` changed, which a DIFFERENT pre-existing guard (js/49-v73, settings-only) could
   also produce and give a false pass. Also proves an admin is never bounced, on the exact
   same page, regardless of how slowly the page_access matrix loads (gated on
   window.__accessKnown(), not on myAllowedPages() alone — see the file's own comment for why
   that distinction matters).

   Run: node probe-page-access-enforce.mjs */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');

let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

let importSeq = 0;
async function run(role, pageAccess) {
  process.env.MOCK_ROLE = role;
  if (pageAccess) process.env.MOCK_PAGE_ACCESS = JSON.stringify(pageAccess);
  else delete process.env.MOCK_PAGE_ACCESS;

  // The mock module applies MOCK_ROLE/MOCK_PAGE_ACCESS once, at import time (see its own
  // comment) — a plain top-level `import` is hoisted and evaluated before this function's
  // env vars are even set, and ES module caching means a second bare import wouldn't
  // re-apply them anyway. A fresh query string forces a genuinely fresh module evaluation
  // per role, the same way js/64's own harness testing (this file's basis) had to work
  // around it.
  const { start } = await import('./mock-supabase.mjs?run=' + (++importSeq));

  const PORT = 8900 + Math.floor(Math.random() * 400);
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('JS: ' + e.message));

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
  await p.waitForTimeout(1000);

  // 'archive' has no nav button anywhere and no pre-existing older guard (unlike 'settings',
  // which js/49-v73 already redirected away from before this layer existed) — the cleanest
  // page to prove THIS layer specifically is doing the work.
  const result = await p.evaluate(() => {
    current = 'archive';
    if (typeof render === 'function') render();
    return {
      current,
      bannerText: (document.getElementById('v64-access-denied') || {}).textContent || null,
      heroPresent: !!document.querySelector('.hero'),
    };
  });
  await p.waitForTimeout(1000);
  const rpclog = JSON.parse(await (await fetch(BASE + '/__rpclog')).text());
  const logged = !!rpclog.find(x => x.fn === 'log_page_denied');

  await b.close();
  srv.close();
  return { ...result, logged, errors };
}

async function main() {
  console.log('=== team_member forced to "archive" (no nav button, no older guard) ===');
  const tm = await run('team_member', { leads: 'editor', today: 'editor', clients: 'editor', finance: 'editor' });
  if (tm.current !== 'today') fail(`redirected to "${tm.current}", expected "today"`);
  else ok('redirected to Today');
  if (!tm.heroPresent) fail('Today did not actually render (.hero missing) — silent blank page, not a real redirect');
  else ok('Today actually rendered (.hero present)');
  if (tm.bannerText !== 'You do not have access to that page — ask an admin if you need it.') fail('banner text wrong or missing: ' + JSON.stringify(tm.bannerText));
  else ok('banner text correct');
  if (!tm.logged) fail('log_page_denied RPC never reached the server — the attempt was NOT recorded');
  else ok('attempt logged via log_page_denied RPC');
  if (tm.errors.length) fail('JS errors: ' + JSON.stringify(tm.errors));
  else ok('no JS errors');

  console.log('\n=== admin forced to "archive" — must NOT be bounced ===');
  const admin = await run('admin', null);
  if (admin.current !== 'archive') fail(`admin was redirected to "${admin.current}" — admin must never be bounced`);
  else ok('admin stayed on "archive"');
  if (admin.bannerText) fail('admin saw the denied banner — admin must never see it');
  else ok('no banner shown to admin');
  if (admin.errors.length) fail('JS errors: ' + JSON.stringify(admin.errors));
  else ok('no JS errors');

  console.log(`\n${failures ? 'FAILED' : 'PASSED'} — ${failures} failure(s).`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
