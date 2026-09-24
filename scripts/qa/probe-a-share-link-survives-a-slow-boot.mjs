/* probe-a-share-link-survives-a-slow-boot.mjs — a view-only share link keeps its address, its
   guest view and its tidy however slowly the scripts arrive, and a refresh keeps it too.

   Fire #253. probe-share-view-tidy went red under a busy machine three times in three days and green
   alone each time — the definition of a race, and js/03 had already written the mechanism down for
   another deep link (docs/DEEPLINK-BOOT-RACE.md, round 58): js/03 captures the address the page
   opened at, and 200 ms after `render` and `DB` exist it REWRITES the address to '/' + the current
   section. Every later script that reads location.pathname for itself is racing that timer. Two of
   them did: js/10, which decides whether this is a share view at all (the token, the guest banner,
   the data), and js/79, which tidies the guest view (Finance out of the sidebar, the guest footer,
   the top bar below the banner). On a slow connection — a phone on the road, which is where a
   shared link is opened — the address is /leads by the time they run: js/79 does nothing, and
   further along js/10 sees no token and the visitor gets the sign-in form. And the rewrite itself
   throws the token away, so a refresh of a working share view lands on the sign-in form too.

   Fixed in js/03: a share view's address is never rewritten (the token stays in the bar, refresh
   works). Belt: js/10 and js/79 read `window.__bootPath` — the address js/03 published for exactly
   this — before location.pathname.

   The losing order is FORCED here, not waited for: the response for js/10 (then, separately, js/79)
   is held back 1.5 s so js/03's timer fires first, on any machine, at 1x.

   What this holds:
     1. js/10 held back: the share view still boots (guest banner, records present) and the address
        still carries the token;
     2. js/79 held back: the guest view is tidy — no Finance entry, the guest footer, the top bar
        below the banner — in English;
     3. a refresh of the shared page comes back as the shared page, not the sign-in form;
     4. AR, js/79 held back: the footer reads the Arabic guest word;
     5. control: with nothing held back the share view is tidy AND keeps its address — the tidy half
        shows the harness is sound; the address half is the refresh defect at 1x, which the old tree
        fails even with nothing held back;
     6. brake: a signed-in colleague's addresses still move — Leads → Clients rewrites /leads to
        /clients as before;
     7. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), three real runs:
     · js/03's share guard removed (belt kept) — fails 1 (its address half), 3 and 5: the token is
       thrown away and a refresh lands on the sign-in form; the view itself survives on the belt;
     · the belt removed as well (js/10 and js/79 back to location.pathname) — fails 1, 2, 3, 4 and
       5: the pre-fix tree — with js/10 held back the visitor is at /today with the sign-in form,
       with js/79 held back Finance is in the sidebar and the footer names a colleague;
     · js/03's guard kept, belt removed — every check green: the guard alone closes the race, the
       belt is the documented second line (DEEPLINK-BOOT-RACE.md), not a claim of its own.
   Run: node scripts/qa/probe-a-share-link-survives-a-slow-boot.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9297 — one mock. */
const PORT = 9297; const BASE = 'http://localhost:' + PORT;
const TOKEN = 'qa-slow-boot-token-0123456789abcdef';
const HOLD = 1500;

const srv = start(PORT, { share_links: [{ token: TOKEN, scope: 'all', active: true, created_by: 'u-qa', created_at: new Date().toISOString(), last_used_at: null }] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function wire(p, hold) {
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method(); const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  if (hold) await p.route((u) => u.pathname.startsWith('/js/' + hold), async (r) => { await new Promise((res) => setTimeout(res, HOLD)); await r.continue(); });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
}
const readShare = () => ({
  path: location.pathname, share: document.body.getAttribute('data-share'), biz: (typeof DB !== 'undefined' && DB.businesses || []).length,
  signin: !!(document.getElementById('cl_email') && document.getElementById('cl_email').offsetParent !== null),
  fin: [...document.querySelectorAll('#nav button')].filter((x) => x.style.display !== 'none' && getComputedStyle(x).display !== 'none' && (x.getAttribute('data-view') === 'finance' || x.id === 'v44FinBtn' || /^(Finance|المالية)$/.test(((x.querySelector('span') || x).textContent || '').trim()))).length,
  foot: (function () { const f = document.querySelector('.side .foot') || document.querySelector('.foot'); return f && f.querySelector('b') ? f.querySelector('b').textContent.trim() : null; })(),
  topTop: (function () { const t = document.querySelector('.top'); return t ? Math.round(t.getBoundingClientRect().top) : null; })(),
  bannerBottom: (function () { const bn = document.getElementById('v38banner'); return bn ? Math.round(bn.getBoundingClientRect().bottom) : null; })(),
});

async function shareRun(hold, lang, reload) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(hold + '/' + lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await wire(p, hold);
  await p.goto(BASE + '/s/' + TOKEN + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => typeof render === 'function', { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const first = await p.evaluate(readShare);
  let after = null;
  if (reload) { await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof render === 'function', { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(7000); after = await p.evaluate(readShare); }
  await ctx.close();
  return { first, after, errors };
}
async function signedRun() {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push('signed: ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await wire(p, null);
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(3000);
  const before = await p.evaluate(() => location.pathname);
  await p.evaluate(() => { try { current = 'clients'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(1200);
  const afterNav = await p.evaluate(() => location.pathname);
  await ctx.close();
  return { before, afterNav, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const h10 = await shareRun('10-', 'en', true);
const h79 = await shareRun('79-', 'en', false);
const h79ar = await shareRun('79-', 'ar', false);
const ctl = await shareRun(null, 'en', false);
const signed = await signedRun();
await b.close(); srv.close?.();

const tokenIn = (s) => !!s && s.path.indexOf('/s/' + TOKEN) === 0;
const tidy = (s) => !!s && s.fin === 0 && s.foot === 'View-only guest' && s.topTop !== null && s.bannerBottom !== null && s.topTop >= s.bannerBottom - 1;
console.log('  the losing order forced: js/10 held back 1.5 s, then js/79; a control with nothing held; a signed-in brake');

(h10.first.share === '1' && h10.first.biz > 0 && !h10.first.signin && tokenIn(h10.first))
  ? pass('js/10 held back: the share view still boots and the address still carries the token', h10.first.path.slice(0, 24) + '… ' + h10.first.biz + ' records')
  : fail('js/10 held back: the share view still boots and the address still carries the token', JSON.stringify(h10.first));

tidy(h79.first)
  ? pass('js/79 held back: the guest view is tidy — no Finance entry, guest footer, top bar below the banner')
  : fail('js/79 held back: the guest view is tidy — no Finance entry, guest footer, top bar below the banner', JSON.stringify(h79.first));

(h10.after && h10.after.share === '1' && h10.after.biz > 0 && !h10.after.signin && tokenIn(h10.after))
  ? pass('a refresh of the shared page comes back as the shared page, not the sign-in form')
  : fail('a refresh of the shared page comes back as the shared page, not the sign-in form', JSON.stringify(h10.after));

(h79ar.first.share === '1' && h79ar.first.foot === 'ضيف' && h79ar.first.fin === 0)
  ? pass('AR, js/79 held back: the footer reads the Arabic guest word')
  : fail('AR, js/79 held back: the footer reads the Arabic guest word', JSON.stringify(h79ar.first));

(ctl.first.share === '1' && ctl.first.biz > 0 && tokenIn(ctl.first) && tidy(ctl.first))
  ? pass('control: with nothing held back the share view is tidy and keeps its address')
  : fail('control: with nothing held back the share view is tidy and keeps its address', JSON.stringify(ctl.first));

(signed.before === '/leads' && signed.afterNav === '/clients')
  ? pass('brake: a signed-in colleague\'s addresses still move — /leads became /clients')
  : fail('brake: a signed-in colleague\'s addresses still move — /leads became /clients', JSON.stringify(signed));

const errs = [].concat(h10.errors, h79.errors, h79ar.errors, ctl.errors, signed.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
