/* probe-not-loaded-is-not-your-data.mjs — when the companies have not loaded, the app shows nothing
   and says so, instead of presenting the demo records it ships with as the company's pipeline.

   Fire #235. Found by failing one request against the real database. Make the `businesses` read
   answer 500 — or 403, which is what a permission refusal looks like — sign in, and the Leads page
   came up like this:

       0 New this month · 57 In pipeline · 12% · Became clients · 8 of 65

   Sixty-five companies, a full pipeline, stage chips with counts, rows that open — and not one of
   them real. They are the demo records hardcoded in core-01: "Falcon Conferences Group",
   "Crestline Minerals", ids `b_mdd`, `b_maaden`. The database holds 108 companies and none was on
   the screen. A red line did say "Could not load leads: server error" — above a page that looked
   entirely normal.

   And it was measured, not assumed, that a person can actually SEE this: on the failing page the
   sign-in overlay is `display:none`, the working area is 2424px tall, and `elementFromPoint` at the
   middle of the screen returns app content. Nothing is covering it.

   js/02 already sets `window.__bizTableLoaded` only once the real rows arrive, and its comment
   already names this hazard — it was applied to one card on Today and nowhere else.

   What this holds:
     1. with the load refused, the company list shows NO records rather than the demo ones;
     2. it says so, and says it is not an empty list;
     3. it quotes the app's own reason when there is one, so the person can tell a refusal from a
        server fault;
     4. the same in Arabic;
     5. the brake that matters most: on a NORMAL load it does nothing at all — no banner, and every
        record still on screen. A warning that appears when nothing is wrong would be worse than
        the fault it guards;
     6. the second brake: a workspace that genuinely has no companies is NOT told its data failed
        to load — the empty list stays empty and quiet;
     7. nothing is written at any point;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the layer neutered — fails 1, 2, 3 and 4, printing the demo pipeline back on the screen;
     · the `__bizTableLoaded` test inverted — fails SIX of the eight: it neither catches the real
       failure (1-4) nor leaves a healthy page alone (5, 6), and check 6 shows the worst of it, a
       workspace that genuinely has no companies being told its data failed to load.
   Run: node scripts/qa/probe-not-loaded-is-not-your-data.mjs                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9263 — one mock. */
const PORT = 9263; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* mode: 'fail' (the read is refused) · 'ok' (a normal load) · 'none' (a real, empty workspace) */
async function run(lang, mode) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + '/' + mode + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  const wrote = [];
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/businesses' && m === 'GET') {
      if (mode === 'fail') { await r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'permission denied for table businesses' }) }); return; }
      if (mode === 'none') { await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
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
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(9000);
  await p.evaluate(() => { try { current = 'leads'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(3500);

  const seen = await p.evaluate(() => {
    const v = document.getElementById('view');
    const probe = window.__v105Probe ? window.__v105Probe() : null;
    const t = (v && v.innerText) || '';
    return { probe,
      demoOnScreen: /Falcon Conferences|Crestline Minerals|b_mdd/.test(t),
      rows: v ? v.querySelectorAll('table tbody tr').length : -1,
      /* the measurement that decided this was a real defect and not a code reading */
      coveredUp: (function () { try { const ov = document.getElementById('ov');
        if (!ov) return false; const cs = getComputedStyle(ov);
        return cs.display !== 'none' && ov.offsetHeight > 0; } catch (_) { return null; } })() };
  });
  await ctx.close();
  return { seen, errors, wrote };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const failEn = await run('en', 'fail');
const failAr = await run('ar', 'fail');
const okEn = await run('en', 'ok');
const noneEn = await run('en', 'none');
await b.close(); srv.close?.();

console.log('  four runs: the read refused (EN and AR), a normal load, and a workspace that really is empty');

(failEn.seen.probe && failEn.seen.probe.shown === 0 && !failEn.seen.demoOnScreen && failEn.seen.probe.held > 0)
  ? pass('the read is refused: no demo record is shown', 'held ' + failEn.seen.probe.held + ' aside, showing ' + failEn.seen.probe.shown)
  : fail('the read is refused: no demo record is shown', JSON.stringify(failEn.seen));

(failEn.seen.probe && failEn.seen.probe.banner && /not loaded/i.test(failEn.seen.probe.text || '') && /not because you have none/i.test(failEn.seen.probe.text || ''))
  ? pass('it says so, and says it is not an empty list')
  : fail('it says so, and says it is not an empty list', JSON.stringify(failEn.seen.probe));

(failEn.seen.probe && /permission denied/i.test(failEn.seen.probe.text || ''))
  ? pass('it quotes the app\'s own reason — a refusal reads differently from a server fault')
  : fail('it quotes the app\'s own reason — a refusal reads differently from a server fault', JSON.stringify((failEn.seen.probe || {}).text));

(failAr.seen.probe && failAr.seen.probe.banner && /[؀-ۿ]/.test(failAr.seen.probe.text || '') && failAr.seen.probe.shown === 0)
  ? pass('Arabic', JSON.stringify((failAr.seen.probe.text || '').slice(0, 60)))
  : fail('Arabic', JSON.stringify(failAr.seen.probe));

(okEn.seen.probe && okEn.seen.probe.banner === false && okEn.seen.probe.loaded === true && okEn.seen.probe.shown > 0 && okEn.seen.rows > 0)
  ? pass('brake: a normal load is untouched — no banner, every record still there', okEn.seen.probe.shown + ' records, ' + okEn.seen.rows + ' rows')
  : fail('brake: a normal load is untouched — no banner, every record still there', JSON.stringify({ probe: okEn.seen.probe, rows: okEn.seen.rows }));

(noneEn.seen.probe && noneEn.seen.probe.banner === false && noneEn.seen.probe.loaded === true)
  ? pass('brake: a workspace that really is empty is not told its data failed to load')
  : fail('brake: a workspace that really is empty is not told its data failed to load', JSON.stringify(noneEn.seen.probe));

const wrote = failEn.wrote.concat(failAr.wrote, okEn.wrote, noneEn.wrote).filter((w) => /businesses/.test(w));
wrote.length === 0 ? pass('nothing was written at any point')
                   : fail('nothing was written at any point', JSON.stringify(wrote.slice(0, 2)));

const errs = failEn.errors.concat(failAr.errors, okEn.errors, noneEn.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
