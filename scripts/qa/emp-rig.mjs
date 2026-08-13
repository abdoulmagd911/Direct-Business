/* Shared rig: drive the REAL app (local files, proven byte-identical to the live site)
   against the REAL Supabase backend, as a chosen employee.
   Run scripts with: NODE_USE_ENV_PROXY=1 node <script>.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';

export const APP_DIR = 'live-app';

export const TEAM = {
  admin:       { email: 'test@directksa.com',                 pw: 'Dq7nTest-2026-Riyadh', name: 'QA Test Account',      role: 'admin' },
  othman:      { email: 'osharafi@direct-visa.net',           pw: 'Direct-2026-Othman!',  name: 'Othman Al Sharafi',    role: 'manager' },
  raad:        { email: 'raad.elkhair@directksa.com',         pw: 'Direct-2026-Raad!',    name: 'Raad Awad',            role: 'bd' },
  kareem:      { email: 'kareem.medhat@directksa.com',        pw: 'Direct-2026-Kareem!',  name: 'Kareem Medhat',        role: 'operations' },
  assem:       { email: 'assem.alsweed@directksa.com',        pw: 'Direct-2026-Assem!',   name: 'Assem Alsweed',        role: 'team_member' },
  mohammed:    { email: 'mohammed.altuwaijri@directksa.com',  pw: 'Direct-2026-Mohammed!',name: 'Mohammed Altuwaijri',  role: 'viewer' },
};

/* what each role is SUPPOSED to be able to write (from the database policies) */
export const EXPECT = {
  admin:       { leads:true,  proposals:true,  requests:true, activities:true, finance:true,  promo:true,  settings:true,  team:true  },
  manager:     { leads:true,  proposals:true,  requests:true, activities:true, finance:true,  promo:true,  settings:false, team:false },
  bd:          { leads:true,  proposals:true,  requests:true, activities:true, finance:false, promo:true,  settings:false, team:false },
  operations:  { leads:false, proposals:false, requests:true, activities:true, finance:false, promo:false, settings:false, team:false },
  team_member: { leads:true,  proposals:true,  requests:true, activities:true, finance:false, promo:false, settings:false, team:false },
  viewer:      { leads:false, proposals:false, requests:false,activities:false,finance:false, promo:false, settings:false, team:false },
};

export function serve(port) {
  const srv = http.createServer((req, res) => {
    let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
    let body;
    try { body = fs.readFileSync(APP_DIR + f); }
    catch (_) { try { body = fs.readFileSync(APP_DIR + '/index.html'); f = '/index.html'; } catch (e) { res.writeHead(404); return res.end(); } }
    res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
    res.end(body);
  });
  srv.listen(port);
  return srv;
}

export async function openApp(port) {
  serve(port);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('dialog', d => d.accept('QA'));
  const fwd = async r => {
    const req = r.request();
    try {
      const headers = { ...req.headers() }; delete headers['host']; delete headers['accept-encoding'];
      const resp = await fetch(req.url(), { method: req.method(), headers, body: req.postDataBuffer() || undefined });
      const buf = Buffer.from(await resp.arrayBuffer());
      const h = {}; resp.headers.forEach((v, k) => { if (!/^(content-encoding|transfer-encoding|connection)$/i.test(k)) h[k] = v; });
      return r.fulfill({ status: resp.status, headers: h, body: buf });
    } catch (e) { return r.abort(); }
  };
  await page.route('**cdn.jsdelivr.net/**', fwd);
  await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', fwd);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  return { browser, page, errs, base: `http://127.0.0.1:${port}` };
}

/* Sign in the way a person does. Returns 'app' | 'firstlogin' | 'pending' | 'error'. */
export async function signIn(page, email, pw) {
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(pw);
  await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      if (document.getElementById('fl_pw1')) return 'firstlogin';
      const b = document.body.textContent || '';
      if (/waiting for approval|access is not active|pending/i.test(b) && document.querySelector('#cl_card')) return 'pending';
      if (document.getElementById('cl_err') && document.getElementById('cl_err').style.display !== 'none' && document.querySelector('input[type=email]')) return 'error';
      if (typeof DB !== 'undefined' && DB.businesses && !document.querySelector('input[type=email]')) return 'app';
      return null;
    });
    if (st) return st;
  }
  return 'timeout';
}

/* Complete the forced "choose your own password" screen. */
export async function setOwnPassword(page, newPw) {
  await page.locator('#fl_pw1').fill(newPw);
  await page.locator('#fl_pw2').fill(newPw);
  await page.locator('#fl_go').click();
  await page.waitForTimeout(9000);
  return await page.evaluate(() => typeof DB !== 'undefined' && !!DB.businesses && !document.querySelector('input[type=email]'));
}

/* Wait until the app has data + the roster/identity layers have resolved. */
export async function ready(page, ms = 40000) {
  await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: ms }).catch(() => {});
  await page.waitForFunction(() => !!window.__userTier, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3500);
}

/* Sign out the way a person does: profile chip → menu → Sign out. */
export async function signOut(page) {
  const viaChip = await page.evaluate(() => {
    const chip = document.getElementById('v68me'); if (!chip) return false;
    chip.click(); return true;
  });
  await page.waitForTimeout(700);
  let clicked = false;
  if (viaChip) {
    clicked = await page.evaluate(() => {
      const m = document.getElementById('v68menu'); if (!m) return false;
      const b = [...m.querySelectorAll('button')].find(x => /Sign out|تسجيل الخروج/.test(x.textContent));
      if (!b) return false; b.click(); return true;
    });
  }
  if (!clicked) {
    clicked = await page.evaluate(() => {
      const b = document.getElementById('cl_signout') || [...document.querySelectorAll('button')].find(x => /^(Sign out|تسجيل الخروج)$/.test(x.textContent.trim()));
      if (!b) return false; b.click(); return true;
    });
  }
  let back = false;
  for (let i = 0; i < 30; i++) {                      // the real backend + reload takes a while
    await page.waitForTimeout(1000);
    back = await page.evaluate(() => !!document.querySelector('input[type=email]'));
    if (back) break;
  }
  return { clicked, back };
}

export async function go(page, view, ms = 1400) {
  await page.evaluate(v => { try { openLead = null; } catch (_) {} current = v; render(); }, view);
  await page.waitForTimeout(ms);
}

export const viewText = page => page.evaluate(() => (document.getElementById('view') || {}).textContent || '');
export const bodyText = page => page.evaluate(() => document.body.textContent || '');

/* Direct REST write attempt with the signed-in user's own token — the real security wall. */
export async function tryWrite(page, table, row) {
  return await page.evaluate(async ([t, r]) => {
    try {
      const c = window.fc ? fc() : null; if (!c) return { ok: false, err: 'no client' };
      const res = await c.from(t).insert(r);
      return { ok: !res.error, err: res.error ? (res.error.message || String(res.error)) : null, code: res.error && res.error.code };
    } catch (e) { return { ok: false, err: String(e) }; }
  }, [table, row]);
}
export async function tryUpdate(page, table, match, patch) {
  return await page.evaluate(async ([t, m, p]) => {
    try {
      const c = window.fc ? fc() : null; if (!c) return { ok: false, err: 'no client' };
      let q = c.from(t).update(p);
      Object.keys(m).forEach(k => { q = q.eq(k, m[k]); });
      const res = await q.select();
      return { ok: !res.error, rows: (res.data || []).length, err: res.error ? res.error.message : null };
    } catch (e) { return { ok: false, err: String(e) }; }
  }, [table, match, patch]);
}
