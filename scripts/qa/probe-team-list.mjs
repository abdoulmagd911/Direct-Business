/* probe-team-list.mjs (2026-09-25) — Team & Access → the team list (js/110), driven as each role.

   The database rule (scripts/sql/team-list-editing.sql, tested on Postgres by scripts/qa/phase3 T-01..T-04):
   an admin or a manager may add a person, move them between departments, set a department's head and make
   someone active or inactive; nobody else changes anything; a head must be active and cannot be made
   inactive until replaced. The stand-in models it (MOCK_TEAMLIST=1). Under test:
     MANAGER
       1. the Team list section is on Settings, listing the people, their departments, who heads what;
       2. moving a person to another department is saved and said, and recorded in the history;
       3. making the Commercial head inactive is refused in the database's own words, and they stay active;
       4. setting someone else as head, then making the old head inactive, works; they read "Inactive";
       5. only active logins not yet on the list are offered to add (an inactive login is not); adding one
          puts them on the list;
     EMPLOYEE (even with Full control on Settings)
       6. no Team list section — and a write sent straight to the database changes nothing;
     7. in Arabic the section is Arabic; 8. no JS errors.
   Sabotage: make js/110's canManage() answer true always — check 6 goes red.
   PORT = 9361 … 9363 (free when written).                                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const allErrors = [];

async function session(role, PORT, { lang = 'en' } = {}) {
  process.env.MOCK_ROLE = role; process.env.MOCK_TEAMLIST = '1';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', settings: 'full' });
  delete globalThis.__TL;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  p.on('pageerror', (e) => allErrors.push(role + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { openLead = null; current = 'settings'; render(); });
  await p.waitForTimeout(2500);
  return { p, b, srv, BASE };
}
const state = (p) => p.evaluate(() => {
  const host = document.getElementById('v110Host');
  if (!host) return null;
  const rows = [...host.querySelectorAll('tr[data-v110-member]')].map((r) => ({ id: r.getAttribute('data-v110-member'), t: r.innerText.replace(/\s+/g, ' ').trim(), dep: (r.querySelector('select') || {}).value }));
  const msg = host.querySelector('[data-v110-msg]');
  const add = document.getElementById('v110AddWho');
  return { rows, text: host.innerText, msg: msg ? { kind: msg.getAttribute('data-v110-msg'), t: msg.innerText } : null,
    addable: add ? [...add.options].map((o) => o.textContent).filter(Boolean) : [] , dir: getComputedStyle(host).direction };
});
const settle = (p) => p.waitForTimeout(1200);

async function main() {
  // ---------------- MANAGER ----------------
  {
    const { p, b, srv, BASE } = await session('manager', 9361);
    try {
      let s = await state(p);
      if (s && s.rows.length === 2 && /First Person/.test(s.text) && /Heads Commercial/.test(s.text)) ok('1. a manager sees the Team list: two people, their departments, and who heads Commercial');
      else fail('1. the Team list is not drawn for a manager as expected: ' + JSON.stringify(s && { n: s.rows.length, t: s.text.slice(0, 200) }));

      await p.evaluate(() => v110SetDept('tm-2', 'dep-partnership')); await settle(p);
      s = await state(p);
      const hist = await fetch(BASE + '/rest/v1/record_history?select=table_name,record_id').then((r) => r.json()).catch(() => []);
      const moved = s.rows.find((r) => r.id === 'tm-2');
      if (moved && moved.dep === 'dep-partnership' && s.msg && s.msg.kind === 'ok' && /Department changed/.test(s.msg.t) && hist.some((h) => h.table_name === 'team_members' && h.record_id === 'tm-2'))
        ok('2. moving Second Person to Partnership is saved, said on screen, and recorded in the history');
      else fail('2. the department move: ' + JSON.stringify({ moved, msg: s.msg, hist: hist.length }));

      await p.evaluate(() => v110SetActive('tm-1', false)); await settle(p);
      s = await state(p);
      const head = s.rows.find((r) => r.id === 'tm-1');
      if (s.msg && s.msg.kind === 'err' && /heads Commercial — choose a new head first/.test(s.msg.t) && head && /Active/.test(head.t) && !/Inactive/.test(head.t))
        ok('3. making the Commercial head inactive is refused in the database\'s words, and they stay active');
      else fail('3. deactivating a head: ' + JSON.stringify({ msg: s.msg, head }));

      await p.evaluate(() => v110SetHead('dep-commercial', 'tm-2')); await settle(p);
      await p.evaluate(() => v110SetActive('tm-1', false)); await settle(p);
      s = await state(p);
      const gone = s.rows.find((r) => r.id === 'tm-1'); const newHead = s.rows.find((r) => r.id === 'tm-2');
      if (gone && /Inactive/.test(gone.t) && newHead && /Heads Commercial/.test(newHead.t)) ok('4. with a new Commercial head set, the old head is made inactive — "Inactive" with the leaving date');
      else fail('4. head change then deactivate: ' + JSON.stringify({ gone, newHead, msg: s.msg }));

      const offered = s.addable.join(' | ');
      if (/Not Listed Yet/.test(offered) && !/Left Company/.test(offered) && !/First Person|Second Person/.test(offered)) ok('5a. only active logins not yet on the list are offered to add — not an inactive login, not anyone already listed');
      else fail('5a. the add list offers: ' + offered);
      await p.selectOption('#v110AddWho', 'tl-u3'); await p.evaluate(() => v110Add()); await settle(p);
      s = await state(p);
      if (s.rows.some((r) => /Not Listed Yet/.test(r.t)) && s.msg && /Added to the team list/.test(s.msg.t)) ok('5b. adding them puts them on the list, and says so');
      else fail('5b. add: ' + JSON.stringify({ n: s.rows.length, msg: s.msg }));
    } finally { await b.close(); srv.close(); }
  }

  // ---------------- EMPLOYEE (Full control on Settings) ----------------
  {
    const { p, b, srv } = await session('team_member', 9362);
    try {
      /* Settings may be closed to an employee altogether; draw the section there anyway, so this checks
         js/110's own decision and not only the page gate in front of it */
      /* …and read in the same breath: the page gate sends an employee elsewhere and redraws, which would
         wipe a wrongly drawn section before a later look could catch it */
      const onSettings = true;
      const s = await p.evaluate(() => { current = 'settings'; openLead = null; window.__v110Paint(); return document.getElementById('v110Host') ? 'drawn' : null; });
      const direct = await p.evaluate(async () => {
        const c = window.fc && fc(); if (!c) return 'no client';
        const r = await c.from('team_members').update({ active: false }).eq('id', 'tm-2').select();
        const i = await c.from('team_members').insert({ user_id: 'tl-u3', department_id: 'dep-business' }).select();
        const after = await c.from('team_members').select('id,active');
        return { upd: (r.data || []).length, ins: i.error ? 'refused' : 'accepted', stillActive: (after.data || []).find((x) => x.id === 'tm-2').active, n: (after.data || []).length };
      });
      if (onSettings && !s && direct.upd === 0 && direct.ins === 'refused' && direct.stillActive && direct.n === 2) ok('6. an employee (even on Full control for Settings) sees no Team list, and a write sent straight to the database changes nothing');
      else fail('6. employee: ' + JSON.stringify({ onSettings, drawn: !!s, direct }));
    } finally { await b.close(); srv.close(); }
  }

  // ---------------- Arabic ----------------
  {
    const { p, b, srv } = await session('admin', 9363, { lang: 'ar' });
    try {
      const s = await state(p);
      /* a person's own name stays as written when they have no Arabic one — strip names and e-mails, then look */
      const names = await p.evaluate(async () => { const r = await fc().from('team_directory').select('full_name'); return (r.data || []).map((x) => x.full_name).filter(Boolean); });
      let bare = s ? s.text.replace(/[\w.+-]+@[\w.-]+/g, '') : '';
      names.forEach((n) => { bare = bare.split(n).join(''); });
      const latin = s ? (bare.match(/[A-Za-z]{3,}/g) || []) : ['(not drawn)'];
      if (s && /قائمة الفريق/.test(s.text) && /يرأس/.test(s.text) && s.dir === 'rtl' && !latin.length) ok('7. in Arabic the section is Arabic and right to left (names and e-mails aside)');
      else fail('7. Arabic: ' + JSON.stringify({ dir: s && s.dir, latin: latin.slice(0, 8) }));
    } finally { await b.close(); srv.close(); }
  }

  const real = allErrors.filter((e) => !/net::ERR_|TUNNEL_CONNECTION/.test(e));
  if (!real.length) ok('8. no JS errors'); else fail('8. JS errors: ' + JSON.stringify(real.slice(0, 3)));
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nteam-list OK — admins and managers keep the team list; the database refuses everyone else');
}
main().catch((e) => { console.error(e); process.exit(1); });
