/* probe-the-ops-board-says-why-it-is-empty.mjs — the Operations board says whether it is empty
   because nothing was created or because nothing matched, and says nothing when it is full.

   Fire #210. Opened live against the real database, the Operations board was 210 characters of
   page: five tiles reading 0 (Open requests · SLA overdue · Awaiting client · Needs a cost
   recorded · Delivered / closed) and five columns each holding a single em-dash. Not one word.

   A person reading that cannot tell "nothing has been created yet" from "it failed to load" or
   "I am not allowed to see these" — the M53 shape, which this project has already been bitten by
   on Finance. And the app answers it everywhere else: Projects says "No active projects.",
   Tickets "No tickets yet.", Bookings and Invoices each say theirs, and the three Finance capture
   tabs were verified saying theirs in fire #207. Operations was the last board that did not.

   Two silences need two different sentences, and the second one is the trap: a board emptied by a
   SEARCH must name the search and say how many requests exist, or a filtered board reads as an
   empty app.

   What this holds:
     1. with no requests at all, the board says so in English, and says the zeros mean nothing was
        created rather than that something failed;
     2. the same in Arabic;
     3. brake: with requests on the board there is NO notice — a line that is always there is
        furniture, not information;
     4. brake: with requests present and a search that matches none, the notice is the SEARCH one
        and it names how many requests exist — it must never say the app is empty;
     5. the five counter tiles are still on the page (the notice adds a sentence, it does not
        replace what was there);
     6. no JS errors in either language.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched), a real run:
     · removing the notice block from drawReqBoard — fails 1, 2 and 4, and prints the empty board
       it leaves behind.
   Run: node scripts/qa/probe-the-ops-board-says-why-it-is-empty.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9240 — one mock. */
const PORT = 9240; const BASE = 'http://localhost:' + PORT;

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

await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

/* The workspace keeps loading in the background for a second or two after a render and puts its
   own requests back, so applying a fixture and reading it a moment later is a race — the first cut
   of this probe "tested" an empty board that had seven requests on it. The fixture is applied, the
   board re-drawn and the notice read inside ONE evaluate, with nothing awaited in between, so no
   load can land in the middle. The render path is exercised too (openOps), and it is the same
   drawReqBoard that renders the notice either way. */
const openOps = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); current = 'ops'; openLead = null; render(); } catch (_) {} }, lang);
  await p.waitForTimeout(2600);
};
const readWith = (requests, q) => p.evaluate(([rs, qq]) => {
  try { DB.requests = rs.slice(); drawReqBoard(qq || ''); } catch (_) {}
  const v = document.querySelector('#view'); const n = v ? v.querySelector('.ops-empty') : null;
  return { note: n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : null,
    tiles: v ? v.querySelectorAll('.kpi').length : 0,
    cards: v ? v.querySelectorAll('#reqboard .col .card, #reqboard .col [draggable]').length : 0,
    held: (DB.requests || []).length };
}, [requests, q]);
const REQS = [
  { id: 'qa-req-1', client: 'QA Client One', service: 'Flights', detail: 'QA detail one', stage: 'New', owner: 'QA', created: '2026-09-01' },
  { id: 'qa-req-2', client: 'QA Client Two', service: 'Hotels', detail: 'QA detail two', stage: 'Quoting', owner: 'QA', created: '2026-09-02' }
];

await openOps('en');
const emptyEn = await readWith([], '');
const full = await readWith(REQS, '');
const searched = await readWith(REQS, 'zzzz-no-such-thing');
await openOps('ar');
const emptyAr = await readWith([], '');
await b.close(); srv.close?.();

const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const checks = [
  ['with no requests the board says so in English, and says the zeros are not a failure',
    !!emptyEn.note && /No requests yet/.test(emptyEn.note) && /not because anything failed/.test(emptyEn.note),
    JSON.stringify(emptyEn)],
  ['the same in Arabic',
    !!emptyAr.note && arabic(emptyAr.note) && !/No requests yet/.test(emptyAr.note),
    JSON.stringify(emptyAr)],
  ['brake: with requests on the board there is no notice at all',
    full.note === null, JSON.stringify(full)],
  ['brake: a search that matches nothing says so, and names how many requests exist',
    !!searched.note && /No request matches your search/.test(searched.note) && /2 requests/.test(searched.note) && !/No requests yet/.test(searched.note),
    JSON.stringify(searched)],
  ['the five counter tiles are still there — the sentence was added, nothing was taken away',
    emptyEn.tiles >= 5 && full.tiles >= 5, JSON.stringify({ empty: emptyEn.tiles, full: full.tiles })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
