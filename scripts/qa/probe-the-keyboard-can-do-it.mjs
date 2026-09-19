/* probe-the-keyboard-can-do-it.mjs — a dialog has to be usable without a mouse.

   Never checked before this round, and it decides whether a person who works from the keyboard can
   use the app at all. Three properties, both languages, driven with real clicks and real Tab keys —
   never by calling a function:

     1. When a dialog opens, focus moves INTO it. If it stays on the page behind, the first Tab
        walks the list under the overlay instead of the form on top of it.
     2. Tab stays inside the dialog and cycles at the end, rather than wandering out behind it.
     3. Save can be reached from the keyboard.

   core-06's v21TrapFocus does this for the shared modal, and measured on the real database
   2026-09-21 it does it well: focus lands inside the box, fifty-two tabs never leave it, and Save is
   reachable, in English and in Arabic.

   THE FUNNEL-DETAILS BOX DID NOT. It is js/09's OWN overlay, not the shared modal, so the trap
   never reached it: opening it from the card left the keyboard on the Edit button BEHIND it, and
   ten Tab presses all walked the page underneath — somebody working without a mouse was typing
   into the card behind the form, in both languages. js/09 now calls the same trap by hand, releases
   it on close, and puts the keyboard back where it was, which is the courtesy the shared modal
   already did.

   Sabotage-tested 2026-09-21 against a COPY of the app (APP_DIR — the repository is untouched):
     · v21TrapFocus's own `first.focus()` removed: 2 checks FAIL — and note WHICH two. The funnel
       box loses the keyboard; the shared modal does not, because its first control is the close
       button and clicking Edit leaves focus adjacent to it. The trap earns its keep on the box that
       has no other way in.
     · js/09's call to the trap removed: 2 checks FAIL — the defect this round fixed, exactly.
   Run: node scripts/qa/probe-the-keyboard-can-do-it.mjs                                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9096; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const SAVE = /^(Save|Save changes|حفظ|حفظ التغييرات)$/;
const EDIT = /^(Edit|تعديل)$/;

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
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
    && typeof window.__editFunnelDetails === 'function', { timeout: 120000 });
  await p.waitForTimeout(4500);

  const id = await p.evaluate(() => {
    window.__FUNNELS = window.__FUNNELS || [];
    window.__FUNNELS.push({ key: 'qa_kbd', name_en: 'QA keyboard', name_ar: 'لوحة المفاتيح', color: 'blue',
      field_template: [{ key: 'city', type: 'text', label_en: 'City', label_ar: 'المدينة' },
        { key: 'note', type: 'textarea', label_en: 'Note', label_ar: 'ملاحظة' }] });
    const b0 = (DB.businesses || [])[0];
    b0.name = 'Qaanoon Keyboard Co'; b0.funnelKey = 'qa_kbd'; b0.funnelDetails = { city: 'Riyadh' };
    current = 'leads'; openLead = b0.id; render();
    return b0.id;
  });
  await p.waitForTimeout(2600);

  const where = () => p.evaluate(() => {
    const a = document.activeElement; if (!a) return { el: null, inModal: false, inFunnel: false };
    return { el: a.tagName + (a.id ? '#' + a.id : ''),
      inModal: !!(a.closest && a.closest('#modal')), inFunnel: !!(a.closest && a.closest('#fdModal')),
      isSave: /^(Save|Save changes|حفظ|حفظ التغييرات)$/.test((a.textContent || '').trim()) };
  });
  const tabs = async (n) => { const t = []; for (let i = 0; i < n; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(110); t.push(await where()); } return t; };

  /* the shared modal, opened by clicking the card's own Edit button */
  const openedModal = await p.evaluate((rx) => {
    const btn = [].slice.call(document.querySelectorAll('#view button, #view .btn'))
      .find((x) => new RegExp(rx).test((x.textContent || '').trim()) && !x.closest('#funnelCard'));
    if (!btn) return false; btn.focus(); btn.click(); return true;
  }, EDIT.source);
  await p.waitForTimeout(1800);
  const modalShown = await p.evaluate(() => { const o = document.getElementById('ov'); return !!o && o.classList.contains('show'); });
  const modalFocus = await where();
  const modalTrail = await tabs(12);
  let saveSeen = modalTrail.some((t) => t.isSave);
  let longTrailOutside = 0;
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(60);
    const w = await where(); if (!w.inModal) longTrailOutside++; if (w.isSave) saveSeen = true; }

  /* the funnel box, which builds its own overlay */
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  await p.evaluate((i) => { current = 'leads'; openLead = i; render(); }, id);
  await p.waitForTimeout(2600);
  const openedFunnel = await p.evaluate((rx) => {
    const btn = [].slice.call(document.querySelectorAll('#funnelCard button'))
      .find((x) => new RegExp(rx).test((x.textContent || '').trim()));
    if (!btn) return false; btn.focus(); btn.click(); return true;
  }, EDIT.source);
  await p.waitForTimeout(1600);
  const funnelOpen = await p.evaluate(() => !!document.getElementById('fdModal'));
  const funnelFocus = await where();
  const funnelTrail = await tabs(10);

  await ctx.close();
  return { openedModal, modalShown, modalFocus, modalTrail, saveSeen, longTrailOutside, openedFunnel, funnelOpen, funnelFocus, funnelTrail };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
const outside = (t) => t.filter((x) => !x.inModal).length;
const outsideF = (t) => t.filter((x) => !x.inFunnel).length;
console.log('  EN modal:', JSON.stringify({ shown: en.modalShown, focus: en.modalFocus.el, inside: en.modalFocus.inModal, tabsOutside: outside(en.modalTrail), save: en.saveSeen }));
console.log('  AR modal:', JSON.stringify({ shown: ar.modalShown, focus: ar.modalFocus.el, inside: ar.modalFocus.inModal, tabsOutside: outside(ar.modalTrail), save: ar.saveSeen }));
console.log('  EN modal trail:', JSON.stringify(en.modalTrail.map((t) => (t.inModal ? '' : 'OUT ') + t.el)));
console.log('  EN funnel:', JSON.stringify({ opened: en.openedFunnel, present: en.funnelOpen, focus: en.funnelFocus.el, inside: en.funnelFocus.inFunnel, tabsOutside: outsideF(en.funnelTrail) }));
console.log('  AR funnel:', JSON.stringify({ opened: ar.openedFunnel, present: ar.funnelOpen, focus: ar.funnelFocus.el, inside: ar.funnelFocus.inFunnel, tabsOutside: outsideF(ar.funnelTrail) }));

const checks = [
  ['the card\'s own Edit button opens the dialog, in both languages',
    en.openedModal && en.modalShown && ar.openedModal && ar.modalShown,
    JSON.stringify({ en: [en.openedModal, en.modalShown], ar: [ar.openedModal, ar.modalShown] })],
  ['opening it moves the keyboard INTO the dialog, not leaving it on the page behind',
    en.modalFocus.inModal === true && ar.modalFocus.inModal === true,
    JSON.stringify({ en: en.modalFocus, ar: ar.modalFocus })],
  ['twelve tabs all stay inside the dialog',
    outside(en.modalTrail) === 0 && outside(ar.modalTrail) === 0,
    JSON.stringify({ en: outside(en.modalTrail), ar: outside(ar.modalTrail), trail: en.modalTrail.map((t) => t.el) })],
  /* the first version of this wanted the order to WRAP within twelve tabs. The lead form has more
     than twelve controls, so it does not — that was the check being clever, not a defect. What
     matters is that the keyboard never leaves the box however long somebody tabs, which the check
     above measures over twelve and this one over forty. */
  ['it still has not escaped after forty more tabs',
    en.longTrailOutside === 0 && ar.longTrailOutside === 0,
    JSON.stringify({ en: en.longTrailOutside, ar: ar.longTrailOutside })],
  ['Save can be reached from the keyboard', en.saveSeen && ar.saveSeen,
    JSON.stringify({ en: en.saveSeen, ar: ar.saveSeen })],
  /* the funnel box is its own overlay, so the trap has to reach it too */
  ['the funnel-details box opens from its own card button', en.openedFunnel && en.funnelOpen && ar.openedFunnel && ar.funnelOpen,
    JSON.stringify({ en: [en.openedFunnel, en.funnelOpen], ar: [ar.openedFunnel, ar.funnelOpen] })],
  ['it takes the keyboard too, instead of leaving it on the card behind',
    en.funnelFocus.inFunnel === true && ar.funnelFocus.inFunnel === true,
    JSON.stringify({ en: en.funnelFocus, ar: ar.funnelFocus })],
  ['and ten tabs stay inside it',
    outsideF(en.funnelTrail) === 0 && outsideF(ar.funnelTrail) === 0,
    JSON.stringify({ en: en.funnelTrail.map((t) => (t.inFunnel ? '' : 'OUT ') + t.el), ar: outsideF(ar.funnelTrail) })],
  ['no JS errors', errors.length === 0, errors.slice(0, 3).join(' | ')],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
