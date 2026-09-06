// Click EVERY visible button on the four go-live pages; classify each: ERROR / action / NO-OP.
//
// READ THIS BEFORE TREATING A "NO-OP?" LINE AS A DEFECT (round 57, 2026-09-06).
// "NO-OP?" means THIS SWEEP SAW NO CHANGE — not "the button is dead". The verdict used to be
// "did the markup grow by 50 characters", which called 79 of 189 buttons NO-OP; widening it to
// watch text, open/closed cards, row counts, dropdowns, checkboxes, the address, scroll position,
// the real modal container (#ov, not #modal) and external links took that to 31, with 33 dialogs
// and 9 scrolls now correctly recognised. What is left is a residue, and it is NOT a defect list:
//
//   · "Clients list | Edit" ×11 — DRIVEN BY HAND AND VERIFIED WORKING: the click runs
//     leadQuickEdit(), #ov gains its "show" class and the dialog fills with "Quick edit — <name>".
//     Why this sweep still misses it is UNEXPLAINED; it is not index drift (the sweep now reports
//     the label of the button it really pressed, and no run has shown a mismatch). Left honest
//     rather than silenced.
//   · The jump-bar chips (Key facts, Notes, Contacts, Corporate account …) scroll to a section
//     and change nothing else, deliberately — their own comment in js/28 says so. Nine of them
//     are caught by the scroll check; the rest sit in a viewport tall enough not to need scrolling.
//   · "‹ Prev / Next ›" with fewer rows than one page, and "All clients" when it is already the
//     active filter, correctly do nothing.
//   · "⬇ Excel (CSV)" downloads a file, which this sweep does not watch for.
//
// A "LEFT THE APP" line names where the sweep WAS when the app went, not necessarily the cause:
// a refused save reloads the tab 4.5 seconds later, several buttons downstream.
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
const signInIfNeeded = async () => {
  const e2 = page.locator('input[type="email"]').first();
  if (await e2.isVisible().catch(() => false)) {
    await e2.fill('test@directksa.com');
    await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
    await page.locator('button:has-text("Sign in"), button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
  }
};
const recover = async () => { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); await signInIfNeeded(); };
const goto = async (spec) => {
  await page.evaluate(spec => {
    try { if (typeof closeModal === 'function') closeModal(); } catch (e) {} try { document.querySelectorAll('#modal,.modal-back').forEach(m => m.classList.remove('show','open')); } catch (e) {}
    openLead = spec.lead || null; current = spec.page; render();
  }, spec);
  await page.waitForTimeout(900);
};
/* 2026-09-06 (round 52): `current` is a script-scoped binding inside the app, so the moment a
   button navigates away or reloads the tab it stops existing — and this read threw
   "current is not defined", killing the whole sweep with a raw stack. Every button already
   clicked went unreported, and nobody could tell WHICH button did it, so the sweep sat on the
   pre-existing-red list instead of being read. A button that takes you out of the app is a
   FINDING, which is exactly what this sweep exists to surface — reported and recovered from. */
const alive = async () => {
  /* Be precise about WHY: an execution context torn down mid-re-render is not the same thing as
     the app having gone. Report the reason, never guess one. */
  try { return { ok: await page.evaluate(() => typeof current !== 'undefined'), why: '' }; }
  catch (e) { return { ok: false, why: String(e && e.message || e).split('\n')[0].slice(0, 90) }; }
};
/* 2026-09-06 (round 57): the verdict used to be "did #view's innerHTML get more than 50
   characters longer, or the body 200". That is far too coarse for most of this app's controls,
   and it produced 79 "NO-OP?" lines out of 189 buttons — a list too noisy for anyone to act on,
   which is the same disease as a warning nobody must read. Almost all of them DO something: a
   <details> card opens, a chip cycles its label from "—" to "Buys elsewhere", a filter narrows
   the rows. None of those move the length much, and one of them (a chip cycling) can make the
   markup SHORTER. The fingerprint now notices what those controls actually change — the text, the
   open/closed cards, the row count, the clicked button's own state — so a "NO-OP" line means the
   page really did not react. */
const state = () => page.evaluate(() => ({
  page: (typeof current !== 'undefined' ? current : '(app gone)'), lead: (typeof openLead !== 'undefined' && openLead) || '', body: document.body.innerHTML.length,
  /* openModal() puts the class on #ov, not on #modal — so every quick-edit dialog in the app was
     invisible to this detector and reported as a dead button (round 57). */
  modal: !!(document.querySelector('#ov.show, #modal.show, .modal-back.show, #modal[style*="flex"], #modal[style*="block"]') || (document.getElementById('modal') && document.getElementById('modal').offsetParent)), len: (document.getElementById('view') || {}).innerHTML?.length || 0,
  toastTxt: [...document.querySelectorAll('.toast,.v19-toast,[class*=toast]')].filter(t=>t.offsetParent!==null).map(t=>t.textContent.trim()).join('|'),
  /* what the length test cannot see */
  text: ((document.getElementById('view') || {}).innerText || '').replace(/\s+/g, ' '),
  details: [...document.querySelectorAll('#view details')].map(d => d.open ? '1' : '0').join(''),
  rows: document.querySelectorAll('#view tbody tr').length,
  visRows: [...document.querySelectorAll('#view tbody tr')].filter(r => r.style.display !== 'none').length,
  selects: [...document.querySelectorAll('#view select')].map(x => x.value).join('|'),
  checks: [...document.querySelectorAll('#view input[type=checkbox]')].map(x => x.checked ? '1' : '0').join(''),
  href: location.pathname,
  /* the v60 jump-bar chips scroll to a section and change nothing else — deliberately, their own
     comment says "display-only; nothing is moved or hidden". Scrolling IS the action. */
  scroll: Math.round(window.scrollY) + ':' + [...document.querySelectorAll('#view, #view .scroll, main, .app')].map(e => Math.round(e.scrollTop)).join(',')
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
    /* An <a target="_blank"> hands the click to the browser, which the harness suppresses — the
       action is real and verifiable from the element itself, so it is read before clicking rather
       than inferred from a page that correctly did not change. */
    const isExternalLink = await page.evaluate(i => {
      const btns = [...document.querySelectorAll('#view button, #view a.btn, .v26_3-chips button, .v26_3-section-head button')].filter(b => b.offsetParent !== null);
      const b = btns[i];
      return !!(b && b.tagName === 'A' && b.getAttribute('target') === '_blank' && (b.getAttribute('href') || '').length > 1);
    }, i);
    const clicked = await page.evaluate(i => {
      const btns = [...document.querySelectorAll('#view button, #view a.btn, .v26_3-chips button, .v26_3-section-head button')].filter(b => b.offsetParent !== null);
      if (!btns[i]) return false; try { btns[i].click(); return true; } catch (e) { window.__clickErr = String(e); return 'threw'; }
    }, i);
    await page.waitForTimeout(700);
    const liv = await alive();
    if (!liv.ok) {
      const url = page.url();
      results.push([P.name, label, 'LEFT THE APP: ' + (liv.why || 'the app was gone afterwards') + ' · url now ' + url]);
      await recover();
      continue;
    }
    const after = await state();
    let verdict;
    if (errs.length || clicked === 'threw') verdict = 'ERROR: ' + (errs[0] || 'click threw');
    else if (popups) verdict = 'ok: opens print/new window';
    else if (after.modal) verdict = 'ok: opens dialog';
    else if (after.page !== before.page || after.lead !== before.lead) verdict = 'ok: navigates → ' + after.page;
    else if (Math.abs(after.len - before.len) > 50) verdict = 'ok: view changes';
    else if (Math.abs(after.body - before.body) > 200) verdict = 'ok: opens panel/overlay';
    else if (after.toastTxt !== before.toastTxt) verdict = 'ok: toast: ' + after.toastTxt.slice(0, 40);
    else if (after.details !== before.details) verdict = 'ok: opens/closes a card';
    else if (after.visRows !== before.visRows || after.rows !== before.rows) verdict = `ok: filters the list (${before.visRows}→${after.visRows} rows)`;
    else if (after.selects !== before.selects) verdict = 'ok: changes a dropdown';
    else if (after.checks !== before.checks) verdict = 'ok: toggles a checkbox';
    else if (after.href !== before.href) verdict = 'ok: changes the address → ' + after.href;
    else if (after.text !== before.text) verdict = 'ok: the page text changes';
    else if (after.scroll !== before.scroll) verdict = 'ok: scrolls to a section';
    else if (isExternalLink) verdict = 'ok: opens an external link in a new tab';
    else verdict = 'NO-OP?';
    results.push([P.name, label, verdict]);
  }
}
const bad = results.filter(r => /ERROR|NO-OP|LEFT THE APP/.test(r[2]));
console.log('TOTAL buttons clicked:', results.filter(r => r[2] !== 'skipped').length, '| skipped(destructive):', results.filter(r => r[2] === 'skipped').length);
console.log('--- problems ---'); bad.forEach(r => console.log(r.join(' | ')));
fs.writeFileSync('button-sweep-results.txt', results.map(r => r.join(' | ')).join('\n'));
console.log('full list -> button-sweep-results.txt');
await browser.close(); process.exit(0);
