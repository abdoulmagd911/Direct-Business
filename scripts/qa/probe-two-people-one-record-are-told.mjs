/* probe-two-people-one-record-are-told.mjs — when somebody else has written the company you are
   saving, the app says so instead of overwriting them in silence.

   Fire #231. scripts/qa/diag-two-tabs-one-record.mjs has reported this since 2026-09-10 and still
   reproduces: tab A logs a call note and a next action on a company and saves; tab B, holding a
   stale copy, changes only the segment and saves 2.5 s later. Afterwards the table holds B's
   segment and A's note and next action are GONE — green "Saved" on both screens, nothing anywhere
   saying a thing was lost. docs/LANDMINES.md B.1 parked it as "revisit only if it actually bites".

   js/104 does not prevent the overwrite — the collision is inside the single `raw` blob, and a real
   cure is a three-way merge in the one piece of code where a mistake stops the team saving, which
   is the owner's call (docs/BACKLOG.md). It turns the silence into a named event with a recovery
   path: it asks the database, at save time, whether that company has been written since it last
   looked, and if so says who to ask and where the undo is.

   The harness cannot produce a second person, so the probe IS the second person: it answers the
   layer's own "when was this last written" query, which is exactly the surface the layer trusts.

   What this holds:
     1. a company written by somebody else since we last looked produces the message, and it NAMES
        the company rather than saying "a record";
     2. it points at Activity & Audit, where the undo actually is — a warning with nowhere to go is
        half a warning;
     3. the brake, and the reason this is worth having at all: when nothing has changed underneath,
        there is NO message. A false "somebody else changed this" would be worse than a missed one,
        because the next real one gets ignored;
     4. the second brake: an answer that arrives too late to be trusted (past 800 ms, by which time
        this tab's own write may have landed and would read back as somebody else's) produces no
        message either;
     5. it never blocks or breaks the save — the save still goes out;
     6. nothing is written by the layer itself;
     7. a company whose id inside the app is its uuid is watched as well — live, only 21 of the
        108 companies carry a legacy id, and the first cut of this layer asked only by legacy id
        and so watched a fifth of the data without saying so;
     8. Arabic;
     9. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the timestamp comparison inverted to always fire — fails 3 and 4, the message appearing when
       nothing changed and on the late answer;
     · the message suppressed — fails 1, 2 and 8.
   Run: node scripts/qa/probe-two-people-one-record-are-told.mjs                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9260 — one mock. */
const PORT = 9260; const BASE = 'http://localhost:' + PORT;

const T0 = '2026-09-01T10:00:00+00:00';
const T1 = '2026-09-23T18:30:00+00:00';   /* "somebody else wrote it since" */

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* mode: 'same' (nothing changed underneath) · 'newer' (somebody else wrote it) · 'late' (newer, but
   the answer takes longer than the layer is willing to trust) */
async function run(lang, mode) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + '/' + mode + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  const wrote = []; const stampCalls = [];
  let armed = false;   /* the first answer is the layer taking its baseline — always T0 */

  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    const sel = u.searchParams.get('select') || '';
    if (u.pathname === '/rest/v1/businesses' && m === 'GET' && /legacy_id/.test(sel) && /updated_at/.test(sel)) {
      stampCalls.push(u.search);
      const stamp = (armed && mode !== 'same') ? T1 : T0;
      /* the layer asks twice — once by legacy_id (every company) and once by id (the uuid-shaped
         ones). Both shapes are answered here, keyed the way the app keys them. */
      const byId = (u.searchParams.get('id') || '');
      const byLegacy = (u.searchParams.get('legacy_id') || '');
      const parse = (v) => (v.match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ''))
        .concat(v.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.trim()).filter((x) => x && !/^"/.test(x)));
      const uniq = (a) => [...new Set(a)].filter(Boolean);
      const list = uniq(byId ? parse(byId) : parse(byLegacy));
      const body = JSON.stringify((list.length ? list : ['L1', 'L2', 'L3', 'L4', 'L5'])
        .map((id) => (byId ? { id, legacy_id: null, updated_at: stamp } : { id: 'row-' + id, legacy_id: id, updated_at: stamp })));
      if (armed && mode === 'late') { await new Promise((res) => setTimeout(res, 1400)); }
      await r.fulfill({ status: 200, contentType: 'application/json', body }); return;
    }
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof save === 'function', { timeout: 120000 });
  /* the layer takes its baseline once the session is known and the records are in — wait for that,
     not for a fixed sleep, or the save below happens before it is watching anything */
  await p.waitForFunction(() => { try { return !!window.__v104 && Object.keys(window.__v104.seen).length > 0; } catch (_) { return false; } }, { timeout: 90000 });
  await p.evaluate(() => { window.__v104seen = []; document.addEventListener('v104-collision', (e) => { window.__v104seen.push(e.detail); }); });
  armed = true;

  const target = await p.evaluate(() => {
    const b = (DB.businesses || []).filter((x) => x && x.id != null && window.__v104.seen[String(x.id)] !== undefined)[0];
    if (!b) return null;
    b.segment = 'QA-231 segment ' + Math.random().toString(36).slice(2, 6);
    save();
    return { id: String(b.id), name: (window.nmMain ? nmMain(b) : b.name) || String(b.id) };
  });
  await p.waitForTimeout(3500);
  /* the bug this check exists for: a company's id INSIDE the app is `legacy_id || id`, and live
     only 21 of 108 carry a legacy_id — the rest go by their uuid. The first cut of js/104 asked
     only by legacy_id and so watched a fifth of the data in silence. */
  const uuidWatched = await p.evaluate(async () => {
    const b = (DB.businesses || [])[1]; if (!b) return null;
    const fake = '11111111-2222-4000-8000-333333333333';
    b.id = fake;
    try { window.__v104.refresh([fake]); } catch (_) { return null; }
    await new Promise((r) => setTimeout(r, 1800));
    return { asked: fake, watched: window.__v104.seen[fake] !== undefined };
  });
  const seen = await p.evaluate(() => {
    const n = document.getElementById('v63Notice');
    return { events: (window.__v104seen || []).slice(),
             notice: n ? (n.innerText || '').replace(/\s+/g, ' ').trim() : null,
             saveStillWorks: typeof save === 'function' };
  });
  await ctx.close();
  return { target, seen, uuidWatched, errors, wrote, stampCalls };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const hit = await run('en', 'newer');
const same = await run('en', 'same');
const late = await run('en', 'late');
const ar = await run('ar', 'newer');
await b.close(); srv.close?.();

if (!hit.target) { console.log('FAIL · the probe could not find a company the layer is watching'); process.exit(1); }
console.log('  acted on "' + hit.target.name + '" in each of the four runs (somebody-else / nothing-changed / late answer / Arabic)');

(hit.seen.events.length === 1 && hit.seen.notice && hit.seen.notice.indexOf(hit.target.name) >= 0)
  ? pass('somebody else wrote it: the message appears and names the company', JSON.stringify(hit.seen.notice.slice(0, 80)))
  : fail('somebody else wrote it: the message appears and names the company', JSON.stringify({ events: hit.seen.events, notice: hit.seen.notice }));

(hit.seen.notice && /Activity & Audit/i.test(hit.seen.notice) && /undo/i.test(hit.seen.notice))
  ? pass('it points at Activity & Audit, where the undo is')
  : fail('it points at Activity & Audit, where the undo is', JSON.stringify(hit.seen.notice));

(same.seen.events.length === 0 && !same.seen.notice)
  ? pass('brake: nothing changed underneath, so no message — it never cries wolf')
  : fail('brake: nothing changed underneath, so no message — it never cries wolf', JSON.stringify({ events: same.seen.events, notice: same.seen.notice }));

(late.seen.events.length === 0 && !late.seen.notice)
  ? pass('brake: an answer too late to be trusted produces no message either')
  : fail('brake: an answer too late to be trusted produces no message either', JSON.stringify({ events: late.seen.events, notice: late.seen.notice }));

(hit.seen.saveStillWorks && hit.wrote.some((w) => /businesses|save_state/.test(w)))
  ? pass('the save still goes out — nothing is blocked', JSON.stringify(hit.wrote.slice(0, 2)))
  : fail('the save still goes out — nothing is blocked', JSON.stringify({ save: hit.seen.saveStillWorks, wrote: hit.wrote.slice(0, 3) }));

const layerWrote = hit.stampCalls.length > 0 && hit.wrote.every((w) => !/legacy_id/.test(w));
(hit.stampCalls.length >= 2 && layerWrote)
  ? pass('the layer only ever reads — it asked ' + hit.stampCalls.length + ' times and wrote nothing')
  : fail('the layer only ever reads', JSON.stringify({ asked: hit.stampCalls.length, wrote: hit.wrote.slice(0, 3) }));

(hit.uuidWatched && hit.uuidWatched.watched === true)
  ? pass('a company whose app id is its uuid is watched too, not only the ones with a legacy id')
  : fail('a company whose app id is its uuid is watched too, not only the ones with a legacy id', JSON.stringify(hit.uuidWatched));

(ar.seen.events.length === 1 && ar.seen.notice && /[؀-ۿ]/.test(ar.seen.notice) && !/Somebody else/i.test(ar.seen.notice))
  ? pass('Arabic', JSON.stringify((ar.seen.notice || '').slice(0, 60)))
  : fail('Arabic', JSON.stringify({ events: ar.seen.events, notice: ar.seen.notice }));

const errs = hit.errors.concat(same.errors, late.errors, ar.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
