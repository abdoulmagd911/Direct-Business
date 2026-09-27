/* probe-people-and-teams.mjs (2026-09-27) — People & teams (js/114), driven as a manager, an employee, in Arabic, and
   through the task form's team picker. The owner's order of 26 Sep, part 2; the database side is attacked on Postgres by
   scripts/qa/phase3 PT-01..PT-08; the stand-in (MOCK_PEOPLE=1) carries the same rules and the database's own words.

   Under test:
     MANAGER (English)
       1. "People & teams" is in the menu and STAYS there (read every second — the lesson of probe-the-menu-keeps-its-pages);
          the page lists the teams in the agreed order, under Commercial, and the people;
       2. adding a team with no Arabic name is refused in the database's words; with both names it is added;
       3. a team is renamed;
       4. Retire asks where its open work goes; the answer counts what moved; the team leaves the active list, shows among the
          retired, and can be brought back;
       5. editing a person: a blank Arabic first name is refused in the form; ticking their HOME team as a team they assist is
          refused in the database's words; a valid save shows the assisted team and the reports-to in the table;
       6. a page level changed in the person form is saved (set_page_levels) and reads back;
       7. Invite creates the login and saves the names and home team in one go, and says the temporary password;
     EMPLOYEE
       8. no menu entry (over time); opening the page by address shows the refusal; a person_save sent straight to the
          database is refused;
     ARABIC (manager)
       9. the page is right to left, the team names Arabic;
     TASK FORM (admin, on the team list)
      10. the new-task team picker offers the owner's home team first (selected), then the teams they assist; choosing
          another owner re-orders it to THAT person's home team and assisted teams;
      11. no JS errors anywhere.
   PORT 9621–9624 (free when written).                                                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0; const errors = [];
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

async function session(role, PORT, lang, extra = {}) {
  process.env.MOCK_ROLE = role; process.env.MOCK_PEOPLE = '1'; delete globalThis.__PEOPLE;
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', tasks: 'full', reports: 'own', settings: role === 'team_member' ? 'full' : 'full' });
  Object.assign(process.env, extra);
  const { start } = await import('./mock-supabase.mjs?people=' + (++seq)); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p.on('pageerror', (e) => errors.push(role + '/' + lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 180000 });
  await p.waitForTimeout(2500);
  return { p, b, srv };
}
const open = async (p) => { await p.evaluate(() => { current = 'people'; openLead = null; render(); }); await p.waitForFunction(() => document.querySelector('[data-v114-teams]') || document.querySelector('[data-v114-refused]'), { timeout: 20000 }).catch(() => { }); await p.waitForTimeout(400); };
const text = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, sel);
const settle = (p) => p.waitForTimeout(900);
const navSeries = async (p) => { const out = []; for (let i = 0; i < 6; i++) { out.push(await p.evaluate(() => { const b = document.getElementById('v114NavBtn'); return !!(b && b.offsetParent !== null && getComputedStyle(b).display !== 'none'); })); if (i === 2) await p.evaluate(() => { current = 'leads'; render(); }); await p.waitForTimeout(1000); } return out; };

/* ---------------- MANAGER, English ---------------- */
{
  const { p, b, srv } = await session('manager', 9621, 'en');
  const nav = await navSeries(p);
  check(nav.every(Boolean), 'manager: "People & teams" is in the menu and stays there, through a redraw', nav.map((x) => x ? '■' : '·').join(''));
  await open(p);
  const order = await p.evaluate(() => [...document.querySelectorAll('[data-v114-team]')].map((r) => r.getAttribute('data-v114-team')).join(','));
  check(order === 'business,business_solutions,partnership,tenders,quality,complaints,strategy,integrity', 'manager: the teams are listed in the agreed order', order);
  const dep = await p.evaluate(() => (document.querySelector('.v114 .note') || {}).innerText || '');
  check(/Department: Commercial/.test(dep), 'manager: the department (Commercial) and its head are shown above the teams', dep.slice(0, 80));
  const ppl = await p.evaluate(() => document.querySelectorAll('[data-v114-person]').length);
  check(ppl >= 4, `manager: the people are listed (${ppl})`);

  /* 2 — add a team */
  await p.fill('#v114_team_en', 'Key Accounts'); await p.click('button[onclick="v114AddTeam()"]'); await settle(p);
  const t1 = await text(p, '[data-v114-msg]');
  check(/name in English and in Arabic/.test(t1), 'manager: a team with no Arabic name is refused (said on the page)', t1);
  await open(p); await p.fill('#v114_team_en', 'Key Accounts'); await p.fill('#v114_team_ar', 'الحسابات الرئيسية'); await p.click('button[onclick="v114AddTeam()"]'); await settle(p);
  const added = await p.evaluate(() => !!document.querySelector('[data-v114-team="key_accounts"]'));
  check(added, 'manager: a team with both names is added and listed');
  /* 3 — rename */
  await p.evaluate(() => { const r = document.querySelector('[data-v114-team="key_accounts"]'); r.querySelector('button').click(); });
  await p.waitForSelector('#v114_ren_en'); await p.fill('#v114_ren_en', 'Key Accounts & Partners'); await p.click('#mSave'); await settle(p);
  const ren = await text(p, '[data-v114-team="key_accounts"]');
  check(/Key Accounts & Partners/.test(ren), 'manager: the team is renamed', ren.slice(0, 60));
  /* 4 — retire Quality (one open task), move to Tenders; then bring it back */
  await p.click('[data-v114-retire="quality"]'); await p.waitForSelector('#v114_move_to');
  await p.selectOption('#v114_move_to', 'dep-tenders'); await p.click('#mSave'); await settle(p);
  const rmsg = await text(p, '[data-v114-for="teams"]');
  const gone = await p.evaluate(() => !document.querySelector('[data-v114-team="quality"]'));
  check(/Retired “Quality”: 1 open task/.test(rmsg) && gone, 'manager: Retire moves its open work (counted in the answer) and the team leaves the active list', rmsg);
  await p.evaluate(() => v114ToggleRetired()); await settle(p);
  const listed = await text(p, '[data-v114-retired]');
  await p.evaluate(() => { const r = [...document.querySelectorAll('[data-v114-retired] div')].find((d) => /Quality/.test(d.innerText)); r.querySelector('button').click(); }); await settle(p);
  const back = await p.evaluate(() => !!document.querySelector('[data-v114-team="quality"]'));
  check(/Quality/.test(listed) && back, 'manager: a retired team is listed as retired and can be brought back', listed);

  /* 5 — edit Sara */
  await p.click('[data-v114-edit="sara.one@example.test"]'); await p.waitForSelector('#v114_fe');
  await p.fill('#v114_fa', ''); await p.click('#mSave'); await p.waitForTimeout(300);
  const m1 = await text(p, '#v114_msg');
  check(/first name is needed in English and in Arabic/.test(m1), 'manager: a blank Arabic first name is refused in the form', m1);
  await p.fill('#v114_fa', 'سارة'); await p.fill('#v114_le', 'One-Smith');
  await p.check('[data-v114-assist="dep-business"]');   /* her HOME team */
  await p.click('#mSave'); await settle(p);
  const m2 = await text(p, '#v114_msg');
  check(/already their home team/.test(m2), 'manager: ticking her home team as a team she assists is refused in the database\'s words', m2);
  await p.uncheck('[data-v114-assist="dep-business"]'); await p.check('[data-v114-assist="dep-tenders"]'); await p.selectOption('#v114_rep', 'pm-head');
  await p.click('#mSave'); await settle(p); await settle(p);
  const row = await text(p, '[data-v114-person="sara.one@example.test"]');
  check(/Sara One-Smith/.test(row) && /Tenders/.test(row) && /Head Person/.test(row), 'manager: the saved person shows the new name, the assisted team and the reports-to', row.slice(0, 160));
  /* 6 — page level */
  await p.click('[data-v114-edit="sara.one@example.test"]'); await p.waitForSelector('[data-v114-level="tasks"]');
  await p.selectOption('[data-v114-level="tasks"]', 'view'); await p.click('#mSave'); await settle(p); await settle(p);
  await p.click('[data-v114-edit="sara.one@example.test"]'); await p.waitForSelector('[data-v114-level="tasks"]');
  const lvl = await p.evaluate(() => document.querySelector('[data-v114-level="tasks"]').value);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });
  check(lvl === 'view', 'manager: a page level changed in the person form is saved and reads back', lvl);
  /* 7 — invite */
  await p.click('[data-v114-invite]'); await p.waitForSelector('#v114_email');
  await p.fill('#v114_email', 'new.person@example.test'); await p.fill('#v114_fe', 'Nour'); await p.fill('#v114_le', 'Three'); await p.fill('#v114_fa', 'نور'); await p.fill('#v114_la', 'ثلاثة');
  await p.selectOption('#v114_home', 'dep-business_solutions'); await p.click('#mSave'); await settle(p); await settle(p);
  const inv = await text(p, '[data-v114-for="people"]'); const irow = await text(p, '[data-v114-person="new.person@example.test"]');
  check(/Invited new\.person@example\.test/.test(inv) && /Temporary password/.test(inv) && /Business Solutions/.test(irow) && /Nour Three/.test(irow), 'manager: Invite creates the login, saves names and home team, and says the temporary password', inv.slice(0, 120) + ' | ' + irow.slice(0, 80));
  await b.close(); srv.close?.();
}

/* ---------------- EMPLOYEE ---------------- */
{
  const { p, b, srv } = await session('team_member', 9622, 'en');
  const nav = await navSeries(p);
  check(nav.every((x) => !x), 'employee: no "People & teams" in the menu, ever', nav.map((x) => x ? '■' : '·').join(''));
  await open(p);
  const refused = await p.evaluate(() => !document.querySelector('[data-v114-teams]') && (!!document.querySelector('[data-v114-refused]') || current !== 'people'));
  check(refused, 'employee: opening the page by address shows no teams or people');
  const direct = await p.evaluate(async () => { const c = fc(); const r = await c.rpc('person_save', { p_user: 'pp-sara', p: { first_name_en: 'Hijack', first_name_ar: 'x' } }); return r.error ? r.error.message : 'saved'; });
  check(/Only an admin or a manager can change people/.test(direct), 'employee: a person_save sent straight to the database is refused', direct);
  await b.close(); srv.close?.();
}

/* ---------------- ARABIC (manager) ---------------- */
{
  const { p, b, srv } = await session('manager', 9623, 'ar');
  await open(p);
  const r = await p.evaluate(() => ({ dir: (document.querySelector('.v114') || {}).dir, bd: (document.querySelector('[data-v114-team="business"]') || {}).innerText || '', title: document.getElementById('vTitle').textContent }));
  check(r.dir === 'rtl' && /تطوير الأعمال/.test(r.bd) && r.title === 'الأشخاص والفرق', 'Arabic: the page runs right to left, with the Arabic title and team names', JSON.stringify(r).slice(0, 160));
  await b.close(); srv.close?.();
}

/* ---------------- TASK FORM picker (admin on the team list) ---------------- */
{
  const { p, b, srv } = await session('admin', 9624, 'en', { MOCK_TASKS_ROSTER: '1' });
  await p.evaluate(() => { current = 'tasks'; openLead = null; render(); });
  await p.waitForFunction(() => window.__v108State && window.__v108State.loaded && window.teamOptionsReady && window.teamOptionsReady(), { timeout: 30000 }).catch(() => { });
  await p.evaluate(() => v108NewTask()); await p.waitForSelector('#v108_team', { timeout: 10000 }).catch(() => { });
  const first = await p.evaluate(() => { const s = document.getElementById('v108_team'); if (!s) return null; return { groups: [...s.querySelectorAll('optgroup')].map((g) => g.label + ':' + [...g.children].map((o) => o.textContent).join('/')), sel: s.options[s.selectedIndex] && s.options[s.selectedIndex].textContent }; });
  check(first && /^Home team:Business Development$/.test(first.groups[0]) && first.sel === 'Business Development', 'task form: the owner\'s home team comes first and is chosen', JSON.stringify(first));
  await p.selectOption('#v108_owner', 'pm-omar'); await p.waitForTimeout(200);
  const omar = await p.evaluate(() => [...document.getElementById('v108_team').querySelectorAll('optgroup')].map((g) => g.label + ':' + [...g.children].map((o) => o.textContent).join('/')));
  check(/^Home team:Partnerships$/.test(omar[0]) && /^Teams they assist:Tenders$/.test(omar[1]), 'task form: choosing another owner re-orders the teams to theirs (home, then assisted)', JSON.stringify(omar));
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });
  await b.close(); srv.close?.();
}
check(errors.length === 0, 'no JS errors', errors.slice(0, 3).join(' | '));
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — People & teams: teams, people, invite, levels, the pickers, and the refusals');
process.exit(failures ? 1 : 0);
