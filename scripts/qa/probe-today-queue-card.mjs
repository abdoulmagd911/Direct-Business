/* probe-today-queue-card.mjs (2026-09-09, live test findings T1 + T2) — the Today hub's
   controls go somewhere. Attack area (ad).

   PORT NOTE: 8701–8750 are taken. This is 8751, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: the "Open my queue" card lit up on click and did nothing —
   its handler re-rendered the page it was already on. Beside it, the greeting said "You have 1
   quote to send" while the hero said "My queue: 0 — all clear", and the quote could not be
   reached from the sentence that named it.

   Under test (screen read, not internals):
     1. Clicking "Open my queue" scrolls the 📌 My queue group into view and marks it
        (data-queue-focus) — the page reacts to the click.
     2. With a Draft proposal in the workspace the greeting sentence carries a LINK on the
        "quote to send" part; clicking it opens the Proposals page.
     3. With no drafts and no pending invoices the greeting has no links and says the day is
        calm — the links appear only when there is work to open.
     4. No JavaScript errors while doing any of it.

   Run:  node scripts/qa/probe-today-queue-card.mjs        (port 8751)
   Sabotage: in core-09's V26_ACTION_CARDS give openQueue back its old
   `run:function(){current='today';render();}` — check 1 goes red; make `_lnk` return its text
   without the <a> — check 2 goes red. Assert the sabotage APPLIED with a marker unique to it;
   confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8751;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 700 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && document.querySelector('#v26TodayHub') && document.querySelector('.v19-today-group'), { timeout: 90000 }).catch(() => fail('the Today hub never rendered — nothing below examined anything'));

  /* js/35 (v59) re-asserts the table copies of requests/offers/etc. over DB every 1.5 s for the
     first ~20 s after load, re-rendering each time — a highlight set now is wiped by the next
     redraw, and a draft injected now is replaced by the table copy. Interaction-correctness is
     not what this probe measures (cycle rule: content probes wait for settle), so wait it out. */
  await p.waitForTimeout(22000);

  /* ---- 1. the queue card reacts ---- */
  const r1 = await p.evaluate(() => new Promise((res) => {
    const btn = document.querySelector('[data-action="openQueue"]');
    if (!btn) return res({ err: 'no card' });
    const before = window.scrollY;
    btn.click();
    setTimeout(() => {
      const focused = document.querySelector('[data-queue-focus="1"]');
      const h3 = focused && focused.querySelector('h3');
      res({ focused: !!focused, title: h3 ? h3.textContent.trim() : (focused ? focused.className : ''), moved: window.scrollY !== before, glow: focused ? getComputedStyle(focused).boxShadow : '' });
    }, 900);
  }));
  if (r1.focused && /queue|قائم/i.test(r1.title) && /rgb\(255, 107, 0\)|#FF6B00/i.test(r1.glow))
    ok(`"Open my queue" scrolls to and lights up the "${r1.title}" group (scrolled: ${r1.moved})`);
  else fail(`"Open my queue" did nothing visible: ${JSON.stringify(r1)} — the live-site defect (a redraw of the page you are on)`);

  /* ---- 2. a draft proposal makes the greeting a link ---- */
  const r2 = await p.evaluate(() => new Promise((res) => {
    DB.offers = (DB.offers || []).filter((o) => o.id !== 'probe_tq_1').concat([{ id: 'probe_tq_1', ref: 'OFR-TQ-1', subject: 'Probe draft', client: 'Probe Client Co', status: 'Draft', date: new Date().toISOString().slice(0, 10) }]);
    current = 'today'; render();
    setTimeout(() => {
      const hub = document.querySelector('#v26TodayHub');
      const txt = hub ? hub.innerText : '';
      const a = hub && hub.querySelector('a[data-today-link="offers"]');
      res({ txt: txt.replace(/\s+/g, ' ').slice(0, 200), hasLink: !!a, linkText: a ? a.textContent : '' });
    }, 700);
  }));
  if (r2.hasLink && /quote/i.test(r2.linkText)) ok(`the greeting's "${r2.linkText}" is a link to Proposals`);
  else fail(`the greeting names work with nowhere to go: ${JSON.stringify(r2)}`);
  const r2b = await p.evaluate(() => new Promise((res) => {
    const a = document.querySelector('#v26TodayHub a[data-today-link="offers"]'); if (!a) return res({ err: 'no link' });
    a.click(); setTimeout(() => res({ current: typeof current !== 'undefined' ? current : null, offersOnScreen: /OFR-TQ-1/.test((document.getElementById('view') || {}).innerText || '') }), 700);
  }));
  if (r2b.current === 'offers' && r2b.offersOnScreen) ok('clicking it opens the Proposals page with the draft on it');
  else fail(`clicking the link did not open Proposals: ${JSON.stringify(r2b)}`);

  /* ---- 3. no work → no links, calm sentence ---- */
  const r3 = await p.evaluate(() => new Promise((res) => {
    DB.offers = (DB.offers || []).filter((o) => o.status !== 'Draft' && o.status !== 'Pending');
    DB.invoices = (DB.invoices || []).filter((i) => i.status !== 'Draft' && i.status !== 'Pending');
    current = 'today'; render();
    setTimeout(() => { const hub = document.querySelector('#v26TodayHub'); res({ links: hub ? hub.querySelectorAll('a[data-today-link]').length : -1, txt: hub ? hub.innerText.replace(/\s+/g, ' ').slice(0, 160) : '' }); }, 700);
  }));
  if (r3.links === 0 && /calm|Welcome|هادئ/i.test(r3.txt)) ok('with nothing to send the greeting has no links and says the day is calm');
  else fail(`greeting with no work: ${JSON.stringify(r3)}`);

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ntoday-queue-card OK — the Today hub\'s controls go somewhere');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
