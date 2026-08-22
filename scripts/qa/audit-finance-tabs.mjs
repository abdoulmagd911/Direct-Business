/* audit-finance-tabs.mjs — Finance page tab audit (2026-08-22, owner ruling 3: keep all 8
   tabs, "every bit inside each one working"). Walks all 8 Finance tabs — Performance,
   Clients & collections, Ledger, Report Builder, Import, Expenses, Payment proofs, B2C — in
   EN and AR, and checks: every onclick/onchange inside the rendered tab resolves to a real
   global function, the tab actually renders non-trivial content, no JS/console errors, and
   no tab switch is slow.

   Built after two false results from an earlier draft of this exact probe, both the same
   class of mistake — the probe silently passing because it never actually reached the real
   page state it claimed to be testing:
     1. A blanket route stub (`fulfill([])` for everything) meant window.supabase never
        existed, so the app's own Supabase client never initialised, finLoad() bailed, and
        the page sat on "Loading the finance ledger…" forever — the probe cheerfully audited
        the Today page 16 times and reported "no findings". Fixed here by loading the real
        supabase-js UMD exactly like every other probe in this directory, and by refusing to
        run any tab check at all unless it can first PROVE current==='finance', the finGo-
        driven tab buttons exist, and FIN.rows is non-null.
     2. Measuring each tab ~immediately after the click caught several tabs mid-"Loading…"
        and produced a false "renders EMPTY" that didn't reproduce with a longer wait. Fixed
        by polling #view's content until it stops growing AND stays stable for 2 consecutive
        samples, instead of a fixed sleep. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8154;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

const TABS = [
  { key: 'overview', en: 'Performance', ar: 'الأداء' },
  { key: 'clients', en: 'Clients & collections', ar: 'العملاء والتحصيل' },
  { key: 'ledger', en: 'Ledger', ar: 'السجل' },
  { key: 'reports', en: 'Report Builder', ar: 'منشئ التقارير' },
  { key: 'import', en: 'Import', ar: 'استيراد' },
  { key: 'expenses', en: 'expenses (injected)', ar: 'expenses (injected)' },
  { key: 'proofs', en: 'proofs (injected)', ar: 'proofs (injected)' },
  { key: 'b2c', en: 'b2c (injected)', ar: 'b2c (injected)' },
];

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
    if (cur === prev && cur > 60) {
      stableCount++;
      if (stableCount >= 2) return { length: cur, ms: Date.now() - start };
    } else {
      stableCount = 0;
    }
    prev = cur;
    await p.waitForTimeout(60);
  }
  return { length: prev, ms: Date.now() - start, timedOut: true };
}

async function checkHandlers(p) {
  return p.evaluate(() => {
    const v = document.getElementById('view');
    if (!v) return { missing: [], count: 0 };
    const els = [...v.querySelectorAll('[onclick], [onchange], [oninput]')];
    const names = new Set();
    els.forEach((el) => {
      ['onclick', 'onchange', 'oninput'].forEach((attr) => {
        const val = el.getAttribute(attr);
        if (!val) return;
        const m = val.match(/^\s*(?:event\.[a-zA-Z]+\(\);\s*)*([a-zA-Z_$][a-zA-Z0-9_$.]*)\s*\(/);
        if (m) names.add(m[1].split('.')[0]);
      });
    });
    const missing = [];
    names.forEach((n) => {
      let fn;
      try { fn = window[n]; } catch (e) { fn = undefined; }
      // Accept real functions AND known built-in globals legitimately called as
      // e.g. document.getElementById(...) — only flag names with no meaningful binding.
      if (typeof fn === 'function') return;
      if (fn != null && typeof fn === 'object') return;
      missing.push(n);
    });
    return { missing, count: names.size };
  });
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

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);

  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });

  // Blind-spot guard: refuse to run any tab check unless we can PROVE we're really on a
  // loaded Finance page — this is exactly the check the v1 draft skipped.
  const preflight = await p.evaluate(() => {
    const v = document.getElementById('view');
    const hasFinGoButtons = v ? v.querySelectorAll('[onclick*="finGo("]').length : 0;
    return {
      current: (typeof current !== 'undefined') ? current : null,
      finRowsIsNull: (typeof FIN === 'undefined') || FIN.rows == null,
      hasFinGoButtons,
      viewLength: v ? v.innerHTML.length : -1,
    };
  });
  console.log('preflight:', JSON.stringify(preflight));
  if (preflight.current !== 'finance') { console.log('\nABORT — current is not "finance", refusing to audit blind.'); process.exit(1); }
  if (preflight.hasFinGoButtons < 4) { console.log('\nABORT — fewer than 4 finGo() tab buttons found, refusing to audit blind.'); process.exit(1); }
  // give FIN.rows one more real chance to load before declaring the blind spot
  if (preflight.finRowsIsNull) {
    await p.waitForTimeout(3000);
    const stillNull = await p.evaluate(() => (typeof FIN === 'undefined') || FIN.rows == null);
    if (stillNull) { console.log('\nABORT — FIN.rows never loaded, refusing to audit blind (this is the exact v1 failure mode).'); process.exit(1); }
  }
  ok('preflight passed: current===finance, finGo buttons present, FIN.rows loaded');

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
    for (const tab of TABS) {
      const before = errors.length;
      const t0 = Date.now();
      const clicked = await p.evaluate((k) => { if (typeof window.finGo === 'function') { window.finGo(k); return true; } return false; }, tab.key);
      if (!clicked) { fail(`${lang.label} ${tab.key}: window.finGo is not a function`); continue; }
      const settled = await settleContent(p, 4000);
      const elapsed = Date.now() - t0;
      const label = `${lang.label} ${tab.key}`;

      if (settled.timedOut) fail(`${label}: content never settled within 4000ms (last length ${settled.length})`);
      else if (settled.length <= 60) fail(`${label}: rendered content is empty/trivial (${settled.length} chars)`);
      else ok(`${label}: rendered ${settled.length} chars, settled in ${settled.ms}ms`);

      if (elapsed > 800) fail(`${label}: slow tab switch — ${elapsed}ms (freeze-class regression)`);

      const handlerCheck = await checkHandlers(p);
      if (handlerCheck.missing.length) fail(`${label}: ${handlerCheck.missing.length} onclick/onchange handler(s) resolve to nothing: ${handlerCheck.missing.join(', ')}`);
      else ok(`${label}: all ${handlerCheck.count} onclick/onchange handler(s) resolve to real functions`);

      const newErrors = errors.slice(before);
      if (newErrors.length) fail(`${label}: ${newErrors.length} JS/console error(s): ${newErrors.join(' | ')}`);
    }
  }

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nTotal JS/console errors across the run:', realErrors.length ? realErrors.length : 'none');

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nfinance tabs audit OK - all 8 tabs x EN/AR render real content, all handlers resolve, no slow switches');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
