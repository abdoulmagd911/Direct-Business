/* probe-generator-print-not-blank.mjs — guards the 2026-09-17 (fire #77) js/66 fix, the worst thing this sweep
   has found: every client-facing document printed BLANK from a normal desktop browser.
   js/66's phone block was written as `@media(max-width:900px)` — a width query with no media TYPE, so it
   applies to paper as well as to screens. Printing lays the page out at the width of the PAPER, and A4
   portrait is 794px, under 900 — so every print run took the phone branch and set the document column to
   display:none. The editors' own print rules then hid the rest of the app and marked the document pages
   "visible", but visibility cannot bring back a display:none parent. Measured live before the fix: the page
   box 0×0 and a 7 KB PDF; after it, 794×993 and 337 KB. All five editors print through the same column.
   This probe checks what the browser actually resolves: on paper the document column is shown and the
   floating phone toggle is not, while on a narrow SCREEN the phone behaviour is exactly as before.
   Sabotage-tested: with the js/66 edit stashed, 4 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-generator-print-not-blank.mjs                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9058; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const PAPER = 794;   /* A4 portrait at 96dpi; these documents set @page{margin:0} */
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
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
await p.goto(BASE + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.dgGo === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(2500);
await p.evaluate(() => { current = 'documents'; openLead = null; render(); }); await p.waitForTimeout(900);
await p.evaluate(() => { try { dgGo('offer'); } catch (_) { } }); await p.waitForTimeout(3000);
const look = () => p.evaluate(() => { const c = document.querySelector('#dgWrap [id$="PreviewCol"]'); const t = document.getElementById('dgPreviewToggle');
  const box = document.querySelector('#poPages'); const first = box && box.children[0];
  return { colFound: !!c, col: c ? getComputedStyle(c).display : null, toggle: t ? getComputedStyle(t).display : null,
    pageW: first ? Math.round(first.getBoundingClientRect().width) : null, pageH: first ? Math.round(first.getBoundingClientRect().height) : null, pages: box ? box.children.length : 0 }; });
const wide = await look();                                     /* desktop screen — the normal working view */
await p.setViewportSize({ width: PAPER, height: 1000 });
const narrowScreen = await look();                             /* a phone-width SCREEN — the toggle belongs here */
await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(1000);
const paper = await look();                                    /* paper — the same width, but it is not a phone */
const pdf = await p.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } }).catch(() => null);
await p.emulateMedia({ media: 'screen' }); await p.setViewportSize({ width: 1440, height: 950 });
await b.close(); srv.close?.();
const checks = [
  ['the document column exists and is shown in the normal desktop view', wide.colFound && wide.col === 'block'],
  ['ON PAPER the document column is shown, not hidden by the phone rule', paper.colFound && paper.col === 'block'],
  ['ON PAPER the document page has a real size (not the 0×0 that printed blank)', paper.pages > 0 ? (paper.pageW > PAPER * 0.8 && paper.pageH > 300) : false],
  ['the floating phone toggle does not print', paper.toggle === 'none'],
  ['a narrow SCREEN still behaves like a phone — column hidden behind the toggle', narrowScreen.col === 'none' && narrowScreen.toggle === 'block'],
  ['the printed PDF is not an empty shell', !!pdf && pdf.length > 40000],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ wide, narrowScreen, paper, pdfKB: pdf ? Math.round(pdf.length / 1024) : null })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
