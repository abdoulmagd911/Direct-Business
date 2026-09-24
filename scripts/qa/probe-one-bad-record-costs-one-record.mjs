/* probe-one-bad-record-costs-one-record.mjs — a record the app cannot read costs that record, not
   the whole list, and a shorter list says so.

   Fire #237. Found by handing the app five malformed rows with a 200 — the shapes a real import or
   a hand-written SQL update produces: a null name, a stage that is not a stage, text where a number
   belongs, "32/13/2026" in a date, and a **null inside an activities array**.

   The app ended with **zero companies**. Not five, not four — none. `__bizTableLoaded` was never
   set and nothing on screen said why; the only trace was a console warning nobody reads:

       v32 load merge issue TypeError: Cannot read properties of null (reading 'date')

   `rowToApp` assumed every entry in an activities array is an object, the throw escaped
   `rows.map(rowToApp)`, and the outer try/catch swallowed it. One unreadable row would have taken
   all 108 real companies with it.

   Three things were wrong and all three are fixed:
     · the converter no longer assumes an activity is an object;
     · the loader maps each row on its own, so a row it cannot read is skipped rather than fatal;
     · a skipped row is COUNTED and said, because a quietly shorter list is the fault this codebase
       keeps paying for (M27, M74).
   The same null also killed a render wrapper in core-02 — two null-unsafe copies of the same
   sort — and both are guarded.

   What this holds:
     1. five malformed rows all load — the count is five, not zero;
     2. the app knows it loaded them (`__bizTableLoaded`), so nothing downstream treats them as a
        failed load;
     3. no page prints "undefined", "NaN", "Invalid Date" or "[object Object]" from them — checked
        on Leads, Clients, Today and Reports, in both languages. This is where a second defect
        turned up: `fmtAgo` assumed it was given a number, so a record carrying "soon" as its last
        contact read «قبل NaN ي» in Arabic and "NaNd ago" in English;
     4. nothing throws, in the page or the console, in either language;
     5. a row that genuinely cannot be converted costs ONLY itself: the others still load;
     6. and the list says how many were skipped, rather than being quietly short;
     7. the brake: with every row clean, nothing is skipped and no such line appears.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), three real runs:
     · the per-row guard removed (back to `rows.map(rowToApp)`) — fails 5 and 6: one bad row and
       the list is empty (n:0, loaded:false) with nothing said. Checks 1-4 still pass there, because
       the converter fix alone keeps the five MALFORMED rows readable — which is why the poison row
       is a separate case;
     · the skipped count never shown — fails 6 alone: the list is quietly one record short;
     · the `fmtAgo` guard removed — fails 3, printing "NaNd ago" and «قبل NaN ي».
   Run: node scripts/qa/probe-one-bad-record-costs-one-record.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9264 — one mock. */
const PORT = 9264; const BASE = 'http://localhost:' + PORT;

const mk = (n, extra) => Object.assign({
  id: '00000000-0000-4000-8000-00000000000' + n, legacy_id: 'QA237-' + n, name: 'QA237 row ' + n,
  stage: 'new', is_client: false, archived_at: null, raw: {}, created_at: '2026-09-01T00:00:00+00:00',
}, extra || {});

/* the shapes an import or a hand-written SQL update really produces */
const MALFORMED = [
  mk(1, { name: null, name_ar: null }),
  mk(2, { stage: 'not_a_stage' }),
  mk(3, { total_sar: 'not a number', credit_limit: 'abc', raw: { totalSAR: 'oops', dealValue: null } }),
  mk(4, { next_action_date: '32/13/2026', contract_end: 'yesterday', created_at: 'not-a-date', raw: { lastContact: 'soon' } }),
  mk(5, { is_client: true, raw: { contacts: [null, { name: null, email: null }], activities: [null, { date: 'nope', note: null }] } }),
];
/* One row the converter genuinely cannot read, and it has to be ordinary JSON: a first attempt used
   a throwing getter, which broke this probe's OWN JSON.stringify before the app ever saw it.
   `activities` as a string passes the converter's `&& o.activities.length` test — a string has a
   length — and then `.forEach` is not a function. That is a real import shape, not a contrivance. */
const POISON = mk(6, { raw: { activities: 'not an array' } });
const CLEAN = [mk(7), mk(8)];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang, rows) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  const noisy = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') {
    const t = m.text(); if (/Cannot read|is not a function|undefined is not|merge issue/i.test(t)) noisy.push(t.slice(0, 120)); } });
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/businesses' && m === 'GET' && !/archived_at=not/.test(u.search)) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }); return; }
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(14000);

  const pages = ['leads', 'clients', 'today', 'reports'];
  const badTokens = {};
  for (const pg of pages) {
    await p.evaluate((r) => { try { current = r; openLead = null; render(); } catch (_) {} }, pg);
    await p.waitForTimeout(2200);
    badTokens[pg] = await p.evaluate(() => {
      const t = (document.getElementById('view').innerText || '');
      /* no \b around NaN: "NaNd ago" has no word boundary after it, and that is exactly how the
         English side of this defect read — the first version of this check saw Arabic only. */
      return (t.match(/[^\n]*(undefined|NaN|Invalid Date|\[object Object\])[^\n]*/g) || []).slice(0, 3).map((x) => x.trim().slice(0, 70));
    });
  }
  await p.evaluate(() => { try { current = 'leads'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(1800);
  const state = await p.evaluate(() => {
    let probe = null; try { probe = window.__v105Probe ? window.__v105Probe() : null; } catch (_) {}
    return { n: (DB.businesses || []).length, loaded: window.__bizTableLoaded === true,
             skipped: Number(window.__bizSkipped || 0), probe };
  });
  await ctx.close();
  return { state, badTokens, errors, noisy };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en', MALFORMED);
const ar = await run('ar', MALFORMED);
const poisoned = await run('en', CLEAN.concat([POISON]));
const clean = await run('en', CLEAN);
await b.close(); srv.close?.();

console.log('  four runs: five malformed rows (EN and AR), a row nothing can convert beside two good ones, and two clean rows');

(en.state.n === MALFORMED.length)
  ? pass('all five malformed rows load — the count is five, not zero', en.state.n + ' records')
  : fail('all five malformed rows load — the count is five, not zero', JSON.stringify(en.state));

(en.state.loaded === true)
  ? pass('the app knows it loaded them, so nothing downstream reads it as a failed load')
  : fail('the app knows it loaded them, so nothing downstream reads it as a failed load', JSON.stringify(en.state));

const tok = Object.keys(en.badTokens).filter((k) => en.badTokens[k].length)
  .concat(Object.keys(ar.badTokens).filter((k) => ar.badTokens[k].length));
tok.length === 0
  ? pass('no page prints undefined, NaN, Invalid Date or [object Object] from them', 'Leads, Clients, Today and Reports, both languages')
  : fail('no page prints undefined, NaN, Invalid Date or [object Object] from them', JSON.stringify({ en: en.badTokens, ar: ar.badTokens }));

const noise = en.errors.concat(ar.errors, en.noisy, ar.noisy);
noise.length === 0
  ? pass('nothing throws, in the page or the console, in either language')
  : fail('nothing throws, in the page or the console, in either language', JSON.stringify(noise.slice(0, 2)));

(poisoned.state.n === CLEAN.length && poisoned.state.skipped === 1)
  ? pass('a row that genuinely cannot be converted costs only itself', poisoned.state.n + ' of ' + (CLEAN.length + 1) + ' loaded, 1 skipped')
  : fail('a row that genuinely cannot be converted costs only itself', JSON.stringify(poisoned.state));

(poisoned.state.probe && /could not be read/i.test(poisoned.state.probe.skippedNote || ''))
  ? pass('and the list says how many were skipped', JSON.stringify((poisoned.state.probe.skippedNote || '').slice(0, 70)))
  : fail('and the list says how many were skipped', JSON.stringify((poisoned.state.probe || {}).skippedNote));

(clean.state.skipped === 0 && clean.state.n === CLEAN.length && !(clean.state.probe || {}).skippedNote)
  ? pass('brake: with every row clean nothing is skipped and no such line appears')
  : fail('brake: with every row clean nothing is skipped and no such line appears', JSON.stringify(clean.state));

process.exit(bad.length ? 1 : 0);
