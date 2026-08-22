/* probe-money-placement.mjs — Spec 6 runtime guard: money lives on the Finance page ONLY
   (owner ruling 2026-08-21). Leads and Clients report the relationship, never the amount.

   check-structure.mjs's rule 7 catches the money strings living in the four named source
   files. This probe catches what a static scan cannot: anything a DIFFERENT file injects
   onto these pages at runtime — which is exactly how the 2026-08-21 sweep found violations
   the earlier "already money-free" check missed (it clicked <tr> elements that aren't
   clickable, so it silently re-scanned the same stale list six times and never actually
   opened a record). This probe runs against the REAL harness (mock-supabase + the live
   working tree) and asserts on the rendered DOM, not on source text.

   Every check below is two assertions, not one: (1) the view actually opened — a specific,
   language-independent structural marker is present — and only then (2) the visible text
   contains none of the banned money strings. A probe that skips (1) and just scans text can
   report "clean" on a page that silently failed to render at all; that is worse than no
   probe, because it reads as proof instead of as nothing having been checked. Any assertion
   failure exits 1 immediately with which check and which language failed. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8137;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

const MONEY_STRINGS = [' SAR', 'ريال', 'Lifetime billed', 'Open deal value', 'Deal value', 'Outstanding', 'Credit held'];

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

function scanMoney(text, label) {
  const hits = MONEY_STRINGS.filter(s => text.includes(s));
  if (hits.length) fail(`${label}: money string(s) found on screen: ${hits.map(h => JSON.stringify(h)).join(', ')}`);
  else ok(`${label}: no money string on screen`);
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());

  await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);

  // L1 = a lead (mock i=1, is_client false). L0 = a client (mock i=0, is_client true).
  // Force the credit-utilization card's trigger condition onto the lead so this probe
  // actually exercises that path (js/core/core-07-v22-v24.js) instead of relying on the
  // mock happening to already satisfy paymentConfiguration==='PostPaid'.
  await p.evaluate(() => {
    const b = DB.businesses.find(x => x.id === 'L1');
    if (b) { b.paymentConfiguration = 'PostPaid'; b.creditLimit = 50000; }
  });

  const LANGS = [
    { code: 'en', label: 'EN' },
    { code: 'ar', label: 'AR' },
  ];

  for (const lang of LANGS) {
    console.log(`\n=== ${lang.label} ===`);
    await p.evaluate((code) => {
      try {
        if (typeof setLang === 'function') { setLang(code); return; }
        if (typeof LANG !== 'undefined') { LANG = code; if (typeof render === 'function') render(); }
      } catch (e) {}
    }, lang.code);
    await p.waitForTimeout(700);

    // 1 — Leads list
    await p.evaluate(() => { openLead = null; leadDetailView = 'detail'; current = 'leads'; if (typeof render === 'function') render(); });
    await p.waitForTimeout(500);
    {
      const opened = await p.evaluate(() => !!document.getElementById('leadoverview') && current === 'leads' && !openLead);
      if (!opened) fail(`${lang.label} Leads list: BLIND SPOT — #leadoverview not found, view did not actually open`);
      else {
        ok(`${lang.label} Leads list: opened`);
        const text = await p.evaluate(() => document.body.innerText);
        scanMoney(text, `${lang.label} Leads list`);
      }
    }

    // 2 — Opened lead, dashboard view. leadDashboard() is currently unreachable through
    // normal navigation (its entry button is display:none and renderLeads() always calls
    // renderLeadDetail regardless of leadDetailView — a pre-existing condition, not
    // something this probe changes). Call it directly so its output is still covered per
    // spec, rather than silently skipping half of "both views".
    {
      const opened = await p.evaluate(() => {
        const v = document.getElementById('view'); if (!v) return false;
        try { leadDashboard(v, 'L1'); } catch (e) { return false; }
        return !!v.querySelector('.chips') && v.querySelectorAll('.chip').length > 0;
      });
      if (!opened) fail(`${lang.label} Opened lead (dashboard view): BLIND SPOT — .chips not found, view did not actually render`);
      else {
        ok(`${lang.label} Opened lead (dashboard view): rendered`);
        const text = await p.evaluate(() => document.getElementById('view').innerText);
        scanMoney(text, `${lang.label} Opened lead (dashboard view)`);
      }
    }

    // 3 — Opened lead, detail view (the actually-reachable one)
    await p.evaluate(() => { current = 'leads'; openLead = 'L1'; leadDetailView = 'detail'; if (typeof render === 'function') render(); });
    await p.waitForTimeout(600);
    {
      const opened = await p.evaluate(() => !!document.querySelector('.detail-grid') && openLead === 'L1');
      if (!opened) fail(`${lang.label} Opened lead (detail view): BLIND SPOT — .detail-grid not found, view did not actually open`);
      else {
        ok(`${lang.label} Opened lead (detail view): opened`);
        const text = await p.evaluate(() => document.body.innerText);
        scanMoney(text, `${lang.label} Opened lead (detail view)`);
      }
    }

    // 4 — Clients list
    await p.evaluate(() => { current = 'clients'; openLead = null; if (typeof render === 'function') render(); });
    await p.waitForTimeout(600);
    {
      const opened = await p.evaluate(() => !!document.getElementById('cl_kv_count') && current === 'clients');
      if (!opened) fail(`${lang.label} Clients list: BLIND SPOT — #cl_kv_count not found, view did not actually open`);
      else {
        ok(`${lang.label} Clients list: opened`);
        const text = await p.evaluate(() => document.body.innerText);
        scanMoney(text, `${lang.label} Clients list`);
      }
    }

    // 5 — Opened client (a client opens through the Leads detail machinery — current stays
    // 'leads', openLead is the client's id; the Clients page just navigates it there)
    await p.evaluate(() => { current = 'leads'; openLead = 'L0'; leadDetailView = 'detail'; if (typeof render === 'function') render(); });
    await p.waitForTimeout(600);
    {
      const opened = await p.evaluate(() => !!document.querySelector('.detail-grid') && openLead === 'L0' && !!getLead('L0') && !!getLead('L0').isClient);
      if (!opened) fail(`${lang.label} Opened client: BLIND SPOT — .detail-grid not found or L0 is not actually flagged isClient, view did not actually open`);
      else {
        ok(`${lang.label} Opened client: opened`);
        const text = await p.evaluate(() => document.body.innerText);
        scanMoney(text, `${lang.label} Opened client`);
      }
    }
  }

  const realErrors = errors.filter(e => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nPASSED — money stayed off Leads and Clients, EN+AR, all 5 views, no blind spots.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
