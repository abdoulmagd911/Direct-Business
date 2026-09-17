/* probe-identity-registry-signin.mjs — guards the 2026-09-17 (fire #71) fix in js/66 loadRegistry(), found live in
   EVERY session: the eager registry timer's first tick ran before sign-in, the company_identity query went out
   with the anonymous key, the database answered [] with no error, that [] was stored as DG.rows (truthy), the
   timer stopped and every later load returned early — so the Generator's Company Assets page read "The
   registry is empty or could not be read." (29 rows live) and the AGENCY hydration (VAT number, IBAN on invoice
   previews) never ran. The mock answers every GET regardless of session, so this probe answers a
   company_identity GET that carries only the anonymous key with [] — what the real database does — and asserts:
   after a NORMAL sign-in (open at "/", type, submit) the Company Assets page lists the registry rows, the
   empty-registry sentence is absent, and AGENCY carries the VAT number from the registry.
   Sabotage-tested: with the js/66 edit stashed, 4 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-identity-registry-signin.mjs                                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9054; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); let anonGets = 0, signedGets = 0;
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const h = rq.headers();
  if (/\/rest\/v1\/company_identity/.test(u.pathname) && rq.method() === 'GET') { const anon = !h.authorization || h.authorization === 'Bearer ' + (h.apikey || ''); if (anon) { anonGets++; await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; } signedGets++; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: h, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const rh = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) rh[k] = v; });
    await r.fulfill({ status: resp.status, headers: rh, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
/* the NORMAL path: open at "/", wait at the sign-in form long enough for the eager timer to tick, then sign in */
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.waitForTimeout(4000);
const preAnon = anonGets;
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(6000);   /* past the next timer ticks */
await p.evaluate(() => { current = 'documents'; openLead = null; render(); }); await p.waitForTimeout(1500);
await p.evaluate(() => { const btn = [...document.querySelectorAll('#view button, #view a, #view [onclick]')].find((x) => /Company Assets|أصول الشركة|Assets/i.test(x.innerText || '')); if (btn) btn.click(); });
let out = null; for (let i = 0; i < 20; i++) { await p.waitForTimeout(600); out = await p.evaluate(() => { const txt = (document.getElementById('view').innerText || '').replace(/\s+/g, ' '); return { tab: (window.__dgTabProbe ? __dgTabProbe() : null), empty: /registry is empty|السجل فارغ/i.test(txt), editBtns: document.querySelectorAll('#view [onclick*="dgEdit("]').length, vat: String((typeof AGENCY !== 'undefined' && AGENCY && AGENCY.vat) || ''), txt: txt.slice(0, 160) }; }); if (!out.empty && out.editBtns) break; }
await b.close(); srv.close?.();
const checks = [
  ['signed out at the form, the registry is NOT asked for with the anonymous key (nothing to cache as empty)', preAnon === 0],
  ['after a normal sign-in the registry is asked for again WITH the session', signedGets >= 1],
  ['the Company Assets page lists the registry rows — no "registry is empty" sentence', out.tab === 'assets' && !out.empty && out.editBtns > 0],
  ['AGENCY carries the VAT number from the registry (invoice previews are hydrated)', /\d{5,}/.test(out.vat)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ preAnon, anonGets, signedGets, out })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
