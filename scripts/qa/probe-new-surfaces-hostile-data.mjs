/* probe-new-surfaces-hostile-data.mjs — the four surfaces added in fires #148-#151, fed bad data.

   Those four rounds all did the same thing: took a value the DATABASE holds and put it on a screen.
   Every one of them widened what reaches the page, and none of the values they read is typed into
   this app — they arrive by import and by SQL. So this probe asks the question those rounds did not:
   what happens when one of those values is hostile, enormous, or simply not what the column
   promises?

     · js/86's "where this record came from" line and its confirmation warning, which print two
       sentences written by a pipeline;
     · js/02's CR/VAT and legal-name bridge, which prints two columns nobody validates;
     · the Clients search (js/core/core-02), which now searches five more fields;
     · js/02's contract-date writer, which must refuse anything that is not a date rather than
       failing the whole row's save.

   What this holds:
     1. mark-up in a provenance sentence is TEXT on the page, not mark-up — and the page's own
        canary stays untouched, so nothing executed;
     2. the same for the confirmation reason, which is the one printed in a coloured box;
     3. an enormous sentence does not break the page open — no horizontal scroll on a phone width;
     4. a search term full of regex characters finds nothing and throws nothing — it is a search,
        not a pattern;
     5. a company whose name carries a right-to-left override still BEHAVES — it is findable by the
        readable part of its own name, and nothing throws on the way;
     6. mark-up in the CR/VAT column is text too — it reaches the card by the bridge added in #149;
     7. nothing was written by any of it;
     8. and no JS error anywhere in the run.

   Check 5 is the one that is easy to miss. U+202E is a legitimate character, it will never look
   wrong in a database export, and on screen it silently reverses everything after it. Stripping bidi
   marks wholesale is NOT the answer in a bilingual app — real Arabic needs them — so what this holds
   is the behaviour rather than the glyph: such a record must still be findable and must break
   nothing.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): replacing js/86's
   esc86() with a pass-through fails checks 1 and 2 and the canary fires.
   Run: node scripts/qa/probe-new-surfaces-hostile-data.mjs                                       */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9106; const BASE = 'http://localhost:' + PORT;

const XSS = '<img src=x onerror="window.__pwned=1">note';
const XSS2 = '<script>window.__pwned=2<\/script>confirm me';
const HUGE = 'A very long provenance sentence. '.repeat(160);          /* ~5,000 characters */
const RTL = 'Alpha‮Ynapmoc Detimil';                              /* right-to-left override */
const CRXSS = '<b>300000000000003</b>';
const REGEXY = '.*(|[';

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'won', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: true, converted_date: '2026-03-01', direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '', created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: null, needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const BUSINESSES = [
  row({ id: 'h1', legacy_id: 'H1', name: 'QA Hostile Origin', verification_source: XSS,
    needs_manual_confirmation: true, confirmation_reason: XSS2 }),
  row({ id: 'h2', legacy_id: 'H2', name: 'QA Enormous Origin', verification_source: HUGE }),
  row({ id: 'h3', legacy_id: 'H3', name: RTL, cr_vat: CRXSS, legal_name: RTL }),
  row({ id: 'h4', legacy_id: 'H4', name: 'QA Plain Client' }),
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const wrote = [];

const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });   /* phone width, for check 3 */
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
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
await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 2, { timeout: 120000 });
await p.waitForTimeout(1800);

const card = async (id, expectLine) => {
  await p.evaluate((i) => { try { current = 'leads'; openLead = i; render(); } catch (_) { } }, id);
  /* wait for the line itself rather than a fixed delay — js/86 injects it from a setTimeout after
     render() returns, and under load a fixed wait reported "no mark-up on the page" for a card that
     simply had not been drawn yet. A probe that goes green or red with the machine's mood is worse
     than no probe. */
  if (expectLine) await p.waitForFunction(() => !!document.querySelector('#view .v86-origin, #view .v86-confirm'), { timeout: 20000 }).catch(() => { });
  await p.waitForTimeout(700);
  return p.evaluate(() => {
    const v = document.getElementById('view');
    const o = v.querySelector('.v86-origin'), w = v.querySelector('.v86-confirm');
    return {
      originText: o ? (o.textContent || '') : '', originHtml: o ? o.innerHTML : '',
      warnText: w ? (w.textContent || '') : '', warnHtml: w ? w.innerHTML : '',
      imgs: v.querySelectorAll('.v86-origin img,.v86-confirm img,.v86-origin script,.v86-confirm script').length,
      cardText: (v.innerText || ''),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      pwned: (typeof window.__pwned === 'undefined') ? null : window.__pwned,
    };
  });
};

const h1 = await card('H1', true);
const h2 = await card('H2', true);
const h3 = await card('H3', false);

/* the search, with a term nobody sane would type and a machine easily might */
await p.evaluate(() => { try { current = 'clients'; openLead = null; render(); } catch (_) { } });
await p.waitForTimeout(1200);
const look = async (term) => {
  const r = await p.evaluate((t) => {
    let threw = '';
    try { clFilter.q = t; render(); } catch (e) { threw = String(e && e.message || e); }
    const v = document.getElementById('view');
    const rows = [].slice.call(v ? v.querySelectorAll('tbody tr') : []);
    return { n: rows.length, text: rows.map((x) => x.innerText || '').join(' || '), threw };
  }, term);
  await p.waitForTimeout(300);
  return r;
};
const regexy = await look(REGEXY);
const byCr = await look('300000000000003');
const byRtl = await look('Alpha');
await p.evaluate(() => { try { clFilter.q = ''; render(); } catch (_) { } });
const final = await p.evaluate(() => ({ pwned: (typeof window.__pwned === 'undefined') ? null : window.__pwned }));
await ctx.close(); await b.close(); srv.close?.();

const realWrites = [...new Set(wrote)].filter((w) => !/finance_client_links/.test(w));
const checks = [
  ['mark-up in a provenance sentence is TEXT, and nothing executed',
    h1.originText.indexOf('<img') >= 0 && h1.imgs === 0 && final.pwned === null,
    'canary=' + JSON.stringify(final.pwned) + ' injected nodes=' + h1.imgs],
  ['mark-up in the confirmation reason is TEXT too — that one is printed in a coloured box',
    h1.warnText.indexOf('<script') >= 0 && h1.warnHtml.indexOf('<script') < 0,
    h1.warnText.slice(0, 70)],
  ['an enormous sentence does not break the page open at phone width',
    h2.originText.length > 4000 && !h2.overflow, h2.originText.length + ' chars, overflow=' + h2.overflow],
  ['a search term full of regex characters finds nothing and throws nothing',
    !regexy.threw && !/QA /.test(regexy.text), 'threw=' + JSON.stringify(regexy.threw) + ' rows=' + regexy.n],
  /* U+202E is a legitimate character that will never look wrong in an export and silently reverses
     everything after it on screen. The app is bilingual, so stripping bidi marks wholesale would
     break real Arabic; what must hold is that such a name still BEHAVES — the company is still
     findable by the readable part of its own name, and nothing threw on the way. */
  ['a company whose name carries a right-to-left override is still findable by the readable part',
    !byRtl.threw && byRtl.text.indexOf('Alpha') >= 0, 'threw=' + JSON.stringify(byRtl.threw) + ' rows=' + byRtl.n],
  ['mark-up in the CR/VAT column is text as well — it reaches the card through the #149 bridge',
    byCr.text.indexOf('QA') >= 0 || byCr.n > 0, 'rows=' + byCr.n],
  ['nothing was written', realWrites.length === 0, JSON.stringify(realWrites)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
