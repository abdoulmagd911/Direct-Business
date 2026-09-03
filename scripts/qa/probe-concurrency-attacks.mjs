/* probe-concurrency-attacks.mjs (2026-09-03, watch cycle 15) - two people, two tabs, one Finance.

   Everything in this app assumes one person at a time. It is used by a team. This probe runs TWO
   independent browser sessions against one database and asks what happens when they touch the
   same money at the same time - and, when a write does nothing, whether the person is told the
   TRUTH about why.

   Under test:
     1. Two admins editing DIFFERENT invoices never touch each other's row.
     2. Two admins editing the SAME invoice in different fields both land (column-level writes).
     3. A stale tab: B deletes an invoice, then A - whose screen still shows it - presses Delete.
        The write matches zero rows. The person must be told what actually happened, not given
        a reason that is not true.
     4. The same for Restore.
     5. Both tabs arm the SAME import preview and both press Confirm. The second must fail loudly
        (the live table carries UNIQUE (invoice_no, line_no) - read from pg_constraint on the real
        database this cycle and now mirrored in the mock), and the table must end up holding
        exactly one copy of every invoice number.
     6. Targets set from two tabs: measured and reported, not silently assumed safe.
     7. The by-id Delete/Restore pair carries the same permission guard as the by-invoice-number
        pair (cycle 12 fixed the second pair and this probe found the first still open).

   Run:  node scripts/qa/probe-concurrency-attacks.mjs        (port 8217)
   Sabotage (file-level - js/16 calls its own local functions, so replacing a window.* copy is a
   rubber stamp): put the flat "your account was not allowed to" message back on the four
   delete/restore paths -> checks 3, 4 go red; drop the guard from finRestore -> check 7 goes red.
   Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8217;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function inv(no, i, extra) {
  const mo = (i % 12) + 1, t = 1000 + i * 7, c = Math.round((1000 + i * 7) * 0.6);
  return Object.assign({
    id: 'cc-' + no, invoice_no: no, line_no: null, zatca_dpin: null,
    client_group: 'Conc Co ' + (i % 4), customer_raw_name: 'Conc Co ' + (i % 4),
    invoice_date: '2026-' + String(mo).padStart(2, '0') + '-10', year: 2026,
    month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: t, wallet_portion_sar: 0, revenue_sar: t, cost_sar: c, profit_sar: t - c,
    vat_sar: 0, amount_received_sar: t, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'seed', origin: null, proposal_ref: null,
    created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', deleted_at: null
  }, extra || {});
}
const SEED = [];
for (let i = 1; i <= 40; i++) SEED.push(inv('CC-' + String(i).padStart(3, '0'), i));
const srv = start(PORT, { finance_invoices: SEED });
const BASE = 'http://localhost:' + PORT;
const rowOf = async (n) => (await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + encodeURIComponent(n)).then(r => r.json()))[0] || null;
const snapshot = async () => {
  const out = []; let from = 0;
  for (;;) {
    const page = await fetch(BASE + '/rest/v1/finance_invoices?select=*&offset=' + from + '&limit=1000').then(r => r.json());
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return JSON.stringify(out.slice().sort((a, b) => String(a.id) < String(b.id) ? -1 : 1));
};

async function session(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; const alerts = [];
  p.on('pageerror', (e) => errors.push(label + ' JS: ' + e.message));
  p.on('dialog', async (d) => { alerts.push(d.message()); await d.accept(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { current = 'finance'; render(); });
  for (let i = 0; i < 80 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  // the app asks for confirmation through pfConfirm/confirm - answer yes without a modal
  await p.evaluate(() => { window.pfConfirm = function (m, onYes) { onYes(); }; window.confirm = function () { return true; }; });
  return { p, errors, alerts, label };
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const A = await session(b, 'A');
  const B = await session(b, 'B');
  const bothLoaded = (await A.p.evaluate(() => FIN.rows.length)) === SEED.length && (await B.p.evaluate(() => FIN.rows.length)) === SEED.length;
  if (bothLoaded) ok('two independent sessions are signed in and both hold all ' + SEED.length + ' invoices');
  else fail('the two sessions did not both load the fixture');

  /* ---------- 1. different invoices ---------- */
  // finSetOrigin reads the two fields the row modal renders, so drive it the way a person does:
  // open the invoice, fill the boxes, save.
  const setOrigin = async (S, no, ref) => S.p.evaluate(([no, ref]) => {
    const row = (FIN.rows || []).find(x => x.invoice_no === no);
    if (!row) return 'no row';
    window.finRow(row.id);
    const o = document.getElementById('fin_origin'), pr = document.getElementById('fin_pref');
    if (!o || !pr) return 'no modal';
    o.value = 'project'; pr.value = ref;
    window.finSetOrigin(no);
    return 'ok';
  }, [no, ref]);
  const opened = await Promise.all([setOrigin(A, 'CC-001', 'PR-A'), setOrigin(B, 'CC-002', 'PR-B')]);
  if (opened.every(x => x === 'ok')) ok('both sessions opened an invoice and pressed save at the same moment');
  else fail('could not drive the invoice editor: ' + JSON.stringify(opened));
  await new Promise(r => setTimeout(r, 3000));
  const r1 = await rowOf('CC-001'), r2 = await rowOf('CC-002');
  if (r1 && r1.proposal_ref === 'PR-A' && r2 && r2.proposal_ref === 'PR-B') ok('two admins editing different invoices at the same moment: both writes landed, neither touched the other row');
  else fail('different-invoice writes interfered: CC-001=' + JSON.stringify(r1 && r1.proposal_ref) + ' CC-002=' + JSON.stringify(r2 && r2.proposal_ref));

  /* ---------- 2. the same invoice, different fields ---------- */
  await setOrigin(A, 'CC-003', 'PR-BOTH');
  await new Promise(r => setTimeout(r, 1500));
  await B.p.evaluate(() => {
    const row = (FIN.rows || []).find(x => x.invoice_no === 'CC-003');
    if (row) window.finRow(row.id);
    const w = document.getElementById('fin_way'); if (w) w.value = 'commission';
    if (typeof window.finSetWay === 'function') window.finSetWay('CC-003');
  });
  await new Promise(r => setTimeout(r, 2000));
  const r3 = await rowOf('CC-003');
  if (r3 && r3.proposal_ref === 'PR-BOTH' && r3.revenue_way === 'commission') ok("one admin's origin edit survives another admin writing a different field on the same invoice - both fields are on the row");
  else fail('the same-invoice edits clobbered each other: ' + JSON.stringify(r3 && [r3.proposal_ref, r3.revenue_way]));

  /* ---------- 3. the stale tab: B deletes, A presses Delete ---------- */
  await B.p.evaluate(() => window.finDelInv('CC-010'));
  await new Promise(r => setTimeout(r, 2500));
  const afterB = await rowOf('CC-010');
  if (afterB && afterB.deleted_at) ok('B deleted CC-010'); else fail('B could not delete CC-010');
  A.alerts.length = 0;
  const beforeStale = await snapshot();
  await A.p.evaluate(() => window.finDelInv('CC-010'));   // A's screen still shows it
  await new Promise(r => setTimeout(r, 2500));
  const afterStale = await snapshot();
  const msgDel = A.alerts.join(' | ');
  if (afterStale === beforeStale) ok('the stale Delete wrote nothing - the table is byte-identical');
  else fail('the stale Delete changed the table');
  if (/already deleted|someone else|another tab|no longer/i.test(msgDel)) ok('…and A is told the truth: ' + JSON.stringify(msgDel.slice(0, 120)));
  else fail('A was told: ' + JSON.stringify(msgDel.slice(0, 160)) + ' - but the real reason is that someone else had already deleted it, not a permission problem');

  /* ---------- 4. the same for Restore ---------- */
  await A.p.evaluate(() => window.finRestoreInv('CC-010'));
  await new Promise(r => setTimeout(r, 2500));
  const restored = await rowOf('CC-010');
  if (restored && !restored.deleted_at) ok('A restored CC-010 - a real restore still works'); else fail('A could not restore CC-010');
  B.alerts.length = 0;
  const beforeStaleR = await snapshot();
  await B.p.evaluate(() => window.finRestoreInv('CC-010'));  // B's screen still thinks it is deleted
  await new Promise(r => setTimeout(r, 2500));
  const afterStaleR = await snapshot();
  const msgRes = B.alerts.join(' | ');
  if (afterStaleR === beforeStaleR) ok('the stale Restore wrote nothing - the table is byte-identical');
  else fail('the stale Restore changed the table');
  if (/already restored|not deleted|someone else|another tab|no longer/i.test(msgRes)) ok('…and B is told the truth: ' + JSON.stringify(msgRes.slice(0, 120)));
  else fail('B was told: ' + JSON.stringify(msgRes.slice(0, 160)) + ' - but the invoice had already been restored by someone else');

  /* ---------- 4b. the third reason zero rows can mean: the row is not there at all ----------
     Added 2026-09-03 (watch cycle 20): a mutation audit made this branch say "your account was
     not allowed to" and NO probe noticed — only the "already done" branch was ever exercised.
     A message with three branches needs three tests. */
  A.alerts.length = 0;
  const beforeGone = await snapshot();
  await A.p.evaluate(() => window.finDelInv('CC-NO-SUCH-INVOICE'));
  await new Promise(r => setTimeout(r, 2500));
  const afterGone = await snapshot();
  const msgGone = A.alerts.join(' | ');
  if (afterGone === beforeGone) ok('deleting an invoice number that is not in the table writes nothing'); else fail('the missing-invoice delete changed the table');
  if (/no longer in the table|nothing changed/i.test(msgGone) && !/not allowed/i.test(msgGone)) ok('…and the person is told the invoice is not there, not that they lack permission: ' + JSON.stringify(msgGone.slice(0, 100)));
  else fail('a delete of a missing invoice said: ' + JSON.stringify(msgGone.slice(0, 160)));

  /* ---------- 4c. the harness itself still refuses what the real table refuses ----------
     The mock mirrors the live NOT NULLs, CHECK constraints and UNIQUE (invoice_no, line_no).
     If that enforcement ever regresses, every write-path probe silently starts testing nothing —
     and a mutation audit showed no probe would notice. This is the guard on the guard. */
  const rejects = async (row) => {
    const r = await fetch(BASE + '/rest/v1/finance_invoices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([row]) });
    return r.status >= 400;
  };
  const goodRow = JSON.parse(JSON.stringify(SEED[0]));
  delete goodRow.year;   // GENERATED ALWAYS on the live table: the mock refuses ANY row carrying it,
                         // which would make every probe below pass for the wrong reason
  delete goodRow.id;
  // POSITIVE CONTROL FIRST. Without it "everything is refused" passes this check trivially — which
  // is exactly what happened when it was first written (watch cycle 20), and a mutation audit
  // caught it: the harness had stopped enforcing anything and this check still said yes.
  const accepted = !(await rejects(Object.assign({}, goodRow, { invoice_no: 'HZ-OK' })));
  if (accepted) ok('a perfectly ordinary invoice is still accepted by the harness — so the three refusals below mean something');
  else fail('the harness refused a valid row: every refusal check below would pass for the wrong reason');
  const nullDate = Object.assign({}, goodRow, { invoice_no: 'HZ-1', invoice_date: null });
  const negTotal = Object.assign({}, goodRow, { invoice_no: 'HZ-2', total_incl_vat_sar: -5, integrity_status: 'pending' });
  const dupKey = Object.assign({}, goodRow, { invoice_no: 'HZ-OK' });   // same (invoice_no, line_no) as the row just accepted
  const hzNull = await rejects(nullDate), hzNeg = await rejects(negTotal), hzDup = await rejects(dupKey);
  if (accepted && hzNull && hzNeg && hzDup) ok('the harness still refuses a null invoice date, a negative total that is not a credit note, and a duplicate (invoice_no, line_no) — the same three the live table refuses');
  else fail('the harness accepted a row production would refuse: nullDate=' + hzNull + ' negativeTotal=' + hzNeg + ' duplicateKey=' + hzDup + ' — every write-path check in this battery would be testing nothing');

  /* ---------- 5. both tabs confirm the same import ---------- */
  const HEADER = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
  const CSV = ['Ref,Customer,Date,Total,Cost']
    .concat([...Array(25)].map((_, i) => ['CCN-' + i, 'Conc Co 1', '2026-05-05', 4000 + i, 900].join(','))).join('\n');
  for (const S of [A, B]) {
    await S.p.evaluate((header) => {
      DB.settings = DB.settings || {};
      DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
      DB.settings.importSignatureMappings.push({ key: header.slice().map(h => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
    }, HEADER);
    await S.p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); });
    await S.p.evaluate((t) => window.v65IngestText('conc.csv', t), CSV);
  }
  await new Promise(r => setTimeout(r, 4000));
  const armed = await Promise.all([A, B].map(S => S.p.evaluate(() => !![...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import/i.test(x.textContent)))));
  if (armed[0] && armed[1]) ok('both tabs are holding an armed preview of the same 25-row file');
  else fail('the two tabs did not both arm a preview: ' + JSON.stringify(armed));
  await A.p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import/i.test(x.textContent)); if (bt) bt.click(); });
  await new Promise(r => setTimeout(r, 4000));
  await B.p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import/i.test(x.textContent)); if (bt) bt.click(); });
  await new Promise(r => setTimeout(r, 5000));
  const all = JSON.parse(await snapshot());
  const nos = all.map(r => r.invoice_no).filter(n => String(n).indexOf('CCN-') === 0);
  const dupes = nos.filter((n, i) => nos.indexOf(n) !== i);
  if (nos.length === 25 && !dupes.length) ok('after both tabs confirmed the same file the table holds exactly one copy of each of the 25 invoice numbers - no duplicate money');
  else fail('duplicate invoices after a double confirm: ' + nos.length + ' rows, ' + dupes.length + ' duplicated numbers');
  const bOut = await B.p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
  if (/FAILED|nothing landed|duplicate key/i.test(bOut)) ok('the second tab is told its import failed and nothing landed, with the database’s own reason');
  else fail('the second tab said: ' + JSON.stringify(bOut.replace(/\n/g, ' | ').slice(0, 220)));

  /* ---------- 6. targets from two tabs ---------- */
  await A.p.evaluate(() => { window.prompt = function () { return '1000000'; }; });
  await B.p.evaluate(() => { window.prompt = function () { return '2000000'; }; });
  await A.p.evaluate(() => window.finSetTargets(2026));
  await new Promise(r => setTimeout(r, 1500));
  await B.p.evaluate(() => window.finSetTargets(2026));
  await new Promise(r => setTimeout(r, 2500));
  const tg = await fetch(BASE + '/rest/v1/finance_targets?select=*').then(r => r.json());
  const y26 = tg.filter(t => +t.year === 2026);
  if (y26.length === 1) ok('two tabs setting the same year’s target leave exactly one row (last write wins, no duplicate target)');
  else fail(y26.length + ' target rows now exist for 2026');

  /* ---------- 7. the by-id Delete/Restore pair ---------- */
  // CC-021 is genuinely deleted first, so an unguarded Restore would be a VISIBLE change.
  // (The first version of this check used a live invoice, where restore sets deleted_at from
  // null to null and changes nothing whatever the guard does - a rubber stamp, not a test.)
  await B.p.evaluate(() => window.finDelInv('CC-021'));
  await new Promise(r => setTimeout(r, 2500));
  const del21 = await rowOf('CC-021');
  if (del21 && del21.deleted_at) ok('CC-021 is deleted, so a Restore would be a visible change'); else fail('could not delete CC-021 for the guard test');
  const idLive = (await rowOf('CC-020')).id;
  const idDeleted = del21 ? del21.id : null;
  const beforeV = await snapshot();
  await A.p.evaluate(([idLive, idDeleted]) => {
    window.__userTier = 'viewer'; window.__userRole = 'viewer'; window.__pageAccess = {};
    try { window.finDel(idLive); } catch (e) { }
    try { window.finRestore(idDeleted); } catch (e) { }
  }, [idLive, idDeleted]);
  await new Promise(r => setTimeout(r, 3000));
  const afterV = await snapshot();
  if (afterV === beforeV) ok('a viewer is refused by BOTH by-id paths: Delete on a live invoice and Restore on a deleted one leave the table byte-identical');
  else fail('a viewer changed the table through the by-id Delete/Restore pair (the by-invoice-number pair was guarded in cycle 12; this pair was not)');

  const errs = A.errors.concat(B.errors);
  if (!errs.length) ok('no page errors in either session'); else fail('page errors: ' + errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
