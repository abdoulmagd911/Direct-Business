/* probe-the-menu-keeps-its-pages.mjs (2026-09-27, bulletproof audit) — a page you may open stays in the menu.

   Found by the audit, not by a report: js/52 (the access layer) names each menu button by reading its first <span>, and
   for three buttons that is the ICON — js/108's Tasks ("✓") and js/90's Activity & Audit and Archive ("·"). Named "?✓" and
   "?·", they were on nobody's list, so js/52 hid them for everyone but admins (admins skip the list). js/108 showed the
   button again on each redraw; whichever ran last won, and js/52 did — so on the live site all seven team members and the
   manager (every one of them has Tasks at "full") lost Tasks from the menu a moment after it appeared, and the manager
   lost Activity and Archive. probe-tasks-page read the menu once, early, inside the short window where it showed.

   Under test — the menu is read EVERY SECOND for ten seconds after the app has loaded, never once:
     1. a team member with Tasks at full: Tasks is in the menu the whole time; Activity and Archive (none) never are;
     2. a team member with Tasks at none: Tasks is never in the menu;
     3. the manager (Activity, Archive, Tasks at full): all three stay in the menu the whole time;
     4. in Arabic too (case 1), and no JS errors.
   A second defect in the same pass, found by this probe: js/52 shut a menu group it found empty and never opened it again,
   and it checked the menu the instant a redraw rebuilt it — before js/90 (70 ms later) had put Activity and Archive back —
   so the manager's Reference group stayed shut for up to three seconds after every click, and for good for anyone who
   keeps it open. js/52 now checks again 150 ms after each redraw and reopens a group it emptied.
   Sabotage-tested 2026-09-27: with js/52's "a layer that names its own page" lines taken out, 1, 3 and 4 go red; with the
   150 ms re-check and the reopen taken out, 3 goes red.
   PORT 9613–9616 (free when written).                                                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0; const errors = [];
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
async function watch(role, grid, PORT, lang) {
  process.env.MOCK_ROLE = role; process.env.MOCK_PAGE_ACCESS = JSON.stringify(grid); process.env.MOCK_TASKS_ROSTER = '1';
  const { start } = await import('./mock-supabase.mjs?menu=' + (++seq)); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  p.on('pageerror', (e) => errors.push(role + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  /* Activity and Archive live in the Reference group, folded by default; open it the way a person would, remembered */
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); localStorage.setItem('v25_navRefOpen', 'true'); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && (DB.businesses || []).length > 0, null, { timeout: 180000 });
  await p.waitForTimeout(3000);   /* past js/108's own 900 ms and 2.6 s re-checks, into the part the old probe never looked at */
  const seen = { v108NavBtn: [], v90ActBtn: [], v90ArchBtn: [] }; let label = null;
  for (let s = 0; s < 10; s++) {
    const r = await p.evaluate(() => { const o = {}; ['v108NavBtn', 'v90ActBtn', 'v90ArchBtn'].forEach((id) => { const x = document.getElementById(id); o[id] = !!(x && x.offsetParent !== null && getComputedStyle(x).display !== 'none'); });
      const t = document.getElementById('v108NavBtn'); o.label = t ? t.textContent.replace('✓', '').trim() : null; return o; });
    Object.keys(seen).forEach((k) => seen[k].push(r[k])); label = r.label;
    if (s === 4) await p.evaluate(() => { try { current = 'leads'; render(); } catch (_) { } });   /* a redraw in the middle, as a click makes */
    await p.waitForTimeout(1000);
  }
  await b.close(); srv.close?.();
  const all = (k) => seen[k].every(Boolean), none = (k) => seen[k].every((x) => !x);
  return { all, none, seen, label };
}
const fmt = (a) => a.map((x) => (x ? '■' : '·')).join('');
{ const r = await watch('team_member', { today: 'full', leads: 'full', clients: 'full', tasks: 'full' }, 9613, 'en');
  check(r.all('v108NavBtn'), 'team member, Tasks at full: Tasks stays in the menu for ten seconds, through a redraw', fmt(r.seen.v108NavBtn));
  check(r.none('v90ActBtn') && r.none('v90ArchBtn'), 'team member: Activity and Archive (not granted) are never in the menu', fmt(r.seen.v90ActBtn) + ' ' + fmt(r.seen.v90ArchBtn)); }
{ const r = await watch('team_member', { today: 'full', leads: 'full', clients: 'full', tasks: 'none' }, 9614, 'en');
  check(r.none('v108NavBtn'), 'team member, Tasks at none: Tasks is never in the menu', fmt(r.seen.v108NavBtn)); }
{ const r = await watch('manager', { today: 'full', leads: 'full', clients: 'full', tasks: 'full', activity: 'full', archive: 'full' }, 9615, 'en');
  check(r.all('v108NavBtn') && r.all('v90ActBtn') && r.all('v90ArchBtn'), 'manager: Tasks, Activity and Archive all stay in the menu',
    'tasks ' + fmt(r.seen.v108NavBtn) + ' activity ' + fmt(r.seen.v90ActBtn) + ' archive ' + fmt(r.seen.v90ArchBtn)); }
{ const r = await watch('team_member', { today: 'full', leads: 'full', clients: 'full', tasks: 'full' }, 9616, 'ar');
  check(r.all('v108NavBtn') && r.label === 'المهام', 'Arabic: «المهام» stays in the menu', fmt(r.seen.v108NavBtn) + ' label=' + r.label); }
check(errors.length === 0, 'no JS errors', errors.slice(0, 2).join(' | '));
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — a page you may open stays in the menu; one you may not never shows');
process.exit(failures ? 1 : 0);
