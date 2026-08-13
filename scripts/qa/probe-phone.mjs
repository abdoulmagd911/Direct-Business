/* The phone pass: every role, on an iPhone-sized screen, against the live backend.
   Most of the team will open this on a phone — so nothing may run off the edge, every
   page must be reachable, and the things each role is allowed to do must still be usable.
   Run: NODE_USE_ENV_PROXY=1 node probe-phone.mjs                                          */
import { openApp, signIn, ready, go, signOut, TEAM } from './emp-rig.mjs';

const LOG = []; const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };
const PAGES = ['today', 'leads', 'clients', 'offers', 'ops', 'reports', 'finance'];
const ORDER = ['othman', 'raad', 'kareem', 'assem', 'mohammed'];
let port = 9700;

for (const key of ORDER) {
  const emp = TEAM[key], tag = `${emp.name.split(' ')[0]} (${emp.role}) on a phone`;
  console.log(`\n———————— ${tag} ————————`);
  const { browser, page, errs } = await openApp(port++, { phone: true });

  /* the login form itself must work on a phone */
  const loginFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  STEP(`${tag}: the sign-in screen fits the phone`, loginFits, 'w=' + await page.evaluate(() => document.documentElement.scrollWidth));
  const st = await signIn(page, emp.email, emp.pw);
  STEP(`${tag}: signs in`, st === 'app', st);
  if (st !== 'app') { await browser.close(); continue; }
  await ready(page);
  await page.screenshot({ path: `shots/phone-${key}-today.png` });

  /* every page: nothing may run off the right edge, and the page must actually have content */
  const bad = [];
  for (const p of PAGES) {
    await go(page, p, 1800);
    if (p === 'finance') {   // the ledger loads from the network — wait for it like a person would
      await page.waitForFunction(() => window.FIN && FIN.rows, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    const r = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      len: ((document.getElementById('view') || {}).textContent || '').trim().length,
    }));
    if (r.over > 4) bad.push(`${p} +${r.over}px`);
    if (r.len < 40) bad.push(`${p} empty`);
  }
  STEP(`${tag}: no page runs off the edge of the screen`, bad.length === 0, bad.join(', '));

  /* the top bar must stay inside the screen and the profile chip must be reachable */
  await go(page, 'today', 1200);
  const bar = await page.evaluate(() => {
    const chip = document.getElementById('v68me');
    if (!chip) return { chip: false };
    const r = chip.getBoundingClientRect();
    return { chip: true, inside: r.right <= window.innerWidth + 1 && r.left >= -1, w: Math.round(r.width), right: Math.round(r.right), vw: window.innerWidth };
  });
  STEP(`${tag}: the profile chip is fully on screen`, bar.chip && bar.inside, JSON.stringify(bar));

  /* the menu behind the chip must open and fit */
  await page.evaluate(() => { const c = document.getElementById('v68me'); if (c) c.click(); });
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() => {
    const m = document.getElementById('v68menu'); if (!m) return { open: false };
    const r = m.getBoundingClientRect();
    return { open: true, inside: r.right <= window.innerWidth + 1 && r.left >= -1 && r.bottom <= window.innerHeight + 60 };
  });
  STEP(`${tag}: the profile menu opens inside the screen`, menu.open && menu.inside, JSON.stringify(menu));
  await page.screenshot({ path: `shots/phone-${key}-menu.png` });
  await page.evaluate(() => { const m = document.getElementById('v68menu'); if (m) m.remove(); });

  /* open a company card — the thing everyone does most */
  await go(page, 'leads', 1800);
  const card = await page.evaluate(async () => {
    const b = (DB.businesses || []).find(x => !x.isClient); if (!b) return null;
    openLead = b.id; render();
    await new Promise(r => setTimeout(r, 1400));
    return { over: document.documentElement.scrollWidth - window.innerWidth, len: (document.getElementById('view').textContent || '').length, name: b.name };
  });
  STEP(`${tag}: a company card opens and fits`, !!card && card.over <= 4 && card.len > 200, JSON.stringify(card));
  await page.screenshot({ path: `shots/phone-${key}-card.png` });

  /* role-specific: the one thing this person does every day */
  if (emp.role === 'manager') {
    await page.evaluate(() => { openLead = null; current = 'finance'; render(); });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { try { finGo('expenses'); } catch (_) {} });
    await page.waitForTimeout(2000);
    const form = await page.evaluate(() => {
      const d = document.getElementById('xp_desc'); if (!d) return { form: false };
      const r = d.getBoundingClientRect();
      return { form: true, inside: r.right <= window.innerWidth + 1, over: document.documentElement.scrollWidth - window.innerWidth };
    });
    STEP(`${tag}: the add-expense form is usable on a phone`, form.form && form.inside && form.over <= 4, JSON.stringify(form));
    await page.screenshot({ path: `shots/phone-${key}-expenses.png` });
  }
  if (emp.role === 'operations') {
    await page.evaluate(() => { openLead = null; current = 'ops'; render(); });
    await page.waitForTimeout(2200);
    const ops = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, reqs: (DB.requests || []).length, len: (document.getElementById('view').textContent || '').length }));
    STEP(`${tag}: the requests desk is readable on a phone`, ops.over <= 4 && ops.reqs >= 7 && ops.len > 200, JSON.stringify(ops));
    await page.screenshot({ path: `shots/phone-${key}-operations.png` });
  }
  if (emp.role === 'viewer' || emp.role === 'operations') {
    /* the "you can't change this" message must fit a phone screen */
    await page.evaluate(() => { openLead = null; current = 'leads'; render(); });
    await page.waitForTimeout(1400);
    const refusal = await page.evaluate(async () => {
      const b = (DB.businesses || [])[0];
      if (typeof leadQuickEdit === 'function') leadQuickEdit(b.id);
      await new Promise(r => setTimeout(r, 900));
      const box = document.getElementById('v70box'); if (!box) return { shown: false };
      const c = box.firstElementChild.getBoundingClientRect();
      const ok = c.right <= window.innerWidth + 1 && c.left >= -1 && c.height < window.innerHeight;
      return { shown: true, fits: ok };
    });
    STEP(`${tag}: the "you can't change this" message fits the phone`, refusal.shown && refusal.fits, JSON.stringify(refusal));
    await page.screenshot({ path: `shots/phone-${key}-refusal.png` });
    await page.evaluate(() => { const b = document.getElementById('v70box'); if (b) b.remove(); });
  }

  /* Arabic, right-to-left, on a phone */
  await page.evaluate(() => { openLead = null; LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); current = 'leads'; render(); });
  await page.waitForTimeout(2500);
  const ar = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, arabic: /العملاء|اليوم|المالية/.test(document.body.textContent || '') }));
  STEP(`${tag}: the Arabic view fits the phone too`, ar.over <= 4 && ar.arabic, JSON.stringify(ar));
  await page.screenshot({ path: `shots/phone-${key}-arabic.png` });
  await page.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });

  /* signing out from a phone */
  const out = await signOut(page);
  STEP(`${tag}: can sign out from the phone`, out.back, JSON.stringify(out));
  STEP(`${tag}: no javascript errors on the phone`, errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close();
}

console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
process.exit(0);
