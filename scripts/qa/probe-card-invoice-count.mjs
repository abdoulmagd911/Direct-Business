/* probe-card-invoice-count.mjs — guards the 2026-09-16 (fire #62) core-02 fix found live: the lead/client
   card's "Invoices" key fact printed a number STORED on the record (b.invoices) — wrong for 22 of 28 live
   clients (training-world records said 1–4 with 0 in the ledger; real clients said 0 with 1–17 in the ledger).
   It now counts the client's live invoices through finance_client_links, the way the finance snapshot card
   (js/38) does, and shows "—" until the ledger has loaded.
   Mock: "Test Company 4" is linked (fl0) and has invoices; a second client gets a STORED invoices:9 in-page
   (no save) and no link. Asserts: the linked client's fact = the ledger's distinct live invoice count for its
   group(s); the unlinked client's fact is 0, not 9; EN and AR; no JS errors.
   Sabotage-tested: with the core-02 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-card-invoice-count.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9048; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(1500);
/* load the ledger the way Finance does, so FIN.rows / FIN.groupsByBiz exist */
await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(3000);
const setup = await p.evaluate(() => { const linked = (DB.businesses || []).find((x) => x.isClient && (FIN.groupsByBiz || {})[(window.__bizUuid ? __bizUuid(x.id) : x.id)]); const other = (DB.businesses || []).find((x) => x.isClient && x !== linked && !(FIN.groupsByBiz || {})[(window.__bizUuid ? __bizUuid(x.id) : x.id)]) || (DB.businesses || []).find((x) => x !== linked); other.invoices = 9; other.__probeStored = true; const uuid = (window.__bizUuid ? __bizUuid(linked.id) : linked.id); const groups = FIN.groupsByBiz[uuid]; const src = (typeof finLive === 'function') ? finLive() : FIN.rows; const inv = new Set(src.filter((r) => !r.deleted_at && groups.includes(r.client_group)).map((r) => r.invoice_no)); return { linkedId: linked.id, otherId: other.id, expect: inv.size, groups: groups.length, rows: FIN.rows.length }; });
const fact = () => p.evaluate(() => { const f = [...document.querySelectorAll('#view .fact')].find((x) => /^(Invoices|الفواتير)(\s|$)/.test((x.querySelector('.k') || {}).innerText || '')); return f ? ((f.querySelector('.v') || {}).innerText || '').trim() : null; });
const open = async (id) => { await p.evaluate((id) => { openLead = id; current = 'leads'; render(); }, id); await p.waitForTimeout(1200); };
await open(setup.linkedId); const enLinked = await fact();
await open(setup.otherId); const enOther = await fact();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(800);
await open(setup.linkedId); const arLinked = await fact();
await open(setup.otherId); const arOther = await fact();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); openLead = null; });
await b.close(); srv.close?.();
const checks = [
  ['the mock has a linked client with invoices in the ledger (setup)', setup.expect > 0 && setup.groups > 0],
  ['EN: the linked client\'s Invoices fact = the ledger count (' + setup.expect + ')', enLinked === String(setup.expect)],
  ['EN: a client with a STORED invoices:9 but nothing in the ledger shows 0, not 9', enOther === '0'],
  ['AR: same two facts, same numbers', arLinked === String(setup.expect) && arOther === '0'],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ setup, enLinked, enOther, arLinked, arOther })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
