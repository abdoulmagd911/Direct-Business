/* probe-tasks-page.mjs (2026-09-25, Phase 3 release 1) — the Tasks page, driven as each level.

   The page (js/108) offers only what the database's answer for the Tasks page allows; the stand-in
   models the release-1 rules (none → no rows; view → reads, writes refused; own → your tasks; full →
   anyone's, the D7 default). Under test:
     FULL employee (the D7 default)
       1. "Tasks" is in the menu; the list shows the seeded tasks, "Mine" shows only their own;
       2. a new internal task is created and comes back with the database's TSK code;
       3. client work with no company and no project is refused in the database's own words, and
          nothing is added to the list;
       4. a COLLEAGUE's task opens editable (D7: anyone helps) and a status change is saved;
       5. a checklist step and an update are added to a task;
     OWN employee
       6. a new task is offered; a colleague's task opens read-only (fields locked, no Save), their own
          opens editable;
     VIEW employee
       7. "View only" is said, no New button, and a task opens read-only;
     NO ACCESS
       8. no "Tasks" in the menu;
     the Today card (js/109)
       9. changes a colleague made to your task are on Today; clicking opens that task on the Tasks page;
     10. in Arabic the page is Arabic and right to left; 11. no JS errors anywhere.
   Sabotage: make js/108's canWork() answer true always — check 7 goes red (View is offered "New").
   PORT = 9347 … 9352 (free when written).                                                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const allErrors = [];

async function session(tasksLevel, PORT, { lang = 'en', changes = null } = {}) {
  process.env.MOCK_ROLE = 'team_member'; process.env.MOCK_TASKS_ROSTER = '1';
  const grid = { today: 'full', leads: 'full', clients: 'full' };
  if (tasksLevel) grid.tasks = tasksLevel;
  process.env.MOCK_PAGE_ACCESS = JSON.stringify(grid);
  if (changes) process.env.MOCK_TASK_CHANGES = JSON.stringify(changes); else delete process.env.MOCK_TASK_CHANGES;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  p.on('pageerror', (e) => allErrors.push(tasksLevel + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.waitForTimeout(2500);
  return { p, b, srv };
}
const openTasks = async (p) => {
  await p.evaluate(() => { current = 'tasks'; openLead = null; render(); });
  await p.waitForFunction(() => window.__v108State && window.__v108State.loaded, { timeout: 20000 }).catch(() => { });
  await p.waitForTimeout(400);
};
const listTitles = (p) => p.evaluate(() => [...document.querySelectorAll('#view table.v108-tasks tbody tr')].map((r) => r.querySelector('b').textContent));
const navHas = (p) => p.evaluate(() => { const b = document.getElementById('v108NavBtn'); return !!(b && getComputedStyle(b).display !== 'none'); });
const openTask = async (p, title) => {
  await p.evaluate((t) => { const s = window.__v108State; const x = s.tasks.find((k) => k.title === t); if (x) v108Open(x.id); }, title);
  await p.waitForTimeout(700);
  return p.evaluate(() => {
    const m = document.getElementById('modal'); const sv = document.getElementById('mSave');
    return { open: document.getElementById('ov').classList.contains('show'), title: document.getElementById('v108e_title') ? !document.getElementById('v108e_title').disabled : null,
      save: !!(sv && sv.offsetParent !== null), hasCard: !!(m && m.querySelector('.v108-card')) };
  });
};

/* ---------------- FULL ---------------- */
{
  const { p, b, srv } = await session('full', 9347);
  /* the menu is rebuilt after sign-in by several layers; on a crowded machine the button can arrive a
     few seconds late — wait for it (up to 15 s) rather than reading at one fixed moment */
  const navShown = await p.waitForFunction(() => { const b = document.getElementById('v108NavBtn'); return !!(b && getComputedStyle(b).display !== 'none'); }, { timeout: 15000 }).then(() => true).catch(() => false);
  navShown ? ok('full: "Tasks" is in the menu') : fail('full: no Tasks menu button');
  await openTasks(p);
  const mine = await listTitles(p);
  await p.evaluate(() => v108Mine(false)); const all = await listTitles(p);
  (mine.length === 1 && mine[0] === 'QA seed task' && all.includes('Colleague seed task') && all.includes('QA seed task'))
    ? ok('full: "Mine" shows only their own task; "Everyone\'s" shows both') : fail('full lists: mine=' + JSON.stringify(mine) + ' all=' + JSON.stringify(all));
  /* 2 — create an internal task */
  await p.evaluate(() => v108NewTask()); await p.waitForTimeout(300);
  await p.fill('#v108_title', 'Probe internal task'); await p.selectOption('#v108_type', 'internal'); await p.click('#mSave');
  await p.waitForFunction(() => window.__v108State.tasks.some((t) => t.title === 'Probe internal task'), { timeout: 10000 }).catch(() => { });
  const made = await p.evaluate(() => { const t = window.__v108State.tasks.find((k) => k.title === 'Probe internal task'); return t ? t.code : null; });
  /^TSK-2026-\d{3}$/.test(made || '') ? ok('full: a new internal task comes back with the database\'s code (' + made + ')') : fail('full: new task not created — ' + made);
  /* 3 — client work with no company or project */
  const before = await p.evaluate(() => window.__v108State.tasks.length);
  const toasts = [];
  await p.exposeFunction('__probeToast', (m) => toasts.push(m));
  await p.evaluate(() => { const t = window.toast; window.toast = function (m) { try { window.__probeToast(String(m)); } catch (_) { } return t ? t.apply(this, arguments) : undefined; }; });
  await p.evaluate(() => v108NewTask()); await p.waitForTimeout(300);
  await p.fill('#v108_title', 'Probe client task, no company'); await p.selectOption('#v108_type', 'sales'); await p.click('#mSave');
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => window.__v108State.tasks.length);
  (after === before && toasts.some((m) => /Client work needs a company or a project/.test(m)))
    ? ok('full: client work with no company or project is refused in the database\'s words; nothing added') : fail('full: guard — tasks ' + before + '→' + after + ', said ' + JSON.stringify(toasts));
  /* 4 — a colleague's task, edited (D7) */
  const col = await openTask(p, 'Colleague seed task');
  await p.selectOption('#v108e_status', 'waiting'); await p.click('#mSave'); await p.waitForTimeout(1200);
  const st = await p.evaluate(() => window.__v108State.tasks.find((k) => k.title === 'Colleague seed task').status);
  (col.title === true && col.save && st === 'waiting') ? ok('full: a colleague\'s task opens editable (D7) and the status change is saved') : fail('full: colleague task ' + JSON.stringify(col) + ' status=' + st);
  /* 5 — checklist and update */
  await openTask(p, 'QA seed task');
  await p.fill('#v108_newcheck', 'Probe step'); await p.evaluate(() => v108AddCheck()); await p.waitForTimeout(900);
  await p.fill('#v108_newcomment', 'Probe update'); await p.evaluate(() => v108AddComment()); await p.waitForTimeout(900);
  const card = await p.evaluate(() => document.getElementById('modal').innerText);
  (/Probe step/.test(card) && /Probe update/.test(card)) ? ok('full: a checklist step and an update are added to the task') : fail('full: checklist/update not shown');
  try { await p.evaluate(() => closeModal()); } catch (_) { }
  await b.close(); srv.close?.();
}

/* ---------------- OWN ---------------- */
{
  const { p, b, srv } = await session('own', 9348);
  await openTasks(p); await p.evaluate(() => v108Mine(false));
  const newBtn = await p.evaluate(() => !!document.querySelector('#view [data-v108-new="task"]'));
  const col = await openTask(p, 'Colleague seed task'); try { await p.evaluate(() => closeModal()); } catch (_) { }
  const mine = await openTask(p, 'QA seed task'); try { await p.evaluate(() => closeModal()); } catch (_) { }
  (newBtn && col.title === false && !col.save && mine.title === true && mine.save)
    ? ok('own: New is offered; a colleague\'s task opens read-only, their own opens editable') : fail('own: new=' + newBtn + ' colleague=' + JSON.stringify(col) + ' mine=' + JSON.stringify(mine));
  await b.close(); srv.close?.();
}

/* ---------------- VIEW ---------------- */
{
  const { p, b, srv } = await session('view', 9349);
  await openTasks(p);
  const s = await p.evaluate(() => ({ banner: /View only/.test(document.getElementById('view').innerText), newBtn: !!document.querySelector('#view [data-v108-new]') }));
  const t = await openTask(p, 'QA seed task'); try { await p.evaluate(() => closeModal()); } catch (_) { }
  (s.banner && !s.newBtn && t.title === false && !t.save) ? ok('view: "View only" is said, no New, and a task opens read-only') : fail('view: ' + JSON.stringify(s) + ' task=' + JSON.stringify(t));
  await b.close(); srv.close?.();
}

/* ---------------- NONE ---------------- */
{
  const { p, b, srv } = await session(null, 9350);
  !(await navHas(p)) ? ok('no access: "Tasks" is not in the menu') : fail('no access: Tasks menu button shown');
  await b.close(); srv.close?.();
}

/* ---------------- Today card + Arabic ---------------- */
{
  const now = Date.now();
  const changes = [{ history_id: 9, at: new Date(now - 3600e3).toISOString(), actor_name: 'Colleague Seed', table_name: 'tasks', action: 'edit',
    task_id: 'task-qa', task_code: 'TSK-2026-001', task_title: 'QA seed task', before_row: { status: 'todo' }, after_row: { status: 'in_progress' } }];
  const { p, b, srv } = await session('full', 9351, { changes });
  await p.evaluate(() => { current = 'today'; render(); });
  await p.waitForSelector('#view .v109-changes', { timeout: 20000 }).catch(() => null);
  await p.waitForTimeout(1600);
  await p.waitForSelector('#view .v109-changes', { timeout: 20000 }).catch(() => null);
  const txt = await p.evaluate(() => { const c = document.querySelector('#view .v109-changes'); return c ? c.innerText : null; });
  if (txt) await p.click('#view .v109-changes [data-v109-open]', { timeout: 10000 }).catch(() => null);
  await p.waitForTimeout(2000);
  const opened = await p.evaluate(() => ({ cur: current, card: !!document.querySelector('#modal [data-v108-open="task-qa"]') }));
  (txt && /Colleague Seed/.test(txt) && /TSK-2026-001/.test(txt) && /Status/.test(txt) && opened.cur === 'tasks' && opened.card)
    ? ok('Today: a colleague\'s change to your task is on Today, and one click opens that task') : fail('Today card: ' + JSON.stringify(txt) + ' opened=' + JSON.stringify(opened));
  await b.close(); srv.close?.();

  const ar = await session('full', 9352, { lang: 'ar' });
  await openTasks(ar.p);
  const a = await ar.p.evaluate(() => { const v = document.querySelector('#view .v108'); return { dir: v && v.getAttribute('dir'), text: v ? v.innerText : '' }; });
  (a.dir === 'rtl' && /مهمة جديدة|المهام/.test(a.text)) ? ok('Arabic: the Tasks page is Arabic and right to left') : fail('Arabic: ' + JSON.stringify({ dir: a.dir, text: a.text.slice(0, 80) }));
  await ar.b.close(); ar.srv.close?.();
}

allErrors.length === 0 ? ok('no JS errors') : fail('JS errors: ' + allErrors.slice(0, 3).join(' | '));
console.log(failures ? 'FAILED — ' + failures : 'tasks-page OK — the Tasks page offers exactly what each level allows, and Today tells the owner');
process.exit(failures ? 1 : 0);
