/* probe-a-document-carries-no-invented-facts.mjs — what a client-facing PDF says about Direct, and
   what colour it is printed in.

   Fire #222. The shared print/PDF builder (v25OpenPrintPdf — the Service-Fee Proposal, the Project
   Proposal and the statement all go out through it) put this in the header of every document:

       IATA Wakeel · ZATCA Phase 2 · CR 7000000000

   That CR number is invented. Checked against the live company_identity registry, which holds a
   real ten-digit cr_number: the literal in the repository was not it and appeared nowhere in the
   registry. A made-up commercial registration number on a document going out under Direct's name
   is fire #160/#161's mistake — a literal drifting from the registry — except this one was never
   right. The footer carried "direct.com.sa", a domain the registry does not contain.

   And the colour. brand/index.html states the rule in one line — "Documents use #F06820 · tiny
   marks & favicons use #FF6C00 · the app uses #F47A1F. They are siblings — don't fix one to match
   another" — and brand/tokens.css encodes it as --accent under data-identity="classic". js/67's
   on-screen preview obeys it. The PDF did not: its accent came from DB.templateLibrary, a stored
   literal written by `v25TemplateLearn`, which despite its name reads nothing and types #FF6B00 (the
   logo-mark sibling). The copy in the live workspace was older still and held #F47A1F, so a client's
   PDF printed in the app's dashboard orange — measured on the real workspace before the fix.

   What this holds:
     1. the identity strip is built from the registry — the invented CR and the wrong domain cannot
        come back;
     2. a fact the registry does not have simply does not appear — no empty label, no stray
        separator (the #161 rule);
     3. when the registry has not loaded at all, the document says so instead of inventing anything;
     4. the accent is the DOCUMENT orange, even when the stored template says otherwise — seeded
        with the exact stale value the live workspace was carrying;
     5. the "Open in Direct" buttons point at the host that answers, not the one that does not;
     6. the brake: with the brand stylesheet unavailable the fallback is still the document orange,
        so a missing stylesheet cannot quietly reintroduce the app's;
     7. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · putting the literal header back — fails 1, 2 and 3, printing the invented CR;
     · letting the stored template's palette win again — fails 4 and 6 with rgb(244, 122, 31) on
       the page, which is precisely what the live workspace was producing.
   Run: node scripts/qa/probe-a-document-carries-no-invented-facts.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9250 — one mock. */
const PORT = 9250; const BASE = 'http://localhost:' + PORT;
const DOC_ORANGE = 'rgb(240, 104, 32)';   /* #F06820 */
const APP_ORANGE = 'rgb(244, 122, 31)';   /* #F47A1F — what the live workspace was printing */

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const popups = []; ctx.on('page', (pg) => popups.push(pg));
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|next_document_number/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.v25OpenPrintPdf === 'function', { timeout: 120000 });
await p.waitForTimeout(3500);

/* the stale state the live workspace was actually in */
const seeded = await p.evaluate((app) => {
  try { DB.templateLibrary = DB.templateLibrary || {};
    DB.templateLibrary.serviceFee = DB.templateLibrary.serviceFee || {};
    DB.templateLibrary.serviceFee.palette = [app, '#1C1E2B', '#FFFFFF', '#7C8194'];
    return { ok: true, stored: DB.templateLibrary.serviceFee.palette[0] };
  } catch (e) { return { ok: false, why: e.message }; }
}, '#F47A1F');

const printWith = async (registry) => {
  await p.evaluate((reg) => {
    window.dgIdentityLoaded = function () { return reg !== null; };
    window.dgIdentityValue = function (k) { return (reg && reg[k]) || ''; };
  }, registry);
  const n = popups.length;
  await p.evaluate(() => { try { window.v25OpenPrintPdf('QA', '<h2>Section</h2><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>', 'serviceFee'); } catch (e) { window.__e = String(e && e.message); } });
  await p.waitForTimeout(1500);
  if (popups.length === n) return { none: true };
  const pg = popups[popups.length - 1];
  const got = await pg.evaluate(() => ({
    strip: (document.querySelector('.header div:last-child') || {}).textContent || '',
    foot: (document.querySelector('.footer') || {}).textContent || '',
    rule: getComputedStyle(document.querySelector('.header')).borderBottomColor,
    th: (function () { const t = document.querySelector('th'); return t ? getComputedStyle(t).backgroundColor : null; })(),
  }));
  await pg.close();
  return got;
};

const FULL = { iata: 'QA-IATA-1', cr: '1010000000', cr_number: '1010000000', vat_number: '300000000000003', website: 'qa.example' };
const full = await printWith(FULL);
const partial = await printWith({ cr_number: '1010000000' });   /* only one fact on file */
const none = await printWith(null);                              /* registry never loaded */

/* the brake: no brand stylesheet at all */
await p.evaluate(() => { const l = document.getElementById('dgTokensLink'); if (l) l.remove();
  [...document.querySelectorAll('style')].forEach((s) => { if (/data-identity="classic"|\[data-identity='classic'\]/.test(s.textContent || '')) s.remove(); }); });
await p.waitForTimeout(500);
const noTokens = await printWith(FULL);

const links = await p.evaluate(async () => {
  const out = {};
  for (const pg of ['bookings', 'invoices', 'tickets']) {
    try { current = pg; openLead = null; render(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 900));
    const v = document.getElementById('view');
    out[pg] = [...v.querySelectorAll('a,button')].map((e) => e.getAttribute('href') || String(e.onclick || ''))
      .filter((s) => /https?:\/\//.test(s)).join(' ');
  }
  return out;
});
await b.close(); srv.close?.();

const allLinks = Object.values(links).join(' ');
const checks = [
  ['the identity strip is built from the registry — no invented CR, no wrong domain',
    !full.none && /QA-IATA-1/.test(full.strip) && /1010000000/.test(full.strip) &&
    !/7000000000/.test(full.strip + full.foot) && !/direct\.com\.sa/.test(full.strip + full.foot),
    JSON.stringify({ strip: full.strip, foot: String(full.foot).slice(0, 60), seeded })],
  ['a fact the registry does not have does not appear — no empty label, no stray separator',
    /CR 1010000000/.test(partial.strip) && !/IATA/.test(partial.strip) && !/VAT/.test(partial.strip) &&
    !/^\s*·|·\s*·|·\s*$/.test(partial.strip),
    JSON.stringify({ strip: partial.strip })],
  ['when the registry has not loaded, the document says so instead of inventing',
    !/\d{6,}/.test(none.strip) && /Generator|المولّد/.test(none.strip),
    JSON.stringify({ strip: none.strip })],
  ['the accent is the document orange even when the stored template says otherwise',
    full.rule === DOC_ORANGE && full.th === DOC_ORANGE && full.rule !== APP_ORANGE,
    JSON.stringify({ headerRule: full.rule, tableHeader: full.th, storedWas: seeded.stored })],
  ['the "Open in Direct" buttons point at the host that answers',
    /payments\.directksa\.com/.test(allLinks) && !/payments\.direct\.com\.sa/.test(allLinks),
    JSON.stringify(links)],
  ['brake: with no brand stylesheet the fallback is still the document orange',
    noTokens.rule === DOC_ORANGE && noTokens.rule !== APP_ORANGE,
    JSON.stringify({ headerRule: noTokens.rule })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
