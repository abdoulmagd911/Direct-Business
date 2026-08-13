import { start } from './mock-seed.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8896, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 100)));
await page.route('**cdn.jsdelivr.net/**', async r => {
  const u = r.request().url();
  if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
  return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
});
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
  const u = new URL(r.request().url());
  const resp = await fetch(BASE + u.pathname + u.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const h = {}; resp.headers.forEach((v, k) => h[k] = v);
  return r.fulfill({ status: resp.status, headers: h, body });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
const em = page.locator('input[type="email"]').first();
if (await em.isVisible().catch(() => false)) {
  await em.fill('test@directksa.com'); await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
  await page.locator('button[type="submit"], button:has-text("Sign in")').first().click(); await page.waitForTimeout(3000);
}
const cur = () => page.evaluate(() => ({ page: current, url: location.pathname, rows: document.querySelectorAll('#view table tbody tr').length, title: (document.querySelector('.v26_3-section-head h2, #vTitle') || {}).textContent || '' }));
const nav = async (label) => { await page.locator('#nav button').filter({ hasText: new RegExp(label, 'i') }).first().click(); await page.waitForTimeout(1000); };
const out = [];
// walk the four pages like a user
for (const l of ['Leads', 'Clients', 'Finance', 'Settings']) { await nav(l); const c = await cur(); out.push(`visit ${l}: page=${c.page} url=${c.url}`); }
// browser Back x3 should retrace Finance -> Clients -> Leads
for (let i = 0; i < 3; i++) { await page.goBack(); await page.waitForTimeout(900); const c = await cur(); out.push(`back${i + 1}: page=${c.page} url=${c.url}`); }
// forward x2
for (let i = 0; i < 2; i++) { await page.goForward(); await page.waitForTimeout(900); const c = await cur(); out.push(`fwd${i + 1}: page=${c.page} url=${c.url}`); }
// open a lead detail, back should return to the list
await nav('Leads'); await page.evaluate(() => { openLeadFn('L_alyusr'); }); await page.waitForTimeout(1000);
out.push('opened lead detail: ' + JSON.stringify(await page.evaluate(() => !!document.querySelector('.detail-head'))));
await page.goBack(); await page.waitForTimeout(900);
const afterBack = await page.evaluate(() => ({ detail: !!document.querySelector('.detail-head'), rows: document.querySelectorAll('#view table tbody tr').length }));
out.push(`back from detail: detail=${afterBack.detail} listRows=${afterBack.rows}`);
// refresh mid-session on Finance: no login form, page restores
await nav('Finance'); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
const afterReload = await page.evaluate(() => ({ page: current, loginVisible: !!document.querySelector('input[type=email]:not([style*="display: none"])') && !!(document.querySelector('input[type=email]') || {}).offsetParent, hasKpis: /Revenue/.test((document.getElementById('view') || {}).textContent || '') }));
out.push(`reload on finance: page=${afterReload.page} loginFormShown=${afterReload.loginVisible} financeRendered=${afterReload.hasKpis}`);
console.log(out.join('\n')); console.log('PAGEERRORS:', errs.length, errs.slice(0, 3));
await browser.close(); process.exit(0);
