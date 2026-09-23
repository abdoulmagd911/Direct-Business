/* probe-an-access-change-asks-first.mjs — changing a colleague's access asks before it happens,
   and a Cancel changes nothing at all.

   Fire #224. Driven on the live Team & Access panel: switching a colleague's account off, or
   changing their level, fired on the FIRST click with nothing asked. This app already asks before
   deleting something as small as a service level (pfConfirm), and an access change is not smaller
   than that — a switched-off account cannot sign in.

   What this round also established, and what is worth knowing before anyone "hardens" this panel
   again: the danger that looks obvious here — switching YOURSELF off, or demoting yourself — is
   already refused by the SERVER, by name ("You cannot change your own role." / "You cannot switch
   off your own access."), and probe-share-and-settings-attacks drives that refusal through these
   very controls to prove the screen handles a refusal honestly. A first version of this fire hid
   those controls on your own row; that was redundant with the server rule and it deleted the
   guard's subject, so it was taken out again and the reasoning left in js/31. Since the server
   refuses self-switch-off, at least one admin always survives, so a "last admin" rule would be
   redundant too.

   The roster here is synthetic and served by this probe — the live panel lists real colleagues by
   name and address (rule 7).

   What this holds, in the order it prints:
     1. switching an account off asks first, and the question names the person;
     2. changing a level asks first, and the question names the person and the new level;
     3. cancelling leaves THAT select exactly where it was — not showing a level nobody chose;
     4. nothing at all reached the server while cancelling;
     5. confirming DOES send it — the question is a question, not a way of quietly doing nothing;
     6. Arabic: the question is asked in Arabic;
     7. the brake carried from fire #119: a stored level the picker does not offer stays selected,
        so none of this quietly promotes somebody on the next save;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · calling the action straight from onclick again — fails 1, 2, 3, 4 and 6, and 4 prints the
       two writes that would have gone out unasked;
     · asking, but never sending on Confirm — fails 5, which is the check that stops a "fix" that
       merely swallows the action.
   Run: node scripts/qa/probe-an-access-change-asks-first.mjs                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9252 — one mock. */
const PORT = 9252; const BASE = 'http://localhost:' + PORT;
const ME = 'test@directksa.com';

const roster = [
  { id: 'u_me',    email: ME,                      full_name: 'QA Admin One',    role: 'admin',       active: true },
  { id: 'u_other', email: 'qa.two@example.test',   full_name: 'QA Person Two',   role: 'team_member', active: true },
  { id: 'u_third', email: 'qa.three@example.test', full_name: 'QA Person Three', role: 'manager',     active: true },
  { id: 'u_odd',   email: 'qa.four@example.test',  full_name: 'QA Person Four',  role: 'viewer',      active: true },
];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const open = async (lang) => {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  const sent = [];
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname.startsWith('/functions/v1/admin-users')) {
      const body = String(rq.postData() || '');
      if (!/"action"\s*:\s*"list"/.test(body)) { sent.push(body.slice(0, 80));
        await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); return; }
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ users: roster, caller_role: 'admin' }) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
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
  await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', ME); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate((me) => { try { window.__userEmail = me; window.__userRole = 'admin'; current = 'settings'; openLead = null; render(); } catch (_) {} }, ME);
  await p.waitForTimeout(1800);
  await p.evaluate(() => { try { if (window.v48Users) window.v48Users(); } catch (_) {} });
  await p.waitForTimeout(3500);
  return { ctx, p, errors, sent };
};
/* click a control, wait for the box, read it, then answer */
const askAndAnswer = (p, how, answer) => p.evaluate(([h, ans]) => {
  const lb = document.getElementById('v48list');
  const row = [...lb.children].find((r) => /QA Person Two/.test(r.innerText || ''));
  if (!row) return Promise.resolve({ noRow: true });
  let was = null;
  if (h === 'tog') { const b2 = row.querySelector('[data-tog]'); if (!b2) return Promise.resolve({ noControl: true }); b2.click(); }
  else { const s = row.querySelector('select[data-role]'); if (!s) return Promise.resolve({ noControl: true });
    was = s.value; s.value = 'manager'; s.dispatchEvent(new Event('change', { bubbles: true })); }
  return new Promise((res) => setTimeout(() => {
    const d = document.getElementById('pfConfirmBox');
    const text = d ? (d.innerText || '').replace(/\s+/g, ' ').trim() : null;
    const btn = document.getElementById(ans === 'yes' ? 'pfConfirmYes' : 'pfConfirmNo');
    if (btn) btn.click();
    setTimeout(() => {
      const s2 = row.querySelector('select[data-role]');
      res({ text: text, was: was, nowShows: s2 ? s2.value : null });
    }, 700);
  }, 1000));
}, [how, answer]);

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d && d !== '[]' ? ' — ' + d : ''));

const A = await open('en');
const togCancel = await askAndAnswer(A.p, 'tog', 'no');
const roleCancel = await askAndAnswer(A.p, 'role', 'no');
const sentAfterCancel = A.sent.slice();
const roleConfirm = await askAndAnswer(A.p, 'role', 'yes');
const odd = await A.p.evaluate(() => {
  const lb = document.getElementById('v48list');
  const row = [...lb.children].find((r) => /QA Person Four/.test(r.innerText || ''));
  const s = row && row.querySelector('select[data-role]');
  return s ? { v: s.value, n: s.options.length } : null;
});
const sentAfterConfirm = A.sent.slice();
await A.ctx.close();

const B_ = await open('ar');
const arBox = await askAndAnswer(B_.p, 'tog', 'no');
await B_.ctx.close();
await b.close(); srv.close?.();

const isAr = (s) => /[؀-ۿ]/.test(String(s || ''));
(togCancel.text && /QA Person Two/.test(togCancel.text) && /sign in|switch/i.test(togCancel.text))
  ? pass('switching an account off asks first, and names the person', JSON.stringify(togCancel.text.slice(0, 66)))
  : fail('switching an account off asks first, and names the person', JSON.stringify(togCancel));
(roleCancel.text && /QA Person Two/.test(roleCancel.text) && /Manager/i.test(roleCancel.text))
  ? pass('changing a level asks first, and names the person and the level', JSON.stringify(roleCancel.text.slice(0, 66)))
  : fail('changing a level asks first, and names the person and the level', JSON.stringify(roleCancel));
(roleCancel.nowShows === roleCancel.was && roleCancel.was)
  ? pass('cancelling leaves that select where it was', JSON.stringify({ was: roleCancel.was, shows: roleCancel.nowShows }))
  : fail('cancelling leaves that select where it was', JSON.stringify(roleCancel));
(sentAfterCancel.length === 0)
  ? pass('nothing reached the server while cancelling')
  : fail('nothing reached the server while cancelling', JSON.stringify(sentAfterCancel));
(sentAfterConfirm.some((x) => /set_role/.test(x) && /manager/.test(x)))
  ? pass('confirming does send it', JSON.stringify(sentAfterConfirm.slice(-1)))
  : fail('confirming does send it', JSON.stringify({ sent: sentAfterConfirm, box: roleConfirm }));
(arBox.text && isAr(arBox.text))
  ? pass('Arabic: the question is asked in Arabic', JSON.stringify(arBox.text.slice(0, 50)))
  : fail('Arabic: the question is asked in Arabic', JSON.stringify(arBox));
(odd && odd.v === 'viewer')
  ? pass('brake: a level the picker does not offer stays selected (fire #119)', JSON.stringify(odd))
  : fail('brake: a level the picker does not offer stays selected (fire #119)', JSON.stringify(odd));
const errs = A.errors.concat(B_.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));
process.exit(bad.length ? 1 : 0);
