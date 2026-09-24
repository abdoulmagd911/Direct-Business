/* probe-every-hover-word-speaks-arabic.mjs — the words a person meets on hover (title) and a screen
   reader is handed (aria-label) read Arabic in Arabic, English in English, and follow the language
   flip both ways; the password eye says what it will do, in the page language, and its label
   follows its state.

   Fire #254. Counted across the layers: 23 tooltips and assistive labels were English-only — js/21
   translates a cell's text and a placeholder after it is drawn, but never a `title` or an
   `aria-label`. Read on the live app in Arabic: the Leads table's "Individual using a company email -
   check", the Reports table's "Select all in view" / "Open the lead to change stage" / "Lead score N",
   the top bar's "Toggle language" / "Open command palette" / "Show keyboard shortcuts" / "Open menu",
   the shell's "Menu", the generic "Icon button", and the sign-in eye's "Show password" — which also
   never changed to "Hide password" for a screen reader while the password was showing.

   Now js/21 carries TITLE_AR beside PLACEHOLDER_AR and runs the same attribute pass on `title` and
   `aria-label`, keeping the English on the element so the flip back restores it; js/11's eye speaks
   for itself (its words change on a click, after js/21's pass) and sets aria-pressed.

   What this holds:
     1. AR sign-in: the eye's title and aria-label are Arabic; after a click the field shows the
        text, both read the Arabic "hide" word and aria-pressed is true; a second click restores;
     2. AR top bar: the language, palette, shortcuts and menu buttons carry no English label;
     3. AR Leads: no title or aria-label in the working area is one of the 23 English words;
     4. AR Clients: the same ("Client health — …" and the row tooltips), and the "Lead score N"
        prefix on Leads reads Arabic;
     5. EN brake: the same attributes read their English words exactly;
     6. flip AR → EN restores every attribute this pass changed (no data-v27 marks remain);
     7. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · TITLE_AR emptied — fails 2, 3 and 4;
     · js/11's words removed (the eye back to English-only, static) — fails 1 and 5: the English brake
       asks for "Hide password" on the screen-reader label after a click, which the old eye never set.
   Run: node scripts/qa/probe-every-hover-word-speaks-arabic.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9301 — one mock. */
const PORT = 9301; const BASE = 'http://localhost:' + PORT;

const EN_WORDS = ['Android app', 'iOS app', 'Command palette', 'FX rate to SAR', 'File upload', 'Hide password', 'Show password', 'Icon button',
  'Import backup file', 'Import full state JSON', 'Input', 'Individual using a company email - check', 'Menu', 'Open menu',
  'Open the lead to change stage', 'Primary navigation', 'Select all in view', 'Switch view preset', 'Toggle language',
  'Open command palette', 'Show keyboard shortcuts', 'What is this section?',
  'How hot this lead is (Hot / Warm / Cool / Cold). Click to sort — work the hottest first.',
  'Client health — Good / Watch / At risk. Click to surface at-risk clients.'];
const isEnglishWord = (t) => EN_WORDS.includes(t) || /^Lead score /.test(t) || /^Source of truth: /.test(t);

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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  /* js/11 wraps the field in its own relative box and adds the eye on a 700 ms tick — wait for THAT
     button, not the form's first button (the first run of this probe read the Sign-in button) */
  await p.waitForFunction(() => { const i = document.getElementById('cl_pw'); return !!(i && i.parentNode && i.parentNode.style.position === 'relative' && i.parentNode.querySelector('button[aria-label]')); }, { timeout: 15000 }).catch(() => {});
  const eyeRead = () => p.evaluate(() => { const i = document.getElementById('cl_pw'); const bt = i && i.parentNode ? i.parentNode.querySelector('button[aria-label]') : null;
    return bt ? { type: i.type, title: bt.title, aria: bt.getAttribute('aria-label'), pressed: bt.getAttribute('aria-pressed') } : null; });
  const eyeClick = () => p.evaluate(() => { const i = document.getElementById('cl_pw'); const bt = i.parentNode.querySelector('button[aria-label]'); if (bt) bt.click(); });
  const eye0 = await eyeRead();
  await eyeClick(); await p.waitForTimeout(200);
  const eye1 = await eyeRead();
  await eyeClick(); await p.waitForTimeout(200);
  const eye2 = await eyeRead();
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(3500);
  const attrs = (sel) => p.evaluate((sel) => { const out = []; document.querySelectorAll(sel + ' [title], ' + sel + ' [aria-label]').forEach((el) => {
      const t = el.getAttribute('title'); const a = el.getAttribute('aria-label'); if (t) out.push(t); if (a) out.push(a); }); return out; }, sel);
  const top = await p.evaluate(() => ['#langBtn', '#kBtn', '#hBtn', '.menu-btn'].map((s) => { const e = document.querySelector(s); return e ? [s, e.getAttribute('aria-label'), e.getAttribute('title')] : [s, null, null]; }));
  const leads = await attrs('#view');
  await p.evaluate(() => { try { current = 'clients'; openLead = null; render(); } catch (_) {} }); await p.waitForTimeout(2500);
  const reports = await attrs('#view');   /* the Clients table: "Client health — …" and its row tooltips */
  let flipped = null;
  if (lang === 'ar') {
    await p.evaluate(() => { try { toggleLang(); } catch (_) {} }); await p.waitForTimeout(2500);
    /* the language button's own tooltip legitimately names the other language ("Switch to العربية") */
    flipped = await p.evaluate(() => ({ lang: LANG, marks: document.querySelectorAll('[data-v27ttlen],[data-v27alen]').length,
      titles: [...document.querySelectorAll('#view [title], .top [aria-label]')].filter((e) => e.id !== 'langBtn').map((e) => e.getAttribute('title') || e.getAttribute('aria-label')).filter(Boolean) }));
  }
  await ctx.close();
  return { eye0, eye1, eye2, top, leads, reports, flipped, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
const AR = /[؀-ۿ]/;

const ar = await run('ar');
const en = await run('en');
await b.close(); srv.close?.();

console.log('  hover and assistive words read in Arabic and in English: sign-in eye, top bar, Leads, Reports; then the flip back');

(ar.eye0 && AR.test(ar.eye0.title) && AR.test(ar.eye0.aria) && ar.eye0.pressed === 'false' && ar.eye1 && ar.eye1.type === 'text' && /إخفاء/.test(ar.eye1.title) && /إخفاء/.test(ar.eye1.aria) && ar.eye1.pressed === 'true' && ar.eye2 && ar.eye2.type === 'password' && /إظهار/.test(ar.eye2.aria))
  ? pass('AR sign-in: the eye speaks Arabic and its label follows its state', JSON.stringify([ar.eye0.aria, ar.eye1.aria]))
  : fail('AR sign-in: the eye speaks Arabic and its label follows its state', JSON.stringify({ eye0: ar.eye0, eye1: ar.eye1, eye2: ar.eye2 }));

const topEnglish = ar.top.filter(([, a, t]) => (a && isEnglishWord(a)) || (t && isEnglishWord(t)));
(ar.top.some(([, a]) => a) && topEnglish.length === 0)
  ? pass('AR top bar: the language, palette, shortcuts and menu buttons carry no English label', JSON.stringify(ar.top.map((x) => x[1])))
  : fail('AR top bar: the language, palette, shortcuts and menu buttons carry no English label', JSON.stringify(ar.top));

const leadsEnglish = ar.leads.filter(isEnglishWord);
(ar.leads.length > 0 && leadsEnglish.length === 0)
  ? pass('AR Leads: no hover or assistive word in the working area is one of the English ones', ar.leads.length + ' attributes read')
  : fail('AR Leads: no hover or assistive word in the working area is one of the English ones', JSON.stringify(leadsEnglish.slice(0, 5)));

const repEnglish = ar.reports.filter(isEnglishWord);
(ar.reports.length > 0 && repEnglish.length === 0 && ar.leads.some((t) => /^درجة العميل المحتمل /.test(t)))
  ? pass('AR Clients: the same, and the "Lead score N" prefix on Leads reads Arabic', ar.reports.length + ' attributes read')
  : fail('AR Clients: the same, and the "Lead score N" prefix on Leads reads Arabic', JSON.stringify({ english: repEnglish.slice(0, 5), score: ar.leads.filter((t) => /Lead score|درجة/.test(t)).slice(0, 2) }));

(en.eye0 && en.eye0.aria === 'Show password' && en.eye1 && en.eye1.aria === 'Hide password' && en.top.some(([s, a]) => s === '.menu-btn' && a === 'Open menu') && en.leads.some((t) => t === 'Select all in view') && en.leads.some((t) => /^Lead score /.test(t)))
  ? pass('EN brake: the same attributes read their English words exactly')
  : fail('EN brake: the same attributes read their English words exactly', JSON.stringify({ eye: [en.eye0, en.eye1], top: en.top, sel: en.leads.filter((t) => /Select all|Lead score/.test(t)).slice(0, 3) }));

(ar.flipped && ar.flipped.lang === 'en' && ar.flipped.marks === 0 && ar.flipped.titles.some((t) => isEnglishWord(t)) && !ar.flipped.titles.some((t) => AR.test(t) && !/WhatsApp/.test(t)))
  ? pass('flip AR → EN restores every attribute this pass changed')
  : fail('flip AR → EN restores every attribute this pass changed', JSON.stringify(ar.flipped && { lang: ar.flipped.lang, marks: ar.flipped.marks, sample: ar.flipped.titles.slice(0, 6) }));

const errs = ar.errors.concat(en.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
