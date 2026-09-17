/* probe-convert-writes-won-stage.mjs — guards the 2026-09-17 (fire #81) fix in core-02's convertToClient.
   Found by driving the app's own "mark as won client" button against the live database with the write
   intercepted, so the payload could be read without storing anything: converting a lead that sat at
   Prospect sent is_client=true, raw.isClient=true and converted_date — with stage='new'. The function set
   `status` but never `stage`, and the row builder reads `stage`. So the app produced a client whose stage
   contradicted its client status, and anything counting by stage filed that client under "New". The other
   route to the same place, setLeadStage('Won'), sets stage and status and lets the database trigger set
   is_client — the two routes disagreed.
   This probe clicks through the real confirm on the mock and reads the row the app sends: the column, BOTH
   copies of the client flag, the stage and the conversion date, all in one payload.
   Sabotage-tested: with the core-02 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-convert-writes-won-stage.mjs                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9061; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const rowWrites = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  if (/^\/rest\/v1\/businesses/.test(u.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(m)) {
    try { const j = JSON.parse(rq.postData() || '[]'); (Array.isArray(j) ? j : [j]).forEach((x) => rowWrites.push(x)); } catch (_) { }
  }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && typeof convertToClient === 'function', { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(4000);
rowWrites.length = 0;
/* a lead that is NOT already at Won, so the stage has somewhere to move from */
const target = await p.evaluate(() => { const b = (DB.businesses || []).find((x) => !x.isClient && x.stage !== 'Won'); if (!b) return null; const before = { id: b.id, stage: b.stage, status: b.status }; convertToClient(b.id); return before; });
await p.waitForTimeout(600);
const confirmed = await p.evaluate(() => { const y = document.getElementById('pfConfirmYes'); if (y) { y.click(); return true; } return false; });
await p.waitForTimeout(9000);
await b.close(); srv.close?.();
const row = rowWrites.find((r) => r && (r.legacy_id === (target || {}).id || String(r.id) === String((target || {}).id))) || rowWrites[0] || null;
const raw = (row && row.raw) || {};
const checks = [
  ['the drive really happened — a lead was converted through its own confirm and a row was sent', !!target && confirmed && rowWrites.length >= 1],
  ['the stage written is "won", not the stage the lead happened to be sitting at', !!row && row.stage === 'won'],
  ['the record\'s own copy of the stage agrees (raw.stage = "Won")', String(raw.stage || '') === 'Won'],
  ['the client flag is written in BOTH places — the column and raw.isClient', !!row && row.is_client === true && (raw.isClient === true || raw.isClient === 'true')],
  ['a conversion date is written', !!row && !!row.converted_date],
  ['only one company row was sent for one conversion', rowWrites.length === 1],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ target, confirmed, rows: rowWrites.length, row: row && { id: row.id, is_client: row.is_client, stage: row.stage, status: row.status, converted_date: row.converted_date }, raw: { isClient: raw.isClient, stage: raw.stage, status: raw.status } })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
