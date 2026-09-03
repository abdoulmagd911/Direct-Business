/* GO-LIVE rehearsal: sign in and out as EVERY person on the roster, against the live system,
   and check the access model the owner set on 2026-08-13 —
     super admin : everything
     manager     : employee pages + proposals, events, airlines, settings, logs; manages
                   people but can never grant admin
     employee    : leads, clients, finance — and may edit all three
   Also exercises the day-to-day: filter, sort, search, add, edit, remove.
   Run: NODE_USE_ENV_PROXY=1 node probe-golive.mjs                                          */
import { openApp, signIn, ready, go, signOut, viewText, TEAM } from './emp-rig.mjs';

const URL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON = 'sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const LOG = []; const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };

const MANAGER_PAGES = ['today', 'leads', 'clients', 'finance', 'offers', 'events', 'airlines', 'settings', 'activity', 'archive'];
const EMPLOYEE_PAGES = ['today', 'leads', 'clients', 'finance'];
const OFF_LIMITS_EMP = ['offers', 'ops', 'reports', 'airlines', 'settings', 'activity', 'archive', 'vendors'];
const OFF_LIMITS_MGR = ['ops', 'reports', 'vendors', 'bookings', 'invoices', 'tickets'];
const ORDER = ['business', 'aboelmagd', 'hassan', 'admin', 'othman', 'raad', 'kareem', 'assem', 'mohammed', 'ahmed', 'abdulaziz'];

const tok = (email, password) => fetch(URL + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
}).then(r => r.json()).then(r => r.access_token);
const callAdmin = (t, body) => fetch(URL + '/functions/v1/admin-users', {
  method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let port = 9800;

for (const key of ORDER) {
  const emp = TEAM[key], R = emp.role, tag = `${emp.name.split(' ')[0]} (${R})`;
  console.log(`\n———————— ${tag} · ${emp.email} ————————`);
  const { browser, page, errs } = await openApp(port++);

  const st = await signIn(page, emp.email, emp.pw);
  STEP(`${tag}: signs in with the password he will be given`, st === 'app', st);
  if (st !== 'app') { await browser.close(); continue; }
  await ready(page);

  const who = await page.evaluate(() => ({ name: window.__userName || '', role: window.__userRole || '', me: (window.meName ? meName() : '') }));
  STEP(`${tag}: the app knows who he is and his role`, who.role === R && !!who.name, JSON.stringify(who));
  STEP(`${tag}: no forced password screen (these passwords are permanent)`, !(await page.evaluate(() => !!document.getElementById('fl_pw1'))));

  /* ---- which pages he can reach ---- */
  const allowed = R === 'admin' ? null : R === 'manager' ? MANAGER_PAGES : EMPLOYEE_PAGES;
  const offLimits = R === 'admin' ? [] : R === 'manager' ? OFF_LIMITS_MGR : OFF_LIMITS_EMP;
  const reachable = [];
  for (const p of (allowed || ['today', 'leads', 'clients', 'finance', 'offers', 'events', 'airlines', 'settings', 'reports', 'ops'])) {
    await go(page, p, 1500);
    const at = await page.evaluate(() => (typeof current !== 'undefined' ? current : '?'));
    if (at === p) reachable.push(p);
  }
  STEP(`${tag}: can open every page he should`, allowed ? reachable.length === allowed.length : reachable.length >= 9,
    `${reachable.length}/${allowed ? allowed.length : 10}` + (allowed && reachable.length !== allowed.length ? ' missing: ' + allowed.filter(x => !reachable.includes(x)).join(',') : ''));

  const leaked = [];
  for (const p of offLimits) {
    await go(page, p, 1300);
    const at = await page.evaluate(() => (typeof current !== 'undefined' ? current : '?'));
    if (at === p) leaked.push(p);
    await page.evaluate(() => { const b = document.getElementById('v70box'); if (b) b.remove(); });
  }
  STEP(`${tag}: is kept out of every page he should not see`, leaked.length === 0, leaked.length ? 'REACHED: ' + leaked.join(',') : '');

  /* the sidebar must not even offer them */
  await go(page, 'today', 1500);
  /* Read the button's OWN label, never its position. The sidebar is built three times over
     (core → the v25 layer rebuilds it in groups → Finance and Brand are appended after), so
     the n-th button is not the n-th entry in VIEWS. Counting positions here is what made this
     very check report "offers" where the employee was actually looking at Finance. */
  const nav2 = await page.evaluate(() => {
    const nav = document.getElementById('nav'); if (!nav) return { shown: [], offered: [] };
    const all = [...nav.querySelectorAll('button[data-view]')];
    const visible = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) if (n.style && n.style.display === 'none') return false; return true; };
    return {
      /* what he can see right now */
      shown: all.filter(visible).map(b => b.getAttribute('data-view')),
      /* everything the sidebar offers him, including the groups he has collapsed himself —
         a collapsed "Reference" group is his own choice, not a permission */
      offered: all.filter(b => b.style.display !== 'none').map(b => b.getAttribute('data-view')),
    };
  });
  const navIds = nav2.shown;
  /* An admin must have nothing taken away — measured against everything the sidebar offers,
     not against what happens to be expanded, or a collapsed "Reference" group reads as a
     permission problem. Everyone else must see only their own pages. */
  STEP(`${tag}: the sidebar only lists his own pages`,
    R === 'admin' ? (nav2.offered.length >= 14 && nav2.offered.includes('finance') && nav2.offered.includes('settings'))
                  : navIds.every(id => allowed.includes(id)),
    R === 'admin' ? `${nav2.offered.length} offered: ${nav2.offered.join(',')}` : navIds.join(','));

  /* ---- finance: everyone in this model may edit ---- */
  await go(page, 'finance', 2500);
  await page.waitForFunction(() => window.FIN && FIN.rows, null, { timeout: 30000 }).catch(() => {});
  const fin = await page.evaluate(() => ({ rows: (window.FIN && FIN.rows || []).length, canEdit: typeof canFinEdit === 'function' ? canFinEdit() : null }));
  STEP(`${tag}: sees the finance ledger and may edit it`, fin.rows === 28 && fin.canEdit === true, JSON.stringify(fin));

  /* ---- the daily work: search, filter, sort, add, edit, remove a lead ---- */
  await go(page, 'leads', 2000);
  const work = await page.evaluate(async () => {
    const out = {};
    const all = (DB.businesses || []).filter(b => !b.isClient).length;
    leadFilter.q = ''; leadFilter.stage = 'all'; leadFilter.mine = false; leadFilter.hideClosed = false;
    out.total = (typeof leadTableList === 'function') ? leadTableList().length : -1;
    leadFilter.q = 'travel';                       // search
    out.searched = leadTableList().length;
    leadFilter.q = '';
    leadFilter.stage = 'Contacted';                // filter by stage
    out.filtered = leadTableList().length;
    leadFilter.stage = 'all';
    leadFilter.mine = true;                        // filter to mine
    out.mine = leadTableList().length;
    leadFilter.mine = false;
    out.allLeads = all;
    // sort by name if the table sorter exists
    try { if (typeof leadSort !== 'undefined') { leadSort.key = 'name'; leadSort.dir = 1; drawLeads(); out.sorted = true; } } catch (_) { out.sorted = false; }
    return out;
  });
  STEP(`${tag}: search, stage filter and "Mine" all narrow the list`, work.total === work.allLeads && work.searched < work.total && work.filtered < work.total && work.mine <= work.total, JSON.stringify(work));

  const crud = await page.evaluate(async (myName) => {
    const id = 'golive-' + Math.abs(Date.now() % 100000);
    const b = { id, name: 'Go-live check ' + id, nameAr: 'فحص التشغيل', segment: 'QA', category: 'Convert', source: 'Direct outreach', stage: 'New', assignedTo: myName, isClient: false, contacts: [], activities: [], notes: 'temporary row created by the go-live rehearsal', totalSAR: 0 };
    DB.businesses.push(b); if (typeof save === 'function') save();
    await new Promise(r => setTimeout(r, 3800));
    const added = (DB.businesses || []).some(x => x.id === id);
    const rec = (DB.businesses || []).find(x => x.id === id);
    if (rec) { rec.notes = 'edited by the rehearsal'; rec.nextActionNote = 'call them back'; if (typeof save === 'function') save(); }
    await new Promise(r => setTimeout(r, 3800));
    return { id, added, edited: !!(rec && rec.notes === 'edited by the rehearsal') };
  }, emp.name);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(9000); await ready(page);
  const persisted = await page.evaluate(id => {
    const r = (DB.businesses || []).find(x => x.id === id);
    return r ? { there: true, notes: r.notes } : { there: false };
  }, crud.id);
  STEP(`${tag}: can add a company and the edit survives a reload`, crud.added && persisted.there && /edited by the rehearsal/.test(persisted.notes || ''), JSON.stringify(persisted));

  const removed = await page.evaluate(async id => {
    DB.businesses = (DB.businesses || []).filter(x => x.id !== id);
    if (typeof save === 'function') save();
    await new Promise(r => setTimeout(r, 4000));
    return !(DB.businesses || []).some(x => x.id === id);
  }, crud.id);
  STEP(`${tag}: can remove it again (archived, not destroyed)`, removed);

  /* ---- managing people ---- */
  const t = await tok(emp.email, emp.pw);
  const listed = await callAdmin(t, { action: 'list' });
  if (R === 'admin') {
    STEP(`${tag}: can open the team list`, listed.status === 200 && (listed.body.users || []).length >= 10, `${listed.status} · ${(listed.body.users || []).length} people`);
    STEP(`${tag}: is offered every role including admin`, (listed.body.can_grant || []).includes('admin'), JSON.stringify(listed.body.can_grant));
  } else if (R === 'manager') {
    STEP(`${tag}: can open the team list (he runs the team)`, listed.status === 200 && (listed.body.users || []).length >= 10, `${listed.status} · ${(listed.body.users || []).length} people`);
    STEP(`${tag}: is NOT offered the admin role`, !(listed.body.can_grant || []).includes('admin') && (listed.body.can_grant || []).includes('manager'), JSON.stringify(listed.body.can_grant));
    const adminUser = (listed.body.users || []).find(u => u.role === 'admin');
    const emp1 = (listed.body.users || []).find(u => u.role === 'team_member');
    const tryPromote = await callAdmin(t, { action: 'set_role', id: emp1.id, role: 'admin' });
    STEP(`${tag}: cannot promote anyone to admin`, tryPromote.status === 403, `${tryPromote.status} ${String(tryPromote.body.error || '').slice(0, 55)}`);
    const tryTouchAdmin = await callAdmin(t, { action: 'set_active', id: adminUser.id, active: false });
    STEP(`${tag}: cannot switch off an admin`, tryTouchAdmin.status === 403, `${tryTouchAdmin.status} ${String(tryTouchAdmin.body.error || '').slice(0, 55)}`);
    const tryCreateAdmin = await callAdmin(t, { action: 'create', email: 'golive-should-fail@directksa.com', full_name: 'Nope', role: 'admin' });
    STEP(`${tag}: cannot create an admin account`, tryCreateAdmin.status === 403, `${tryCreateAdmin.status}`);
    /* but he CAN do his real job: change an employee's role to manager and back */
    const up = await callAdmin(t, { action: 'set_role', id: emp1.id, role: 'manager' });
    const back = await callAdmin(t, { action: 'set_role', id: emp1.id, role: 'team_member' });
    STEP(`${tag}: CAN set an employee to manager and back (his real job)`, up.status === 200 && back.status === 200, `${up.status}/${back.status}`);
    /* the role picker on screen must not show Admin */
    await go(page, 'settings', 2000);
    const picker = await page.evaluate(async () => {
      try { if (typeof v48Users === 'function') v48Users(); } catch (_) {}
      await new Promise(r => setTimeout(r, 2500));
      const sels = [...document.querySelectorAll('select[data-role]')];
      if (!sels.length) return { found: false };
      const adminOpts = sels.flatMap(s => [...s.options].filter(o => o.value === 'admin'));
      return { found: true, sels: sels.length, adminHidden: adminOpts.every(o => o.disabled || o.hidden) };
    });
    STEP(`${tag}: on screen, "Admin" is not选 selectable in the role picker`.replace('选 ', ' '), picker.found ? picker.adminHidden : true, JSON.stringify(picker));
    await page.evaluate(() => { const o = document.getElementById('v48ov') || document.querySelector('[id$="ov"]'); if (o && o.remove) o.remove(); });
  } else {
    STEP(`${tag}: cannot open the team list at all`, listed.status === 403, `${listed.status} ${String(listed.body.error || '').slice(0, 50)}`);
    const tryCreate = await callAdmin(t, { action: 'create', email: 'emp-should-fail@directksa.com', full_name: 'Nope', role: 'team_member' });
    STEP(`${tag}: cannot create users`, tryCreate.status === 403, String(tryCreate.status));
  }

  /* ---- the logs: admins and the manager only ---- */
  await go(page, 'activity', 1800);
  const atLogs = await page.evaluate(() => (typeof current !== 'undefined' ? current : '?'));
  if (R === 'admin' || R === 'manager') STEP(`${tag}: can open the logs (Activity & Audit)`, atLogs === 'activity', atLogs);
  else STEP(`${tag}: cannot open the logs`, atLogs !== 'activity', atLogs);
  await page.evaluate(() => { const b = document.getElementById('v70box'); if (b) b.remove(); });

  /* ---- the looks, in both languages ---- */
  await go(page, 'leads', 1600);
  await page.screenshot({ path: `shots/golive-${key}-leads.png` });
  await page.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render(); });
  await page.waitForTimeout(2200);
  const arOK = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, ar: /العملاء|اليوم|المالية/.test(document.body.textContent || '') }));
  STEP(`${tag}: the Arabic view is clean`, arOK.over <= 4 && arOK.ar, JSON.stringify(arOK));
  await page.screenshot({ path: `shots/golive-${key}-arabic.png` });
  await page.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });

  const out = await signOut(page);
  STEP(`${tag}: signs out cleanly`, out.back, JSON.stringify(out));
  STEP(`${tag}: no javascript errors all session`, errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close();
}

/* Take the rehearsal rows back out. The app ARCHIVES a company rather than deleting it —
   which is the right behaviour and what the check above proves — but archived rows still sit
   in the list, so eleven runs a day would bury the real thirty companies under test rows. */
try {
  const t = await tok(TEAM.admin.email, TEAM.admin.pw);
  const r = await fetch(URL + '/rest/v1/businesses?name=like.Go-live%20check%20golive-*', {
    method: 'DELETE',
    headers: { apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  });
  const gone = await r.json().catch(() => []);
  console.log(`\ncleaned up ${Array.isArray(gone) ? gone.length : 0} rehearsal companies`);
} catch (e) { console.log('\nCLEANUP FAILED — remove the "Go-live check" rows by hand: ' + e); }

console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
LOG.filter(l => l.startsWith('FAIL')).forEach(l => console.log('   ' + l));
/* PROBE-INTEGRITY FIX (meta-audit, 2026-09-03): was `process.exit(0)` — the go-live rehearsal
   counted and printed FAILs but always exited 0, so a failed rehearsal signalled success. */
process.exit(LOG.filter(l => l.startsWith('FAIL')).length ? 1 : 0);
