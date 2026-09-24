/* probe-the-profile-menu-takes-the-keyboard.mjs — the profile chip's menu (Team · Access · Sign out)
   can be opened, walked and closed from the keyboard, in both languages, and closing it never
   presses anything.

   Fire #251. Driven live: Enter on the chip opened the menu — it is a button — but the focus stayed
   on the chip, Tab walked straight past the menu into the page, and Escape did nothing at all: the
   one pop-up in the app that ignored the key. It fell between two guards: check-structure's overlay
   rule only reads files that build a FULL-SCREEN box, and probe-escape-closes-every-box only counts
   boxes wider than 300 px — this one is 230. probe-round9 pressed Escape on it and then removed the
   menu by hand, so the press was never measured (trap: a cleanup that hides "nothing happened").
   The same menu holds Sign out, so the half that matters is that a keyboard close is a close and
   not a press.

   What this holds:
     1. Enter on the focused chip opens the menu, and the focus lands on its first item;
     2. ↓ moves the focus to the next item, ↑ brings it back;
     3. Escape closes the menu and puts the focus back on the chip;
     4. Escape pressed nothing — the page is still signed in and no item ran;
     5. Tab out of the menu closes it and the person is not stranded (focus is on something);
     6. brake: a click outside still closes it, and after five open/close rounds a stray Escape with
        nothing open leaves the page as it was;
     7. the chip says what it is: aria-haspopup, and aria-expanded follows the menu;
     8. AR: the items are Arabic and Escape closes the Arabic menu too;
     9. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the keydown wiring removed (js/44 back to a click-only menu) — fails 2, 3, 5, 6, 7 and 8
       (6 because the stray Escape after five rounds leaves the menu open, 7 because the chip
       then never returns to "closed");
     · the focus never moved into the menu (items[0].focus() removed) — fails 1 and 2 alone.
   Run: node scripts/qa/probe-the-profile-menu-takes-the-keyboard.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9291 — one mock. */
const PORT = 9291; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  let signOutCalls = 0;
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    if (/\/auth\/v1\/logout/.test(u.pathname)) { signOutCalls++; await r.fulfill({ status: 204, body: '' }); return; }
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForFunction(() => { const c = document.getElementById('v68me'); return !!c && c.offsetParent !== null; }, { timeout: 30000 });
  await p.waitForTimeout(1500);

  /* every item ran through the menu is counted, so a keyboard close that pressed one shows */
  await p.evaluate(() => { window.__qaRan = 0; document.querySelectorAll('.tools button').forEach((b) => { const o = b.onclick; b.addEventListener('click', () => { if (b.id !== 'v68me') window.__qaRan++; }); void o; }); });

  const menu = () => p.evaluate(() => {
    const m = document.getElementById('v68menu'); const c = document.getElementById('v68me');
    const items = m ? [].slice.call(m.querySelectorAll('button')).map((x) => x.textContent.trim()) : null;
    const ae = document.activeElement;
    return { open: !!m, items, focusIn: !!(m && ae && m.contains(ae)), focusText: ae ? (ae.textContent || '').trim().slice(0, 40) : '', focusIsChip: ae === c,
             haspopup: c ? c.getAttribute('aria-haspopup') : null, expanded: c ? c.getAttribute('aria-expanded') : null, signedIn: !document.getElementById('cl_email'), ran: window.__qaRan || 0 };
  });

  /* 1. Enter on the chip */
  await p.focus('#v68me'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const opened = await menu();
  /* 2. walk */
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150); const down = await menu();
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150); const up = await menu();
  /* 3./4. Escape */
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); const esc = await menu();
  /* 5. Tab out — from a menu this step opened itself (a click outside first, so an Escape that
     failed above cannot leave the menu open and make Enter close it) */
  await p.mouse.click(400, 500); await p.waitForTimeout(300);
  await p.focus('#v68me'); await p.keyboard.press('Enter'); await p.waitForTimeout(400); const tabOpened = await menu();
  await p.keyboard.press('Tab'); await p.waitForTimeout(300); const tab = await menu();
  const stranded = await p.evaluate(() => !document.activeElement || document.activeElement === document.body);
  /* 6. click outside + five rounds + stray Escape */
  await p.click('#v68me'); await p.waitForTimeout(300); const beforeOut = await menu();
  await p.mouse.click(400, 500); await p.waitForTimeout(300); const afterOut = await menu();
  for (let i = 0; i < 5; i++) { await p.click('#v68me'); await p.waitForTimeout(120); await p.keyboard.press('Escape'); await p.waitForTimeout(120); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); const stray = await menu();
  await ctx.close();
  return { opened, down, up, esc, tabOpened, tab, stranded, beforeOut, afterOut, stray, signOutCalls, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const AR = /[؀-ۿ]/;
console.log('  the profile menu, opened and closed from the keyboard, in English and in Arabic');

(en.opened.open && en.opened.focusIn && en.opened.items && en.opened.items.length >= 2 && en.opened.focusText === en.opened.items[0])
  ? pass('Enter on the chip opens the menu and the focus lands on its first item', JSON.stringify(en.opened.items))
  : fail('Enter on the chip opens the menu and the focus lands on its first item', JSON.stringify(en.opened));

(en.down.open && en.down.focusIn && en.down.focusText === en.opened.items[1] && en.up.focusIn && en.up.focusText === en.opened.items[0])
  ? pass('↓ moves the focus to the next item and ↑ brings it back')
  : fail('↓ moves the focus to the next item and ↑ brings it back', JSON.stringify({ down: en.down.focusText, up: en.up.focusText }));

(!en.esc.open && en.esc.focusIsChip)
  ? pass('Escape closes the menu and puts the focus back on the chip')
  : fail('Escape closes the menu and puts the focus back on the chip', JSON.stringify(en.esc));

(en.esc.signedIn && en.esc.ran === 0 && en.signOutCalls === 0 && ar.signOutCalls === 0)
  ? pass('Escape pressed nothing — still signed in, no item ran, no sign-out call left the page')
  : fail('Escape pressed nothing — still signed in, no item ran, no sign-out call left the page', JSON.stringify({ signedIn: en.esc.signedIn, ran: en.esc.ran, signOut: en.signOutCalls + ar.signOutCalls }));

(en.tabOpened.open && !en.tab.open && !en.stranded)
  ? pass('Tab out of the menu closes it and the person is not stranded', 'focus on ' + JSON.stringify(en.tab.focusText || '(page)'))
  : fail('Tab out of the menu closes it and the person is not stranded', JSON.stringify({ wasOpen: en.tabOpened.open, tab: en.tab, stranded: en.stranded }));

(en.beforeOut.open && !en.afterOut.open && !en.stray.open && en.stray.signedIn && en.stray.ran === 0)
  ? pass('brake: a click outside still closes it, and five rounds plus a stray Escape leave the page as it was')
  : fail('brake: a click outside still closes it, and five rounds plus a stray Escape leave the page as it was', JSON.stringify({ before: en.beforeOut.open, after: en.afterOut.open, stray: en.stray }));

(en.opened.haspopup === 'menu' && en.opened.expanded === 'true' && en.esc.expanded === 'false')
  ? pass('the chip says what it is: aria-haspopup, and aria-expanded follows the menu')
  : fail('the chip says what it is: aria-haspopup, and aria-expanded follows the menu', JSON.stringify({ haspopup: en.opened.haspopup, open: en.opened.expanded, closed: en.esc.expanded }));

(ar.opened.open && ar.opened.items && ar.opened.items.every((t) => AR.test(t)) && !ar.esc.open && ar.esc.focusIsChip)
  ? pass('AR: the items are Arabic and Escape closes the Arabic menu too', JSON.stringify(ar.opened.items))
  : fail('AR: the items are Arabic and Escape closes the Arabic menu too', JSON.stringify({ items: ar.opened.items, esc: ar.esc }));

const errs = en.errors.concat(ar.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
