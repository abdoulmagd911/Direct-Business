/* diag-agency-profile-card.mjs (2026-09-21) — REPORT, asserts nothing. Drives the LIVE database.

   The company's identity is stored TWICE:
     · `company_identity` — the registry (29 rows). Since #160-#162 every document reads it.
     · `app_state.data.agency` — an older block of 25 fields, still full of values.

   Read straight from the live database, seven of the thirteen comparable fields DISAGREE,
   including the VAT registration number and a bank IBAN. This measures what the app does with
   that: which store the screen shows, which store the form writes to, and whether the card's own
   sentence about itself is still true.

   Writes nothing: every table write and save_state call is blocked at the route.
   Run:  node scripts/qa/diag-agency-profile-card.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const REAL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
const ROOT = process.env.APP_DIR || process.cwd();
const PORT = 9118; const BASE = 'http://localhost:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(String(req.url).split('?')[0]);
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
}).listen(PORT);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  proxy: { server: 'direct://' }, args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errs = []; const blocked = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss());

await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  /* read-only: block every table write and every save_state call, let the read rpcs through */
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    blocked.push(m + ' ' + u.pathname);
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try {
    const resp = await fetch(REAL + u.pathname + u.search, { method: m, headers: rq.headers(),
      body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && DB.businesses && DB.businesses.length > 0, { timeout: 120000 });
/* the registry loads on its own timer — wait for it rather than guessing */
await p.waitForFunction(() => { try { return typeof window.dgIdentityLoaded === 'function' && window.dgIdentityLoaded(); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(3000);

async function look(which) {
  return p.evaluate((w) => {
  try { current = w; openLead = null; render(); } catch (_) { }
  return new Promise((res) => setTimeout(() => {
    const v = document.getElementById('view');
    const vis = (el) => !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none');
    const cards = [].slice.call(v.querySelectorAll('.card')).filter(vis);
    const card = cards.find((c) => /Agency profile/i.test(c.textContent || ''));
    const reg = (k) => { try { return window.dgIdentityValue(k, 'en') || ''; } catch (_) { return ''; } };
    const A = (typeof AGENCY !== 'undefined' && AGENCY) ? AGENCY : {};
    const S = (DB && DB.agency) ? DB.agency : {};
    const inputs = card ? [].slice.call(card.querySelectorAll('input')).map((i) => (i.value || '')) : [];
    return res({
      reachable: !!card,
      subtitle: card ? ((card.querySelector('.ch-sub') || {}).textContent || '').trim() : '',
      inputCount: inputs.length,
      inputsEmpty: inputs.filter((x) => !x.trim()).length,
      /* never print the numbers themselves — lengths and agreement only (repo rule 7) */
      cmp: ['vat', 'iban', 'cr', 'bank', 'name_en', 'iataWakeel', 'capital'].map((k) => {
        const regKey = { vat: 'vat_number', iban: 'iban_alinma', cr: 'cr_number', capital: 'capital' }[k];
        const r = regKey ? reg(regKey) : null;
        return { field: k, shown: (A[k] || '').length, oldStore: (S[k] || '').length,
          registry: r == null ? '(no registry key)' : String(r).length,
          shownMatchesRegistry: r == null ? null : String(A[k] || '').indexOf(String(r).trim()) === 0,
          shownMatchesOldStore: String(A[k] || '') === String(S[k] || '') };
      }),
      zakatInOldStore: !!(S.zakatId && String(S.zakatId).trim()),
      zakatInRegistry: !!reg('zakat_id'),
      navHasDashboard: (typeof VIEWS !== 'undefined' ? VIEWS : []).some((x) => x.id === 'dashboard'),
    });
  }, 3500));
  }, which);
}

const today = await look('today');
const out = await look('dashboard');

console.log('--- the "Agency profile — KSA settings" card, driven live ---');
console.log('on the TODAY page (the morning screen, a nav button everyone has): ' + today.reachable);
console.log('reachable at /dashboard: ' + out.reachable + ' · /dashboard has a nav button: ' + out.navHasDashboard);
console.log('its sentence about itself: "' + out.subtitle + '"');
console.log('inputs: ' + out.inputCount + ' (' + out.inputsEmpty + ' empty on screen)');
console.log('');
console.log('field      | on screen | old store | registry | screen==registry | screen==old store');
for (const c of out.cmp) {
  console.log('  ' + c.field.padEnd(9) + '| ' + String(c.shown).padEnd(10) + '| ' + String(c.oldStore).padEnd(10)
    + '| ' + String(c.registry).padEnd(9) + '| ' + String(c.shownMatchesRegistry).padEnd(17) + '| ' + c.shownMatchesOldStore);
}
console.log('  (lengths, not values — this repository is public)');
console.log('');
console.log('Zakat / Tax ID — in the old store: ' + out.zakatInOldStore + ' · in the registry: ' + out.zakatInRegistry);
console.log('writes blocked during the run: ' + blocked.length + (blocked.length ? ' (' + blocked.slice(0, 3).join(', ') + ')' : ''));
console.log('JS errors: ' + errs.length + (errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''));
await b.close(); srv.close(); process.exit(0);
