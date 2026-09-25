/* probe-a-link-built-from-a-stored-value-works.mjs — a website stored without its scheme still opens the
   company's site, and a phone stored in any local shape still reaches the right number on WhatsApp and
   on a phone.

   Fire #259. Read on the live app against the real database: 78 of the 108 live companies store a
   website as "example.com", and the row's "Website" tag rendered href="example.com" — a RELATIVE link,
   which opens this app's own address with the domain appended, never the company. 8 contacts store a
   phone with no leading 0 or +, and the card rendered wa.me/5xxxxxxxx (no country code — the wrong
   person, or nobody) and tel:5xxxxxxxx (nothing a phone can dial). The same expression was copied in
   three contact lists and the send-for-review flow, and none of them knew a bare number.

   Now core-01 owns one builder — webHref, phoneE164, waHref, telHref — and every place that makes a
   link from a stored value asks it. Saudi is the default: a leading 0 or a bare 9-digit number
   becomes +966; 00 becomes +; + and 966 are kept.

   The records are planted by the probe itself (never real names or numbers — rule 7), so nothing
   here depends on the seed.

   What this holds:
     1. the card: a scheme-less website gets https:// in front; one with a scheme is left alone (the
        list pages and never shows a record planted after load, so the two row renderers and the
        Reports row are held by the source check in 3);
     2. the card's contacts: four phone shapes (bare 5…, 05…, +9665…, 009665…) all give
        wa.me/9665… and tel:+9665…; a foreign number with + is kept as it is;
     3. no naive copy is left in the source: no "https://wa.me/${" template and no
        href built straight from b.website outside the builder;
     4. the builder's own table: webHref / phoneE164 on a dozen inputs give exactly what they should
        (empty stays empty; a URL with a scheme is untouched; a bare landline 01… becomes +9661…);
     5. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): the builder kept
   naive (the old behaviour inside the helpers) — fails 1, 2 and 4; 3 stays green (the call sites are
   the same).
   Run: node scripts/qa/probe-a-link-built-from-a-stored-value-works.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9313 — one mock. */
const PORT = 9313; const BASE = 'http://localhost:' + PORT;
const APP = process.env.APP_DIR || fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
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
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
await p.waitForTimeout(3500);

/* plant two records: one bare website, one with a scheme; four phone shapes plus a foreign one */
await p.waitForFunction(() => (DB.businesses || []).some((x) => x && x.id), { timeout: 30000 });
const out = await p.evaluate(async () => {
  const src = (DB.businesses || []).find((x) => x && !x.isClient) || (DB.businesses || []).find((x) => x && x.id);
  const base = JSON.parse(JSON.stringify(src));
  const mk = (id, name, website, contacts) => Object.assign({}, base, { id, name, website, isClient: false, contacts, stage: base.stage || 'new' });
  const A = mk('qa-link-a', 'QA Link Co A', 'qa-bare.example', [
    { name: 'QA One', phone: '512345678' }, { name: 'QA Two', phone: '0512345678' },
    { name: 'QA Three', phone: '+966512345678' }, { name: 'QA Four', phone: '00966512345678' },
    { name: 'QA Five', phone: '+44 20 7946 0000' }, { name: 'QA Six', phone: '011 234 5678' }]);
  const B = mk('qa-link-b', 'QA Link Co B', 'https://qa-scheme.example/path', []);
  DB.businesses.push(A, B);
  /* the Leads list pages, and appended records land beyond page one — search for the planted names */
  current = 'leads'; openLead = null; try { leadFilter.stage = 'all'; } catch (_) {}
  render(); await new Promise((r) => setTimeout(r, 800));
  /* the list's own search box is #lq (the global search is a different thing) */
  try { const g = document.getElementById('lq'); g.value = 'QA Link Co'; g.dispatchEvent(new Event('input', { bubbles: true })); g.dispatchEvent(new Event('keyup', { bubbles: true })); } catch (_) {}
  try { if (typeof drawLeads === 'function') drawLeads(); } catch (_) {}
  await new Promise((r) => setTimeout(r, 1500));
  /* the website link is read on the CARD (the list pages and never shows a record planted after
     load; the row renderers are covered by the source check below) */
  const cardWeb = async (id, domain) => { openLead = id; render(); await new Promise((r) => setTimeout(r, 2000));
    const a = [...document.querySelectorAll('#view a[href]')].find((x) => (x.getAttribute('href') || '').indexOf(domain) >= 0); return a ? a.getAttribute('href') : null; };
  const rows = { a: await cardWeb('qa-link-b', 'qa-scheme.example'), b: null };
  rows.b = rows.a; rows.a = await cardWeb('qa-link-a', 'qa-bare.example');
  openLead = 'qa-link-a'; render(); await new Promise((r) => setTimeout(r, 2000));
  const links = [...document.querySelectorAll('#view a[href]')].map((a) => a.getAttribute('href')).filter((h) => /wa\.me|^tel:/.test(h || ''));
  const table = {
    web: ['qa-bare.example', 'www.qa-bare.example/x', 'https://qa.example', 'http://qa.example', 'mailto:x@y.z', '', '  '].map((u) => (typeof webHref === 'function') ? webHref(u) : null),
    tel: ['512345678', '0512345678', '+966512345678', '00966512345678', '+44 20 7946 0000', '011 234 5678', '966512345678', '', 'abc'].map((u) => (typeof phoneE164 === 'function') ? phoneE164(u) : null) };
  DB.businesses = DB.businesses.filter((x) => !/^qa-link-/.test(x.id)); openLead = null;
  try { const g = document.getElementById('lq'); g.value = ''; g.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
  render();
  return { rows, links, table };
});
await ctx.close(); await b.close(); srv.close?.();

/* 3. the source */
const files = [];
for (const d of ['js', 'js/core']) for (const f of fs.readdirSync(path.join(APP, d))) if (f.endsWith('.js')) files.push(d + '/' + f);
const naive = [];
for (const f of files) {
  const s = fs.readFileSync(path.join(APP, f), 'utf8');
  if (s.includes('https://wa.me/${')) naive.push(f + ': wa.me template');
  if (/href="'\+esc\(b\.website\)/.test(s)) naive.push(f + ': raw website href');
  if (!/core-01-foundation/.test(f) && /'https:\/\/wa\.me\/'\+phone/.test(s)) naive.push(f + ': wa.me string concat');
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
console.log('  two planted companies, six planted phones; links read off the cards');

(out.rows.a === 'https://qa-bare.example' && out.rows.b === 'https://qa-scheme.example/path')
  ? pass('the card: a scheme-less website gets https:// in front; one with a scheme is left alone', JSON.stringify(out.rows))
  : fail('the card: a scheme-less website gets https:// in front; one with a scheme is left alone', JSON.stringify(out.rows));

const wa = out.links.filter((h) => /wa\.me/.test(h)); const tel = out.links.filter((h) => /^tel:/.test(h));
(wa.filter((h) => h === 'https://wa.me/966512345678').length === 4 && tel.filter((h) => h === 'tel:+966512345678').length === 4
  && wa.includes('https://wa.me/442079460000') && tel.includes('tel:+442079460000') && wa.includes('https://wa.me/966112345678'))
  ? pass('the card\'s contacts: four phone shapes reach wa.me/9665… and tel:+9665…; a foreign + number is kept; a landline gets +9661…')
  : fail('the card\'s contacts: four phone shapes reach wa.me/9665… and tel:+9665…; a foreign + number is kept; a landline gets +9661…', JSON.stringify({ wa, tel }));

naive.length === 0
  ? pass('no naive copy is left in the source')
  : fail('no naive copy is left in the source', JSON.stringify(naive));

const T = out.table;
(T.web && JSON.stringify(T.web) === JSON.stringify(['https://qa-bare.example', 'https://www.qa-bare.example/x', 'https://qa.example', 'http://qa.example', 'mailto:x@y.z', '', ''])
  && T.tel && JSON.stringify(T.tel) === JSON.stringify(['+966512345678', '+966512345678', '+966512345678', '+966512345678', '+442079460000', '+966112345678', '+966512345678', '', '']))
  ? pass('the builder\'s own table: a dozen inputs give exactly what they should')
  : fail('the builder\'s own table: a dozen inputs give exactly what they should', JSON.stringify(T));

errors.length === 0 ? pass('no JS errors') : fail('no JS errors', errors.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
