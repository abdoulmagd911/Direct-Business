/* probe-the-one-pager-asks-the-registry.mjs — the company one-pager prints what the registry says,
   and nothing it remembers.

   Fire #161, following #160. The "About Direct Travel" one-pager — printed for clients and attached
   to tenders — took every identifier on it from literals written into `core-06`'s AGENCY constant:
   the CR, the unified number, the trade licence, the DUNS, the Zakat/Tax ID, the Amadeus office and
   PIN, the head-office address, the phone. Two problems in one, and the second is the one that bites:

     · they are the company's real registered identifiers, sitting in a PUBLIC repository (rule 7);
     · and a second copy drifts. Fire #160 caught two of those copies a digit short of the registry,
       printing onto quotations. Measured again here when the page was rewired: the hardcoded address
       carried the WRONG postcode and the hardcoded phone was not the licence phone either.

   So the page asks `window.dgIdentityValue(key)` now, and a fact with no value in the registry does
   not appear at all — no label with a dash after it, and nothing remembered.

   What this holds:
     1. with the registry loaded, the one-pager prints the REGISTRY's values;
     2. a fact the registry does not hold is absent entirely — no dangling label, no placeholder dash;
     3. with the registry not loaded, no identifier appears and the page's own notice says nothing on
        it was verified (the fire #139 behaviour, which this must not break);
     4. the AGENCY constant carries no long digit strings at all — a name-free source check, so a
        real identifier cannot quietly move back into the code;
     5. no JS errors.

   Check 4 is the durable one: it does not know or name a single number, and it fails the moment one
   is written back into that line.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting a
   hardcoded DUNS back into the one-pager's rows fails checks 1 and 2.
   Run: node scripts/qa/probe-the-one-pager-asks-the-registry.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9112; const BASE = 'http://localhost:' + PORT;
const APP = process.env.APP_DIR || path.resolve(new URL('../..', import.meta.url).pathname);

/* synthetic values, deliberately unlike anything in the code */
const V = { brand_name: 'QA Placeholder Travel Co.', iata: '99000011', amadeus: 'QAOFFICE9 (GDS)',
  cr_number: '1000000009', vat_number: '300000000000009', duns: '99-000-0011',
  mot_licence: '99000012', unified_number: '7000000009', hq_address: 'QA Tower, Test District, Riyadh 11111',
  website: 'www.qa-example.test', phone_licence: '+966 11 000 0000' };
const IDENTITY = Object.keys(V).map((k, i) => ({
  id: 'qi' + i, key: k, category: 'legal', label_en: k, label_ar: k, value_en: V[k], value_ar: null,
  sort: i + 1, expires_on: null, proof_path: null, show_on_documents: true, sensitive: false }));

const srv = start(PORT, { company_identity: IDENTITY });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(failRegistry) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (failRegistry && /\/rest\/v1\/company_identity/.test(u.pathname) && ['GET', 'HEAD'].includes(m)) {
      await r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'simulated outage' }) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  /* the registry loads eagerly after sign-in (js/66) — give it its ticks either way */
  await p.waitForTimeout(9000);
  const [pop] = await Promise.all([
    p.waitForEvent('popup', { timeout: 30000 }).catch(() => null),
    p.evaluate(() => { try { directAboutPage(false); } catch (_) { } }),
  ]);
  let txt = '';
  if (pop) { await pop.waitForTimeout(1200); txt = await pop.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await pop.close().catch(() => { }); }
  await ctx.close();
  return txt;
}

const good = await run(false);
const broke = await run(true);
await b.close(); srv.close?.();

/* the AGENCY constant must carry no long digit string at all — this names no number */
let agencyLine = '';
try {
  const src = fs.readFileSync(path.join(APP, 'js/core/core-06-v18-v21.js'), 'utf8');
  agencyLine = (src.split('\n').find((l) => l.startsWith('const AGENCY=')) || '').split('/*')[0];
} catch (_) { }
const digits = (agencyLine.match(/\d{6,}/g) || []);

const glance = (t) => { const m = t.match(/At a glance[^]*?Key clients/); return m ? m[0] : t; };
const g = glance(good);
const checks = [
  ['with the registry loaded the one-pager prints the REGISTRY\'s values',
    Object.keys(V).filter((k) => ['iata', 'cr_number', 'vat_number', 'duns', 'mot_licence', 'unified_number', 'hq_address'].includes(k))
      .every((k) => g.indexOf(V[k]) >= 0), g.slice(0, 130)],
  ['a fact the registry does not hold is absent entirely — no dangling label, no placeholder dash',
    !/Zakat/i.test(g) && !/\b-\s*(CR|VAT|DUNS)\b/i.test(g) && !/:\s*-\s/.test(g), (g.match(/Zakat[^·]{0,30}/) || ['(no Zakat row — right)'])[0]],
  ['with the registry not loaded, no identifier appears and the page says nothing was verified',
    Object.values(V).every((v) => broke.indexOf(v) < 0) && /could not be checked|تعذّر/i.test(broke),
    broke.slice(0, 120)],
  ['the AGENCY constant carries no long digit string at all',
    agencyLine.length > 0 && digits.length === 0, JSON.stringify(digits)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
