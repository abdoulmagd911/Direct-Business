/* probe-one-needs-attention-not-two.mjs — the Leads page's two "⚠ Needs attention" controls are
   one filter: one rule, one on/off state, one count, and they say what they mean.

   Fire #216. Driven live, the Leads page carried TWO controls with the same words a few
   centimetres apart:

       ⚠ Needs attention · 71        (js/09's chip strip)
       ⚠ Needs attention             (core-10's toolbar button, no count)

   They used DIFFERENT rules — the chip meant "no contact person, or an overdue next action, or
   flagged for confirmation", the button meant "no contact person, or no source" — and they kept
   SEPARATE flags (`window.__needsAttn` and `leadFilter.attention`). Measured: clicking the chip
   filtered 78 rows down to 71 and left the button dark; clicking the button then lit it while the
   list did not move, because the chip had already filtered to the same rows. Nothing on screen
   said which of the two was doing it, and switching one off left the other holding the filter.

   The two rules agreed on the live data by luck, not by design: no lead lacks a source today, and
   the one record flagged for confirmation also has no contact person. Either fact changing would
   have made the same page show two different answers to the same question.

   And neither said what it meant. The warning flags 71 of 80 leads — nine tenths of the list — on
   the strength of one word.

   Unifying the RULE was not enough, and this probe caught the rest: driven in the harness straight
   afterwards the chip read 33 and the button read 45, because they counted different POOLS — the
   chip counts the leads the table is actually showing (live, un-archived, and minus Won/Lost while
   "Hide closed" is on), the button counted every non-client row in memory, and the tooltip had a
   third pool of its own. Three numbers, one question. On the live data the three happened to agree,
   so only a harness with archived and closed leads in it showed the gap.

   Fixed: js/09 owns the rule (`leadAttention`), the reasons (`leadAttentionWhy`), the wording
   (`leadAttentionTitle`), the pool (`leadAttnPool`), the count (`leadAttnCount`) and the setter
   that keeps both flags in step (`leadAttnSet`). core-10's button asks for all of them instead of
   keeping its own.

   What this holds:
     1. both controls show the same count, and that count is the number of rows the filter leaves —
        the check that catches a second pool rather than a second rule;
     2. clicking either one filters the list AND lights the other — one filter, not two;
     3. clicking either one again clears both and restores the full list;
     4. both carry the same explanation, it names the reasons rather than repeating the word
        ("71 with no contact person · 1 flagged to confirm"), and no reason outruns the count —
        the tooltip's own pool has to be the same pool;
     5. the explanation is Arabic in Arabic;
     6. the brake: the rule still EXCLUDES a lead that needs nothing — a filter that matches every
        row is the same as no filter, and that is the failure a careless "unify them" would cause;
     7. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), three real runs:
     · giving core-10 back its own rule and its own flag — fails 1 and 3, printing the two states
       disagreeing ({"chip":true,"toolbar":false} with 33 rows where 34 were expected);
     · making leadAttention() return true for every lead — fails 2 and 6, all 34 rows still on
       screen when the filter is on;
     · giving core-10 back its own POOL — fails 1 with the two labels reading 33 and 45.
   Run: node scripts/qa/probe-one-needs-attention-not-two.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9245 — one mock. */
const PORT = 9245; const BASE = 'http://localhost:' + PORT;

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

/* one lead that needs nothing — a contact, no overdue action, not flagged. Without it a workspace
   where everything needs attention would make check 6 pass on a filter that matches everything. */
const seeded = await p.evaluate(() => {
  try {
    const B = DB.businesses || []; const src = B.find((x) => !x.isClient) || B[0]; if (!src) return { ok: false };
    const c = JSON.parse(JSON.stringify(src));
    c.id = 'qa_attn_fine'; c.isClient = false; c.name = 'QAATTN Fine Company'; c.stage = 'Contacted'; c.status = 'Contacted';
    c.source = 'Inbound'; c.nextActionDate = ''; c.needsManualConfirmation = false; c.activities = [];
    c.contacts = [{ name: 'QA Person', email: 'qa@qaattn.test', phone: '+966 55 000 0000' }];
    if (c.raw) c.raw = {};
    B.push(c);
    return { ok: true };
  } catch (e) { return { ok: false, err: e.message }; }
});
await p.waitForTimeout(400);

const openLeads = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang();
    if (window.leadAttnSet) window.leadAttnSet(false); else { window.__needsAttn = false; leadFilter.attention = false; }
    current = 'leads'; openLead = null; leadFilter.q = ''; leadFilter.stage = 'all'; window.__funnelTab = 'all'; render(); } catch (_) {} }, lang);
  await p.waitForTimeout(2800);
};
const read = () => p.evaluate(() => {
  const btns = [...document.querySelectorAll('#view button')].filter((x) => /Needs attention|انتباه/.test(x.textContent || ''));
  const tb = document.querySelector('#view table');
  return { controls: btns.map((x) => ({ label: (x.textContent || '').replace(/\s+/g, ' ').trim(), tip: x.getAttribute('title') || null })),
    rows: tb ? [...tb.querySelectorAll('tbody tr')].filter((y) => y.querySelectorAll('td').length > 1).length : null,
    chipFlag: (typeof window.__needsAttn !== 'undefined') ? !!window.__needsAttn : null,
    toolbarFlag: (typeof leadFilter !== 'undefined') ? !!leadFilter.attention : null,
    fineIsListed: !!(tb && [...tb.querySelectorAll('tbody tr')].some((y) => /QAATTN Fine Company/.test(y.innerText || ''))) };
});
const clickNth = async (n) => {
  await p.evaluate((i) => { const btns = [...document.querySelectorAll('#view button')].filter((x) => /Needs attention|انتباه/.test(x.textContent || '')); if (btns[i]) btns[i].click(); }, n);
  await p.waitForTimeout(2200);
};

await openLeads('en');
const before = await read();
await clickNth(0);            /* the chip */
const afterChip = await read();
await clickNth(1);            /* the toolbar button — same filter, so this clears it */
const afterButton = await read();
/* and the other order, to be sure neither is the "real" one */
await clickNth(1);
const afterButtonOn = await read();
await openLeads('ar');
const arabic = await read();
await b.close(); srv.close?.();

const isAr = (s) => /[؀-ۿ]/.test(String(s || ''));
const nums = (r) => r.controls.map((c) => { const m = String(c.label).match(/(\d+)\s*$/); return m ? Number(m[1]) : null; });

const checks = [
  ['both controls show the same count, and it is the rows the filter leaves',
    before.controls.length === 2 && nums(before)[0] !== null && nums(before)[0] === nums(before)[1] &&
    nums(before)[0] === afterChip.rows,
    JSON.stringify({ controls: before.controls.map((c) => c.label), rowsWhenFiltered: afterChip.rows, seeded })],
  ['clicking either one filters the list and lights the other — one filter, not two',
    afterChip.chipFlag === true && afterChip.toolbarFlag === true && afterChip.rows < before.rows &&
    afterButtonOn.chipFlag === true && afterButtonOn.toolbarFlag === true && afterButtonOn.rows === afterChip.rows,
    JSON.stringify({ afterChip: { chip: afterChip.chipFlag, toolbar: afterChip.toolbarFlag, rows: afterChip.rows },
      afterButtonOn: { chip: afterButtonOn.chipFlag, toolbar: afterButtonOn.toolbarFlag, rows: afterButtonOn.rows }, before: before.rows })],
  ['clicking again clears both and restores the full list',
    afterButton.chipFlag === false && afterButton.toolbarFlag === false && afterButton.rows === before.rows,
    JSON.stringify({ chip: afterButton.chipFlag, toolbar: afterButton.toolbarFlag, rows: afterButton.rows, expected: before.rows })],
  ['both carry the same explanation, it names the reasons, and no reason outruns the count',
    before.controls.every((c) => c.tip && /no contact person|overdue|flagged/.test(c.tip)) &&
    before.controls[0].tip === before.controls[1].tip &&
    (String(before.controls[0].tip).match(/\d+/g) || []).every((n) => Number(n) <= nums(before)[0]),
    JSON.stringify({ tips: before.controls.map((c) => c.tip), count: nums(before)[0] })],
  ['the explanation is Arabic in Arabic',
    arabic.controls.every((c) => c.tip && isAr(c.tip) && !/no contact person/.test(c.tip)),
    JSON.stringify(arabic.controls.map((c) => c.tip))],
  ['brake: a lead that needs nothing is filtered OUT — the warning is not every row',
    before.fineIsListed === true && afterChip.fineIsListed === false && afterChip.rows > 0,
    JSON.stringify({ listedBefore: before.fineIsListed, listedWhenFiltered: afterChip.fineIsListed, rows: afterChip.rows })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
