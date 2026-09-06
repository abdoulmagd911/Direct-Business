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

/* 300 groups, three aliases each. Every invoice below names an alias, never a canonical name. */
const GROUPS = [];
for (let i = 0; i < 300; i++) {
  GROUPS.push({ id: 'g' + i, canonicalName: 'Canon Co ' + i, active: true,
    aliases: ['Alias ' + i + ' A', 'Alias ' + i + ' B', 'Alias ' + i + ' C'] });
}
/* the hostile shapes, appended so their ORDER in the list is known */
const AMBIG = 'Shared Alias Name';
GROUPS.push({ id: 'g-first', canonicalName: 'First Claimant', active: true, aliases: [AMBIG, 'First Only'] });
GROUPS.push({ id: 'g-second', canonicalName: 'Second Claimant', active: true, aliases: [AMBIG, 'Second Only'] });
const INACTIVE_ALIAS = 'Contested By Inactive';
GROUPS.push({ id: 'g-dead', canonicalName: 'Retired Group', active: false, aliases: [INACTIVE_ALIAS] });
GROUPS.push({ id: 'g-live', canonicalName: 'Live Group', active: true, aliases: [INACTIVE_ALIAS] });
GROUPS.push({ id: 'g-canon', canonicalName: 'Canonical Only Co', active: true, aliases: ['Some Other Spelling'] });
const BIG = [];
for (let i = 0; i < 200; i++) BIG.push('Big Alias ' + i);
GROUPS.push({ id: 'g-big', canonicalName: 'Two Hundred Aliases Co', active: true, aliases: BIG });

/* client_group values the invoices actually carry */
const NAMES = [];
for (let i = 0; i < 300; i++) NAMES.push('Alias ' + i + ' ' + 'ABC'[i % 3]);
NAMES.push(AMBIG, INACTIVE_ALIAS, 'Canonical Only Co', 'Big Alias 7', 'Never Grouped Co');
/* 2026-09-06 (watch cycle 34): every name above belongs to a DIFFERENT group, so the fixture had
   exactly one invoice per bucket — and a rollup with grouping switched off entirely would produce
   the same bucket count and the same total. Sabotaging finCanon's call into the grouping map was
   caught only incidentally, by the clearFinCanon check. These three names are SECOND aliases of
   groups already represented, so grouping and no-grouping now give different bucket counts and the
   claim "grouping actually happened" can be made directly. */
NAMES.push('Alias 0 B', 'Alias 0 C', 'Big Alias 8');

const SEED = [];
NAMES.forEach((nm, i) => {
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

const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  console.log(`fixture: ${GROUPS.length} groups (${GROUPS.reduce((a, g) => a + g.aliases.length, 0)} aliases) and ${N_SEED} invoices worth ${TOTAL_REV.toLocaleString()} SAR`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate((gs) => { DB.settings = DB.settings || {}; DB.settings.financeGroupMap = gs; }, GROUPS);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 160 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  await p.waitForTimeout(1500);

  const canonOf = (nm) => p.evaluate((n) => { try { return window.finCanon(n); } catch (e) { return { err: String(e && e.message || e) }; } }, nm);
  const groupOf = (nm) => p.evaluate((n) => { try { const g = window.finGroupCheck(n); return g ? { id: g.id, name: g.canonicalName, active: g.active } : null; } catch (e) { return { err: String(e && e.message || e) }; } }, nm);

  /* ---------- 1. at scale, every client total reconciles ---------- */
  const t0 = Date.now();
  const rollup = await p.evaluate(() => {
    const rows = (window.finLive ? finLive() : []).filter(window.finInPeriod);
    const by = {};
    rows.forEach(r => { const c = window.finCanon(r.client_group); by[c.key] = (by[c.key] || 0) + (+r.revenue_sar || 0); });
    return { keys: Object.keys(by).length, total: Math.round(Object.values(by).reduce((a, v) => a + v, 0) * 100) / 100 };
  });
  const ms = Date.now() - t0;
  if (Math.abs(rollup.total - TOTAL_REV) < 0.02) ok(`every one of the ${N_SEED} invoices lands in exactly one client bucket and they sum to ${TOTAL_REV.toLocaleString()} — nothing lost or double-counted across ${GROUPS.length} groups (${ms}ms)`);
  else fail(`the client rollup sums to ${rollup.total}, an independent recount of the fixture gives ${TOTAL_REV}`);
  /* the total is the same whether grouping works or not — money moves between buckets, never in or
     out — so the COUNT is what proves grouping actually happened */
  const WANT_BUCKETS = N_SEED - 3;   /* the three second-aliases fold into buckets that already exist */
  if (rollup.keys === WANT_BUCKETS) ok(`${N_SEED} invoices fold into ${WANT_BUCKETS} client buckets — the three invoices naming a SECOND alias of a group already present join it rather than opening a bucket of their own, which is grouping actually happening rather than a total that would look right either way`);
  else fail(`the rollup produced ${rollup.keys} buckets, ${WANT_BUCKETS} expected — ${rollup.keys === N_SEED ? 'every invoice got its own bucket, so the grouping map is not being consulted at all' : 'the map folded the wrong names together'}`);
  const gk = await canonOf('Alias 5 A');
  if (gk && gk.key === 'grp:g5' && gk.grouped === true) ok(`finCanon resolves an alias to its group through the map itself (key ${gk.key}, name "${gk.name}")`);
  else fail(`finCanon resolved "Alias 5 A" to ${JSON.stringify(gk)}, expected key grp:g5 — the rollup reads through finCanon, so if this is not grouped nothing else is`);
  const revTile = await p.evaluate(() => {
    const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === 'Revenue');
    const v = el && el.children[1]; const t = v && v.getAttribute('title');
    return t ? +t.replace(/[^\d.-]/g, '') : null;
  });
  if (revTile != null && Math.abs(revTile - TOTAL_REV) < 0.02) ok(`the Revenue tile agrees with the same recount at ${GROUPS.length} groups — grouping moves money between buckets, never into or out of the total`);
  else fail(`the Revenue tile reads ${revTile}, the recount gives ${TOTAL_REV}`);

  /* ---------- 3. an inactive group listed FIRST must not win ---------- */
  const inact = await groupOf(INACTIVE_ALIAS);
  if (inact && inact.id === 'g-live') ok(`"${INACTIVE_ALIAS}" is claimed by a retired group listed BEFORE a live one, and the live group wins — an archived grouping cannot capture a client's money by being earlier in the list`);
  else fail(`"${INACTIVE_ALIAS}" resolved to ${JSON.stringify(inact)}; the retired group g-dead is listed first and the live g-live must win`);

  /* ---------- 2. a name claimed by TWO active groups ---------- */
  const amb = await groupOf(AMBIG);
  const ambCanon = await canonOf(AMBIG);
  note(`"${AMBIG}" is listed as an alias by BOTH g-first and g-second; the app resolves it to ${JSON.stringify(amb)} and canonicalises it as ${JSON.stringify(ambCanon && ambCanon.name)}`);
  if (amb && amb.id) {
    const pageSaysSo = await p.evaluate((n) => {
      const t = (document.getElementById('view') || {}).innerText || '';
      return /two groups|more than one group|ambiguous|مجموعتين|أكثر من مجموعة/i.test(t);
    }, AMBIG);
    if (pageSaysSo) ok('a name claimed by two active groups is flagged on the page rather than resolved silently');
    else note(`KNOWN AND MEASURED, not asserted: a name claimed by two ACTIVE groups resolves to whichever appears first in the list (${amb.name}) with nothing on screen saying a choice was made. Order in DB.settings.financeGroupMap is not something anyone sets deliberately, so the winner is arbitrary. Recorded for the owner as a question about the DATA (two groups should not claim one alias) rather than fixed as a defect in the code — the resolution itself is deterministic and the totals stay correct either way`);
  } else fail(`"${AMBIG}" resolved to nothing at all, though two active groups list it`);

  /* ---------- 4. a canonicalName that is not one of its own aliases ---------- */
  const canonOnly = await groupOf('Canonical Only Co');
  if (canonOnly && canonOnly.id === 'g-canon') ok('a row named exactly a group\'s canonical name is matched to that group');
  else note(`measured, not asserted: a row named exactly "Canonical Only Co" — a group's own canonical name, not listed among its aliases — is NOT matched to it (resolved to ${JSON.stringify(canonOnly)}). js/62 matches on aliases only, which is what its code says it does; recorded so the behaviour is written down rather than discovered by a wrong total`);

  /* ---------- 5. finCanon is stable, and clearFinCanon really clears ---------- */
  const a1 = await canonOf('Alias 5 A'), a2 = await canonOf('Alias 5 A');
  if (JSON.stringify(a1) === JSON.stringify(a2)) ok(`finCanon is stable — the same raw name resolves identically twice (${a1 && a1.name})`);
  else fail(`finCanon gave two different answers for one name: ${JSON.stringify(a1)} vs ${JSON.stringify(a2)}`);
  const renamed = await p.evaluate(() => {
    const g = (DB.settings.financeGroupMap || []).find(x => x.id === 'g5');
    if (!g) return { err: 'g5 missing' };
    g.canonicalName = 'Renamed Co 5';
    const before = window.finCanon('Alias 5 A').name;      /* still cached */
    if (typeof clearFinCanon === 'function') clearFinCanon();
    const after = window.finCanon('Alias 5 A').name;        /* must see the new name */
    return { before, after };
  });
  if (renamed.before === 'Canon Co 5' && renamed.after === 'Renamed Co 5')
    ok('clearFinCanon really empties the cache — a renamed group is still the old name until it is cleared, and the new name immediately after');
  else if (renamed.before === renamed.after && renamed.after === 'Renamed Co 5')
    note(`the cache was not holding the old name to begin with (both reads gave "${renamed.after}") — clearFinCanon cannot be shown to do anything by this route`);
  else fail(`clearFinCanon did not take effect: before "${renamed.before}", after "${renamed.after}", expected "Canon Co 5" then "Renamed Co 5"`);

  /* ---------- 6. a cached answer must not survive a language switch ---------- */
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); });
  const enName = await canonOf('Never Grouped Co');
  await p.evaluate(() => { LANG = 'ar'; if (window.applyLang) applyLang(); current = 'finance'; render(); });
  await p.waitForTimeout(1200);
  const arName = await canonOf('Never Grouped Co');
  const arPage = await p.evaluate(() => ((document.getElementById('view') || {}).innerText || '').slice(0, 400));
  if (enName && arName && enName.key === arName.key) ok(`an ungrouped client keeps the same identity key across a language switch (${enName.key}) — switching language never re-buckets anyone's money`);
  else fail(`an ungrouped client changed identity across a language switch: ${JSON.stringify(enName)} vs ${JSON.stringify(arName)}`);
  const arIsArabic = /[؀-ۿ]/.test(arPage);
  if (arIsArabic) ok('the page really did switch to Arabic, so the check above was made across a real switch');
  else fail('the page did not switch to Arabic — the language check proved nothing');

  if (!errors.length) ok('no page error at 300 groups'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
