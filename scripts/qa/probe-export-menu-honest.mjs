/* probe-export-menu-honest.mjs — guards the 2026-09-15 (fire #57) Export-menu fixes, found by driving the
   top-bar "Export ▾" on every page against the real database:
   1. js/60 — the menu is HIDDEN on pages exportCurrent() has no column map for (Documents, Reports,
      Settings, Activity, Archive, Today), where every labelled CSV/Excel option used to download the JSON
      backup; it stays SHOWN on Leads, Finance, Airlines.
   2. core-05 — Finance "full details" is the Ledger's own 18-column doctrine (M1: no vat_sar /
      wallet_portion_sar / discount_sar / internal ids in an export), and differs from the 11-column summary.
   3. core-05 — an empty page (Operations, emptied in-page on the mock) says "No rows to export" instead of a headerless file.
   4. js/73 — Arabic "full details" on Airlines carries no raw column keys.
   Sabotage-tested: with the three edits stashed, 4 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-export-menu-honest.mjs                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9044; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss().catch(() => { }); });
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
await p.waitForFunction(() => typeof render === 'function' && typeof expGo === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(2500);
const go = async (pg) => { await p.evaluate((pg) => { current = pg; openLead = null; render(); if (pg === 'finance') { try { finGo('ledger'); } catch (_) { } } }, pg); await p.waitForTimeout(pg === 'finance' ? 2500 : 900); };
const menuVisible = () => p.evaluate(() => { const w = document.querySelector('.exp-wrap'); return !!(w && w.offsetParent !== null && getComputedStyle(w).display !== 'none'); });
async function grab(scope) { dialogs.length = 0; const dl = p.waitForEvent('download', { timeout: 4000 }).catch(() => null); await p.evaluate((s) => expGo(s), scope); const d = await dl; if (!d) return null; return { name: d.suggestedFilename(), txt: fs.readFileSync(await d.path(), 'utf8') }; }
const csvHeads = (txt) => (txt || '').replace(/^﻿/, '').split('\n')[0].split(',').map((h) => h.replace(/^"|"$/g, '').replace(/""/g, '"'));
/* 1. hidden / shown */
const vis = {}; for (const pg of ['today', 'documents', 'reports', 'settings', 'activity', 'archive', 'leads', 'finance', 'airlines']) { await go(pg); vis[pg] = await menuVisible(); }
/* 2. finance full vs summary */
await go('finance'); await p.waitForTimeout(1500);
const finSum = await grab('list'); const finFull = await grab('full');
const hs = finSum ? csvHeads(finSum.txt) : []; const hf = finFull ? csvHeads(finFull.txt) : [];
const DOCTRINE = ['invoice_date', 'invoice_no', 'zatca_dpin', 'client_group', 'service_type', 'products', 'origin', 'proposal_ref', 'month', 'quarter', 'year', 'total_incl_vat_sar', 'revenue_sar', 'cost_sar', 'profit_sar', 'amount_received_sar', 'amount_remaining_sar', 'integrity_status'];
/* 3. empty page */
/* the mock seeds bookings/invoices/projects (js/35 loads them on open), so Operations is emptied in-page
   (no save) to stand in for a page with nothing on it; js/63 turns alert() into an in-page notice card */
const emptyPg = 'ops'; await go(emptyPg); await p.evaluate(() => { DB.requests = []; });
const emptyFile = await grab('list'); await p.waitForTimeout(400);
const emptyDialog = dialogs[0] || await p.evaluate(() => (document.getElementById('v63Notice') || {}).innerText || '');
/* 4. Arabic airlines full: no raw keys */
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(800);
await go('airlines'); const airAr = await grab('full'); const ha = airAr ? csvHeads(airAr.txt) : [];
const rawAr = ha.filter((h) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(h));
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const checks = [
  ['Export menu hidden on Today, Documents, Reports, Settings, Activity, Archive', ['today', 'documents', 'reports', 'settings', 'activity', 'archive'].every((k) => vis[k] === false)],
  ['Export menu shown on Leads, Finance, Airlines', ['leads', 'finance', 'airlines'].every((k) => vis[k] === true)],
  ['Finance "full details" = the Ledger doctrine (18 columns, no vat_sar / wallet / discount / ids)', hf.length === DOCTRINE.length && DOCTRINE.every((c, i) => hf[i] === c)],
  ['Finance summary (11) and full (18) differ', hs.length === 11 && hf.length === 18],
  ['an empty page says "No rows to export" and downloads nothing', !emptyFile && /No rows to export|لا صفوف/.test(emptyDialog)],
  ['Arabic Airlines "full details": every column title is Arabic (0 raw keys)', ha.length > 20 && rawAr.length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ vis, hs, hf, emptyPg, emptyFile: emptyFile && emptyFile.name, emptyDialog, haLen: ha.length, rawAr })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
