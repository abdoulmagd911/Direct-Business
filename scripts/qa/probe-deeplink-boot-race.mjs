/* probe-deeplink-boot-race.mjs (2026-09-06, round 58) — a /documents/<tab> deep link must
   survive on a slow device.

   Watch cycle 35 traced six cycles of "probe-generator-attacks is environmental" to a real race:
   index.html loads 68 blocking scripts in order; js/03 (14th) captures the boot address and then
   on a 200ms timer rewrites location.pathname to '/' + current — 'today', because nobody is
   signed in yet — while js/66 (~55th) reads location.pathname at its own evaluation time to
   decide which editor the link asked for. Whichever gets there first wins. Neither file is wrong
   alone; the defect exists only in the order they run in.

   probe-generator-attacks can only catch this by accident, when the machine happens to be busy
   enough. This probe makes it deterministic: it throttles the CPU over CDP and asks the same
   question at each rate. 1x is a desktop, 4x an ordinary mid-range phone, 6x+ a cheap one.

   THE RATE AT WHICH IT FLIPS IS A PROPERTY OF THE MACHINE, NOT OF THE APP (watch cycle 36).
   Round 58 measured the loss from 4x; cycle 35 measured it from 6x. Both were run honestly and
   both are right about their own host — CPU throttling only makes script execution slow enough
   for js/03's 200ms timer to beat js/66, and how slow that has to be depends on the box. The
   consequence matters more than the number: re-measured here on the pre-fix tree with THIS
   probe, four consecutive runs, 4x survived every time and 10x was lost every time — so on this
   host the 4x check PASSES ON THE BROKEN TREE. Sabotage confirms it: remove js/66's fallback,
   or js/03's publish, and only the 10x check goes red. A fixed rate gives a check that may or
   may not be able to fail, and nothing in its output says which.

   So the rate checks are kept as breadth — they cost little and a slower host will bite at 4x —
   and the guarantee is asserted a second way that cannot depend on the host at all: HOLD JS/66
   BACK. Delaying only that one script's response forces the exact losing order (js/03's timer
   first, js/66 evaluated after) on any machine, at 1x, with no throttle. Measured: pre-fix tree
   LOST, fixed tree SURVIVED, every time.

   Under test:
     1. A control at 1x — the link must work on a fast machine, or nothing below means anything.
     2. Every throttle rate lands in the editor the address asked for (breadth; may be vacuous
        on a fast host, which the output now says out loud).
     3. THE DETERMINISTIC ONE: with js/66's own response held back so js/03 is guaranteed to
        rewrite the address first, the link still lands in the editor it asked for.
     4. A control on that: the same run with nothing held back must still land, or the held-back
        result is about the delay rather than about the order.
     5. js/03 really publishes window.__bootPath (the half js/66's fallback depends on).

   Run:  node scripts/qa/probe-deeplink-boot-race.mjs        (port 8713)
   Sabotage (file-level, and BOTH halves must be tried separately — each one alone reopens it):
     · remove the __bootPath fallback from js/66's boot IIFE  → held-back check red (+ 10x here);
     · remove `window.__bootPath=boot` from js/03             → held-back + publish checks red.
   Restore byte-identical (md5). See docs/DEEPLINK-BOOT-RACE.md. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8713;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);

const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
/* 1x proves the control; 4x is where it started failing in the wild; 10x is a cheap phone. */
const RATES = [1, 4, 10];
const WANT = 'contract';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* One boot of the app at a deep link. `rate` throttles the CPU; `holdJs66` holds back the
   response for js/66 alone by that many ms, which forces js/03's 200ms timer to win the race
   deterministically — the same losing order a slow phone reaches by accident. */
async function open1(b, { rate = 1, holdJs66 = 0 } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  if (holdJs66) await p.route('**/js/66-*.js', async (r) => { await sleep(holdJs66); await r.continue(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  /* every wait scales with the throttle — a slow machine is slow at everything, and a probe
     that does not wait proportionally measures its own impatience instead of the app */
  const w = (ms) => p.waitForTimeout(ms * Math.max(1, rate / 2) + holdJs66);
  await p.goto(BASE + '/documents/' + WANT, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await w(2000);
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await w(4000);
  const got = await p.evaluate(() => { try { return (window.__dgTabProbe ? __dgTabProbe() : (window.DG && DG.tab)) || null; } catch (_) { return 'threw'; } });
  const boot = await p.evaluate(() => window.__bootPath || null);
  await ctx.close();
  return { got, boot };
}

async function main() {
  console.log(`asking for /documents/${WANT} at CPU throttle ${RATES.join('x, ')}x, and with js/66 held back`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const seen = [];
  for (const rate of RATES) seen.push({ rate, ...(await open1(b, { rate })) });
  /* the deterministic pair: same rate, same waits, the only difference is WHEN js/66 arrives */
  const free = await open1(b, { rate: 1, holdJs66: 0 });
  const held = await open1(b, { rate: 1, holdJs66: 1500 });
  await b.close();

  const control = seen.find(s => s.rate === 1);
  if (control && control.got === WANT) ok(`control: on a fast machine (1x) the deep link opens the ${WANT} editor — so a failure below is about the slow ones, not about the link`);
  else { fail(`control: the deep link did not work even at 1x (got ${JSON.stringify(control && control.got)}) — every check below would fail for the wrong reason`); }

  for (const s of seen.filter(x => x.rate !== 1)) {
    if (s.got === WANT) ok(`at ${s.rate}x CPU throttle the deep link still opens the ${WANT} editor`);
    else fail(`at ${s.rate}x CPU throttle the deep link is LOST — the editor opened on "${s.got}". Someone pasted /documents/${WANT} into an email, the person opened it on a phone, signed in, and landed somewhere else with nothing saying an address was ever asked for. js/03 rewrote location.pathname before js/66 was evaluated; see docs/DEEPLINK-BOOT-RACE.md`);
  }

  /* Check 3 + its control. This pair does not care how fast the machine is: holding back one
     script's response puts js/03's rewrite before js/66's evaluation every time, on any box. */
  if (free.got === WANT) ok(`control: with nothing held back the link opens the ${WANT} editor, so a failure below is about the ORDER the scripts arrived in and not about the delay`);
  else fail(`control: the link did not open even with nothing held back (got ${JSON.stringify(free.got)}) — the held-back result below would mean nothing`);

  if (held.got === WANT) ok(`js/66 held back 1500ms — js/03 rewrote the address first, and the link STILL opens the ${WANT} editor`);
  else fail(`js/66 held back 1500ms and the link is LOST — the editor opened on "${held.got}". This is the race itself, forced rather than waited for: js/03's 200ms timer rewrote location.pathname to '/today' before js/66 was evaluated, and js/66 had nothing else to read. Every deep link into /documents/<tab> is lost on any device slow enough to produce this order; see docs/DEEPLINK-BOOT-RACE.md`);

  /* Say out loud when a rate check proved nothing, so a green is not mistaken for evidence.
     On a fast host the low rates pass on a BROKEN tree too — measured, watch cycle 36. */
  const bitten = seen.filter(s => s.rate !== 1 && s.got !== WANT).length;
  if (!bitten) console.log(`  · note: every throttled rate passed, so none of them proved anything on this host — on a fast box the low rates pass on a broken tree as well. The held-back check above is the one that bites here.`);

  const published = seen.every(s => s.boot === '/documents/' + WANT) && held.boot === '/documents/' + WANT;
  if (published) ok('js/03 publishes window.__bootPath at every rate — the address the page opened at survives even after location.pathname has been rewritten');
  else fail(`window.__bootPath is missing or wrong: ${JSON.stringify(seen.map(s => [s.rate + 'x', s.boot]))} — js/66's fallback has nothing to fall back to`);

  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
