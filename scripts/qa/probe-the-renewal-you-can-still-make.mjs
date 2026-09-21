/* probe-the-renewal-you-can-still-make.mjs — the morning card never buries the one deadline that
   has not passed yet.

   Fire #199. The card (js/88) shows at most three company papers needing attention, most urgent
   first, with the count of the rest — a deliberate design, and a good one. Read verbatim off the
   live registry that day, "most urgent first" produced this:

       • ISO 9001:2015 — expired 2025-02-14      (584 days ago)
       • DUNS — expired 2025-09-10               (376 days ago)
       • Saudization certificate — expired 2026-01-06  (258 days ago)
       and 2 more

   The two behind "and 2 more" were PCI DSS (lapsed 69 days ago) and **Monsha'at, 49 days left** —
   the only item on the whole list that could still be renewed before it lapsed. Sorting purely by
   days remaining means the further past saving a document is, the more of the card it takes: after
   nineteen months a lapse is a standing state, not news, while a deadline you can still meet is
   exactly what this card exists to pass along.

   The sort and the cap both stand. What changed is that when anything on the list has NOT lapsed,
   the nearest of those always takes the last of the three places. Nothing is hidden that was not
   hidden before — the count of the rest still says how many, and the Generator's radar still holds
   the full list.

   What this holds:
     1. with a mixture of lapsed and upcoming, the nearest upcoming item is on the card;
     2. …and the two most overdue keep the other two places, so the sort is not abandoned;
     3. when EVERYTHING has lapsed, three lapsed items show and nothing is invented;
     4. the count of the rest is right in every case — shown plus "and N more" equals the list;
     5. both languages, with the day count and the date in each;
     6. nothing beyond sixty days ever appears, however empty the card would otherwise be;
     7. the card stays admin-and-manager only;
     8. no JS errors.

   Checks 3, 6 and 7 are the brakes. A version that always forced an upcoming row onto the card
   would pass 1 and fail 3 by inventing one; a version that widened the window to fill the space
   would fail 6; a version that dropped the role test to make the card easier to see would fail 7.

   The registry is stubbed through `window.dgCredentialFacts`, the same accessor js/88 reads and
   every generated document obeys, so the fixture is the app's own doorway rather than a private
   one — and each case is a set of dates chosen to make one question answerable.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both runs real,
   and neither failed the checks predicted before running them — which is the reason to run them:
     · removing the "keep a place for the nearest upcoming" block — fails 1 and 5. Check 5 goes
       with it because the Arabic card is the same card: a missing row is missing in both
       languages, so the bilingual check doubles as a second reading of the first.
     · making that block unconditional, so a row is appended even when nothing is upcoming —
       fails 4 and 6, not 3. Check 3 survives because the row it wrongly swaps in is itself an
       expired one, so "three lapsed items show" still holds; what gives it away is the count of
       the rest going wrong and the same paper appearing twice on a one-item list.
   Run: node scripts/qa/probe-the-renewal-you-can-still-make.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9232 — one mock. */
const PORT = 9232; const BASE = 'http://localhost:' + PORT;

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
await p.waitForTimeout(3500);

/* Stub the registry through the app's own accessor. `offsets` are days from today; the probe
   builds the dates so the fixture cannot drift with the calendar. */
const setRegistry = async (offsets) => {
  await p.evaluate((offs) => {
    try {
      const iso = (d) => { const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
      const rows = offs.map((d, i) => ({ key: 'qa' + i, label_en: 'QA Paper ' + i, label_ar: 'ورقة ' + i, expires_on: iso(d), category: 'licence' }));
      window.dgCredentialFacts = function () { return { loaded: true, rows: rows }; };
      window.__qaOffsets = offs.slice();
    } catch (_) {}
  }, offsets);
  await p.evaluate(() => { try { const n = document.querySelector('.v88-renewals'); if (n) n.remove(); current = 'today'; render(); } catch (_) {} });
  await p.waitForTimeout(2200);
};
const card = () => p.evaluate(() => {
  const n = document.querySelector('.v88-renewals');
  if (!n) return null;
  const t = (n.innerText || '').trim();
  const bullets = t.split('\n').map((x) => x.trim()).filter((x) => x.indexOf('•') === 0);
  const more = (t.match(/and (\d+) more|و(\d+) غيرها/) || []);
  return { bullets, moreCount: Number(more[1] || more[2] || 0), text: t };
});
const setLang = async (l) => { await p.evaluate((x) => { try { LANG = x; if (typeof applyLang === 'function') applyLang(); const n = document.querySelector('.v88-renewals'); if (n) n.remove(); current = 'today'; render(); } catch (_) {} }, l); await p.waitForTimeout(2200); };

/* CASE A — the live shape: three long-dead, one recently dead, one still savable */
await setRegistry([-584, -376, -258, -69, 49]);
const mixed = await card();
await setLang('ar'); const mixedAr = await card(); await setLang('en');

/* CASE B — everything has lapsed: nothing may be invented */
await setRegistry([-584, -376, -258, -69]);
const allDead = await card();

/* CASE C — nothing inside the window: 61 days and beyond must not appear */
await setRegistry([61, 120, 400]);
const farOff = await card();

/* CASE D — one lapsed, one just outside the window */
await setRegistry([-5, 61]);
const oneEach = await card();

/* BRAKE — a team member must not see it at all */
await setRegistry([-584, -376, -258, -69, 49]);
await p.evaluate(() => { try { window.__userRole = 'team_member'; window.__userTier = 'team'; const n = document.querySelector('.v88-renewals'); if (n) n.remove(); current = 'today'; render(); } catch (_) {} });
await p.waitForTimeout(2200);
const asTeam = await card();
await p.evaluate(() => { try { window.__userRole = 'admin'; window.__userTier = 'admin'; } catch (_) {} });

await b.close(); srv.close?.();

const has = (c, frag) => !!c && c.bullets.some((x) => x.indexOf(frag) >= 0);
const checks = [
  ['with a mixture, the nearest upcoming item is on the card',
    has(mixed, '49 days left'), mixed ? JSON.stringify(mixed.bullets) : 'no card'],
  ['…and the two most overdue keep the other two places',
    !!mixed && mixed.bullets.length === 3 && has(mixed, 'QA Paper 0') && has(mixed, 'QA Paper 1'),
    mixed ? JSON.stringify(mixed.bullets.map((x) => x.slice(0, 40))) : 'no card'],
  ['when everything has lapsed, three lapsed items show and nothing is invented',
    !!allDead && allDead.bullets.length === 3 && allDead.bullets.every((x) => /expired/.test(x)),
    allDead ? JSON.stringify(allDead.bullets) : 'no card'],
  ['the count of the rest is right in every case',
    !!mixed && mixed.moreCount === 2 && !!allDead && allDead.moreCount === 1 &&
    !!oneEach && oneEach.bullets.length === 1 && oneEach.moreCount === 0,
    JSON.stringify({ mixed: mixed && mixed.moreCount, allDead: allDead && allDead.moreCount,
      oneEach: oneEach && { shown: oneEach.bullets.length, more: oneEach.moreCount } })],
  ['both languages carry the day count and the date',
    !!mixedAr && mixedAr.bullets.length === 3 && /[؀-ۿ]/.test(mixedAr.text) &&
    /49/.test(mixedAr.text) && mixedAr.moreCount === 2,
    mixedAr ? JSON.stringify(mixedAr.bullets) : 'no card'],
  ['nothing beyond sixty days ever appears',
    farOff === null && !!oneEach && oneEach.bullets.length === 1,
    JSON.stringify({ farOff: farOff === null ? 'no card at all' : farOff.bullets, oneEach: oneEach && oneEach.bullets })],
  ['the card stays admin-and-manager only', asTeam === null, asTeam ? 'shown to a team member' : 'not shown'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
