/* probe-write-paths-both-halves-attacks.mjs (2026-09-06, watch cycle 32) - the Finance WRITE paths,
   re-audited against BOTH reasons the page is refused.

   Cycle 12 guarded ten Finance write paths and probe-permissions-attacks holds them. But that work
   predates finMaySeeMoney(), and every one of those guards routes through finCanWrite():

       function finCanWrite(){ if(window.__isShareView) return false; return canFinEdit(); }

   which asks about the share view and about EDIT rights - and never about whether this person's
   role allows the Finance page at all. That is exactly the half round 50 found missing from the
   export guard and round 51 found missing from the Records export: a session refused Finance by
   ROLE, not by share link. It is the likelier half - a revoked or narrowed page access is an
   ordinary event; a share link is the rarer one - and it has now been the same gap three times, on
   three different surfaces, which is why the writes are being asked the same question here.

   The realistic session: someone whose TIER is still admin (so canFinEdit says yes) but whose
   per-person page access no longer includes Finance (so the page refuses them in words). js/52's
   access model returns "yes" outright for an admin tier, which is what makes tier and page access
   able to disagree.

   Under test, for each write path:
     1. Positive control - as a fully allowed admin it really does change the database, proved by
        diffing the table before and after. Otherwise every refusal below passes for the wrong reason.
     2. Under a read-only share view it changes nothing (a regression guard on cycle 12).
     3. Under a role that denies the Finance page it changes nothing.
   Every check diffs the actual table over the REST API, never the page's own state.

   Run:  node scripts/qa/probe-write-paths-both-halves-attacks.mjs        (port 8710)
   Sabotage (file-level): narrow the guard back to the share-view question alone. Restore
   byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8710;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SEED = [];
for (let i = 0; i < 7; i++) {
  const mo = (i % 6) + 1, d = '2026-' + String(mo).padStart(2, '0') + '-1' + (i % 8);
  SEED.push({
    id: 'w' + i, invoice_no: 'WP-' + i, line_no: 1, zatca_dpin: null,
    client_group: 'Write Co ' + (i % 3), customer_raw_name: 'Write Co ' + (i % 3),
    invoice_date: d, year: 2026, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: 10000 + i * 100, wallet_portion_sar: 0, revenue_sar: 10000 + i * 100,
    cost_sar: 6000, profit_sar: 4000 + i * 100, vat_sar: 0,
    amount_received_sar: 10000 + i * 100, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'wp-qa',
    /* WP-3 and WP-4 are seeded AWAY from the values finSetOrigin/finSetWay fall back to when their
       editor is not on screen ('booking' / 'invoice'). The first run of this probe seeded them AT
       those defaults, so a real write stored the same value and the diff saw nothing — three
       controls failed and reported the app as doing nothing when it was writing. It also models
       the real hazard exactly: a stale tab calling the function with no editor present overwrites
       the stored value with the default, which is the cycle-27 defect shape. */
    revenue_way: i === 4 ? 'commission' : 'invoice', origin: i === 3 ? 'project' : 'booking', proposal_ref: i === 3 ? 'PR-9' : null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    /* TWO already-deleted invoices, one for each restore path — the first run pointed both at
       WP-5, so by the time the by-id restore ran the by-number restore had already undeleted it */
    deleted_at: (i === 5 || i === 6) ? '2026-08-01T00:00:00Z' : null
  });
}
/* A pristine copy taken BEFORE start(), because start() keeps these arrays by reference and the
   mock mutates them (cycle 28). Used to reset the fixture between every single write attempt —
   without that, the first run of this probe reported five of seven paths as "refused" when the
   real reason was that an earlier check in the loop had already put the row into the state the
   write wanted, so the update matched zero rows and the app said "already deleted, someone else
   got there first". A check that changes nothing because there was nothing left to change proves
   nothing about the guard — the exact rubber-stamp shape this watch keeps finding elsewhere. */
const PRISTINE_INV = JSON.parse(JSON.stringify(SEED));
const TARGETS = [];
const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_targets: TARGETS, finance_client_links: [], client_profiles: [] });
const resetFixture = () => {
  SEED.length = 0;
  PRISTINE_INV.forEach((r) => SEED.push(JSON.parse(JSON.stringify(r))));
  TARGETS.length = 0;
};
const BASE = 'http://localhost:' + PORT;
const snapshot = async () => {
  const inv = await fetch(BASE + '/rest/v1/finance_invoices?select=*').then(r => r.json());
  const tgt = await fetch(BASE + '/rest/v1/finance_targets?select=*').then(r => r.json());
  return JSON.stringify({ inv: (inv || []).map(r => [r.invoice_no, r.deleted_at, r.origin, r.proposal_ref, r.revenue_way]).sort(), tgt: (tgt || []).map(t => [t.year, t.expected_sar]).sort() });
};

async function main() {
  console.log(`fixture: ${SEED.length} invoices — WP-5 and WP-6 already soft-deleted (one per restore path), WP-3 origin 'project', WP-4 way 'commission' (both away from the functions' fallbacks), no targets yet`);
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
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  await p.waitForTimeout(900);

  /* every confirm/prompt answered yes, so a guard is the ONLY thing that can stop a write */
  const arm = () => p.evaluate(() => {
    window.__probeAlert = null;
    window.confirm = function () { return true; };
    window.prompt = function () { return '123456'; };
    window.pfPrompt = function (q, d, cb) { cb('123456'); };   // 2026-09-10: the targets ask in the page
    window.alert = function (m) { window.__probeAlert = String(m); };
    if (window.pfConfirm) window.pfConfirm = function (msg, onYes) { onYes(); };
  });
  const WRITES = [
    ['finSetTargets', 'the targets editor', () => window.finSetTargets(2026)],
    ['finDelInv', 'delete an invoice by number', () => window.finDelInv('WP-1')],
    ['finRestoreInv', 'restore an invoice by number', () => window.finRestoreInv('WP-5')],
    ['finDel', 'delete an invoice by id', () => { const r = (FIN.rows || []).find(x => x.invoice_no === 'WP-2'); if (r) window.finDel(r.id); }],
    ['finRestore', 'restore an invoice by id', () => { const r = (FIN.rows || []).find(x => x.invoice_no === 'WP-6'); if (r) window.finRestore(r.id); }],
    ['finSetOrigin', 'the origin editor', () => window.finSetOrigin('WP-3')],
    ['finSetWay', 'the revenue-way editor', () => window.finSetWay('WP-4')]
  ];
  const runWrite = async (fnBody) => {
    await arm();
    await p.evaluate(`(${fnBody.toString()})()`);
    await p.waitForTimeout(1500);
    return p.evaluate(() => window.__probeAlert);
  };
  const reload = async () => {
    resetFixture();
    await p.evaluate(() => { FIN.rows = null; FIN.targets = null; finLoad(); });
    for (let i = 0; i < 80 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(200);
  };
  await reload();

  /* ---------- 1. positive controls: as an allowed admin, each really does write ---------- */
  const writes = {};
  let ctlBad = 0;
  for (const [fn, label, body] of WRITES) {
    await reload();
    const before = await snapshot();
    await runWrite(body);
    const after = await snapshot();
    writes[fn] = before !== after;
    if (before !== after) ok(`control: as an allowed admin, ${label} (${fn}) really does change the database`);
    else { ctlBad++; fail(`control: as an allowed admin, ${label} (${fn}) changed nothing — the refusals below would pass for the wrong reason`); }
    await reload();
  }
  if (ctlBad) { console.log('\nFAILED - ' + failures + ' check(s)'); await b.close(); srv.close(); process.exit(1); }
  /* restore the fixture to a known shape before the refusal rounds */
  await p.evaluate(() => { FIN.rows = null; finLoad(); }); await p.waitForTimeout(1500);

  /* ---------- 2 & 3. both halves ---------- */
  const HALVES = [
    ['a read-only share view', () => { window.__isShareView = true; }],
    ['a role that denies the Finance page', () => {
      window.__isShareView = false;
      window.__userTier = 'admin';                       /* tier still says admin: canFinEdit will say yes */
      window.__accessKnown = function () { return true; };
      window.myAllowedPages = function () { return ['leads']; };   /* but Finance is not among this person's pages */
    }]
  ];
  for (const [half, setup] of HALVES) {
    await p.evaluate(setup);
    const st = await p.evaluate(() => ({
      canFinEdit: typeof window.canFinEdit === 'function' ? window.canFinEdit() : null,
      finCanWrite: typeof window.finCanWrite === 'function' ? window.finCanWrite() : null,
      mayOpen: window.__v73MayOpen ? window.__v73MayOpen('finance') : null,
      maySee: typeof window.finMaySeeMoney === 'function' ? window.finMaySeeMoney() : null
    }));
    note(`under ${half}: canFinEdit ${st.canFinEdit} · finCanWrite ${st.finCanWrite} · mayOpen('finance') ${st.mayOpen} · finMaySeeMoney ${st.maySee}`);
    if (st.maySee === false) ok(`control: under ${half} the session is genuinely refused Finance (finMaySeeMoney says no)`);
    else fail(`control: under ${half} finMaySeeMoney says ${st.maySee} — this half is not set up, so nothing below is tested`);

    let leaked = 0;
    for (const [fn, label, body] of WRITES) {
      await reload();
      const before = await snapshot();
      const alerted = await runWrite(body);
      const after = await snapshot();
      /* the reset is what makes a "changed nothing" mean the guard held rather than that there was
         nothing left to change: prove the row really is in a state this write would move */
      if (String(alerted || '').match(/[Aa]lready (deleted|restored)/)) { fail(`under ${half}: ${label} reported "already in that state" — the fixture was not reset, so this check proved nothing`); await reload(); continue; }
      if (before === after) ok(`under ${half}: ${label} changed nothing${alerted ? ' — "' + String(alerted).slice(0, 70) + '"' : ''}`);
      else { leaked++; fail(`under ${half}: ${label} (${fn}) CHANGED THE DATABASE. The page refuses this session in words, and every export now asks the same question, but this write path asks only finCanWrite() — the share view and edit rights — never whether this person's role allows Finance at all`); }
      await reload();
    }
    if (!leaked) ok(`all ${WRITES.length} write paths refuse under ${half}`);
    await p.evaluate(() => { window.__isShareView = false; window.__userTier = 'admin'; try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; } try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; } });
    await reload();
  }

  /* ---------- 4. the import surface, both halves (attack area dd) ----------
     v65Commit routes through finCanWrite and so is covered by the same fix, but the import tab has
     its own surface: v65OpenTeach (the teach-the-columns dialog, whose save writes a mapping into
     DB.settings) checks canFinEdit() DIRECTLY rather than finCanWrite, so the fix above does not
     reach it. Driven here against both halves, with a control first proving each really works for
     an allowed admin. */
  const HEADER = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
  const csvText = [HEADER.join(','), ['IMP-1', 'Import Co', '2026-05-05', 9000, 4000].join(','), ['IMP-2', 'Import Co', '2026-05-06', 8000, 3000].join(',')].join('\n');
  const teachCsv = ['Weird1,Weird2,Weird3', 'a,b,c'].join('\n');
  const armImport = async (text) => {
    /* v65IngestText writes into #finImpOut and throws if the Import tab has not rendered — which
       is exactly what happens when the session may not have it. Make sure the tab is really on
       screen before ingesting, and report "no import surface" rather than crashing the run. */
    await p.evaluate(() => { current = 'finance'; if (typeof window.finGo === 'function') window.finGo('import'); else render(); });
    await p.waitForTimeout(1200);
    const ready = await p.evaluate(() => !!document.getElementById('finImpOut'));
    if (!ready) return '__NO_IMPORT_SURFACE__';
    await p.evaluate(([n, t]) => { try { window.v65IngestText(n, t); } catch (e) { } }, ['dp.csv', text]);
    let last = '', same = 0;
    for (let i = 0; i < 45; i++) {
      await p.waitForTimeout(400);
      const cur = await p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
      if (cur && cur === last) { if (++same >= 3) break; } else same = 0;
      last = cur;
    }
    return last;
  };
  /* Round 54 (2026-09-06) — cycle 32 left v65OpenTeach as a note because it checks canFinEdit()
     directly. It is guarded through finCanWrite() now, so the note is an assertion: drive the real
     button, and require the mapping dialog to appear for an allowed admin and NOT to appear under
     either refused half. The stale-tab shape is exactly how it would be reached in life — the
     preview is built while the session is still allowed, and the role changes underneath it — so
     the file is armed as an admin and the half applied WITHOUT reloading. */
  const UNKNOWN_CSV = 'Alpha,Beta,Gamma\nsomething,else,entirely';
  const clickTeach = () => p.evaluate(() => {
    const btn = [...document.querySelectorAll('#finImpOut button')].find(b => /Teach|تعليم/i.test(b.textContent));
    if (!btn) return { clicked: false, dialog: false };
    btn.click();
    return { clicked: true, dialog: false };
  });
  /* closeModal() only hides the overlay — the dialog's fields stay in the DOM — so "is it open"
     has to be a VISIBILITY question. Checking existence would have called the control's own
     leftover dialog a failure of the check that follows it. */
  const teachDialogOpen = () => p.evaluate(() => { const el = document.getElementById('v65t_invoice_no'); return !!(el && el.offsetParent !== null); });
  const closeAnyModal = () => p.evaluate(() => { try { if (typeof closeModal === 'function') closeModal(); } catch (_) { } try { const m = document.getElementById('modal'); if (m) m.innerHTML = ''; } catch (_) { } });

  await reload();
  await p.evaluate((header) => {
    DB.settings = DB.settings || {};
    DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map(h => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
  }, HEADER);
  const ctlPreview = await armImport(csvText);
  const ctlCounts = (ctlPreview || '').match(/New\s+(\d+)/);
  if (ctlPreview === '__NO_IMPORT_SURFACE__') fail('control: the Import tab did not render for an allowed admin — the import checks below cannot run');
  else if (ctlCounts && +ctlCounts[1] === 2) ok('control: as an allowed admin the import previews the file (New 2) — the import surface really is reachable here');
  else fail(`control: the import preview did not report New 2 (${(ctlPreview || '').slice(0, 140).replace(/\s+/g, ' ')}) — the import checks below would prove nothing`);
  const beforeCommit = await snapshot();
  await p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find(x => /Confirm/i.test(x.textContent)); if (bt) bt.click(); });
  await p.waitForTimeout(2500);
  const afterCommit = await snapshot();
  if (beforeCommit !== afterCommit) ok('control: as an allowed admin, Confirm really does write the batch');
  else fail('control: Confirm wrote nothing as an allowed admin — the refusals below would pass for the wrong reason');

  for (const [half, setup] of HALVES) {
    await reload();
    await p.evaluate(setup);
    const impText = await armImport(csvText);
    const beforeImp = await snapshot();
    await p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find(x => /Confirm/i.test(x.textContent)); if (bt) bt.click(); try { if (typeof window.v65Commit === 'function') window.v65Commit(); } catch (e) { } });
    await p.waitForTimeout(2500);
    const afterImp = await snapshot();
    if (beforeImp === afterImp) ok(`under ${half}: the import Confirm writes nothing, even called directly`);
    else fail(`under ${half}: the import Confirm WROTE THE BATCH — a stale tab can push a whole import through a session the page refuses`);
    const tabRefused = impText === '__NO_IMPORT_SURFACE__' || /restricted|متاح للمدراء|not available|غير متاح/i.test(impText || '') || !/New\s+\d/.test(impText || '');
    if (tabRefused) ok(`under ${half}: the Import tab itself does not offer a preview to build a batch from${impText === '__NO_IMPORT_SURFACE__' ? ' (it does not render at all)' : ''}`);
    else note(`under ${half}: the Import tab still rendered a preview ("${(impText || '').slice(0, 90).replace(/\s+/g, ' ')}") — the Confirm above is what must hold, and it does`);
    /* teach-the-columns, armed as an admin then refused underneath — see the helper above */
    /* reload() only resets the FIXTURE — the half's flags are still on, which is why the control
       has to put the session back to an allowed admin explicitly before arming the file. */
    await p.evaluate(() => { window.__isShareView = false; window.__userTier = 'admin'; try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; } try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; } });
    await reload();
    await armImport(UNKNOWN_CSV);
    const teachCtl = await clickTeach();
    const ctlDialog = teachCtl.clicked ? await teachDialogOpen() : false;
    await closeAnyModal();
    if (teachCtl.clicked && ctlDialog) ok(`control (${half}): as an allowed admin the unrecognised file offers Teach and it opens the mapping dialog`);
    else fail(`control (${half}): the Teach dialog did not open for an allowed admin (${JSON.stringify(teachCtl)}, dialog ${ctlDialog}) — the refusal below would prove nothing`);
    await p.evaluate(setup);
    const teachRef = await clickTeach();
    const refDialog = teachRef.clicked ? await teachDialogOpen() : false;
    if (!refDialog) ok(`under ${half}: the Teach-the-columns dialog does not open${teachRef.clicked ? ' even with the button still on screen from before the change' : ' (no button offered)'}`);
    else fail(`under ${half}: v65OpenTeach opened the mapping dialog — its save writes a column mapping the importer then trusts, and teaching the wrong shape is exactly what round 52 closed off`);
    await closeAnyModal();
    await p.evaluate(() => { window.__isShareView = false; window.__userTier = 'admin'; try { delete window.myAllowedPages; } catch (_) { window.myAllowedPages = undefined; } try { delete window.__accessKnown; } catch (_) { window.__accessKnown = undefined; } });
  }
  await reload();

  if (!errors.length) ok('no page error'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
