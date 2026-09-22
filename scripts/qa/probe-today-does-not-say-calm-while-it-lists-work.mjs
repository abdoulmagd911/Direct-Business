/* probe-today-does-not-say-calm-while-it-lists-work.mjs — Today's verdict lines agree with the
   work Today is showing, and still say "all clear" when there genuinely is none.

   Fire #211. Driven live against the real database as the person who owns the most records, Today
   said, twice, at the top of the screen:

       hero    "Nothing urgent right now — all clear."
       greeting "Nothing urgent. Today is calm."

   …six lines above its own card, which read "☀️ Your day — <name>  **71**", listed six
   never-contacted prospects under GOING COLD, and a CLIENT REVIEW two days overdue. The company
   papers banner at the very top was naming two expired certificates at the same time.

   The cause is structural rather than careless: both verdicts counted only the workspace-blob
   collections — offers, invoices, bookings, the queue — and in this app all four are permanently
   empty, because invoices and bookings are minted in Direct Payments (js/84 measured 0, 0, 0, 0
   and said so on screen). So the verdicts could never be anything but "all clear", however much
   work was on the page.

   Fixed by having both lines ASK js/14 — the layer that owns the definition of "to act on" and
   draws the card — instead of each keeping its own idea of what counts.

   What this holds:
     1. with work on the card, the hero names a number and does NOT say "all clear";
     2. the greeting does not say "Today is calm" either;
     3. the number the verdicts give is the SAME number the card's own tag shows — one screen, one
        answer;
     4. the brake, and the reason this is not just "shout more": someone who genuinely owns nothing
        still gets "all clear", "Today is calm", and "All caught up 🎉" on the card;
     5. in Arabic all three read Arabic and still agree;
     6. no JS errors.

   Everything here is seeded in the browser — leads assigned to a made-up name, never contacted —
   so it does not depend on who happens to own what in the real workspace.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both real runs:
     · putting the hero's count back to the blob-only groups — fails 1, 3 and 5, printing
       "Nothing urgent right now — all clear." beside the card's own 3;
     · making the greeting ignore js/14 again — fails 2, 3 and 5, printing "Today is calm." beside
       the same 3. In both runs check 5 goes with its English twin: it is the same line in the
       other language, one cause rather than a second finding.
   Run: node scripts/qa/probe-today-does-not-say-calm-while-it-lists-work.mjs                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9241 — one mock. */
const PORT = 9241; const BASE = 'http://localhost:' + PORT;
const OWNER = 'Qaowner Testperson';     /* nobody's real name, and unique enough not to alias */
const NOBODY = 'Qanobody Testperson';

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
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

await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

/* three leads of our own, owned by a made-up person and never contacted — "going cold" by the
   card's own rule (14+ days, or never) */
const seeded = await p.evaluate((owner) => {
  try {
    const B = DB.businesses || []; const src = B.find((x) => !x.isClient) || B[0]; if (!src) return { ok: false };
    for (let i = 1; i <= 3; i++) {
      const c = JSON.parse(JSON.stringify(src));
      c.id = 'qa_today_' + i; c.isClient = false; c.name = 'QATODAY Lead ' + i; c.nameAr = '';
      c.stage = 'Contacted'; c.status = 'Contacted'; c.assignedTo = owner; c.owner = owner;
      c.accountManager = ''; c.activities = []; c.lastContact = 0; c.nextActionDate = ''; c.nextReview = '';
      if (c.raw) c.raw = {};
      B.push(c);
    }
    return { ok: true, total: B.length };
  } catch (e) { return { ok: false, err: e.message }; }
}, OWNER);
await p.waitForTimeout(400);

/* The workspace this probe runs against has drafts and bookings of its own, and the verdicts count
   those too — correctly. To test the property rather than the fixture, the blob collections are
   emptied first, so the only work on the page is the three leads seeded above. They are emptied
   again if a background load puts them back, which it does for a second or two after a render. */
const readToday = async (name, lang) => {
  let out = null;
  for (let i = 0; i < 6; i++) {
    await p.evaluate(([n, l]) => { try { window.__userName = n; LANG = l; if (typeof applyLang === 'function') applyLang();
      DB.offers = []; DB.invoices = []; DB.bookings = []; DB.requests = [];
      current = 'today'; openLead = null; render(); } catch (_) {} }, [name, lang]);
    /* long enough for js/14 to inject its card, short enough that the background load usually has
       not put the blob back; the reading itself confirms the blob was still empty when it was taken */
    await p.waitForTimeout(900);
    out = await p.evaluate(() => {
      const clean = !(DB.offers || []).length && !(DB.invoices || []).length && !(DB.bookings || []).length && !(DB.requests || []).length;
      const v = document.querySelector('#view'); const t = v ? (v.innerText || '') : '';
      const hero = v.querySelector('.hero p');
      const lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
      const greet = lines.find((x) => /calm|هادئ|to act on|للعمل عليه|You have|لديك/.test(x)) || null;
      const meSpan = v.querySelector('.v57-me');
      const head = meSpan ? meSpan.closest('div') : null;
      const tag = head ? head.querySelector('.tag') : null;
      return { clean, hero: hero ? (hero.textContent || '').trim() : null, greet,
        cardTag: tag ? (tag.textContent || '').trim() : null, hasCard: !!meSpan };
    });
    if (out && out.clean && out.hasCard) return out;
  }
  return out;
};
const numberIn = (s) => { const m = String(s || '').match(/(\d+)/); return m ? Number(m[1]) : null; };

const withWork = await readToday(OWNER, 'en');
const withWorkAr = await readToday(OWNER, 'ar');
const withNone = await readToday(NOBODY, 'en');
await b.close(); srv.close?.();

const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const cardNum = numberIn(withWork.cardTag);
const checks = [
  ['with work on the card, the hero names a number and does not say "all clear"',
    !!withWork.hero && !/all clear/i.test(withWork.hero) && numberIn(withWork.hero) > 0,
    JSON.stringify({ hero: withWork.hero, card: withWork.cardTag })],
  ['the greeting does not say "Today is calm" either',
    !!withWork.greet && !/Today is calm/i.test(withWork.greet) && numberIn(withWork.greet) > 0,
    JSON.stringify(withWork.greet)],
  ['the verdicts and the card give the SAME number — one screen, one answer',
    cardNum > 0 && numberIn(withWork.hero) === cardNum && numberIn(withWork.greet) === cardNum,
    JSON.stringify({ hero: numberIn(withWork.hero), greet: numberIn(withWork.greet), card: cardNum, seeded })],
  ['brake: someone who owns nothing still gets "all clear", "calm" and "All caught up"',
    !!withNone.hero && /all clear/i.test(withNone.hero) && /Today is calm/i.test(String(withNone.greet)) &&
    withNone.hasCard && /caught up/i.test(String(withNone.cardTag)),
    JSON.stringify(withNone)],
  ['in Arabic all three read Arabic and still agree',
    arabic(withWorkAr.hero) && arabic(withWorkAr.greet) && !/all clear|Today is calm/i.test(withWorkAr.hero + ' ' + withWorkAr.greet) &&
    numberIn(withWorkAr.hero) === cardNum && numberIn(withWorkAr.greet) === cardNum,
    JSON.stringify(withWorkAr)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
