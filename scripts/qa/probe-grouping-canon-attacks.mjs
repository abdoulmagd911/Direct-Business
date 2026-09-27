/* probe-grouping-canon-attacks.mjs (2026-09-06, watch cycle 34) - the alias grouping map at scale
   and under hostile names, and the client-rollup cache every client total reads through.

   Cycle 8 proved the Arabic name folding and the merge/undo pair. Cycle 33 proved js/62's guards.
   What has never been driven is the grouping MAP itself under load and under names built to make
   it answer ambiguously - and a wrong answer here is the highest-consequence quiet failure left in
   this lane: it puts one client's money under another client's name, on every screen at once, with
   nothing on the page saying a choice was made.

   How the map answers, read from js/62: finGroupCheck(name) walks the whole list in order,
   skipping inactive groups, and returns the FIRST group any of whose aliases normalises to the
   same string. Two consequences follow from "first", and both are measured here rather than
   assumed: a name listed by two active groups resolves by list ORDER, and a group's own
   canonicalName is not itself an alias unless it is listed as one.

   finCanon (js/16) then caches that answer per raw client_group, and every client total on every
   tab reads through it. A cache that outlives what it was computed from is the classic way for a
   correct rule to produce a wrong number.

   Under test:
     1. At scale - 300 groups, 900 aliases, invoices across all of them - every client total equals
        an independent recount computed here from the fixture.
     2. A name listed by TWO active groups: which one wins, and does anything say a choice was made.
     3. An INACTIVE group listed first must never win over an active one listed later.
     4. A group's canonicalName that is not among its own aliases: measured, since "first match on
        aliases" says it should not match, and a reader may expect otherwise.
     5. finCanon is stable - the same raw name resolves identically twice - and clearFinCanon really
        empties it: change a group's canonical name, clear, and the new answer must appear.
     6. The cache does not survive a language switch with a stale language in it.

   E (2026-09-27, DECISIONS D16): the alias grouping map (js/62 financeGroupMap / finGroupCheck) is retired. Grouping is
   now a TYPED customer name held by one company (company_name_aliases), applied by the database view money_rows, and
   finCanon groups through FIN.linkByGroup, which js/16 derives from that view. The purpose — at scale and under
   hostile names, a client's money never lands under another client's name — is unchanged; the checks now say:
     1. at scale (1,103 typed names across 54 companies, 308 invoices, 55 buckets) every invoice lands in exactly
        one client bucket, the buckets equal an independent recount from the fixture (companies, not names), and the
        Revenue tile equals the total;
     2. a name cannot be claimed by two companies: the second claim is refused by the database (unique index
        company_name_aliases_one_company, however spelled) and nothing is added — the old "first in the list wins" is
        impossible now;
     3. a REMOVED name never captures money: a name removed from one company and typed into another goes to the other;
     4. a row named exactly like a company but never typed is NOT merged (D16: nothing merges by name) — asserted now,
        it used to be only measured;
     5. finCanon is stable, and clearFinCanon really clears: rename the company, clear, the new name shows;
     6. a language switch never re-buckets anyone's money.
   Sabotage (reasoned): make js/16 derive linkByGroup by client_group name instead of money_rows.business_id → 4 red;
   make clearFinCanon a no-op → 5 red.

   Run:  node scripts/qa/probe-grouping-canon-attacks.mjs        (port 8711)
   Sabotage (file-level): make finGroupCheck ignore the active flag; make clearFinCanon a no-op.
   Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8711;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const r2 = (v) => Math.round(v * 100) / 100;

/* typed customer names (company_name_aliases): name group i → company b(i % 50), three spellings each */
const NAMES_TYPED = []; let nid = 0;
const typeName = (name, biz, removed) => NAMES_TYPED.push({ id: 'na-gc-' + (nid++), business_id: biz, name, created_by: null, created_by_name: 'probe seed', created_at: '2026-08-10T00:00:00Z', removed_by: null, removed_by_name: removed ? 'probe seed' : null, removed_at: removed ? '2026-08-11T00:00:00Z' : null });
for (let i = 0; i < 300; i++) ['A', 'B', 'C'].forEach((x) => typeName('Alias ' + i + ' ' + x, 'b' + (i % 50)));
for (let i = 0; i < 200; i++) typeName('Big Alias ' + i, 'b50');
const INACTIVE_ALIAS = 'Contested By Removed';
typeName(INACTIVE_ALIAS, 'b51', true);   // removed from b51 …
typeName(INACTIVE_ALIAS, 'b52');         // … and typed into b52
const AMBIG = 'Shared Alias Name';
typeName(AMBIG, 'b53');
const UNTYPED_CO = 'Test Company 54';    // the exact name of company b54 — never typed as a customer name

/* client_group values the invoices carry, and the company each must land in (null = stands alone) */
const ROWS = [];
for (let i = 0; i < 300; i++) ROWS.push(['Alias ' + i + ' ' + 'ABC'[i % 3], 'b' + (i % 50)]);
ROWS.push([AMBIG, 'b53'], [INACTIVE_ALIAS, 'b52'], [UNTYPED_CO, null], ['Big Alias 7', 'b50'], ['Never Grouped Co', null]);
ROWS.push(['Alias 0 B', 'b0'], ['Alias 0 C', 'b0'], ['Big Alias 8', 'b50']);
const SEED = [];
ROWS.forEach(([nm], i) => {
  const mo = (i % 12) + 1;
  SEED.push({
    id: 'gc' + i, invoice_no: 'GC-' + i, line_no: 1, zatca_dpin: null,
    client_group: nm, customer_raw_name: nm,
    invoice_date: '2026-' + String(mo).padStart(2, '0') + '-12', year: 2026,
    month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: 1000 + i, wallet_portion_sar: 0, revenue_sar: 1000 + i,
    cost_sar: 600, profit_sar: 400 + i, vat_sar: 0,
    amount_received_sar: 1000 + i, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'gc-qa',
    revenue_way: 'invoice', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  });
});
const N_SEED = SEED.length;
const TOTAL_REV = r2(SEED.reduce((a, r) => a + r.revenue_sar, 0));
/* the independent recount: one bucket per company, one per untyped name */
const WANT = {}; ROWS.forEach(([nm, biz], i) => { const k = biz ? 'biz:' + biz : 'raw:' + nm; WANT[k] = r2((WANT[k] || 0) + SEED[i].revenue_sar); });
const WANT_BUCKETS = Object.keys(WANT).length;

const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_client_links: [], client_profiles: [], company_name_aliases: NAMES_TYPED });
const BASE = 'http://localhost:' + PORT;

async function main() {
  console.log(`fixture: ${NAMES_TYPED.length} typed names across ${new Set(NAMES_TYPED.map((n) => n.business_id)).size} companies, ${N_SEED} invoices worth ${TOTAL_REV.toLocaleString()} SAR, ${WANT_BUCKETS} buckets expected`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), r => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && (DB.businesses || []).length > 0 && window.FIN && typeof finLoad === 'function', null, { timeout: 90000 }).catch(() => {});
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  await p.waitForFunction(() => window.FIN && FIN.rows && FIN.rows.length && FIN.m && !FIN.loading, null, { timeout: 60000 }).catch(() => {});
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  await p.waitForTimeout(1500);
  const canonOf = (nm) => p.evaluate((n) => { try { return window.finCanon(n); } catch (e) { return { err: String(e && e.message || e) }; } }, nm);

  /* ---------- 1. at scale, every client total reconciles ---------- */
  const t0 = Date.now();
  const rollup = await p.evaluate(() => {
    const rows = (window.finLive ? finLive() : []).filter(window.finInPeriod);
    const by = {};
    rows.forEach(r => { const c = window.finCanon(r.client_group); by[c.key] = Math.round(((by[c.key] || 0) + (+r.revenue_sar || 0)) * 100) / 100; });
    return by;
  });
  const ms = Date.now() - t0;
  const gotTotal = r2(Object.values(rollup).reduce((a, v) => a + v, 0));
  if (Math.abs(gotTotal - TOTAL_REV) < 0.02) ok(`every one of the ${N_SEED} invoices lands in exactly one client bucket and they sum to ${TOTAL_REV.toLocaleString()} — nothing lost or double-counted (${ms}ms)`);
  else fail(`the client rollup sums to ${gotTotal}, an independent recount of the fixture gives ${TOTAL_REV}`);
  const wrong = Object.keys(WANT).filter((k) => Math.abs((rollup[k] || 0) - WANT[k]) > 0.01).concat(Object.keys(rollup).filter((k) => !(k in WANT)));
  if (Object.keys(rollup).length === WANT_BUCKETS && !wrong.length) ok(`${N_SEED} invoices fold into exactly the ${WANT_BUCKETS} buckets the typed names say — every company's total equals the recount, bucket by bucket`);
  else fail(`the rollup produced ${Object.keys(rollup).length} buckets, ${WANT_BUCKETS} expected; ${wrong.length} disagree with the recount, e.g. ${JSON.stringify(wrong.slice(0, 4).map((k) => [k, rollup[k], WANT[k]]))}${Object.keys(rollup).length === new Set(ROWS.map((r) => r[0])).size ? ' — one bucket per name, so the typed names are not being applied at all' : ''}`);
  const gk = await canonOf('Alias 5 C');
  if (gk && gk.key === 'biz:b5' && gk.linked === true) ok(`finCanon resolves a typed name to its company through the view (key ${gk.key}, name "${gk.name}")`);
  else fail(`finCanon resolved "Alias 5 C" to ${JSON.stringify(gk)}, expected key biz:b5`);
  const revTile = await p.evaluate(() => {
    const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === 'Revenue');
    const v = el && el.children[1]; const t = v && v.getAttribute('title');
    return t ? +t.replace(/[^\d.-]/g, '') : null;
  });
  if (revTile != null && Math.abs(revTile - TOTAL_REV) < 0.02) ok('the Revenue tile agrees with the same recount — merging moves money between buckets, never into or out of the total');
  else fail(`the Revenue tile reads ${revTile}, the recount gives ${TOTAL_REV}`);

  /* ---------- 3. a removed name never captures money ---------- */
  const inact = await canonOf(INACTIVE_ALIAS);
  if (inact && inact.key === 'biz:b52') ok(`"${INACTIVE_ALIAS}" was removed from one company and typed into another — its money is under the live one (b52) only`);
  else fail(`"${INACTIVE_ALIAS}" resolved to ${JSON.stringify(inact)}; the name was removed from b51 and typed into b52`);

  /* ---------- 2. one name, one company: a second claim is refused ---------- */
  const second = await p.evaluate(async (n) => { const r = await fc().from('company_name_aliases').insert({ business_id: 'b12', name: '  shared-ALIAS name ' }).select('id');
    return { err: r.error ? (r.error.code || '') + ' ' + r.error.message : null, rows: (r.data || []).length }; }, AMBIG);
  const live = (await (await fetch(BASE + '/rest/v1/company_name_aliases?removed_at=is.null&business_id=in.(b53,b12)')).json()).filter((a) => !a.removed_at && a.name.toLowerCase().replace(/[^a-z]/g, '') === 'sharedaliasname');
  const amb = await canonOf(AMBIG);
  if (second.err && /company_name_aliases_one_company|23505/.test(second.err) && second.rows === 0 && live.length === 1 && amb && amb.key === 'biz:b53')
    ok(`a second company cannot claim "${AMBIG}" in another spelling — the database refuses it (one company per name), nothing is added, and the money stays with b53`);
  else fail(`two companies could hold one name: ${JSON.stringify({ second, live: live.length, amb })}`);

  /* ---------- 4. a company's own name, never typed, merges nothing ---------- */
  const untyped = await canonOf(UNTYPED_CO);
  if (untyped && untyped.key === 'raw:' + UNTYPED_CO && !untyped.linked) ok(`a row named exactly like company b54 ("${UNTYPED_CO}") but never typed stands alone — nothing merges by name (D16)`);
  else fail(`"${UNTYPED_CO}" was merged without anyone typing it: ${JSON.stringify(untyped)}`);

  /* ---------- 5. finCanon is stable, and clearFinCanon really clears ---------- */
  const a1 = await canonOf('Alias 5 C'), a2 = await canonOf('Alias 5 C');
  if (JSON.stringify(a1) === JSON.stringify(a2)) ok(`finCanon is stable — the same raw name resolves identically twice (${a1 && a1.name})`);
  else fail(`finCanon gave two different answers for one name: ${JSON.stringify(a1)} vs ${JSON.stringify(a2)}`);
  const renamed = await p.evaluate(() => {
    const bz = (DB.businesses || []).find((x) => (window.__bizUuid ? __bizUuid(x.id) : x.id) === 'b5' || x.id === 'b5');
    if (!bz) return { err: 'b5 missing' };
    const old = bz.name; bz.name = 'Renamed Co 5';
    const before = window.finCanon('Alias 5 C').name;      /* still cached */
    if (typeof clearFinCanon === 'function') clearFinCanon();
    const after = window.finCanon('Alias 5 C').name;        /* must see the new name */
    bz.name = old; if (typeof clearFinCanon === 'function') clearFinCanon();
    return { old, before, after };
  });
  if (renamed.before === renamed.old && renamed.after === 'Renamed Co 5')
    ok('clearFinCanon really empties the cache — a renamed company keeps the old name until it is cleared, and the new name immediately after');
  else if (renamed.before === renamed.after && renamed.after === 'Renamed Co 5')
    note(`the cache was not holding the old name to begin with (both reads gave "${renamed.after}") — clearFinCanon cannot be shown to do anything by this route`);
  else fail(`clearFinCanon did not take effect: ${JSON.stringify(renamed)}`);

  /* ---------- 6. a cached answer must not survive a language switch ---------- */
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); });
  const enName = await canonOf('Never Grouped Co'), enBiz = await canonOf('Alias 7 B');
  await p.evaluate(() => { LANG = 'ar'; if (window.applyLang) applyLang(); current = 'finance'; render(); });
  await p.waitForTimeout(1200);
  const arName = await canonOf('Never Grouped Co'), arBiz = await canonOf('Alias 7 B');
  const arPage = await p.evaluate(() => ((document.getElementById('view') || {}).innerText || '').slice(0, 400));
  if (enName && arName && enName.key === arName.key && enBiz && arBiz && enBiz.key === arBiz.key) ok(`an unmerged name and a merged company keep their identity keys across a language switch (${enName.key}, ${enBiz.key}) — switching language never re-buckets anyone's money`);
  else fail(`identity changed across a language switch: ${JSON.stringify([enName, arName, enBiz, arBiz])}`);
  if (/[؀-ۿ]/.test(arPage)) ok('the page really did switch to Arabic, so the check above was made across a real switch');
  else fail('the page did not switch to Arabic — the language check proved nothing');

  if (!errors.length) ok('no page error at this scale'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
