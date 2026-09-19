/* probe-settings-has-no-developer-tools.mjs — the Settings page must not offer the team the
   build-time scaffolding left over from earlier versions of this app.

   js/31 hides ten cards on Settings by heading: the ZATCA/XSS/PII audit read-out, a generator-token
   dump, a performance-hint overlay, a WCAG audit, translation-coverage stats, the "Run a day" /
   "Wipe test records" test harness, developer print notes, a one-off import note referencing a Q:\\
   spreadsheet, the "Workflow + go-live" suite with its "reset for go-live", and a scenario-sweep
   runner. Every one of them is a developer tool, and two of them destroy data: "Wipe test records"
   and "Wipe local data".

   Nothing guarded that. It is one loop setting display:none after each render — if the layer stops
   running, or a heading is reworded, or the render wrapper changes, all ten reappear on the page
   the whole team uses, with the destructive buttons on them. Driven against the real database on
   2026-09-20: all ten are hidden, in English and in Arabic, and the real cards are all present.

   NOTE ON READING THIS PAGE: the hidden cards are still in the DOM, and `innerText` on an element
   that is not rendered falls back to its raw text — so a naive read of the headings lists all ten
   as if they were on screen. That is what a first pass here reported, and a screenshot corrected
   it (the same trap as fire #108, where a table of editable cells read as blank). The checks below
   ask each card for its box and its computed style, never for text alone.

   Sabotage-tested 2026-09-20: with the hiding loop disabled, 1 check goes FAIL, exit 1 — the
   ZATCA/XSS audit read-out and the generator-token dump both appear on the page. Only those two,
   because the rest are also taken out by js/31's other steps or are not rendered by this fixture's
   data; and for the same reason the destructive buttons did not surface, so that check did not
   flip here. It is kept rather than dropped: it is not a check that cannot fail, it is a check
   whose case this sabotage did not reach, and "Wipe test records" reaching the team's Settings
   page is worth a standing assertion.
   Run: node scripts/qa/probe-settings-has-no-developer-tools.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9087; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

/* exactly the list js/31 drops, so this fails the moment the two fall out of step */
const DEV_CARDS = ['Security & integrity', 'Generator templates', 'Performance', 'Accessibility audit',
  'Internationalization', 'Developer / test', 'Print + PDF', 'reconcile', 'Workflow + go-live', 'Scenario sweep'];
/* Cards the team does use — here so "everything is hidden" cannot pass this probe.
   Backup & restore is deliberately NOT one of them: js/31 also removes the manual
   export/import/snapshot apparatus, because saving is handled by the platform. */
const REAL_CARDS_EN = ['Team & Access', 'Generators', 'Who can open what'];
const REAL_CARDS_AR = ['الفريق والصلاحيات', 'المولّدات', 'من يفتح ماذا'];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { current = 'settings'; openLead = null; render(); });
  await p.waitForTimeout(3000);

  const seen = await p.evaluate(({ dev, real }) => {
    const shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return r.height > 0 && r.width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const cardFor = (word) => {
      const h = [].slice.call(document.querySelectorAll('#view h2, #view h3'))
        .find((x) => (x.textContent || '').indexOf(word) >= 0);
      return h ? (h.closest('.card') || h) : null;
    };
    const devVisible = dev.filter((w) => shown(cardFor(w)));
    const realVisible = real.filter((w) => shown(cardFor(w)));
    /* the destructive buttons those cards carry, looked for by their own words */
    const wipeButtons = [].slice.call(document.querySelectorAll('#view button, #view a'))
      .filter((x) => /Wipe (test records|local data)|reset for go-live|Run a day/i.test(x.textContent || ''))
      .filter((x) => shown(x)).map((x) => (x.textContent || '').trim().slice(0, 30));
    return { devVisible, realVisible, wipeButtons, cards: document.querySelectorAll('#view .card').length };
  }, { dev: DEV_CARDS, real: lang === 'ar' ? REAL_CARDS_AR : REAL_CARDS_EN });
  await ctx.close();
  return seen;
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN', JSON.stringify(en));
console.log('  AR', JSON.stringify(ar));

const checks = [
  ['the Settings page really rendered its cards, in both languages', en.cards > 5 && ar.cards > 5, 'cards: EN ' + en.cards + ' · AR ' + ar.cards],
  ['the cards the team actually uses are on the page', en.realVisible.length === 3 && ar.realVisible.length === 3,
    JSON.stringify({ en: en.realVisible, ar: ar.realVisible })],
  ['not one developer or audit card is on screen, in either language',
    en.devVisible.length === 0 && ar.devVisible.length === 0, JSON.stringify({ en: en.devVisible, ar: ar.devVisible })],
  ['and none of the buttons that destroy or reset data can be reached',
    en.wipeButtons.length === 0 && ar.wipeButtons.length === 0, JSON.stringify({ en: en.wipeButtons, ar: ar.wipeButtons })],
  ['opening Settings wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail && errors.length) console.log('errors:', errors.slice(0, 5));
process.exit(fail ? 1 : 0);
