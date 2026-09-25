/* probe-owner-is-told-of-changes.mjs (2026-09-25, D7) — when a colleague changes a company you own,
   Today tells you: who, which company, what changed, how long ago — and the company opens in one click.

   Why: the owner's ruling D7 ("helpers, not locks") lets anyone on the team change any company. What
   keeps that safe is that every change is recorded, can be undone, AND THE OWNER IS TOLD. js/106 is
   the telling; this probe holds it to what it promises.

   Under test (the stand-in answers changes_to_my_companies from MOCK_CHANGES_TO_MINE / MOCK_CHANGES_FAIL):
     1. two changes by colleagues → one card on Today naming both people, the company, and the
        changed field in words ("Stage", not "stage");
     2. clicking the company opens THAT company — the database names it by its row id, the app knows
        it by its older id, and the card must translate (the stand-in's companies differ in the two);
     3. in Arabic the card reads Arabic, right to left;
     4. nothing changed → no card;
     5. the read fails → no card (never a false "nothing changed"), and no JS error;
     6. at phone width (390 px) the card fits — no sideways scroll.
   Sabotage: make appId() in js/106 return its argument unchanged — check 2 goes red.
   PORT = 9334 … 9338 (one stand-in per run; free when written).                                       */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const now = Date.now();
const ROWS = [
  { history_id: 2, at: new Date(now - 2 * 3600e3).toISOString(), actor_name: 'Helper One', table_name: 'businesses', action: 'update',
    business_id: 'b3', business_name: 'Test Company 3', is_client: false,
    before_row: { stage: 'new', notes: 'a', updated_at: 'x', raw: { stage: 'new' } }, after_row: { stage: 'contacted', notes: 'a', updated_at: 'y', raw: { stage: 'contacted' } } },
  { history_id: 1, at: new Date(now - 26 * 3600e3).toISOString(), actor_name: 'Helper Two', table_name: 'contacts', action: 'create',
    business_id: 'b3', business_name: 'Test Company 3', is_client: false, before_row: null, after_row: { name: 'Someone' } },
];

async function run({ lang = 'en', rows = null, failRead = false, width = 1366, PORT }) {
  process.env.MOCK_ROLE = 'team_member';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full' });
  if (rows) process.env.MOCK_CHANGES_TO_MINE = JSON.stringify(rows); else delete process.env.MOCK_CHANGES_TO_MINE;
  if (failRead) process.env.MOCK_CHANGES_FAIL = '1'; else delete process.env.MOCK_CHANGES_FAIL;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.evaluate(() => { current = 'today'; render(); });
  await p.waitForTimeout(2500);
  const card = await p.evaluate(() => {
    const c = document.querySelector('#view .v106-changes');
    if (!c) return null;
    return { text: c.innerText, dir: c.getAttribute('dir'), right: c.getBoundingClientRect().right,
      scrollW: document.documentElement.scrollWidth, vw: window.innerWidth, links: c.querySelectorAll('[data-v106-open]').length };
  });
  let opened = null;
  if (card && card.links) {
    await p.click('#view .v106-changes [data-v106-open]');
    await p.waitForTimeout(1500);
    opened = await p.evaluate(() => ({ current, openLead, head: !!document.querySelector('#view .detail-head') }));
  }
  await b.close(); srv.close?.();
  return { card, opened, errors };
}

const en = await run({ rows: ROWS, PORT: 9334 });
(en.card && /Helper One/.test(en.card.text) && /Helper Two/.test(en.card.text) && /Test Company 3/.test(en.card.text) && /\bStage\b/.test(en.card.text) && !/notes|updated/i.test(en.card.text.split('\n').slice(1, 2).join('')))
  ? ok('two colleagues\' changes → one card naming both, the company and the field in words') : fail('English card: ' + JSON.stringify(en.card));
(en.opened && en.opened.current === 'leads' && en.opened.openLead === 'L3' && en.opened.head)
  ? ok('clicking the company opens that company (row id b3 → app id L3)') : fail('opened: ' + JSON.stringify(en.opened));

const ar = await run({ lang: 'ar', rows: ROWS, PORT: 9335 });
(ar.card && ar.card.dir === 'rtl' && /زملاؤك عدّلوا شركاتك/.test(ar.card.text) && /المرحلة/.test(ar.card.text))
  ? ok('in Arabic the card reads Arabic, right to left') : fail('Arabic card: ' + JSON.stringify(ar.card));

const none = await run({ rows: [], PORT: 9336 });
!none.card ? ok('nothing changed → no card') : fail('card shown with no changes: ' + JSON.stringify(none.card));

const bad = await run({ rows: ROWS, failRead: true, PORT: 9337 });
!bad.card ? ok('a failed read draws nothing — never a false "nothing changed"') : fail('card on a failed read: ' + JSON.stringify(bad.card));

const phone = await run({ rows: ROWS, width: 390, PORT: 9338 });
(phone.card && phone.card.right <= phone.card.vw + 1 && phone.card.scrollW <= phone.card.vw + 1)
  ? ok('at phone width the card fits, no sideways scroll') : fail('phone: ' + JSON.stringify(phone.card));

const errs = [].concat(en.errors, ar.errors, none.errors, bad.errors, phone.errors);
errs.length === 0 ? ok('no JS errors') : fail('JS errors: ' + errs.slice(0, 3).join(' | '));
console.log(failures ? 'FAILED — ' + failures : 'owner-is-told-of-changes OK — colleagues\' changes to your companies are on Today, and open in one click');
process.exit(failures ? 1 : 0);
