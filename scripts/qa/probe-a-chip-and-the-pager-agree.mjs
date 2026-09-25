/* probe-a-chip-and-the-pager-agree.mjs — a chip that filters rows already on the page, and the pager
   under the table, describe the same list.

   Fire #264. Driven on the live Clients page against the real 28 clients: press "At risk" and 6 rows
   show and the box above says 6 — but the pager under the table still read "Showing 1–20 of 28" with
   Next enabled; press Next and EIGHT rows of every health appeared (five New, two At risk, one Watch)
   while the chip still glowed "At risk" and the box still said 6; press Prev and all twenty came
   back. Press "All" and all 28 rows showed at once while the pager still read "Showing 1–20 of 28".
   Two pieces of code were hiding and showing the same rows by style: the chip by health, the pager
   (js/04) by row index, and whichever ran last won.

   Now core-09 keeps or drops the rows from the body (v26_3KeepRows — the original nodes, never
   hidden by style), the way the record chips of fire #105 already did, so the pager's own observer
   recounts and re-pages from page one. The same helper serves the generic chip path (Offers).

   The probe plants 25 synthetic clients (12 at risk by an overdue review, 13 new) and sets the page
   size to 10, so the filtered list itself needs two pages — the strongest shape: the pager must
   page WITHIN the filter.

   What this holds:
     1. "At risk": the body holds exactly the 12 at-risk rows, the box above says 12, and the pager
        reads "Showing 1–10 of 12" with Next enabled;
     2. Next while filtered: the second page shows only at-risk rows and the pager reads
        "Showing 11–12 of 12" — the filter survives paging;
     3. "All": the body holds all 25 planted rows again, the box says 25, the pager reads
        "Showing 1–10 of 25", and a row still opens its client when clicked (the nodes were kept,
        not copied);
     4. AR: the same three readings in Arabic (chip «في خطر», pager «عرض 1–10 من 12»);
     5. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): the tree before
   this fire (chip hides by style) — fails 1, 2, 3 and 4; 5 stays green.
   Run: node scripts/qa/probe-a-chip-and-the-pager-agree.mjs                                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9315 — one mock. */
const PORT = 9315; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); localStorage.setItem('db_pageSize', '10'); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method(); const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(3500);

  /* plant: every seeded client set aside; 25 synthetic clients — 12 with an overdue review (At risk),
     13 with no activity (New) */
  await p.evaluate(() => {
    window.__qaKeep = DB.businesses;
    const src = (DB.businesses || []).find((x) => x && x.isClient) || (DB.businesses || [])[0];
    const base = JSON.parse(JSON.stringify(src));
    const rows = [];
    for (let i = 0; i < 25; i++) {
      const risk = i < 12;
      rows.push(Object.assign({}, base, { id: 'qa-pg-' + i, name: 'QA Pager Client ' + String(i).padStart(2, '0'), isClient: true, stage: 'won',
        tier: i % 5 === 0 ? 'Key' : 'Standard', activities: [], lastContact: 0, nextReview: risk ? '2020-01-01' : '', archivedAt: null }));
    }
    DB.businesses = (DB.businesses || []).filter((x) => x && !x.isClient).concat(rows);
    try { clFilter.q = ''; clFilter.owner = 'all'; clFilter.tier = 'all'; } catch (_) {}
    current = 'clients'; openLead = null; render();
  });
  await p.waitForTimeout(2500);

  const read = () => p.evaluate(() => {
    const rows = [...document.querySelectorAll('#view tbody tr[data-client-row]')].filter((tr) => /QA Pager Client/.test(tr.textContent || ''));
    const vis = rows.filter((tr) => tr.offsetParent !== null);
    const bar = document.querySelector('#view .pg-bar');
    const hs = (a) => a.reduce((o, tr) => { const h = tr.getAttribute('data-health'); o[h] = (o[h] || 0) + 1; return o; }, {});
    return { inBody: rows.length, visible: vis.length, bodyHealth: hs(rows), visibleHealth: hs(vis),
      box: ((document.getElementById('cl_kv_count') || {}).textContent || '').trim(),
      pager: bar ? (bar.querySelector('span').textContent || '').replace(/\s+/g, ' ').trim() : null,
      next: bar ? !bar.querySelector('.pg-next').disabled : null,
      chip: [...document.querySelectorAll('#view .v26_3-chip')].filter((c) => c.classList.contains('active')).map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())[0] || null };
  });
  const chip = (f) => p.evaluate((f) => { const c = [...document.querySelectorAll('#view .v26_3-chip')].find((x) => x.getAttribute('data-filter') === f); if (c) c.click(); return !!c; }, f);
  const out = {};
  out.fresh = await read();
  await chip('AtRisk'); await p.waitForTimeout(1200); out.risk = await read();
  await p.evaluate(() => { const n = document.querySelector('#view .pg-next'); if (n) n.click(); }); await p.waitForTimeout(800); out.riskNext = await read();
  await chip('all'); await p.waitForTimeout(1200); out.all = await read();
  /* the rows were kept, not copied: a click on one still opens its client */
  await p.evaluate(() => { const tr = [...document.querySelectorAll('#view tbody tr[data-client-row]')].find((t) => /QA Pager Client 00/.test(t.textContent || '')); if (tr) tr.click(); });
  await p.waitForTimeout(1500);
  out.opened = await p.evaluate(() => ({ openLead: typeof openLead === 'undefined' ? null : openLead, card: /QA Pager Client 00/.test((document.getElementById('view') || {}).innerText || '') }));
  await p.evaluate(() => { try { DB.businesses = window.__qaKeep; openLead = null; current = 'clients'; render(); } catch (_) {} });
  await ctx.close();
  return { out, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  25 synthetic clients planted (12 at risk), page size 10, in each language');

const E = en.out, A = ar.out;
(E.risk.inBody === 12 && E.risk.bodyHealth['At risk'] === 12 && E.risk.box === '12' && E.risk.pager === 'Showing 1–10 of 12' && E.risk.next === true && E.risk.visible === 10)
  ? pass('"At risk": the body holds the 12 at-risk rows, the box says 12, the pager reads "Showing 1–10 of 12" with Next enabled')
  : fail('"At risk": the body holds the 12 at-risk rows, the box says 12, the pager reads "Showing 1–10 of 12" with Next enabled', JSON.stringify(E.risk));

(E.riskNext.visible === 2 && E.riskNext.visibleHealth['At risk'] === 2 && Object.keys(E.riskNext.visibleHealth).length === 1 && E.riskNext.pager === 'Showing 11–12 of 12' && /At risk/.test(E.riskNext.chip || ''))
  ? pass('Next while filtered: the second page shows only at-risk rows and the pager reads "Showing 11–12 of 12"')
  : fail('Next while filtered: the second page shows only at-risk rows and the pager reads "Showing 11–12 of 12"', JSON.stringify(E.riskNext));

(E.all.inBody === 25 && E.all.visible === 10 && E.all.box === '25' && E.all.pager === 'Showing 1–10 of 25' && E.opened.openLead === 'qa-pg-0' && E.opened.card)
  ? pass('"All": all 25 rows are back, the box says 25, the pager reads "Showing 1–10 of 25", and a row still opens its client')
  : fail('"All": all 25 rows are back, the box says 25, the pager reads "Showing 1–10 of 25", and a row still opens its client', JSON.stringify({ all: E.all, opened: E.opened }));

(A.risk.inBody === 12 && A.risk.box === '12' && A.risk.pager === 'عرض 1–10 من 12' && /في خطر/.test(A.risk.chip || '')
  && A.riskNext.visible === 2 && Object.keys(A.riskNext.visibleHealth).length === 1 && A.riskNext.pager === 'عرض 11–12 من 12'
  && A.all.inBody === 25 && A.all.pager === 'عرض 1–10 من 25')
  ? pass('AR: the same three readings in Arabic')
  : fail('AR: the same three readings in Arabic', JSON.stringify({ risk: A.risk, riskNext: A.riskNext, all: A.all }));

const errs = en.errors.concat(ar.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
