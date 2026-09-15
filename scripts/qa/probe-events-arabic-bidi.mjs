/* probe-events-arabic-bidi.mjs — guards two js/10 (Events table) fixes found live 2026-09-15 (fire #53)
   by eye on the Arabic events page against the real 80 events:
     1. the date range span was always dir="ltr"; with Arabic month names inside it the Arabic page read
        "سبتمبر – 16 2026 14" — the day numbers thrown to the wrong ends. It now follows the page direction.
     2. the free-text notes (mostly English) sat in an RTL cell, so an English note showed its full stop
        first and its words out of order; the notes block is now unicode-bidi:plaintext (each note follows
        its own first strong character).
   Seeds two upcoming events in the mock — one with a two-day range and an English note, one with an Arabic
   note — and asserts: EN page: date span dir=ltr; AR page: date span dir=rtl, the English note's block is
   plaintext with computed direction ltr, the Arabic note's block plaintext with direction rtl; no JS errors.
   Sabotage-tested: with the two js/10 edits reverted, 3 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-events-arabic-bidi.mjs                                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9040;
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const EV = [
  { id: 'qa-ev-en', name_en: 'Probe Expo Alpha', name_ar: 'معرض ألفا', vertical: 'Travel', status: 'confirmed', priority: 3, opportunity_sales: true, opportunity_partner: false, approach: 'attend', city: 'Riyadh', venue: 'Hall 1', organiser: 'QA', link: null, start_date: d(3), end_date: d(5), notes: 'Owner plan: attend in person. Competitor intel only.' },
  { id: 'qa-ev-ar', name_en: 'Probe Expo Beta', name_ar: 'معرض بيتا', vertical: 'Tech', status: 'confirmed', priority: 2, opportunity_sales: false, opportunity_partner: true, approach: 'undecided', city: 'Jeddah', venue: 'Hall 2', organiser: 'QA', link: null, start_date: d(9), end_date: d(9), notes: 'ملاحظة بالعربية: نحضر بجناح صغير.' },
];
const srv = start(PORT, { ksa_events: EV }); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2000);
const read = async () => {
  await p.evaluate(() => { current = 'events'; openLead = ''; render(); });
  await p.waitForFunction(() => document.querySelectorAll('#view table tbody tr').length >= 2, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(500);
  return p.evaluate(() => {
    const rows = [...document.querySelectorAll('#view table tbody tr')];
    const row = (frag) => rows.find((tr) => tr.innerText.includes(frag));
    /* the RENDERED direction of a note: with unicode-bidi:plaintext the computed `direction` stays
       inherited (rtl on the Arabic page), so it is read from where the first and last characters
       actually land — first left of last = reads left-to-right */
    const rendered = (el) => { const tn = el && el.firstChild; if (!tn || tn.nodeType !== 3 || tn.textContent.length < 2) return null; const a = document.createRange(); a.setStart(tn, 0); a.setEnd(tn, 1); const z = document.createRange(); z.setStart(tn, tn.textContent.length - 1); z.setEnd(tn, tn.textContent.length); const ra = a.getBoundingClientRect(), rz = z.getBoundingClientRect(); return ra.left < rz.left ? 'ltr' : 'rtl'; };
    const info = (tr) => { if (!tr) return null; const span = tr.querySelector('td[data-l] span[dir]') || [...tr.querySelectorAll('span[dir]')][0]; const notes = tr.querySelector('[data-ev-notes]'); return { dateDir: span ? span.getAttribute('dir') : null, dateText: span ? span.innerText : null, notesBidi: notes ? getComputedStyle(notes).unicodeBidi : null, notesDir: rendered(notes) }; };
    return { lang: LANG, rows: rows.length, en: info(row('Probe Expo Alpha')), ar: info(row('Probe Expo Beta')) };
  });
};
const en = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(1500);
const ar = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const checks = [
  ['both seeded events render in the table', en.rows >= 2 && !!en.en && !!en.ar],
  ['EN page: the date range span is left-to-right', en.en && en.en.dateDir === 'ltr' && /–/.test(en.en.dateText || '')],
  ['AR page: the date range span follows the page (dir=rtl)', ar.lang === 'ar' && ar.en && ar.en.dateDir === 'rtl'],
  ['AR page: an English note is bidi-plaintext and reads left-to-right', ar.en && ar.en.notesBidi === 'plaintext' && ar.en.notesDir === 'ltr'],
  ['AR page: an Arabic note is bidi-plaintext and reads right-to-left', ar.ar && ar.ar.notesBidi === 'plaintext' && ar.ar.notesDir === 'rtl'],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
