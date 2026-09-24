/* probe-a-failed-roster-says-so.mjs — when the team roster cannot be read, every list of people
   says so instead of quietly offering an old list; when the roster is simply not there, the
   fallback stays silent as before; and a later success clears the warning.

   Fire #250. Driven live with the roster read (team_directory) refused with a 500: the lead
   editor's "Assigned to" offered the four names hard-coded a year ago plus "Unassigned", the
   achievement form offered the same, and nothing on screen said the team list had not loaded.
   js/33 gave up on the first error reply and kept the fallback forever. A lead assigned to one of
   those stale names drops out of its real owner's "Mine" — CLAUDE.md's own warning — with nothing
   said. The quietly-wrong-list family (M27, M74).

   Three answers the roster can give, told apart now:
     · an error reply or a network failure  → FAILED: retried (the existing ten tries), then every
       people list carries a disabled first option saying the team list did not load and the
       names may be out of date, in the page language;
     · a "relation does not exist" reply, or 200 with nothing → ABSENT: today's silent fallback,
       which the harness relies on (the mock answers an unknown table with an empty list);
     · rows → LOADED: the roster, and any earlier warning gone at the next render.

   What this holds:
     1. with the roster refused (500), the lead editor's Assigned-to carries the warning option;
     2. the achievement form's member list carries it too;
     3. in Arabic the warning is Arabic;
     4. the warning option cannot be chosen (disabled) — it is a notice, not a name;
     5. brake: with the roster served, no warning, and the names are the roster's;
     6. brake: with the roster ABSENT (the mock's empty answer), no warning — the fallback stays
        silent, so the harness and every older probe are untouched;
     7. a roster that fails twice and then answers clears the warning on the next render;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the failure never recorded (the error branch put back to "give up silently") — fails 1, 2,
       3, 4 and 7;
     · the warning shown whenever the roster is not LOADED (absent treated as failed) — fails 6
       alone, the brake that keeps the harness honest.
   Run: node scripts/qa/probe-a-failed-roster-says-so.mjs                                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9288 — one mock. */
const PORT = 9288; const BASE = 'http://localhost:' + PORT;

const ROSTER = [
  { id: 'u1', email: 'one@qa.test', full_name: 'QA Person One', role: 'team_member', active: true },
  { id: 'u2', email: 'two@qa.test', full_name: 'QA Person Two', role: 'manager', active: true },
];
const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* mode: 'fail' (always 500) · 'served' (roster rows) · 'absent' (fall through to the mock: 200 [])
   · 'recover' (500 twice, then rows) */
async function run(lang, mode) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + '/' + mode + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  let rosterCalls = 0;
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/team_directory' && m === 'GET') {
      rosterCalls++;
      if (mode === 'fail' || (mode === 'recover' && rosterCalls <= 2)) { await r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"QA: roster refused"}' }); return; }
      if (mode === 'served' || mode === 'recover') { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROSTER) }); return; }
      /* 'absent': fall through to the mock, which answers an unknown table with [] */
    }
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  /* js/33 retries every 1.5 s up to ten times; a failed roster is settled well inside this */
  await p.waitForTimeout(mode === 'fail' ? 18000 : 7000);

  const look = () => p.evaluate(() => {
    const state = (typeof teamRosterState === 'function') ? teamRosterState() : null;
    let assign = null;
    try { const lead = (DB.businesses || []).find((x) => !x.isClient) || DB.businesses[0]; editBusiness(lead.id); } catch (_) {}
    return new Promise((res) => setTimeout(() => {
      const s = document.getElementById('f_assign');
      if (s) assign = [].slice.call(s.options).map((o) => ({ v: o.value, t: o.text.trim(), dis: o.disabled, warn: o.hasAttribute('data-roster-warn') }));
      try { const x = document.querySelector('#modal .btn.ghost'); if (x) x.click(); if (typeof closeModal === 'function') closeModal(); } catch (_) {}
      res({ state, assign });
    }, 900));
  });
  const first = await look();
  let ach = null;
  await p.evaluate(() => { try { current = 'reports'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { try { rptOpenAch(); } catch (_) {} });
  await p.waitForTimeout(900);
  ach = await p.evaluate(() => { const s = document.getElementById('rf_member'); return s ? [].slice.call(s.options).map((o) => ({ v: o.value, t: o.text.trim(), dis: o.disabled, warn: o.hasAttribute('data-roster-warn') })) : null; });
  await p.evaluate(() => { try { const x = document.querySelector('#modal .btn.ghost'); if (x) x.click(); if (typeof closeModal === 'function') closeModal(); } catch (_) {} });
  await p.evaluate(() => { try { current = 'leads'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(800);
  await ctx.close();
  return { first, ach, rosterCalls, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const failEn = await run('en', 'fail');
const failAr = await run('ar', 'fail');
const served = await run('en', 'served');
const absent = await run('en', 'absent');
const recover = await run('en', 'recover');
await b.close(); srv.close?.();

const AR = /[؀-ۿ]/;
const warnOf = (opts) => (opts || []).find((o) => o.warn) || null;
const names = (opts) => (opts || []).filter((o) => !o.warn).map((o) => o.v).filter((v) => v && v !== '__none__' && v !== 'Other');

console.log('  five runs: roster refused (EN, AR), served, absent (the mock\'s empty answer), refused twice then served');

(failEn.first.assign && warnOf(failEn.first.assign) && /did not load|out of date/i.test(warnOf(failEn.first.assign).t))
  ? pass('with the roster refused, the lead editor\'s Assigned-to carries the warning option', JSON.stringify(warnOf(failEn.first.assign).t.slice(0, 70)))
  : fail('with the roster refused, the lead editor\'s Assigned-to carries the warning option', JSON.stringify({ state: failEn.first.state, assign: failEn.first.assign }));

(failEn.ach && warnOf(failEn.ach))
  ? pass('the achievement form\'s member list carries it too')
  : fail('the achievement form\'s member list carries it too', JSON.stringify(failEn.ach));

(failAr.first.assign && warnOf(failAr.first.assign) && AR.test(warnOf(failAr.first.assign).t))
  ? pass('in Arabic the warning is Arabic', JSON.stringify(warnOf(failAr.first.assign).t.slice(0, 60)))
  : fail('in Arabic the warning is Arabic', JSON.stringify(failAr.first.assign));

(warnOf(failEn.first.assign) && warnOf(failEn.first.assign).dis === true && warnOf(failEn.ach) && warnOf(failEn.ach).dis === true)
  ? pass('the warning option cannot be chosen — it is a notice, not a name')
  : fail('the warning option cannot be chosen — it is a notice, not a name', JSON.stringify({ a: warnOf(failEn.first.assign), b: warnOf(failEn.ach) }));

(served.first.assign && !warnOf(served.first.assign) && names(served.first.assign).includes('QA Person One') && names(served.first.assign).includes('QA Person Two') && served.first.state === 'loaded')
  ? pass('brake: with the roster served, no warning and the names are the roster\'s', JSON.stringify(names(served.first.assign)))
  : fail('brake: with the roster served, no warning and the names are the roster\'s', JSON.stringify(served.first));

(absent.first.assign && !warnOf(absent.first.assign) && !warnOf(absent.ach))
  ? pass('brake: with the roster absent, no warning — the silent fallback stays', JSON.stringify(absent.first.state))
  : fail('brake: with the roster absent, no warning — the silent fallback stays', JSON.stringify({ state: absent.first.state, assign: absent.first.assign, ach: absent.ach }));

(recover.rosterCalls >= 3 && recover.first.assign && !warnOf(recover.first.assign) && names(recover.first.assign).includes('QA Person One'))
  ? pass('a roster that fails twice and then answers clears the warning', recover.rosterCalls + ' roster reads')
  : fail('a roster that fails twice and then answers clears the warning', JSON.stringify({ calls: recover.rosterCalls, state: recover.first.state, assign: recover.first.assign }));

const errs = [].concat(failEn.errors, failAr.errors, served.errors, absent.errors, recover.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
