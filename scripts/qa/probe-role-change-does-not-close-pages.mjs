/* probe-role-change-does-not-close-pages.mjs — guards the 2026-09-18 (fire #85) change in js/56.
   Found by driving Settings › "Who can open what" against the live database with the write intercepted,
   in English and in Arabic: the database's page_access(p) reads ONLY the per-person boxes for anyone who
   is not an admin (the level plays no part), and js/52 does the same on screen once a matrix exists —
   and every live non-admin has one. So changing the one live manager to Employee left all TEN of their
   pages exactly as they were, INCLUDING Finance, Settings and Activity & Audit, the three the database
   itself enforces. The screen said "Role updated" and nothing else, so an admin demoting somebody to
   take Settings away would have believed they had.
   Nothing about the behaviour was changed — closing pages by surprise would silently undo access an
   admin granted on purpose. What changed is that the screen now says which half decides what: a
   standing line in every non-admin card, and, after a level change, a sentence naming how many pages
   the person still opens and which of the database-enforced ones are among them.
   Sabotage-tested: with the js/56 edit stashed, 3 checks go FAIL, exit 1 (no standing line, and no
   note in the card after the change — the old code toasted "Role updated" and nothing more).
   Run: node scripts/qa/probe-role-change-does-not-close-pages.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9064;
/* the live shape this reproduces: a non-admin whose per-person boxes hold more than their level's floor,
   including two of the three pages the database enforces. The QA admin stays an admin (admins are not
   in the matrix), and the ids are the mock's own. */
const MATRIX = { today: 'editor', leads: 'editor', clients: 'editor', finance: 'editor', settings: 'editor', activity: 'viewer', events: 'editor' };
const srv = start(PORT, { app_users: [
  /* the QA account keeps the mock's own uid — the sign-in resolves the roster row by auth.uid(),
     so a made-up id here leaves the admin unrecognised and the panel never paints at all */
  { id: '11111111-1111-1111-1111-111111111111', email: 'test@directksa.com', full_name: 'QA Test Account', role: 'admin', active: true, created_at: '2026-08-08T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: null },
  { id: 'u-matrix', email: 'matrix.person@example.com', full_name: 'Matrix Person', role: 'manager', active: true, created_at: '2026-08-09T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: MATRIX },
] });
const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const b2 = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await b2.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const natives = []; p.on('dialog', async (d) => { natives.push(d.message()); await d.dismiss(); });
let sent = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  if (/^\/rest\/v1\/app_users/.test(u.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(m)) {
    /* answer the way the database would, without letting the mock's roster change under the screen */
    const body = rq.postData() || ''; sent.push({ m, search: u.search, body });
    let echo = []; try { const j = JSON.parse(body); echo = (Array.isArray(j) ? j : [j]).map((x) => Object.assign({ id: 'u-matrix' }, x)); } catch (_) { }
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(echo) }); return;
  }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.axSetRole === 'function', { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(3000);
await p.evaluate(() => { try { current = 'settings'; render(); } catch (_) { } });
let panel = false; for (let i = 0; i < 30 && !panel; i++) { await p.waitForTimeout(700); panel = await p.evaluate(() => { const h = document.getElementById('axHost'); return !!h && h.querySelectorAll('.ax-card').length > 0; }); }

const card = await p.evaluate(() => { const c = Array.from(document.querySelectorAll('#axHost .ax-card')).find((x) => (x.innerHTML || '').includes('u-matrix'));
  if (!c) return null; const sels = Array.from(c.querySelectorAll('select'));
  return { role: sels[0] ? sels[0].value : null, pages: sels.slice(1).filter((s) => s.value !== 'none').length,
    standingLine: /changing the level does not close a page/i.test(c.innerText || '') }; });

/* the real drive: an admin changes that person's level through the real dropdown */
sent = [];
const after = await p.evaluate(async () => { const c = Array.from(document.querySelectorAll('#axHost .ax-card')).find((x) => (x.innerHTML || '').includes('u-matrix'));
  const sel = c && c.querySelector('select'); if (!sel) return null;
  sel.value = 'team_member'; sel.dispatchEvent(new Event('change'));
  await new Promise((r) => setTimeout(r, 2500));
  const c2 = Array.from(document.querySelectorAll('#axHost .ax-card')).find((x) => (x.innerHTML || '').includes('u-matrix'));
  const sels = c2 ? Array.from(c2.querySelectorAll('select')) : [];
  const nt = c2 && c2.querySelector('.ax-levelnote');
  return { role: sels[0] ? sels[0].value : null, pages: sels.slice(1).filter((s) => s.value !== 'none').length,
    /* the sentence must be IN that person's card, not a toast that vanishes in 2.4 seconds */
    said: nt ? (nt.innerText || '').replace(/\s+/g, ' ') : '', toastText: (document.getElementById('v19toast') || {}).innerText || '' }; });
await b.close(); srv.close?.();

const said = (after && after.said) || '';
let body = {}; try { body = JSON.parse((sent[0] || {}).body || '{}'); } catch (_) { }
const checks = [
  ['the drive really happened — a real non-admin card was found and its level changed', !!card && !!after && after.role === 'team_member' && sent.length === 1],
  ['the level change sends only the level, filtered to that one person', Object.keys(body).length === 1 && body.role === 'team_member' && ((sent[0] || {}).search || '').includes('u-matrix')],
  ['the pages that person opens are genuinely unchanged — the level does not close one', !!card && !!after && card.pages === after.pages && card.pages >= 5],
  ['after the change that person\'s own card says the level did not close a page, and how many are still open', /does not close a page|لا يُغلق أي صفحة/.test(said) && /still opens|لا يزال يفتح/.test(said)],
  ['the card names the database-enforced pages the person kept, and the new level by name', /Finance/.test(said) && /Settings/.test(said) && /Employee|موظف/.test(said)],
  ['every non-admin card carries the standing line about which half decides what', !!card && card.standingLine === true],
  ['no native browser box was used for any of it', natives.length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ card, after: after && { role: after.role, pages: after.pages }, sent, natives, card_note: said.slice(0, 320), toast: after && after.toastText })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
