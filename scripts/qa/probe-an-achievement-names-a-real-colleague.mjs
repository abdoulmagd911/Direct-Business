/* probe-an-achievement-names-a-real-colleague.mjs — the Reports achievement form lists the live
   team, keeps a name a saved entry still carries, and speaks Arabic in Arabic.

   Fire #248. Driven live in Arabic: Reports › Achievements › "＋ تسجيل إنجاز" opened a form titled
   "Log achievement" with seven of its eight labels in English — TEAM MEMBER, WHAT WAS ACHIEVED,
   DETAILS (OPTIONAL), LINKED OBJECTIVE, LINKED KPI, NUMERIC VALUE, CLIENT / ENTITY — English
   placeholders, and a "Team member" list of exactly four hard-coded names plus "Other". The team
   has eleven accounts and the app has kept a live roster since js/33 (teamList): seven colleagues
   could only ever be logged as "Other". The same four names fed the Achievements filter and the
   report's "One member" scope. js/21's option pass re-labels the filter's four names on screen,
   which is why the filter LOOKED partly Arabic; it never reaches the form.

   core-10 now draws every people list from rptTeam(): the live roster, plus any legacy name a
   saved entry still carries (so nothing already logged loses its person), with "Other" last —
   its STORED value unchanged, only its label Arabic. The form's title, labels and placeholders
   choose their words in the file itself.

   What this holds:
     1. AR: the form's title and every label are Arabic;
     2. AR: the member list is the live roster — teamList() — not the four hard-coded names;
     3. the "Other" option reads «أخرى» in Arabic while its stored value stays "Other";
     4. EN brake: the labels read exactly as they did — nothing translated that should not be;
     5. a saved entry whose member is a legacy name not on the roster keeps that person: the list
        still offers the name and the edit form has it selected (data is never orphaned);
     6. the Achievements filter's member list is the same list, with "All members" in Arabic;
     7. the report's "One member" scope draws the same list;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), three real runs:
     · rptTeam made to return the legacy list — fails 2, 5, 6 and 7: the roster gone and, with it,
       the saved entry's person;
     · the legacy-name merge removed — fails 2, 5, 6 and 7 as well, because every list is checked
       against roster + legacy and the saved entry's person is what went missing;
     · the form's labels put back to English — fails 1 alone, the roster still right.
   2026-09-26 (Phase 3 release 2): achievements live in the company database now (js/111). The form is js/111's:
   its "Credited to" list is the TEAM LIST (team_members, named from team_directory) — still the live people,
   never hard-coded names — and "Nobody in particular (the department)" replaces "Other" (stored as no person).
   A legacy name only ever lived in a browser: it is protected by the move — the line arrives in the database
   with "Logged for: <name>" in its text, so nobody already logged loses their person. The Achievements filter
   and the report's "One member" scope are still core-10's rptTeam() (roster + the names on saved lines + Other).
   Run: node scripts/qa/probe-an-achievement-names-a-real-colleague.mjs                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9278 — one mock. */
const PORT = 9278; const BASE = 'http://localhost:' + PORT;

/* Reports data is browser-local (localStorage, key directReportsData_v1). One saved entry carries a
   legacy name that is not on any roster — the case rule 5 protects. Synthetic throughout (rule 7). */
const LEGACY = 'QA Legacy Person';
const SEED = { achievements: [{ id: 'qa248-1', date: '2026-09-01', member: LEGACY, title: 'QA legacy entry', desc: '', objective: '', kpi: '', value: '', client: '' }], overrides: {} };
/* The roster the page must draw from. js/33 reads window.__TEAM before anything else and keeps it
   when the roster view is absent (the mock has none) — without this the fallback list happens to
   BE the four legacy names, and "not the hard-coded names" could never be told from "the roster". */
const ROSTER = ['QA Person One', 'QA Person Two', 'QA Person Three'];

process.env.MOCK_TASKS_ROSTER = '1';   /* the team list's names (js/111) */
const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  await ctx.addInitScript(({ l, seed, roster }) => { try { localStorage.setItem('dbLang', l); localStorage.setItem('directReportsData_v1', JSON.stringify(seed)); window.__TEAM = roster.slice(); } catch (_) {} }, { l: lang, seed: SEED, roster: ROSTER });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && !/\/report_entries$/.test(u.pathname) && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
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
  await p.goto(BASE + '/reports', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof rptOpenAch === 'function', { timeout: 120000 });
  await p.waitForTimeout(6000);   /* the roster (js/33) loads after sign-in */

  const roster = await p.evaluate(() => { try { return (typeof teamList === 'function') ? (teamList() || []).map(String) : []; } catch (_) { return []; } });

  /* Achievements tab: the filter */
  await p.evaluate(() => { try { current = 'reports'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const bt = [].slice.call(document.querySelectorAll('#view button')).find((x) => /الإنجازات|Achievements/.test((x.innerText || '').trim())); if (bt) bt.click(); });
  await p.waitForTimeout(1500);
  const filter = await p.evaluate(() => {
    const sels = [].slice.call(document.querySelectorAll('#view select'));
    const s = sels.find((x) => [].slice.call(x.options).some((o) => o.value === 'Other'));
    return s ? { first: s.options[0].text.trim(), values: [].slice.call(s.options).map((o) => o.value).slice(1), texts: [].slice.call(s.options).map((o) => o.text.trim()).slice(1) } : null;
  });

  /* the form — new (js/111's, once the database answered) */
  await p.waitForFunction(() => window.__v111 && window.__v111.loaded, { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => { try { rptOpenAch(); } catch (_) {} });
  await p.waitForTimeout(1200);
  const form = await p.evaluate(() => {
    const m = document.getElementById('modal'); if (!m || !m.offsetHeight) return null;
    const sel = document.getElementById('v111_member');
    return { title: ((m.querySelector('h2,h3,.mt') || {}).innerText || '').trim(),
             labels: [].slice.call(m.querySelectorAll('label')).map((l) => (l.innerText || '').trim()).filter(Boolean),
             placeholders: [].slice.call(m.querySelectorAll('input[placeholder]')).map((i) => i.getAttribute('placeholder')),
             values: sel ? [].slice.call(sel.options).map((o) => o.value) : [], texts: sel ? [].slice.call(sel.options).map((o) => o.text.trim()) : [] };
  });
  await p.evaluate(() => { try { const x = document.querySelector('#modal .btn.ghost'); if (x) x.click(); } catch (_) {} });
  await p.waitForTimeout(500);

  /* the legacy entry: moved from this browser into the database, its person kept in the line's text */
  await p.evaluate(() => { try { v111MoveBrowser(); } catch (_) {} });
  await p.waitForTimeout(2500);
  const edit = await fetch(BASE + '/rest/v1/report_entries?select=*').then((r) => r.json()).then((rows) => { const x = rows.find((r) => r.import_key === 'browser:qa248-1'); return x ? { moved: true, text: x.text_en || '', member: x.member_id } : { moved: false }; }).catch(() => null);
  const listed = await p.evaluate(() => { try { current = 'reports'; render(); rptGo('achievements'); } catch (_) {} return new Promise((res) => setTimeout(() => res((document.getElementById('view') || {}).innerText || ''), 900)); });
  if (edit) edit.listed = /QA legacy entry/.test(listed) && /QA Legacy Person/.test(listed);

  /* the report's One-member scope */
  await p.evaluate(() => { try { rptRepSet('scope', 'member'); } catch (_) {} });
  await p.waitForTimeout(1500);
  const scope = await p.evaluate(() => {
    const sels = [].slice.call(document.querySelectorAll('#view select'));
    /* the LAST such select is the scope's — the Achievements filter (first option blank, "All
       members") can still be in the document; empty values are dropped for the same reason */
    const all = sels.filter((x) => [].slice.call(x.options).some((o) => o.value === 'Other') && !x.id);
    const s = all[all.length - 1];
    return s ? [].slice.call(s.options).map((o) => o.value).filter((v) => v !== '') : null;
  });
  await ctx.close();
  return { roster, filter, form, edit, scope, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

const AR = /[؀-ۿ]/;
const expected = (roster) => roster.filter((n) => n !== 'Other').concat(roster.includes(LEGACY) ? [] : [LEGACY]).concat(['Other']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LEGACY4 = ['Abdelrahman', 'Othman Al Sharafi', 'Raad', 'Kareem'];

console.log('  roster the page holds: ' + ar.roster.length + ' name(s); one saved entry carries a legacy name not on it');

(ar.form && AR.test(ar.form.title) && ar.form.labels.length >= 8 && ar.form.labels.every((l) => AR.test(l)) && ar.form.placeholders.every((t) => AR.test(t)))
  ? pass('AR: the form\'s title and every label are Arabic', JSON.stringify([ar.form.title].concat(ar.form.labels.slice(0, 3))))
  : fail('AR: the form\'s title and every label are Arabic', JSON.stringify(ar.form && { title: ar.form.title, labels: ar.form.labels, placeholders: ar.form.placeholders }));

/* the team list, as the database names it — the two people the stand-in keeps on it, then "nobody in particular" */
const TEAM = ['QA Test Account', 'زميل تجريبي'];   /* in Arabic a person's Arabic name is shown when they have one */
(ar.form && ar.form.texts.length === 3 && TEAM.every((n) => ar.form.texts.includes(n)) && !LEGACY4.some((n) => ar.form.texts.includes(n)))
  ? pass('AR: the "Credited to" list is the live team list, not the four hard-coded names', JSON.stringify(ar.form.texts))
  : fail('AR: the "Credited to" list is the live team list, not the four hard-coded names', JSON.stringify({ texts: ar.form && ar.form.texts }));

(ar.form && ar.form.values[ar.form.values.length - 1] === '' && ar.form.texts[ar.form.texts.length - 1] === 'لا أحد بعينه (القسم)')
  ? pass('"Nobody in particular" reads Arabic in Arabic and is stored as no person')
  : fail('"Nobody in particular" reads Arabic in Arabic and is stored as no person', JSON.stringify({ values: ar.form && ar.form.values.slice(-1), texts: ar.form && ar.form.texts.slice(-1) }));

const EN_LABELS = ['Date', 'Credited to', 'What was achieved', 'Details (optional)', 'Kind of achievement', 'Client / entity (optional)', 'Linked objective', 'KPI', 'Numeric value (counts toward the KPI — never money)'];
(en.form && en.form.title === 'Log achievement' && EN_LABELS.every((l) => en.form.labels.some((x) => x.toLowerCase() === l.toLowerCase())))
  ? pass('EN brake: the labels read as written')
  : fail('EN brake: the labels read as written', JSON.stringify(en.form && { title: en.form.title, labels: en.form.labels }));

(en.edit && en.edit.moved && /(Logged for|سُجّل لـ): QA Legacy Person/.test(en.edit.text)   /* moved in the first (Arabic) run — the note is in the mover's language */ && en.edit.listed)
  ? pass('a browser entry whose person is a legacy name keeps that person — moved into the database with "Logged for: …", and listed', JSON.stringify(en.edit))
  : fail('a browser entry whose person is a legacy name keeps that person — moved into the database with "Logged for: …", and listed', JSON.stringify(en.edit));

/* core-10's lists: the roster, the names on the saved (database) lines, and "Other" */
const expectedLists = (roster) => roster.filter((n) => n !== 'Other').concat(['Other']);
(ar.filter && AR.test(ar.filter.first) && same(ar.filter.values, expectedLists(ar.roster)))
  ? pass('the Achievements filter draws the roster, with "All members" in Arabic', JSON.stringify(ar.filter.first))
  : fail('the Achievements filter draws the roster, with "All members" in Arabic', JSON.stringify(ar.filter));

(en.scope && en.scope.slice(0, en.roster.length).join('|') === en.roster.join('|') && en.scope[en.scope.length - 1] === 'Other')
  ? pass('the report\'s "One member" scope draws the roster (plus the people on saved lines) and "Other" last')
  : fail('the report\'s "One member" scope draws the roster (plus the people on saved lines) and "Other" last', JSON.stringify({ scope: en.scope, roster: en.roster }));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
