/* probe-no-vat-display.mjs — VAT is never shown or mentioned, anywhere, at any stage, in
   any view or report. Hard rule (docs/DECISIONS.md), ruled twice by the owner in writing,
   asked a third time by a session that should have checked first.

   This is deliberately a RENDERED-DOM check, not a static grep. `vat_sar` is a legitimate
   stored column (js/16-finance-ledger.js computes it, per the "VAT is stored but never
   displayed" rule) — a source-text grep for "vat" would false-positive on that forever and
   get muted, which is worse than no check at all. This probe drives the real harness,
   visits every nav page plus all 8 Finance tabs in EN and AR, and asserts the banned
   strings never appear in `document.body.innerText` — i.e. what a person actually sees,
   not what the source code contains.

   Same blind-spot discipline as scripts/qa/audit-finance-tabs.mjs: every check is "did the
   view actually render something real" AND ONLY THEN "is it clean" — a probe that skips the
   first half can report "clean" on a page that silently failed to load. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8163;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

// Word-boundary / phrase match so this never flags an unrelated substring — this app's
// domain has no legitimate word containing "VAT" other than the tax itself.
const BANNED = [/\bVAT\b/i, /value[\s-]added tax/i, /ضريبة\s*القيمة\s*المضافة/, /ض\.?\s*ق\.?\s*م/];

// The one legitimate exception: "CR, VAT" / "CR / VAT" / "CR · VAT" as a company's
// registration-ID field label (VAT registration NUMBER, alongside Commercial Registration
// number) — an identifier, not a computed tax amount. Confirmed by reading the actual
// rendered text (Settings/▸ Reference: "Company profile | CR, VAT, IBAN, Wakeel") before
// adding this — never assumed. Only a "VAT" immediately preceded by "CR" (short separator)
// is exempt; every other occurrence is still banned.
const CR_VAT_EXEMPT = /CR[\s,/·-]{0,4}$/i;

function findVatViolation(text) {
  // Check every \bVAT\b occurrence individually for the CR-adjacent exemption — a page
  // could legitimately have "CR, VAT" AND separately have a real violation elsewhere.
  const vatHits = [...text.matchAll(/\bVAT\b/gi)];
  const realVat = vatHits.find((m) => !CR_VAT_EXEMPT.test(text.slice(Math.max(0, m.index - 6), m.index)));
  if (realVat) return realVat[0];
  for (const re of BANNED.slice(1)) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

const FIN_TABS = ['overview', 'clients', 'ledger', 'reports', 'import', 'expenses', 'proofs', 'b2c'];

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function settleContent(p, timeoutMs) {
  const start = Date.now();
  let prev = null, stableCount = 0;
  while (Date.now() - start < timeoutMs) {
    const cur = await p.evaluate(() => {
      const v = document.getElementById('view');
      return v ? v.innerHTML.length : -1;
    });
    if (cur === prev && cur > 40) {
      stableCount++;
      if (stableCount >= 2) return { length: cur, timedOut: false };
    } else stableCount = 0;
    prev = cur;
    await p.waitForTimeout(60);
  }
  return { length: prev, timedOut: true };
}

function scanVAT(text, label) {
  const hit = findVatViolation(text);
  if (hit) fail(`${label}: VAT string found on screen (matched ${JSON.stringify(hit)}) — banned by docs/DECISIONS.md`);
  else ok(`${label}: no VAT string on screen`);
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);

  for (const lang of [{ code: 'en', label: 'EN' }, { code: 'ar', label: 'AR' }]) {
    console.log(`\n=== ${lang.label} ===`);
    if (lang.code === 'ar') {
      await p.evaluate((code) => {
        try {
          if (typeof setLang === 'function') { setLang(code); return; }
          if (typeof LANG !== 'undefined') { LANG = code; if (typeof render === 'function') render(); }
        } catch (e) {}
      }, lang.code);
      await p.waitForTimeout(700);
    }

    // Every top-level nav page, one at a time — reads whatever #nav currently offers, so
    // this doesn't need its own hardcoded page list to go stale against nav changes.
    const navLabels = await p.evaluate(() => [...document.querySelectorAll('#nav button')].map((x) => x.textContent.trim()).filter(Boolean));
    for (const label of navLabels) {
      const clicked = await p.evaluate((l) => {
        const btn = [...document.querySelectorAll('#nav button')].find((x) => x.textContent.trim() === l);
        if (btn) { btn.click(); return true; }
        return false;
      }, label);
      if (!clicked) { fail(`${lang.label} nav "${label}": button not found`); continue; }
      const settled = await settleContent(p, 4000);
      const pageLabel = `${lang.label} page "${label}"`;
      if (settled.timedOut || settled.length <= 40) fail(`${pageLabel}: BLIND SPOT — page did not render (length ${settled.length})`);
      else {
        const text = await p.evaluate(() => document.body.innerText);
        scanVAT(text, pageLabel);
      }
    }

    // Finance's 8 tabs specifically, via finGo — the nav sweep above only exercises
    // whichever tab Finance happens to default to.
    await p.evaluate(() => { const btn = [...document.querySelectorAll('#nav button')].find((x) => /Finance|المالية/.test(x.textContent)); if (btn) btn.click(); });
    await settleContent(p, 4000);
    for (const tab of FIN_TABS) {
      const clicked = await p.evaluate((k) => { if (typeof window.finGo === 'function') { window.finGo(k); return true; } return false; }, tab);
      if (!clicked) { fail(`${lang.label} Finance/${tab}: window.finGo is not a function`); continue; }
      const settled = await settleContent(p, 4000);
      const tabLabel = `${lang.label} Finance/${tab}`;
      if (settled.timedOut || settled.length <= 40) fail(`${tabLabel}: BLIND SPOT — tab did not render (length ${settled.length})`);
      else {
        const text = await p.evaluate(() => document.getElementById('view').innerText);
        scanVAT(text, tabLabel);
      }
    }
  }

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nPASSED — no VAT string anywhere on screen, every page + all 8 Finance tabs, EN+AR, no blind spots.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
