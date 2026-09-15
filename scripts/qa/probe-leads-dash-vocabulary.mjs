/* probe-leads-dash-vocabulary.mjs — guards the 2026-09-15 (fire #54) fix to the Leads "Dashboard" view
   (core-02 drawLeadsDash), found live by eye against the 80 real leads:
     · the "Leads by stage" bars listed "Negotiation" — a stage the locked database list cannot hold and the
       chips never show — and "Client" (Won relabelled), always 0 for leads because a won lead is a client;
     · with Hide-closed on (the default) the chips read "Lost 2" while the board's Lost tile read "Lost 0".
   Seeds three lost leads and one client-with-stage-Lost into the mock, opens the Dashboard view with the
   default filters, and asserts: Lost tile == 3 (the client never counted); the bar labels are exactly the
   chips' vocabulary (Prospect, Contacted, Qualified, Proposal, Lost) with no Negotiation/Client/Won; the
   Lost bar reads 3; and with the Lost chip on, Total leads == Lost (the 2026-09-09 L1 rule still holds).
   Sabotage-tested: with the core-02 edit reverted, 3 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-leads-dash-vocabulary.mjs                                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9041; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
await p.waitForFunction(() => typeof render === 'function' && typeof drawLeadsDash === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2500);
const read = () => p.evaluate(() => {
  const board = document.getElementById('board'); if (!board) return null;
  const tiles = [...board.querySelectorAll('.leads-dash-tiles .chip')].map((c) => ({ v: (c.querySelector('.v') || {}).innerText, l: (c.querySelector('.l') || {}).innerText }));
  const card = [...board.querySelectorAll('.card')].find((c) => /Leads by stage|حسب المرحلة/.test(c.innerText));
  const bars = card ? [...card.querySelectorAll('div[style*="margin:9px 0"] > div:first-child')].map((d) => ({ s: (d.children[0] || {}).innerText, n: (d.children[1] || {}).innerText })) : [];
  return { tiles, bars, hideClosed: leadFilter.hideClosed, stage: leadFilter.stage };
});
const seeded = await p.evaluate(() => {
  const mk = (id, name, isClient) => ({ id, name, stage: 'Lost', status: 'Lost', isClient, contacts: [], activities: [], funnelName: 'Probe funnel' });
  DB.businesses.push(mk('probe-lv-l1', 'Probe Lost One', false), mk('probe-lv-l2', 'Probe Lost Two', false), mk('probe-lv-l3', 'Probe Lost Three', false), mk('probe-lv-c1', 'Probe Client Lost Stage', true));
  leadFilter.stage = 'all'; leadFilter.hideClosed = true; leadFilter.cat = 'all'; leadFilter.q = ''; leadView = 'dash'; openLead = ''; current = 'leads'; render();
  return { lostLeads: DB.businesses.filter((x) => !x.isClient && x.stage === 'Lost').length };
});
await p.waitForTimeout(1500);
const dflt = await read();
await p.evaluate(() => { leadFilter.stage = 'Lost'; render(); }); await p.waitForTimeout(1200);
const lostChip = await read();
/* Arabic page: the bars must speak Arabic (stage words + the "leads" unit), like the tiles above them */
await p.evaluate(() => { leadFilter.stage = 'all'; if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(1500);
await p.evaluate(() => { leadView = 'dash'; current = 'leads'; render(); }); await p.waitForTimeout(1200);
const arView = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const tileByLabel = (r, re) => (r && r.tiles.find((t) => re.test(t.l || '')) || {}).v;
const labels = dflt ? dflt.bars.map((x) => x.s) : [];
const checks = [
  ['dashboard renders with 4 tiles and stage bars', !!dflt && dflt.tiles.length === 4 && dflt.bars.length >= 4],
  ['default view (Hide-closed on): the Lost tile counts the lost leads, not 0', tileByLabel(dflt, /^Lost$|خاسر|مفقود/) === String(seeded.lostLeads)],
  ['bars speak the chips\' vocabulary — no "Negotiation", no "Client", no "Won"', labels.length > 0 && !labels.some((s) => /Negotiation|Client|^Won$|تفاوض/.test(s || ''))],
  ['bars include Prospect, Contacted, Qualified, Proposal and Lost', ['Prospect', 'Contacted', 'Qualified', 'Proposal', 'Lost'].every((s) => labels.includes(s))],
  ['default view: the Lost bar reads the lost-lead count', !!(dflt && dflt.bars.find((x) => x.s === 'Lost' && new RegExp('^' + seeded.lostLeads + ' ').test(x.n || ''))) ],
  ['Lost chip on: Total leads == Lost, and the client with stage Lost is not counted (L1 rule)', !!lostChip && tileByLabel(lostChip, /^Total leads/) === tileByLabel(lostChip, /^Lost$/) && tileByLabel(lostChip, /^Lost$/) === String(seeded.lostLeads)],
  ['AR page: every stage bar is labelled in Arabic with an Arabic "leads" unit (no English left)', !!arView && arView.bars.length >= 5 && arView.bars.every((x) => /[؀-ۿ]/.test(x.s || '') && /[؀-ۿ]/.test(x.n || '') && !/lead/.test(x.n || ''))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ seeded, dflt, lostChip, arView })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
