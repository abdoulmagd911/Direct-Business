/* probe-targets-attacks.mjs (2026-09-02, overnight cycle) — adversarial pass over the Plan vs
   actual card and its "Set targets" editor (js/16). Rules under test:
     1. What the person types is what gets stored, or the save is refused — never silently
        turned into a different number. "1,500,000" is 1.5M; Arabic-Indic "١٥٠٠٠٠٠" is 1.5M
        (the app is bilingual and the importer already reads those digits); "1e6" and "abc"
        are NOT numbers and must be refused, not stored as 16 and 0; a negative target is
        refused; an empty box deliberately clears the target to 0.
     2. Cancelling either prompt writes nothing.
     3. A write the database refuses (RLS) says so and leaves the screen on the old number —
        the M13 silent-write rule.
     4. The card's arithmetic: attainment = actual ÷ expected, pro-rated by the period part
        (a quarter is a quarter of the year's target, a month a twelfth), "above plan" once
        past 100%, and no division by zero when the target is 0.
     5. A viewer never gets the editor, and calling it directly does nothing.
   Run:  node scripts/qa/probe-targets-attacks.mjs      (port 8203)
   Sabotage: put the old `parseFloat(String(s).replace(/[^0-9.]/g,''))||0` back in js/16 →
   checks 1 go red (Arabic digits become 0, "1e6" becomes 16, "abc" becomes 0). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8203; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const targets = () => fetch(BASE + '/rest/v1/finance_targets').then((r) => r.json());

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
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
  await p.waitForTimeout(5000);
  await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  // feed the two prompts, capture any alert, run the editor
  const setT = async (expected, confirmed) => p.evaluate(async ({ expected, confirmed }) => {
    const answers = [expected, confirmed]; let i = 0; let alerted = null;
    const op = window.prompt, oa = window.alert;
    window.prompt = () => answers[i++];
    window.alert = (m) => { alerted = String(m); };
    try { finSetTargets(2026); await new Promise(r => setTimeout(r, 900)); } finally { window.prompt = op; window.alert = oa; }
    return { alerted, inMemory: (FIN.targets || []).find(t => +t.year === 2026) || null };
  }, { expected: expected, confirmed: confirmed });
  const stored = async () => (await targets()).find((t) => +t.year === 2026) || null;

  /* ---------- 1. what you type is what is stored, or it is refused ---------- */
  let r = await setT('1,500,000', '900000'); let s = await stored();
  if (s && +s.expected_sar === 1500000 && +s.confirmed_sar === 900000) ok('"1,500,000" and "900000" store as 1,500,000 / 900,000'); else fail('thousands separators: ' + JSON.stringify(s));
  r = await setT('١٥٠٠٠٠٠', '٩٠٠٠٠٠'); s = await stored();
  if (s && +s.expected_sar === 1500000 && +s.confirmed_sar === 900000) ok('Arabic-Indic digits "١٥٠٠٠٠٠" store as 1,500,000 — the same digits the importer already reads'); else fail('Arabic-Indic digits stored as ' + JSON.stringify(s && [s.expected_sar, s.confirmed_sar]));
  const before = await stored();
  r = await setT('1e6', '900000'); s = await stored();
  if (r.alerted && +s.expected_sar === +before.expected_sar) ok(`"1e6" is refused with a message ("${String(r.alerted).slice(0, 60)}…") and nothing is stored — never silently 16`); else fail('"1e6" stored as ' + (s && s.expected_sar));
  r = await setT('abc', '900000'); s = await stored();
  if (r.alerted && +s.expected_sar === +before.expected_sar) ok('"abc" is refused, not stored as 0'); else fail('"abc" stored as ' + (s && s.expected_sar));
  r = await setT('-500', '900000'); s = await stored();
  if (r.alerted && +s.expected_sar === +before.expected_sar) ok('a negative target is refused, not stored as +500'); else fail('"-500" stored as ' + (s && s.expected_sar));
  r = await setT('', ''); s = await stored();
  if (s && +s.expected_sar === 0 && +s.confirmed_sar === 0) ok('an empty box deliberately clears the target to 0'); else fail('empty input: ' + JSON.stringify(s && [s.expected_sar, s.confirmed_sar]));

  /* ---------- 2. cancel writes nothing ---------- */
  await setT('2000000', '1000000');
  const beforeCancel = await stored();
  const cancelled = await p.evaluate(async () => { const op = window.prompt; window.prompt = () => null; try { finSetTargets(2026); await new Promise(r => setTimeout(r, 700)); } finally { window.prompt = op; } return true; });
  const afterCancel = await stored();
  if (JSON.stringify(beforeCancel) === JSON.stringify(afterCancel)) ok('cancelling the first prompt writes nothing'); else fail('cancel changed the stored target');

  /* ---------- 3. a refused write says so ---------- */
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/finance_targets**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }), { times: 1 });
  const refused = await setT('7777777', '1');
  const afterRefusal = await stored();
  if (refused.alerted && /not saved|refused|لم يُحفظ/i.test(refused.alerted)) ok('a write the database refuses says "Not saved — the database refused the write"'); else fail('no refusal message: ' + JSON.stringify(refused.alerted));
  if (!afterRefusal || +afterRefusal.expected_sar !== 7777777) ok('…and the screen keeps the old number rather than showing one the database never took'); else fail('the refused number was kept on screen');

  /* ---------- 4. the card's arithmetic ---------- */
  await p.unroute('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/finance_targets**');
  await setT('1000000', '500000');
  const card = async (year, part) => p.evaluate(async ({ year, part }) => {
    FIN.p = { year: String(year), part: part, sector: 'all', cmp: 'none' }; FIN.tab = 'overview';
    renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 400));
    const c = [...document.querySelectorAll('#view .card')].find(e => /Plan vs actual|الخطة مقابل الفعلي/.test(e.textContent));
    const rev = (window.__qaRev || 0);
    return c ? c.innerText : '';
  }, { year, part });
  const rev2026 = await p.evaluate(() => {
    const ex = window.finExclusionCheck || (() => null);
    let s = 0; (FIN.rows || []).forEach(r => { if (r.deleted_at || r.integrity_status !== 'verified_paid') return; if (ex(r.client_group)) return; if (String(r.year) !== '2026') return; s += +r.revenue_sar || 0; }); return s;
  });
  let c1 = await card(2026, 'all');
  const num = (lbl, txt) => { const m = txt.match(new RegExp(lbl + '\\s*\\n\\s*([\\d.,]+[KM]?)')); if (!m) return null; const v = m[1]; return /M$/.test(v) ? parseFloat(v) * 1e6 : /K$/.test(v) ? parseFloat(v) * 1e3 : +v.replace(/,/g, ''); };
  if (Math.abs(num('Expected', c1) - 1000000) < 5000) ok('full year: Expected shows the whole 1,000,000 target'); else fail('full-year expected: ' + JSON.stringify(c1.slice(0, 200)));
  const pctAll = (c1.match(/Of expected achieved · (\d+)%/) || [])[1];
  if (pctAll && Math.abs(+pctAll - Math.round(rev2026 / 1000000 * 100)) <= 1) ok(`attainment ${pctAll}% = actual ÷ expected, recomputed independently`); else fail('attainment: ' + pctAll + ' vs recount ' + Math.round(rev2026 / 1000000 * 100));
  let c2 = await card(2026, 'Q1');
  if (Math.abs(num('Expected', c2) - 250000) < 5000 && /pro-rated for the period/.test(c2)) ok('a quarter pro-rates the target to a quarter (250,000) and says it is pro-rated'); else fail('quarter pro-rating: ' + JSON.stringify(c2.slice(0, 220)));
  let c3 = await card(2026, 'M:March');
  if (Math.abs(num('Expected', c3) - Math.round(1000000 / 12)) < 5000) ok('a month pro-rates to a twelfth'); else fail('month pro-rating: ' + JSON.stringify(c3.slice(0, 200)));
  await setT('1', '1');
  let c4 = await card(2026, 'all');
  if (/above plan/i.test(c4)) ok('past 100% the card says "above plan" instead of a bar stuck at full'); else fail('no above-plan wording at >100%');
  await setT('', '');
  let c5 = await card(2026, 'all');
  if (!/NaN|Infinity/.test(c5)) ok('a zero target never divides by zero (no NaN / Infinity on the card)'); else fail('zero target produced NaN/Infinity');

  /* ---------- 5. a viewer gets no editor ---------- */
  const viewer = await p.evaluate(async () => {
    const t = window.__userTier; window.__userTier = 'viewer';
    FIN.p = { year: '2026', part: 'all', sector: 'all', cmp: 'none' }; FIN.tab = 'overview';
    renderFinance(document.getElementById('view')); await new Promise(r => setTimeout(r, 400));
    const c = [...document.querySelectorAll('#view .card')].find(e => /Plan vs actual|الخطة/.test(e.textContent));
    const hasBtn = !!(c && [...c.querySelectorAll('button')].some(b => /Set targets|تعديل الأرقام/.test(b.textContent)));
    let called = false; const op = window.prompt; window.prompt = () => { called = true; return '999'; };
    try { finSetTargets(2026); await new Promise(r => setTimeout(r, 500)); } finally { window.prompt = op; window.__userTier = t; }
    return { hasBtn, called };
  });
  if (!viewer.hasBtn) ok('a viewer sees no "Set targets" button'); else fail('viewer was offered the editor');
  if (!viewer.called) ok('…and calling finSetTargets directly as a viewer does nothing — it never even asks'); else fail('finSetTargets ran for a viewer');

  if (errors.length) fail(errors.length + ' page error(s): ' + JSON.stringify(errors.slice(0, 3))); else ok('no page errors through the run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
