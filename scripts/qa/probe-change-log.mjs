/* probe-change-log.mjs (2026-09-27) — the change log on every record (owner decision 2 of 27 Sep; js/115, js/63; the database
   side is scripts/sql/change-log-and-qa-account.sql, attacked on Postgres by scripts/qa/phase3 CL-01..CL-04, R1-03, PT-04).

   The harness cannot run the live trigger, so the log lines are planted the way the trigger writes them (a company edit
   that changes its name and, inside its raw record, its stage; and its creation); the stand-in derives record_changes
   from them the way the live view does, and answers admins and managers only, as the live read rule does.
   Under test:
     ADMIN (English)
       1. the company page's "Recent changes" card has a "Full change log" button; it opens a window with one entry per
          change — when, who, what — and for the edit one line per FIELD with before and after: the name, and the stage
          INSIDE the raw record (not the whole record); the creation is folded ("N field(s)"); the window closes;
       2. every line of Activity & Audit has a "Log" button that opens that record's change log;
       3. a task's window (js/108) and a person's Edit window (js/114) carry a "Change log" button in their title bar,
          which opens on top without closing the window underneath;
     MANAGER
       4. the manager sees the same card button and the log's lines;
     TEAM MEMBER
       5. Activity & Audit says the log is for admins and managers (not an empty "No activity"); the company page draws no
          "Recent changes" card; the log read straight from the database returns nothing; openChangeLog says so in words;
     ARABIC (admin)
       6. the window runs right to left, titled «سجل التغييرات», fields in Arabic words;
     7. no JS errors anywhere.
   PORT 9631–9634.
   Sabotage: in js/115 make canSee() return true for everyone — check 5's words go red; in the stand-in drop the raw.*
   derivation — check 1's stage line goes red.                                                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0; const errors = [];
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const UUID = 'aaaaaaaa-0000-4000-8000-000000000040';
const H = { 'content-type': 'application/json', apikey: 'x', authorization: 'Bearer x', prefer: 'return=representation' };

async function session(role, PORT, lang) {
  process.env.MOCK_ROLE = role; process.env.MOCK_PEOPLE = '1'; delete globalThis.__PEOPLE;
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', tasks: 'full', reports: 'own', activity: 'full', settings: 'full' });
  const { start } = await import('./mock-supabase.mjs?changelog=' + (++seq)); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  await fetch(`${BASE}/rest/v1/businesses?id=eq.b40`, { method: 'PATCH', headers: H, body: JSON.stringify({ id: UUID }) });
  const plant = (row) => fetch(`${BASE}/rest/v1/record_history`, { method: 'POST', headers: H, body: JSON.stringify(row) });
  await plant({ table_name: 'businesses', record_id: UUID, record_key: UUID, action: 'create', actor_name: 'QA Account', before_row: null,
    after_row: { id: UUID, name: 'Test Company 40', stage: 'new', raw: { stage: 'New' } } });
  await plant({ table_name: 'businesses', record_id: UUID, record_key: UUID, action: 'edit', actor_name: 'Othman',
    before_row: { id: UUID, name: 'Test Company 40', stage: 'new', updated_at: '2026-09-27T10:00:00Z', raw: { stage: 'New', notes: 'x' } },
    after_row: { id: UUID, name: 'Test Company 40 Ltd', stage: 'new', updated_at: '2026-09-27T11:00:00Z', raw: { stage: 'Contacted', notes: 'x' } } });
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
  await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && window.__roleKnown === true && (DB.businesses || []).some((x) => x.id === 'L40'), null, { timeout: 180000 });
  await p.waitForTimeout(3000);
  return { p, b, srv };
}
const openCompany = async (p) => { await p.evaluate(() => { openLead = 'L40'; current = 'leads'; leadDetailView = 'detail'; render(); }); await p.waitForTimeout(2500); };
const logWin = (p) => p.evaluate(() => { const w = document.querySelector('#v115-ov [data-v115-log]'); const ov = document.getElementById('v115-ov');
  return w && ov && ov.style.display !== 'none' ? { dir: w.getAttribute('dir'), text: w.innerText.replace(/\s+/g, ' '), events: +((w.querySelector('[data-v115-events]') || {}).getAttribute ? w.querySelector('[data-v115-events]').getAttribute('data-v115-events') : 0),
    fields: [...w.querySelectorAll('[data-v115-field]')].map((r) => ({ f: r.getAttribute('data-v115-field'), cells: [...r.querySelectorAll('td')].map((td) => td.innerText.trim()) })) } : null; });
const waitLog = (p) => p.waitForFunction(() => { const w = document.querySelector('#v115-ov [data-v115-log]'); return w && !/Loading…|جارٍ التحميل/.test(w.innerText); }, null, { timeout: 15000 }).catch(() => { });

/* ---------------- ADMIN, English ---------------- */
{
  const { p, b, srv } = await session('admin', 9631, 'en');
  await openCompany(p);
  const btn = await p.evaluate(() => !!document.querySelector('#view .v63-record-hist [data-v115-open]'));
  check(btn, 'admin: the company\'s "Recent changes" card has a "Full change log" button');
  await p.evaluate(() => document.querySelector('#view .v63-record-hist [data-v115-open]').click()); await waitLog(p);
  const w = await logWin(p);
  const name = w && w.fields.find((x) => x.f === 'name'), stage = w && w.fields.find((x) => x.f === 'raw.stage');
  check(w && w.events === 2, 'admin: the window lists both changes to the company (its creation and the edit)', JSON.stringify(w && { events: w.events }));
  check(name && name.cells[1] === 'Test Company 40' && name.cells[2] === 'Test Company 40 Ltd', 'admin: the edit shows the NAME field with its before and after', JSON.stringify(name));
  check(stage && stage.cells[1] === 'New' && stage.cells[2] === 'Contacted', 'admin: a change inside the raw record reads as its own field (stage: New → Contacted)', JSON.stringify(stage));
  const editFields = await p.evaluate(() => { const e = document.querySelector('#v115-ov [data-v115-event]'); return e ? [...e.querySelectorAll('[data-v115-field]')].map((r) => r.getAttribute('data-v115-field')) : null; });
  check(editFields && editFields.join(',') === 'name,raw.stage', 'admin: the edit lists exactly what changed — not an unchanged field (stage, raw.notes), the whole raw record, or updated_at', JSON.stringify(editFields));
  check(w && /Othman/.test(w.text) && /Edited/.test(w.text) && /QA Account/.test(w.text) && /Created/.test(w.text), 'admin: each entry says who and what (Othman · Edited; QA Account · Created)', w && w.text.slice(0, 200));
  const folded = await p.evaluate(() => { const d = document.querySelector('#v115-ov [data-v115-event] details'); return !!d && !d.open; });
  check(folded, 'admin: the creation\'s field list is folded behind "N field(s)"');
  await p.evaluate(() => document.querySelector('#v115-ov [data-v115-close]').click());
  check(!(await logWin(p)), 'admin: Close closes the window');

  await p.evaluate(() => { current = 'activity'; openLead = null; render(); });
  await p.waitForFunction(() => document.querySelectorAll('[data-v115-row]').length > 0, null, { timeout: 15000 }).catch(() => { });
  const rowBtns = await p.evaluate(() => document.querySelectorAll('[data-v115-row]').length);
  check(rowBtns >= 2, `admin: Activity & Audit lines carry a "Log" button (${rowBtns})`);
  await p.evaluate(() => { const r = [...document.querySelectorAll('[data-v115-row]')].find((x) => /aaaaaaaa-0000-4000-8000-000000000040/.test(x.getAttribute('onclick'))); (r || document.querySelector('[data-v115-row]')).click(); });
  await waitLog(p); const w2 = await logWin(p);
  check(w2 && w2.events === 2, 'admin: a line\'s "Log" opens that record\'s whole change log', JSON.stringify(w2 && w2.events));
  await p.evaluate(() => closeChangeLog());

  const wrapped = await p.evaluate(() => ({ task: !!(window.v108Open && window.v108Open.__v115), person: !!(window.v114EditPerson && window.v114EditPerson.__v115), team: !!(window.v114RenameTeam && window.v114RenameTeam.__v115) }));
  check(wrapped.task && wrapped.person && wrapped.team, 'admin: the task, person and team windows are given the button', JSON.stringify(wrapped));
  await p.evaluate(() => { current = 'people'; openLead = null; render(); });
  await p.waitForFunction(() => document.querySelector('[data-v114-person] button[onclick*="v114EditPerson"]'), null, { timeout: 20000 }).catch(() => { });
  await p.evaluate(() => { const bt = document.querySelector('[data-v114-person] button[onclick*="v114EditPerson"]'); if (bt) bt.click(); });
  await p.waitForTimeout(600);
  const inHead = await p.evaluate(() => !!document.querySelector('#modal .mh [data-v115-open]'));
  check(inHead, 'admin: a person\'s Edit window has "Change log" in its title bar');
  await p.evaluate(() => { const bt = document.querySelector('#modal .mh [data-v115-open]'); if (bt) bt.click(); }); await waitLog(p);
  const both = await p.evaluate(() => ({ log: !!document.querySelector('#v115-ov [data-v115-log]'), modal: document.getElementById('ov').classList.contains('show') }));
  check(both.log && both.modal, 'admin: the change log opens on top, and the Edit window stays open underneath', JSON.stringify(both));
  await p.evaluate(() => { closeChangeLog(); closeModal(); });
  srv.close(); await b.close();
}

/* ---------------- MANAGER ---------------- */
{
  const { p, b, srv } = await session('manager', 9632, 'en');
  await openCompany(p);
  const btn = await p.evaluate(() => !!document.querySelector('#view .v63-record-hist [data-v115-open]'));
  if (btn) { await p.evaluate(() => document.querySelector('#view .v63-record-hist [data-v115-open]').click()); await waitLog(p); }
  const w = await logWin(p);
  check(btn && w && w.events === 2, 'manager: sees the card button and the change log\'s entries', JSON.stringify({ btn, events: w && w.events }));
  srv.close(); await b.close();
}

/* ---------------- TEAM MEMBER ---------------- */
{
  const { p, b, srv } = await session('team_member', 9633, 'en');
  await p.evaluate(() => { current = 'activity'; openLead = null; render(); }); await p.waitForTimeout(800);
  const closed = await p.evaluate(() => { const c = document.querySelector('[data-v63-log-closed]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
  check(/shown to admins and managers/.test(closed), 'team member: Activity & Audit says the log is for admins and managers (not "No activity")', closed.slice(0, 120));
  await openCompany(p);
  const card = await p.evaluate(() => !!document.querySelector('#view .v63-record-hist'));
  check(!card, 'team member: the company page draws no "Recent changes" card (it would falsely read "no changes")');
  const direct = await p.evaluate(async () => { const r = await fc().from('record_history').select('id'); const r2 = await fc().from('record_changes').select('field'); return [(r.data || []).length, (r2.data || []).length]; });
  check(direct[0] === 0 && direct[1] === 0, 'team member: the log read straight from the database returns nothing (both the log and its field view)', JSON.stringify(direct));
  await p.evaluate(() => openChangeLog([{ table: 'businesses', key: 'aaaaaaaa-0000-4000-8000-000000000040' }], 'x'));
  const w = await logWin(p);
  check(w && /shown to admins and managers/.test(w.text) && !w.events, 'team member: opening the log by hand says it is for admins and managers, and shows no entries', w && w.text.slice(0, 120));
  srv.close(); await b.close();
}

/* ---------------- ARABIC (admin) ---------------- */
{
  const { p, b, srv } = await session('admin', 9634, 'ar');
  await openCompany(p);
  await p.evaluate(() => { const bt = document.querySelector('#view .v63-record-hist [data-v115-open]'); if (bt) bt.click(); else openChangeLog([{ table: 'businesses', key: 'aaaaaaaa-0000-4000-8000-000000000040' }], ''); });
  await waitLog(p); const w = await logWin(p);
  const nameAr = w && w.fields.find((x) => x.f === 'name');
  check(w && w.dir === 'rtl' && /سجل التغييرات/.test(w.text) && /قبل/.test(w.text) && /بعد/.test(w.text), 'Arabic: the window runs right to left, titled «سجل التغييرات», with «قبل» / «بعد»', w && (w.dir + ' ' + w.text.slice(0, 80)));
  check(nameAr && /الاسم/.test(nameAr.cells[0]), 'Arabic: fields are named in Arabic (الاسم)', JSON.stringify(nameAr));
  srv.close(); await b.close();
}

check(errors.length === 0, 'no JS errors anywhere', errors.slice(0, 3).join(' | '));
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — the change log: who, when, field, before, after; admins and managers only');
process.exit(failures ? 1 : 0);
