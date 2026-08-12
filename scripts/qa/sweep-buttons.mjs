// Click EVERY visible button on the four go-live pages; classify each: ERROR / action / NO-OP.
import { start } from './mock-seed.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8893, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const SKIP = /delete|remove|sign out|log ?out|archive|reset|wipe|restore|promote|convert to client|mark paid|حذف|إزالة|خروج|أرشفة|استعادة|اعتماد/i;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
let popups = 0; ctx.on('page', p => { if (p !== page) { popups++; p.close().catch(() => {}); } });
let errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.route('**cdn.jsdelivr.net/**', async r => {
  const u = r.request().url();
  if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
  return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
});
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
  const u = new URL(r.request().url());
  const resp = await fetch(BASE + u.pathname + u.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined }).catch(() => null);
  if (!resp) return r.fulfill({ status: 200, body: '[]' });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
const em = page.locator('input[type="email"]').first();
if (await em.isVisible().catch(() => false)) {
  await em.fill('test@directksa.com');
  await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
  await page.locator('button:has-text("Sign in"), button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
}
const goto = async (spec) => {
  await page.evaluate(spec => {
    try { if (typeof closeModal === 'function') closeModal(); } catch (e) {} try { document.querySelectorAll('#modal,.modal-back').forEach(m => m.classList.remove('show','open')); } catch (e) {}
    openLead = spec.lead || null; current = spec.page; render();
  }, spec);
  await page.waitForTimeout(900);
};
const state = () => page.evaluate(() => ({
  page: current, lead: (typeof openLead !== 'undefined' && openLead) || '', body: document.body.innerHTML.length,
  modal: !!(document.querySelector('#modal.show, .modal-back.show, #modal[style*="flex"], #modal[style*="block"]') || (document.getElementById('modal') && document.getElementById('modal').offsetParent)), len: (document.getElementById('view') || {}).innerHTML?.length || 0,
  toastTxt: [...document.querySelectorAll('.toast,.v19-toast,[class*=toast]')].filter(t=>t.offsetParent!==null).map(t=>t.textContent.trim()).join('|')
}));
const PAGES = [
  { name: 'Leads list', spec: { page: 'leads' } },
  { name: 'Lead detail', spec: { page: 'leads', lead: 'L_alyusr' } },
  { name: 'Client detail', spec: { page: 'leads', lead: 'L_bright' } },
  { name: 'Clients list', spec: { page: 'clients' } },
  { name: 'Finance', spec: { page: 'finance' } },
  { name: 'Settings', spec: { page: 'settings' } },
];
const results = [];
for (const P of PAGES) {
  await goto(P.spec);
  const labels = await page.evaluate(() => [...document.querySelectorAll('#view button, #view a.btn, .v26_3-chips button, .v26_3-section-head button')]
    .filter(b => b.offsetParent !== null).map(b => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)));
  for (let i = 0; i < Math.min(labels.length, 55); i++) {
    const label = labels[i];
    if (!label || SKIP.test(label)) { results.push([P.name, label || '(blank)', 'skipped']); continue; }
    await goto(P.spec);
    const before = await state(); errs = []; popups = 0;
    const clicked = await page.evaluate(i => {
      const btns = [...document.querySelectorAll('#view button, #view a.btn, .v26_3-chips button, .v26_3-section-head button')].filter(b => b.offsetParent !== null);
      if (!btns[i]) return false; try { btns[i].click(); return true; } catch (e) { window.__clickErr = String(e); return 'threw'; }
    }, i);
    await page.waitForTimeout(700);
    const after = await state();
    let verdict;
    if (errs.length || clicked === 'threw') verdict = 'ERROR: ' + (errs[0] || 'click threw');
    else if (popups) verdict = 'ok: opens print/new window';
    else if (after.modal) verdict = 'ok: opens dialog';
    else if (after.page !== before.page || after.lead !== before.lead) verdict = 'ok: navigates → ' + after.page;
    else if (Math.abs(after.len - before.len) > 50) verdict = 'ok: view changes';
    else if (Math.abs(after.body - before.body) > 200) verdict = 'ok: opens panel/overlay';
    else if (after.toastTxt !== before.toastTxt) verdict = 'ok: toast: ' + after.toastTxt.slice(0, 40);
    else verdict = 'NO-OP?';
    results.push([P.name, label, verdict]);
  }
}
const bad = results.filter(r => /ERROR|NO-OP/.test(r[2]));
console.log('TOTAL buttons clicked:', results.filter(r => r[2] !== 'skipped').length, '| skipped(destructive):', results.filter(r => r[2] === 'skipped').length);
console.log('--- problems ---'); bad.forEach(r => console.log(r.join(' | ')));
fs.writeFileSync('button-sweep-results.txt', results.map(r => r.join(' | ')).join('\n'));
console.log('full list -> button-sweep-results.txt');
await browser.close(); process.exit(0);
