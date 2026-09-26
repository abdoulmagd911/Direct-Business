/* probe-achievements-in-the-database.mjs (2026-09-26, Phase 3 release 2) — the Reports page's achievements
   live in the company database now (js/111), with proofs, drafts and a one-press move from the browser.

   The stand-in models report_entries / evidence_files / the "proofs" store with the rules that matter
   (scripts/sql/phase3-r2-achievements.sql + release 1's guards; tested on Postgres by scripts/qa/phase3 R2-01..04).
   Under test, as an employee on OWN WORK for Reports:
     1. logging an achievement saves it to the database, shows it on the list, and does NOT write it into this
        browser's store;
     2. no kind chosen → refused in words, nothing saved;
     3. crediting a colleague → the database's sentence, nothing saved;
     4. a number against the KPI calculated from Finance → refused in words;
     5. a proof attached while logging lands in the proofs store and on the line ("📎 1 proof"), and the proofs
        window lists it;
     6. a DRAFT (a task closed by a helper) reads "Draft" with Finalize; Finalize makes it final;
     7. this browser's old achievements: the card counts them, one press moves them (a colleague's line is kept,
        credited to nobody in particular, the name kept in the text), a second press adds nothing, and the
        browser's own copy is kept and marked moved;
   as someone on VIEW:
     8. no "Log achievement", no move card, and a write sent straight to the database is refused;
   9. in Arabic the card and the form speak Arabic; 10. no JS errors.
   Sabotage: make js/111's canWork() answer true always — check 8 goes red (View is offered the move card).
   PORT = 9366 … 9368 (free when written).                                                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const allErrors = [];
const LOCAL = { achievements: [
  { id: 'a_local_1', date: '2026-08-12', member: 'QA Test Account', title: 'Old browser win', desc: 'kept in one browser', objective: '', kpi: '', value: '', client: '' },
  { id: 'a_local_2', date: '2026-08-20', member: 'Colleague Seed', title: 'A colleague’s old win', desc: '', objective: '', kpi: '', value: '', client: '' }
], overrides: {} };

async function session(level, PORT, { lang = 'en', local = false } = {}) {
  process.env.MOCK_ROLE = 'team_member'; process.env.MOCK_TASKS_ROSTER = '1';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', tasks: 'full', reports: level });
  process.env.MOCK_REPORTS_SEED = JSON.stringify([{ id: 're-draft-1', title: 'Closed by a helper', member_id: 'tm-qa', source: 'task', source_id: 'task-qa', status: 'draft', entry_date: '2026-09-12' }]);
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  p.on('pageerror', (e) => allErrors.push(level + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript(([l, seed]) => { try { localStorage.setItem('dbLang', l); if (seed) localStorage.setItem('directReportsData_v1', JSON.stringify(seed)); } catch (_) { } }, [lang, local ? LOCAL : null]);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
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
  await p.evaluate(() => { openLead = null; current = 'reports'; render(); });
  await p.waitForFunction(() => window.__v111 && window.__v111.loaded, { timeout: 30000 }).catch(() => { });
  await p.evaluate(() => { try { rptGo('achievements'); } catch (_) { } });
  await p.waitForTimeout(900);
  return { p, b, srv, BASE };
}
const db = (BASE, t) => fetch(BASE + '/rest/v1/' + t + '?select=*').then((r) => r.json()).catch(() => []);
const toastText = (p) => p.evaluate(() => [...document.querySelectorAll('.toast, #toast, [class*="toast"]')].map((x) => x.innerText).join(' | '));
const msg = (p) => p.evaluate(() => (document.getElementById('v111_msg') || {}).textContent || '');
const fillForm = (p, f) => p.evaluate((f) => {
  const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  set('v111_date', f.date || '2026-09-15'); set('v111_title', f.title); set('v111_cat', f.cat); if (f.member !== undefined) set('v111_member', f.member);
  set('v111_kpi', f.kpi); set('v111_value', f.value);
}, f);
const saveBtn = (p) => p.evaluate(() => document.getElementById('mSave').click());

async function main() {
  // ---------------- OWN employee ----------------
  {
    const { p, b, srv, BASE } = await session('own', 9366, { local: true });
    try {
      const before = (await db(BASE, 'report_entries')).length;
      await p.evaluate(() => rptOpenAch()); await p.waitForTimeout(500);
      await fillForm(p, { title: 'Signed a new corporate account', cat: 'cat-deals' });
      await p.setInputFiles('#v111_files', { name: 'contract.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 qa') });
      await saveBtn(p); await p.waitForTimeout(1800);
      const rows = await db(BASE, 'report_entries'); const files = await db(BASE, 'evidence_files');
      const mine = rows.find((r) => r.title === 'Signed a new corporate account');
      const listed = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
      const local = await p.evaluate(() => JSON.parse(localStorage.getItem('directReportsData_v1') || '{}'));
      const inLocal = (local.achievements || []).some((a) => a.title === 'Signed a new corporate account');
      if (mine && rows.length === before + 1 && /Signed a new corporate account/.test(listed) && !inLocal) ok('1. logging an achievement saves it to the database and lists it — and does not write it into this browser\'s store');
      else fail('1. log: ' + JSON.stringify({ saved: !!mine, n: rows.length - before, listed: /Signed a new/.test(listed), inLocal }));
      const proof = files.find((f) => mine && f.entry_id === mine.id);
      if (proof && /📎 1 proof/.test(listed)) ok('5a. the proof attached while logging is in the proofs store and on the line ("📎 1 proof")');
      else fail('5a. proof: ' + JSON.stringify({ file: !!proof, line: (listed.match(/📎[^\n]*/) || [])[0] }));
      await p.evaluate((id) => v111Proofs(id), mine && mine.id); await p.waitForTimeout(700);
      const plist = await p.evaluate(() => { const u = document.querySelector('#modal [data-v111-proofs]'); return u ? u.innerText : null; });
      if (plist && /contract\.pdf/.test(plist)) ok('5b. the proofs window lists it'); else fail('5b. proofs window: ' + JSON.stringify(plist));
      await p.evaluate(() => closeModal());

      await p.evaluate(() => rptOpenAch()); await p.waitForTimeout(400);
      await fillForm(p, { title: 'No kind chosen', cat: '' }); await saveBtn(p); await p.waitForTimeout(700);
      const m2 = await msg(p); const n2 = (await db(BASE, 'report_entries')).filter((r) => r.title === 'No kind chosen').length;
      if (/kind of achievement/i.test(m2) && n2 === 0) ok('2. no kind chosen → refused in words, nothing saved'); else fail('2. ' + JSON.stringify({ m2, n2 }));

      await fillForm(p, { title: 'Credit to a colleague', cat: 'cat-deals', member: 'tm-colleague' }); await saveBtn(p); await p.waitForTimeout(900);
      const m3 = await msg(p); const n3 = (await db(BASE, 'report_entries')).filter((r) => r.title === 'Credit to a colleague').length;
      if (/Only a manager or the department head can credit/.test(m3) && n3 === 0) ok('3. crediting a colleague → the database\'s sentence, nothing saved'); else fail('3. ' + JSON.stringify({ m3, n3 }));

      await fillForm(p, { title: 'Money typed', cat: 'cat-deals', member: 'tm-qa', kpi: '19', value: '50000' }); await saveBtn(p); await p.waitForTimeout(900);
      const m4 = await msg(p);
      if (/calculated from the system \(Finance\)/.test(m4)) ok('4. a number against the KPI calculated from Finance → refused in words'); else fail('4. ' + JSON.stringify(m4));
      await p.evaluate(() => closeModal());

      const draft = await p.evaluate(() => { const r = [...document.querySelectorAll('#view tr')].find((t) => /Closed by a helper/.test(t.innerText)); return r ? { draft: !!r.querySelector('[data-v111-draft]'), btn: !!r.querySelector('button[onclick*="v111Finalize"]') } : null; });
      await p.evaluate(() => v111Finalize('re-draft-1')); await p.waitForTimeout(1500);
      const fin = (await db(BASE, 'report_entries')).find((r) => r.id === 're-draft-1');
      if (draft && draft.draft && draft.btn && fin && fin.status === 'final') ok('6. a draft reads "Draft" with Finalize; Finalize makes it final');
      else fail('6. draft: ' + JSON.stringify({ draft, status: fin && fin.status }));

      await p.evaluate(() => { current = 'reports'; render(); }); await p.waitForTimeout(700);
      const card = await p.evaluate(() => { const c = document.querySelector('[data-v111-move]'); return c ? c.getAttribute('data-v111-move') : null; });
      const n0 = (await db(BASE, 'report_entries')).length;
      await p.evaluate(() => v111MoveBrowser()); await p.waitForTimeout(2500);
      const afterMove = await db(BASE, 'report_entries');
      const moved = afterMove.filter((r) => /^browser:a_local_/.test(r.import_key || ''));
      const col = moved.find((r) => r.import_key === 'browser:a_local_2');
      await p.evaluate(() => v111MoveBrowser()); await p.waitForTimeout(1500);
      const again = (await db(BASE, 'report_entries')).length;
      const kept = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('directReportsData_v1') || '{}'); return { n: (d.achievements || []).length, moved: Object.keys(d.movedToDb || {}).length }; });
      if (card === '2' && moved.length === 2 && afterMove.length === n0 + 2 && col && col.member_id == null && /Logged for: Colleague Seed/.test(col.text_en || '') && again === afterMove.length && kept.n === 2 && kept.moved === 2)
        ok('7. the card counts 2; one press moves them (the colleague\'s line credited to nobody, name kept), a second press adds nothing, and this browser keeps its copy marked moved');
      else fail('7. move: ' + JSON.stringify({ card, moved: moved.length, added: afterMove.length - n0, col: col && { m: col.member_id, t: col.text_en }, again: again - afterMove.length, kept }));
    } finally { await b.close(); srv.close(); }
  }

  // ---------------- VIEW ----------------
  {
    const { p, b, srv } = await session('view', 9367, { local: true });
    try {
      const s = await p.evaluate(() => { const v = document.getElementById('view'); const btn = [...v.querySelectorAll('button')].find((x) => /Log achievement/.test(x.innerText) && x.offsetParent !== null); return { log: !!btn, card: !!v.querySelector('[data-v111-move]') }; });
      const direct = await p.evaluate(async () => { const r = await fc().from('report_entries').insert({ period_id: 'per-2026-09', department_id: 'dep-commercial', section: 'achievement', category_id: 'cat-other', title: 'sneak' }).select(); return r.error ? 'refused' : 'accepted'; });
      if (!s.log && !s.card && direct === 'refused') ok('8. on View: no "Log achievement", no move card, and a write sent straight to the database is refused');
      else fail('8. view: ' + JSON.stringify({ s, direct }));
    } finally { await b.close(); srv.close(); }
  }

  // ---------------- Arabic ----------------
  {
    const { p, b, srv } = await session('own', 9368, { lang: 'ar', local: true });
    try {
      await p.evaluate(() => { current = 'reports'; render(); }); await p.waitForTimeout(700);
      const card = await p.evaluate(() => { const c = document.querySelector('[data-v111-move]'); return c ? c.innerText : ''; });
      await p.evaluate(() => rptOpenAch()); await p.waitForTimeout(500);
      /* the objective / KPI option lists are the page's own titles (core-10's data — some have no Arabic yet);
         this check is about the words this layer writes */
      const form = await p.evaluate(() => { const m = document.getElementById('modal'); if (!m) return ''; const c = m.cloneNode(true);
        c.querySelectorAll('#v111_obj option, #v111_kpi option, datalist').forEach((o) => o.remove()); document.body.appendChild(c); const t = c.innerText; c.remove(); return t; });
      const latin = (card + ' ' + form).replace(/KPI|PDF/g, '').replace(/QA Test Account|Colleague Seed/g, '').match(/[A-Za-z]{4,}/g) || [];
      if (/ما زال هذا المتصفح/.test(card) && /نوع الإنجاز/.test(form) && latin.length <= 2) ok('9. in Arabic the move card and the form speak Arabic');
      else fail('9. Arabic: ' + JSON.stringify({ card: card.slice(0, 60), latin: latin.slice(0, 10) }));
    } finally { await b.close(); srv.close(); }
  }

  const real = allErrors.filter((e) => !/net::ERR_|TUNNEL_CONNECTION/.test(e));
  if (!real.length) ok('10. no JS errors'); else fail('10. JS errors: ' + JSON.stringify(real.slice(0, 3)));
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nachievements OK — the Reports page\'s achievements and proofs are the company\'s, and the database decides who changes them');
}
main().catch((e) => { console.error(e); process.exit(1); });
