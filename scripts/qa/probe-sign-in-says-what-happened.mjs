/* probe-sign-in-says-what-happened.mjs (2026-09-27) — the oversight's finding C: the sign-in screen, the password reset and
   the team's reset / invite buttons say what actually happened, in the right colour and the right words. js/02, js/114,
   supabase/functions/admin-users (the 10-character minimum).

   Under test:
     SIGN-IN SCREEN (English, then Arabic)
       1. "Forgot password?" with no email typed says to type it in the box BELOW (the message box sits at the top);
       2. with an email: a green line that says the link is on its way IF that address has an account here — never an
          unconditional "sent" (Supabase answers "done" for any address);
       3. an error AFTER that green line is RED — the shared box used to keep the green;
       4. a wrong password says "Forgot password?" is BELOW;
       5. when Supabase refuses (its email limit), the box is red and says so — never green;
       6. the name is spelled Abdurahman on screen;
     NEW PASSWORD SCREENS
       7. the recovery screen counts the characters as you type ("5 of 10"), turns green at 10, and says whether the two
          boxes match; pressed early, Save still gives the exact message;
       8. the recovery screen opens only in the tab the link opened: a second tab already in the app does not jump to it;
       9. no JS errors.
   (C-lite, 2026-09-27: the per-person "Send reset link" / "Send invite again" buttons need the email sender and stay
   parked with the rest of C; their checks live on the parked branch login-c.)
   PORTS 9681-9685. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0; const errors = [];
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const UID = '11111111-1111-1111-1111-111111111111';

async function boot(PORT, env = {}) {
  for (const k of ['MOCK_ROLE', 'MOCK_MAIL_LIMIT', 'MOCK_PEOPLE', 'MOCK_PAGE_ACCESS']) delete process.env[k];
  Object.assign(process.env, env);
  const { start } = await import('./mock-supabase.mjs?signin=' + (++seq)); const srv = start(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  return { srv, b, ctx, BASE: 'http://localhost:' + PORT };
}
async function page(ctx, BASE, lang, path = '/today') {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    /* the stand-in signs anyone in; the deliberately wrong password gets Supabase's own answer */
    if (u.pathname.startsWith('/auth/v1/token') && /not-the-password/.test(rq.postData() || '')) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  return p;
}
const box = (p) => p.evaluate(() => { const e = document.getElementById('cl_err'); if (!e || e.style.display === 'none') return null; const cs = getComputedStyle(e); return { text: e.innerText.replace(/\s+/g, ' '), color: cs.color }; });
const RED = 'rgb(217, 45, 32)', GREEN = 'rgb(11, 122, 67)';

/* ---------------- SIGN-IN SCREEN ---------------- */
for (const lang of ['en', 'ar']) {
  const L = lang.toUpperCase(), AR = lang === 'ar';
  const { srv, b, ctx, BASE } = await boot(9681 + (AR ? 1 : 0));
  const p = await page(ctx, BASE, lang);
  await p.waitForSelector('#cl_email', { timeout: 120000 });
  const card = await p.evaluate(() => document.body.innerText);
  if (!AR) check(/Ask Abdurahman/.test(card) && !/Abdulrahman/.test(card), `${L} 6 · the name is spelled Abdurahman on the sign-in card`, (card.match(/Ask \w+/) || [''])[0]);
  await p.click('#cl_forgot'); await p.waitForTimeout(300);
  const b1 = await box(p);
  check(b1 && (AR ? /أدناه/.test(b1.text) && !/أعلاه/.test(b1.text) : /box below/.test(b1.text) && !/above/.test(b1.text)), `${L} 1 · with no email typed it says to type it in the box BELOW`, b1 && b1.text);
  await p.fill('#cl_email', 'test@directksa.com'); await p.click('#cl_forgot'); await p.waitForTimeout(900);
  const b2 = await box(p);
  check(b2 && b2.color === GREEN && (AR ? /إن كان لـ/.test(b2.text) : /has an account here/.test(b2.text)) && !/If email is switched on/.test(b2.text), `${L} 2 · the green line says "on its way IF that address has an account here"`, b2 && (b2.color + ' ' + b2.text.slice(0, 90)));
  await p.fill('#cl_pw', ''); await p.click('#cl_go'); await p.waitForTimeout(300);
  const b3 = await box(p);
  check(b3 && b3.color === RED, `${L} 3 · an error after the green line is RED`, b3 && (b3.color + ' ' + b3.text.slice(0, 60)));
  await p.fill('#cl_pw', 'not-the-password-123'); await p.click('#cl_go'); await p.waitForTimeout(1200);
  const b4 = await box(p);
  check(b4 && b4.color === RED && (AR ? /أدناه/.test(b4.text) && !/أعلاه/.test(b4.text) : /below/.test(b4.text) && !/above/.test(b4.text)), `${L} 4 · a wrong password says "Forgot password?" is BELOW, in red`, b4 && b4.text.slice(0, 120));
  await b.close(); srv.close();
}
/* 5 — Supabase's email limit */
{
  const { srv, b, ctx, BASE } = await boot(9683, { MOCK_MAIL_LIMIT: '1' });
  const p = await page(ctx, BASE, 'en');
  await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.click('#cl_forgot'); await p.waitForTimeout(1200);
  const b5 = await box(p);
  check(b5 && b5.color === RED && /Too many reset emails/.test(b5.text), 'EN 5 · Supabase\'s email limit is said in red, never as "on its way"', b5 && (b5.color + ' ' + b5.text.slice(0, 90)));
  await b.close(); srv.close();
}

/* ---------------- NEW PASSWORD SCREENS: live count; one tab only ---------------- */
{
  const { srv, b, ctx, BASE } = await boot(9684);
  const app = await page(ctx, BASE, 'en');                       // tab A: signed in, in the app
  await app.waitForSelector('#cl_email', { timeout: 120000 });
  await app.fill('#cl_email', 'test@directksa.com'); await app.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await app.click('#cl_go');
  await app.waitForFunction(() => typeof render === 'function' && !document.getElementById('cl_email') && window.__roleKnown === true, null, { timeout: 120000 });
  const TOKEN = 'header.' + Buffer.from(JSON.stringify({ sub: UID, email: 'test@directksa.com', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
  const link = await page(ctx, BASE, 'en', '/today#access_token=' + TOKEN + '&refresh_token=refresh-abc&expires_in=3600&token_type=bearer&type=recovery');   // tab B: the link
  const shown = await link.waitForSelector('#rp_pw1', { timeout: 20000 }).then(() => true).catch(() => false);
  await app.waitForTimeout(2500);
  const aJumped = await app.evaluate(() => !!document.getElementById('rp_pw1'));
  check(shown && !aJumped, '8 · the recovery screen opens in the tab the link opened, and the tab already in the app does not jump to it', JSON.stringify({ linkTab: shown, otherTab: aJumped }));
  if (shown) {
    const hint = async () => link.evaluate(() => ({ a: (document.getElementById('rp_pw1_live') || {}).textContent || '', ac: getComputedStyle(document.getElementById('rp_pw1_live') || document.body).color, b: (document.getElementById('rp_pw2_live') || {}).textContent || '' }));
    await link.fill('#rp_pw1', 'abcde'); const h1 = await hint();
    await link.fill('#rp_pw1', 'abcdefghij'); await link.fill('#rp_pw2', 'abcdefghix'); const h2 = await hint();
    await link.fill('#rp_pw2', 'abcdefghij'); const h3 = await hint();
    check(/5 of 10 characters/.test(h1.a) && /✓ 10 characters/.test(h2.a) && h2.ac === GREEN && /does not match yet/.test(h2.b) && /✓ the two match/.test(h3.b), '7 · as you type: "5 of 10 characters", then "✓ 10 characters" in green, and whether the two boxes match', JSON.stringify([h1, h2, h3]));
    await link.fill('#rp_pw1', 'Abcdefgh9'); await link.fill('#rp_pw2', 'Abcdefgh9'); await link.click('#rp_go'); await link.waitForTimeout(400);
    const msg = await link.evaluate(() => (document.getElementById('cl_err') || {}).textContent || '');
    check(msg === 'Password must be at least 10 characters.', '7 · pressed early, Save still gives the exact message', msg);
  }
  await b.close(); srv.close();
}

check(errors.length === 0, '9 · no JS errors', errors.slice(0, 3).join(' | '));
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — the sign-in screen says what happened; the reset screen opens only in the link\'s tab');
process.exit(failures ? 1 : 0);
