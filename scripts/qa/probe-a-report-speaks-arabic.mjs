/* probe-a-report-speaks-arabic.mjs — a report of what happened ("Could not delete: …", "Backup: …",
   "Export failed: …") and a question the app asks in its own box ("Set a passphrase …", "Move to
   dunning stage?", "Copy the offer:") read Arabic in Arabic and English in English.

   Fire #257. probe-messages-bilingual (fire #88) reads bare alert('…') literals and found seventeen;
   twenty more sentences slipped past its regex because they are not bare: a fixed head with the
   detail after it — alert('Could not delete: '+e), alert('Backup: '+msg), alert('Invalid file: '+…),
   alert('PPTX generation failed: '+…) — and the app's own question box — v18Ask('Set a passphrase
   (privacy screen — NOT auth):'), v18Ask('Move to dunning stage? '), v18Ask('Tag name? (e.g. …'),
   pfPrompt('Copy the offer:'). Read live in Arabic, the idle-lock switch asked its question in
   English. A report of a failure is the sentence a person reads most carefully.

   Now js/21 owns these words too (exact texts and fixed heads) and wraps v18Ask, pfPrompt and — after
   js/63 has put its in-page card on window.alert — alert itself, at the moment of showing.

   What this holds:
     1. AR: the idle-lock switch's question reads Arabic in the app's own box (driven);
     2. AR: the backup-failure report reads Arabic, head AND detail — raised the real way, by
        restoring a snapshot that does not exist through the page's own restore function (the one
        the Restore buttons call). bkFail reports through the notice box first ("⚠ Backup: …") and
        alert() only as its fallback, so that head is in the notice dictionary as well, and the four
        detail sentences the backup screen passes after its head are translated too, or the report
        would be half a message;
     3. AR: every such head or question in the source resolves to Arabic — the probe scans js/ for
        alert('… '+, v18Ask('…') and pfPrompt('…') literals on lines with no language switch and asks
        the page's own v27AlertWord() for each;
     4. EN brake: the same question and report read their English exactly;
     5. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): the dictionary,
   wrappers and the bkFail kind absent (the tree before this fire) — fails 1, 2, 3 and 4 (the English
   brake too, because the failure wore the tick in both languages); 5 stays green.
   Run: node scripts/qa/probe-a-report-speaks-arabic.mjs                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9309 — one mock. */
const PORT = 9309; const BASE = 'http://localhost:' + PORT;
const APP = process.env.APP_DIR || fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');

/* every fixed head / question in the source that carries no language switch on its line */
const files = [];
for (const d of ['js', 'js/core']) for (const f of fs.readdirSync(path.join(APP, d))) if (f.endsWith('.js')) files.push(d + '/' + f);
const lits = new Set();
for (const f of files) {
  if (/^js\/21-/.test(f)) continue;
  for (const line of fs.readFileSync(path.join(APP, f), 'utf8').split('\n')) {
    if (/\bL\(|fl\(|isAr|LANG|_ar\b|ar\?/.test(line)) continue;
    for (const m of line.matchAll(/\b(alert|v18Ask|pfPrompt)\(\s*'([A-Z][^']{3,110})'/g)) lits.add(m[2]);
  }
}
/* a head ends in a space and carries a detail after it; a question is exact */
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
  await p.waitForTimeout(4000);   /* the late wraps have had their turn */
  /* 1. the idle-lock question */
  await p.evaluate(() => { try { v21LockToggle(); } catch (_) {} }); await p.waitForTimeout(500);
  const ask = await p.evaluate(() => { const t = document.querySelector('#pfPromptBox [data-pf-prompt-text]'); return t ? t.textContent.trim() : null; });
  await p.evaluate(() => { try { const n = document.getElementById('pfPromptNo'); if (n) n.click(); } catch (_) {} }); await p.waitForTimeout(400);
  /* 2. the backup-failure report, on js/63's in-page card — raised the real way: restore a snapshot
     that does not exist, through the page's own restore function (the one the Restore buttons call) */
  await p.evaluate(() => { try { restoreFromBackup('tag', 'qa-no-such-snapshot'); } catch (_) {} }); await p.waitForTimeout(600);
  /* the restore asks first, in the app's own box — answer yes the way a person does; the tag it takes
     before restoring is a write and the harness refuses writes, which is fine: the fetch that follows
     finds no such snapshot and the report is raised on the real path */
  await p.evaluate(() => { try { const y = document.querySelector('#pfConfirmBox .btn.pri, #pfConfirmBox button.pri'); if (y) y.click(); } catch (_) {} }); await p.waitForTimeout(1800);
  /* the backup screen reports through the notice box when it exists (bkFail: toast first, alert as
     the fallback), so the report is read there; the card is read only if the box did not show */
  const report = await p.evaluate(() => { const t = document.getElementById('v19toast'); if (t && t.classList.contains('show')) return (t.textContent || '').replace(/\s+/g, ' ').trim();
    const c = document.getElementById('v63Notice'); return c ? c.textContent.replace(/\s+/g, ' ').trim() : null; });
  await p.evaluate(() => { try { const c = document.getElementById('v63Notice'); if (c) c.remove(); } catch (_) {} }); await p.waitForTimeout(2600);
  /* 3. every source head through the page's own word */
  const words = await p.evaluate((samples) => samples.map((s) => [s, (typeof v27AlertWord === 'function') ? v27AlertWord(s) : s]), SAMPLES);
  await ctx.close();
  return { ask, report, words, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
const AR = /[؀-ۿ]/;

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

console.log('  ' + SAMPLES.length + ' heads and questions found in the source; one question and one report driven in each language');

(ar.ask && AR.test(ar.ask) && !/passphrase/i.test(ar.ask))
  ? pass('AR: the idle-lock switch\'s question reads Arabic in the app\'s own box', JSON.stringify(ar.ask))
  : fail('AR: the idle-lock switch\'s question reads Arabic in the app\'s own box', JSON.stringify(ar.ask));

/* and a failure must not wear the tick: bkFail used to put its own ⚠ inside the text with no kind, so the
   box drew "✓ ⚠ Backup: …" — a failure with a success mark in front (fixed in the same fire) */
(ar.report && AR.test(ar.report) && /اللقطة/.test(ar.report) && !/Backup: /.test(ar.report) && !/snapshot/.test(ar.report) && !/✓/.test(ar.report))
  ? pass('AR: the backup-failure report reads Arabic, head and detail both, and wears no tick', JSON.stringify(ar.report.slice(0, 70)))
  : fail('AR: the backup-failure report reads Arabic, head and detail both, and wears no tick', JSON.stringify(ar.report));

const stuck = ar.words.filter(([, w]) => !AR.test(w));
(SAMPLES.length >= 10 && stuck.length === 0)
  ? pass('AR: every such head or question in the source resolves to Arabic', SAMPLES.length + ' texts')
  : fail('AR: every such head or question in the source resolves to Arabic', JSON.stringify({ found: SAMPLES.length, stuck: stuck.slice(0, 6).map((x) => x[0]) }));

(en.ask === 'Set a passphrase (privacy screen — NOT auth):' && /Backup: could not fetch that snapshot — nothing was restored/.test(en.report || '') && !/✓/.test(en.report || ''))
  ? pass('EN brake: the same question and report read their English exactly')
  : fail('EN brake: the same question and report read their English exactly', JSON.stringify({ ask: en.ask, report: en.report }));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
