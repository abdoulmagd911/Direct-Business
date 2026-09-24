/* probe-a-funnel-answer-can-be-found.mjs — what the team typed into a funnel form can be found by
   typing it into a search box.

   Fire #240. The app asks each company a set of funnel-specific questions — the MoT licence number
   and IATA code for a travel-trade lead, the tender value and deadline for a tender, the Direct
   Payments customer number and last invoice number for a past-invoices lead, where an outreach lead
   was found. Counted against the live database the day this was written: **88 of the 108 live
   companies carry at least one funnel answer**, and of the 142 answers in the fields worth searching,
   **136 could not be found by typing them into any search box in the app**.

   Two of the 136 are the link keys to the money system — a Direct Payments customer number and an
   invoice number — so a colleague holding an invoice in their hand could not get from it to the
   company that was billed.

   The cause was one function. `recordHay` (core-01) is the single haystack every box shares since
   M38 — the top-bar search, the Leads box, the Clients box and the command palette all ask it — and
   it was built from the company's own fields and its contacts. Funnel answers live in their own
   store (`funnelDetails`), and were simply never added to it. The same shape as fires #113 and #214,
   which added notes, website and the contacts' phones; this is the piece they left.

   What this holds:
     1. the top-bar search finds a company by a value that exists only in a funnel answer;
     2. the Leads box does, and filters to exactly that lead;
     3. the Clients box does — the same rule reaches clients, not just leads;
     4. the command palette does, which reads the haystack directly;
     5. an Arabic answer is folded the way #214 folds every other field, so «الهيئة» typed with ة
        finds an answer stored with ه;
     6. the brake that stops this being "match everything": a token in no record finds nothing;
     7. the brake that keeps the haystack a haystack of WORDS — a yes/no answer does not put the
        word "true" into every record, and a nested blob does not put "[object Object]" there;
     8. a company with no funnel answers is not dragged in by another company's answer;
     9. no page prints undefined, NaN or [object Object] from any of it, in either language;
    10. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the funnel answers taken back out of `recordHay` — fails 1, 2, 3, 4 and 5, every box blind to
       them again;
     · booleans and nested objects let into the haystack instead of being skipped — fails 7, with
       "true" matching every record that answered a yes/no question.
   Run: node scripts/qa/probe-a-funnel-answer-can-be-found.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9266 — one mock. */
const PORT = 9266; const BASE = 'http://localhost:' + PORT;

/* Synthetic companies — rule 7: no real name, number or invoice reference is ever in this
   repository. The tokens are deliberately unlike anything the mock seeds, so a match is a match. */
const mk = (n, extra) => Object.assign({
  id: '00000000-0000-4000-8000-0000000002' + String(10 + n), legacy_id: 'QA240-' + n,
  name: 'QA240 company ' + n, stage: 'new', is_client: false, archived_at: null,
  raw: {}, funnel_details: {}, created_at: '2026-09-01T00:00:00+00:00',
}, extra || {});

const ROWS = [
  /* a travel-trade lead: its licence and IATA numbers exist ONLY as funnel answers */
  mk(1, { name: 'QA240 Northern Gate Travel', funnel_key: 'travel_trade',
          funnel_details: { licence_no: 'MOTQA77412', iata: 'QA9930155',
                            region: 'QA Northern Province', origin_note: 'Met at the QA expo, stand B12' } }),
  /* a client whose Direct Payments customer number and last invoice number are funnel answers */
  mk(2, { name: 'QA240 Coastal Logistics', is_client: true, stage: 'won', funnel_key: 'past_invoices',
          funnel_details: { dp_customer_no: 'QA5491', last_invoice_no: 'QAINV20260912',
                            payment_behaviour: 'settles on time' } }),
  /* an Arabic answer stored with ه where the person searching will type ة (#214's folding rule) */
  mk(3, { name: 'QA240 Arabic referral', funnel_details: { origin_note: 'احاله من الهيئه الوطنيه للاختبار' } }),
  /* the company that must NOT be dragged in: no funnel answers at all */
  mk(4, { name: 'QA240 Quiet Company' }),
  /* the shapes that must not become search terms: a yes/no answer and a nested blob */
  mk(5, { name: 'QA240 Yes No Company',
          funnel_details: { has_app: true, replied: false, nested: { a: 1 }, blank: '' } }),
];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/businesses' && m === 'GET' && !/archived_at=not/.test(u.search)) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }); return; }
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof drawLeads === 'function', { timeout: 120000 });
  await p.waitForFunction(() => { try { return (DB.businesses || []).some((x) => /^QA240/.test(String(x.name || ''))); } catch (_) { return false; } }, { timeout: 120000 });
  await p.waitForTimeout(2500);

  /* the top-bar box: type into the real input, read the real result list */
  const g = async (q) => {
    const names = await p.evaluate(async (query) => {
      const box = document.getElementById('gsearch'); if (!box) return null;
      box.value = query; box.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
      const res = window._gres || [];
      return { labels: res.map((x) => String(x.label || '')), kinds: res.map((x) => String(x.t || '')),
               shown: ((document.getElementById('gres') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160) };
    }, q);
    return names;
  };

  /* the Leads box, through its own input and its own filter */
  const leads = async (q) => p.evaluate(async (query) => {
    try { current = 'leads'; openLead = null; render(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 600));
    const box = document.getElementById('lq');
    if (box) { box.value = query; box.dispatchEvent(new Event('input', { bubbles: true })); }
    else { try { leadFilter.q = query; drawLeads(); } catch (_) {} }
    await new Promise((r) => setTimeout(r, 900));
    const rows = [].slice.call(document.querySelectorAll('#view table tbody tr'));
    return rows.map((r) => ((r.cells[1] || {}).innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }, q);

  const clients = async (q) => p.evaluate(async (query) => {
    try { current = 'clients'; openLead = null; render(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 600));
    const box = document.getElementById('clq');
    if (box) { box.value = query; box.dispatchEvent(new Event('input', { bubbles: true })); }
    else { try { clFilter.q = query; render(); } catch (_) {} }
    await new Promise((r) => setTimeout(r, 900));
    const rows = [].slice.call(document.querySelectorAll('#view table tbody tr'));
    return rows.map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }, q);

  const palette = async (q) => p.evaluate((query) => {
    try { return (CMD_RESULTS(query) || []).map((x) => String(x.lbl || '')); } catch (_) { return null; }
  }, q);

  const out = {
    licence: await g('MOTQA77412'),
    iataLeads: await leads('QA9930155'),
    invClients: await clients('QAINV20260912'),
    dpGlobal: await g('QA5491'),
    pal: await palette('MOTQA77412'),
    arabic: await g('احالة من الهيئة'),
    nothing: await g('QANOTPRESENTXYZ'),
    trueWord: await g('true'),
    objWord: await g('object Object'),
  };
  await p.evaluate(() => { try { current = 'leads'; openLead = null; leadFilter.q = ''; render(); } catch (_) {} });
  await p.waitForTimeout(1200);
  out.badTokens = await p.evaluate(() => {
    const t = (document.getElementById('view').innerText || '');
    return (t.match(/[^\n]*(undefined|NaN|Invalid Date|\[object Object\])[^\n]*/g) || []).slice(0, 3).map((x) => x.trim().slice(0, 70));
  });
  await ctx.close();
  return { out, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

console.log('  two runs, EN and AR, over five synthetic companies whose licence, IATA, customer and invoice numbers exist only as funnel answers');

const hasName = (list, frag) => (list || []).some((x) => String(x).indexOf(frag) >= 0);

(en.out.licence && hasName(en.out.licence.labels, 'Northern Gate') && en.out.licence.labels.length === 1)
  ? pass('the top-bar search finds a company by a value that exists only in a funnel answer', JSON.stringify(en.out.licence.labels))
  : fail('the top-bar search finds a company by a value that exists only in a funnel answer', JSON.stringify(en.out.licence));

(hasName(en.out.iataLeads, 'Northern Gate') && en.out.iataLeads.length === 1)
  ? pass('the Leads box does, and filters to exactly that lead', JSON.stringify(en.out.iataLeads))
  : fail('the Leads box does, and filters to exactly that lead', JSON.stringify(en.out.iataLeads));

(hasName(en.out.invClients, 'Coastal Logistics') && en.out.invClients.length === 1)
  ? pass('the Clients box does — the same rule reaches clients, not just leads', JSON.stringify(en.out.invClients).slice(0, 90))
  : fail('the Clients box does — the same rule reaches clients, not just leads', JSON.stringify(en.out.invClients));

(hasName(en.out.pal, 'Northern Gate'))
  ? pass('the command palette does, which reads the haystack directly', JSON.stringify(en.out.pal))
  : fail('the command palette does, which reads the haystack directly', JSON.stringify(en.out.pal));

(en.out.arabic && hasName(en.out.arabic.labels, 'Arabic referral') && ar.out.arabic && hasName(ar.out.arabic.labels, 'Arabic referral'))
  ? pass('an Arabic answer is folded — «الهيئة» typed with ة finds an answer stored with ه', 'both languages')
  : fail('an Arabic answer is folded — «الهيئة» typed with ة finds an answer stored with ه', JSON.stringify({ en: en.out.arabic, ar: ar.out.arabic }));

/* the Direct Payments customer number is the link key to the money system — checked on its own */
(en.out.dpGlobal && hasName(en.out.dpGlobal.labels, 'Coastal Logistics'))
  ? pass('and a Direct Payments customer number gets you to the company that was billed')
  : fail('and a Direct Payments customer number gets you to the company that was billed', JSON.stringify(en.out.dpGlobal));

(en.out.nothing && en.out.nothing.labels.length === 0)
  ? pass('brake: a token in no record finds nothing')
  : fail('brake: a token in no record finds nothing', JSON.stringify(en.out.nothing));

(en.out.trueWord && en.out.trueWord.labels.length === 0 && en.out.objWord && en.out.objWord.labels.length === 0)
  ? pass('brake: a yes/no answer does not put "true" in the haystack, nor a nested blob "[object Object]"')
  : fail('brake: a yes/no answer does not put "true" in the haystack, nor a nested blob "[object Object]"',
         JSON.stringify({ true: en.out.trueWord, object: en.out.objWord }));

(!hasName((en.out.licence || {}).labels, 'Quiet Company') && !hasName(en.out.iataLeads, 'Quiet Company'))
  ? pass('a company with no funnel answers is not dragged in by another company\'s answer')
  : fail('a company with no funnel answers is not dragged in by another company\'s answer', JSON.stringify(en.out.licence));

(en.out.badTokens.length === 0 && ar.out.badTokens.length === 0)
  ? pass('no page prints undefined, NaN or [object Object] from any of it, in either language')
  : fail('no page prints undefined, NaN or [object Object] from any of it, in either language', JSON.stringify({ en: en.out.badTokens, ar: ar.out.badTokens }));

const errs = en.errors.concat(ar.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
