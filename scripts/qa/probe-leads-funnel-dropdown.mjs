/* probe-leads-funnel-dropdown.mjs — guards the 2026-09-16 (fire #60) core-02 fixes found by driving the Leads
   table live:
   1. the funnel dropdown (#fnsel) is built from LEADS only — a source tag that only CLIENTS carry (the import
      batch keys "corporate_clients_import_20260821" / "Direct Payments import" on the live data) used to appear
      as a raw-key, dead entry that filtered the leads list down to nothing;
   2. a lead with no activity says so in Arabic on the Arabic card ("No activity yet — click “Log activity”…"
      was English), EN unchanged.
   Mock: one CLIENT is added in-page (no save) with a source only it carries; a lead without activities is
   opened in EN and AR. Sabotage-tested: with the core-02 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-leads-funnel-dropdown.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9047; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(2000);
/* a client that carries a source tag no lead has (in-page only — never saved) */
await p.evaluate(() => { DB.businesses.push({ id: 'probe-client-x', name: 'Probe Client X', isClient: true, stage: 'Won', source: 'clients_only_import_batch', contacts: [], activities: [] }); current = 'leads'; openLead = null; leadView = 'table'; leadFilter.q = ''; leadFilter.funnel = 'all'; render(); });
await p.waitForTimeout(1200);
const opts = await p.evaluate(() => { const s = document.getElementById('fnsel'); return s ? [...s.options].map((o) => o.value) : null; });
const leadKeys = await p.evaluate(() => [...new Set((DB.businesses || []).filter((x) => !x.isClient).map((x) => x.funnelKey || x.source).filter(Boolean))]);
/* a lead with no activities: EN then AR */
const leadId = await p.evaluate(() => { const l = (DB.businesses || []).find((x) => !x.isClient && !(x.activities || []).length); if (l) return l.id; const any = (DB.businesses || []).find((x) => !x.isClient); any.activities = []; return any.id; });
await p.evaluate((id) => openLeadFn(id), leadId); await p.waitForTimeout(1200);
const enCard = await p.evaluate(() => (document.getElementById('view').innerText || '').replace(/\s+/g, ' '));
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(800);
await p.evaluate((id) => { openLeadFn(id); }, leadId); await p.waitForTimeout(1200);
const arCard = await p.evaluate(() => (document.getElementById('view').innerText || '').replace(/\s+/g, ' '));
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); closeLead(); DB.businesses = DB.businesses.filter((x) => x.id !== 'probe-client-x'); });
await b.close(); srv.close?.();
const checks = [
  ['the funnel dropdown exists and lists every lead funnel', !!opts && leadKeys.every((k) => opts.includes(k))],
  ['a source tag that only a CLIENT carries is NOT offered on the leads funnel dropdown', !!opts && !opts.includes('clients_only_import_batch')],
  ['EN lead card without activity still says "No activity yet — click “Log activity”"', /No activity yet — click “Log activity”/.test(enCard)],
  ['AR lead card without activity says it in Arabic, not English', /لا يوجد نشاط بعد — اضغط «تسجيل نشاط»/.test(arCard) && !/No activity yet/.test(arCard)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ opts, leadKeys, leadId, en: (enCard.match(/No activity[^.]*\./) || [])[0], ar: (arCard.match(/(لا يوجد نشاط|No activity)[^.]*\./) || [])[0] })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
