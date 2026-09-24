/* probe-a-sector-chip-says-what-it-scoped.mjs — pressing a sector chip on Finance shows how many
   of the period's paid invoices that sector holds and how each one was decided; the ledger header
   above it stays the ledger's own.

   Fire #246. Driven live with the Tenders chip pressed: the tab-bar header read "46 invoices ·
   data through 2026-08-20" — the LEDGER's extent, and several probes pin that wording — while three
   lines down the cost warning read "5 of 5 invoices in this period". One screen, two counts, for a
   reader who had just asked for Tenders. The money tiles followed the chip; no count beside the
   chip did.

   And finSectorBasis(), written on 3 September "so the page can show it rather than mixing the two
   silently", had no call site. Under B2B, one live invoice sits there BY DEFAULT — its client has
   no profile and no payment terms — and nothing on the page could say so.

   The filter bar now carries one line beside the pressed chip: "N of M paid invoices are Tenders —
   decided 3 by the client's profile, 1 by its payment terms (no profile on file)". The rows are the
   same rows the tiles are made of. Nothing under "All sectors".

   What this holds (a seven-invoice ledger: three tender-profile, two B2B-profile, one whose client
   has no profile but payment terms "Tender", one whose client group has no link at all, plus one
   School Commission row that is Academies by the service itself):
     1. under Tenders the line reads "4 of 8" and names both bases — 3 by profile, 1 by terms;
     2. under B2B it reads "3 of 8" and says 1 is there by default (no profile, no terms);
     3. under Academies it says the row was decided by the service itself;
     4. the count on the line equals what the app's own sector function gives for those rows, so
        the line can never drift from the tiles;
     5. brake: under "All sectors" there is no line — it answers a question, it is not furniture;
     6. brake: the tab-bar header still reads "8 invoices · data through …" under every chip — the
        ledger's extent is untouched, and the probes that pin it stay true;
     7. Arabic: the line is Arabic and carries the numbers;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), three real runs:
     · the line removed — fails 1, 2, 3, 4 and 7;
     · the basis words dropped (counts only) — fails 1, 2, 3 and 7, the numbers right and the
       reasons gone in both languages;
     · the header made to follow the chip — fails 6 alone, proving the brake is a brake.
   Run: node scripts/qa/probe-a-sector-chip-says-what-it-scoped.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9274 — one mock. */
const PORT = 9274; const BASE = 'http://localhost:' + PORT;

/* synthetic throughout — rule 7 */
const B = (n) => '00000000-0000-4000-8000-0000000003' + String(10 + n);   // business uuids
const biz = (n, extra) => Object.assign({ id: B(n), legacy_id: 'QA246-' + n, name: 'QA246 client ' + n, stage: 'won', is_client: true,
  archived_at: null, raw: {}, funnel_details: {}, created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z', payment_terms: null }, extra || {});
const BUSINESSES = [biz(1), biz(2), biz(3), biz(4, { payment_terms: 'Tender — 30 days' }), biz(5)];
const LINKS = [
  { id: 1, client_group: 'QA-G1', business_id: B(1), is_client: true, confirmed_by: 'auto-match' },
  { id: 2, client_group: 'QA-G2', business_id: B(2), is_client: true, confirmed_by: 'auto-match' },
  { id: 3, client_group: 'QA-G3', business_id: B(3), is_client: true, confirmed_by: 'auto-match' },
  { id: 4, client_group: 'QA-G4', business_id: B(4), is_client: true, confirmed_by: 'auto-match' },
  { id: 5, client_group: 'QA-G5', business_id: B(5), is_client: true, confirmed_by: 'auto-match' },
  /* QA-G6 has no link at all */
];
const PROFILES = [
  { id: 'p1', business_id: B(1), profile_type: 'tender', status: 'active' },
  { id: 'p2', business_id: B(2), profile_type: 'tender', status: 'active' },
  { id: 'p3', business_id: B(3), profile_type: 'postpaid', status: 'active' },
  /* B(4): no profile, but payment terms say Tender → basis "terms" ; B(5): no profile, no terms → default */
];
const inv = (n, group, x) => Object.assign({
  id: 'f0000000-0000-4000-8000-00000000026' + n, invoice_no: 'QA246-' + n, client_group: group, customer_raw_name: group,
  invoice_date: '2026-05-1' + n, month: 'May', quarter: 'Q2', year: 2026, products: 'QA service', service_type: 'B2B',
  record_type: 'invoice', total_incl_vat_sar: 1000, wallet_portion_sar: 0, revenue_sar: 1000, cost_sar: 600, profit_sar: 400,
  amount_received_sar: 1000, amount_remaining_sar: 0, integrity_status: 'verified_paid', revenue_way: 'invoice', deleted_at: null, vat_sar: null,
}, x || {});
const INVOICES = [
  inv(1, 'QA-G1'), inv(2, 'QA-G1'), inv(3, 'QA-G2'),          // tender by profile ×3
  inv(4, 'QA-G3'), inv(5, 'QA-G3'),                            // b2b by profile ×2
  inv(6, 'QA-G4'),                                             // tender by payment terms (no profile)
  inv(7, 'QA-G6'),                                             // b2b by default (no link)
  inv(8, 'QA-G5', { service_type: 'School Commission' }),      // academies by the service
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [],
  app_state: [{ id: 1, data: { bookings: [], invoices: [], meta: { name: 'QA' }, schemaVersion: 3, settings: {} } }] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    const serve = (rows) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    if (m === 'GET' && u.pathname === '/rest/v1/finance_invoices') return serve(INVOICES);
    if (m === 'GET' && u.pathname === '/rest/v1/finance_client_links') return serve(LINKS);
    if (m === 'GET' && u.pathname === '/rest/v1/client_profiles') return serve(PROFILES);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(10000);
  await p.evaluate(() => { try { current = 'finance'; render(); } catch (_) {} });
  await p.waitForFunction(() => { try { return !!(window.FIN && FIN.rows && FIN.rows.length && FIN.profileTypeByBiz); } catch (_) { return false; } }, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);

  const look = async (sec) => {
    await p.evaluate((s) => { try { finPS(s); } catch (_) {} }, sec);
    await p.waitForTimeout(2200);
    return p.evaluate((s) => {
      const v = document.getElementById('view');
      const el = v.querySelector('[data-fin-sector-scope]');
      const own = (() => { try { return finLive().filter((r) => r.integrity_status === 'verified_paid' && finSectorOf(r) === s).length; } catch (_) { return -1; } })();
      const hdr = ((v.innerText || '').match(/(\d[\d,]*) invoices? · data through [^\n]*/) || (v.innerText || '').match(/(\d[\d,]*) فاتورة · حتى [^\n]*/) || [''])[0].trim();
      return { line: !!el, text: el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '', n: el ? Number(el.getAttribute('data-n')) : null, own, hdr };
    }, sec);
  };
  const out = { all: await look('all'), tenders: await look('tenders'), b2b: await look('b2b'), academies: await look('academies') };
  await ctx.close();
  return { out, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

console.log('  eight synthetic invoices: 3 tender by profile, 2 B2B by profile, 1 tender by payment terms, 1 B2B by default, 1 Academies by the service');

(en.out.tenders.line && /^4 of 8 paid invoices are Tenders/.test(en.out.tenders.text) && /3 by the client.s profile/.test(en.out.tenders.text) && /1 by its payment terms/.test(en.out.tenders.text))
  ? pass('under Tenders the line reads "4 of 8" and names both bases', JSON.stringify(en.out.tenders.text))
  : fail('under Tenders the line reads "4 of 8" and names both bases', JSON.stringify(en.out.tenders));

(en.out.b2b.line && /^3 of 8 paid invoices are B2B/.test(en.out.b2b.text) && /2 by the client.s profile/.test(en.out.b2b.text) && /1 by default \(no profile, no terms\)/.test(en.out.b2b.text))
  ? pass('under B2B it reads "3 of 8" and says 1 is there by default', JSON.stringify(en.out.b2b.text))
  : fail('under B2B it reads "3 of 8" and says 1 is there by default', JSON.stringify(en.out.b2b));

(en.out.academies.line && /^1 of 8 paid invoices are Academies/.test(en.out.academies.text) && /1 by the service itself/.test(en.out.academies.text))
  ? pass('under Academies it says the row was decided by the service itself', JSON.stringify(en.out.academies.text))
  : fail('under Academies it says the row was decided by the service itself', JSON.stringify(en.out.academies));

(['tenders', 'b2b', 'academies'].every((k) => en.out[k].n === en.out[k].own && en.out[k].own >= 0))
  ? pass('the count on the line equals what the app\'s own sector function gives', JSON.stringify({ tenders: en.out.tenders.n, b2b: en.out.b2b.n, academies: en.out.academies.n }))
  : fail('the count on the line equals what the app\'s own sector function gives', JSON.stringify({ tenders: en.out.tenders, b2b: en.out.b2b, academies: en.out.academies }));

(!en.out.all.line)
  ? pass('brake: under All sectors there is no line')
  : fail('brake: under All sectors there is no line', JSON.stringify(en.out.all));

(['all', 'tenders', 'b2b', 'academies'].every((k) => /^8 invoices? · data through /.test(en.out[k].hdr)))
  ? pass('brake: the tab-bar header still reads the ledger\'s own count under every chip', JSON.stringify(en.out.tenders.hdr))
  : fail('brake: the tab-bar header still reads the ledger\'s own count under every chip', JSON.stringify({ all: en.out.all.hdr, tenders: en.out.tenders.hdr, b2b: en.out.b2b.hdr }));

(ar.out.tenders.line && /[؀-ۿ]/.test(ar.out.tenders.text) && /4/.test(ar.out.tenders.text) && /8/.test(ar.out.tenders.text) && /3/.test(ar.out.tenders.text) && !/[A-Za-z]{3,}/.test(ar.out.tenders.text.replace(/B2B|QA/g, '')))
  ? pass('Arabic: the line is Arabic and carries the numbers', JSON.stringify(ar.out.tenders.text.slice(0, 80)))
  : fail('Arabic: the line is Arabic and carries the numbers', JSON.stringify(ar.out.tenders));

const errs = en.errors.concat(ar.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
