/* probe-detail-avatar-centred.mjs — guards js/80. Found live 2026-09-15 (fire #51) by eye on a real
   client card and a real airline dashboard, then measured: the 62px avatar in `.detail-head` was
   display:block, so its initials sat in the top-left corner (text rect x/y == box x/y) on every
   lead, client, airline and provider card. The base stylesheet only centres `.lead .ava` (list rows).
   Opens a lead card, a client card and an airline dashboard in the mock and asserts the initials'
   text rectangle is centred inside the box (±4px both axes) and the box is a flex box.
   Also guards js/80's second fix: core-10 swaps the initials for a company-logo <img> and, when the
   logo cannot load, the <img> removed itself and left the box EMPTY — the first run of this probe
   caught it (text length 0 on the lead and client cards). The initials are restored on error.
   Sabotage-tested: with the js/80 script line removed from index.html, 7 of the 8 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-detail-avatar-centred.mjs                                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9037; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2500);
const measure = () => p.evaluate(() => {
  const a = document.querySelector('#view .detail-head .ava'); if (!a) return null;
  const cs = getComputedStyle(a); const r = a.getBoundingClientRect();
  const rng = document.createRange(); rng.selectNodeContents(a); const t = rng.getBoundingClientRect();
  return { display: cs.display, dx: Math.round((t.x + t.width / 2) - (r.x + r.width / 2)), dy: Math.round((t.y + t.height / 2) - (r.y + r.height / 2)), w: Math.round(r.width), text: (a.textContent || '').trim().length };
});
const centred = (m) => !!m && m.text > 0 && Math.abs(m.dx) <= 4 && Math.abs(m.dy) <= 4;
await p.evaluate(() => { const l = (DB.businesses || []).find((x) => !x.isClient); current = 'leads'; openLead = l.id; render(); }); await p.waitForTimeout(1500);
const lead = await measure();
await p.evaluate(() => { const c = (DB.businesses || []).find((x) => x.isClient) || (DB.businesses || [])[0]; current = 'leads'; openLead = c.id; render(); }); await p.waitForTimeout(1500);
const client = await measure();
await p.evaluate(() => { current = 'airlines'; openLead = ''; openSup = null; render(); const id = supArr('air')[0].id; openSupFn('air', id); }); await p.waitForTimeout(1500);
const air = await measure();
await b.close(); srv.close?.();
const checks = [
  ['lead card: avatar box found with initials', !!lead && lead.text > 0],
  ['lead card: avatar box is a flex box', !!lead && lead.display === 'flex'],
  ['lead card: initials centred in the box (±4px)', centred(lead)],
  ['client card: avatar box is a flex box', !!client && client.display === 'flex'],
  ['client card: initials centred in the box (±4px)', centred(client)],
  ['airline dashboard: avatar box is a flex box', !!air && air.display === 'flex'],
  ['airline dashboard: initials centred in the box (±4px)', centred(air)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ lead, client, air })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
