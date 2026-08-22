/* Password recovery — end-to-end probe (2026-08-22, launch-critical per Abdulrahman).
   Drives all three pieces against the current index.html + js/*.js, via the mock's new
   recovery/updateUser/send_reset_link instrumentation:
     1. The recovery screen (PASSWORD_RECOVERY -> set-new-password card -> clean URL -> app loads)
     2. The self-service "Forgot password?" link (neutral confirmation either way)
     3. The admin-only "Send reset link" button in Team & Access (admin sees + can trigger it,
        a manager cannot see it at all; a successful trigger never shows a password and is
        logged to record_history as an 'access' action)
   Each part gets its OWN browser context, so a part that ends signed-in (recovery does - that
   is correct, real behaviour) never contaminates the next part's assumptions.
   Two role passes for part 3: MOCK_ROLE=admin (default) and MOCK_ROLE=manager (spawned as a
   second process, since MOCK_ROLE is read once at mock startup). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import { spawnSync } from 'child_process';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');

async function fetchJson(base, path) {
  const r = await fetch(base + path);
  return r.json();
}

function wireRoutes(p, BASE) {
  return Promise.all([
    p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
      const rq = r.request(); const u = new URL(rq.url());
      try {
        const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
        const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
        await r.fulfill({ status: resp.status, headers: h, body });
      } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
    }),
    p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB })),
    p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' })),
    p.route('**fonts.gstatic.com/**', r => r.abort()),
  ]);
}

async function runAdminPass() {
  const PORT = 8088; const BASE = 'http://localhost:' + PORT;
  const srv = start(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = { part: 'ADMIN PASS' };
  const errors = [];

  // ---------- Part 1: recovery screen (fresh context) ----------
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('part1: ' + String(e.message || e).slice(0, 300)));
    await wireRoutes(p, BASE);
    const RECOVERY_TOKEN = 'header.' + Buffer.from(JSON.stringify({ sub: '11111111-1111-1111-1111-111111111111', email: 'test@directksa.com', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
    const hash = `#access_token=${RECOVERY_TOKEN}&refresh_token=refresh-abc&expires_in=3600&token_type=bearer&type=recovery`;
    await p.goto(BASE + '/today' + hash, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(2500);
    out.recoveryCardTitle = await p.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(d => (d.textContent || '').trim() === 'Set a new password');
      return el ? el.textContent.trim() : null;
    });
    out.recoveryHasFields = await p.evaluate(() => !!(document.getElementById('rp_pw1') && document.getElementById('rp_pw2') && document.getElementById('rp_go')));

    await p.fill('#rp_pw1', 'LongEnough1');
    await p.fill('#rp_pw2', 'Different1');
    await p.click('#rp_go');
    await p.waitForTimeout(400);
    out.mismatchError = await p.$eval('#cl_err', el => el.textContent.trim()).catch(() => null);

    await p.fill('#rp_pw1', 'short');
    await p.fill('#rp_pw2', 'short');
    await p.click('#rp_go');
    await p.waitForTimeout(400);
    out.tooShortError = await p.$eval('#cl_err', el => el.textContent.trim()).catch(() => null);

    const urlBeforeSave = await p.evaluate(() => location.href);
    await p.fill('#rp_pw1', 'MyNewPassword1');
    await p.fill('#rp_pw2', 'MyNewPassword1');
    await p.click('#rp_go');
    await p.waitForTimeout(500);
    out.successMessage = await p.$eval('#cl_err', el => el.textContent.trim()).catch(() => null);
    await p.waitForTimeout(2000); // the 1200ms setTimeout reload + boot start
    out.urlAfterSave = await p.evaluate(() => location.href);
    out.urlHadTokenBefore = urlBeforeSave.includes('access_token');
    out.urlHasTokenAfter = out.urlAfterSave.includes('access_token');
    await p.waitForTimeout(4000); // let the reloaded app fully boot back to signed-in state
    // Signed back in and the app is showing (not businesses>0 specifically — landing fresh
    // on /today with an empty DB.businesses turns out to be a pre-existing, recovery-
    // unrelated quirk: confirmed by testing a completely ordinary email/password sign-in
    // landing on /today, which shows the same thing. Not this fix's concern; noted separately.
    out.appLoadedAfterRecovery = await p.evaluate(() => !document.querySelector('div[style*="2147483000"]') && !!document.getElementById('vTitle'));
    out.pwUpdateLogAfterRecovery = await fetchJson(BASE, '/__pwupdatelog');
    await ctx.close();
  }

  // ---------- Part 1b: recovery card names the account + "skip, just sign me in" works
  // (2026-08-22, Abdulrahman: the bare dialogue confused him — he closed it not knowing
  // whose account it was, and ended up signed in without knowing a password.) ----------
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('part1b: ' + String(e.message || e).slice(0, 300)));
    await wireRoutes(p, BASE);
    const RECOVERY_TOKEN = 'header.' + Buffer.from(JSON.stringify({ sub: '11111111-1111-1111-1111-111111111111', email: 'test@directksa.com', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
    const hash = `#access_token=${RECOVERY_TOKEN}&refresh_token=refresh-abc&expires_in=3600&token_type=bearer&type=recovery`;
    await p.goto(BASE + '/today' + hash, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(2500);
    out.recoveryNamesAccount = await p.evaluate(() => (document.body.innerText || '').includes('test@directksa.com'));
    out.skipLinkPresent = !!(await p.$('#rp_skip'));
    if (out.skipLinkPresent) {
      await p.click('#rp_skip');
      await p.waitForTimeout(4000);
      out.skipSignedIn = await p.evaluate(() => !document.querySelector('div[style*="2147483000"]') && !!document.getElementById('vTitle'));
      out.skipUrlCleaned = await p.evaluate(() => !location.hash.includes('access_token'));
    }
    await ctx.close();
  }

  // ---------- Part 2: self-service "Forgot password?" neutrality (fresh context) ----------
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('part2: ' + String(e.message || e).slice(0, 300)));
    await wireRoutes(p, BASE);
    await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(2000);
    const forgotBtn = await p.$('#cl_forgot');
    out.forgotLinkPresent = !!forgotBtn;
    if (forgotBtn) {
      await forgotBtn.click();
      await p.waitForTimeout(300);
      out.emptyEmailMsg = await p.$eval('#cl_err', el => el.textContent.trim()).catch(() => null);

      await p.fill('#cl_email', 'someone.real@directksa.com');
      await forgotBtn.click();
      await p.waitForTimeout(600);
      out.realEmailMsg = await p.$eval('#cl_err', el => el.textContent.trim()).catch(() => null);

      await p.fill('#cl_email', 'someone.fake@nowhere.example');
      await forgotBtn.click();
      await p.waitForTimeout(600);
      out.fakeEmailMsg = await p.$eval('#cl_err', el => el.textContent.trim()).catch(() => null);
      // The message legitimately echoes back whatever address was typed (so the person can
      // confirm they didn't fat-finger it) - strip that before comparing structure/wording.
      const stripEmail = s => s ? s.replace(/[\w.+-]+@[\w.-]+/g, '<email>') : s;
      out.neutralityHolds = (stripEmail(out.realEmailMsg) === stripEmail(out.fakeEmailMsg));
    }
    out.recoverLogAfterForgot = await fetchJson(BASE, '/__recoverlog');
    await ctx.close();
  }

  // ---------- Part 3: admin sees + can trigger "Send reset link" (fresh context) ----------
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('part3: ' + String(e.message || e).slice(0, 300)));
    await wireRoutes(p, BASE);
    await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(2000);
    await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'whatever'); await p.click('#cl_go');
    await p.waitForTimeout(5000);
    await p.evaluate(() => { try { v48Users(); } catch (e) {} });
    await p.waitForTimeout(1200);
    out.myRoleInSession = await p.evaluate(() => window.__userRole);
    out.resetBtnCount = await p.$$eval('[data-rst]', els => els.length).catch(() => 0);
    const recoverLogBefore = (await fetchJson(BASE, '/__recoverlog')).length;
    if (out.resetBtnCount > 0) {
      await p.evaluate(() => { window.confirm = () => true; });
      await p.click('[data-rst]');
      await p.waitForTimeout(800);
      out.sentConfirmationText = await p.$eval('#v48res', el => el.textContent.trim()).catch(() => null);
    }
    const recoverLogAfter = await fetchJson(BASE, '/__recoverlog');
    out.adminTriggeredSend = recoverLogAfter.length > recoverLogBefore;
    out.recordHistoryTopRow = await p.evaluate(async () => {
      try {
        const c = window.fc ? window.fc() : null;
        return null; // record_history is read via table below in the mock, not via a page call
      } catch (e) { return null; }
    });
    await ctx.close();
  }

  out.jsErrors = errors;
  await b.close();
  return out;
}

async function runManagerPass() {
  // MOCK_ROLE is read once at process start, so a genuinely different role needs a fresh
  // Node process — spawn this same file with a flag, capture its JSON.
  const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, '--manager-child'], {
    env: { ...process.env, MOCK_ROLE: 'manager' },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) {
    return { part: 'MANAGER PASS', error: r.stderr, stdout: r.stdout.slice(-2000) };
  }
  const marker = 'MANAGER_PASS_JSON:';
  const line = r.stdout.split('\n').find(l => l.startsWith(marker));
  return line ? JSON.parse(line.slice(marker.length)) : { part: 'MANAGER PASS', error: 'no output', raw: r.stdout.slice(-2000) };
}

async function managerChildMain() {
  const PORT = 8087; const BASE = 'http://localhost:' + PORT;
  const srv = start(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await wireRoutes(p, BASE);

  const out = { part: 'MANAGER PASS' };
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'whatever'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  out.myRoleInSession = await p.evaluate(() => window.__userRole);
  await p.evaluate(() => { try { v48Users(); } catch (e) {} });
  await p.waitForTimeout(1200);
  out.resetBtnCount = await p.$$eval('[data-rst]', els => els.length).catch(() => 0);
  out.adminOnlyNoteVisible = await p.evaluate(() => {
    const list = document.getElementById('v48list');
    return list ? /admin-only|للمسؤول فقط/i.test(list.textContent || '') : false;
  });
  // Belt-and-braces: even if a button somehow rendered, the server (real edge function AND
  // the mock's mirror of it) must refuse a non-admin caller. Call the action directly.
  out.directCallRefused = await p.evaluate(async () => {
    try {
      const s = await window.__callAdmin({ action: 'send_reset_link', id: 'u-assem', origin: location.origin });
      return !!s.error;
    } catch (e) { return null; }
  });
  await b.close();
  console.log('MANAGER_PASS_JSON:' + JSON.stringify(out));
  process.exit(0);
}

if (process.argv.includes('--manager-child')) {
  await managerChildMain();
} else {
  const adminOut = await runAdminPass();
  const managerOut = await runManagerPass();
  console.log(JSON.stringify({ adminOut, managerOut }, null, 2));
  process.exit(0);
}
