/* probe-the-forms-still-fit.mjs — the layout half of everything fires #115 to #121 changed.

   Those rounds added controls and options to five forms: an extra option to the funnel-details
   dropdowns, an empty option and an on-file option to the lead form's source and category boxes and
   to the airline editor's type box, the same to the corporate profile's entity type, a fourth box
   to every contact row, and a Website box to the lead form. Every one of those is guarded by a
   probe that reads values out of the DOM — and a value can be perfectly correct in a control that
   has been pushed off the side of the screen, or that has made the page scroll sideways. Reading
   the DOM cannot see that; this can.

   Two things are asserted per form, in both languages: the page does not scroll sideways, and no
   control has been pushed outside the window. They are the two faults that an added field actually
   causes, and they were checked by hand with a screenshot when the contact row gained its fourth
   box (126 / 101 / 126 / 126 px, no scroll) — this makes that a standing check instead of a memory.

   Note on closing a box between forms: the app shows and hides the main modal with the `show` class
   on `#ov`, and REUSES the `#modal` element. A driver that removes `#modal` breaks the next form
   (openModal sets innerHTML on it), and one that sets `#modal` to display:none makes the next form
   open invisibly. Both were walked into while writing this. Press Escape and let the app do it.

   Sabotage-tested 2026-09-21 against a COPY of the app (APP_DIR — the repository is untouched):
   with the contact row's grid forced to five 200px columns inside a 520px box, 1 check FAILS — two
   inputs land outside the window, in both languages, AT 1024px AND NOT AT 1500. That is the whole
   reason this runs at two widths: the same fault is invisible on a big screen.
   Run: node scripts/qa/probe-the-forms-still-fit.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9095; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
/* a laptop, and the narrowest width the team actually uses */
const SIZES = [{ w: 1500, h: 1150 }, { w: 1024, h: 900 }];

async function run(lang, size) {
  const ctx = await b.newContext({ viewport: { width: size.w, height: size.h }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0
    && typeof editBusiness === 'function' && typeof window.__editFunnelDetails === 'function', { timeout: 120000 });
  await p.waitForTimeout(4500);

  const id = await p.evaluate(() => {
    window.__FUNNELS = window.__FUNNELS || [];
    window.__FUNNELS.push({ key: 'qa_fit', name_en: 'QA fit', name_ar: 'اختبار', color: 'blue',
      field_template: [{ key: 'stance', type: 'select:competitor,partner_target,neutral', label_en: 'Competitor or partner', label_ar: 'منافس أم شريك' },
        { key: 'city', type: 'text', label_en: 'City', label_ar: 'المدينة' }] });
    const b0 = (DB.businesses || [])[0];
    b0.name = 'Qaanoon Fit Co'; b0.isClient = true; b0.funnelKey = 'qa_fit';
    b0.funnelDetails = { stance: 'Partner', city: 'Riyadh' };
    b0.website = 'https://qaanoon-fit.test'; b0.entityType = 'Semi Government';
    b0.contacts = [{ name: 'Qaanoon Person One', role: 'Head of travel', email: 'one@qa-example.test', phone: '+966 50 111 2222' },
      { name: 'Qaanoon Person Two', role: 'Finance manager', email: 'two@qa-example.test', phone: '+966 50 333 4444' }];
    current = 'leads'; openLead = b0.id; render();
    return b0.id;
  });
  await p.waitForTimeout(2200);

  const fit = () => p.evaluate(() => {
    const out = [];
    const boxes = [].slice.call(document.querySelectorAll('#modal input,#modal select,#modal textarea,#modal button,#fdModal input,#fdModal select,#fdModal textarea,#fdModal button'));
    boxes.forEach((e) => { const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > window.innerWidth + 4 || r.left < -4)) {
        out.push((e.id || e.tagName) + ' @' + Math.round(r.left) + '–' + Math.round(r.right)); } });
    return { sideways: document.documentElement.scrollWidth > window.innerWidth + 6,
      offscreen: out.slice(0, 6), controls: boxes.length };
  });
  /* close the way a person does — see the note in this file's header */
  const close = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(700); };

  const seen = {};
  await p.evaluate((i) => window.__editFunnelDetails(i), id);
  await p.waitForTimeout(1400); seen.funnel = await fit(); await close();
  await p.evaluate((i) => editBusiness(i), id);
  await p.waitForTimeout(1400); seen.lead = await fit(); await close();
  await p.evaluate((i) => { if (window.editCorporate) editCorporate(i); }, id);
  await p.waitForTimeout(1400); seen.corporate = await fit(); await close();
  const airId = await p.evaluate(() => (DB.airlines || [])[0] && (DB.airlines || [])[0].id);
  if (airId) {
    await p.evaluate((a) => { current = 'airlines'; openLead = null; render(); if (window.editSupplier) editSupplier('air', a); }, airId);
    await p.waitForTimeout(1600); seen.airline = await fit(); await close();
  }
  await ctx.close();
  return seen;
}

const out = {};
for (const size of SIZES) {
  for (const lang of ['en', 'ar']) out[lang + '@' + size.w] = await run(lang, size);
}
await b.close(); srv.close?.();
Object.entries(out).forEach(([k, v]) => console.log('  ' + k.padEnd(9),
  Object.entries(v).map(([f, r]) => f + ': ' + r.controls + ' controls' + (r.sideways ? ' SIDEWAYS' : '') + (r.offscreen.length ? ' OFFSCREEN ' + r.offscreen.join(',') : '')).join(' · ')));

const every = (fn) => Object.entries(out).every(([, v]) => Object.values(v).every(fn));
const why = (fn) => JSON.stringify(Object.entries(out).map(([k, v]) => [k, Object.entries(v).filter(([, r]) => !fn(r)).map(([f, r]) => f + ':' + JSON.stringify(r))]).filter(([, l]) => l.length));
const opened = Object.values(out).every((v) => Object.values(v).every((r) => r.controls > 3));
const checks = [
  ['every form really opened, at both widths and in both languages', opened,
    JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([f, r]) => [f, r.controls]))])))],
  ['no form makes the page scroll sideways', every((r) => !r.sideways), why((r) => !r.sideways)],
  ['no control is pushed outside the window', every((r) => r.offscreen.length === 0), why((r) => r.offscreen.length === 0)],
  ['no JS errors', errors.length === 0, errors.slice(0, 3).join(' | ')],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
