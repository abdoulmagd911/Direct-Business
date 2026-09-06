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

   MEASURED ON THE TREE BEFORE THE FIX: the link survived at 1x and was lost from 4x up — one
   step earlier than cycle 35's own table, which recorded 6x. Most people are not on 1x.

   Under test:
     1. A control at 1x — the link must work on a fast machine, or nothing below means anything.
     2. Every throttle rate lands in the editor the address asked for.
     3. js/03 really publishes window.__bootPath (the half js/66's fallback depends on).

   Run:  node scripts/qa/probe-deeplink-boot-race.mjs        (port 8713)
   Sabotage (file-level, and BOTH halves must be tried separately — each one alone reopens it):
     · remove the __bootPath fallback from js/66's boot IIFE;
     · remove `window.__bootPath=boot` from js/03.
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

async function main() {
  console.log(`asking for /documents/${WANT} at CPU throttle ${RATES.join('x, ')}x`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const seen = [];
  for (const rate of RATES) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
    await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await p.route('**fonts.gstatic.com/**', r => r.abort());
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
    const w = (ms) => p.waitForTimeout(ms * Math.max(1, rate / 2));
    await p.goto(BASE + '/documents/' + WANT, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await w(2000);
    try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
    await w(4000);
    const got = await p.evaluate(() => { try { return (window.__dgTabProbe ? __dgTabProbe() : (window.DG && DG.tab)) || null; } catch (_) { return 'threw'; } });
    const boot = await p.evaluate(() => window.__bootPath || null);
    seen.push({ rate, got, boot });
    await ctx.close();
  }
  await b.close();

  const control = seen.find(s => s.rate === 1);
  if (control && control.got === WANT) ok(`control: on a fast machine (1x) the deep link opens the ${WANT} editor — so a failure below is about the slow ones, not about the link`);
  else { fail(`control: the deep link did not work even at 1x (got ${JSON.stringify(control && control.got)}) — every check below would fail for the wrong reason`); }

  for (const s of seen.filter(x => x.rate !== 1)) {
    if (s.got === WANT) ok(`at ${s.rate}x CPU throttle the deep link still opens the ${WANT} editor`);
    else fail(`at ${s.rate}x CPU throttle the deep link is LOST — the editor opened on "${s.got}". Someone pasted /documents/${WANT} into an email, the person opened it on a phone, signed in, and landed somewhere else with nothing saying an address was ever asked for. js/03 rewrote location.pathname before js/66 was evaluated; see docs/DEEPLINK-BOOT-RACE.md`);
  }

  const published = seen.every(s => s.boot === '/documents/' + WANT);
  if (published) ok('js/03 publishes window.__bootPath at every rate — the address the page opened at survives even after location.pathname has been rewritten');
  else fail(`window.__bootPath is missing or wrong: ${JSON.stringify(seen.map(s => [s.rate + 'x', s.boot]))} — js/66's fallback has nothing to fall back to`);

  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
