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
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
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

  /* the form — new */
  await p.evaluate(() => { try { rptOpenAch(); } catch (_) {} });
  await p.waitForTimeout(1200);
  const form = await p.evaluate(() => {
    const m = document.getElementById('modal'); if (!m || !m.offsetHeight) return null;
    const sel = document.getElementById('rf_member');
    return { title: ((m.querySelector('h2,h3,.mt') || {}).innerText || '').trim(),
             labels: [].slice.call(m.querySelectorAll('label')).map((l) => (l.innerText || '').trim()).filter(Boolean),
             placeholders: [].slice.call(m.querySelectorAll('input[placeholder]')).map((i) => i.getAttribute('placeholder')),
             values: sel ? [].slice.call(sel.options).map((o) => o.value) : [], texts: sel ? [].slice.call(sel.options).map((o) => o.text.trim()) : [] };
  });
  await p.evaluate(() => { try { const x = document.querySelector('#modal .btn.ghost'); if (x) x.click(); } catch (_) {} });
  await p.waitForTimeout(500);

  /* the form — editing the legacy entry */
  await p.evaluate(() => { try { rptOpenAch('qa248-1'); } catch (_) {} });
  await p.waitForTimeout(1200);
  const edit = await p.evaluate(() => { const sel = document.getElementById('rf_member'); return sel ? { selected: sel.value, has: [].slice.call(sel.options).some((o) => o.value === 'QA Legacy Person') } : null; });
  await p.evaluate(() => { try { const x = document.querySelector('#modal .btn.ghost'); if (x) x.click(); } catch (_) {} });
  await p.waitForTimeout(500);

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

(ar.form && ar.roster.length > 0 && same(ar.form.values, expected(ar.roster)) && !same(ar.form.values.slice(0, 4), LEGACY4))
  ? pass('AR: the member list is the live roster, not the four hard-coded names', JSON.stringify(ar.form.values.slice(0, 4)) + '…')
  : fail('AR: the member list is the live roster, not the four hard-coded names', JSON.stringify({ roster: ar.roster, values: ar.form && ar.form.values }));

(ar.form && ar.form.values[ar.form.values.length - 1] === 'Other' && ar.form.texts[ar.form.texts.length - 1] === 'أخرى')
  ? pass('the "Other" option reads «أخرى» while its stored value stays "Other"')
  : fail('the "Other" option reads «أخرى» while its stored value stays "Other"', JSON.stringify({ values: ar.form && ar.form.values.slice(-2), texts: ar.form && ar.form.texts.slice(-2) }));

const EN_LABELS = ['Date', 'Team member', 'What was achieved', 'Details (optional)', 'Linked objective', 'Linked KPI', 'Numeric value (counts toward the KPI)', 'Client / entity (optional)'];
(en.form && en.form.title === 'Log achievement' && EN_LABELS.every((l) => en.form.labels.some((x) => x.toLowerCase() === l.toLowerCase())))
  ? pass('EN brake: the labels read exactly as they did')
  : fail('EN brake: the labels read exactly as they did', JSON.stringify(en.form && { title: en.form.title, labels: en.form.labels }));

(en.edit && en.edit.has && en.edit.selected === LEGACY && en.form.values.includes(LEGACY))
  ? pass('a saved entry whose member is a legacy name keeps that person — offered and selected', JSON.stringify(en.edit))
  : fail('a saved entry whose member is a legacy name keeps that person — offered and selected', JSON.stringify({ edit: en.edit, values: en.form && en.form.values }));

(ar.filter && AR.test(ar.filter.first) && same(ar.filter.values, expected(ar.roster)))
  ? pass('the Achievements filter draws the same list, with "All members" in Arabic', JSON.stringify(ar.filter.first))
  : fail('the Achievements filter draws the same list, with "All members" in Arabic', JSON.stringify(ar.filter));

(en.scope && same(en.scope, expected(en.roster)))
  ? pass('the report\'s "One member" scope draws the same list')
  : fail('the report\'s "One member" scope draws the same list', JSON.stringify({ scope: en.scope, expected: expected(en.roster) }));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
