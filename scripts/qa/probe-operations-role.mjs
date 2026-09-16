/* probe-operations-role.mjs — guards the 2026-09-16 (fire #68) js/49 fix found by driving the LIVE app as an
   Operations account against the real database. The guard layer's own table said an Operations person may
   write companies and proposals; the database (biz_write / con_write / app_offers_write policies) says they may
   not. So the screen opened the company editor and moved a lead's stage, the save was refused, and the person
   got "That change was not saved" plus a reload — the exact lie js/49 exists to prevent. Activity logging goes
   through the same company row, so it is refused too; requests stay open. This probe signs in as the QA account
   with role=operations on the mock (MOCK_ROLE), checks what the screen believes (canDo), that every company /
   proposal / activity entry point refuses IN WORDS without opening an editor and without a single write to the
   companies table, that the request editor still opens, and that the badge names what the role really covers,
   in EN and AR. Sabotage-tested: with the js/49 edit stashed, 5 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-operations-role.mjs                                                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
process.env.MOCK_ROLE = 'operations';
process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'editor', leads: 'editor', clients: 'editor', ops: 'editor', finance: 'editor', vendors: 'editor', sopsla: 'editor' });
/* the mock applies MOCK_ROLE once, at import time — a hoisted top-level import would run before the lines above */
const { start } = await import('./mock-supabase.mjs?run=operations');
const PORT = 9052; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
let bizWrites = 0;
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  if (/^\/rest\/v1\/businesses/.test(u.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(rq.method())) bizWrites++;
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
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && window.__userRole === 'operations' && window.__pageAccessLoaded === true && typeof canDo === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(6000);   /* the guards re-apply on a timer after the role lands */
const clear = () => p.evaluate(() => { const ov = document.getElementById('ov'); if (ov) ov.classList.remove('show'); ['v70box', 'v63Notice', 'v70badge'].forEach((id) => { const n = document.getElementById(id); if (n && id !== 'v70badge') n.remove(); }); current = 'leads'; openLead = null; render(); });
const tryFn = async (src) => { await clear(); await p.waitForTimeout(400); return p.evaluate((src) => { const id = ((DB.businesses || []).find((x) => !x.isClient) || {}).id; const before = ((DB.businesses || []).find((x) => x.id === id) || {}).stage; let err = null; try { (new Function('id', 'return (' + src + ')(id)'))(id); } catch (e) { err = String(e.message); } return new Promise((res) => setTimeout(() => { const ov = document.getElementById('ov'); const box = [...document.querySelectorAll('#v70box')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()).join(' | '); res({ err, modalOpen: !!(ov && ov.classList.contains('show')), box, stageChanged: ((DB.businesses || []).find((x) => x.id === id) || {}).stage !== before }); }, 700)); }, src); };
const drive = async () => {
  const can = await p.evaluate(() => ({ leads: canDo('leads'), proposals: canDo('proposals'), activities: canDo('activities'), requests: canDo('requests'), promo: canDo('promo') }));
  const refused = {};
  for (const [name, src] of [['editBusiness', '() => editBusiness()'], ['setLeadStage', '(id) => setLeadStage(id, "Contacted")'], ['logActivity', '(id) => logActivity(id)'], ['convertToClient', '(id) => convertToClient(id)']]) refused[name] = await tryFn(src);
  const request = await tryFn('(id) => newRequestForLead(id)');
  await clear(); await p.waitForTimeout(700);
  const badge = await p.evaluate(() => ((document.getElementById('v70badge') || {}).textContent || '').trim());
  return { can, refused, request, badge };
};
const en = await drive();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(900);
const ar = await drive();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const refusedInWords = (d, ar) => Object.values(d.refused).every((r) => !r.modalOpen && !r.stageChanged && r.box && (ar ? /[؀-ۿ]/.test(r.box) : /can.t change/i.test(r.box)));
const checks = [
  ['the screen knows what the database enforces: canDo leads/proposals/activities = false, requests = true, promo = false', en.can.leads === false && en.can.proposals === false && en.can.activities === false && en.can.requests === true && en.can.promo === false],
  ['EN: New company, stage change, Log activity and Convert all refuse in words — no editor opens, no stage moves', refusedInWords(en, false)],
  ['AR: the same four refuse in Arabic', refusedInWords(ar, true)],
  ['not a single write to the companies table left the browser', bizWrites === 0],
  ['the request editor still opens for an Operations account (EN and AR)', en.request.modalOpen && !en.request.box && ar.request.modalOpen && !ar.request.box],
  ['the badge names what the role really covers (requests, suppliers, SOPs) and no longer promises activity logging', /suppliers and SOPs/.test(en.badge) && !/log activity/.test(en.badge) && /المورّدين والإجراءات/.test(ar.badge)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar, bizWrites })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
