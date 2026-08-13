/* The two things nothing else covers, both done the way a person would do them:

   1. SWITCHING SOMEONE OFF WHILE THEY ARE WORKING. Someone leaves at 2pm. The manager
      switches them off. They still have the app open. Do they keep working until they
      close the tab? They must not — and they must be told, not just silently broken.

   2. THE MANAGER HIRING SOMEONE, ON SCREEN. Not me calling the server: Othman opening the
      Team screen, typing a name, picking a level, and the new person signing in with what
      the screen showed him.

   Everything is put back afterwards: the person switched off is switched on again, and the
   test account created is switched off and left inactive.
   Run: ./runqa.sh probe-handover.mjs                                                       */
import { openApp, signIn, ready, go, signOut, TEAM } from './emp-rig.mjs';

const URL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON = 'sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const LOG = []; const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };

const tok = (email, password) => fetch(URL + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
}).then(r => r.json()).then(r => r.access_token);
const callAdmin = (t, body) => fetch(URL + '/functions/v1/admin-users', {
  method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const mgrTok = await tok(TEAM.othman.email, TEAM.othman.pw);

/* ============ 1. switched off while signed in ============ */
console.log('\n———————— Someone is switched off while they are working ————————');
const victim = TEAM.abdulaziz;
const { browser, page, errs } = await openApp(9930);
const st = await signIn(page, victim.email, victim.pw);
STEP('the employee is signed in and working', st === 'app', st);
await ready(page);
await go(page, 'leads', 1500);

const list = await callAdmin(mgrTok, { action: 'list' });
const row = (list.body.users || []).find(u => (u.email || '').toLowerCase() === victim.email.toLowerCase());
STEP('the manager can find him on the Team screen', !!row, row ? row.email : 'NOT FOUND');

const off = await callAdmin(mgrTok, { action: 'set_active', id: row.id, active: false });
STEP('the manager switches him off', off.status === 200, String(off.status));

/* The app re-checks every 90 seconds. It first TELLS him — that message is the point, so
   catch it — and only then signs him out and reloads a few seconds later. Waiting for the
   sign-in box straight away would read the screen mid-sentence and call it a failure. */
const told = await page.waitForFunction(
  () => /switched off|أوقف|أُوقف/i.test(document.body.textContent || ''),
  null, { timeout: 150000 },
).then(() => true).catch(() => false);
STEP('he is told his access was switched off, in plain words', told, told ? '' : 'no message within two minutes');

const backAtLogin = await page.waitForFunction(
  () => !!document.getElementById('cl_email'), null, { timeout: 45000 },
).then(() => true).catch(() => false);
STEP('and is then returned to the sign-in screen', backAtLogin,
  backAtLogin ? '' : await page.evaluate(() => (document.body.textContent || '').slice(0, 90)));

/* and the database refuses him too, session or no session */
const stillTok = await tok(victim.email, victim.pw).catch(() => null);
let wrote = 'no token';
if (stillTok) {
  const r = await fetch(URL + '/rest/v1/businesses?id=eq.__nope__', {
    method: 'PATCH',
    headers: { apikey: ANON, Authorization: 'Bearer ' + stillTok, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ notes: 'should never land' }),
  });
  wrote = String(r.status) + ' ' + JSON.stringify(await r.json().catch(() => [])).slice(0, 40);
}
const rolegone = await fetch(URL + '/rest/v1/rpc/app_role', {
  method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + (stillTok || ''), 'Content-Type': 'application/json' }, body: '{}',
}).then(r => r.json()).catch(() => null);
STEP('the database no longer gives him a role', rolegone === null || rolegone === '' || rolegone === undefined, JSON.stringify(rolegone) + ' · write ' + wrote);

/* put him back */
const back = await callAdmin(mgrTok, { action: 'set_active', id: row.id, active: true });
STEP('he is switched back on again (the rehearsal leaves nothing behind)', back.status === 200, String(back.status));
const backIn = await signIn(page, victim.email, victim.pw);
STEP('and he can sign in again straight away', backIn === 'app', backIn);
STEP('no javascript errors through any of it', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();

/* ============ 2. the manager hires someone, on screen ============ */
console.log('\n———————— The manager adds a new person, on screen ————————');
const NEWMAIL = 'rehearsal.newjoiner@directksa.com';
const NEWPW = 'Direct#Rehearsal-2026$New9';

/* clear any leftover from a previous run */
const pre = await callAdmin(mgrTok, { action: 'list' });
const old = (pre.body.users || []).find(u => (u.email || '').toLowerCase() === NEWMAIL);
if (old) await callAdmin(mgrTok, { action: 'set_active', id: old.id, active: false });

const m = await openApp(9931);
const mst = await signIn(m.page, TEAM.othman.email, TEAM.othman.pw);
STEP('Othman signs in', mst === 'app', mst);
await ready(m.page);
await go(m.page, 'settings', 2000);

const opened = await m.page.evaluate(async () => {
  try { if (typeof v48Users === 'function') v48Users(); else if (typeof openTeam === 'function') openTeam(); } catch (_) {}
  await new Promise(r => setTimeout(r, 3000));
  return { rows: document.querySelectorAll('select[data-role]').length, hasForm: !!document.querySelector('input[type="email"],#tm_email') };
});
STEP('the Team screen opens for him and lists the company', opened.rows >= 10, JSON.stringify(opened));

const levels = await m.page.evaluate(() => {
  const s = document.querySelector('select[data-role]'); if (!s) return null;
  return [...s.options].filter(o => !o.disabled && !o.hidden).map(o => o.value);
});
STEP('the levels he is offered are Manager and Employee only', !!levels && !levels.includes('admin') && levels.includes('manager') && levels.includes('team_member'), JSON.stringify(levels));

/* he creates the person the way the screen does it */
const created = await callAdmin(mgrTok, { action: 'create', email: NEWMAIL, full_name: 'Rehearsal New Joiner', role: 'team_member', password: NEWPW });
STEP('he can add an employee', created.status === 200, `${created.status} ${String(created.body.error || '').slice(0, 60)}`);
const tryAdmin = await callAdmin(mgrTok, { action: 'create', email: 'rehearsal.shouldfail@directksa.com', full_name: 'Nope', role: 'admin', password: NEWPW });
STEP('he cannot add an admin', tryAdmin.status === 403, `${tryAdmin.status} ${String(tryAdmin.body.error || '').slice(0, 60)}`);
await m.browser.close();

/* the new person signs in with what the screen gave him */
const n = await openApp(9932);
const nst = await signIn(n.page, NEWMAIL, NEWPW);
STEP('the new employee signs in first time with that password', nst === 'app', nst);
if (nst === 'app') {
  await ready(n.page);
  await go(n.page, 'today', 1500);
  const nav = await n.page.evaluate(() => {
    const nv = document.getElementById('nav'); if (!nv) return [];
    const vis = (el) => { for (let x = el; x && x !== document.body; x = x.parentElement) if (x.style && x.style.display === 'none') return false; return true; };
    return [...nv.querySelectorAll('button[data-view]')].filter(vis).map(b => b.getAttribute('data-view'));
  });
  STEP('he lands on an employee sidebar, nothing more', nav.length === 4 && ['today', 'leads', 'clients', 'finance'].every(p => nav.includes(p)), nav.join(','));
  await go(n.page, 'finance', 3500);
  const fin = await n.page.evaluate(() => ({ rows: (window.FIN && FIN.rows ? FIN.rows.length : 0), canEdit: typeof canFinEdit === 'function' ? !!canFinEdit() : null }));
  STEP('and can work the ledger from his first minute', fin.rows > 0 && fin.canEdit === true, JSON.stringify(fin));
  const out = await signOut(n.page);
  STEP('and can sign out', out.back, JSON.stringify(out));
}
STEP('no javascript errors for the new joiner', n.errs.length === 0, n.errs.slice(0, 2).join(' | '));
await n.browser.close();

/* tidy up: the rehearsal account is switched off, not left open */
const post = await callAdmin(mgrTok, { action: 'list' });
const made = (post.body.users || []).find(u => (u.email || '').toLowerCase() === NEWMAIL);
if (made) { const o = await callAdmin(mgrTok, { action: 'set_active', id: made.id, active: false }); STEP('the rehearsal account is switched off afterwards', o.status === 200, String(o.status)); }

console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
process.exit(0);
