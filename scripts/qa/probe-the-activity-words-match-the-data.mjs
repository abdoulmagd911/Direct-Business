/* probe-the-activity-words-match-the-data.mjs — the words for what someone did to a record are
   translated, are the same on every screen that shows them, and never leak a database identifier.

   Fire #197. Found by driving the LIVE app in Arabic over the four pages every team member can
   open. Two copies of one activity-type map lived in js/core/core-02 — one inline in the Clients
   table, one in `_actWhat` for the record timeline — and **both were keyed on lowercase**
   (`{note:…, call:…, meeting:…}`) while every activity in the live data is capitalised. Counted
   the same day across 38 companies:

       Note 15 · stage_change 28 · Won 10 · Call 8 · Task 4 · Meeting 2 · Proposal 1
       = 68 of 68 rows that could never hit a key in either map

   On screen that meant the Arabic Clients list read "↪ Note: …" on **11 of 11** rows, and a
   client's own timeline ran Call / Task / Note / Won down its whole length in English — the
   history screen, in the language half the team reads. Three separate faults in one place: the
   lookup was case-sensitive against data that is never lowercase; four types people actually log
   (Won, Task, Proposal, stage_change) were in neither map in any case; and `stage_change` is a
   database identifier rather than a label, so the fallback would have printed it verbatim to a
   person.

   One helper now, `actTypeLabel` — case-insensitive, carrying the words people log, taking
   stage-shaped words (Won, Lost, Proposal) from `window.__STAGE_AR`, the map the stage chips and
   the Arabic export already share, so the same thing cannot come out worded two ways.

   What this holds:
     1. in Arabic the Clients list translates a capitalised type — no Latin type word survives;
     2. in Arabic the record timeline translates the same types;
     3. `stage_change` never reaches either screen as itself, in either language, and reads as a
        phrase instead;
     4. in English the ordinary words still read as words — the fix must not hand English readers
        lowercase keys or Arabic;
     5. an unrecognised type falls through to its stored value rather than being guessed at;
     6. the two surfaces word the same activity identically — which is the defect itself, since
        what went wrong was two maps rather than one.
     7. no JS errors in either language.

   Checks 5 and 6 are the brakes. A helper that returned a fixed word for anything it did not know
   would pass 1 to 4 and fail 5; letting the two surfaces keep separate lists would pass 1 to 5 and
   fail 6.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both runs real:
     · making the lookup case-sensitive again (`_ACT_WORD[raw]` instead of the lowercased key) —
       fails 1 and 2. It does NOT fail 6, and that is the honest shape of these two checks rather
       than a hole: with both screens reading one helper they stay consistent even when the shared
       word is wrong. Check 6 guards against the maps splitting again; checks 1 and 2 guard the
       word itself. Neither covers the other.
     · giving the Clients list back its own inline map — fails 1, 3 and 6, and it is check 3 that
       shows what that costs a reader: `stage_change` goes straight to the screen, in both
       languages, exactly as it did before this round.
   Run: node scripts/qa/probe-the-activity-words-match-the-data.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9230 — one mock. */
const PORT = 9230; const BASE = 'http://localhost:' + PORT;

/* exactly the shapes the live data holds, plus one nobody has ever logged */
const TYPES = ['Note', 'Call', 'Task', 'Won', 'Meeting', 'stage_change'];
const UNKNOWN = 'Zqxsomethingnobodylogs';

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
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

await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

/* one client per type, so the Clients list (which shows only the NEWEST activity) shows them all;
   and one record carrying every type at once, for the timeline. Memory only — writes are blocked. */
const seeded = await p.evaluate(([types, unknown]) => {
  const B = DB.businesses || [];
  const src = B.find((x) => x.isClient) || B[0];
  if (!src) return { ok: false };
  const all = types.concat([unknown]);
  const mk = (id, name, acts) => {
    const c = JSON.parse(JSON.stringify(src));
    c.id = id; c.isClient = true; c.name = name; c.nameAr = name;
    c.activities = acts; if (c.raw) c.raw = {};
    return c;
  };
  all.forEach((t, i) => {
    B.push(mk('qa_act_' + i, 'QAACT ' + i, [{ type: t, note: 'zzmarker' + i, date: Date.now() - 1000 * (i + 1) }]));
  });
  B.push(mk('qa_act_all', 'QAACT all', all.map((t, i) => ({ type: t, note: 'zzall' + i, date: Date.now() - 1000 * (i + 1) }))));
  return { ok: true, seeded: all.length + 1 };
}, [TYPES, UNKNOWN]);
await p.waitForTimeout(500);

const setLang = async (l) => { await p.evaluate((x) => { try { LANG = x; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }, l); await p.waitForTimeout(900); };

/* the list line for one seeded client, read through its own marker so no other row can be mistaken for it */
const listWords = () => p.evaluate(() => {
  const out = {};
  document.querySelectorAll('#view td div').forEach((d) => {
    const t = (d.textContent || '').trim();
    const m = t.match(/^↪\s*(.*?):\s*(zzmarker\d+)/);
    if (m) out[m[2]] = m[1].trim();
  });
  return out;
});
const timelineWords = () => p.evaluate(() => {
  const out = {}; const v = document.querySelector('#view'); if (!v) return out;
  v.querySelectorAll('b').forEach((el) => {
    const row = el.closest('div, li, tr'); if (!row) return;
    const m = (row.textContent || '').match(/(zzall\d+)/);
    if (m) out[m[1]] = (el.textContent || '').trim();
  });
  return out;
});
const pageText = () => p.evaluate(() => ((document.querySelector('#view') || {}).innerText || ''));

const read = async (lang) => {
  await setLang(lang);
  await p.evaluate(() => { try { current = 'clients'; openLead = null; clFilter.q = 'QAACT'; render(); } catch (_) {} });
  await p.waitForTimeout(2200);
  const list = await listWords(); const listTxt = await pageText();
  await p.evaluate(() => { try { openLead = 'qa_act_all'; current = 'leads'; render(); } catch (_) {} });
  await p.waitForTimeout(2600);
  const tl = await timelineWords(); const tlTxt = await pageText();
  return { list, listTxt, tl, tlTxt };
};

const ar = await read('ar');
const en = await read('en');
await b.close(); srv.close?.();

const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const latin = (s) => /[A-Za-z]/.test(String(s || ''));
const idxOf = (t) => TYPES.indexOf(t);
const arList = (t) => ar.list['zzmarker' + idxOf(t)];
const arTl = (t) => ar.tl['zzall' + idxOf(t)];
const enList = (t) => en.list['zzmarker' + idxOf(t)];
const enTl = (t) => en.tl['zzall' + idxOf(t)];
const unknownIdx = TYPES.length;

const translatable = ['Note', 'Call', 'Task', 'Won'];
const checks = [
  ['in Arabic the Clients list translates a capitalised type',
    translatable.every((t) => arList(t) && arabic(arList(t)) && !latin(arList(t))),
    JSON.stringify(translatable.map((t) => t + '→' + arList(t)))],
  ['in Arabic the record timeline translates the same types',
    translatable.every((t) => arTl(t) && arabic(arTl(t)) && !latin(arTl(t))),
    JSON.stringify(translatable.map((t) => t + '→' + arTl(t)))],
  ['stage_change never reaches either screen as itself, in either language',
    ar.listTxt.indexOf('stage_change') < 0 && ar.tlTxt.indexOf('stage_change') < 0 &&
    en.listTxt.indexOf('stage_change') < 0 && en.tlTxt.indexOf('stage_change') < 0 &&
    !!arList('stage_change') && !!enList('stage_change'),
    JSON.stringify({ ar: arList('stage_change'), en: enList('stage_change') })],
  ['in English the ordinary words still read as words',
    translatable.every((t) => enList(t) === t) && translatable.every((t) => enTl(t) === t),
    JSON.stringify(translatable.map((t) => t + '→' + enList(t) + '/' + enTl(t)))],
  ['an unrecognised type falls through to its stored value, not a guess',
    en.list['zzmarker' + unknownIdx] === UNKNOWN && ar.list['zzmarker' + unknownIdx] === UNKNOWN,
    JSON.stringify({ en: en.list['zzmarker' + unknownIdx], ar: ar.list['zzmarker' + unknownIdx] })],
  ['the list and the timeline word the same activity identically',
    TYPES.every((t) => arList(t) && arList(t) === arTl(t)) && TYPES.every((t) => enList(t) === enTl(t)),
    JSON.stringify(TYPES.map((t) => t + ': list ' + arList(t) + ' / timeline ' + arTl(t)))],
  ['the fixture really seeded both surfaces',
    seeded.ok === true && Object.keys(ar.list).length === TYPES.length + 1 && Object.keys(ar.tl).length >= TYPES.length,
    JSON.stringify({ seeded: seeded.seeded, listLines: Object.keys(ar.list).length, timelineRows: Object.keys(ar.tl).length })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
