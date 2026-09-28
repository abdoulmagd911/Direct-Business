/* probe-d22-access-follows-page-level.mjs (2026-09-28) — D22: every screen check follows the page level a person is
   given in Team & Access (None / View / Full per page), never the role. The role decides only (a) managing people —
   the Team & Access card, the who-can-open-what editor, the team list, deciding about other people's work (KPI targets,
   handing a task to someone else) — and (b) admins, who are always Full everywhere.

   Driven on the stand-in (made-up data; MOCK_ROLE + MOCK_PAGE_ACCESS set the signed-in person's role and grid):
     roles  team_member · manager · operations · viewer · admin
     levels none · view · full, set on finance, settings, activity, documents, leads, offers, reports at once
   Checked in every cell:
     · none → the page's sidebar entry is hidden and opening the page lands on Today;
     · view → the page opens and its write controls are absent or refused —
         Finance: no Import tab, no "Add a rule", no "Add an item name", no expense / proof Add form, finCanWrite() false,
                  calling v117AddRule / expSave changes nothing;
         Settings: locked (body[data-v107-set-ro]) and says so, the "Edit cap…" button gone, the pool-cap editor refuses;
         Activity: the change log shows, Undo refuses (no confirm box);
       and (team_member only, to keep the run short) Generator: no Save/Issue in the Financial proposal editor;
         Leads: no New business / Edit; Proposals: no New proposal; Reports: no Log achievement;
     · full → the same controls are there and the forms open (nothing is saved);
     · admin → Full everywhere whatever levels are set;
     · people management stays with the role: a team member on Full for Settings does NOT get the Team & Access card or
       the access editor; a manager does; a team member on Full for Reports gets no "Set target" (a manager does).
   Sabotage (2026-09-28): put js/45's old canAdd() back (any signed-in tier may add) → the Finance "view" cells go red
   on "no expense Add form". Put js/49's old gateSettings back → every non-admin/manager Settings cell goes red.
   PORTS 9741-9749 (a pool of three sessions at a time uses 9741-9743; 9744-9749 are spare). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const out = [];
const check = (buf, c, m, d) => { if (c) buf.push('  ✓ ' + m); else { failures++; buf.push('  ✗ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); } };

const PAGES = ['finance', 'settings', 'activity', 'documents', 'leads', 'offers', 'reports'];
let mockLock = Promise.resolve();
async function startMock(role, grid, PORT) {
  /* the stand-in reads MOCK_ROLE / MOCK_PAGE_ACCESS when it loads — one load at a time */
  let release; const prev = mockLock; mockLock = new Promise((r) => { release = r; });
  await prev;
  try {
    process.env.MOCK_ROLE = role; process.env.MOCK_KPI_FROM_MONEY = '1';
    process.env.MOCK_PAGE_ACCESS = JSON.stringify(grid);
    const { start } = await import('./mock-supabase.mjs?d22=' + (++seq) + '-' + PORT);
    return start(PORT);
  } finally { release(); }
}

async function session(role, level, PORT) {
  const grid = { today: 'full' }; PAGES.forEach((p) => { grid[p] = level; });
  const srv = await startMock(role, grid, PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && (window.__userRole === 'admin' || !!window.__pageLevels) && (DB.businesses || []).length > 0 && typeof window.finGo === 'function', null, { timeout: 150000 });
  await p.waitForTimeout(2500);
  return { p, b, srv, errors };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };

const go = async (p, page) => { await p.evaluate((pg) => { try { closeModal(); } catch (_) { } openLead = null; current = pg; render(); }, page); await p.waitForTimeout(1600); };
const navState = (p, page) => p.evaluate((pg) => { const b = document.querySelector('#nav button[data-view="' + pg + '"]'); return b ? (b.style.display === 'none' ? 'hidden' : 'shown') : 'absent'; }, page);
const vis = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((el) => el.offsetParent !== null).length, sel);
const modalOpen = (p) => p.evaluate(() => { const o = document.getElementById('ov'); return !!(o && o.classList.contains('show')); });
const closeM = (p) => p.evaluate(() => { try { closeModal(); } catch (_) { } const n = document.getElementById('pfConfirmNo'); if (n) n.click(); });

async function cell(role, level, PORT) {
  const buf = []; const want = role === 'admin' ? 'full' : level;   // admins are Full whatever the grid says
  buf.push(`\n${role} · ${level}${role === 'admin' ? ' (admin → full)' : ''}`);
  const s = await session(role, level, PORT); const p = s.p;
  try {
    const eff = await p.evaluate(() => ({ fin: window.pageLevel('finance'), set: window.pageLevel('settings'), act: window.pageLevel('activity') }));
    check(buf, eff.fin === want && eff.set === want && eff.act === want, 'the screen reads the level the database gave', eff);
    const pages = role === 'team_member' ? PAGES : ['finance', 'settings', 'activity'];
    for (const pg of pages) {
      const nav = await navState(p, pg);
      await go(p, pg);
      const cur = await p.evaluate(() => current);
      if (want === 'none') {
        check(buf, nav !== 'shown', `${pg}: no sidebar entry`, nav);
        check(buf, cur === 'today', `${pg}: opening it lands on Today`, cur);
        continue;
      }
      if (pg !== 'offers') check(buf, nav === 'shown', `${pg}: sidebar entry shown`, nav);
      check(buf, cur === pg, `${pg}: the page opens`, cur);
      const full = want === 'full';
      if (pg === 'finance') {
        const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-fin-tabs] button')].map((b) => b.getAttribute('onclick') || ''));
        check(buf, tabs.some((t) => /finGo\('import'\)/.test(t)) === full, `finance: Import tab ${full ? 'offered' : 'absent'}`, tabs.length);
        check(buf, (await p.evaluate(() => !!window.finCanWrite())) === full, `finance: finCanWrite() is ${full}`);
        await p.evaluate(() => finGo('rules')); await p.waitForTimeout(2200);
        check(buf, ((await vis(p, '[data-v117="add-rule"]')) > 0) === full, `finance → Rules: "Add a rule" ${full ? 'offered' : 'absent'}`);
        check(buf, ((await vis(p, 'button[onclick^="v119AddItem("]')) > 0) === full, `finance → Rules: "Add an item name" ${full ? 'offered' : 'absent'}`);
        await p.evaluate(() => { try { v117AddRule(); } catch (_) { } }); await p.waitForTimeout(400);
        check(buf, (await modalOpen(p)) === full, `finance → Rules: v117AddRule() ${full ? 'opens its form' : 'opens nothing'}`); await closeM(p);
        await p.evaluate(() => finGo('expenses')); await p.waitForTimeout(2000);
        check(buf, ((await vis(p, '#xp_date')) > 0) === full, `finance → Expenses: the Add form ${full ? 'is there' : 'is absent'}`);
        await p.evaluate(() => finGo('proofs')); await p.waitForTimeout(2000);
        check(buf, ((await vis(p, '#pf_type')) > 0) === full, `finance → Payment proofs: the Add form ${full ? 'is there' : 'is absent'}`);
        if (!full) {
          const before = await p.evaluate(() => (window.__notices || []).length);
          const wrote = await p.evaluate(async () => { let n = 0; const o = window.fetch; window.fetch = function (u, init) { if (/finance_expenses|proof_documents/.test(String(u)) && init && init.method && init.method !== 'GET') n++; return o.apply(this, arguments); };
            try { expSave(); proofSave(); } catch (_) { } await new Promise((z) => setTimeout(z, 600)); window.fetch = o; return n; });
          check(buf, wrote === 0, 'finance: expSave() / proofSave() write nothing on View', { wrote, before });
        }
      } else if (pg === 'settings') {
        await p.waitForTimeout(800);
        const st = await p.evaluate(() => ({ ro: document.body.hasAttribute('data-v107-set-ro'), banner: !!document.querySelector('#view .v107-set-banner'),
          editCap: [...document.querySelectorAll('#view button[onclick^="v25OpenPoolSettings("]')].filter((el) => el.offsetParent !== null).length > 0 }));
        check(buf, st.ro === !full && st.banner === !full, `settings: ${full ? 'not locked' : 'locked, and says so'}`, st);
        check(buf, st.editCap === full, `settings: the credit-pool "Edit cap…" button ${full ? 'offered' : 'gone'}`, st.editCap);
        await p.evaluate(() => { try { v25OpenPoolSettings(); } catch (_) { } }); await p.waitForTimeout(500);
        check(buf, (await modalOpen(p)) === full, `settings: the credit-pool cap editor ${full ? 'opens' : 'refuses'}`); await closeM(p);
        /* people management stays with the role */
        const pm = await p.evaluate(() => ({ card: !!document.querySelector('#view .v48-card'), matrix: !!document.querySelector('#axHost select, #axHost button[onclick^="axSave("]') }));
        const mgr = role === 'admin' || role === 'manager';
        check(buf, pm.card === mgr, `settings: the Team & Access card follows the role (${mgr ? 'shown' : 'hidden'} for ${role})`, pm);
        check(buf, pm.matrix === mgr, `settings: the who-can-open-what editor follows the role (${mgr ? 'shown' : 'hidden'} for ${role})`, pm);
      } else if (pg === 'activity') {
        await p.waitForTimeout(1200);
        const a = await p.evaluate(() => ({ log: !!window.changeLogVisible(), closed: !!document.querySelector('[data-v63-log-closed]'), rows: document.querySelectorAll('#view [data-hist-id]').length, undo: [...document.querySelectorAll('#view button[onclick^="undoRecordChange("]')].length }));
        /* which rows come back is the database's answer (the other half of D22); the screen must show the log, not close it */
        check(buf, a.log && !a.closed, 'activity: the change log shows (not the "closed" card)', a);
        if (!full) check(buf, a.undo === 0, 'activity: no Undo button on View', a.undo);
        await p.evaluate(() => { try { undoRecordChange(1, function () { }); } catch (_) { } }); await p.waitForTimeout(500);
        const box = await p.evaluate(() => !!document.getElementById('pfConfirmBox'));   /* a fixed box has no offsetParent */
        check(buf, box === full, `activity: Undo ${full ? 'asks to confirm' : 'is refused before it asks'}`, box); await closeM(p);
      } else if (pg === 'documents') {
        await p.evaluate(() => { try { dgGo('offer'); } catch (_) { } }); await p.waitForTimeout(3000);
        const btns = await p.evaluate(() => [...document.querySelectorAll('#view button')].filter((b) => b.offsetParent !== null).map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /^(Save|Issue)/i.test(t)));
        check(buf, (btns.length > 0) === full, `documents: Save/Issue ${full ? 'offered' : 'absent'} in the Financial proposal editor`, btns);
      } else if (pg === 'leads') {
        const n = await vis(p, '#view button[onclick*="editBusiness("], #view button[onclick*="leadQuickEdit("]');
        check(buf, (n > 0) === full, `leads: New business / Edit ${full ? 'offered' : 'absent'}`, n);
      } else if (pg === 'offers') {
        const n = await vis(p, '#view button[onclick*="newOffer("]');
        check(buf, (n > 0) === full, `offers: New proposal ${full ? 'offered' : 'absent'}`, n);
      } else if (pg === 'reports') {
        const n = await vis(p, '#view button[onclick*="rptOpenAch("]');
        check(buf, (n > 0) === full, `reports: Log achievement ${full ? 'offered' : 'absent'}`, n);
      }
    }
    /* deciding about other people's work stays with the role: "Set target" is for a manager (or admin) with Full on
       Reports — never a team member, whatever their level */
    if (role === 'team_member' && level === 'full' || role === 'manager' && level === 'full' || role === 'admin' && level === 'none') {
      await go(p, 'reports'); await p.evaluate(() => { try { rptGo('objectives'); } catch (_) { } }); await p.waitForTimeout(2500);
      const n = await vis(p, '#view button[onclick^="v112Target("]');
      const mgr = role !== 'team_member';
      check(buf, (n > 0) === mgr, `reports: "Set target" (others' work) follows the role — ${mgr ? 'offered to ' + role : 'not offered to a team member on Full'}`, n);
    }
    check(buf, !s.errors.length, 'no JS errors', s.errors.slice(0, 3));
  } catch (e) { failures++; buf.push('  ✗ cell crashed — ' + (e && e.message)); }
  await done(s);
  out.push(buf.join('\n'));
  console.log(buf.join('\n'));
}

(async () => {
  const jobs = [];
  for (const role of ['team_member', 'manager', 'operations', 'viewer', 'admin']) for (const level of ['none', 'view', 'full']) jobs.push([role, level]);
  const ports = [9741, 9742, 9743]; let i = 0;
  await Promise.all(ports.map(async (port) => { while (i < jobs.length) { const j = jobs[i++]; await cell(j[0], j[1], port); } }));
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS — every screen check follows the page level; the role decides only people management and admins');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
