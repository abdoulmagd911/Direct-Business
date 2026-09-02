/* probe-m13-remaining.mjs — the last three pre-M13 write sites the oversight session listed
   (2026-09-02, attack round 11), driven through their REAL dialogs:
     A. Team → Access levels (js/15): "Save this user's access" updates app_users.allowed_pages
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
const PORT = REFUSE ? 8304 : 8303;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
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

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  const tag = REFUSE ? 'REFUSAL' : 'happy';

  // ---- A. Access levels (js/15)
  {
    await p.evaluate(() => { window.v41Access(); }); await p.waitForTimeout(1500);
    const have = await p.evaluate(() => !!document.querySelector('[data-save="1"]') && !!document.querySelector('input[data-u="1"][data-p="today"]'));
    if (!have) fail('A: the Access levels dialog did not show a second user with a Today checkbox');
    else {
      await p.evaluate(() => { const cb = document.querySelector('input[data-u="1"][data-p="reports"]'); cb.checked = true; });
      const before = dialogs.length;
      await p.evaluate(() => { document.querySelector('[data-save="1"]').click(); });
      let txt = ''; for (let i = 0; i < 10; i++) { await sleep(200); txt = await p.evaluate(() => (document.querySelector('[data-save="1"]') || {}).textContent || ''); if (/Saved/.test(txt) || dialogs.length > before) break; }
      const row = await (await fetch(BASE + '/rest/v1/app_users?id=eq.u-assem')).json();
      const pages = (row[0] || {}).allowed_pages || [];
      if (!REFUSE) {
        if (/Saved ✓/.test(txt) && pages.includes('reports')) ok('A (' + tag + '): access change landed in app_users and the button says Saved ✓');
        else fail('A (' + tag + '): button "' + txt + '", table allowed_pages ' + JSON.stringify(pages));
      } else {
        const said = dialogs.slice(before).join(' | ');
        if (!/Saved ✓/.test(txt) && /refused/i.test(said) && !pages.includes('reports')) ok('A (' + tag + '): refused write reported — "' + said.slice(0, 70) + '…", no Saved ✓');
        else fail('A (' + tag + '): button "' + txt + '", dialogs ' + JSON.stringify(dialogs.slice(before)) + ', table ' + JSON.stringify(pages));
      }
      await p.evaluate(() => { const x = document.getElementById('v41x'); if (x) x.click(); });
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
      await p.evaluate(() => { document.getElementById('mSave').click(); });
      await sleep(1500);
      const rows = await (await fetch(BASE + '/rest/v1/client_profiles?direct_client_id=eq.777')).json();
      if (!REFUSE) {
        if (rows.length === 1 && dialogs.length === before) ok('B (' + tag + '): the profile row landed in client_profiles, no error shown');
        else fail('B (' + tag + '): rows ' + rows.length + ', dialogs ' + JSON.stringify(dialogs.slice(before)));
      } else {
        const said = dialogs.slice(before).join(' | ');
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

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log(`\nm13-remaining OK (${tag}) — access save, billing profile, finance link`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
