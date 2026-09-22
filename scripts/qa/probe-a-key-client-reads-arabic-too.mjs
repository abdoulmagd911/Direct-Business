/* probe-a-key-client-reads-arabic-too.mjs — the two plainest words on two pages, and the line
   between the app's furniture and a record's own name.

   Fire #218. Every page was read in Arabic against the real database, looking only at the app's
   own furniture — buttons, headings, table headings, badges — and ignoring anything that is a
   record's data. Two things came back:

     Clients, tier column:   «قياسي»  for a standard client, and  KEY  for a key one.
     Airlines, "BSP السعودية": Yes, in Latin, on every one of the 136 rows.

   The Arabic dictionary (js/21) already held 'Key' → «رئيسي». The Clients table writes the badge
   SHOUTED (`<span class="tag">KEY</span>`) and the dictionary matches whole strings exactly, so the
   standard clients read Arabic and the important ones read English, in the same column. "Yes" and
   "No" were simply never in the dictionary at all.

   Fixed by adding the shouted spelling and the two words — NOT by making the dictionary
   case-insensitive, which would start matching words that layer has deliberately kept out of it.

   What this holds:
     1. in Arabic, a key client's badge is Arabic — and so is a standard client's;
     2. in Arabic, the Saudi-BSP badge is Arabic on both a Yes airline and a No one;
     3. in English, all four still read KEY / Standard / Yes / No — the Arabic pass does not leak
        into the English page;
     4. the brake, and the point of the whole design: a record whose NAME is one of those words is
        left alone. An airline actually called "Yes" still reads "Yes" on the Arabic page, and a
        client called "KEY Holding QA" keeps its name. A translation pass that cannot tell a badge
        from a company name is worse than no translation pass;
     5. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · removing the two additions from the dictionary — fails 1 and 2, printing KEY and Yes back;
     · translating every <td> on every page (the careless way to catch them) — fails 4, with the
       airline named "Yes" renamed to «نعم» on screen.
   Run: node scripts/qa/probe-a-key-client-reads-arabic-too.mjs                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9247 — one mock. */
const PORT = 9247; const BASE = 'http://localhost:' + PORT;

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

await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

const seeded = await p.evaluate(() => {
  try {
    const B = DB.businesses || []; const src = B.find((x) => x.isClient) || B[0]; if (!src) return { ok: false };
    const mk = (id, name, tier) => { const c = JSON.parse(JSON.stringify(src));
      c.id = id; c.isClient = true; c.name = name; c.tier = tier; c.stage = 'Won'; c.status = 'Won';
      c.activities = []; if (c.raw) c.raw = {}; B.push(c); };
    mk('qa_tier_key', 'QAKEY Alpha', 'Key');
    mk('qa_tier_std', 'QASTD Beta', 'Standard');
    /* the brake: a company whose NAME is the word itself */
    mk('qa_tier_name', 'KEY Holding QA', 'Standard');
    const A = DB.airlines || [];
    const a0 = A[0] ? JSON.parse(JSON.stringify(A[0])) : { id: 'x', name: 'x' };
    const mka = (id, name, ksa) => { const a = JSON.parse(JSON.stringify(a0)); a.id = id; a.name = name; a.ksa = ksa; A.push(a); };
    mka('qa_air_yes', 'QAAIR Yesline', 'Yes');
    mka('qa_air_no', 'QAAIR Noline', 'No');
    mka('qa_air_named', 'Yes', 'Yes');      /* an airline actually called Yes */
    return { ok: true, clients: B.length, airlines: A.length };
  } catch (e) { return { ok: false, err: e.message }; }
});
await p.waitForTimeout(400);

const readPage = async (lang, page) => {
  await p.evaluate(([l, pg]) => { try { LANG = l; if (typeof applyLang === 'function') applyLang();
    current = pg; openLead = null;
    if (typeof leadFilter !== 'undefined') { leadFilter.q = ''; leadFilter.stage = 'all'; leadFilter.mine = false; }
    if (window.leadAttnSet) window.leadAttnSet(false);
    render(); } catch (_) {} }, [lang, page]);
  await p.waitForTimeout(2800);
  return p.evaluate(() => {
    const cell = (rowText, idx) => {
      const tb = document.querySelector('#view table'); if (!tb) return null;
      const tr = [...tb.querySelectorAll('tbody tr')].find((r) => new RegExp(rowText).test(r.innerText || ''));
      if (!tr) return null; const td = tr.querySelectorAll('td');
      return td[idx] ? (td[idx].innerText || '').replace(/\s+/g, ' ').trim() : null;
    };
    return { cell2: cell('QAKEY Alpha', 2), cell2b: cell('QASTD Beta', 2), nameRow: cell('KEY Holding QA', 0),
      airYes: cell('QAAIR Yesline', 5), airNo: cell('QAAIR Noline', 5),
      namedAirlineCell: (() => { const tb = document.querySelector('#view table'); if (!tb) return null;
        const tr = [...tb.querySelectorAll('tbody tr')].find((r) => { const b = r.querySelector('td:nth-child(3) b'); return b && (b.textContent || '').trim() === 'Yes' || b && (b.textContent || '').trim() === 'نعم'; });
        if (!tr) return 'ROW-NOT-FOUND'; const b = tr.querySelector('td:nth-child(3) b'); return (b.textContent || '').trim(); })() };
  });
};
const arClients = await readPage('ar', 'clients');
const arAir = await readPage('ar', 'airlines');
const enClients = await readPage('en', 'clients');
const enAir = await readPage('en', 'airlines');
await b.close(); srv.close?.();

const isAr = (s) => /[؀-ۿ]/.test(String(s || ''));
const checks = [
  ['Arabic: a key client\'s badge is Arabic, and so is a standard one\'s',
    isAr(arClients.cell2) && isAr(arClients.cell2b) && !/KEY|Standard/i.test(String(arClients.cell2) + String(arClients.cell2b)),
    JSON.stringify({ key: arClients.cell2, standard: arClients.cell2b, seeded })],
  ['Arabic: the Saudi-BSP badge is Arabic on both a Yes airline and a No one',
    isAr(arAir.airYes) && isAr(arAir.airNo) && !/\bYes\b|\bNo\b/.test(String(arAir.airYes) + String(arAir.airNo)),
    JSON.stringify({ yes: arAir.airYes, no: arAir.airNo })],
  ['English: all four still read KEY / Standard / Yes / No',
    /KEY/.test(String(enClients.cell2)) && /Standard/.test(String(enClients.cell2b)) &&
    /Yes/.test(String(enAir.airYes)) && /No/.test(String(enAir.airNo)),
    JSON.stringify({ key: enClients.cell2, standard: enClients.cell2b, yes: enAir.airYes, no: enAir.airNo })],
  ['brake: a record whose NAME is one of those words keeps its name in Arabic',
    /KEY Holding QA/.test(String(arClients.nameRow)) && arAir.namedAirlineCell === 'Yes',
    JSON.stringify({ clientName: arClients.nameRow, airlineNamed: arAir.namedAirlineCell })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
