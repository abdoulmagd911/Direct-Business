/* probe-sync-badge-honest.mjs (2026-09-07, round 64) — the badge in the top bar must report the
   connection, not decorate it.

   It used to read "Live · 44s" with a green dot. That was invented: core-09 built the text as
   `'Live · ' + Math.floor(Math.random()*50+10) + 's'`, a fresh random number on every render,
   wired to nothing. Found by opening the app with the network cut. The app itself behaves well
   offline — the session holds and every company renders from the device — and the one element on
   screen that talks about the connection was saying "Live · 58s" while nothing had reached the
   server at all.

   It matters more than a cosmetic slip because of round 63: the app now deliberately keeps
   working through a dead spot instead of reloading, and the notice it shows tells the person to
   watch this badge. A badge that always says Live makes that instruction worthless, and someone
   in a hotel with no signal closes the tab believing their work went out.

   Under test:
     1. The badge never shows the invented form again — no "Live · <n>s", in either language.
     2. It follows the connection: after a confirmed save it says synced and is green; with saves
        answering 503 it says NOT synced, names that the work is on the device, and is red.
     3. It recovers: once saves succeed again it returns to synced and green.
     4. The age is real, not random: read twice about ten seconds apart with nothing happening in
        between, the reported age must have GROWN by roughly that much. A random number would not,
        and neither would a frozen one.
     5. Arabic.
     6. A control that this probe can fail: the badge element must actually be found. Reading a
        missing element would let every check above pass by vacuity.

   Run:  node scripts/qa/probe-sync-badge-honest.mjs        (port 9025)
   Sabotage (file-level): delete js/75's `paint()` call sites (the render wrap and the interval),
   and core-09's invented text comes straight back — checks 1, 2, 3 and 4 go red. Restore
   byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9025;
const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const srv = start(PORT);
const INVENTED = /(Live|مباشر)\s*·\s*(قبل\s*)?\d+\s*(s|ث)/;
let down = false;

const readBadge = (p) => p.evaluate(() => {
  const el = document.getElementById('v26_3SyncPill');
  const dot = el && el.querySelector('.dot');
  return {
    found: !!el,
    text: el ? el.textContent.trim() : null,
    dot: dot ? (getComputedStyle(dot).backgroundColor || '') : null,
    state: window.__syncBadgeState ? window.__syncBadgeState() : null,
  };
});
/* "Synced 42s ago" / "محفوظ قبل 42 ث" -> 42 seconds. Minutes and hours are accepted too so the
   check still works if a run is slow enough to cross a boundary. */
function ageSeconds(text) {
  if (!text) return null;
  let m = /(\d+)\s*(s|m|h)\b/.exec(text) || /قبل\s*(\d+)\s*(ث|د|س)/.exec(text);
  if (!m) return null;
  const n = Number(m[1]), u = m[2];
  return (u === 's' || u === 'ث') ? n : (u === 'm' || u === 'د') ? n * 60 : n * 3600;
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on('dialog', (d) => d.dismiss().catch(() => { }));
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (down && rq.method() !== 'GET' && /rpc\/save_state|businesses/.test(u.pathname)) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"service unavailable"}' });
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6000);

  const seen = [];
  const edit = (n) => p.evaluate((n) => { const b0 = (DB.businesses || [])[0]; if (b0) { b0.nextActionNote = n; save(); } }, n);

  /* 6 — the control comes first: everything below reads this element */
  const first = await readBadge(p);
  if (first.found) ok('the badge element is on screen, so the checks below are reading the real thing');
  else { fail('the badge element (#v26_3SyncPill) was not found — every check below would pass by reading nothing'); }
  seen.push(first.text);

  /* 2a — healthy */
  await edit('badge probe ok ' + PORT);
  await p.waitForTimeout(7000);
  const good = await readBadge(p); seen.push(good.text);
  if (/synced|محفوظ/i.test(good.text || '') && !/not synced|غير محفوظ/i.test(good.text || '')) ok(`after a confirmed save the badge says "${good.text}"`);
  else fail(`after a confirmed save the badge says "${good.text}" — it should report that the work reached the server`);

  /* 4 — the age is real: wait, touch nothing, and require it to have grown */
  const a1 = ageSeconds(good.text);
  await p.waitForTimeout(11000);
  const later = await readBadge(p); seen.push(later.text);
  const a2 = ageSeconds(later.text);
  if (a1 != null && a2 != null && a2 - a1 >= 7 && a2 - a1 <= 25) ok(`the age is real: ${a1}s became ${a2}s over eleven seconds of doing nothing`);
  else fail(`the age did not track real time: "${good.text}" then "${later.text}" eleven seconds later (${a1} -> ${a2}). A random or frozen number reads exactly like this.`);

  /* 2b — the connection drops */
  down = true;
  await edit('badge probe down ' + PORT);
  await p.waitForTimeout(9000);
  const bad = await readBadge(p); seen.push(bad.text);
  const red = /rgb\(217,\s*45,\s*32\)/.test(bad.dot || '');
  if (/not synced|غير محفوظ/i.test(bad.text || '') && /device|الجهاز/i.test(bad.text || '')) ok(`while saves are failing the badge says "${bad.text}"${red ? ' and its dot is red' : ''}`);
  else fail(`while saves are failing the badge says "${bad.text}" — the one element that talks about the connection is not reporting that the work has not left the device`);
  if (red) ok('the dot turns red, so the state is visible at a glance and not only in the words');
  else fail(`the dot stayed ${bad.dot} while saves were failing`);

  /* 3 — recovery */
  down = false;
  await p.evaluate(() => { try { save(); } catch (_) { } });
  await p.waitForTimeout(9000);
  const back = await readBadge(p); seen.push(back.text);
  if (/synced|محفوظ/i.test(back.text || '') && !/not synced|غير محفوظ/i.test(back.text || '')) ok(`when the connection comes back the badge says "${back.text}" again`);
  else fail(`the connection came back and the badge is still "${back.text}" — it latched on the failure and now under-reports instead of over-reporting`);

  /* 5 — Arabic */
  await p.evaluate(() => { try { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); } catch (_) { } });
  await p.waitForTimeout(6500);
  const ar = await readBadge(p); seen.push(ar.text);
  if (/[؀-ۿ]/.test(ar.text || '')) ok(`the badge speaks Arabic when the app is Arabic ("${ar.text}")`);
  else fail(`the badge is still English on an Arabic screen: "${ar.text}"`);

  /* The coupling this layer created, named explicitly so it cannot come back quietly. js/49
     announces refused and failed saves through the SAME window.__pillHook slot, and its guard used
     to be "somebody has the slot, so I must already be installed". js/75 installs at load and js/49
     only from render and a 900ms timer, so js/75 always won and js/49 silently stopped installing:
     every save failure went unannounced and a refused save stopped reloading. Both are on the same
     page here, so this is the cheapest possible place to notice it. */
  const chained = await p.evaluate(() => ({ v73: window.__v73SaveWatch === 1, hook: typeof window.__pillHook === 'function' }));
  if (chained.v73 && chained.hook) ok("js/49's save watch is installed alongside this badge — both layers share window.__pillHook and both are on it");
  else fail(`js/49's save watch is NOT installed (${JSON.stringify(chained)}). This layer has taken the hook slot from it, so refused saves no longer reload and failed saves are announced by nothing. Chain the hook; never claim the slot.`);

  /* 1 — the invented form, checked against every state seen above */
  const invented = seen.filter((t) => t && INVENTED.test(t));
  if (!invented.length) ok(`none of the ${seen.length} states showed the invented "Live · <n>s" form`);
  else fail(`the badge showed the invented form again: ${JSON.stringify(invented)} — core-09 builds that text from Math.random() and it says Live whether or not anything has reached the server`);

  await b.close();
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
