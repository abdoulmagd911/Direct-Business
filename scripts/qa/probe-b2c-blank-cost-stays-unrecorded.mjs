/* probe-b2c-blank-cost-stays-unrecorded.mjs — guards the 2026-09-17 (fire #82) fix in js/58, which is M1
   and the rule the owner is most exposed by: "cost = approved expenses only — never fabricate a number to
   fill a gap; leave it null and say why".
   Found by driving the individual-booking form against the live database with the write intercepted: a
   1,000 SAR booking saved with the COST BOX EMPTY sent cost_sar = 0. The database then derives
   profit = revenue − 0, so a booking whose cost nobody had entered read as 100% margin — and the ledger's
   own honest-unrecorded machinery (js/16 prints the words "not recorded" for a null cost) was defeated by
   the stored zero. Blank now stays null; a 0 the person actually types is still 0, a genuinely free
   booking.
   This probe fills the real form twice — once with the cost blank, once with 400 typed — and reads the
   row the app sends each time, plus checks the money rules that must hold either way: no vat_sar, no
   revenue_sar and no profit_sar in a row the app writes, because the database derives all three.
   Sabotage-tested: with the js/58 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-b2c-blank-cost-stays-unrecorded.mjs                                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9062; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
let sent = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  if (/^\/rest\/v1\/finance_invoices/.test(u.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(m)) {
    /* answer locally so the mock's own ledger is never changed, and keep the row for inspection */
    const body = rq.postData() || ''; sent.push(body);
    let echo = []; try { const j = JSON.parse(body); echo = (Array.isArray(j) ? j : [j]).map((x, i) => Object.assign({ id: 'stub-' + i }, x)); } catch (_) { }
    await r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(echo) }); return;
  }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.finGo === 'function' && typeof window.b2cSave === 'function', { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(3000);
await p.evaluate(() => { try { finGo('b2c'); } catch (_) { } }); await p.waitForTimeout(2500);
const formFound = await p.evaluate(() => !!document.getElementById('bc_cost') && !!document.getElementById('bc_amt'));
const save = async (cost) => { sent = [];
  await p.evaluate((cost) => { const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('bc_date', '2026-03-14'); set('bc_name', 'QA blank-cost probe'); set('bc_amt', '1000'); set('bc_svc', 'Flights'); set('bc_cost', cost); }, cost);
  await p.evaluate(() => { try { b2cSave(); } catch (_) { } }); await p.waitForTimeout(2500);
  const body = sent[0]; if (!body) return null; try { const j = JSON.parse(body); return Array.isArray(j) ? j[0] : j; } catch (_) { return null; } };
const blank = await save('');
const typed = await save('400');
const hint = await p.evaluate(() => { const c = document.getElementById('bc_cost'); const wrap = c && c.parentElement; return wrap ? (wrap.innerText || '').replace(/\s+/g, ' ').trim() : ''; });
await b.close(); srv.close?.();
const clean = (row) => row && !('vat_sar' in row) && !('revenue_sar' in row) && !('profit_sar' in row);
const checks = [
  ['the individual-booking form is reachable and saves a row', formFound && !!blank && !!typed],
  ['a booking saved with the cost box EMPTY sends cost_sar = null, not 0', !!blank && blank.cost_sar === null],
  ['the form says what leaving it blank means', /not recorded yet|لم تُسجَّل بعد/.test(hint)],
  ['a cost the person types is kept exactly (400)', !!typed && typed.cost_sar === 400],
  ['neither row carries VAT, revenue or profit — the database derives all three (M1)', clean(blank) && clean(typed)],
  ['the amount and wallet split are still written as the doctrine expects', !!blank && blank.total_incl_vat_sar === 1000 && blank.wallet_portion_sar === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ formFound, blank, typed, hint: hint.slice(0, 160) })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
