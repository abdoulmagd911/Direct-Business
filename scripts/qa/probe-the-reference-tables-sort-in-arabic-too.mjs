/* probe-the-reference-tables-sort-in-arabic-too.mjs — the Airlines and Providers tables sort by the
   word in the cell, in the language being read.

   Fire #229, the sweep M75 asked for: having fixed the Leads table (#228) and the Clients table
   (#99), every other clickable column in the app was driven the same way — Airlines and Providers
   are the rest of them. Two of those columns do not show the value they were sorted by:

     · AUTHORITY collapses whatever `ticketingAuthority` holds into one of two words, "Authorized"
       or "Target", and both are translated on screen;
     · KSA BSP shows a Yes / No tag, translated too.

   Ordering the raw value therefore ordered the Arabic page by the English word underneath. Live on
   the register that came out backwards: the Authority column read مصرّح (80) then مستهدف (56),
   where Arabic puts مستهدف first — س sorts before ص. The blocks were right and their ORDER was
   wrong, which is the half M75 says grouping alone cannot prove. Yes / No survived only by luck:
   لا / نعم happen to fall in the same order as No / Yes.

   The Arabic words come from js/21's own dictionary through the v27Word lookup added in the same
   fire — never a second copy of them inside the renderer (M38).

   What this holds:
     1. English: Authority groups into one block per word, Authorized before Target;
     2. Arabic: one block per word, in ARABIC order — this is the check that was failing;
     3. Arabic: KSA BSP likewise, and still grouped;
     4. the brake this fix needed twice: a cell holding nothing but a dash sorts with the blanks,
        at the bottom of an ascending sort — four carriers store the em dash itself in `stock`, and
        collation files punctuation BEFORE digits, so the first version of the fix threw them to
        the top of the list;
     5. rows whose key is equal come back in name order, not in whatever order the previous sort
        happened to leave them in;
     6. Providers is unharmed — its Type column still groups every repeated type into one block;
     7. no JS errors, and nothing was written.

   The harness register does not carry the mixture this needs (two authority wordings, a blank one,
   and a dash in the stock column), so the probe writes it into the page first. Nothing reaches the
   database: every write is refused at the network edge and the count is asserted.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the sort key put back to the raw value — fails 2 AND 5: the Arabic column comes back in
       English order (مصرّح before مستهدف), and the two Authorized rows lose their name order too,
       because the raw strings differ ("Authorized — BSP KSA" vs "Authorized (direct)") so the
       tie-break never gets a say. Check 1 still passes, which is the point of having check 2:
       in English both raw wordings happen to sort together anyway;
     · the dash treated as an ordinary value — fails 4, with the dashes at the top of the column.
   Run: node scripts/qa/probe-the-reference-tables-sort-in-arabic-too.mjs                         */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9258 — one mock. */
const PORT = 9258; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  const wrote = [];
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(m + ' ' + u.pathname.replace('/rest/v1/', ''));
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
  await p.goto(BASE + '/airlines', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof supSortBy === 'function', { timeout: 120000 });
  await p.waitForFunction(() => { try { return (DB.airlines || []).length >= 5; } catch (_) { return false; } }, { timeout: 120000 });
  await p.waitForTimeout(2500);

  /* the mixture the register has and the harness does not: two authority wordings that are NOT
     simply "Authorized"/"Target" (the cell collapses them, which is the whole point), one with no
     authority at all, and a dash sitting in the stock column where a number would be. The names are
     chosen so that group order and name order disagree — otherwise checks 1, 2 and 5 would all pass
     on the same accident. */
  const seeded = await p.evaluate(() => {
    const A = (DB.airlines || []);
    if (A.length < 5) return null;
    const plan = [
      { auth: 'Authorized — BSP KSA', stock: '220', name: 'ZZ Probe Carrier A' },
      { auth: 'Target Q4 2026',       stock: '105', name: 'AA Probe Carrier B' },
      { auth: 'Authorized (direct)',  stock: '—',   name: 'MM Probe Carrier C' },
      { auth: 'Not yet — reviewing',  stock: '—',   name: 'BB Probe Carrier D' },
      { auth: '',                     stock: '014', name: 'YY Probe Carrier E' },
    ];
    plan.forEach((s, i) => { A[i].ticketingAuthority = s.auth; A[i].stock = s.stock; A[i].name = s.name; A[i].ksa = i % 2 ? 'No' : 'Yes'; });
    current = 'airlines'; openSup = null; render();
    return { n: A.length };
  });
  await p.waitForTimeout(3000);
  if (!seeded) { await ctx.close(); return { seeded: null }; }

  const read = async (k, col) => {
    await p.evaluate((kk) => { try { window.supSort = { k: '__none__', dir: 1 }; supSortBy(kk); } catch (_) {} }, k);
    await p.waitForTimeout(900);
    const asc = await p.evaluate((c) => [].slice.call(document.querySelectorAll('#view table tbody tr'))
      .map((r) => ({ v: ((r.cells[c] || {}).innerText || '').replace(/\s+/g, ' ').trim(),
                     n: ((r.querySelector('td:nth-child(3) b') || {}).textContent || '').trim() })), col);
    await p.evaluate((kk) => { try { supSortBy(kk); } catch (_) {} }, k);
    await p.waitForTimeout(900);
    const desc = await p.evaluate((c) => [].slice.call(document.querySelectorAll('#view table tbody tr'))
      .map((r) => ({ v: ((r.cells[c] || {}).innerText || '').replace(/\s+/g, ' ').trim(),
                     n: ((r.querySelector('td:nth-child(3) b') || {}).textContent || '').trim() })), col);
    return { asc, desc };
  };
  const auth = await read('ticketingAuthority', 6);
  const ksa = await read('ksa', 5);
  const stock = await read('stock', 4);
  await p.evaluate(() => { try { current = 'vendors'; openSup = null; render(); } catch (_) {} });
  await p.waitForTimeout(2500);
  const type = await read('type', 3);
  await ctx.close();
  return { seeded, auth, ksa, stock, type, errors, wrote };
}

const blocks = (seq) => { const g = []; seq.forEach((v) => { if (!g.length || g[g.length - 1][0] !== v) g.push([v, 1]); else g[g.length - 1][1]++; }); return g; };
const vals = (rows) => rows.map((r) => r.v);

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
if (!en.seeded || !ar.seeded) { console.log('FAIL · the probe could not build its own case — too few carriers in the harness'); process.exit(1); }
console.log('  seeded ' + en.seeded.n + ' carriers: two authority wordings, one with none, two with a dash for a stock number');

const enA = blocks(vals(en.auth.asc).filter((v) => v && v !== '—'));
(enA.length === 2 && enA[0][0] === 'Authorized' && enA[1][0] === 'Target')
  ? pass('English: Authority is one block per word, Authorized then Target', JSON.stringify(enA))
  : fail('English: Authority is one block per word, Authorized then Target', JSON.stringify(enA));

const arA = blocks(vals(ar.auth.asc).filter((v) => v && v !== '—'));
const wantA = ['مصرّح', 'مستهدف'].sort((x, y) => x.localeCompare(y, 'ar', { sensitivity: 'base', numeric: true }));
(arA.length === 2 && arA.map((x) => x[0]).join('|') === wantA.join('|'))
  ? pass('Arabic: Authority is one block per word, in Arabic order', JSON.stringify(arA.map((x) => x[0])))
  : fail('Arabic: Authority is one block per word, in Arabic order', JSON.stringify({ got: arA.map((x) => x[0]), want: wantA }));

const arK = blocks(vals(ar.ksa.asc).filter((v) => v && v !== '—'));
const wantK = ['نعم', 'لا'].sort((x, y) => x.localeCompare(y, 'ar', { sensitivity: 'base', numeric: true }));
(arK.length === 2 && arK.map((x) => x[0]).join('|') === wantK.join('|'))
  ? pass('Arabic: KSA BSP is one block per word, in Arabic order', JSON.stringify(arK.map((x) => x[0])))
  : fail('Arabic: KSA BSP is one block per word, in Arabic order', JSON.stringify({ got: arK.map((x) => x[0]), want: wantK }));

let dashOk = true; const dashDetail = [];
for (const [lang, res] of [['en', en], ['ar', ar]]) {
  const v = vals(res.stock.asc); const firstDash = v.indexOf('—'); const lastValue = v.map((x, i) => (x && x !== '—') ? i : -1).filter((i) => i >= 0).pop();
  if (firstDash === -1 || lastValue === undefined || firstDash < lastValue) { dashOk = false; dashDetail.push({ lang, first: v.slice(0, 4), firstDash, lastValue }); }
}
dashOk ? pass('a dash in the stock column sorts with the blanks, at the bottom')
       : fail('a dash in the stock column sorts with the blanks, at the bottom', JSON.stringify(dashDetail));

const tiedNames = en.auth.asc.filter((r) => r.v === 'Authorized').map((r) => r.n);
const tiedProper = tiedNames.slice().sort((x, y) => x.localeCompare(y, 'en', { sensitivity: 'base', numeric: true }));
(tiedNames.length >= 2 && tiedNames.join('|') === tiedProper.join('|'))
  ? pass('rows with an equal key come back in name order', JSON.stringify(tiedNames.slice(0, 4)))
  : fail('rows with an equal key come back in name order', JSON.stringify({ got: tiedNames, want: tiedProper }));

const enT = blocks(vals(en.type.asc).filter(Boolean));
const enTd = new Set(vals(en.type.asc).filter(Boolean)).size;
(enT.length === enTd && enT.length > 0)
  ? pass('Providers: the Type column still groups every repeated type into one block', enT.length + ' blocks over ' + enTd + ' types')
  : fail('Providers: the Type column still groups every repeated type into one block', JSON.stringify(enT));

const errs = en.errors.concat(ar.errors); const wrote = en.wrote.concat(ar.wrote);
(errs.length === 0 && wrote.length === 0)
  ? pass('no JS errors, and nothing was written')
  : fail('no JS errors, and nothing was written', JSON.stringify({ errors: errs.slice(0, 2), wrote: wrote.slice(0, 3) }));

process.exit(bad.length ? 1 : 0);
