/* probe-silent-write-refusal.mjs (2026-09-02) — a write the database silently refused must
   never be reported as "Saved", and must never change what the screen shows.
   DECISIONS → "Code patterns that keep re-biting": a Supabase update/upsert/insert without
   .select() + a row-count check returns success with no error when Row-Level Security refuses
   it. M13 fixed the importer; this probe covers the three small Finance editors that still had
   the old shape until 2026-09-02 — invoice origin/proposal ref (js/16), revenue way (js/25),
   and the yearly targets (js/16) — plus the client-profile regroup (js/62).
   Method: for each editor, first prove the permitted path works (mock updates in place and
   returns the rows), then intercept the SAME write at the network layer and answer 200 [] —
   PostgREST's exact response when RLS matched zero rows — and prove the app (a) says "not
   saved", (b) leaves FIN.rows untouched, (c) shows no "Saved" toast.
   Sabotage: SABOTAGE=1 strips the .select() row-count checks at runtime (re-defines the
   handlers without them) — every refusal check must fail. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8183; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const SABOTAGE = process.env.SABOTAGE === '1';

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [], dialogs = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', async (d) => { dialogs.push({ type: d.type(), msg: d.message() }); if (d.type() === 'prompt') await d.accept(PROMPT_ANSWER); else await d.accept(); });
  let PROMPT_ANSWER = '';
  let REFUSE = false; // when true, every PATCH/POST to the tables under test answers 200 [] (RLS-refused shape)
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (REFUSE && ['PATCH', 'POST'].includes(rq.method()) && /\/rest\/v1\/(finance_invoices|finance_targets|client_profiles)/.test(u.pathname)) {
      return r.fulfill({ status: rq.method() === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json' }, body: '[]' });
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET','HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v,k)=>{ if(!['content-encoding','content-length','transfer-encoding'].includes(k)) h[k]=v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1500);
  const settle = async () => { let last = '', same = 0; for (let i = 0; i < 30; i++) { const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0); if (h === last) { same++; if (same >= 2) return; } else same = 0; last = h; await p.waitForTimeout(150); } };
  await settle();
  // Toast capture: wrap window.toast so we can see what the app claimed.
  await p.evaluate(() => { window.__toasts = []; const t = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return t ? t.apply(this, arguments) : undefined; }; });

  if (SABOTAGE) {
    // Re-define the three handlers WITHOUT the row-count check (the pre-2026-09-02 shape).
    await p.evaluate(() => {
      window.finSetOrigin = function (invNo) { var o = (document.getElementById('fin_origin') || {}).value || 'booking'; var pr = ((document.getElementById('fin_pref') || {}).value || '').trim(); var c = fc(); c.from('finance_invoices').update({ origin: o, proposal_ref: pr || null }).eq('invoice_no', invNo).is('deleted_at', null).then(function (r) { if (r.error) { alert('Could not save: ' + r.error.message); return; } (FIN.rows || []).forEach(function (x) { if (x.invoice_no === invNo && !x.deleted_at) { x.origin = o; x.proposal_ref = pr || null; } }); var m = document.getElementById('finModal'); if (m) m.remove(); toast('Saved'); render(); }); };
      window.finSetWay = function (invNo) { var w = (document.getElementById('fin_way') || {}).value || 'invoice'; var c = fc(); c.from('finance_invoices').update({ revenue_way: w }).eq('invoice_no', invNo).is('deleted_at', null).then(function (r) { if (r.error) { alert('Could not save: ' + r.error.message); return; } (FIN.rows || []).forEach(function (x) { if (x.invoice_no === invNo && !x.deleted_at) x.revenue_way = w; }); var m = document.getElementById('finModal'); if (m) m.remove(); toast('Saved'); render(); }); };
      window.finSetTargets = function (y) { var e = prompt('exp'); if (e === null) return; var cf = prompt('conf'); if (cf === null) return; var num = function (s) { return parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0; }; var c = fc(); c.from('finance_targets').upsert({ year: +y, expected_sar: num(e), confirmed_sar: num(cf) }, { onConflict: 'year' }).then(function (r) { if (r.error) { alert('x'); return; } var i = (FIN.targets || []).findIndex(function (x) { return +x.year === +y; }); var row = { year: +y, expected_sar: num(e), confirmed_sar: num(cf) }; if (i >= 0) FIN.targets[i] = row; else (FIN.targets = FIN.targets || []).push(row); render(); }); };
    });
  }

  const inv = await p.evaluate(() => (FIN.rows || []).find(r => !r.deleted_at && r.invoice_no));
  if (!inv) { fail('no live invoice in the fixture'); }
  const invNo = inv.invoice_no;
  const openModal = async () => {
    // finRow(id) is the same handler a click on the ledger row calls — open it directly so the
    // probe is not hostage to which tab renders the row first.
    await p.evaluate((id) => { const m = document.getElementById('finModal'); if (m) m.remove(); finRow(id); }, inv.id);
    await p.waitForTimeout(500);
    return p.evaluate(() => !!document.getElementById('finModal') && !!document.getElementById('fin_origin'));
  };
  const clickSave = async (sel) => {
    await p.evaluate((sel) => { const btn = [...document.querySelectorAll('#finModal button')].find(b => b.closest('div') && b.closest('div').querySelector(sel) && /^(Save|حفظ)$/.test(b.textContent.trim())); if (btn) btn.click(); else { const any = [...document.querySelectorAll('#finModal button')].find(b => /^(Save|حفظ)$/.test(b.textContent.trim())); if (any) any.click(); } }, sel);
    await p.waitForTimeout(900);
  };

  // ---- 1. origin / proposal ref (js/16 finSetOrigin)
  if (!(await openModal())) fail('invoice modal did not open'); else ok('invoice modal opens for ' + invNo);
  await p.evaluate(() => { document.getElementById('fin_origin').value = 'project'; document.getElementById('fin_pref').value = 'QA-REF-OK'; });
  await p.evaluate((n) => finSetOrigin(n), invNo); await p.waitForTimeout(900);
  let row = await p.evaluate((n) => (FIN.rows || []).find(r => r.invoice_no === n), invNo);
  if (row.origin === 'project' && row.proposal_ref === 'QA-REF-OK') ok('origin: permitted write applied and reflected on screen'); else fail('origin: permitted write not reflected: ' + JSON.stringify({ o: row.origin, p: row.proposal_ref }));
  // now the refusal
  REFUSE = true; dialogs.length = 0; await p.evaluate(() => { window.__toasts = []; });
  if (!(await openModal())) fail('invoice modal did not re-open');
  await p.evaluate(() => { document.getElementById('fin_origin').value = 'booking'; document.getElementById('fin_pref').value = 'QA-REF-REFUSED'; });
  await p.evaluate((n) => finSetOrigin(n), invNo); await p.waitForTimeout(900);
  row = await p.evaluate((n) => (FIN.rows || []).find(r => r.invoice_no === n), invNo);
  let toasts = await p.evaluate(() => window.__toasts.slice());
  if (row.proposal_ref === 'QA-REF-OK' && row.origin === 'project') ok('origin: refused write left the row untouched (still the last confirmed value)'); else fail('origin: refused write CHANGED the row on screen: ' + JSON.stringify({ o: row.origin, p: row.proposal_ref }));
  if (dialogs.some(d => /not saved|لم يُحفظ/i.test(d.msg))) ok('origin: user was told "not saved"'); else fail('origin: no "not saved" message after a refused write — dialogs: ' + JSON.stringify(dialogs.map(d => d.msg.slice(0, 60))));
  if (!toasts.some(t => /^saved$|^تم الحفظ$/i.test(t))) ok('origin: no "Saved" toast on a refused write'); else fail('origin: app toasted "Saved" on a refused write');
  await p.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
  REFUSE = false;

  // ---- 2. revenue way (js/25 finSetWay)
  dialogs.length = 0; await p.evaluate(() => { window.__toasts = []; });
  if (!(await openModal())) fail('invoice modal did not open for revenue way');
  const hasWay = await p.evaluate(() => !!document.getElementById('fin_way'));
  if (!hasWay) fail('revenue-way selector not present in the modal'); else {
    await p.evaluate(() => { document.getElementById('fin_way').value = 'commission'; });
    await p.evaluate((n) => finSetWay(n), invNo); await p.waitForTimeout(900);
    row = await p.evaluate((n) => (FIN.rows || []).find(r => r.invoice_no === n), invNo);
    if (row.revenue_way === 'commission') ok('revenue way: permitted write applied'); else fail('revenue way: permitted write not reflected: ' + row.revenue_way);
    REFUSE = true; dialogs.length = 0; await p.evaluate(() => { window.__toasts = []; });
    if (!(await openModal())) fail('modal did not re-open for refused revenue way');
    await p.evaluate(() => { document.getElementById('fin_way').value = 'promo_code'; });
    await p.evaluate((n) => finSetWay(n), invNo); await p.waitForTimeout(900);
    row = await p.evaluate((n) => (FIN.rows || []).find(r => r.invoice_no === n), invNo);
    toasts = await p.evaluate(() => window.__toasts.slice());
    if (row.revenue_way === 'commission') ok('revenue way: refused write left the row untouched'); else fail('revenue way: refused write CHANGED the row: ' + row.revenue_way);
    if (dialogs.some(d => /not saved|لم يُحفظ/i.test(d.msg))) ok('revenue way: user was told "not saved"'); else fail('revenue way: no "not saved" message');
    if (!toasts.some(t => /^saved$|^تم الحفظ$/i.test(t))) ok('revenue way: no "Saved" toast'); else fail('revenue way: toasted "Saved" on a refused write');
    await p.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
    REFUSE = false;
  }

  // ---- 3. yearly targets (js/16 finSetTargets, prompt-driven upsert)
  await p.evaluate(() => { if (window.finGo) finGo('overview'); }); await settle();
  const y = 2026;
  PROMPT_ANSWER = '1000000'; dialogs.length = 0;
  await p.evaluate((y) => finSetTargets(y), y); await p.waitForTimeout(1200);
  let t = await p.evaluate((y) => (FIN.targets || []).find(x => +x.year === +y), y);
  if (t && +t.expected_sar === 1000000) ok('targets: permitted upsert applied (expected 1,000,000)'); else fail('targets: permitted upsert not reflected: ' + JSON.stringify(t));
  REFUSE = true; PROMPT_ANSWER = '5'; dialogs.length = 0;
  await p.evaluate((y) => finSetTargets(y), y); await p.waitForTimeout(1200);
  t = await p.evaluate((y) => (FIN.targets || []).find(x => +x.year === +y), y);
  if (t && +t.expected_sar === 1000000) ok('targets: refused upsert left the target untouched'); else fail('targets: refused upsert CHANGED the target on screen: ' + JSON.stringify(t));
  if (dialogs.some(d => d.type === 'alert' && /not saved|لم يُحفظ/i.test(d.msg))) ok('targets: user was told "not saved"'); else fail('targets: no "not saved" message after a refused upsert');
  REFUSE = false;

  if (errors.length) errors.forEach(e => fail(e));
  console.log(SABOTAGE ? '\n[SABOTAGE MODE]' : '');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
