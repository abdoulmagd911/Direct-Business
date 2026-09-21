/* probe-one-workspace-copy-not-three.mjs — the browser keeps ONE copy of the workspace, so the
   app's own "storage full" failure stays three times further away.

   Fire #193. Measured against the pre-fix code, driving the app against the REAL database
   (108 businesses, 28 clients), in a browser that had used the app before and was sitting at the
   sign-in screen:

       directBusinessData_v29   768,721 characters   ← the live key, the one `load()` reads first
       directBusinessData_v25   767,970 characters   ← never read ANYWHERE in the codebase
       directBusinessData_v24   767,970 characters   ← read once, and only when v29 is absent
       ------------------------------------------
       2,304,723 characters carried where 768,783 was needed — about 2.3 MB of a cap that is
       commonly 5 MB. After the fix, the same browser against the same database: 768,783.

   THIS PROBE RUNS AGAINST THE QA MOCK, not that database — it is a battery probe and has to be
   hermetic and fast. The mock's workspace is smaller (one copy ≈ 293 KB, three ≈ 712 KB), so the
   ceiling below is sized for the mock. The defect is in the app's own code and is data-independent;
   the live figures above cost four times more and were measured separately, with the bridge recipe
   in CLAUDE.md (`proxy:{server:'direct://'}` and a fetch to the real host). The first draft of this
   header called the signed-in half of the probe a live-database session. It is not, and the gap
   between 712,000 and 2,304,723 characters is exactly why that sentence had to go.

   Traced to source: js/core/core-08's v25.2 storage-migration block wrote a full copy of the
   workspace into BOTH dead keys on every single page load, and `v25TemplateLearn` wrote v25 again.
   Nine such writes were left over from the June v24 → v25 → v29 migrations; all nine are gone.

   Why it is worth a guard rather than a shrug: `save()` in core-01 has an explicit failure for
   exactly this — *"Storage full - changes kept in memory only. Export a JSON backup and clear old
   data."* A browser gives an origin a few megabytes. Carrying the workspace three times over brings
   that moment three times closer, and when it arrives a person keeps working while nothing reaches
   disk. That is the app's own named failure, not tidiness.

   Note on who cleans up after the fix: js/02's cloud layer already removes every
   `directBusinessData_v<n>` key on each successful sign-in, so a browser that still carries the two
   dead copies today is emptied the next time its owner signs in. Nothing extra was added for that —
   a second layer doing js/02's job was written, then measured with itself removed, found to change
   the stored bytes not at all, and deleted rather than shipped.

   What this holds:
     1. at the sign-in screen, a browser that has used the app before holds the live key and
        NEITHER dead key;
     2. the live key still parses and still carries the workspace — the saving must not cost the
        thing it is protecting;
     3. the whole store stays near one copy, not three — measured in characters, so a write that
        comes back in a different shape is still caught;
     4. after a signed-in session, the dead keys are absent there too,
        and a session that arrives carrying them has them cleared;
     5. the signed-in browser still holds its live key and its auth token — nobody is signed out to
        save space;
     6. no other key is touched: the small neighbour settings keys survive in both browsers;
     7. no file under js/ writes the dead keys any more — checked in the source, with comments
        stripped, so a re-introduction is caught even if the runtime path moves;
     8. no JS errors in either browser.

   Checks 2, 5 and 6 are the brakes, against the lazy version of this fix — just clear the store.
   That was written and actually run: it fails all three, destroying the browser's working copy and
   signing the person out (and takes 1 and 3 down with it, since the live copy goes too).

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting back the
   two migration writes at js/core/core-08-v25.js:463-464 fails checks 1, 3 and 7 — 711,508
   characters against a 500,000 ceiling.
   Run: node scripts/qa/probe-one-workspace-copy-not-three.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const APP = process.env.APP_DIR || process.cwd();
/* PORTS_RESERVED: 9225-9226 — two mocks: PORT (the sign-in screen), PORT+1 (a signed-in session). */
const PORT = 9225;

const LIVE = 'directBusinessData_v29';
const DEAD = ['directBusinessData_v25', 'directBusinessData_v24'];
const OTHER = 'directBusinessBackupDest_v24';          /* a small neighbour that must survive */
const AUTH = 'sb-vkxoeeoauexyfpzqufqd-auth-token';

/* a browser that has used the app before: a real-shaped v29 already on disk */
const PRIOR_V29 = JSON.stringify({ schemaVersion: 29,
  businesses: Array.from({ length: 60 }, (_, i) => ({ id: 'b' + i, name: 'Row ' + i, pad: 'x'.repeat(400) })) });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function open(port, { signIn, seed }) {
  const srv = start(port, {});
  const base = 'http://localhost:' + port;
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    if (!signIn) { await r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }); return; }
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    /* block only table writes and the save rpcs — the app LOADS through POST rpcs */
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(base + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  /* seed the browser BEFORE the app runs */
  await p.addInitScript((s) => { try { Object.keys(s).forEach((k) => localStorage.setItem(k, s[k])); } catch (_) {} }, seed);
  await p.goto(base + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (signIn) {
    await p.waitForSelector('#cl_email', { timeout: 60000 });
    await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
    await p.waitForTimeout(4000);
    /* a person working writes the browser copy — do what they do */
    await p.evaluate(() => { try { if (typeof save === 'function') save(); } catch (_) {} });
  }
  await p.waitForTimeout(9000);

  const out = await p.evaluate(([live, dead, other, auth]) => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) total += (localStorage.getItem(localStorage.key(i)) || '').length;
    let liveOk = false, liveHasBiz = false, liveLen = 0;
    try {
      const raw = localStorage.getItem(live) || ''; liveLen = raw.length;
      const o = JSON.parse(raw || 'null');
      liveOk = !!(o && typeof o === 'object'); liveHasBiz = !!(o && Array.isArray(o.businesses));
    } catch (_) {}
    return { total, liveLen, liveOk, liveHasBiz,
      livePresent: localStorage.getItem(live) != null,
      deadPresent: dead.filter((k) => localStorage.getItem(k) != null),
      otherPresent: localStorage.getItem(other) != null,
      authPresent: localStorage.getItem(auth) != null };
  }, [LIVE, DEAD, OTHER, AUTH]);
  await ctx.close(); srv.close?.();
  return out;
}

const seedGuest = { [LIVE]: PRIOR_V29, [OTHER]: 'keep-me' };
const guest = await open(PORT, { signIn: false, seed: seedGuest });

const seedSignedIn = { [OTHER]: 'keep-me' };
DEAD.forEach((k) => { seedSignedIn[k] = JSON.stringify({ businesses: [], stale: 'x'.repeat(3000) }); });
const signedIn = await open(PORT + 1, { signIn: true, seed: seedSignedIn });
await b.close();

/* source check: nothing under js/ may write the dead keys again */
const decomment = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const writes = /setItem\s*\(\s*(V25_KEY|V24_KEY|['"]directBusinessData_v2[45]['"])/;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : (/\.js$/.test(e.name) ? [path.join(d, e.name)] : []));
const writers = walk(path.join(APP, 'js'))
  .filter((f) => { try { return writes.test(decomment(fs.readFileSync(f, 'utf8'))); } catch (_) { return false; } })
  .map((f) => path.relative(APP, f));

/* one copy is ~293 KB; three were ~712 KB. Anything past half a megabyte is a second copy. */
const ONE_COPY_CEILING = 500000;

const checks = [
  ['at the sign-in screen the browser holds the live key and neither dead key',
    guest.livePresent && guest.deadPresent.length === 0,
    JSON.stringify({ live: guest.livePresent, deadLeft: guest.deadPresent })],
  ['the live key still parses and still carries the workspace',
    guest.liveOk && guest.liveHasBiz && signedIn.liveOk && signedIn.liveHasBiz,
    JSON.stringify({ guest: guest.liveLen, signedIn: signedIn.liveLen })],
  ['the whole store stays near one copy, not three',
    guest.total > 0 && guest.total < ONE_COPY_CEILING,
    guest.total + ' characters (one copy ' + guest.liveLen + ', ceiling ' + ONE_COPY_CEILING + ')'],
  ['after a signed-in session the dead keys are gone there too',
    signedIn.deadPresent.length === 0, JSON.stringify({ deadLeft: signedIn.deadPresent })],
  ['the signed-in browser keeps its live key and its auth token',
    signedIn.livePresent && signedIn.authPresent,
    JSON.stringify({ live: signedIn.livePresent, auth: signedIn.authPresent })],
  ['no other key is touched', guest.otherPresent && signedIn.otherPresent,
    JSON.stringify({ guest: guest.otherPresent, signedIn: signedIn.otherPresent })],
  ['no file under js/ writes the dead keys any more', writers.length === 0, writers.join(', ') || 'none'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
