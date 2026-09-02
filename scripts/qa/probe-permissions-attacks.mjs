/* probe-permissions-attacks.mjs (2026-09-02, overnight cycle) — can a reader write?
   Every Finance write path is reachable from a button that is hidden for a non-editor. That
   hiding is the FIRST lock; this probe checks the SECOND one — the function itself. It matters
   because the tier is read from `window.__userTier` at login: an admin demoted (or a tab left
   open, or a share view) still holds a page whose old DOM and old functions are one click away.
   `finDelInv` has always guarded itself; several of its neighbours did not.
   Rules under test, for viewer / team_member / bd / operations and for a share view:
     1. Nothing writeable is OFFERED: no Set-targets button, no Delete/Restore on an invoice,
        no revenue-way or origin editor, and the Import tab shows its "restricted to admins and
        managers" message instead of a dropzone.
     2. Nothing writeable WORKS when called directly: finSetTargets, finDelInv, finRestoreInv,
        finSetOrigin, finSetWay, v65Commit, and the guardrails editors (v62AddExclusion,
        v62MergeBiz, v62UnmergeBiz, v62DismissDup) all leave every table byte-identical.
     3. They refuse QUIETLY and safely — no exception thrown, no half-written row, no crash.
     4. An admin can still do all of it (the guards do not break real work).
   Run:  node scripts/qa/probe-permissions-attacks.mjs      (port 8211)
   Sabotage: drop the canFinEdit() guard from finDelInv (or any of the four added this cycle)
   → that path's check goes red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8211; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const snap = async () => {
  const t = {};
  for (const tbl of ['finance_invoices', 'finance_targets', 'client_profiles', 'finance_client_links', 'businesses']) {
    t[tbl] = JSON.stringify(await fetch(BASE + '/rest/v1/' + tbl).then(r => r.json()));
  }
  return t;
};
const diff = (a, b) => Object.keys(a).filter(k => a[k] !== b[k]);

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.accept());
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5500);
  await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  const live = await p.evaluate(() => { const r = (FIN.rows || []).find(x => !x.deleted_at); return { no: r.invoice_no, total: +r.total_incl_vat_sar }; });
  // one soft-deleted invoice so Restore has something to aim at
  await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + encodeURIComponent(live.no), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deleted_at: new Date().toISOString() }) });
  await p.evaluate(() => { FIN.rows = null; finLoad(); }); await p.waitForTimeout(2200);
  const delNo = live.no;
  const liveNo = await p.evaluate(() => { const r = (FIN.rows || []).find(x => !x.deleted_at); return r.invoice_no; });

  /* Being a non-editor is not just a tier: canFinEdit() delegates to mayEditPage('finance'),
     which reads the per-person access matrix (window.__pageAccess) set in Team & Access. A real
     viewer has that matrix loaded WITHOUT finance:editor, so that is what this simulates.
     (Recorded separately in BACKLOG: with the matrix absent, mayEditPage returns true for
     everyone — a deliberate fail-open in js/52, outside Finance's lane, needing the owner's
     ruling. These guards are the second lock either way.) */
  const asTier = async (tier, share) => p.evaluate(({ tier, share }) => {
    window.__userTier = tier; window.__userRole = tier; window.__isShareView = !!share;
    window.__pageAccess = { today: 'viewer', leads: 'viewer', clients: 'viewer', finance: 'viewer' };
    window.__probeSentinel = 1;
  }, { tier, share });
  const asAdmin = async () => p.evaluate(() => { window.__userTier = 'admin'; window.__userRole = 'admin'; window.__isShareView = false; window.__pageAccess = null; });

  /* Arm the importer as an ADMIN and stop at the preview, so v65Commit has a real batch waiting.
     This is the actual risk it guards: the preview is built by an editor, then the tab is left
     open (or shared, or the person's access changes) and Confirm is pressed. Without a batch
     waiting, v65Commit returns at its own `if(!FILES_STATE)` and proves nothing. */
  await p.evaluate(async () => {
    window.__userTier = 'admin'; window.__userRole = 'admin'; window.__isShareView = false; window.__pageAccess = null;
    const header = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
    DB.settings = DB.settings || {}; DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map(h => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
    current = 'finance'; FIN.tab = 'import'; renderFinance(document.getElementById('view'));
    await new Promise(r => setTimeout(r, 600));
    window.v65IngestText('perm.csv', 'Ref,Customer,Date,Total,Cost\nPERM-NEW-1,Test Company 1,2026-06-15,777,10');
    await new Promise(r => setTimeout(r, 1800));
  });
  const armed = await p.evaluate(() => !![...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import/i.test(x.textContent)));
  if (armed) ok('an import preview is waiting (one new invoice) — v65Commit now has a real batch to refuse'); else fail('could not arm the importer preview');

  /* ---------- 1 + 2 + 3, per tier ---------- */
  for (const [tier, share, label] of [['viewer', false, 'a viewer'], ['team_member', false, 'a team member'], ['bd', false, 'a BD user'], ['operations', false, 'an operations user'], ['admin', true, 'a share view']]) {
    await asTier(tier, share);
    // what is offered
    const offered = await p.evaluate(async (dn) => {
      current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all', cmp: 'none' }; FIN.tab = 'overview';
      renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 500));
      const targets = !![...document.querySelectorAll('#view button')].find(b => /Set targets|تعديل الأرقام/.test(b.textContent));
      const tabs = [...document.querySelectorAll('#view button')].map(b => b.textContent.trim());
      FIN.tab = 'import'; renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 500));
      const importText = document.querySelector('#view').innerText;
      // the invoice modal for a live invoice
      let modal = '';
      try { finRow((FIN.rows.find(r => !r.deleted_at) || {}).id); await new Promise(r => setTimeout(r, 400)); modal = (document.querySelector('#finModal') || document.body).innerText; if (window.finCloseModal) finCloseModal(); } catch (_) { }
      return { targets, importTab: tabs.some(t => /^(Import|استيراد)$/.test(t)), importText, modal };
    }, delNo);
    if (!offered.targets) ok(`${label}: no "Set targets" button`); else fail(`${label} was offered the targets editor`);
    if (!offered.importTab) ok(`${label}: no Import tab in the tab bar`); else fail(`${label} sees the Import tab`);
    // a share view is refused Finance outright ("not available in shared view-only links"), which
    // is a stronger refusal than the Import tab's own message — either is a pass.
    if (/restricted to admins and managers|متاح للمدراء والمسؤولين|not available in shared view-only|غير متاحة في الروابط/i.test(offered.importText)) ok(`${label}: reaching Import directly is refused in words, not with a dropzone`); else fail(`${label}: Import tab does not refuse: ${JSON.stringify(offered.importText.slice(0, 160))}`);
    if (!/Delete invoice|حذف الفاتورة|Restore|استرجاع/.test(offered.modal)) ok(`${label}: the invoice window offers no Delete or Restore`); else fail(`${label} was offered Delete/Restore on an invoice`);
    if (!/This invoice is:|هذه الفاتورة:/.test(offered.modal)) ok(`${label}: no revenue-way / origin editor on the invoice`); else fail(`${label} was offered the invoice editors`);

    // what actually works when called directly — one at a time, so a path that navigates
    // (v62MergeBiz reloads the page on success) names itself instead of killing the run
    const before = await snap();
    const thrown = [];
    const CALLS = [
      ['finSetTargets', "finSetTargets(2026)"],
      ['finDelInv', "finDelInv(LIVE)"],
      ['finRestoreInv', "finRestoreInv(DEL)"],
      ['finSetOrigin', "finSetOrigin(LIVE)"],
      ['finSetWay', "window.finSetWay && finSetWay(LIVE)"],
      ['v65Commit', "window.v65Commit && v65Commit()"],
      ['v62AddExclusion', "window.v62AddExclusion && v62AddExclusion()"],
      ['v62MergeBiz', "window.v62MergeBiz && v62MergeBiz('b4','b0')"],
      ['v62UnmergeBiz', "window.v62UnmergeBiz && v62UnmergeBiz('any')"],
      ['v62DismissDup', "window.v62DismissDup && v62DismissDup('a|b')"],
    ];
    for (const [name, expr] of CALLS) {
      try {
        await p.evaluate(async ({ expr, LIVE, DEL }) => {
          const op = window.prompt, oc = window.confirm, oa = window.alert, ol = window.location.reload;
          window.prompt = () => '999999'; window.confirm = () => true; window.alert = () => {};
          try { window.location.reload = () => { throw new Error('reload blocked by probe'); }; } catch (_) {}
          try { eval(expr); await new Promise(r => setTimeout(r, 900)); }
          finally { window.prompt = op; window.confirm = oc; window.alert = oa; try { window.location.reload = ol; } catch (_) {} }
        }, { expr, LIVE: liveNo, DEL: delNo });
      } catch (e) { thrown.push(name + ': ' + String(e.message).split('\n')[0]); }
      const survived = await p.evaluate(() => window.__probeSentinel === 1).catch(() => false);
      if (!survived) { thrown.push(name + ': the page reloaded — that path ran to completion'); await p.waitForTimeout(1500); }
      // re-establish the simulated identity in case a reload reset it
      await asTier(tier, share);
    }
    const after = await snap();
    const changed = diff(before, after);
    if (!changed.length) ok(`${label}: calling all ten write paths directly changed nothing in the database`); else fail(`${label} WROTE to ${JSON.stringify(changed)}`);
    if (!thrown.length) ok(`${label}: every refusal was quiet — nothing threw`); else fail(`${label}: exceptions thrown: ${JSON.stringify(thrown)}`);
  }

  const leaked = await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.PERM-NEW-1').then(r => r.json());
  if (!leaked.length) ok('the armed import batch never landed for any non-editor — the Confirm path itself refuses, not just the button'); else fail('a non-editor committed the pending import batch');

  /* ---------- 4. an admin can still work ---------- */
  await asAdmin();
  const adminWorks = await p.evaluate(async ({ delNo }) => {
    const op = window.prompt, oc = window.confirm, oa = window.alert;
    window.prompt = () => '1234567'; window.confirm = () => true; window.alert = () => {};
    try { finSetTargets(2026); await new Promise(r => setTimeout(r, 1200)); finRestoreInv(delNo); await new Promise(r => setTimeout(r, 1500)); }
    finally { window.prompt = op; window.confirm = oc; window.alert = oa; }
    return true;
  }, { delNo });
  const t2026 = (await fetch(BASE + '/rest/v1/finance_targets').then(r => r.json())).find(t => +t.year === 2026);
  if (t2026 && +t2026.expected_sar === 1234567) ok('an admin can still set a target — the guards do not break real work'); else fail('admin could not set a target: ' + JSON.stringify(t2026));
  const restored = (await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + encodeURIComponent(delNo)).then(r => r.json()))[0];
  if (restored && !restored.deleted_at) ok('…and can still restore a deleted invoice'); else fail('admin could not restore the deleted invoice');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  if (realErrors.length) fail(realErrors.length + ' page error(s): ' + JSON.stringify(realErrors.slice(0, 3))); else ok('no page errors through the run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
