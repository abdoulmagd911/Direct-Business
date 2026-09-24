/* probe-a-notice-speaks-arabic.mjs — the small notice that pops up after an action ("done", "could not")
   reads Arabic in Arabic and English in English, for every notice text the app can show.

   Fire #256. core-06's toast() is the one box every layer uses after a button press. A survey found
   31 of its texts written in English only, in the core files and js/02 — "Please write what was
   achieved.", "Idle lock enabled · 5 min", "Backup destination set: …", "Offer created from …",
   "Invoice marked paid · …", "Storage full - export a backup!" — and read live in Arabic, the
   achievement form's empty-title notice said "Please write what was achieved." in English. They are
   the last thing a person reads after pressing a button, and every other message class (labels,
   hints, hover words, the seventeen alert() sentences of fire #88) had already been made bilingual.

   Now js/21 owns a notice dictionary (exact texts, fixed heads with a value after them, and two
   patterns with a value in the middle) and wraps the one toast function, so the callers stay as
   they are and no second copy of any message exists.

   What this holds:
     1. AR: the achievement form's empty-title notice reads Arabic on screen (driven);
     2. AR: the backup-destination notice reads Arabic with its value kept (driven, localStorage only);
     3. AR: every notice text in the source resolves to Arabic — the probe scans the core files and
        js/02 for toast('…') literals and asks the page's own v27ToastWord() for each (a text the
        dictionary does not know comes back unchanged and fails this);
     4. EN brake: the same two driven notices read their English exactly;
     5. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): the notice
   dictionary and wrapper removed (the tree before this fire) — fails 1, 2 and 3; 4 stays green.
   Run: node scripts/qa/probe-a-notice-speaks-arabic.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9307 — one mock. */
const PORT = 9307; const BASE = 'http://localhost:' + PORT;
const APP = process.env.APP_DIR || fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');

/* every fixed notice text in the source: toast('…') / toast("…") / toast(`…${…}`) — the fixed head only */
const SRC = [...fs.readdirSync(path.join(APP, 'js/core')).map((f) => 'js/core/' + f), 'js/02-direct-business-cloud-layer-login-shared-c.js'];
const literals = new Set();
for (const f of SRC) {
  const s = fs.readFileSync(path.join(APP, f), 'utf8');
  for (const m of s.matchAll(/\btoast\(\s*(['"`])([A-Z][^'"`]{3,120}?)\1/g)) literals.add(m[2]);
  for (const m of s.matchAll(/\btoast\(\s*`([A-Z][^`$]{3,120})\$\{/g)) literals.add(m[1] + '__VALUE__');
  for (const m of s.matchAll(/\btoast\(\s*'([A-Z][^']{3,120})'\s*\+/g)) literals.add(m[1] + '__VALUE__');
}
const SAMPLES = [...literals].map((t) => t.replace('__VALUE__', 'X'));

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
  await p.goto(BASE + '/reports', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(3500);
  const toastNow = () => p.evaluate(() => { const t = document.getElementById('v19toast'); return t && t.classList.contains('show') ? (t.textContent || '').trim() : null; });
  /* 1. the achievement form, saved with no title */
  await p.evaluate(() => { try { current = 'reports'; openLead = null; render(); } catch (_) {} }); await p.waitForTimeout(1200);
  await p.evaluate(() => { try { rptOpenAch(); } catch (_) {} }); await p.waitForTimeout(900);
  await p.evaluate(() => { try { const t = document.getElementById('rf_title'); if (t) t.value = ''; const btns = [...document.querySelectorAll('#modal .btn.pri, #modal button')]; const save = btns.reverse().find((x) => /save|log|add|حفظ|سجّل|تسجيل|إضافة/i.test(x.textContent)); if (save) save.click(); } catch (_) {} });
  await p.waitForTimeout(400);
  const ach = await toastNow();
  await p.evaluate(() => { try { const x = document.querySelector('#modal .btn.ghost'); if (x) x.click(); if (typeof closeModal === 'function') closeModal(); } catch (_) {} }); await p.waitForTimeout(2600);
  /* 2. the backup destination (localStorage only) */
  await p.evaluate(() => { try { v24SetBackupDest('qa-folder'); } catch (_) {} }); await p.waitForTimeout(400);
  const backup = await toastNow();
  /* 3. every source literal through the page's own word */
  const words = await p.evaluate((samples) => samples.map((s) => [s, (typeof v27ToastWord === 'function') ? v27ToastWord(s) : s]), SAMPLES);
  await ctx.close();
  return { ach, backup, words, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
const AR = /[؀-ۿ]/;

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

console.log('  ' + SAMPLES.length + ' notice texts found in the source; two driven on screen in each language');

(ar.ach && AR.test(ar.ach) && !/Please write/.test(ar.ach))
  ? pass('AR: the achievement form\'s empty-title notice reads Arabic on screen', JSON.stringify(ar.ach))
  : fail('AR: the achievement form\'s empty-title notice reads Arabic on screen', JSON.stringify(ar.ach));

(ar.backup && AR.test(ar.backup) && /qa-folder/.test(ar.backup) && !/Backup destination/.test(ar.backup))
  ? pass('AR: the backup-destination notice reads Arabic with its value kept', JSON.stringify(ar.backup))
  : fail('AR: the backup-destination notice reads Arabic with its value kept', JSON.stringify(ar.backup));

const stuck = ar.words.filter(([s, w]) => !AR.test(w));
(SAMPLES.length >= 25 && stuck.length === 0)
  ? pass('AR: every notice text in the source resolves to Arabic', SAMPLES.length + ' texts')
  : fail('AR: every notice text in the source resolves to Arabic', JSON.stringify({ found: SAMPLES.length, stuck: stuck.slice(0, 6).map((x) => x[0]) }));

(en.ach === 'Please write what was achieved.' || /Please write what was achieved/.test(en.ach || '')) && /Backup destination set: qa-folder/.test(en.backup || '')
  ? pass('EN brake: the same two notices read their English exactly')
  : fail('EN brake: the same two notices read their English exactly', JSON.stringify({ ach: en.ach, backup: en.backup }));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
