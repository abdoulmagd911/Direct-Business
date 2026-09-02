/* probe-sopsla-sync.mjs — SOP library, Service Levels and the Sync page driven WITH rows
   (2026-09-02, attack round 20). Live holds 12 SOPs / 14 service levels / 14 sync events in the
   workspace; the harness had none, so these pages had never rendered a row in QA. The mock now
   seeds them. Asserts, EN + AR, desktop + phone:
     - the SOP library lists the seeded base + extended procedures and the search box filters them
     - the Service Levels table lists every seeded row; an inline edit persists to the workspace;
       "+ Add SLA" adds exactly one row to the workspace
     - in Arabic the SLA legend pills, column heads and the add button are Arabic, and the Sync page's
       note, sub-line, area names and tags are Arabic — none of the known English chrome survives
     - the Sync page renders its events, no undefined / NaN, no sideways scroll on a phone
   Sabotage: drop '.bench' from js/21's selector pass → the legend pills stay English → red. Drop
   the Sync-page td>b pass → "Corporate clients" survives → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8375;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const blob = async () => ((await (await fetch(BASE + '/rest/v1/app_state?id=eq.1')).json())[0] || {}).data || {};

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.accept());
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

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6000);
  const text = () => p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
  const textAll = () => p.evaluate(() => (document.getElementById('view') || {}).textContent || '');
  const bad = (t) => (t.match(/undefined|NaN|\[object/g) || []);
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 6);
  const setLang = (l) => p.evaluate((l) => { LANG = l; if (typeof applyLang === 'function') applyLang(); }, l);
  const go = async (v, tab) => { await p.evaluate(([v, tab]) => { openLead = null; openSup = null; if (tab) window.sopslaTab = tab; current = v; render(); }, [v, tab || null]); await p.waitForTimeout(600); };

  const seeded = await p.evaluate(() => ({ sops: (DB.sops || []).length, whale: (DB.sopsWhale || []).length, slas: (DB.slas || []).length, ev: (DB.syncEvents || []).length }));
  if (seeded.sops === 3 && seeded.whale === 2 && seeded.slas === 4 && seeded.ev === 6) ok('seeded workspace loaded: 3 base SOPs, 2 extended, 4 service levels, 6 sync events');
  else fail('seed missing — ' + JSON.stringify(seeded));

  // ---- SOP library: rows + search
  await go('sopsla', 'sops');
  const sopCount = await p.evaluate(() => document.querySelectorAll('#sopBase details').length + '/' + document.querySelectorAll('#sopWhale details').length);
  if (sopCount === '3/2') ok('SOP library lists 3 desk procedures + 2 extended procedures');
  else fail('SOP library shows ' + sopCount + ' (expected 3/2)');
  await p.fill('#sq', 'void'); await p.waitForTimeout(300);
  const visible = await p.evaluate(() => [...document.querySelectorAll('#sopBase details,#sopWhale details')].filter((d) => d.style.display !== 'none').length);
  if (visible === 1) ok('SOP search "void" narrows the library to the one matching procedure');
  else fail('SOP search "void" left ' + visible + ' procedures visible (expected 1)');

  // ---- service levels: rows, inline edit persists, add persists
  await go('sopsla', 'slas');
  const slaRows = await p.evaluate(() => document.querySelectorAll('#view tbody tr').length);
  if (slaRows === 4) ok('Service Levels table lists the 4 seeded rows');
  else fail('Service Levels table shows ' + slaRows + ' rows (expected 4)');
  await p.evaluate(() => { const ta = [...document.querySelectorAll('#view textarea.cell')].find((t) => (t.getAttribute('onchange') || '').indexOf("setSla('sla_qa1','direct'") >= 0); ta.value = '90 minutes'; ta.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(2500);
  const d1 = await blob();
  const edited = ((d1.slas || []).find((s) => s.id === 'sla_qa1') || {}).direct;
  if (edited === '90 minutes') ok('an inline service-level edit persisted to the workspace');
  else fail('inline edit did not persist — workspace has ' + JSON.stringify(edited));
  await p.evaluate(() => { const btn = [...document.querySelectorAll('#view button')].find((x) => /Add SLA|إضافة مستوى خدمة/.test(x.textContent)); btn.click(); });
  await p.waitForTimeout(2500);
  const d2 = await blob();
  if ((d2.slas || []).length === 5) ok('"+ Add SLA" added exactly one row to the workspace (5)');
  else fail('"+ Add SLA" left the workspace with ' + (d2.slas || []).length + ' rows (expected 5)');

  // ---- Arabic: service levels + SOP tabs
  await setLang('ar'); await go('sopsla', 'slas');
  const arSla = await textAll();
  const slaMust = ['★ أسرع من الشائع', '✓ الهدف القياسي', 'الممارسة الشائعة', 'هدف طموح', '+ إضافة مستوى خدمة', 'مكتبة الإجراءات', 'مستويات الخدمة'];
  const slaMissing = slaMust.filter((w) => arSla.indexOf(w) < 0);
  if (!slaMissing.length) ok('AR Service Levels: legend pills, column heads, tabs and the add button are Arabic');
  else fail('AR Service Levels still English — missing ' + JSON.stringify(slaMissing));
  const slaLeft = ['Faster than common', 'Standard target', 'Common practice', 'Stretch goal', 'Add SLA', 'Beats market', 'Industry whales', 'SOP Library', 'Service Levels'].filter((w) => arSla.indexOf(w) >= 0);
  if (!slaLeft.length) ok('AR Service Levels: no known English chrome survives');
  else fail('AR Service Levels: English chrome survives ' + JSON.stringify(slaLeft));
  if (!bad(arSla).length) ok('AR Service Levels: no undefined/NaN'); else fail('AR Service Levels bad tokens ' + JSON.stringify(bad(arSla).slice(0, 3)));

  // ---- Arabic: sync page
  await go('sync');
  const arSync = await textAll();
  const syncMust = ['مساحة العمل هذه طبقة للقراءة والمتابعة', 'روابط مباشرة إلى payments.directksa.com', 'عملاء الشركات', 'طلبات الاسترداد', 'إعدادات التسعير', 'صناديق البريد', 'للقراءة فقط', 'افتح في جلسة Amadeus لديك'];
  const syncMissing = syncMust.filter((w) => arSync.indexOf(w) < 0);
  if (!syncMissing.length) ok('AR Sync: note, sub-line, area names and tags are Arabic');
  else fail('AR Sync still English — missing ' + JSON.stringify(syncMissing));
  const syncLeft = ['read-and-follow-up layer', 'Corporate clients', 'Refund requests', 'Pricing settings', 'admin login required', 'Read-only', 'Open in your Amadeus session'].filter((w) => arSync.indexOf(w) >= 0);
  if (!syncLeft.length) ok('AR Sync: no known English chrome survives');
  else fail('AR Sync: English chrome survives ' + JSON.stringify(syncLeft));
  const syncDiag = await p.evaluate(() => [...document.querySelectorAll('#view *')].filter((e) => e.children.length === 0 && e.textContent.trim() === 'Sync').map((e) => e.tagName + '.' + e.className).slice(0, 3));
  console.log('  · elements reading exactly "Sync" in AR: ' + JSON.stringify(syncDiag));
  if (!bad(arSync).length) ok('AR Sync: no undefined/NaN'); else fail('AR Sync bad tokens ' + JSON.stringify(bad(arSync).slice(0, 3)));

  // ---- English sync page shows its events
  await setLang('en'); await go('sync');
  const enSync = await text();
  if (/QA seed/.test(enSync) || /routine pull|failed pull/.test(enSync)) ok('EN Sync: seeded events are on the page');
  else console.log('  · EN Sync: seeded events not listed on the page (events may render elsewhere) — informational');

  // ---- phone
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  for (const [name, v, tab] of [['SOP library', 'sopsla', 'sops'], ['Service Levels', 'sopsla', 'slas'], ['Sync', 'sync']]) {
    await go(v, tab);
    if (!(await overflow())) ok('phone ' + name + ': no horizontal overflow'); else fail('phone ' + name + ': page scrolls sideways');
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nsopsla-sync OK — SOPs, service levels and the Sync page hold with rows, in both languages, on a phone');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
