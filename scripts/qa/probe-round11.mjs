/* Round 11: access stays live while you work, and Arabic names show on Arabic screens.
   Run: NODE_USE_ENV_PROXY=1 node probe-round11.mjs                                        */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';

const URL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON = 'sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const LOG = []; const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };

const admTok = await (await fetch(URL + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@directksa.com', password: 'Dq7nTest-2026-Riyadh' }),
})).json().then(r => r.access_token);
const H = { apikey: ANON, Authorization: 'Bearer ' + admTok, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const setUser = (email, patch) => fetch(`${URL}/rest/v1/app_users?email=eq.${encodeURIComponent(email)}`, { method: 'PATCH', headers: H, body: JSON.stringify(patch) }).then(r => r.json());

/* ---------- 1. a person is switched off while they are working ---------- */
const m = await openApp(9600);
await signIn(m.page, TEAM.mohammed.email, TEAM.mohammed.pw);
await ready(m.page);
await go(m.page, 'leads', 1200);
STEP('Mohammed is working normally', await m.page.evaluate(() => !!window.__userName));

await setUser(TEAM.mohammed.email, { active: false });
console.log('   (admin switched Mohammed off)');
await m.page.evaluate(() => { try { window.__recheckAccess(); } catch (_) {} });
await m.page.waitForTimeout(2500);
const toldOff = await m.page.evaluate(() => /switched off|أوقفت|إيقاف/i.test(document.body.textContent || ''));
STEP('the app tells him his access was switched off (no silent dead end)', toldOff);
let backToLogin = false;
for (let i = 0; i < 25; i++) { await m.page.waitForTimeout(1000); backToLogin = await m.page.evaluate(() => !!document.querySelector('input[type=email]')); if (backToLogin) break; }
STEP('he is signed out and returned to the login page', backToLogin);

await setUser(TEAM.mohammed.email, { active: true });
const cannotIn = await signIn(m.page, TEAM.mohammed.email, TEAM.mohammed.pw);
STEP('after being switched back on he can sign in again', cannotIn === 'app', cannotIn);
await m.browser.close();

/* ---------- 2. a role change reaches the person without a reload ---------- */
const a = await openApp(9601);
await signIn(a.page, TEAM.assem.email, TEAM.assem.pw);
await ready(a.page);
const before = await a.page.evaluate(() => ({ role: window.__userRole, tier: window.__userTier, canFin: typeof canFinEdit === 'function' ? canFinEdit() : null }));
STEP('Assem starts as a team member who cannot touch finance', before.role === 'team_member' && before.canFin === false, JSON.stringify(before));

await a.page.evaluate(() => { try { window.__recheckAccess(); } catch (_) {} });   // let it learn the current role
await a.page.waitForTimeout(2000);
await setUser(TEAM.assem.email, { role: 'manager' });
console.log('   (admin promoted Assem to manager)');
await a.page.evaluate(() => { try { window.__recheckAccess(); } catch (_) {} });
await a.page.waitForTimeout(3000);
const after = await a.page.evaluate(() => ({ role: window.__userRole, tier: window.__userTier, canFin: typeof canFinEdit === 'function' ? canFinEdit() : null }));
STEP('the promotion reaches him while he works — finance opens up', after.role === 'manager' && after.tier === 'manager' && after.canFin === true, JSON.stringify(after));

await setUser(TEAM.assem.email, { role: 'team_member' });
await a.page.evaluate(() => { try { window.__recheckAccess(); } catch (_) {} });
await a.page.waitForTimeout(3000);
const reverted = await a.page.evaluate(() => ({ role: window.__userRole, canFin: typeof canFinEdit === 'function' ? canFinEdit() : null }));
STEP('and a demotion closes it again just as fast', reverted.role === 'team_member' && reverted.canFin === false, JSON.stringify(reverted));

/* ---------- 3. Arabic names on Arabic screens ---------- */
await a.page.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); current = 'leads'; render(); });
await a.page.waitForTimeout(2500);
await a.page.evaluate(() => { try { window.__localiseNames(); } catch (_) {} });
await a.page.waitForTimeout(800);
const arNames = await a.page.evaluate(() => {
  const t = document.getElementById('view').textContent || '';
  return { arabic: /عاصم السويد|رعد عوض|كريم مدحت|عبدالعزيز الرشودي|محمد التويجري|أحمد أبوالمجد|عثمان الشرفي/.test(t), english: /Assem Alsweed|Raad Awad|Kareem Medhat/.test(t) };
});
STEP('the Arabic view shows staff names in Arabic', arNames.arabic, JSON.stringify(arNames));
await a.page.screenshot({ path: 'shots/r11-arabic-owners.png' }).catch(() => {});

/* the stored value must stay English so filters and reports keep working */
const stored = await a.page.evaluate(() => {
  const b = (DB.businesses || []).find(x => x.assignedTo);
  return b ? b.assignedTo : null;
});
STEP('the stored owner value is still the English name (filters unaffected)', !!stored && /^[A-Za-z]/.test(stored), String(stored));
await a.page.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });

/* ---------- 4. the completed world ---------- */
await go(a.page, 'offers', 2500);
const offers = await a.page.evaluate(() => ({ n: (DB.offers || []).length, refs: (DB.offers || []).map(o => o.ref) }));
STEP('the five proposal-stage leads now have real proposals', offers.n === 5, JSON.stringify(offers.refs));
await go(a.page, 'operations', 2500);
const reqs = await a.page.evaluate(() => ({ n: (DB.requests || []).length, stages: [...new Set((DB.requests || []).map(r => r.stage))] }));
STEP('the operations desk has a real queue across the stages', reqs.n >= 7 && reqs.stages.length >= 4, JSON.stringify(reqs));
await a.page.screenshot({ path: 'shots/r11-operations.png' }).catch(() => {});
await a.browser.close();

console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
process.exit(0);
