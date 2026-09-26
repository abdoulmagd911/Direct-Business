/* probe-kpis-and-the-danger-light.mjs (2026-09-26, Phase 3 release 3) — the Objectives & KPIs tab draws the database's
   KPI figures and danger light (js/112 over kpi_actuals / kpi_pace), targets are set only where the database allows,
   and Today warns when the company's KPIs are off pace.

   The stand-in serves synthetic kpi_pace / kpi_actuals rows (MOCK_KPI_PACE / MOCK_KPI_ACTUALS) and models the target
   rule (phase3-r3-kpis.sql: an admin, or a manager with Full control on Reports; tested on Postgres by phase3 R3-01).
   Under test:
     1. the tab lists the KPIs with the database's lights — behind, at risk, achieved, not measured — and a KPI with no
        target for the chosen scope reads "No target set";
     2. a KPI nobody measured reads "not measured", never 0 (M53);
     3. a Finance KPI with invoices missing their cost says so beside the figure;
     4. the Overview's "KPIs with data" counts the database's measured KPIs, not this browser's typed numbers;
     5. an employee is offered no "Set target"; a manager with Full control sets one and it is saved; a manager set to
        View on Reports is offered none and a target sent straight to the database is refused;
     6. Today carries "Company KPIs off pace" with the counts, and its link opens Objectives & KPIs;
     7. when the KPI read fails the tab says so and shows no figure, and Today draws no card;
     8. Arabic; 9. no JS errors.
   Sabotage: make js/112's canSetTargets() answer true — check 5 goes red (the employee is offered "Set target").
   PORT = 9371 … 9375 (free when written).                                                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const allErrors = [];
const Y = 'per-2026';
const PACE = [
  { target_id: 'tg-1', kpi_id: 'kpi-1', scope: 'company', member_id: null, department_id: null, period_id: Y, target_value: 100, actual: 20, pct_of_target: 20, light: 'behind', lines_cost_missing: null },
  { target_id: 'tg-2', kpi_id: 'kpi-2', scope: 'company', member_id: null, department_id: null, period_id: Y, target_value: 100, actual: 55, pct_of_target: 55, light: 'at_risk', lines_cost_missing: null },
  { target_id: 'tg-3', kpi_id: 'kpi-3', scope: 'company', member_id: null, department_id: null, period_id: Y, target_value: 10, actual: 12, pct_of_target: 120, light: 'achieved', lines_cost_missing: null },
  { target_id: 'tg-4', kpi_id: 'kpi-4', scope: 'company', member_id: null, department_id: null, period_id: Y, target_value: 33, actual: null, pct_of_target: null, light: 'not_measured', lines_cost_missing: null },
  { target_id: 'tg-19', kpi_id: 'kpi-19', scope: 'company', member_id: null, department_id: null, period_id: Y, target_value: 1000000, actual: 800000, pct_of_target: 80, light: 'on_track', lines_cost_missing: 2 }
];
const ACTUALS = [
  { kpi_id: 'kpi-1', scope: 'company', member_id: null, department_id: null, period_id: Y, actual: 20, rows_counted: 2, lines_cost_missing: null },
  { kpi_id: 'kpi-2', scope: 'company', member_id: null, department_id: null, period_id: Y, actual: 55, rows_counted: 5, lines_cost_missing: null },
  { kpi_id: 'kpi-3', scope: 'company', member_id: null, department_id: null, period_id: Y, actual: 12, rows_counted: 12, lines_cost_missing: null },
  { kpi_id: 'kpi-19', scope: 'company', member_id: null, department_id: null, period_id: Y, actual: 800000, rows_counted: 9, lines_cost_missing: 2 }
];

async function session(role, reports, PORT, { lang = 'en', failKpis = false } = {}) {
  process.env.MOCK_ROLE = role; process.env.MOCK_TASKS_ROSTER = '1';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', tasks: 'full', reports });
  process.env.MOCK_KPI_PACE = JSON.stringify(PACE); process.env.MOCK_KPI_ACTUALS = JSON.stringify(ACTUALS);
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  p.on('pageerror', (e) => allErrors.push(role + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  /* a browser store with a hand-typed KPI "actual" — release 3 must not show it */
  await p.addInitScript(([l]) => { try { localStorage.setItem('dbLang', l); localStorage.setItem('directReportsData_v1', JSON.stringify({ achievements: [], overrides: { 5: '4999', 6: '93' } })); } catch (_) { } }, [lang]);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (failKpis && /\/rest\/v1\/kpi_(pace|actuals)$/.test(u.pathname)) { await r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"QA: kpi read refused"}' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForFunction(() => window.__v112 && window.__v112.loaded, { timeout: 30000 }).catch(() => { });
  await p.waitForTimeout(600);
  return { p, b, srv, BASE };
}
const openKpis = async (p) => { await p.evaluate(() => { openLead = null; current = 'reports'; render(); rptGo('objectives'); }); await p.waitForTimeout(900); };
const row = (p, n) => p.evaluate((n) => { const r = document.querySelector('#view tr[data-v112-kpi="' + n + '"]'); if (!r) return null;
  const l = r.querySelector('[data-v112-light]'); return { light: l && l.getAttribute('data-v112-light'), actual: (r.querySelector('[data-v112-actual]') || {}).innerText, text: r.innerText, set: !!r.querySelector('button[onclick*="v112Target"]') }; }, n);

async function main() {
  // ---------------- employee (Own on Reports) ----------------
  {
    const { p, b, srv } = await session('team_member', 'own', 9371);
    try {
      /* Today first */
      await p.evaluate(() => { openLead = null; current = 'today'; render(); }); await p.waitForTimeout(900);
      const card = await p.evaluate(() => { const c = document.querySelector('.v112-today'); return c ? { n: c.getAttribute('data-v112-today'), t: c.innerText } : null; });
      await p.evaluate(() => v112Open()); await p.waitForTimeout(900);
      const onKpis = await p.evaluate(() => current === 'reports' && !!document.querySelector('#view [data-v112-toolbar]'));
      if (card && card.n === '2' && /Behind/.test(card.t) && /At risk/.test(card.t) && onKpis) ok('6. Today carries "Company KPIs off pace" (1 behind, 1 at risk) and its link opens Objectives & KPIs');
      else fail('6. Today: ' + JSON.stringify({ card, onKpis }));

      await openKpis(p);
      const r1 = await row(p, 1), r2 = await row(p, 2), r3 = await row(p, 3), r4 = await row(p, 4), r5 = await row(p, 5), r19 = await row(p, 19);
      if (r1 && r1.light === 'behind' && r2.light === 'at_risk' && r3.light === 'achieved' && r4.light === 'not_measured' && r5 && r5.light === 'no_target')
        ok('1. the lights are the database\'s — behind, at risk, achieved, not measured — and a KPI with no target reads "No target set"');
      else fail('1. lights: ' + JSON.stringify({ r1, r2: r2 && r2.light, r3: r3 && r3.light, r4: r4 && r4.light, r5: r5 && r5.light }));
      if (r4 && /not measured/i.test(r4.actual) && !/^0$/.test(r4.actual.trim()) && r5 && !/4999/.test(r5.text)) ok('2. a KPI nobody measured reads "not measured", never 0 — and the browser\'s hand-typed number is not shown');
      else fail('2. not measured: ' + JSON.stringify({ r4: r4 && r4.actual, r5: r5 && r5.text }));
      if (r19 && /no cost recorded/.test(r19.text) && /800,000/.test(r19.text)) ok('3. the Finance KPI says some of its invoices have no cost recorded yet');
      else fail('3. finance note: ' + JSON.stringify(r19 && r19.text));
      const setOffered = [r1, r2, r3, r4, r5].some((r) => r && r.set);
      await p.evaluate(() => { current = 'reports'; render(); rptGo('overview'); }); await p.waitForTimeout(800);
      const ov = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
      const m = ov.match(/(\d+)\s*\/\s*30\s*KPIs with data/i) || ov.match(/(\d+)\s*\/\s*30/);
      if (m && m[1] === '4') ok('4. the Overview counts the database\'s 4 measured KPIs — not the browser\'s typed numbers');
      else fail('4. overview: ' + JSON.stringify(m && m[0]) + ' ' + ov.slice(0, 200));
      if (!setOffered) ok('5a. an employee is offered no "Set target"'); else fail('5a. the employee is offered "Set target"');
    } finally { await b.close(); srv.close(); }
  }
  // ---------------- manager with Full on Reports ----------------
  {
    const { p, b, srv, BASE } = await session('manager', 'full', 9372);
    try {
      await openKpis(p);
      const r5 = await row(p, 5);
      await p.evaluate(() => v112Target('kpi-5')); await p.waitForTimeout(500);
      await p.fill('#v112_target', '40'); await p.click('#mSave'); await p.waitForTimeout(1500);
      const saved = await fetch(BASE + '/rest/v1/kpi_targets?select=*').then((r) => r.json()).then((a) => a.find((x) => x.kpi_id === 'kpi-5')).catch(() => null);
      const after = await row(p, 5);
      if (r5 && r5.set && saved && Number(saved.target_value) === 40 && after && after.light === 'not_measured') ok('5b. a manager with Full control on Reports is offered "Set target" and it is saved (KPI 5 now has a target, not measured yet)');
      else fail('5b. manager full: ' + JSON.stringify({ offered: r5 && r5.set, saved, after: after && after.light }));
    } finally { await b.close(); srv.close(); }
  }
  // ---------------- manager on View for Reports ----------------
  {
    const { p, b, srv } = await session('manager', 'view', 9373);
    try {
      await openKpis(p);
      const r1 = await row(p, 1);
      const direct = await p.evaluate(async () => { const r = await fc().from('kpi_targets').insert({ kpi_id: 'kpi-6', scope: 'company', period_id: 'per-2026', target_value: 1 }).select(); return r.error ? 'refused' : 'accepted'; });
      if (r1 && !r1.set && direct === 'refused') ok('5c. a manager set to View on Reports is offered no "Set target", and a target sent straight to the database is refused');
      else fail('5c. manager view: ' + JSON.stringify({ offered: r1 && r1.set, direct }));
    } finally { await b.close(); srv.close(); }
  }
  // ---------------- a failed read ----------------
  {
    const { p, b, srv } = await session('team_member', 'own', 9374, { failKpis: true });
    try {
      await p.evaluate(() => { openLead = null; current = 'today'; render(); }); await p.waitForTimeout(900);
      const card = await p.evaluate(() => !!document.querySelector('.v112-today'));
      await openKpis(p);
      const s = await p.evaluate(() => ({ err: !!document.querySelector('#view [data-v112-state="error"]'), rows: document.querySelectorAll('#view tr[data-v112-kpi]').length }));
      if (!card && s.err && s.rows === 0) ok('7. when the KPI read fails the tab says so and shows no figure, and Today draws no card');
      else fail('7. failed read: ' + JSON.stringify({ card, s }));
    } finally { await b.close(); srv.close(); }
  }
  // ---------------- Arabic ----------------
  {
    const { p, b, srv } = await session('team_member', 'own', 9375, { lang: 'ar' });
    try {
      await openKpis(p);
      const t = await p.evaluate(() => { const v = document.getElementById('view'); const c = v.cloneNode(true); c.querySelectorAll('tr[data-v112-kpi] td:nth-child(2), h3, optgroup').forEach((x) => x.remove());   /* KPI names, objective titles and people\'s own names are data, not this layer\'s words */ document.body.appendChild(c); const s = c.innerText; c.remove(); return s; });
      const latin = t.replace(/KPI|SAR/g, '').match(/[A-Za-z]{4,}/g) || [];
      if (/متأخر/.test(t) && /لا هدف محدد/.test(t) && latin.length === 0) ok('8. in Arabic the tab speaks Arabic (the KPI names are the plan\'s own)');
      else fail('8. Arabic: ' + JSON.stringify(latin.slice(0, 10)));
    } finally { await b.close(); srv.close(); }
  }
  const real = allErrors.filter((e) => !/net::ERR_|TUNNEL_CONNECTION/.test(e));
  if (!real.length) ok('9. no JS errors'); else fail('9. JS errors: ' + JSON.stringify(real.slice(0, 3)));
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nkpis OK — the KPI figures and the danger light are the database\'s, and only those allowed set targets');
}
main().catch((e) => { console.error(e); process.exit(1); });
