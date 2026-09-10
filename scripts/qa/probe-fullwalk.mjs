/* probe-fullwalk.mjs (2026-09-10, fire #12) — a browser walk of the whole merged app against the
   mock, in English and Arabic, as the admin. It exists because the ordinary probes' route GLOBS
   (`**host/**`) do NOT intercept in the Playwright installed in reprovisioned web containers
   (proven vs 1.52 and 1.55), and chromium here cannot reach the real CDN — so those probes time
   out on #cl_email and the whole battery is dark. This probe uses PREDICATE route matchers
   (u=>u.href.includes(host)), which DO intercept, and must be run with the proxy stripped
   (chromium routes localhost through the egress proxy and hangs otherwise):

       env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy node scripts/qa/probe-fullwalk.mjs

   It is deliberately a broad smoke walk, not a deep assertion probe: for every page (and every
   Finance tab) in both languages it fails on a JS page error, a blank/near-blank view, a raw
   NaN/undefined/[object Object] on screen, or VAT shown on a Finance surface (owner rule M1). The
   point is to give the merged app (13 landings deep) real in-browser coverage in a container where
   the glob-based battery cannot run. Exits non-zero on any failure.
   NOTE: this probe deliberately does NOT scan for the word "VAT". M1 (docs/DECISIONS.md) is about
   cost/profit/revenue being clean, NOT about the glyph appearing — owner verbatim: "I dont care
   weither vat shows or not". The numeric M1 guard lives in probe-no-vat-display.mjs; a "VAT" on the
   Clients & collections / Report Builder tabs is the client's VAT-registration NUMBER (a legitimate
   matching identifier), not VAT in a money figure. An earlier version of this file scanned for the
   word and raised four false positives; that check was removed.
   PORT: 8790 (verified free by scanning every PORT= in scripts/qa). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8790; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failed = 0, passed = 0;
const fail = (m) => { failed++; console.log('  x ' + m); };
const ok = (m) => { passed++; console.log('  + ' + m); };
const PAGES = ['today', 'leads', 'clients', 'offers', 'documents', 'ops', 'reports', 'finance', 'settings', 'events', 'airlines', 'vendors', 'sopsla', 'activity', 'archive', 'bookings', 'invoices', 'tickets'];
const FIN_TABS = ['overview', 'clients', 'ledger', 'reports', 'import', 'expenses', 'proofs', 'b2c'];

async function walk(lang) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('JS: ' + String(e.message).slice(0, 160)));
  p.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/ERR_CERT|ERR_TUNNEL|clearbit|favicon|net::ERR_/.test(t)) errs.push('CON: ' + t.slice(0, 160)); } });
  /* PREDICATE matchers — the fix. Glob '**host/**' does not intercept in this Playwright. */
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com'), (r) => r.abort());
  await p.route((u) => u.href.includes('clearbit.com'), (r) => r.abort());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 30000 }); } catch (_) { fail(`${lang}: login form never rendered (#cl_email) — supabase-js likely did not load`); await b.close(); return; }
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  let up = false; for (let i = 0; i < 60 && !up; i++) { up = await p.evaluate(() => !!document.querySelector('#nav button') && ((document.getElementById('view') || {}).innerText || '').trim().length > 40).catch(() => false); if (!up) await p.waitForTimeout(500); }
  if (!up) { fail(`${lang}: app never came up after sign-in`); await b.close(); return; }
  ok(`${lang}: signed in, app up`);
  await p.waitForTimeout(6000);
  if (lang === 'ar') { await p.evaluate(() => { try { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); } catch (_) { } }); await p.waitForTimeout(1500); }

  const inspect = async (label) => {
    await p.waitForTimeout(600);
    const v = await p.evaluate(() => { const el = document.getElementById('view'); const t = (el && el.innerText || '').replace(/\s+/g, ' ').trim(); return { len: t.length, bad: [...new Set((t.match(/\b(NaN|undefined|\[object Object\])\b/g) || []))] }; }).catch((e) => ({ len: -1, bad: ['EVAL:' + e.message] }));
    if (v.len < 40) fail(`${lang} ${label}: blank/near-blank (${v.len} chars)`);
    else if (v.bad.length) fail(`${lang} ${label}: shows ${JSON.stringify(v.bad)}`);
    else ok(`${lang} ${label} clean (${v.len} chars)`);
  };

  for (const pg of PAGES) {
    const r = await p.evaluate((pg) => { try { current = pg; openLead = null; render(); return true; } catch (e) { return 'THREW ' + e.message; } }, pg).catch((e) => 'EVAL ' + e.message);
    if (r !== true) { fail(`${lang} ${pg}: render threw — ${r}`); continue; }
    await inspect(pg);
    if (pg === 'finance') for (const tab of FIN_TABS) {
      const t = await p.evaluate((t) => { try { if (typeof finGo === 'function') { finGo(t); return true; } return 'no finGo'; } catch (e) { return 'THREW ' + e.message; } }, tab).catch((e) => 'EVAL ' + e.message);
      if (t !== true) { fail(`${lang} finance/${tab}: ${t}`); continue; }
      await inspect('finance/' + tab);
    }
  }
  if (errs.length) [...new Set(errs)].slice(0, 12).forEach((e) => fail(`${lang} page error: ${e}`));
  else ok(`${lang}: no JS/console errors across the walk`);
  await b.close();
}

await walk('en');
await walk('ar');
console.log(`\n${failed ? 'FAILED — ' + failed + ' / ' + (passed + failed) : 'ALL PASS — ' + passed} check(s)`);
srv.close(); process.exit(failed ? 1 : 0);
