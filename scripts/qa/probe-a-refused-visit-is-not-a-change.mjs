/* probe-a-refused-visit-is-not-a-change.mjs — Activity & Audit separates "somebody was refused a
   page" from "a record changed", and says how many of each it is showing.

   Fire #230. Driven against the real log: 378 events, of which 131 were refused page visits. The
   three tiles counted the two kinds together under labels that promise the second — the 7-day tile
   read a green 39 and ALL THIRTY-NINE were refusals, so the true figure for the week was nought
   records changed — and the feed opened with twelve consecutive "Page access · Refused" rows, 129
   of the 250 most recent entries. A page whose entire job is to say what changed was mostly saying
   what did not.

   The refusals are this QA account's own sweeps: driving the live app as a restricted role makes
   the database write one. That is exactly why they must be SEPARABLE rather than deleted — the log
   belongs to the database, and an audit trail nobody may edit is the point of it.

   Same family as the Archive's zeros (M74): a number true of what it counts and false to the person
   reading it. Each tile now says how much of itself is refusals.

   **CORRECTED 2026-09-24 (fire #241), and the correction is the interesting part.** #230 also made
   the feed HIDE refusals until you press Show, and this probe asserted that as the right answer.
   The next full battery put two OLDER probes red — probe-audit-names-and-words and
   probe-history-actor-and-sync-words, both of which plant a refused visit and check it is named
   properly on the feed. Three things settled it against the newer probe rather than the older two:
   those guards predate #230 and encode a defect already paid for (fire #53); the live feed holds
   131 refusals among 378 rows, so the default was dropping a THIRD of an audit log behind a line
   most people would never click; and a quietly shorter list is the exact fault M27 and M74 exist to
   stop. #230's real finding was the TILES counting a refusal as a record change — that is fixed by
   labelling, which is untouched here and still checked. Hiding the rows was scope I added on top of
   it, and it was wrong. The toggle stays, defaulting to showing everything; anyone who wants record
   changes only can still press Hide. The checks below were rewritten to hold the corrected
   behaviour — not inverted to match the code, which is why the reasoning is written down here.

   What this holds:
     1. the feed opens on the WHOLE log, refusals included — an audit trail is never silently short;
     2. a badge says they are included and offers to take them out, so the view is not a mystery;
     3. pressing Hide leaves record changes only, and the badge then names the count held back;
     4. a window that is ENTIRELY refusals says so on the tile — "all N … no record changed" —
        rather than reporting a bare number that reads as work done;
     5. a mixed window says how many of its number were refusals;
     6. the brake: with NO refusals in the log there is no badge and no note — this never becomes
        furniture, and the feed is untouched;
     7. a log holding nothing but refusals does not read as an empty log;
     8. Arabic, including the dual — two days ago is «قبل يومين», not «قبل 2 أيام», which is what
        the tile actually said before this fire;
     9. no JS errors, and nothing was written.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the feed put back to hiding refusals by default (showDenied left undefined, exactly the #230
       regression) — fails 1 and 2, a third of the audit log gone from the page on arrival;
     · the tile note removed — fails 4 and 5, leaving exactly the bare "7-DAY 3" that started this
       while every other check still passes, which is why both halves of the fix are checked.
   Run: node scripts/qa/probe-a-refused-visit-is-not-a-change.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9259 — one mock. */
const PORT = 9259; const BASE = 'http://localhost:' + PORT;

const DAY = 86400000;
/* Relative to NOW, never to a fixed date: the page's windows are today and the six days before it,
   so a fixture pinned to a calendar date would quietly stop landing in them and checks 4 and 8
   would pass or fail by the month they were run in. */
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
/* A log with all three cases in it: a 7-day window that is ENTIRELY refusals (so the tile has to
   say so), an all-time window that is mixed, and record changes further back to fall back on. */
const HIST_WITH = [
  { id: 901, at: iso(2 * DAY), actor: null, actor_name: 'QA Rig', table_name: 'access', record_id: 'x1', action: 'denied', after_row: { page: 'settings' }, before_row: null },
  { id: 902, at: iso(2 * DAY + 60000), actor: null, actor_name: 'QA Rig', table_name: 'access', record_id: 'x2', action: 'denied', after_row: { page: 'finance' }, before_row: null },
  { id: 903, at: iso(2 * DAY + 120000), actor: null, actor_name: 'QA Rig', table_name: 'access', record_id: 'x3', action: 'denied', after_row: { page: 'reports' }, before_row: null },
  { id: 904, at: iso(10 * DAY), actor: null, actor_name: 'Someone', table_name: 'businesses', record_id: 'b1', action: 'edit',
    before_row: { id: 'b1', name: 'QA HIST COMPANY', stage: 'new' }, after_row: { id: 'b1', name: 'QA HIST COMPANY', stage: 'contacted' } },
  { id: 905, at: iso(40 * DAY), actor: null, actor_name: 'Someone', table_name: 'businesses', record_id: 'b2', action: 'create',
    before_row: null, after_row: { id: 'b2', name: 'QA HIST OLDER' } },
];
const HIST_CLEAN = HIST_WITH.filter((r) => r.table_name !== 'access');
const HIST_ONLY = HIST_WITH.filter((r) => r.table_name === 'access');

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang, log) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  const wrote = [];
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/record_history' && m === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(log) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(m + ' ' + u.pathname.replace('/rest/v1/', ''));
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
  await p.goto(BASE + '/activity', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { try { current = 'activity'; render(); } catch (_) {} });
  /* the log arrives after the session does — wait for the feed to hold something, or for the page
     to say plainly that it holds nothing, rather than reading it mid-flight */
  await p.waitForFunction(() => { try { const f = document.querySelector('#view .act-feed');
    return !!f && f.children.length > 0 && !/Loading|جارٍ/.test(f.innerText || ''); } catch (_) { return false; } }, { timeout: 60000 });
  await p.waitForTimeout(800);

  const look = () => p.evaluate(() => {
    const v = document.getElementById('view'); if (!v) return { no: true };
    const f = v.querySelector('.act-feed');
    const bd = v.querySelector('[data-hist-denied]');
    const rows = f ? [].slice.call(f.children).map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()) : [];
    const tiles = [].slice.call(v.querySelectorAll('.kl')).map((k, i) => {
      const box = k.parentNode;
      return { label: (k.innerText || '').trim(),
               value: ((box.querySelector('.kv') || {}).innerText || '').trim(),
               notes: [].slice.call(box.children).slice(2).map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean) };
    });
    return { tiles, rows, count: rows.length,
             badge: bd ? { state: bd.getAttribute('data-hist-denied'), text: (bd.innerText || '').replace(/\s+/g, ' ').trim() } : null };
  });
  const before = await look();
  let after = null;
  if (before.badge) {
    await p.evaluate(() => { try { histToggleDenied(); } catch (_) {} });
    await p.waitForTimeout(1200);
    after = await look();
  }
  await ctx.close();
  return { before, after, errors, wrote };
}

const REFUSED = /Page access|الوصول إلى صفحة/;
const en = await run('en', HIST_WITH);
const ar = await run('ar', HIST_WITH);
const clean = await run('en', HIST_CLEAN);
const only = await run('en', HIST_ONLY);
await b.close(); srv.close?.();

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
console.log('  log seeded: ' + HIST_WITH.length + ' events, ' + HIST_ONLY.length + ' of them refused page visits');

const refusedOnFeed = en.before.rows.filter((r) => REFUSED.test(r)).length;
(en.before.count === HIST_WITH.length && refusedOnFeed === HIST_ONLY.length)
  ? pass('the feed opens on the whole log, refusals included', en.before.count + ' rows, ' + refusedOnFeed + ' of them refusals')
  : fail('the feed opens on the whole log, refusals included', JSON.stringify({ rows: en.before.count, refused: refusedOnFeed, first: en.before.rows[0] }));

(en.before.badge && en.before.badge.state === 'shown' && /shown too|تُعرض/i.test(en.before.badge.text) && /Hide|إخفاء/i.test(en.before.badge.text))
  ? pass('a badge says they are included and offers to take them out', JSON.stringify(en.before.badge.text.slice(0, 70)))
  : fail('a badge says they are included and offers to take them out', JSON.stringify(en.before.badge));

(en.after && en.after.count === HIST_CLEAN.length && en.after.rows.filter((r) => REFUSED.test(r)).length === 0
  && en.after.badge && en.after.badge.state === 'hidden' && new RegExp('\\b' + HIST_ONLY.length + '\\b').test(en.after.badge.text))
  ? pass('Hide leaves record changes only, and the badge names the count held back', en.after.count + ' rows · ' + JSON.stringify(en.after.badge.text.slice(0, 60)))
  : fail('Hide leaves record changes only, and the badge names the count held back', JSON.stringify({ after: en.after && en.after.count, badge: en.after && en.after.badge }));

/* the labels are upper-cased by the stylesheet, so this match must be case-insensitive — the
   first version of this check was reading `undefined` and calling it a failure of the page. */
const tile7 = en.before.tiles.find((t) => /7-day|أيام/i.test(t.label));
(tile7 && tile7.notes.some((n) => /all \d+ were refused|no record changed/i.test(n)))
  ? pass('a window that is entirely refusals says so on the tile', JSON.stringify({ value: tile7.value, note: tile7.notes.slice(-1)[0] }))
  : fail('a window that is entirely refusals says so on the tile', JSON.stringify(tile7));

const tileAll = en.before.tiles.find((t) => /Events loaded/i.test(t.label));
(tileAll && tileAll.notes.some((n) => new RegExp('\\b' + HIST_ONLY.length + '\\b.*(refused|not record changes)', 'i').test(n)))
  ? pass('a mixed window says how many of its number were refusals', JSON.stringify(tileAll.notes.slice(-1)[0]))
  : fail('a mixed window says how many of its number were refusals', JSON.stringify(tileAll));

const cleanNotes = clean.before.tiles.reduce((a, t) => a.concat(t.notes), []).filter((n) => /refused|مرفوض/i.test(n));
(clean.before.badge === null && cleanNotes.length === 0 && clean.before.count === HIST_CLEAN.length)
  ? pass('brake: with no refusals there is no badge and no note', clean.before.count + ' rows, untouched')
  : fail('brake: with no refusals there is no badge and no note', JSON.stringify({ badge: clean.before.badge, notes: cleanNotes, rows: clean.before.count }));

/* a log that is nothing but refusals: it arrives showing all of them, and the ONE state where the
   page would otherwise look empty — after somebody presses Hide — says why instead of showing
   nothing. That second half is the check worth having, so both are asserted. */
const onlyHidden = (only.after && only.after.rows[0]) || '';
(only.before.count === HIST_ONLY.length && only.before.rows.every((r) => REFUSED.test(r))
  && /every one of the \d+ events here is a refused page visit/i.test(onlyHidden))
  ? pass('a log of nothing but refusals shows them, and never reads as an empty log when hidden', JSON.stringify(onlyHidden.slice(0, 80)))
  : fail('a log of nothing but refusals shows them, and never reads as an empty log when hidden', JSON.stringify({ shown: only.before.rows.slice(0, 2), hidden: onlyHidden.slice(0, 90) }));

const arNotes = ar.before.tiles.reduce((a, t) => a.concat(t.notes), []);
const arOk = ar.before.badge && /[؀-ۿ]/.test(ar.before.badge.text) && arNotes.some((n) => /[؀-ۿ]/.test(n))
  && !arNotes.some((n) => /قبل 2 /.test(n)) && arNotes.some((n) => /قبل يومين|أمس|قبل \d+ (أيام|يومًا)/.test(n));
arOk ? pass('Arabic, including the dual for two days', JSON.stringify(arNotes.filter((n) => /قبل|أمس/.test(n))))
     : fail('Arabic, including the dual for two days', JSON.stringify({ badge: ar.before.badge, notes: arNotes }));

const errs = en.errors.concat(ar.errors, clean.errors, only.errors);
const wrote = en.wrote.concat(ar.wrote, clean.wrote, only.wrote);
(errs.length === 0 && wrote.length === 0)
  ? pass('no JS errors, and nothing was written')
  : fail('no JS errors, and nothing was written', JSON.stringify({ errors: errs.slice(0, 2), wrote: wrote.slice(0, 3) }));

process.exit(bad.length ? 1 : 0);
