/* probe-m13-remaining.mjs — the last three pre-M13 write sites the oversight session listed
   (2026-09-02, attack round 11), driven through their REAL dialogs:
     A. Settings → Who can open what (js/56): "Save access" calls set_page_levels() (was js/15's
        allowed_pages window until 2026-09-25, Phase 1a; that window is retired and v41Access now
        opens this one — the M13 rule is the same: never say saved for a save that did not land)
     B. Client card → Add billing profile (js/27): inserts a client_profiles row
     C. Finance → Link finance to clients (js/31): upserts a finance_client_links row
   Happy path: each write lands in the table and the screen says so.
   Refusal path (MOCK_REFUSE_TABLES=app_users,client_profiles,finance_client_links): the database
   answers no error and no rows — the screen must say "refused", never "Saved ✓" / a silent reload.
   Sabotage: drop any of the three `.select(...)`+row checks → its refusal check goes red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const REFUSE = !!(process.env.MOCK_REFUSE_TABLES || '').trim();
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = REFUSE ? 8745 : 8744;   /* 2026-09-09 (cycle 74): was 8304/8303, both of which probe-crm-attacks binds. Invisible to the old port check, which read only `PORT = <digits>` and not a ternary. */
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 2026-09-25: the app answers alert() with its OWN in-page notice (js/63, #v63Notice), not the
   browser's box — so a report can be in either place. Before this, both refusal checks below
   listened only for the native box and were red on every run in this mode. */
const noticeText = (p) => p.evaluate(() => { const n = document.getElementById('v63Notice'); return n ? (n.innerText || '').replace(/\s+/g, ' ').trim() : ''; });
const clearNotice = (p) => p.evaluate(() => { const n = document.getElementById('v63Notice'); if (n) n.remove(); });

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    /* refusal run: set_page_levels answers with nothing — the shape of a save that did not land */
    if (REFUSE && /\/rpc\/set_page_levels$/.test(u.pathname)) { await r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  const tag = REFUSE ? 'REFUSAL' : 'happy';

  // ---- A. Who can open what (js/56), reached through v41Access as before
  {
    await p.evaluate(() => { window.v41Access(); });
    let have = false; for (let i = 0; i < 20 && !have; i++) { await sleep(500); have = await p.evaluate(() => !!document.querySelector('#axHost select[data-ax-page="reports"]')); }
    const card = await p.evaluate(() => { const c = [].slice.call(document.querySelectorAll('#axHost .ax-card')).find((x) => /assem\.alsweed/.test(x.innerHTML)); return !!(c && c.querySelector('select[data-ax-page="today"]')); });
    if (!have || !card) fail('A: the access editor did not show the second user with a Today level');
    else {
      await p.evaluate(() => { const c = [].slice.call(document.querySelectorAll('#axHost .ax-card')).find((x) => /assem\.alsweed/.test(x.innerHTML));
        const sel = c.querySelector('select[data-ax-page="reports"]'); sel.value = 'full'; sel.dispatchEvent(new Event('change')); });
      await sleep(300);
      const before = dialogs.length;
      await p.evaluate(() => { const c = [].slice.call(document.querySelectorAll('#axHost .ax-card')).find((x) => /assem\.alsweed/.test(x.innerHTML));
        [].slice.call(c.querySelectorAll('button')).find((bt) => /Save access/.test(bt.textContent)).click(); });
      await clearNotice(p);
      let txt = ''; for (let i = 0; i < 40; i++) { await sleep(200); txt = await p.evaluate(() => (document.getElementById('v19toast') || {}).innerText || ''); if (/Access saved/.test(txt) || dialogs.length > before || await noticeText(p)) break; }
      const row = await (await fetch(BASE + '/rest/v1/app_users?id=eq.u-assem')).json();
      const lvl = ((row[0] || {}).page_access || {}).reports;
      if (!REFUSE) {
        if (/Access saved/.test(txt) && lvl === 'full') ok('A (' + tag + '): access change landed (reports = full) and the screen says Access saved');
        else fail('A (' + tag + '): toast "' + txt + '", stored reports level ' + JSON.stringify(lvl));
      } else {
        const said = dialogs.slice(before).concat([await noticeText(p)]).join(' | ');
        if (!/Access saved/.test(txt) && /Nothing was saved/i.test(said) && lvl !== 'full') ok('A (' + tag + '): an empty answer is reported — "' + said.slice(0, 70) + '…", no "saved"');
        else fail('A (' + tag + '): toast "' + txt + '", dialogs ' + JSON.stringify(dialogs.slice(before)) + ', stored ' + JSON.stringify(lvl));
      }
    }
  }

  // ---- B. Add billing profile (js/27)
  {
    const id = await p.evaluate(() => (DB.businesses.find((x) => x.isClient) || {}).id);
    await p.evaluate((id) => { window.v34AddProfile(id); }, id); await p.waitForTimeout(800);
    const has = await p.evaluate(() => !!document.getElementById('cp_id') && !!document.getElementById('mSave'));
    if (!has) fail('B: the Add billing profile dialog did not open');
    else {
      await p.fill('#cp_id', '777');
      const before = dialogs.length;
      await clearNotice(p);
      await p.evaluate(() => { document.getElementById('mSave').click(); });
      await sleep(1500);
      const rows = await (await fetch(BASE + '/rest/v1/client_profiles?direct_client_id=eq.777')).json();
      if (!REFUSE) {
        if (rows.length === 1 && dialogs.length === before && !(await noticeText(p))) ok('B (' + tag + '): the profile row landed in client_profiles, no error shown');
        else fail('B (' + tag + '): rows ' + rows.length + ', dialogs ' + JSON.stringify(dialogs.slice(before)));
      } else {
        const said = dialogs.slice(before).concat([await noticeText(p)]).join(' | ');
        if (rows.length === 0 && /refused/i.test(said)) ok('B (' + tag + '): refused insert reported — "' + said.slice(0, 70) + '…"');
        else fail('B (' + tag + '): rows ' + rows.length + ', dialogs ' + JSON.stringify(dialogs.slice(before)));
      }
    }
  }

  // ---- C. Link finance to clients (js/31) — needs the finance rows loaded first
  {
    await p.evaluate(() => { current = 'finance'; render(); });
    for (let i = 0; i < 20; i++) { await sleep(400); const n = await p.evaluate(() => (typeof FIN !== 'undefined' && FIN.rows) ? FIN.rows.length : 0); if (n > 0) break; }
    await sleep(800);
    await p.evaluate(() => { window.finLinkMap(); }); await p.waitForTimeout(1200);
    const info = await p.evaluate(() => { const sel = document.querySelector('#v53ov select'); if (!sel) return null; const opt = [...sel.options].find((o) => o.value && o.value !== '__indiv__'); const row = sel.parentElement; const nameEl = row && row.firstElementChild && row.firstElementChild.firstElementChild; return { group: nameEl ? nameEl.textContent.trim() : '', groups: [...document.querySelectorAll('#v53ov select')].map((s) => { const r = s.parentElement; const n = r && r.firstElementChild && r.firstElementChild.firstElementChild; return n ? n.textContent.trim() : ''; }), client: opt ? opt.value : null }; });
    console.log('  · link dialog groups:', JSON.stringify(info && info.groups));
    if (info && info.groups && info.groups.some((g) => /takamol|techtic/i.test(g))) fail('C: an EXCLUDED client (Takamol/Techtic) is listed in the Link finance dialog — the standing invariant says it must never appear anywhere');
    if (!info || !info.client) fail('C: the Link finance dialog showed no group/client to pick');
    else {
      const bodyBefore = await p.evaluate(() => document.body.innerText);
      await p.evaluate((client) => { const sel = document.querySelector('#v53ov select'); sel.value = client; sel.onchange(); }, info.client);
      let stat = '', toastSeen = false;
      for (let i = 0; i < 10; i++) { await sleep(200); const s = await p.evaluate(() => ({ st: (document.querySelector('#v53ov span') || {}).textContent || '', body: document.body.innerText })); stat = s.st; if (/refused the link|رفضت قاعدة البيانات الربط/.test(s.body)) toastSeen = true; if (stat === '✓' || toastSeen) break; }
      const links = await (await fetch(BASE + '/rest/v1/finance_client_links')).json();
      const hit = links.find((l) => l.client_group === info.group);
      if (!REFUSE) {
        if (stat === '✓' && hit) ok('C (' + tag + '): link landed in finance_client_links, ✓ shown');
        else fail('C (' + tag + '): stat "' + stat + '", table has group: ' + !!hit + ' (group "' + info.group + '")');
      } else {
        if (stat === '⚠' && toastSeen && !hit) ok('C (' + tag + '): refused link reported (⚠ + toast), nothing recorded');
        else fail('C (' + tag + '): stat "' + stat + '", toast seen ' + toastSeen + ', table has group: ' + !!hit);
      }
    }
  }

  const realErrors = errors.filter((e) => !/net::ERR_|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log(`\nm13-remaining OK (${tag}) — access save, billing profile, finance link`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
