/* probe-finance-links-race.mjs — guards the 2026-09-15 (fire #58) fix in js/41 (automatic finance↔client
   linking). Found live, read-only visit to Finance: 13 finance_client_links rows were rewritten on EVERY
   visit by any editor. js/16 sets FIN.rows first and fetches the links afterwards; js/41's pass runs 400 ms
   after each render, saw rows but an empty link map, and upserted every name-matchable group again —
   confirmed_at/updated_at bumped to "now", and a human's later correction of a link would be undone by the
   name match. The pass now waits until FIN.links exists (set only when the links have actually loaded).
   Mock: every invoice group is ALREADY linked by a person; the links response is delayed 1.5 s so the old
   race is deterministic. Asserts 0 writes to finance_client_links, links loaded, every link still the
   person's, no JS errors. Sabotage-tested: with the js/41 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-finance-links-race.mjs                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const LINKS = [0, 1, 2, 3, 4, 5].map((i) => ({ id: 'fl' + i, client_group: 'Test Company ' + i, business_id: 'b' + i, is_client: true, note: 'confirmed by a person', confirmed_by: 'Othman (person)', confirmed_at: '2026-08-10T00:00:00Z', created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z', credit_balance_sar: null }))
  .concat([{ id: 'flv', client_group: 'Test Company VAT Canary', business_id: null, is_client: false, note: 'individuals', confirmed_by: 'Othman (person)', confirmed_at: '2026-08-10T00:00:00Z', created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z', credit_balance_sar: null }]);
const PORT = 9045; const srv = start(PORT, { finance_client_links: LINKS }); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
let linkWrites = 0; const writeLog = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  if (u.pathname.includes('/finance_client_links')) { if (!['GET', 'HEAD'].includes(rq.method())) { linkWrites++; writeLog.push(rq.method() + ' ' + (rq.postData() || '').slice(0, 80)); } else { await new Promise((res) => setTimeout(res, 1500)); } }
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
await p.waitForFunction(() => typeof render === 'function' && typeof finLoad === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(1500);
await p.evaluate(() => { current = 'finance'; render(); });          /* the visit — nothing else */
for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.evaluate(() => { try { render(); } catch (_) { } }); }
await p.waitForTimeout(6000);                                        /* past the 1.2 s / 4 s / render+400 ms passes */
const after = await p.evaluate(async () => { const c = fc(); const r = await c.from('finance_client_links').select('client_group,confirmed_by,business_id'); return { loaded: Array.isArray(FIN.links) ? FIN.links.length : null, rows: (r.data || []).map((x) => x.confirmed_by), canEdit: (typeof canFinEdit === 'function') ? canFinEdit() : null, finRows: (FIN.rows || []).length }; });
await b.close(); srv.close?.();
const checks = [
  ['a read-only visit to Finance writes NOTHING to finance_client_links (all groups already linked)', linkWrites === 0],
  ['the links did load into the page (FIN.links = ' + LINKS.length + ')', after.loaded === LINKS.length],
  ["every link is still the person's (no confirmed_by overwritten to auto-match)", after.rows.length === LINKS.length && after.rows.every((x) => x === 'Othman (person)')],
  ['the QA admin may edit finance (so the pass was live, not skipped)', after.canEdit === true && after.finRows > 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ linkWrites, writeLog: writeLog.slice(0, 4), after })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
