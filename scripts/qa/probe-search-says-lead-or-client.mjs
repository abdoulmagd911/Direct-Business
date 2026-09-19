/* probe-search-says-lead-or-client.mjs — guards the 2026-09-20 (fire #113) fix in
   js/core/core-01-foundation.js.

   The search box at the top of every page labelled EVERY company "Lead" — the label was hardcoded —
   so all 28 companies that are clients came back as leads. On the one distinction this whole app is
   built around, and the one the owner spent two rounds of re-verification getting right in August,
   the fastest way to look a company up told you the wrong thing about it.

   The command palette (js/78) had been saying Client/عميل correctly all along, which is what made
   the difference visible when both were driven against the real database on the same day.

   The click was NOT changed: the Clients page opens its own rows with exactly the same
   `openLead=<id>; current='leads'` — the two share one detail page — so only the label moved.

   Arabic needed the word as well: the kind map had no entry for Client, so an Arabic search would
   have fallen back to the English. Note "عميل" is a prefix of "عميل محتمل", so the checks below
   compare the label exactly rather than looking for one inside the other.

   Also checked here, because it is what makes the box useful and it changed twice this week
   (fires #109 and #111): a company is findable by the NAME and by the PHONE NUMBER of a person on
   its card, not only by its own name.

   Sabotage-tested 2026-09-20, each half separately, both restored afterwards:
     · the label hardcoded back to 'Lead': 3 checks FAIL — the client is announced as a lead, in
       English and in Arabic, and the two words stop differing.
     · the digits comparison removed: 1 check FAILS — the phone number finds nothing again unless
       it is typed with the spacing it happens to be stored in.
   Run: node scripts/qa/probe-search-says-lead-or-client.mjs                                       */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9086; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'en-GB' });
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
  /* the businesses arrive a page at a time: a count read the moment the first rows land can be a
     fraction of the real one, which fooled a measurement while this was being found */
  await p.waitForTimeout(6000);

  /* one company that is a client and one that is not, each with a person on its card */
  await p.evaluate(() => {
    const B = DB.businesses || []; if (B.length < 2) return;
    B[0].name = 'Qaanoon Client Holding'; B[0].isClient = true; B[0].stage = 'Won';
    B[0].contacts = [{ name: 'Wadha Al-Suhaimi', role: 'Owner', email: 'w.suhaimi@qa-example.test', phone: '+966 50 777 6543' }];
    B[1].name = 'Qaanoon Lead Trading'; B[1].isClient = false;
    B[1].contacts = [];
    current = 'today'; openLead = null; render();
  });
  await p.waitForTimeout(2000);

  const look = async (q) => {
    await p.evaluate((qq) => {
      const i = document.querySelector('.top input, #gsearch, input[placeholder*="Search"], input[placeholder*="بحث"]');
      if (!i) return; i.focus(); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true }));
      i.value = qq; i.dispatchEvent(new Event('input', { bubbles: true }));
    }, q);
    await p.waitForTimeout(1300);
    return p.evaluate(() => {
      const items = [].slice.call(document.querySelectorAll('.gres-item'));
      return items.map((it) => ({
        kind: ((it.querySelector('.gres-t') || {}).textContent || '').trim(),
        label: ((it.querySelector('.gres-l') || {}).textContent || '').trim(),
      }));
    });
  };

  const client = await look('Qaanoon Client');
  const lead = await look('Qaanoon Lead');
  const byPerson = await look('Wadha Al-Suhaimi');
  const byPhone = await look('7776543');

  /* clicking the client result opens that company — search for it again first, so the row under
     the cursor is the one being clicked and not whatever the previous query left behind */
  await look('Qaanoon Client');
  await p.evaluate(() => { const it = document.querySelector('.gres-item'); if (it) it.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  await p.waitForTimeout(1500);
  const opened = await p.evaluate(() => ({ page: typeof current !== 'undefined' ? current : null,
    open: typeof openLead !== 'undefined' && openLead ? ((DB.businesses || []).find((b) => b.id === openLead) || {}).name || null : null }));

  await ctx.close();
  return { client, lead, byPerson, byPhone, opened };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
const first = (r) => (r && r[0]) ? r[0] : { kind: null, label: null };
console.log('  EN client', JSON.stringify(first(en.client)), '· lead', JSON.stringify(first(en.lead)));
console.log('  AR client', JSON.stringify(first(ar.client)), '· lead', JSON.stringify(first(ar.lead)));
console.log('  found by person', JSON.stringify(first(en.byPerson).label), '· by phone', JSON.stringify(first(en.byPhone).label));
console.log('  opened', JSON.stringify(en.opened));

const checks = [
  ['the search found both companies, in both languages',
    first(en.client).label === 'Qaanoon Client Holding' && first(en.lead).label === 'Qaanoon Lead Trading'
    && first(ar.client).label === 'Qaanoon Client Holding'],
  ['a client is announced as a client, not as a lead', first(en.client).kind === 'CLIENT' || first(en.client).kind === 'Client',
    'said: ' + JSON.stringify(first(en.client).kind)],
  ['a lead is still announced as a lead', first(en.lead).kind === 'LEAD' || first(en.lead).kind === 'Lead'],
  ['Arabic says the client is a client — exactly "عميل", not the phrase for a lead',
    first(ar.client).kind === 'عميل', 'said: ' + JSON.stringify(first(ar.client).kind)],
  ['Arabic still says the lead is a lead, and the two words are not the same',
    first(ar.lead).kind === 'عميل محتمل' && first(ar.client).kind !== first(ar.lead).kind],
  ['a company is findable by the name of a person on its card',
    first(en.byPerson).label === 'Qaanoon Client Holding'],
  ['and by that person\'s phone number', first(en.byPhone).label === 'Qaanoon Client Holding'],
  ['clicking the result opens that company', en.opened.open === 'Qaanoon Client Holding', JSON.stringify(en.opened)],
  ['searching wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
