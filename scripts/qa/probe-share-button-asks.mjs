/* probe-share-button-asks.mjs (2026-09-09, live test finding SH1) — the Share button opens a
   panel that explains, lists and switches off; a link is made only after a yes. Attack area (ad).

   PORT NOTE: 8701–8764 are taken. This is 8765, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: one click on "Share (view-only)" minted a permanent link with
   no confirmation, no list of existing links and no way to switch one off from the app.

   Under test (writes counted on the wire):
     1. Clicking the Share button writes NOTHING to share_links; an in-page panel opens with the
        one-sentence explanation and lists the two seeded links (one on, one off) — the off one
        has no Copy / Switch-off buttons.
     2. "Create a new link" → js/57's in-page box (no native confirm); Cancel → still no write.
     3. Confirm → exactly one INSERT into share_links; the list gains the new row, "on".
     4. "Switch off" on the new row → box → confirm → one PATCH active=false; the row reads
        switched off; the count of on-links drops by one.
     5. No native dialog at any point.

   Run:  node scripts/qa/probe-share-button-asks.mjs        (port 8765)
   Sabotage: in js/77 hook() leave js/10's onclick in place (do not replace it) — check 1 goes red
   (a click mints a link); make makeNew() skip pfConfirm — check 2 goes red. Assert the sabotage
   APPLIED with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8765;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const T_ON = 'a'.repeat(58) + 'onlink', T_OFF = 'b'.repeat(57) + 'offlink';
const srv = start(PORT, { share_links: [
  { token: T_ON, scope: 'all', active: true, created_by: null, created_at: '2026-08-16T10:00:00Z', last_used_at: '2026-08-16T10:05:00Z' },
  { token: T_OFF, scope: 'all', active: false, created_by: null, created_at: '2026-08-02T10:00:00Z', last_used_at: null },
] });
const BASE = 'http://localhost:' + PORT;
const W = { ins: 0, patch: 0, log: [] };

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type()); await d.dismiss(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (/\/rest\/v1\/share_links/.test(u.pathname)) { if (rq.method() === 'POST') W.ins++; if (rq.method() === 'PATCH') { W.patch++; W.log.push(u.search + ' ' + rq.postData()); } }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && window.__roleKnown === true && document.querySelector('#cl_share[data-share-panel]'), { timeout: 90000 }).catch(() => fail('the Share button never got its panel hook'));
  await p.waitForTimeout(1500);

  /* ---- 1. click → panel, no write ---- */
  W.ins = 0; W.patch = 0;
  await p.click('#cl_share'); await p.waitForTimeout(500);
  await p.waitForFunction(() => document.querySelector('#shareBox [data-share-row]'), { timeout: 15000 }).catch(() => {});
  const a = await p.evaluate(() => { const box = document.getElementById('shareBox'); const rows = box ? [...box.querySelectorAll('[data-share-row]')].map((r) => ({ on: r.getAttribute('data-share-on'), copy: !!r.querySelector('[data-share-copy]'), off: !!r.querySelector('[data-share-off]'), txt: r.innerText.replace(/\s+/g, ' ').slice(0, 90) })) : null; return { box: !!box, note: box ? (box.querySelector('[data-share-note]') || { textContent: '' }).textContent : '', rows, count: box ? (box.querySelector('[data-share-count]') || {}).textContent : null }; });
  if (W.ins === 0 && a.box && /read-only|view/i.test(a.note) && /switched off/i.test(a.note)) ok('the click opened the panel, wrote nothing, and explained what a link does');
  else fail(`click: inserts=${W.ins} ${JSON.stringify({ box: a.box, note: a.note.slice(0, 80) })} — the live-site one-click link`);
  const onRow = a.rows && a.rows.find((r) => r.on === '1'), offRow = a.rows && a.rows.find((r) => r.on === '0');
  if (a.rows && a.rows.length === 2 && onRow && onRow.copy && onRow.off && offRow && !offRow.copy && !offRow.off && a.count === '1') ok(`the panel lists both links: "${onRow.txt}" (Copy, Switch off) and the off one without buttons; 1 on`);
  else fail(`list: ${JSON.stringify(a.rows)} count=${a.count}`);

  /* ---- 2. create → box → cancel ---- */
  await p.click('#shareBox [data-share-new]'); await p.waitForTimeout(400);
  const box2 = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 120) }));
  if (!dialogs.length && box2.box && /new view-only link/i.test(box2.txt)) ok(`Create asks in the page: "${box2.txt.slice(0, 70)}…"`);
  else fail(`Create: box=${JSON.stringify(box2)} dialogs=${JSON.stringify(dialogs)}`);
  await p.evaluate(() => document.getElementById('pfConfirmNo').click()); await p.waitForTimeout(800);
  if (W.ins === 0) ok('Cancel: still no link made'); else fail(`Cancel still minted ${W.ins} link(s)`);

  /* ---- 3. create → confirm ---- */
  await p.click('#shareBox [data-share-new]'); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('pfConfirmYes').click());
  await p.waitForFunction(() => document.querySelectorAll('#shareBox [data-share-row]').length === 3, { timeout: 15000 }).catch(() => {});
  const c3 = await p.evaluate(() => ({ rows: document.querySelectorAll('#shareBox [data-share-row]').length, on: document.querySelectorAll('#shareBox [data-share-row][data-share-on="1"]').length, count: (document.querySelector('#shareBox [data-share-count]') || {}).textContent }));
  if (W.ins === 1 && c3.rows === 3 && c3.on === 2 && c3.count === '2') ok('Confirm: exactly one link made; the list shows it at once (3 rows, 2 on)');
  else fail(`Confirm: inserts=${W.ins} ${JSON.stringify(c3)}`);

  /* ---- 4. switch the new one off ---- */
  const newTok = await p.evaluate((seed) => [...document.querySelectorAll('#shareBox [data-share-row]')].map((r) => r.getAttribute('data-share-row')).find((t) => !seed.includes(t)), [T_ON, T_OFF]);
  await p.click(`#shareBox [data-share-off="${newTok}"]`); await p.waitForTimeout(400);
  const box4 = await p.evaluate(() => ({ box: !!document.getElementById('pfConfirmBox'), txt: (document.getElementById('pfConfirmBox') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 100) }));
  if (box4.box && /invalid link/i.test(box4.txt)) ok(`Switch off asks and says what the holder will see: "${box4.txt.slice(0, 70)}…"`); else fail(`Switch off box: ${JSON.stringify(box4)}`);
  await p.evaluate(() => document.getElementById('pfConfirmYes').click());
  await p.waitForFunction((t) => { const r = document.querySelector(`#shareBox [data-share-row="${t}"]`); return r && r.getAttribute('data-share-on') === '0'; }, newTok, { timeout: 15000 }).catch(() => {});
  const c4 = await p.evaluate((t) => { const r = document.querySelector(`#shareBox [data-share-row="${t}"]`); return { on: r && r.getAttribute('data-share-on'), txt: r ? r.innerText.replace(/\s+/g, ' ').slice(0, 90) : null, count: (document.querySelector('#shareBox [data-share-count]') || {}).textContent }; }, newTok);
  const stored = await fetch(`${BASE}/rest/v1/share_links?token=eq.${newTok}`, { headers: { apikey: 'x' } }).then((r) => r.json()).catch(() => null);
  if (W.patch === 1 && c4.on === '0' && /switched off/.test(c4.txt) && c4.count === '1' && Array.isArray(stored) && stored[0] && stored[0].active === false) ok('Switch off: one update, the row reads switched off, the table row is inactive, 1 on');
  else fail(`Switch off: patches=${W.patch} ${JSON.stringify({ c4, stored })}`);

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nshare-button-asks OK — the Share button explains, lists, switches off, and asks before it makes a link');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
