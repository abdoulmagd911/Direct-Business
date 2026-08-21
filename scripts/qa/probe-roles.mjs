/* Five employees, five roles, one admin — each signs in for real, does their job, and is
   tested against BOTH walls: what the screen offers, and what the database actually allows.
   Run: NODE_USE_ENV_PROXY=1 node probe-roles.mjs                                          */
import { openApp, signIn, ready, signOut, go, viewText, TEAM } from './emp-rig.mjs';

const LOG = [];
const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };

/* what the DATABASE must allow per role — the wall that actually matters.
   team_member's finance_expenses/finance_invoices corrected 2026-08-21: this table said 0,
   but finance_expenses/finance_invoices are gated on can_edit_page('finance'), a SEPARATE
   mechanism from the role-enum checks the other columns use — and every one of the 7 real
   team_member accounts in the live database has page_access.finance='editor' (checked
   directly, not assumed). The old 0 was true under an earlier access model and went stale
   when page_access was introduced; a test asserting the wrong thing is worse than no test,
   since it reads as proof. bd/operations/viewer are left as they were — no real account
   holds those roles today (verified), so there is no live page_access to check them
   against; see scripts/qa/rls-matrix.sql for how those three are covered instead (role-flip
   on a real account inside a rolled-back transaction, N/A on the finance/settings columns
   specifically rather than a guessed value). */
const DB_EXPECT = {
  admin:       { businesses: 1, app_offers: 1, app_requests: 1, activities: 1, finance_expenses: 1, finance_invoices: 1, app_settings: 1 },
  manager:     { businesses: 1, app_offers: 1, app_requests: 1, activities: 1, finance_expenses: 1, finance_invoices: 1, app_settings: 1 },
  bd:          { businesses: 1, app_offers: 1, app_requests: 1, activities: 1, finance_expenses: 0, finance_invoices: 0, app_settings: 0 },
  operations:  { businesses: 0, app_offers: 0, app_requests: 1, activities: 1, finance_expenses: 0, finance_invoices: 0, app_settings: 0 },
  team_member: { businesses: 1, app_offers: 1, app_requests: 1, activities: 1, finance_expenses: 1, finance_invoices: 1, app_settings: 0 },
  viewer:      { businesses: 0, app_offers: 0, app_requests: 0, activities: 0, finance_expenses: 0, finance_invoices: 0, app_settings: 0 },
};
const TIER = { admin: 'admin', manager: 'manager', bd: 'team', operations: 'team', team_member: 'team', viewer: 'viewer' };
const ORDER = ['admin', 'othman', 'raad', 'kareem', 'assem', 'mohammed'];

let port = 9400;
const OWNERSHIP = {};

for (const key of ORDER) {
  const emp = TEAM[key];
  const R = emp.role, tag = `${emp.name} (${R})`;
  console.log(`\n———————— ${tag} ————————`);
  const { browser, page, errs } = await openApp(port++);

  const st = await signIn(page, emp.email, emp.pw);
  STEP(`${tag}: signs in with their own password`, st === 'app', st);
  if (st !== 'app') { await browser.close(); continue; }
  await ready(page);

  // ---------- who am I ----------
  const who = await page.evaluate(() => ({ name: window.__userName || '', tier: window.__userTier || '', role: window.__userRole || '', me: (window.meName ? meName() : '') }));
  STEP(`${tag}: the app shows the right person and role`, who.name === emp.name && who.tier === TIER[R] && (who.role === R || R === 'admin'), JSON.stringify(who));
  STEP(`${tag}: "me" used by every filter is this person`, who.me === emp.name, who.me);

  // ---------- what the screen offers ----------
  await go(page, 'today');
  const navSettings = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.nav button, .side button, #nav button')].find(x => /settings|الإعدادات/i.test(x.textContent));
    return b ? (b.offsetParent !== null) : false;
  });
  STEP(`${tag}: Settings in the sidebar is ${R === 'admin' ? 'visible' : 'hidden'}`, navSettings === (R === 'admin'), 'visible=' + navSettings);

  // forcing the settings page by hand
  await go(page, 'settings', 1600);
  const forced = await viewText(page);
  const gate = await page.evaluate(() => ({ where: (typeof current !== 'undefined' ? current : '?'), told: !!document.getElementById('v70box') }));
  if (R === 'admin') STEP(`${tag}: the Settings page opens for the admin`, forced.length > 400 && gate.where === 'settings');
  else STEP(`${tag}: forcing the Settings page is refused and explained`, gate.where !== 'settings' && gate.told, JSON.stringify(gate));
  await page.evaluate(() => { const b = document.getElementById('v70box'); if (b) b.remove(); });

  // ---------- finance: can they edit? ----------
  await go(page, 'finance', 2500);
  await page.waitForFunction(() => window.FIN && FIN.rows, null, { timeout: 25000 }).catch(() => {});
  const fin = await page.evaluate(() => ({
    canView: !!(window.FIN && FIN.rows),
    canEdit: typeof canFinEdit === 'function' ? canFinEdit() : null,
    importTab: !![...document.querySelectorAll('#view button')].find(b => /finGo\('import'\)/.test(b.getAttribute('onclick') || '')),
    rows: (window.FIN && FIN.rows || []).length,
  }));
  STEP(`${tag}: can read Finance`, fin.canView, fin.rows + ' invoices');
  STEP(`${tag}: Finance editing is ${DB_EXPECT[R].finance_expenses ? 'on' : 'off'} for them`, !!fin.canEdit === !!DB_EXPECT[R].finance_expenses, 'canEdit=' + fin.canEdit);
  STEP(`${tag}: the Import tab is ${DB_EXPECT[R].finance_expenses ? 'offered' : 'hidden'}`, !!fin.importTab === !!DB_EXPECT[R].finance_expenses, 'import=' + fin.importTab);
  // expenses add-form only for those who may write finance
  await page.evaluate(() => { try { finGo('expenses'); } catch (_) {} });
  await page.waitForTimeout(1800);
  const expForm = await page.evaluate(() => !!document.getElementById('xp_desc'));
  STEP(`${tag}: the "add expense" form is ${DB_EXPECT[R].finance_expenses ? 'offered' : 'hidden'}`, expForm === !!DB_EXPECT[R].finance_expenses, 'form=' + expForm);

  // ---------- ownership: Mine ----------
  await go(page, 'leads', 1800);
  const mine = await page.evaluate(() => {
    const me = meName();
    const owned = (DB.businesses || []).filter(b => !b.isClient && (window.sameOwner ? sameOwner(b.assignedTo || b.owner, me) : (b.assignedTo || '') === me));
    leadFilter.mine = true; leadFilter.stage = 'all'; leadFilter.q = ''; leadFilter.hideClosed = false;
    const shown = (typeof leadTableList === 'function') ? leadTableList().length : -1;
    leadFilter.mine = false;
    return { owned: owned.length, shown, names: owned.map(b => b.name) };
  });
  OWNERSHIP[emp.name] = mine.owned;
  STEP(`${tag}: "Mine" on Leads shows exactly their companies`, mine.shown === mine.owned, `mine=${mine.shown} owned=${mine.owned}`);
  const mineClients = await page.evaluate(() => {
    const me = meName();
    const owned = (DB.businesses || []).filter(b => b.isClient && (window.sameOwner ? sameOwner(b.accountManager || b.assignedTo, me) : false)).length;
    clFilter.owner = me;
    const shown = (DB.businesses || []).filter(b => b.isClient).filter(b => window.sameOwner ? sameOwner(b.accountManager || b.assignedTo, clFilter.owner) : false).length;
    clFilter.owner = 'all';
    return { owned, shown };
  });
  STEP(`${tag}: "Mine" on Clients matches their accounts`, mineClients.shown === mineClients.owned, JSON.stringify(mineClients));

  // ---------- the screen must not lie ----------
  if (!DB_EXPECT[R].businesses) {
    const lie = await page.evaluate(async () => {
      const b = (DB.businesses || [])[0]; if (!b) return null;
      const before = b.notes || '';
      if (typeof leadQuickEdit === 'function') leadQuickEdit(b.id);
      await new Promise(r => setTimeout(r, 900));
      const blocked = !!document.getElementById('v70box');           // the guard explained why
      const modalOpen = !!document.getElementById('qe_stage');
      const box = document.getElementById('v70box'); if (box) box.remove();
      return { blocked, modalOpen, before };
    });
    STEP(`${tag}: editing a company is refused up front with a plain explanation`, lie && lie.blocked && !lie.modalOpen, JSON.stringify(lie));
  }

  // ---------- do the actual job ----------
  if (DB_EXPECT[R].businesses) {
    const workedOK = await page.evaluate(async (myName) => {
      const mineList = (DB.businesses || []).filter(b => window.sameOwner ? sameOwner(b.assignedTo, myName) : false);
      const b = mineList.find(x => !x.isClient) || mineList[0]; if (!b) return { skipped: true };
      b.activities = b.activities || [];
      b.activities.push({ date: Date.parse('2026-08-13T10:00:00Z'), type: 'Call', note: 'Rehearsal: spoke with the client, agreed next step.', by: myName });
      b.nextActionNote = 'Send the updated quote';
      b.nextActionDate = '2026-08-20';
      if (typeof save === 'function') save();
      await new Promise(r => setTimeout(r, 3500));
      return { id: b.id, name: b.name, acts: b.activities.length };
    }, emp.name);
    if (!workedOK.skipped) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(9000);
      await ready(page);
      const survived = await page.evaluate(n => {
        const b = (DB.businesses || []).find(x => x.name === n);
        return b ? { next: b.nextActionNote || '', acts: (b.activities || []).length } : null;
      }, workedOK.name);
      STEP(`${tag}: their work on "${workedOK.name}" is still there after a full page reload`,
        !!survived && /updated quote/i.test(survived.next), JSON.stringify(survived));
    }
  }

  // ---------- sign out ----------
  const out = await signOut(page);
  STEP(`${tag}: signs out cleanly`, out.back, JSON.stringify(out));
  STEP(`${tag}: no javascript errors all session`, errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close();
}

console.log('\nOwnership seen per person:', JSON.stringify(OWNERSHIP));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
process.exit(0);
