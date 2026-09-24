/* probe-one-person-one-name.mjs — the signed-in person is called ONE thing on a screen: the sidebar
   footer and the top-bar chip agree, the name holds still, and it is the nickname when there is one.

   Fire #252. Driven live in Arabic: the sidebar footer flipped between the person's Arabic name and
   their English legal name — three flips in five seconds, English 70 % of the time. js/50 swapped
   the footer to the Arabic name after every render; js/12 (every 1.2 s) and js/20 (every render)
   wrote the legal name back whenever it differed. In English the footer read the legal name while
   the chip beside it read the nickname. And js/54, whose whole job is the nickname, painted a footer
   class that does not exist (`.sidebar-foot,.side-foot` — the footer is `.side .foot`), while the
   chip showed the FIRST WORD of the legal name for everyone, so a person the team calls "Abu Nasser"
   was "Assem" there. 10 of the 11 live accounts carry a nickname in both languages, four of them
   two words long.

   Now one helper answers "what do we call this person" — displayName()/shortName() in js/54:
   nickname in the page language, else the Arabic name in Arabic, else the full name — and js/12,
   js/20 and js/44 write through it; js/50 no longer touches the footer.

   What this holds:
     1. AR: the footer name holds still for four seconds after a render (no flicker);
     2. AR: footer and chip both read the Arabic nickname;
     3. EN: footer and chip both read the English nickname, whole ("Abu QA", not "Abu");
     4. EN: the chip's menu head still gives the official full name and the e-mail;
     5. brake — no nickname on file: EN footer is the full name and the chip its first word; AR
        footer is the Arabic name, holds still, and the chip its first word;
     6. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · js/12 back to writing the raw full name — fails 1 (the flicker returns: 3 flips, the legal
       name 36 samples of 40), 2 and 3 (footer ≠ chip) and 5 (the Arabic brake flickers too);
     · js/54's shortName removed (the chip back to a first word) — fails 2 and 3 alone.
   Run: node scripts/qa/probe-one-person-one-name.mjs                                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9294 — one mock. */
const PORT = 9294; const BASE = 'http://localhost:' + PORT;

const FULL = 'QA Test Account', AR_NAME = 'حساب الاختبار', NICK = 'Abu QA', NICK_AR = 'أبو كيو';
const DIR = (withNick) => [{ id: 'qa-1', email: 'test@directksa.com', full_name: FULL, name_ar: AR_NAME, nickname: withNick ? NICK : null, role: 'admin', active: true }];
const NICKS = (withNick) => withNick ? [{ full_name: FULL, nickname: NICK, nickname_ar: NICK_AR }] : [];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang, withNick) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/team_directory' && m === 'GET') { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DIR(withNick)) }); return; }
    if (u.pathname === '/rest/v1/rpc/team_nicknames') { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NICKS(withNick)) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForFunction(() => { const c = document.getElementById('v68me'); return !!c && c.offsetParent !== null; }, { timeout: 30000 });
  await p.waitForTimeout(6000);   /* the nickname map and the roster have landed by now */
  const out = await p.evaluate(async () => {
    try { render(); } catch (_) {}
    const seen = {}; let last = null, flips = 0;
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 100));
      const el = document.querySelector('.side .foot b, .foot b'); const t = el ? el.textContent.trim() : '(no footer)';
      seen[t] = (seen[t] || 0) + 1; if (last !== null && t !== last) flips++; last = t; }
    const chip = document.getElementById('v68me');
    const chipName = chip ? (chip.querySelector('span:nth-child(2)') || {}).textContent || '' : '';
    return { seen, flips, footer: last, chip: chipName.trim(), userName: window.__userName || null };
  });
  /* the chip's menu head: official name + e-mail */
  await p.click('#v68me'); await p.waitForTimeout(400);
  const head = await p.evaluate(() => { const m = document.getElementById('v68menu'); return m ? (m.firstChild.textContent || '').trim() : null; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await ctx.close();
  return { ...out, head, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const ar = await run('ar', true);
const en = await run('en', true);
const enPlain = await run('en', false);
const arPlain = await run('ar', false);
await b.close(); srv.close?.();

console.log('  four runs: Arabic and English with a nickname on file, then both without one');

(ar.flips === 0 && Object.keys(ar.seen).length === 1)
  ? pass('AR: the footer name holds still for four seconds after a render', JSON.stringify(ar.seen))
  : fail('AR: the footer name holds still for four seconds after a render', JSON.stringify({ flips: ar.flips, seen: ar.seen }));

(ar.footer === NICK_AR && ar.chip === NICK_AR)
  ? pass('AR: footer and chip both read the Arabic nickname', JSON.stringify(ar.footer))
  : fail('AR: footer and chip both read the Arabic nickname', JSON.stringify({ footer: ar.footer, chip: ar.chip }));

(en.flips === 0 && en.footer === NICK && en.chip === NICK)
  ? pass('EN: footer and chip both read the English nickname, whole', JSON.stringify(en.chip))
  : fail('EN: footer and chip both read the English nickname, whole', JSON.stringify({ flips: en.flips, footer: en.footer, chip: en.chip }));

(en.head && en.head.indexOf(FULL) === 0 && /test@directksa\.com/.test(en.head))
  ? pass('EN: the chip\'s menu head still gives the official full name and the e-mail')
  : fail('EN: the chip\'s menu head still gives the official full name and the e-mail', JSON.stringify(en.head));

(enPlain.flips === 0 && enPlain.footer === FULL && enPlain.chip === FULL.split(' ')[0]
  && arPlain.flips === 0 && arPlain.footer === AR_NAME && arPlain.chip === AR_NAME.split(' ')[0])
  ? pass('brake: with no nickname on file, full name / Arabic name in the footer and their first word on the chip, still')
  : fail('brake: with no nickname on file, full name / Arabic name in the footer and their first word on the chip, still', JSON.stringify({ en: [enPlain.flips, enPlain.footer, enPlain.chip], ar: [arPlain.flips, arPlain.footer, arPlain.chip] }));

const errs = [].concat(ar.errors, en.errors, enPlain.errors, arPlain.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
