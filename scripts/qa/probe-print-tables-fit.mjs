/* probe-print-tables-fit.mjs — guards js/83, added 2026-09-17 (fire #76) after measuring what the app really
   prints. The lists live inside a box that scrolls sideways on screen (.tbl-wrap, overflow-x:auto). Paper has
   no scrollbar, so the browser drew the first column-width of it and threw the rest away: laid out at A4 text
   width, Leads lost 597px of a 1275px table and Clients 456px — right-hand columns gone, with nothing on the
   page or in the PDF to say so. js/83 adds print-only rules so the table fits the paper and its text wraps;
   no column is hidden and the screen is untouched.
   This probe lays the mock app out at paper width with print media on and checks that nothing is cut off, that
   the last column is really inside the paper, and that every column is still there — then checks the ordinary
   screen view is unchanged (the table keeps its natural width and the box still scrolls).
   Sabotage-tested: with js/83 stashed, 3 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-print-tables-fit.mjs                                                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9057; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const PAPER = 680;   /* A4 portrait minus the 15mm margins core-06 sets, at 96dpi */
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
await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && document.querySelectorAll('#view .tbl-wrap table').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(1500);
const look = () => p.evaluate((PAPER) => {
  const w = document.querySelector('#view .tbl-wrap'); const t = w && w.querySelector('table');
  if (!w || !t) return null;
  const ths = [...t.querySelectorAll('thead th')].filter((x) => getComputedStyle(x).display !== 'none');
  const last = ths[ths.length - 1];
  return { lost: Math.max(0, w.scrollWidth - w.clientWidth), wrapOverflowX: getComputedStyle(w).overflowX,
    tableRight: Math.round(t.getBoundingClientRect().right), lastColRight: last ? Math.round(last.getBoundingClientRect().right) : null,
    cols: ths.length, headerGroup: getComputedStyle(t.querySelector('thead')).display, rows: t.querySelectorAll('tbody tr').length,
    docScroll: document.scrollingElement.scrollWidth, docClient: document.scrollingElement.clientWidth, paper: PAPER };
}, PAPER);
/* screen, as the person normally sees it */
const screen = await look();
/* paper */
await p.setViewportSize({ width: PAPER, height: 900 }); await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(1200);
const paper = await look();
/* the same table on a second page, to prove the rules are not Leads-only */
await p.emulateMedia({ media: 'screen' }); await p.setViewportSize({ width: 1366, height: 900 });
await p.evaluate(() => { current = 'clients'; openLead = null; render(); }); await p.waitForTimeout(1500);
await p.setViewportSize({ width: PAPER, height: 900 }); await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(1200);
const paperClients = await look();
await p.emulateMedia({ media: 'screen' }); await p.setViewportSize({ width: 1366, height: 900 }); await p.waitForTimeout(400);
const screenAgain = await look();
await b.close(); srv.close?.();
const checks = [
  ['on paper the list is not cut off — the scrolling box loses nothing (Leads)', !!paper && paper.lost === 0],
  ['on paper the last column is inside the paper, not past its edge (Leads)', !!paper && paper.lastColRight !== null && paper.lastColRight <= paper.paper + 2 && paper.tableRight <= paper.paper + 2],
  ['the printed page itself is no wider than the paper', !!paper && paper.docScroll <= paper.docClient + 2],
  ['every column is still there on paper — none hidden to make it fit', !!paper && !!screen && paper.cols === screen.cols && paper.cols > 3 && paper.rows === screen.rows],
  ['the header row repeats on each printed page', !!paper && /table-header-group/.test(paper.headerGroup)],
  ['Clients prints the same way — nothing cut off, nothing past the edge', !!paperClients && paperClients.lost === 0 && paperClients.tableRight <= paperClients.paper + 2],
  /* screenAgain is the CLIENTS page (that is where the paper pass left us), so it is compared with
     paperClients, not with the Leads numbers — comparing the two pages' column counts was this
     probe's own bug on its first run, and it read like an app defect. */
  ['on screen nothing changed: the table keeps its natural width and the box still scrolls', !!screenAgain && screenAgain.wrapOverflowX === 'auto' && screenAgain.tableRight > PAPER && screenAgain.cols === paperClients.cols],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ screen, paper, paperClients, screenAgain })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
