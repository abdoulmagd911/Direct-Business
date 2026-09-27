/* probe-tasks-to-achievements.mjs (2026-09-27) — Tasks → Achievements, ready for real use (the owner's order of 26 Sep,
   part 3), driven as an EMPLOYEE (Tasks full, Reports own) the way the day goes: make a task, finish it, see it count.
   The database side is attacked on Postgres by scripts/qa/phase3 TA-01..TA-04; the stand-in models the same trigger.

   Under test:
     1. a client task with no company is refused in the form, which STAYS OPEN with the title still typed (it used to
        close and lose everything); chosen Internal, it is created and the form closes;
     2. finished with "count it in the monthly report" + a kind, it is on Reports → Achievements at once — no reload
        (the achievements list used to load once per page load);
     3. the task's title changed afterwards → the achievement's title follows;
     4. the task reopened → its achievement is withdrawn from the list;
     5. a task finished WITHOUT counting, then ticked to count → it is registered then;
     6. a draft achievement is listed with its Draft tag but not counted in the Overview totals (final ones are);
     7. the task list has a Team column; 8. no JS errors.
   PORT 9641 (free when written).                                                                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0; const errors = [];
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
process.env.MOCK_ROLE = 'team_member'; process.env.MOCK_TASKS_ROSTER = '1';
process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', tasks: 'full', reports: 'own' });
process.env.MOCK_REPORTS_SEED = JSON.stringify([{ title: 'QA final seed', status: 'final', entry_date: '2026-09-10' }, { title: 'QA draft seed', status: 'draft', entry_date: '2026-09-11', source: 'task' }]);
const { start } = await import('./mock-supabase.mjs'); const srv = start(9641); const BASE = 'http://localhost:9641';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 180000 }); await p.waitForTimeout(2500);

const tasks = async () => { await p.evaluate(() => { current = 'tasks'; openLead = null; render(); }); await p.waitForFunction(() => window.__v108State && window.__v108State.loaded, { timeout: 30000 }); await p.waitForTimeout(400); };
const achTitles = async () => { await p.evaluate(() => { current = 'reports'; openLead = null; render(); rptGo('achievements'); }); await p.waitForTimeout(1500);
  return p.evaluate(() => document.getElementById('view').innerText); };
const openTask = async (title) => { await tasks(); await p.evaluate((t) => { const x = window.__v108State.tasks.find((k) => k.title === t); v108Open(x.id); }, title); await p.waitForSelector('#v108e_title', { timeout: 10000 }); };
const modalOpen = () => p.evaluate(() => document.getElementById('ov').classList.contains('show'));

/* 1 */
await tasks(); await p.evaluate(() => v108NewTask()); await p.waitForSelector('#v108_title');
await p.fill('#v108_title', 'QA deal follow-up'); await p.selectOption('#v108_type', 'sales'); await p.selectOption('#v108_biz', '');
await p.click('#mSave'); await p.waitForTimeout(500);
const m1 = await p.evaluate(() => (document.getElementById('v108_formmsg') || {}).textContent || '');
const kept = await p.evaluate(() => (document.getElementById('v108_title') || {}).value);
check(/needs a company or a project/.test(m1) && (await modalOpen()) && kept === 'QA deal follow-up', 'a client task with no company is refused in the form, which stays open with the title kept', m1 + ' | ' + kept);
await p.selectOption('#v108_type', 'internal'); await p.click('#mSave'); await p.waitForTimeout(1200);
const made = await p.evaluate(() => window.__v108State.tasks.some((t) => t.title === 'QA deal follow-up'));
check(made && !(await modalOpen()), 'chosen Internal, the task is created and the form closes');

/* 2 */
await openTask('QA deal follow-up');
await p.selectOption('#v108e_status', 'done'); await p.check('#v108e_rep'); await p.selectOption('#v108e_repcat', 'cat-deals');
await p.click('#mSave'); await p.waitForTimeout(1500);
const a2 = await achTitles();
check(/QA deal follow-up/.test(a2), 'finished and counted, the task is on Reports → Achievements at once — no reload', a2.slice(0, 200));
/* 3 */
await openTask('QA deal follow-up'); await p.fill('#v108e_title', 'QA deal signed'); await p.click('#mSave'); await p.waitForTimeout(1500);
const a3 = await achTitles();
check(/QA deal signed/.test(a3) && !/QA deal follow-up/.test(a3), "the task's new title reaches its achievement");
/* 4 */
await openTask('QA deal signed'); await p.selectOption('#v108e_status', 'in_progress'); await p.click('#mSave'); await p.waitForTimeout(1500);
const a4 = await achTitles();
check(!/QA deal signed/.test(a4), 'reopened, the task\'s achievement is withdrawn');
/* 5 */
await tasks(); await p.evaluate(() => v108NewTask()); await p.waitForSelector('#v108_title');
await p.fill('#v108_title', 'QA internal done later'); await p.selectOption('#v108_type', 'internal'); await p.click('#mSave'); await p.waitForTimeout(1200);
await openTask('QA internal done later'); await p.selectOption('#v108e_status', 'done'); await p.click('#mSave'); await p.waitForTimeout(1200);
const a5a = await achTitles();
await openTask('QA internal done later'); await p.check('#v108e_rep'); await p.selectOption('#v108e_repcat', 'cat-other'); await p.click('#mSave'); await p.waitForTimeout(1500);
const a5b = await achTitles();
check(!/QA internal done later/.test(a5a) && /QA internal done later/.test(a5b), 'a task finished without counting, then ticked to count, is registered then');
/* 6 */
await p.evaluate(() => { current = 'reports'; openLead = null; render(); rptGo('achievements'); }); await p.waitForTimeout(1200);
const listed = await p.evaluate(() => ({ draft: !!document.querySelector('[data-v111-draft]'), text: document.getElementById('view').innerText }));
await p.evaluate(() => { rptGo('overview'); }); await p.waitForTimeout(1200);
const total = await p.evaluate(() => { const n = window.__rptDB.achievements.filter((a) => a._status !== "draft").length; const all = window.__rptDB.achievements.length;
  const chip = [...document.querySelectorAll('#view .chip')].find((c) => /Achievements logged/.test(c.innerText)); const tile = chip ? Number(chip.querySelector('.v').textContent) : null;
  return { n, all, tile, shows: tile === n }; });
check(listed.draft && /QA draft seed/.test(listed.text) && total.n === total.all - 1 && total.shows, 'a draft is listed with its Draft tag and left out of the Overview totals', JSON.stringify(total));
/* 7 */
await tasks(); await p.evaluate(() => v108Status('all')); await p.waitForTimeout(300);
const col = await p.evaluate(() => [...document.querySelectorAll('table.v108-tasks thead th')].map((t) => t.textContent));
check(col.includes('Team'), 'the task list has a Team column', col.join(','));
check(errors.length === 0, 'no JS errors', errors.slice(0, 3).join(' | '));
await b.close(); srv.close?.();
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — a task becomes an achievement the way the day goes');
process.exit(failures ? 1 : 0);
