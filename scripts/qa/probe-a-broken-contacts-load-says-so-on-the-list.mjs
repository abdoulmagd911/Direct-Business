/* probe-a-broken-contacts-load-says-so-on-the-list.mjs — when the people fail to load, the page a
   person actually looks at says so.

   Fire #223. Every major table's fetch was refused in turn against the real database, and each
   dependent page read. One case was silent in a way that matters. With the `contacts` fetch
   refused, the Leads page showed:

       ⚠ Needs attention · 1        (it normally reads 71)

   and said nothing else. The count itself is right — fire #155 made the rule drop "this company has
   nobody on it" while the load is broken, because unknown is not the same as none. But #155 put the
   explanation only on a RECORD'S CARD, and the list is where the team spends its day. Somebody who
   knows that number is usually 71 sees 1 and concludes the pipeline was tidied up overnight.

   Fixed: one line at the top of Leads and Clients, only while that load is broken, carrying the
   same "Try again" the card already offers, and removed again by the next render once it works.

   What this holds:
     1. with the contacts load refused, Leads carries the notice;
     2. and Clients does too;
     3. the notice names the CONSEQUENCE — what on this page is now incomplete — rather than just
        announcing an error;
     4. Arabic in Arabic;
     5. the brake, and the whole point: when the contacts load fine there is NO notice. A warning
        that is always on screen is not a warning, and this one would sit on the busiest page in the
        app;
     6. it clears once the load works — pressing "Try again" after the table recovers takes it away,
        so it reports the present rather than the worst moment of the session;
     7. #155's card notice still works, so the list line did not replace the one on the record;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · dropping the FAILED.contacts condition so the bar always renders — fails 5 and 6, with the
       notice on screen while the contacts loaded perfectly well;
     · removing the list bar — fails 1, 2, 3 and 4 while 5, 6 and 7 still pass, which is the state
       the app was in before this fire and the reason a "does it ever show" check is not enough.
   Run: node scripts/qa/probe-a-broken-contacts-load-says-so-on-the-list.mjs                       */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9251 — one mock. */
const PORT = 9251; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* one browser, two runs: contacts refused, then contacts healthy */
const run = async (lang, breakContacts) => {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  const state = { broken: breakContacts, refused: 0 };
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (state.broken && u.pathname === '/rest/v1/contacts') { state.refused++;
      await r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"QA induced failure"}' }); return; }
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(6000);
  return { ctx, p, errors, state };
};
const readNotice = (p, page) => p.evaluate((pg) => {
  try { current = pg; openLead = null; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    const n = document.querySelector('#view .v72-list-notice');
    res(n ? { text: (n.innerText || '').replace(/\s+/g, ' ').trim(), links: n.querySelectorAll('a').length } : null);
  }, 2600));
}, page);

const bad = [];
const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d && d !== '[]' ? ' — ' + d : ''));

/* ---- A. contacts refused, English ---- */
const A = await run('en', true);
const aLeads = await readNotice(A.p, 'leads');
const aClients = await readNotice(A.p, 'clients');
/* #155's card notice, on a record, while broken */
const aCard = await A.p.evaluate(() => {
  const B = (DB.businesses || []).filter((x) => !x.isClient); if (!B.length) return null;
  try { openLead = B[0].id; current = 'leads'; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    const el = document.querySelector('#view [data-v72notice]');
    res(el ? (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : null);
  }, 2800));
});
/* ---- 6. it clears once the table recovers ---- */
A.state.broken = false;
const aAfter = await A.p.evaluate(() => {
  try { openLead = null; current = 'leads'; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    const n = document.querySelector('#view .v72-list-notice');
    const a = n && n.querySelector('a'); if (a) a.click();
    setTimeout(() => res(!!document.querySelector('#view .v72-list-notice')), 4000);
  }, 1500));
});
await A.ctx.close();

/* ---- B. contacts refused, Arabic ---- */
const B_ = await run('ar', true);
const bLeads = await readNotice(B_.p, 'leads');
await B_.ctx.close();

/* ---- C. healthy ---- */
const C = await run('en', false);
const cLeads = await readNotice(C.p, 'leads');
const cClients = await readNotice(C.p, 'clients');
await C.ctx.close();
await b.close(); srv.close?.();

const isAr = (s) => /[؀-ۿ]/.test(String(s || ''));
const errs = A.errors.concat(B_.errors, C.errors);

(aLeads && aLeads.text) ? pass('with the contacts load refused, Leads carries the notice', JSON.stringify({ refused: A.state.refused, links: aLeads.links }))
  : fail('with the contacts load refused, Leads carries the notice', JSON.stringify({ notice: aLeads, refused: A.state.refused }));
(aClients && aClients.text) ? pass('and Clients does too')
  : fail('and Clients does too', JSON.stringify({ notice: aClients }));
(aLeads && /no contact person/i.test(aLeads.text) && /incomplete/i.test(aLeads.text) && aLeads.links >= 1)
  ? pass('the notice names the consequence, not just an error', JSON.stringify(aLeads.text.slice(0, 80)))
  : fail('the notice names the consequence, not just an error', JSON.stringify(aLeads && aLeads.text));
(bLeads && isAr(bLeads.text) && !/no contact person/i.test(bLeads.text))
  ? pass('Arabic in Arabic', JSON.stringify(bLeads.text.slice(0, 60)))
  : fail('Arabic in Arabic', JSON.stringify(bLeads && bLeads.text));
(cLeads === null && cClients === null)
  ? pass('brake: when the contacts load fine there is no notice')
  : fail('brake: when the contacts load fine there is no notice', JSON.stringify({ leads: cLeads, clients: cClients }));
(aAfter === false) ? pass('it clears once the table recovers')
  : fail('it clears once the table recovers', JSON.stringify({ stillThere: aAfter }));
/* the card's wording is #155's, and it says "the people on this record" rather than "contacts" —
   the first version of this check looked for the word "contact" and went red on a correct app. */
(aCard && /people on this record|contact|الأشخاص|جهات/i.test(aCard)) ? pass("#155's card notice still works", JSON.stringify(aCard))
  : fail("#155's card notice still works", JSON.stringify(aCard));
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
