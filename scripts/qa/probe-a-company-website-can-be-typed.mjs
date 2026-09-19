/* probe-a-company-website-can-be-typed.mjs — guards the 2026-09-21 (fire #121) change in
   js/core/core-02-leads.js.

   Seventy-eight of the 108 live companies carry a website. The lead card shows it, the leads list
   uses its domain to spot the same company twice, and the funnel layer fetches a logo from it —
   and **no form in the app wrote it**. The only line that ever assigned `website` was a derivation
   in core-10 that guesses one from the domain of a contact's e-mail. So a website could not be
   added, corrected or removed by anybody: the second instance in two rounds of a field the app
   prints and gives nobody a way to type (fire #120 was a contact's job title).

   The form now has a Website box, in the empty half of the Stage row so no layout moves, and Save
   stores what is typed — with "https://" put in front of a bare domain, because the card renders it
   as a link and "example.com" on its own resolves against this app's own address and goes nowhere.
   Empty stays empty: nothing is invented for a company that has none.

   Checked while here and recorded so it is not re-investigated: **the core-10 derivation does not
   fire on today's data.** Driven against the real database with the database's own rows captured
   before the app could touch them — 78 companies had a website and still show it, 30 had none and
   still show none, none was invented, and no write was attempted. It reads `b.contacts` at load,
   before js/72 has brought the contacts table onto the records, and the thirty companies without a
   website have no qualifying corporate e-mail in the record itself.

   Sabotage-tested 2026-09-21 against a COPY of the app (APP_DIR — the repository is untouched):
     · the Website input removed: 5 checks FAIL — the field is unwritable again.
     · the "https://" normalisation dropped: 1 check FAILS — a bare domain is stored as a link that
       resolves against this app.
   Run: node scripts/qa/probe-a-company-website-can-be-typed.mjs                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9094; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];
const STORED = 'https://qaanoon-example.test';
const TYPED_BARE = 'qaanoon-typed.test';

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 1 && typeof editBusiness === 'function', { timeout: 120000 });
  await p.waitForTimeout(4000);

  const ids = await p.evaluate((site) => {
    const B = DB.businesses || [];
    B[0].name = 'Qaanoon Has A Site Co'; B[0].website = site;
    B[1].name = 'Qaanoon No Site Co'; B[1].website = '';
    current = 'leads'; openLead = B[0].id; render();
    return { has: B[0].id, none: B[1].id };
  }, STORED);
  await p.waitForTimeout(2500);

  const card = await p.evaluate((site) => {
    const t = ((document.getElementById('view') || {}).innerText || '');
    return { shows: t.indexOf(site.replace(/^https?:\/\//, '')) >= 0 };
  }, STORED);

  /* what the box offers, and what Save does with three different things typed into it */
  const edit = async (id, typeValue) => {
    await p.evaluate((i) => { current = 'leads'; openLead = i; render(); editBusiness(i); }, id);
    await p.waitForTimeout(1600);
    const box = await p.evaluate(() => {
      const e = document.getElementById('f_web'); if (!e) return null;
      const lab = e.closest('.field') ? (e.closest('.field').querySelector('label') || {}).textContent : '';
      return { value: e.value, label: String(lab || '').trim() };
    });
    const after = await p.evaluate(({ i, v }) => {
      const e = document.getElementById('f_web');
      if (e && v !== null) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      const btns = [].slice.call(document.querySelectorAll('#modal button, .modal button'));
      const save = btns.find((x) => /^\s*(Save|حفظ)/.test(x.textContent || ''));
      if (save) save.click();
      const x = (DB.businesses || []).find((y) => y.id === i) || {};
      return { clicked: !!save, website: x.website || '', name: x.name };
    }, { i: id, v: typeValue });
    await p.waitForTimeout(1000);
    return { box, after };
  };

  const untouched = await edit(ids.has, null);            // opened and saved with nothing typed
  const bare = await edit(ids.has, TYPED_BARE);           // a bare domain
  const cleared = await edit(ids.has, '');                // emptied on purpose
  const neverHad = await edit(ids.none, null);            // a company with none, saved untouched

  await ctx.close();
  return { card, untouched, bare, cleared, neverHad };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN box:', JSON.stringify(en.untouched.box), '· AR box:', JSON.stringify(ar.untouched.box));
console.log('  EN after: untouched', JSON.stringify(en.untouched.after.website),
  '· bare typed ->', JSON.stringify(en.bare.after.website),
  '· cleared ->', JSON.stringify(en.cleared.after.website),
  '· never had ->', JSON.stringify(en.neverHad.after.website));

const AR_LABEL = 'الموقع الإلكتروني';
/* a missing box must make a check FAIL, not make this file throw: a probe that explodes still
   exits non-zero, but it stops at the first null and says nothing about the rest — which is
   exactly what it did the first time the sabotage was run against it. */
const bx = (r) => (r && r.box) ? r.box : { value: null, label: '' };
const checks = [
  ['the lead form has a website box at all', !!(en.untouched && en.untouched.box) && !!(ar.untouched && ar.untouched.box),
    JSON.stringify({ en: !!(en.untouched && en.untouched.box), ar: !!(ar.untouched && ar.untouched.box) })],
  ['it carries the website that is stored, rather than starting empty',
    bx(en.untouched).value === STORED && bx(ar.untouched).value === STORED,
    JSON.stringify({ en: bx(en.untouched).value, ar: bx(ar.untouched).value })],
  ['its label reads in the page\'s own language',
    /Website/i.test(bx(en.untouched).label) && bx(ar.untouched).label.indexOf(AR_LABEL) >= 0,
    JSON.stringify({ en: bx(en.untouched).label, ar: bx(ar.untouched).label })],
  ['opening the form and saving without touching it leaves the website exactly as it was',
    en.untouched.after.website === STORED && ar.untouched.after.website === STORED,
    JSON.stringify({ en: en.untouched.after.website, ar: ar.untouched.after.website })],
  ['a website typed as a bare domain is stored as a real link, not as one that points back at this app',
    en.bare.after.website === 'https://' + TYPED_BARE && ar.bare.after.website === 'https://' + TYPED_BARE,
    JSON.stringify({ en: en.bare.after.website, ar: ar.bare.after.website })],
  ['emptying the box removes the website instead of putting the old one back',
    en.cleared.after.website === '' && ar.cleared.after.website === '',
    JSON.stringify({ en: en.cleared.after.website, ar: ar.cleared.after.website })],
  ['a company that has no website is not given one by opening its form',
    en.neverHad.after.website === '' && ar.neverHad.after.website === '',
    JSON.stringify({ en: en.neverHad.after.website, ar: ar.neverHad.after.website })],
  ['the card shows a company\'s website, which is why it has to be correctable',
    en.card.shows && ar.card.shows, JSON.stringify({ en: en.card, ar: ar.card })],
  ['Save really tried to store the record, and the attempt went no further than this test',
    en.untouched.after.clicked && wrote.filter((w) => /businesses|save_state/.test(w)).length >= 2,
    JSON.stringify(wrote.filter((w) => !/finance_client_links/.test(w)).slice(0, 4))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
