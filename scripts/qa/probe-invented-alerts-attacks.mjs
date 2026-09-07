/* probe-invented-alerts-attacks.mjs (2026-09-07, round 65) — Today must not raise alarms about
   things that never happened.

   migrateV20() used to invent the whole integration panel. Every source got a status from a
   hard-coded expression — kiwi "down", ZATCA "token expired", the rest "connected" — a lastSync of
   `Date.now() - random(30 minutes)`, and errorsToday of 7 and 2. A separate `_v20seed` block then
   fabricated twelve sync events with random timestamps and a one-in-seven chance of being marked
   failed, plus a conflict reading "Total differs by 30 SAR (FX adjustment)" and a kiwi webhook
   timeout. None of it was measured; nothing in this app polls anything.

   It was still running against the real database. Checked live before any of it was removed:
   app_state held 12 integration objects and 14 sync events, 2 marked failed and 1 a conflict, and
   the Today page — the first screen every employee opens — was showing "🔴 2 failed syncs" and
   "🔌 2 integrations need attention". One of the two was ZATCA, the Saudi tax authority, reading
   "token expired". Somebody could lose a morning to a compliance problem that had never happened.

   Under test:
     1. A source the app does not talk to reads "not connected", with no invented last-sync time
        and no invented error count. Only `internal` — this app itself — is connected.
     2. Nothing is counted as an integration needing attention when nothing is down.
     3. The failed-sync count on Today equals the number of failed events actually in the data.
        The harness seeds exactly one, so this is a real number being reported, not a zero.
     4. THE CONTROL: remove that one failed event and the pill must disappear. Without this, check
        3 would also pass on a Today page whose alert strip had simply stopped rendering.
     5. A record that has never synced keeps no sync time and no "synced" claim — migrateV20 used
        to backfill both, and fmtRel() then printed the invented time as fact while
        v20StaleRecords() compared a random number against the stale threshold.
     6. A ticket gets no invented fraud score.

   Run:  node scripts/qa/probe-invented-alerts-attacks.mjs        (port 9026)
   Sabotage (file-level): put back any one of the invented defaults in js/core/core-06's
   migrateV20 — the integration status expression (checks 1, 2), the lastSyncedAt backfill
   (check 5), or the fraudScore (check 6). Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9026;
const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const srv = start(PORT);

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p.on('dialog', (d) => d.dismiss().catch(() => { }));
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6000);
  await p.evaluate(() => { try { current = 'today'; render(); } catch (_) { } });
  await p.waitForTimeout(1500);

  /* 1 + 2 — the integration panel. Asked of migrateV20 DIRECTLY rather than of the live DB: the
     harness's app_state carries `integrations:{}` and is loaded over the migrated object, so
     reading the page's DB measures the fixture, not the code. The first version of this check did
     exactly that and reported "no integration entries at all" — true, and about nothing. */
  const ints = await p.evaluate(() => {
    const d = { invoices: [], bookings: [], vendors: [], integrations: {}, syncEvents: [] };
    try { migrateV20(d); } catch (e) { return [{ k: 'THREW', status: String(e) }]; }
    return Object.keys(d.integrations).map((k) => ({ k: k, status: d.integrations[k].status, lastSync: d.integrations[k].lastSync, errors: d.integrations[k].errorsToday, records: d.integrations[k].recordsToday }));
  });
  const invented = ints.filter((i) => i.k !== 'internal' && (i.status === 'connected' || i.status === 'down' || i.status === 'token expired' || i.lastSync || i.errors > 0 || i.records > 0));
  if (!ints.length) fail('there are no integration entries at all, so checks 1 and 2 measured nothing');
  else if (!invented.length) ok(`all ${ints.length} sources read honestly — every one this app does not talk to says "not connected", with no last-sync time and no error count`);
  else fail(`invented integration state is back: ${JSON.stringify(invented.slice(0, 4))}. Nothing in this app polls these systems, so a status, a last-sync time or an error count here is fiction on the busiest screen in the app.`);

  const needAttention = ints.filter((i) => i.status === 'down' || i.status === 'token expired');
  if (!needAttention.length) ok('nothing is reported as an integration needing attention');
  else fail(`${needAttention.length} integration(s) are marked as needing attention with nothing behind them: ${JSON.stringify(needAttention.map((i) => i.k + '=' + i.status))}. ZATCA showing "token expired" sends someone chasing a tax-compliance problem that has not happened.`);

  /* 3 — the failed-sync pill must equal the real number of failed events */
  const strip = () => p.evaluate(() => {
    const el = document.querySelector('.v20-alert-strip');
    const real = ((window.DB || DB).syncEvents || []).filter((e) => e && e.result === 'failed').length;
    const txt = el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    const m = /(\d+)\s*failed sync/i.exec(txt);
    return { txt: txt, shown: m ? Number(m[1]) : 0, real: real, present: !!el };
  });
  const s1 = await strip();
  if (s1.real > 0 && s1.shown === s1.real) ok(`Today reports ${s1.shown} failed sync(s), and the data really contains ${s1.real} — a real number, not an invented one`);
  else if (s1.real === 0) fail('the fixture has no failed sync event, so check 3 could not tell a correct count from a broken strip — the seed changed and this probe needs one back');
  else fail(`Today reports ${s1.shown} failed sync(s) but the data contains ${s1.real} ("${s1.txt}")`);

  /* 4 — the control: take the failure away and the pill must go */
  await p.evaluate(() => {
    (window.DB || DB).syncEvents = ((window.DB || DB).syncEvents || []).filter((e) => !e || e.result !== 'failed');
    try { const v = document.getElementById('view'); const st = v && v.querySelector('.v20-alert-strip'); if (st) st.remove(); } catch (_) { }
    try { render(); } catch (_) { }
  });
  await p.waitForTimeout(1500);
  const s2 = await strip();
  if (s2.shown === 0) ok('with the failed event removed the pill disappears — so the count above was being computed, not printed blindly');
  else fail(`the failed-sync pill still says ${s2.shown} after every failed event was removed ("${s2.txt}") — it is not reading the data, and check 3 proved nothing`);

  /* 5 + 6 — the backfills, driven through migrateV20 itself on a record it has never seen */
  const back = await p.evaluate(() => {
    const d = {
      invoices: [{ id: 'probe_i', number: 'PROBE-1' }],
      bookings: [{ id: 'probe_b', ref: 'PROBE-B', provider: 'Amadeus', tickets: [{ pnr: 'X', route: 'RUH-JED' }] }],
      vendors: [{ name: 'Probe vendor' }],
      integrations: {}, syncEvents: [],
    };
    try { migrateV20(d); } catch (e) { return { err: String(e) }; }
    return {
      inv: { lastSyncedAt: d.invoices[0].lastSyncedAt || null, syncHealth: d.invoices[0].syncHealth || null, log: (d.invoices[0].syncLog || []).length },
      bk: { lastSyncedAt: d.bookings[0].lastSyncedAt || null, syncHealth: d.bookings[0].syncHealth || null, log: (d.bookings[0].syncLog || []).length },
      ven: { lastSyncedAt: d.vendors[0].lastSyncedAt || null },
      events: (d.syncEvents || []).length,
    };
  });
  if (back.err) fail(`migrateV20 threw on a plain record: ${back.err}`);
  else {
    const invented2 = [];
    if (back.inv.lastSyncedAt) invented2.push('invoice lastSyncedAt=' + back.inv.lastSyncedAt);
    if (back.bk.lastSyncedAt) invented2.push('booking lastSyncedAt=' + back.bk.lastSyncedAt);
    if (back.ven.lastSyncedAt) invented2.push('vendor lastSyncedAt=' + back.ven.lastSyncedAt);
    if (back.inv.syncHealth === 'synced') invented2.push('invoice claims syncHealth "synced"');
    if (back.bk.syncHealth === 'synced') invented2.push('booking claims syncHealth "synced"');
    if (back.inv.log || back.bk.log) invented2.push('a sync log entry was written for a sync that never happened');
    if (!invented2.length) ok('a record that has never synced comes back with no sync time, no "synced" claim and no log line');
    else fail(`the invented backfills are back: ${invented2.join('; ')}. fmtRel() prints that time as fact, and v20StaleRecords() decides whether to raise a stale-record alarm by comparing it against a threshold — so a random number becomes an alarm.`);

    if (back.events === 0) ok('migrateV20 no longer fabricates sync events');
    else fail(`migrateV20 wrote ${back.events} sync event(s) into a database that had none — the _v20seed block is back, and with it the "Total differs by 30 SAR (FX)" conflict and the kiwi webhook timeout`);
  }

  const fraud = await p.evaluate(() => {
    const d = { bookings: [{ id: 'pb', tickets: [{ pnr: 'X', route: 'RUH-JED' }] }], invoices: [], vendors: [], integrations: {}, syncEvents: [] };
    try { migrateV18(d); } catch (_) { try { migrateV20(d); } catch (_) { } }
    return d.bookings[0].tickets[0].fraudScore;
  });
  if (!fraud) ok('no invented fraud score on a ticket (' + JSON.stringify(fraud) + ')');
  else fail(`a ticket was given fraudScore=${fraud} by the migration. Nothing in this app scores fraud, and the tickets table renders a red "Fraud risk N" badge from that number.`);

  await b.close();
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
