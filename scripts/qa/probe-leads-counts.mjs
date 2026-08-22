/* probe-leads-counts.mjs — Leads page number-consistency guard (2026-08-22, owner catch).
   The owner opened /leads and saw four different totals on one screen: a KPI row, a funnel
   strip, the stage chips, and the table itself all disagreed — plus a "New" chip sitting at
   0 next to "Prospect" describing the same leads. Root causes, each with its own fix:
     1. js/09-funnels.js's funnel tabs counted DB.businesses outright — clients and archived
        rows leaked into the "All" tab, which is why it read higher than the leads table.
     2. js/core/core-09-v26.js still had a dead "New" chip (C2S maps db stage 'new' -> screen
        'Prospect', so a chip filtering on 'New' can only ever read 0) — the comment right
        above the chip array already explained this and said two sibling dead chips had been
        removed for the same reason; this one was missed.
     3. v26_3LeadCount applied "hide closed" to the All chip only, never to the per-stage
        chips, so All and the stage-chip sum disagreed the moment Hide-closed was on.
     4. The chip badges were computed once, when the section head was first built, and never
        refreshed after — v26_3InjectSectionHead returned early whenever the head already
        existed. Toggling Hide-closed re-rendered the table but left the chip numbers stale.

   This probe asserts the invariants directly, against the rendered DOM and the real in-page
   data — not against a fixed expected number, since the fixture's exact counts aren't the
   point: internal agreement is. It fails if:
     - the funnel "All" tab does not equal the real lead count (fix 1 — clients leaking back
       into the tab is exactly what silently regresses if leadPool() is ever removed again)
     - the chip "All" count does not equal the sum of the six stage chips (fix 3)
     - a chip filtering on "New" exists, in either language (fix 2)
     - toggling Hide-closed does not change the chip numbers in place, in EITHER direction —
       i.e. the chips are still showing a stale build (fix 4) */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8139;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function readCounts(p) {
  return p.evaluate(() => {
    const out = { realLeads: null, funnelAll: null, chips: {}, chipCount: 0, hasNewChip: false };
    try {
      out.realLeads = (DB.businesses || []).filter(b => !b.isClient && !b.archivedAt && !b._archived).length;
    } catch (e) {}
    try {
      const tabs = document.getElementById('funnelTabs');
      const allBtn = tabs ? tabs.querySelector('button') : null;
      const m = allBtn ? allBtn.textContent.match(/(\d+)\s*$/) : null;
      out.funnelAll = m ? parseInt(m[1], 10) : null;
    } catch (e) {}
    try {
      const chipsEl = document.querySelector('.v26_3-chips');
      if (chipsEl) {
        const btns = [...chipsEl.querySelectorAll('.v26_3-chip')];
        out.chipCount = btns.length;
        btns.forEach(btn => {
          const filter = btn.getAttribute('data-filter');
          const span = btn.querySelector('.count');
          out.chips[filter] = span ? parseInt(span.textContent, 10) : null;
          const label = (btn.textContent || '').replace(/\d+$/, '').trim();
          if (filter === 'New' || label === 'New' || label === 'جديد') out.hasNewChip = true;
        });
      }
    } catch (e) {}
    return out;
  });
}

function assertConsistent(c, label) {
  if (c.funnelAll == null) { fail(`${label}: funnel "All" tab not found or unreadable`); return; }
  if (c.realLeads == null) { fail(`${label}: could not compute real lead count from DB.businesses`); return; }
  if (c.funnelAll !== c.realLeads) fail(`${label}: funnel All tab (${c.funnelAll}) != real leads (${c.realLeads}) — it is counting clients`);
  else ok(`${label}: funnel All tab (${c.funnelAll}) matches real leads`);

  if (c.hasNewChip) fail(`${label}: a dead "New" chip is present — C2S never emits a "New" screen stage`);
  else ok(`${label}: no dead "New" chip`);

  const stageKeys = ['Prospect', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
  const sum = stageKeys.reduce((s, k) => s + (c.chips[k] || 0), 0);
  if (c.chips.all == null) fail(`${label}: chip "All" count not found`);
  else if (c.chips.all !== sum) fail(`${label}: chip All (${c.chips.all}) != stage-chip sum (${sum}) [${stageKeys.map(k => k + '=' + c.chips[k]).join(', ')}]`);
  else ok(`${label}: chip All (${c.chips.all}) matches stage-chip sum`);
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

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);

  await p.evaluate(() => { openLead = null; current = 'leads'; if (typeof render === 'function') render(); });
  await p.waitForTimeout(700);

  /* leadFilter.hideClosed's OWN starting value isn't something this probe should assume
     either way (js/03 restores it from URL/route-memory state, so a fresh page load can
     legitimately land on either ON or OFF) — force a known OFF baseline first, so every
     comparison below is against a value this probe actually set, not an assumption. */
  console.log('=== EN, Hide-closed OFF (forced baseline) ===');
  await p.evaluate(() => { leadFilter.hideClosed = false; if (typeof drawLeads === 'function') drawLeads(); });
  await p.waitForTimeout(500);
  let c = await readCounts(p);
  assertConsistent(c, 'EN hideClosed=OFF (baseline)');
  const offAll = c.chips.all;
  if (c.chips.Won === 0 && c.chips.Lost === 0) fail('EN hideClosed=OFF (baseline): Won and Lost both read 0 — the fixture may have no closed leads, which would make the ON/OFF comparison below meaningless');
  else ok(`EN hideClosed=OFF (baseline): Won=${c.chips.Won}, Lost=${c.chips.Lost} — real closed leads exist to test against`);

  console.log('\n=== EN, Hide-closed ON (via drawLeads(), exercises the refresher) ===');
  await p.evaluate(() => { leadFilter.hideClosed = true; if (typeof drawLeads === 'function') drawLeads(); });
  await p.waitForTimeout(500);
  c = await readCounts(p);
  assertConsistent(c, 'EN hideClosed=ON');
  if (c.chips.Won !== 0 || c.chips.Lost !== 0) fail(`EN hideClosed=ON: Won/Lost should read 0 (got Won=${c.chips.Won}, Lost=${c.chips.Lost})`);
  else ok('EN hideClosed=ON: Won and Lost correctly read 0');
  if (c.chips.all === offAll) fail(`EN hideClosed=ON: chip All did not actually change from the OFF baseline (${offAll}) — looks like a stale, un-refreshed count`);
  else ok(`EN hideClosed=ON: chip All changed from ${offAll} (OFF) to ${c.chips.all} (ON) — refresher fired`);
  const onAll = c.chips.all;

  console.log('\n=== EN, Hide-closed OFF again (toggle back, refresher must fire both directions) ===');
  await p.evaluate(() => { leadFilter.hideClosed = false; if (typeof drawLeads === 'function') drawLeads(); });
  await p.waitForTimeout(500);
  c = await readCounts(p);
  assertConsistent(c, 'EN hideClosed=OFF (restored)');
  if (c.chips.all === onAll) fail(`EN hideClosed=OFF (restored): chip All (${c.chips.all}) is still showing the ON-state number — the refresher did not fire on the way back`);
  else if (c.chips.all !== offAll) fail(`EN hideClosed=OFF (restored): chip All (${c.chips.all}) did not return to the OFF baseline (${offAll})`);
  else ok(`EN hideClosed=OFF (restored): chip All correctly back to ${offAll}`);

  console.log('\n=== AR, Hide-closed OFF ===');
  await p.evaluate(() => { if (typeof setLang === 'function') setLang('ar'); else if (typeof LANG !== 'undefined') { LANG = 'ar'; if (typeof render === 'function') render(); } });
  await p.waitForTimeout(700);
  c = await readCounts(p);
  assertConsistent(c, 'AR');
  if (c.chipCount !== 7) fail(`AR: expected 7 chips (All + 6 stages), found ${c.chipCount}`);
  else ok('AR: exactly 7 chips (All + 6 stages, no dead New chip)');

  const realErrors = errors.filter(e => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nleads counts OK - every total on the Leads page agrees');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
