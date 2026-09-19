/* probe-events-save-honest.mjs — guards the two 2026-09-18 (fire #85) fixes in js/10's event save,
   both found by driving the real Add/Edit form against the live database with the writes intercepted so
   the payload could be read and a refusal simulated without anything being stored.

   1 · A PHANTOM SIGNUP. "Who signed up" opens pre-filled with the signed-in person's name, and the test
       for "is there anything to save here" included that name — so adding an event with the site-login
       box untouched ALSO wrote a ksa_event_signups row reading "<name> signed up" with no email and no
       password. That table means one thing: the account we made on the event's website. A row with no
       account on it records a signup that never happened, and it would have happened on every event the
       team added (the 80 live events came from an import, so none exist yet — this was caught before it
       could put a single false row in). An email or a password is now what writes the row; the name is
       still saved alongside one, and the pre-fill is kept.
   2 · THE DATABASE'S OWN WORDS. This is the only save in the app that asks for a single row back, so an
       RLS refusal does not arrive as "no rows" — PostgREST answers .single() with PGRST116, and the app
       printed it verbatim: "Could not save: JSON object requested, multiple (or no) rows returned", in
       English and in Arabic. Every other write path here says it plainly. Now so does this one.

   The probe fills the real form three times — login boxes empty, an email typed, and once with the save
   answered by a real PostgREST refusal — and reads what was sent and what the person was told.
   2026-09-21 (fire #122) — TWO CHECKS ADDED, because the one that guarded the payload only asked
   that every key SENT is a real column. That is a subset check: a save that stopped carrying the
   event's PLAN entirely would have passed it, while the Events page's five tiles went on filtering
   by that very column and an event's move silently never changed. The form is now filled with a
   plan and a progress that are NOT the defaults, and the payload must carry both, with those
   values. (Driven against the real database the same day: all 80 events carry an approach —
   undecided 25, attend 27, stand 12, mine 13, skip 3 — and the live editor does send it. The gap
   was in the check, not in the app.)

   Sabotage-tested: with the js/10 edit stashed, 2 checks go FAIL, exit 1 (the phantom row is written,
   and the refusal comes out in the database's own words). And 2026-09-21, against a COPY of the app
   (APP_DIR, repository untouched): with `approach` and `approach_status` removed from the payload,
   the two new checks FAIL and the old subset check stays green — which is the whole point.
   Run: node scripts/qa/probe-events-save-honest.mjs                                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9063; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
/* the real shape of ksa_events and its two enum columns, as the live database defines them */
const COLS = ['name_en', 'name_ar', 'vertical', 'status', 'start_date', 'end_date', 'city', 'venue', 'organiser', 'link', 'opportunity_sales', 'opportunity_partner', 'priority', 'notes', 'approach', 'approach_status', 'exhibitor_list_url', 'updated_at'];
const VERT = ['Travel', 'Tech', 'Study', 'Other'];
/* the plan the team sets on an event, and how far it has got. Deliberately NOT the defaults
   ('undecided' / 'not_started'), so a save that quietly dropped these columns could not pass by
   accident. */
const MOVE_PICKED = 'stand', PROG_PICKED = 'signed_up';
const STAT = ['confirmed', 'needs_verification', 'stale', 'outside_window', 'outside_ksa', 'no_date'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 950 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
let sent = []; let refuse = false;
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  if (/^\/rest\/v1\/ksa_event/.test(u.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(m)) {
    const body = rq.postData() || ''; sent.push({ m, table: u.pathname.replace('/rest/v1/', ''), body });
    if (refuse) { await r.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }) }); return; }
    let echo = []; try { const j = JSON.parse(body); echo = (Array.isArray(j) ? j : [j]).map((x, i) => ({ id: x.id || ('stub-' + i), event_id: x.event_id || 'stub-0' })); } catch (_) { }
    const one = (rq.headers()['accept'] || '').includes('vnd.pgrst.object');
    await r.fulfill({ status: 200, contentType: one ? 'application/vnd.pgrst.object+json' : 'application/json', body: JSON.stringify(one ? (echo[0] || {}) : echo) }); return;
  }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/events', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.evOpenModal === 'function' && (DB.ksaEvents || []).length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(4000);

/* fills the real Add form and presses its real Save; `login` optionally types an event-site email */
const add = async (name, login) => { sent = [];
  const opened = await p.evaluate(() => { try { evOpenModal(); } catch (_) { } const f = document.querySelector('[data-ev-form]');
    return f && f.querySelector('#ev_n') ? { prefilledBy: f.querySelector('#ev_su_by').value, email: f.querySelector('#ev_su_email').value } : null; });
  if (!opened) return { opened: null };
  await p.evaluate((a) => { const f = document.querySelector('[data-ev-form]');
    f.querySelector('#ev_n').value = a.name; if (a.login) f.querySelector('#ev_su_email').value = a.login;
    f.querySelector('#ev_vert').value = 'Tech'; f.querySelector('#ev_stat').value = 'confirmed'; f.querySelector('#ev_pri').value = '5';
    /* 2026-09-21 (fire #122) — the PLAN and its PROGRESS are set here too. They are what the Events
       page's five tiles filter by, and every one of the 80 real events carries both. */
    const mv = f.querySelector('#ev_move'), pg = f.querySelector('#ev_prog');
    if (mv) mv.value = a.move; if (pg) pg.value = a.prog;
    f.querySelector('#ev_save').click(); }, { name, login: login || '', move: MOVE_PICKED, prog: PROG_PICKED });
  await p.waitForTimeout(3000);
  const parse = (t) => sent.filter((s) => s.table === t).flatMap((s) => { try { const j = JSON.parse(s.body); return Array.isArray(j) ? j : [j]; } catch (_) { return []; } });
  return { opened, events: parse('ksa_events'), signups: parse('ksa_event_signups') };
};
const plain = await add('QA probe — no site login');
const withLogin = await add('QA probe — with site login', 'qa@example.com');

/* the database refuses the save: PostgREST answers .single() with PGRST116, not an empty array */
sent = []; refuse = true;
const refused = await p.evaluate(async () => { try { evOpenModal(); } catch (_) { } const f = document.querySelector('[data-ev-form]');
  if (!f || !f.querySelector('#ev_n')) return null; f.querySelector('#ev_n').value = 'QA probe — refused'; f.querySelector('#ev_save').click();
  await new Promise((r) => setTimeout(r, 3000));
  return { text: (document.body.innerText || '').replace(/\s+/g, ' '), formStillOpen: !!document.querySelector('[data-ev-form]') }; });
refuse = false;
await b.close(); srv.close?.();

const row = (plain.events || [])[0] || null;
const shapeOk = !!row && Object.keys(row).every((k) => COLS.includes(k)) && VERT.includes(row.vertical) && STAT.includes(row.status) && Number.isInteger(row.priority);
const said = (refused && refused.text) || '';
const checks = [
  ['the drive really happened — the Add-event form opened and sent one event row', !!plain.opened && (plain.events || []).length === 1],
  ['adding an event with the site-login boxes untouched writes NO site-login row', (plain.signups || []).length === 0],
  ['the "Who signed up" convenience is kept — the box still opens pre-filled', !!plain.opened && !!plain.opened.prefilledBy],
  ['typing an event-site email DOES save the site-login row, with the name alongside', (withLogin.signups || []).length === 1 && (withLogin.signups[0] || {}).login_email === 'qa@example.com' && !!(withLogin.signups[0] || {}).signed_up_by],
  ['a refused save is said in plain words, not in the database\'s own ("no rows returned")', /refused it|رفضته قاعدة البيانات/.test(said) && !/rows returned|JSON object requested|PGRST/i.test(said)],
  ['a refused save leaves the form open, so the typed work is not lost', !!refused && refused.formStillOpen === true],
  ['the event row carries only real columns, with values the enum columns actually hold', shapeOk],
  /* 2026-09-21 (fire #122) — shapeOk only asks that every key SENT is a real column. It is a subset
     check, so a save that stopped carrying the plan entirely would still have passed it, and an
     event's move would silently never change while the page's own tiles went on filtering by it.
     Both directions now: the columns must be THERE, and carry what the form was set to. */
  ['the save carries the plan and its progress, not only the columns it happens to send',
    !!row && 'approach' in row && 'approach_status' in row,
    JSON.stringify(row ? Object.keys(row) : null)],
  ['\u2026and carries the values the form was set to, rather than the defaults',
    !!row && row.approach === MOVE_PICKED && row.approach_status === PROG_PICKED,
    JSON.stringify(row ? { approach: row.approach, approach_status: row.approach_status } : null)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ plain: { opened: plain.opened, events: (plain.events || []).length, signups: plain.signups }, withLogin: { signups: withLogin.signups }, refused: { formStillOpen: refused && refused.formStillOpen, snippet: said.slice(-260) }, row })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
