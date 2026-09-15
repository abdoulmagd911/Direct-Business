/* probe-generator-preview-fit.mjs — guards js/82. Found live 2026-09-15 (fire #52): the Generator's
   three classic editors (offer / fees / profile) draw 794px A4 pages in a centred flex column narrower
   than that on ordinary screens, so the page overflowed BOTH sides (the left part unreachable by any
   scroll) and the "DRAFT — no number yet" ribbon was clipped — 42px lost per edge at 1440px, 122px at
   1280px. Nobody saw it at 1920px, where it happens to fit.
   Asserts, for offer/fees/profile at 1280 and 1440: every page's box lies inside its pages wrapper
   (±1px), the draft ribbon lies inside the wrapper, and a zoom below 1 is applied; at 1920 the page
   is at its natural width (no zoom); and under print media the page's zoom is back to 1.
   Sabotage-tested: with the js/82 script line removed from index.html, 4 of the 7 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-generator-preview-fit.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9039; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
async function session(width) {
  const p = await (await b.newContext({ viewport: { width, height: 900 } })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
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
  await p.waitForFunction(() => typeof render === 'function' && typeof dgGo === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(2000);
  return p;
}
const measure = (p, tb) => p.evaluate((tb) => {
  const wrap = document.getElementById({ offer: 'poPages', fees: 'sfPages', profile: 'cpPages' }[tb]); if (!wrap) return null;
  const wr = wrap.getBoundingClientRect(); const pages = [...wrap.querySelectorAll('.po-page,.sf-page,.cp-page')];
  const inside = pages.every((pg) => { const r = pg.getBoundingClientRect(); return r.left >= wr.left - 1 && r.right <= wr.right + 1; });
  const rib = wrap.querySelector('[class$="-draftmark"]'); const rr = rib ? rib.getBoundingClientRect() : null;
  const zooms = pages.map((pg) => parseFloat(getComputedStyle(pg).zoom || '1'));
  return { pages: pages.length, inside, ribbonInside: !!(rr && rr.left >= wr.left - 1 && rr.right <= wr.right + 1), zoom: zooms[0], allSameZoom: zooms.every((z) => Math.abs(z - zooms[0]) < 0.001), wrapW: Math.round(wr.width) };
}, tb);
const out = {};
for (const W of [1280, 1440, 1920]) {
  const p = await session(W); out[W] = {};
  for (const tb of ['offer', 'fees', 'profile']) {
    await p.evaluate((tb) => { current = 'documents'; dgGo(tb); }, tb); await p.waitForTimeout(1300);
    out[W][tb] = await measure(p, tb);
  }
  if (W === 1440) { await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(300); out.print = await measure(p, 'profile'); await p.emulateMedia({ media: 'screen' }); }
  await p.context().close();
}
await b.close(); srv.close?.();
const fits = (W) => ['offer', 'fees', 'profile'].every((tb) => out[W][tb] && out[W][tb].pages > 0 && out[W][tb].inside && out[W][tb].ribbonInside);
const zoomed = (W) => ['offer', 'fees', 'profile'].every((tb) => out[W][tb] && out[W][tb].zoom < 0.999 && out[W][tb].allSameZoom);
const checks = [
  ['1280px: every page and its draft ribbon lie inside the preview column (offer/fees/profile)', fits(1280)],
  ['1280px: pages are zoomed down to fit (zoom < 1, same on every page)', zoomed(1280)],
  ['1440px: every page and its draft ribbon lie inside the preview column', fits(1440)],
  ['1440px: pages are zoomed down to fit', zoomed(1440)],
  ['1920px: pages fit at their natural width (no zoom)', fits(1920) && ['offer', 'fees', 'profile'].every((tb) => out[1920][tb].zoom >= 0.999)],
  ['print media: the page is back at zoom 1', !!out.print && out.print.zoom >= 0.999],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify(out)); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
