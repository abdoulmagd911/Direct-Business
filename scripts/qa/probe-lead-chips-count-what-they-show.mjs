/* probe-lead-chips-count-what-they-show.mjs — the Leads stage chips, in both languages.

   Each chip carries a number, and people read those numbers before they read the list. The stage
   chips were fixed on 2026-08-09 (the vocabulary was wrong AND clicking one filtered nothing), and
   nothing has guarded them since — dozens of layers have been added over that page in the meantime,
   and fire #98 found one of them rewriting the table's own headers on every redraw.

   Driven against the real database in fire #100, every chip's badge matched its rows exactly, in
   English and in Arabic: All 78, Prospect 53, Contacted 25, Qualified 0, Proposal 0, Won 0, Lost 2.
   The toggles (Hide closed, Needs attention, Mine) each returned the list to 78 when switched back.
   Nothing was wrong. This probe exists so it stays that way: a badge that drifts from the list
   underneath it is a number presented as a fact that is not one, which is the failure this project
   treats most seriously.

   Two things worth knowing before reading a chip count by hand, both of which made a first pass of
   this look broken when it was not:
     · a filter that matches nothing still renders ONE row — the "nothing here" line — so rows must
       be counted excluding it, or every empty chip reads as off-by-one;
     · the chips' own container element repeats every chip's text, so a naive sweep sees an extra
       "chip" holding all the labels at once.

   The toggles are DRIVEN and PRINTED but not asserted on. In the harness all three leave the count
   unchanged (on = off = base), so a check on them could not fail here — and this session's own rule
   is that an unfalsifiable check is worse than none. Live, against the real database, they do move
   the list (Hide closed 80/78, Needs attention 71/78, Mine 0/78); the printed line is there so a
   person re-running this can see whether that is still true.

   Sabotage-tested: with core-09's `v26_3LeadCount` returning a fixed number, 2 checks go FAIL,
   exit 1, and the printed line shows every badge detached from its list (All 99/33, Prospect 99/12…).
   Run: node scripts/qa/probe-lead-chips-count-what-they-show.mjs                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9077; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof drawLeads === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { try { current = 'leads'; openLead = null; render(); } catch (_) { } });
  await p.waitForTimeout(2500);

  const chipList = () => p.evaluate(() => [].slice.call(document.querySelectorAll('#view .chip, #view [class*=chip]'))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 10; })
    .map((e, i) => ({ i, text: (e.innerText || '').replace(/\s+/g, ' ').trim() }))
    /* the chips' own container repeats every label; a real chip is one short label plus a number */
    .filter((x) => x.text && x.text.length < 40));
  /* a filter matching nothing still renders the "nothing here" row — it is not a lead */
  const rowsNow = () => p.evaluate(() => [].slice.call(document.querySelectorAll('#view tbody tr')).filter((r) => !r.querySelector('td[colspan]')).length);

  const chips = await chipList();
  const seen = [];
  for (const c of chips) {
    await p.evaluate((i) => { const els = [].slice.call(document.querySelectorAll('#view .chip, #view [class*=chip]')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 10; }); if (els[i]) els[i].click(); }, c.i);
    await p.waitForTimeout(1500);
    const m = c.text.match(/(\d+)\s*$/);
    seen.push({ label: c.text.replace(/\s*\d+\s*$/, '').trim(), badge: m ? Number(m[1]) : null, rows: await rowsNow() });
  }

  /* the toggles: each must put the list back where it found it */
  await p.evaluate(() => { try { leadFilter.stage = 'all'; drawLeads(); } catch (_) { } });
  await p.waitForTimeout(1500);
  const base = await rowsNow();
  const btnIdx = await p.evaluate(() => [].slice.call(document.querySelectorAll('#view button'))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 10; })
    .map((e, i) => ({ i, t: (e.innerText || '').replace(/\s+/g, ' ').trim() }))
    .filter((x) => /closed|attention|mine|المغلقة|انتباه|خاص بي/i.test(x.t)));
  const toggles = [];
  for (const t of btnIdx) {
    const click = (i) => p.evaluate((j) => { const els = [].slice.call(document.querySelectorAll('#view button')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 10; }); if (els[j]) els[j].click(); }, i);
    await click(t.i); await p.waitForTimeout(1500); const on = await rowsNow();
    await click(t.i); await p.waitForTimeout(1500); const off = await rowsNow();
    toggles.push({ t: t.t, on, off });
  }
  await ctx.close();
  return { chips: seen, base, toggles };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
for (const [k, r] of [['EN', en], ['AR', ar]]) {
  console.log(`  ${k}: ` + r.chips.map((c) => `${c.label} ${c.badge}/${c.rows}`).join(' · '));
  console.log(`      base ${r.base} · toggles ` + r.toggles.map((t) => `${t.t} on=${t.on} off=${t.off}`).join(' · '));
}

const counted = (r) => r.chips.filter((c) => c.badge !== null);
const checks = [
  ['the chips were really found and clicked in both languages, so nothing below passes by absence',
    counted(en).length >= 5 && counted(ar).length >= 5],
  ['at least one chip has a non-zero count, so the comparison has something to be wrong about',
    counted(en).some((c) => c.badge > 0) && counted(ar).some((c) => c.badge > 0)],
  ['EN: every chip\'s number is the number of leads it then shows', counted(en).every((c) => c.badge === c.rows)],
  ['AR: the same, in Arabic', counted(ar).every((c) => c.badge === c.rows)],
  ['the two languages count the same leads — a translation must not change a number',
    JSON.stringify(counted(en).map((c) => c.badge)) === JSON.stringify(counted(ar).map((c) => c.badge))],
  ['the list really had rows to filter', en.base > 0 && ar.base > 0],
  ['clicking chips and toggles wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
