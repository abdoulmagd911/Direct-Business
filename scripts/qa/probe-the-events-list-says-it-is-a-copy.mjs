/* probe-the-events-list-says-it-is-a-copy.mjs — a stale list is fine; a stale list pretending to be
   fresh is not.

   Fire #159, under rule M27. The Events tab keeps a copy of the calendar inside the workspace blob,
   and when its refresh fails it quietly serves that copy: `DB.ksaEvents = DB.ksaEvents || []`, no
   word said. Measured live on 2026-09-21 the page looked **identical** with the fetch failing — 80
   events either way — because the copy is rewritten on every save and currently agrees with the
   table. So this was not a lie yet. It becomes one the moment somebody adds or changes an event
   anywhere else, and nothing on the screen would ever say which list you are reading.

   The answer here is NOT the one the Ledger got. Money is the case where nothing is drawn at all;
   this is a calendar, and a cached calendar is genuinely useful with no connection. So the copy is
   still shown — and the page now says it is a copy, and offers to fetch again.

   What this holds:
     1. with the refresh working there is no notice and the events are listed — the ordinary state;
     2. when a later refresh FAILS, the notice appears and says what happened;
     3. and the cached events are STILL on screen — the notice must not cost you the list;
     4. there is a way to try again;
     5. it says all of it in Arabic;
     6. no JS errors.

   Check 3 is the one that keeps the fix honest. The cheap way to pass 2 is to replace the page with
   an error, which would take away the only copy of the calendar the browser has.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): dropping the
   `loadError` assignment in js/10 — a failed refresh silently keeping the old list again — fails
   checks 2, 4 and 5.
   Run: node scripts/qa/probe-the-events-list-says-it-is-a-copy.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9110; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(lang) {
  let breakIt = false;                       /* flipped after the first good load */
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (breakIt && /\/rest\/v1\/ksa_events\b/.test(u.pathname) && ['GET', 'HEAD'].includes(m)) {
      await r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'simulated outage' }) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { openLead = null; current = 'events'; render(); } catch (_) { } });
  await p.waitForTimeout(3000);

  const read = () => p.evaluate(() => {
    const v = document.getElementById('view');
    return { txt: (v.innerText || '').replace(/\s+/g, ' '), rows: v.querySelectorAll('tbody tr').length,
      retry: !!document.getElementById('ev_retry'),
      cached: (typeof DB !== 'undefined' && DB.ksaEvents) ? DB.ksaEvents.length : -1 };
  });
  const before = await read();

  /* now break the refresh and ask for one, the way the person would */
  breakIt = true;
  /* the layer's own door — `loaded`/`loadAll` live inside its closure and are not reachable from
     here, which is why js/10 exposes one refresh hook rather than a probe poking at globals that
     would silently create new ones instead */
  await p.evaluate(() => { try { window.__evReload(); } catch (_) { } });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { try { current = 'events'; render(); } catch (_) { } });
  await p.waitForTimeout(1500);
  const after = await read();
  await ctx.close();
  return { before, after };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const NOTICE_EN = /could not refresh the events/i;
const NOTICE_AR = /تعذّر تحديث/;      /* «تعذّر تحديث» */
const checks = [
  ['with the refresh working there is no notice, and the events are listed',
    !NOTICE_EN.test(en.before.txt) && en.before.rows >= 3, 'rows ' + en.before.rows],
  ['when a later refresh fails, the notice appears and says what happened',
    NOTICE_EN.test(en.after.txt), (en.after.txt.match(/Could not refresh[^.]{0,60}/) || [''])[0]],
  ['and the cached events are still on screen — the notice must not cost you the list',
    en.after.rows >= en.before.rows && en.after.cached === en.before.cached,
    'rows ' + en.before.rows + ' → ' + en.after.rows + ', held ' + en.before.cached + ' → ' + en.after.cached],
  ['there is a way to try again', en.after.retry, JSON.stringify(en.after.retry)],
  ['it says all of it in Arabic',
    NOTICE_AR.test(ar.after.txt) && ar.after.rows >= ar.before.rows, ar.after.txt.slice(0, 80)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
