/* probe-a-question-before-the-act-speaks-arabic.mjs — the yes/no question the app asks before its
   most consequential actions ("Delete this invoice?", "Archive this booking?", "Reset all data …?")
   reads Arabic in Arabic and English in English, in the app's own box.

   Fire #258. The surveys of fires #254–#257 covered labels, hints, hover words, notices, reports
   and prompts; the questions asked through askInPage / pfConfirm were not in any of their patterns.
   Twelve of them are English only, in the core files: "Delete this achievement?", "Delete this
   booking?", "Delete this invoice?", "Delete this bundle template?", "Delete this tagged backup?",
   "Archive this invoice? (soft delete — restorable)", "Archive this booking? …", "Archive <name>",
   "Archive project <name>", "Create credit note against <ref>", "Reset all data to the seeded
   version? …", "Import this file? …". Read live in Arabic, the Settings reset asked its question in
   English. These are the words in front of the Confirm button that deletes something.

   Now js/21 owns them (exact texts and fixed heads) and wraps pfConfirm — the one box every such
   question goes through — late, once js/57 has defined it.

   What this holds:
     1. AR: the Settings reset question reads Arabic in the box (driven, then cancelled);
     2. AR: the achievement delete question reads Arabic in the box (driven, then cancelled);
     3. AR: every such question in the source resolves to Arabic — the probe scans js/ for
        askInPage('…') / pfConfirm('…') literals on lines with no language switch and asks the
        page's own v27ConfirmWord() for each;
     4. EN brake: the same two questions read their English exactly;
     5. cancelling really cancelled — after both boxes the data on screen is unchanged;
     6. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): the dictionary and
   wrapper absent (the tree before this fire) — fails 1, 2 and 3; 4, 5 stay green.
   Run: node scripts/qa/probe-a-question-before-the-act-speaks-arabic.mjs                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9311 — one mock. */
const PORT = 9311; const BASE = 'http://localhost:' + PORT;
const APP = process.env.APP_DIR || fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');

const files = [];
for (const d of ['js', 'js/core']) for (const f of fs.readdirSync(path.join(APP, d))) if (f.endsWith('.js')) files.push(d + '/' + f);
const lits = new Set();
for (const f of files) {
  if (/^js\/21-/.test(f)) continue;
  for (const line of fs.readFileSync(path.join(APP, f), 'utf8').split('\n')) {
    if (/\bL\(|fl\(|isAr|LANG|_ar\b|ar\?/.test(line)) continue;
    for (const m of line.matchAll(/\b(askInPage|pfConfirm)\(\s*(['"`])([A-Z][^'"`]{3,160})\2/g)) lits.add(m[3]);
  }
}
const SAMPLES = [...lits].map((t) => /\s$/.test(t) ? t + 'X' : t);

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method(); const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(4000);
  const before = await p.evaluate(() => ({ biz: (DB.businesses || []).length, off: (DB.offers || []).length, bk: (DB.bookings || []).length }));
  /* the question is the card's first block; the second holds the two buttons */
  const boxText = () => p.evaluate(() => { const d = document.getElementById('pfConfirmBox'); const t = d && d.querySelector('#pfConfirmBox > div > div:first-child'); return t ? t.textContent.trim() : null; });
  const cancel = async () => { await p.evaluate(() => { try { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); } catch (_) {} }); await p.waitForTimeout(400); };
  /* 1. the Settings reset */
  await p.evaluate(() => { try { resetData(); } catch (_) {} }); await p.waitForTimeout(500);
  const reset = await boxText(); await cancel();
  /* 2. an achievement delete (no such id — the question is asked before anything is looked up) */
  await p.evaluate(() => { try { rptDelAch('qa-no-such-achievement'); } catch (_) {} }); await p.waitForTimeout(500);
  const del = await boxText(); await cancel();
  const after = await p.evaluate(() => ({ biz: (DB.businesses || []).length, off: (DB.offers || []).length, bk: (DB.bookings || []).length, box: !!document.getElementById('pfConfirmBox') }));
  const words = await p.evaluate((samples) => samples.map((s) => [s, (typeof v27ConfirmWord === 'function') ? v27ConfirmWord(s) : s]), SAMPLES);
  await ctx.close();
  return { reset, del, before, after, words, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
const AR = /[؀-ۿ]/;

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

console.log('  ' + SAMPLES.length + ' questions found in the source; two asked and cancelled in each language');

(ar.reset && AR.test(ar.reset) && !/Reset all data/.test(ar.reset))
  ? pass('AR: the Settings reset question reads Arabic in the box', JSON.stringify(ar.reset.slice(0, 60)))
  : fail('AR: the Settings reset question reads Arabic in the box', JSON.stringify(ar.reset));

(ar.del && AR.test(ar.del) && !/Delete this/.test(ar.del))
  ? pass('AR: the achievement delete question reads Arabic in the box', JSON.stringify(ar.del))
  : fail('AR: the achievement delete question reads Arabic in the box', JSON.stringify(ar.del));

const stuck = ar.words.filter(([, w]) => !AR.test(w));
(SAMPLES.length >= 8 && stuck.length === 0)
  ? pass('AR: every such question in the source resolves to Arabic', SAMPLES.length + ' texts')
  : fail('AR: every such question in the source resolves to Arabic', JSON.stringify({ found: SAMPLES.length, stuck: stuck.slice(0, 6).map((x) => x[0]) }));

(en.reset && /^Reset all data to the seeded version\?/.test(en.reset) && en.del === 'Delete this achievement?')
  ? pass('EN brake: the same two questions read their English exactly')
  : fail('EN brake: the same two questions read their English exactly', JSON.stringify({ reset: en.reset, del: en.del }));

(JSON.stringify(ar.before) === JSON.stringify({ biz: ar.after.biz, off: ar.after.off, bk: ar.after.bk }) && !ar.after.box && JSON.stringify(en.before) === JSON.stringify({ biz: en.after.biz, off: en.after.off, bk: en.after.bk }))
  ? pass('cancelling really cancelled — the data on screen is unchanged and no box is left open')
  : fail('cancelling really cancelled — the data on screen is unchanged and no box is left open', JSON.stringify({ before: ar.before, after: ar.after }));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
