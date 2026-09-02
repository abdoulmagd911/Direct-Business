/* probe-projects-ar.mjs — the Projects board WITH records, in Arabic and English (2026-09-02,
   attack round 12). Until this round the page had never been driven with a project in the
   harness (the mock served nothing for app_projects) and its whole board was English under
   Arabic: title, chips, search, buttons, section headers, empty texts and card labels.
   Asserts: the two seeded projects reach the board (js/35 table-read) in their sections; under
   Arabic none of the board's own words is English and the money/date lines keep their reading
   direction; under English the wording is unchanged; no sideways scroll on a phone.
   Sabotage: revert core-08's Arabic strings → the Arabic check goes red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8306;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const SHOTS = '/tmp/claude-0/-home-user-Direct-Business/c6b2dbb4-5df9-5075-b6c8-d5f2b7cdb838/scratchpad/shots12';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const ENGLISH_WORDS = /\b(Projects|Active|Proposed|Closed|Archived|Total budget|Realized profit|New project|Generate proposal|Search projects|No active projects|No proposed projects|No closed projects|Budget|Spent|Margin|pax)\b/;

async function mkPage(b, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  p.__errors = []; p.on('pageerror', (e) => p.__errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.goto(BASE + '/projects', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(400); const n = await p.evaluate(() => (typeof DB !== 'undefined' && DB.projects) ? DB.projects.length : 0).catch(() => 0); if (n >= 2) break; }
  await p.waitForTimeout(600);
  return p;
}
async function show(p, lang) {
  await p.evaluate((lang) => { LANG = lang; if (typeof applyLang === 'function') applyLang(); current = 'projects'; render(); }, lang);
  await p.waitForTimeout(900);
}
const read = () => ({
  n: (DB.projects || []).length,
  active: document.querySelectorAll('#pcol_Active .lead').length,
  proposed: document.querySelectorAll('#pcol_Proposed .lead').length,
  text: (document.getElementById('view') || {}).innerText || '',
  placeholder: (document.getElementById('pqs') || {}).placeholder || '',
  hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
});

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await mkPage(b, { width: 1366, height: 900 });

  await show(p, 'en');
  let s = await p.evaluate(read);
  await p.screenshot({ path: SHOTS + '/projects-data-en-desk.png' });
  if (s.n === 2 && s.active === 1 && s.proposed === 1) ok('the two seeded projects reached the board from app_projects (1 active, 1 proposed)');
  else fail('projects: DB ' + s.n + ', active cards ' + s.active + ', proposed cards ' + s.proposed);
  if (/No projects yet/.test(s.text)) fail('the "No projects yet" empty card shows while ' + s.n + ' projects are on the page');
  else ok('no empty-state card while projects exist');
  if (/No closed projects/.test(s.text) && s.placeholder === 'Search projects') ok('English board wording unchanged');
  else fail('English board wording changed — placeholder "' + s.placeholder + '" · text: ' + JSON.stringify(s.text.replace(/\s+/g, ' ').slice(0, 400)));

  await show(p, 'ar');
  s = await p.evaluate(read);
  await p.screenshot({ path: SHOTS + '/projects-data-ar-desk.png' });
  // strip data (project names / client names / owner) before looking for English UI words
  const ui = s.text.replace(/Seed project \d|Test Company \d|QA/g, '');
  const leaks = (ui.match(new RegExp(ENGLISH_WORDS.source, 'g')) || []);
  if (!leaks.length && s.placeholder === 'ابحث في المشاريع') ok('Arabic board: no English UI words (title, chips, buttons, sections, empties, card labels)');
  else fail('Arabic board: English still showing — ' + JSON.stringify([...new Set(leaks)]).slice(0, 200) + ' placeholder "' + s.placeholder + '"');
  if (/نشط · 1/.test(s.text) && /مقترح · 1/.test(s.text) && /لا توجد مشاريع مغلقة/.test(s.text)) ok('Arabic section headers carry their counts and the empty text is Arabic');
  else fail('Arabic section headers/empties off');
  const dirOk = await p.evaluate(() => { const c = document.querySelector('#pcol_Active .lead'); if (!c) return false; const d = c.querySelector('[dir="ltr"]'); return !!d; });
  if (dirOk) ok('card dates/money isolated left-to-right inside the RTL card');
  else fail('card dates/money not isolated in RTL');

  const ph = await mkPage(b, { width: 390, height: 844 });
  await show(ph, 'ar');
  const ps = await ph.evaluate(read);
  await ph.screenshot({ path: SHOTS + '/projects-data-ar-phone.png' });
  if (!ps.hOverflow && ps.active === 1) ok('phone Arabic: board renders with no sideways page scroll');
  else fail('phone Arabic: hOverflow=' + ps.hOverflow + ' active cards ' + ps.active);

  const errs = [...p.__errors, ...ph.__errors].filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  if (errs.length) fail(errs.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nprojects-ar OK — the board reads Arabic in Arabic, English in English, with records on it');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
