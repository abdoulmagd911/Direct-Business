/* probe-save-failure-attacks.mjs (2026-09-07, round 63) — what the app does when a save cannot
   reach the server, and why that is not the same as being refused.

   js/49's watchSaves() exists to stop the screen showing a change the database rejected: on any
   "Save issue" pill it explains and reloads, so the page comes back matching what is really
   stored. For a REFUSAL that is exactly right. For a dropped connection it is exactly wrong, and
   until round 63 the code could not tell the two apart.

   Driven with the save endpoints answering 503 — an ordinary mobile dead spot — the app reloaded
   three times in twelve seconds, once per retry. Everything about that is harmful: js/02 has
   already written the change to this device and scheduled a retry with backoff, and the reload
   throws that retry away; the person is told their change was not saved when it is sitting safely
   on their phone; and on a connection that is merely patchy the app becomes a reload loop that
   loses the pending write every time round. Direct's agents work on hotel and airport wifi. This
   is their normal, not an edge case.

   So a transport failure now says what is true — saved here, not on the server yet, still
   trying — once, and does not reload. A refusal still reloads.

   Under test:
     1. TRANSPORT: with saves answering 503, the page is NOT reloaded (a marker set after sign-in
        is still there, and no navigation happened).
     2. TRANSPORT: the person IS told, and told the truth — one notice, naming that the change is
        kept on the device.
     3. TRANSPORT: the app is still trying — more than one save attempt after the first failure.
     4. RECOVERY: when the connection returns, the change lands in the database. This is the
        check that makes 1-3 worth anything: not reloading is only right BECAUSE the retry works.
     5. REFUSAL (the control, and the other half of the two-sided fix): a row-level-security
        refusal must STILL reload. A fix that stopped reloading for everything would pass 1-4 and
        reopen the hole js/49 was written to close.
     6. The notice speaks Arabic when the app is Arabic.

   Run:  node scripts/qa/probe-save-failure-attacks.mjs        (port 9020)
   Sabotage (file-level, both halves separately):
     · make js/49's `denied` test always true  → checks 1 and 2 red (it reloads on a dead spot);
     · make it always false                    → check 5 red (a refusal is left on screen).
   Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9020;
const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const srv = start(PORT);
const AR = /[؀-ۿ]/;
const SAVE_PATH = /\/rest\/v1\/(rpc\/save_state(_patch)?|businesses)/;

/* mode: 'ok' | 'down' (503, a dead spot) | 'refused' (403 with an RLS message) */
let mode = 'ok';

/* Every page starts on a WORKING connection. The first version did not reset `mode`, so the
   Arabic page was created while the previous block's refusal mode was still on: its sign-in
   traffic failed, the notice fired in English before the language had been switched, and the
   once-per-outage guard then suppressed the Arabic one. The probe was reporting the app as
   English-only on an Arabic screen, and it was the probe's own leftover state. */
async function newPage(b, { lang = 'en' } = {}) {
  mode = 'ok';
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  let navs = 0;
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs++; });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (mode !== 'ok' && SAVE_PATH.test(u.pathname) && rq.method() !== 'GET') {
      return mode === 'down'
        ? r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'service unavailable' }) })
        : r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'new row violates row-level security policy for table "businesses"' }) });
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  if (lang === 'ar') { await p.evaluate(() => { try { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); } catch (_) { } }); await p.waitForTimeout(1200); }
  /* The reload detector: a marker on the window, plus the navigation count. Either alone can be
     argued with — a marker can be cleared by other code, a navigation can be a history rewrite —
     so both are reported and check 1 needs both. */
  await p.evaluate(() => {
    window.__probeAlive = 1;
    window.__pillLog = [];
    const o = window.__pillHook;
    window.__pillHook = function (t, c) { try { window.__pillLog.push(String(t)); } catch (_) { } if (o) o(t, c); };
  });
  const navsAtStart = navs;
  return { ctx, p, navs: () => navs - navsAtStart };
}

/* nextActionNote, not nextAction: appToRow() maps `nextAction` to the next_action_DATE column
   (js/02 line ~155), so writing a sentence there stores a sentence where a date belongs and the
   row check below can never match. Cost one red before it was read rather than assumed. */
const editAndSave = (p, note) => p.evaluate((n) => {
  const b0 = (DB.businesses || [])[0]; if (!b0) return null;
  b0.nextActionNote = n; save();
  return b0.id;
}, note);

const readState = (p) => p.evaluate(() => {
  const bx = document.getElementById('v70box');
  return {
    alive: window.__probeAlive === 1,
    pills: window.__pillLog || [],
    box: bx ? bx.textContent.trim().replace(/\s+/g, ' ') : null,
    boxes: document.querySelectorAll('#v70box').length,
  };
});

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  /* ---------- 1-4: a dead spot ---------- */
  {
    const { ctx, p, navs } = await newPage(b);
    mode = 'down';
    const NOTE = 'round61 dead-spot ' + PORT;
    await editAndSave(p, NOTE);
    await p.waitForTimeout(12000);
    const s = await readState(p);

    if (s.alive && navs() === 0) ok('a dead spot does not reload the page — the marker set after sign-in is still there and nothing navigated');
    else fail(`the page reloaded while the connection was down (marker ${s.alive ? 'kept' : 'GONE'}, ${navs()} navigation(s)). js/02 had already written the change to this device and scheduled a retry; the reload throws that retry away, and on a patchy connection it repeats every few seconds.`);

    const attempts = s.pills.filter((t) => /^Save issue/i.test(t)).length;
    if (attempts >= 2) ok(`the app kept trying — ${attempts} save attempts failed and were retried rather than abandoned`);
    else fail(`only ${attempts} failed attempt(s) recorded (${JSON.stringify(s.pills)}) — either the save never ran or the retry stopped, and check 1 above would then be about a page that had given up`);

    if (!s.box) fail('nothing told the person anything: no notice appeared while three saves were failing. Their change is on the device and not on the server, and the screen says nothing.');
    else if (s.boxes > 1) fail(`${s.boxes} notices are stacked on screen — one per retry. A dead spot lasting a minute buries the app in dialogs.`);
    else if (/not reached|has not|device|still trying/i.test(s.box)) ok(`one notice, and it tells the truth: "${s.box.slice(0, 90)}…"`);
    else fail(`the notice does not say the change is kept and being retried: "${s.box.slice(0, 140)}" — a person reading it would think their work was lost`);

    /* 4. recovery — the reason not reloading is the right call */
    mode = 'ok';
    await p.evaluate(() => { try { save(); } catch (_) { } });
    await p.waitForTimeout(9000);
    const landed = await (await fetch(BASE + '/rest/v1/businesses?select=legacy_id,next_action_note').then((r) => r.json()).catch(() => []));
    const hit = (Array.isArray(landed) ? landed : []).some((r) => String(r.next_action_note || '') === NOTE);
    if (hit) ok('when the connection came back the change reached the database by itself — which is why not reloading is the right call');
    else fail(`the connection came back and the change never arrived (looked for next_action_note="${NOTE}" in ${Array.isArray(landed) ? landed.length : '?'} rows). Not reloading is only defensible if the retry actually delivers; if it does not, the person is being told to keep a tab open for nothing.`);
    await ctx.close();
  }

  /* ---------- 5: a refusal must still reload ---------- */
  {
    const { ctx, p, navs } = await newPage(b);
    mode = 'refused';
    await editAndSave(p, 'round61 refusal ' + PORT);
    await p.waitForTimeout(11000);
    const s = await readState(p);
    if (!s.alive || navs() > 0) ok(`a row-level-security refusal still reloads the page (marker ${s.alive ? 'kept' : 'gone'}, ${navs()} navigation(s)) — the screen is not left showing a change the database rejected`);
    else fail('a refusal did NOT reload: the screen is still showing a change the database rejected, which is the hole js/49 was written to close. The transport-failure fix must not have swallowed the refusal path with it.');
    await ctx.close();
  }

  /* ---------- 6: Arabic ---------- */
  {
    const { ctx, p } = await newPage(b, { lang: 'ar' });
    mode = 'down';
    await editAndSave(p, 'round61 ar ' + PORT);
    await p.waitForTimeout(11000);
    const s = await readState(p);
    if (s.box && AR.test(s.box)) ok('the notice speaks Arabic when the app is Arabic');
    else fail(`the notice is not Arabic on an Arabic screen: ${JSON.stringify(s.box && s.box.slice(0, 120))}`);
    await ctx.close();
  }

  mode = 'ok';
  await b.close();
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
