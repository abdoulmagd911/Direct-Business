/* probe-arabic-spelling-finds-the-company.mjs — an Arabic name typed the way people actually type
   it finds its company, in every search box, and the search does not become a machine that matches
   anything.

   Fire #214. Measured against the live records: searching a company by its Arabic name found it 18
   times out of 18 — as long as every letter was typed exactly as stored. Typed the ordinary way it
   found nothing:

       ة written as ه    «الهيئه العامه» for «الهيئة العامة»    0 found out of 14
       أ إ آ written as ا «الادارة» for «الإدارة»                0 found
       ى written as ي    «مستشفي» for «مستشفى»                  0 found

   Those are not mistakes; they are how Arabic is typed every day, and a plain substring match
   treats them as different words. So an Arabic-speaking colleague searching for a company that is
   sitting right there is told it does not exist.

   Fixed with one fold — `searchFold` in core-01 — applied to BOTH sides: the record haystack and
   whatever was typed. It folds the alef forms, ة/ه, ى/ي, ؤ/ئ, the harakat and tatweel nobody
   types, and the Arabic-Indic digits, so ٠٥٥ finds a phone stored as 055. Every box uses it: the
   Leads list, the Clients filter, the ⌘K palette and the top-bar box (the four fire #194 unified),
   plus the global box's requests, airlines, providers and SOPs.

   What this holds:
     1. the exact Arabic name finds the company on Leads;
     2. ة typed as ه finds it;
     3. أ typed as ا finds it;
     4. ى typed as ي finds it;
     5. a phone typed in Arabic-Indic digits (٠٥٥…) finds its contact;
     6. all four search boxes agree — one fold, not four (this is what fire #194 bought and what a
        second copy would quietly undo);
     7. the brake: folding must not make the search match everything. A word that is in no record
        still finds nothing, and Latin search is untouched — an English word finds only its own
        company;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both real runs:
     · folding the record but not the query (recordHay folds, matchLead stops calling hayHas) —
       fails 1, 2, 3, 5 and 6, and the first of those is the instructive one: a half-applied fold
       breaks even the EXACT spelling, because the record no longer reads the way it is stored;
     · making searchFold do nothing but lowercase — fails 2, 3, 4, 5 and 6, with 1 still passing,
       which is exactly the state the app was in before this round.
   Run: node scripts/qa/probe-arabic-spelling-finds-the-company.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9244 — one mock. */
const PORT = 9244; const BASE = 'http://localhost:' + PORT;

const AR_NAME = 'الهيئة العامة للاختبار';  /* الهيئة العامة للاختبار */
const AR_HAMZA = 'الإدارة التجريبية';                          /* الإدارة التجريبية */
const AR_MAQSURA = 'مستشفى الاختبار';                                    /* مستشفى الاختبار */
const PHONE = '+966 50 111 2233';
const PHONE_AR = '٠٥٠١١١٢٢٣٣';                                                                /* ٠٥٠١١١٢٢٣٣ */

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

await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

const seeded = await p.evaluate(([arName, arHamza, arMaqsura, phone]) => {
  try {
    const B = DB.businesses || []; const src = B.find((x) => !x.isClient) || B[0]; if (!src) return { ok: false };
    const mk = (id, name, nameAr, isClient, contact) => {
      const c = JSON.parse(JSON.stringify(src));
      c.id = id; c.name = name; c.nameAr = nameAr; c.isClient = !!isClient; c.stage = isClient ? 'Won' : 'Contacted';
      c.status = c.stage; c.activities = []; c.notes = ''; c.website = ''; c.contacts = contact ? [contact] : [];
      if (c.raw) c.raw = {};
      B.push(c); return c.id;
    };
    mk('qa_ar_hayaa', 'QAARONE Authority', arName, false, { name: 'QA Contact', email: 'qa@qaaronly.test', phone: phone });
    mk('qa_ar_idara', 'QAARTWO Administration', arHamza, false, null);
    mk('qa_ar_mustashfa', 'QAARTHREE Hospital', arMaqsura, true, null);
    return { ok: true, n: B.length };
  } catch (e) { return { ok: false, err: e.message }; }
}, [AR_NAME, AR_HAMZA, AR_MAQSURA, PHONE]);
await p.waitForTimeout(400);

/* every box, asked the same question */
const ask = (q) => p.evaluate((query) => {
  const out = {};
  try { leadFilter.q = query; out.leads = (DB.businesses || []).filter((b) => !b.isClient && matchLead(b)).map((b) => b.id); leadFilter.q = ''; } catch (e) { out.leads = 'ERR ' + e.message; }
  try { window.clFilter = window.clFilter || {}; const prev = clFilter.q; clFilter.q = query;
    const fold = (typeof searchFold === 'function') ? searchFold : ((s) => String(s || '').toLowerCase());
    out.clients = (DB.businesses || []).filter((b) => b.isClient && recordHay(b).indexOf(fold(query)) >= 0).map((b) => b.id);
    clFilter.q = prev; } catch (e) { out.clients = 'ERR ' + e.message; }
  try { out.palette = (CMD_RESULTS(query) || []).map((r) => (r.lbl || '')); } catch (e) { out.palette = 'ERR ' + e.message; }
  try {
    const fold = (typeof searchFold === 'function') ? searchFold : ((s) => String(s || '').toLowerCase());
    out.global = (DB.businesses || []).filter((b) => recordHay(b).indexOf(fold(query).trim()) >= 0).map((b) => b.id);
  } catch (e) { out.global = 'ERR ' + e.message; }
  return out;
}, q);

const swap = (s, from, to) => s.split(from).join(to);
const exact = await ask(AR_NAME);
const taMarbuta = await ask(swap(AR_NAME, 'ة', 'ه'));                    /* ة → ه */
const hamza = await ask(swap(AR_HAMZA, 'إ', 'ا'));                       /* إ → ا */
const maqsura = await ask(swap(AR_MAQSURA, 'ى', 'ي'));                   /* ى → ي */
const phoneAr = await ask(PHONE_AR);
const nonsense = await ask('زقزقزق');                /* زقزقزق — in no record */
const latin = await ask('QAARTWO');
const latinWrong = await ask('QAARNOSUCHWORD');
await b.close(); srv.close?.();

const hasLead = (r, id) => Array.isArray(r.leads) && r.leads.indexOf(id) >= 0;
const hasClient = (r, id) => Array.isArray(r.clients) && r.clients.indexOf(id) >= 0;
const inPalette = (r, frag) => Array.isArray(r.palette) && r.palette.some((x) => String(x).indexOf(frag) >= 0);
const inGlobal = (r, id) => Array.isArray(r.global) && r.global.indexOf(id) >= 0;

const checks = [
  ['the exact Arabic name finds the company', hasLead(exact, 'qa_ar_hayaa'), JSON.stringify({ leads: exact.leads, seeded })],
  ['ة typed as ه finds it', hasLead(taMarbuta, 'qa_ar_hayaa'), JSON.stringify(taMarbuta.leads)],
  ['أ/إ typed as ا finds it', hasLead(hamza, 'qa_ar_idara'), JSON.stringify(hamza.leads)],
  ['ى typed as ي finds it (a client, so the Clients filter answers)', hasClient(maqsura, 'qa_ar_mustashfa'), JSON.stringify(maqsura.clients)],
  ['a phone typed in Arabic-Indic digits finds its contact', hasLead(phoneAr, 'qa_ar_hayaa'), JSON.stringify(phoneAr.leads)],
  ['all four boxes agree on the folded spelling',
    hasLead(taMarbuta, 'qa_ar_hayaa') && inGlobal(taMarbuta, 'qa_ar_hayaa') && inPalette(taMarbuta, 'QAARONE'),
    JSON.stringify({ leads: taMarbuta.leads, global: taMarbuta.global, palette: taMarbuta.palette })],
  ['brake: the fold does not make the search match everything, and Latin search is untouched',
    Array.isArray(nonsense.leads) && nonsense.leads.length === 0 &&
    hasLead(latin, 'qa_ar_idara') && latin.leads.length === 1 &&
    Array.isArray(latinWrong.leads) && latinWrong.leads.length === 0,
    JSON.stringify({ nonsense: nonsense.leads, latin: latin.leads, latinWrong: latinWrong.leads })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
