/* probe-no-button-throws.mjs — press everything, in both languages, and see if anything breaks.

   Every probe in this battery asks whether a particular screen tells the truth. None of them asked
   the blunt question: does any button in this app throw when a person presses it? Seventy-nine
   script files wrap each other's render(), and a layer that throws inside a click handler leaves no
   trace on screen — the button simply does nothing, and the person presses it again.

   Driven live against the real database on 2026-09-21 (fire #154) across eleven pages, 132 presses
   per language: zero page errors and zero console errors, in English and in Arabic. This keeps that
   true.

   What this holds:
     1. enough buttons were actually pressed for the run to mean anything — a pass with nothing
        clicked is the failure mode of a probe like this, so the count is a check of its own;
     2. no page error in English;
     3. none in Arabic, where a different set of code paths runs;
     4. and nothing an error handler swallowed into the console either.

   Destructive wording is skipped by name (delete, archive, remove, switch off, sign out, send reset
   — and their Arabic equivalents), writes are blocked at the route, and anything that opens is
   closed before the next press.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): making one layer
   throw inside a click handler fails checks 2 and 3 and prints the thrown message. Check 4 stays
   green there, which is the point of having it separately: a listener that throws surfaces as a
   page error, while a handler that catches its own failure and writes it to the console — the
   commoner shape in this codebase, where every layer is wrapped in try/catch — surfaces only there.
   Run: node scripts/qa/probe-no-button-throws.mjs                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9107; const BASE = 'http://localhost:' + PORT;

/* 2026-09-23 (fire #233): this list was ten routes and the app answers twenty-five. M78 was
   written one round earlier about exactly this shape — a sweep is only as wide as its list — so
   the fifteen it had never pressed a button on are in it now: the Dashboard, Sync, Projects, the
   audit and archive screens, the three read-only mirrors, the Generator and the SOP/SLA pair. */
const PAGES = ['today', 'dashboard', 'leads', 'clients', 'finance', 'offers', 'airlines', 'vendors',
  'providers', 'sopsla', 'sops', 'slas', 'reports', 'events', 'ops', 'operations', 'projects',
  'documents', 'activity', 'archive', 'bookings', 'invoices', 'tickets', 'sync', 'settings'];
const SKIP = 'sign out|delete|archive|remove|switch off|send reset|حذف|أرشفة|إيقاف|إرسال';

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  p.on('pageerror', (e) => errors.push(lang + ' page: ' + String(e.message).slice(0, 120)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(lang + ' console: ' + m.text().slice(0, 120)); });
  p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com') || u.href.includes('payments.directksa.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(2500);

  let clicked = 0;
  for (const pg of PAGES) {
    await p.evaluate((x) => { try { current = x; openLead = null; render(); } catch (_) { } }, pg);
    await p.waitForTimeout(900);
    const n = await p.evaluate(() => document.getElementById('view').querySelectorAll('button').length);
    for (let i = 0; i < Math.min(n, 22); i++) {
      const r = await p.evaluate(({ ix, skipSrc }) => {
        const v = document.getElementById('view'); const bs = v.querySelectorAll('button');
        const el = bs[ix]; if (!el) return null;
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (new RegExp(skipSrc, 'i').test(t)) return { skipped: true };
        if (el.offsetParent === null) return { skipped: true };
        try { el.click(); } catch (_) { return { skipped: true }; }
        return { clicked: true };
      }, { ix: i, skipSrc: SKIP });
      if (!r) break;
      if (r.clicked) clicked++;
      await p.waitForTimeout(160);
      await p.evaluate((x) => { try { if (typeof closeModal === 'function') closeModal(); var ov = document.getElementById('v48ov'); if (ov) ov.remove(); current = x; openLead = null; render(); } catch (_) { } }, pg);
      await p.waitForTimeout(140);
    }
  }
  await ctx.close();
  return { clicked, errors };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const checks = [
  ['enough buttons were actually pressed for this to mean anything',
    en.clicked >= 25 && ar.clicked >= 25, 'EN ' + en.clicked + ' presses, AR ' + ar.clicked],
  ['no page error in English', !en.errors.some((e) => / page: /.test(e)), en.errors.filter((e) => / page: /.test(e)).slice(0, 2).join(' | ')],
  ['none in Arabic either, where a different set of code paths runs',
    !ar.errors.some((e) => / page: /.test(e)), ar.errors.filter((e) => / page: /.test(e)).slice(0, 2).join(' | ')],
  ['and nothing swallowed into the console',
    !en.errors.concat(ar.errors).some((e) => / console: /.test(e)),
    en.errors.concat(ar.errors).filter((e) => / console: /.test(e)).slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
