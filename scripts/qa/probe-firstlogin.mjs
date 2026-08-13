/* Real first-login rehearsal: each employee receives a temporary password from the admin,
   signs in, is forced to choose their own password, and lands in the app.
   Run: NODE_USE_ENV_PROXY=1 node probe-firstlogin.mjs                                   */
import { openApp, signIn, setOwnPassword, ready, signOut, TEAM } from './emp-rig.mjs';

const TEMP = {
  othman:   'Dammam6846&',
  raad:     'Jeddah3064%',
  kareem:   'Dammam7698%',
  assem:    'Riyadh3479!',
  mohammed: 'Hail3882$',
};

const LOG = []; const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };
let port = 9100;

for (const key of Object.keys(TEMP)) {
  const emp = TEAM[key];
  const { browser, page, errs } = await openApp(port++);
  const st = await signIn(page, emp.email, TEMP[key]);
  STEP(`${emp.name}: temporary password signs in and forces a new one`, st === 'firstlogin', st);
  if (st === 'firstlogin') {
    // a too-short password must be refused
    await page.locator('#fl_pw1').fill('short'); await page.locator('#fl_pw2').fill('short');
    await page.locator('#fl_go').click(); await page.waitForTimeout(800);
    const refused = await page.evaluate(() => { const e = document.getElementById('cl_err'); return !!e && e.style.display !== 'none' && !!document.getElementById('fl_pw1'); });
    STEP(`${emp.name}: a weak password is refused with a clear message`, refused);
    // mismatch must be refused
    await page.locator('#fl_pw1').fill(emp.pw); await page.locator('#fl_pw2').fill(emp.pw + 'x');
    await page.locator('#fl_go').click(); await page.waitForTimeout(800);
    const mism = await page.evaluate(() => { const e = document.getElementById('cl_err'); return !!e && /match/i.test(e.textContent) && !!document.getElementById('fl_pw1'); });
    STEP(`${emp.name}: mismatched repeat is refused`, mism);
    const landed = await setOwnPassword(page, emp.pw);
    STEP(`${emp.name}: own password saved and lands straight in the app`, landed);
  }
  await ready(page);
  const who = await page.evaluate(() => ({ name: window.__userName || '', tier: window.__userTier || '', mail: window.__userEmail || '' }));
  STEP(`${emp.name}: app knows who signed in (${emp.role})`, who.name === emp.name, JSON.stringify(who));
  const out = await signOut(page);
  STEP(`${emp.name}: sign out returns to the login page`, out.back, JSON.stringify(out));
  // the new password must work on the SECOND sign-in, and the forced screen must not return
  const st2 = await signIn(page, emp.email, emp.pw);
  STEP(`${emp.name}: signs back in with their own password (no forced screen again)`, st2 === 'app', st2);
  if (errs.length) STEP(`${emp.name}: no javascript errors during login`, false, errs.slice(0, 2).join(' | '));
  else STEP(`${emp.name}: no javascript errors during login`, true);
  await browser.close();
}

console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
process.exit(0);
