/* probe-a-column-sorts-by-what-is-in-it.mjs — the Leads table's Funnel and Owner columns sort by
   the text that is in the cell, in the language being read.

   Fire #228. Found by clicking every header of the Leads table against the real 80 leads, in both
   languages. Two columns sorted by something that is not on the screen:

     FUNNEL sorted by `b.source`, the raw import tag. Every live lead carries the same tag
     ("Contact Submission"), so every row's key was identical and the tie-break — the company name —
     decided the order. 78 rows holding exactly TWO funnels came out in THIRTEEN blocks, the seven
     "Website Form — B2B" rows scattered through the "Website Form — Entities" ones, ascending and
     descending, English and Arabic alike. The column headed FUNNEL did nothing to the funnel.

     OWNER sorted by the stored full name while the cell shows the nickname js/54 paints in. Live in
     Arabic that column read عبدالرحمن / أبو ناصر / أبو سليمان — back to front, ع sorting after أ.

   Same defect #99 fixed one table over on Clients, and the same remedy: sort by what is on the row,
   collating in the language being read. This probe is the Leads half of that rule.

   The harness seed has neither case — its leads do not carry two different funnels, and it has no
   Arabic nicknames — so this probe MAKES both, in the page and at the network edge. A check that
   never meets its own case is not a check.

   What this holds:
     1. English: sorting by Funnel puts each funnel in ONE block, not several;
     2. clicking again reverses those blocks rather than reshuffling them;
     3. Arabic: the same, and the blocks follow ARABIC collation, not the English one;
     4. a lead with no funnel at all — the row that reads "— source: x" — sorts last, instead of
        passing its import tag off as a funnel name;
     5. English: sorting by Owner puts each owner in one block, in the order of the names the
        reader sees — grouping alone is not enough, because the stored name groups too;
     6. Arabic: the owner blocks follow the Arabic order of the names ON SCREEN (the nicknames),
        which is the half that was wrong live;
     7. the Business column still sorts exactly as localeCompare would in the language being read —
        the regression guard on the key this fix also touched;
     8. no JS errors, and no write was attempted at any point.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · funnel key put back to b.source — fails 1, 2, 3 and 4, printing the interleaved blocks;
     · owner key put back to the stored full name — fails 5 and 6: the blocks survive, because one
       stored name still maps to one nickname, but the ORDER is the hidden one — the English column
       comes back Abdulrahman / Abu Soliman / Abu Nasser (the order of "QA Owner One / Three / Two")
       and the Arabic column in English order.
   Run: node scripts/qa/probe-a-column-sorts-by-what-is-in-it.mjs                                 */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9256 — one mock. */
const PORT = 9256; const BASE = 'http://localhost:' + PORT;

/* Three people whose Arabic nicknames sort in a DIFFERENT order from their English ones — which is
   the whole point: ع comes after أ in Arabic, and "Abdulrahman" comes before "Abu …" in English. */
const NICKS = [
  { full: 'QA Owner One',   nickname: 'Abdulrahman', nickname_ar: 'عبدالرحمن' },
  { full: 'QA Owner Two',   nickname: 'Abu Nasser',  nickname_ar: 'أبو ناصر' },
  { full: 'QA Owner Three', nickname: 'Abu Soliman', nickname_ar: 'أبو سليمان' },
];
/* Two funnels whose Arabic names sort the other way round from their English ones, so check 3 is
   a real question and not the same question as check 1. */
const FUNNELS = [
  { en: 'Website Form — Entities', ar: 'نموذج الموقع — أعمال' },
  { en: 'Website Form — B2B',      ar: 'نموذج الموقع — جهات' },
];

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
    /* the nickname map the harness does not have — js/54 asks for it through this function */
    if (/rpc\/team_nicknames/.test(u.pathname)) {
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(NICKS.map((n) => ({ full_name: n.full, nickname: n.nickname, nickname_ar: n.nickname_ar }))) });
      return; }
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof drawLeads === 'function', { timeout: 120000 });
  await p.waitForFunction(() => { try { return (DB.businesses || []).filter((x) => !x.isClient).length >= 8; } catch (_) { return false; } }, { timeout: 120000 });
  await p.waitForTimeout(2500);

  /* Build the case the live data has and the harness does not: every lead on ONE source (so a
     source-keyed sort cannot group anything), two funnels dealt out so that funnel order and name
     order disagree, three owners in the same interleaved way, and one lead with no funnel at all.
     Nothing is saved — every write is refused at the network edge, and the count is checked. */
  const seeded = await p.evaluate(({ funnels, nicks }) => {
    const leads = (DB.businesses || []).filter((x) => !x.isClient);
    if (leads.length < 8) return null;
    leads.forEach((b, i) => {
      b.source = 'QA One Source';                       /* identical on every row, as it is live */
      const f = funnels[i % 2];                          /* alternating: name order != funnel order */
      b.funnelName = f.en; b.funnelNameAr = f.ar;
      b.assignedTo = nicks[i % 3].full;
    });
    current = 'leads'; openLead = null; render();
    return { n: leads.length };
  }, { funnels: FUNNELS, nicks: NICKS });
  await p.waitForTimeout(3000);

  /* The no-funnel row has to be a row the page actually DRAWS — the table pages, so blanking the
     last lead in the array put the case off-screen and the check could not see its own subject.
     Pick one that is on the page, then clear it. */
  const orphan = await p.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll('#view table tbody tr'));
    if (!rows.length) return { err: 'no rows drawn' };
    /* find the lead behind a drawn row by the id the row's own click handler carries — the name in
       the cell is the one js/54 and js/85 paint, which is not always the stored name. */
    const idOf = (r) => { const c = r.cells && r.cells[1];
      const h = c ? String(c.getAttribute('onclick') || '') : ''; const m = h.match(/openLeadFn\('([^']+)'\)/); return m ? m[1] : null; };
    const ids = rows.map(idOf).filter(Boolean);
    if (!ids.length) return { err: 'no row carried a lead id' };
    const pick = ids[Math.floor(ids.length / 2)];
    const b = (DB.businesses || []).find((x) => String(x.id) === pick);
    if (!b) return { err: 'row id ' + pick + ' is not in DB.businesses' };
    b.funnelName = ''; b.funnelNameAr = '';              /* the "— source: x" row */
    drawLeads();
    return { id: pick, drawn: ids.length };
  });
  await p.waitForTimeout(1500);
  if (!orphan || orphan.err) return { seeded: null, why: (orphan && orphan.err) || 'no orphan' };
  seeded.orphan = orphan.id; seeded.drawn = orphan.drawn;

  const read = async (k) => {
    await p.evaluate((kk) => { try { window.leadSort = { k: '__none__', dir: 1 }; leadSortBy(kk); } catch (_) {} }, k);
    await p.waitForTimeout(1200);
    /* the company name comes from the row's own <b>, not from the whole cell: the cell also holds
       the other-language name and an Edit button, and a collation check on that soup answers a
       different question from the one the reader is asking. */
    const grab = () => p.evaluate(() => [].slice.call(document.querySelectorAll('#view table tbody tr'))
      .map((r) => { const o = [].slice.call(r.cells).map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim());
        const bb = r.querySelector('td:nth-child(2) b'); o.__name = bb ? (bb.textContent || '').trim() : '';
        return { cells: o, name: o.__name }; }));
    const asc = await grab();
    await p.evaluate((kk) => { try { leadSortBy(kk); } catch (_) {} }, k);
    await p.waitForTimeout(1200);
    const desc = await grab();
    return { asc, desc };
  };
  const funnel = await read('funnel');
  const owner = await read('owner');
  const name = await read('name');
  await ctx.close();
  return { seeded, funnel, owner, name, errors, wrote };
}

const blocks = (seq) => { const g = []; seq.forEach((v) => { if (!g.length || g[g.length - 1][0] !== v) g.push([v, 1]); else g[g.length - 1][1]++; }); return g; };
const COL = { funnel: 3, owner: 6 };
const cells = (rows, k) => rows.map((r) => String(r.cells[COL[k]] || '').replace(/ Edit.*$/, '').trim());
const nameOf = (rows) => rows.map((r) => String(r.name || '').trim());

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));
if (!en.seeded || !ar.seeded) { console.log('FAIL · the probe could not build its own case — ' + JSON.stringify({ en: en.why || 'ok', ar: ar.why || 'ok' })); process.exit(1); }
console.log('  seeded ' + en.seeded.n + ' leads over ' + FUNNELS.length + ' funnels and ' + NICKS.length + ' owners; ' + en.seeded.drawn + ' drawn, one of them left with no funnel');

const enF = blocks(cells(en.funnel.asc, 'funnel').filter((v) => v && !/^—/.test(v)));
const enFd = blocks(cells(en.funnel.desc, 'funnel').filter((v) => v && !/^—/.test(v)));
enF.length === FUNNELS.length
  ? pass('English: each funnel is one block, not several', JSON.stringify(enF))
  : fail('English: each funnel is one block, not several', JSON.stringify(enF));
(enFd.length === FUNNELS.length && enFd.map((x) => x[0]).join('|') === enF.map((x) => x[0]).reverse().join('|'))
  ? pass('clicking again reverses the blocks rather than reshuffling them', JSON.stringify(enFd.map((x) => x[0])))
  : fail('clicking again reverses the blocks rather than reshuffling them', JSON.stringify(enFd));

const arF = blocks(cells(ar.funnel.asc, 'funnel').filter((v) => v && !/^—/.test(v)));
const properArF = FUNNELS.map((f) => f.ar).sort((x, y) => x.localeCompare(y, 'ar', { sensitivity: 'base', numeric: true }));
(arF.length === FUNNELS.length && arF.map((x) => x[0]).join('|') === properArF.join('|'))
  ? pass('Arabic: one block each, in Arabic order', JSON.stringify(arF.map((x) => x[0])))
  : fail('Arabic: one block each, in Arabic order', JSON.stringify({ got: arF, want: properArF }));

const lastEn = cells(en.funnel.asc, 'funnel').slice(-1)[0] || '';
const lastAr = cells(ar.funnel.asc, 'funnel').slice(-1)[0] || '';
(/^—/.test(lastEn) && /^—/.test(lastAr))
  ? pass('a lead with no funnel sorts last, not among the funnels', JSON.stringify(lastEn.slice(0, 40)))
  : fail('a lead with no funnel sorts last, not among the funnels', JSON.stringify({ en: lastEn, ar: lastAr }));

const enO = blocks(cells(en.owner.asc, 'owner'));
const properEnO = NICKS.map((n) => n.nickname).sort((x, y) => x.localeCompare(y, 'en', { sensitivity: 'base', numeric: true }));
(enO.length === NICKS.length && enO.map((x) => x[0]).join('|') === properEnO.join('|'))
  ? pass('English: each owner is one block, in the order of the names on screen', JSON.stringify(enO.map((x) => x[0])))
  : fail('English: each owner is one block, in the order of the names on screen', JSON.stringify({ got: enO.map((x) => x[0]), want: properEnO }));

const arO = blocks(cells(ar.owner.asc, 'owner'));
const properArO = NICKS.map((n) => n.nickname_ar).sort((x, y) => x.localeCompare(y, 'ar', { sensitivity: 'base', numeric: true }));
(arO.length === NICKS.length && arO.map((x) => x[0]).join('|') === properArO.join('|'))
  ? pass('Arabic: the owner blocks follow the Arabic order of the names on screen', JSON.stringify(arO.map((x) => x[0])))
  : fail('Arabic: the owner blocks follow the Arabic order of the names on screen', JSON.stringify({ got: arO.map((x) => x[0]), want: properArO }));

let nameOk = true; const nameDetail = [];
for (const [lang, res] of [['en', en], ['ar', ar]]) {
  const got = nameOf(res.name.asc);
  const want = got.slice().sort((x, y) => x.localeCompare(y, lang, { sensitivity: 'base', numeric: true }));
  if (got.join('|') !== want.join('|')) { nameOk = false; nameDetail.push({ lang, got: got.slice(0, 4), want: want.slice(0, 4) }); }
}
nameOk ? pass('the Business column still sorts as localeCompare would, in both languages')
       : fail('the Business column still sorts as localeCompare would, in both languages', JSON.stringify(nameDetail));

const errs = en.errors.concat(ar.errors); const wrote = en.wrote.concat(ar.wrote);
(errs.length === 0 && wrote.length === 0)
  ? pass('no JS errors, and nothing was written')
  : fail('no JS errors, and nothing was written', JSON.stringify({ errors: errs.slice(0, 2), wrote: wrote.slice(0, 3) }));

process.exit(bad.length ? 1 : 0);
