/* probe-the-credit-pool-names-its-source.mjs — a green "0% utilisation" on the morning screen has
   to be computed from the money, not from an empty array.

   Fire #173. The Today page injects a "Commercial Credit Pool" card for the default view preset.
   Driven live it reads: Cap 1.25M · headroom 1.25M · EXTENDED 0 · RECEIVED (this month) 0 ·
   OUTSTANDING 0 · UTILIZATION 0.0%, with a green bar, an aging panel and "None — all paid up".

   Every figure comes from `v25PoolCompute`, which reads `DB.invoices` — the invoices array inside
   the settings record. That array is EMPTY. The company's real invoices are in `finance_invoices`,
   46 of them live.

   Said precisely: the card is not wrong today — the ledger's outstanding really is 0.00 SAR, so the
   zeros happen to match. It simply cannot be right on purpose: it would show the same green 0.0%
   with a million riyals outstanding.

   The card is NOT wired to the ledger here — "extended credit" has to be defined against the
   finance doctrine and that is the owner's call, M1 territory. Instead js/93 names the source and
   puts the ledger's own figure beside it.

   What this holds:
     1. the line is on the pool card;
     2. it says the figures count invoices held in this app, and gives that count;
     3. it reports the ledger's real invoice count — NOT counting soft-deleted rows;
     4. it reports the ledger's outstanding total;
     5. when the two disagree the line is marked, not left looking routine;
     6. somebody who may not open Finance is told the card does not read the ledger and is shown NO
        amount (M25 — money figures never reach people without Finance);
     7. the card's own figures are still drawn — the line is added, not substituted;
     8. in Arabic the line is Arabic;
     9. no JS errors.

   Check 7 is the brake. Check 3 is the one that catches the bug this layer was born with: its first
   version cached whatever the first query returned, that query fired before sign-in, the database
   answered `[]` with no error, and the card confidently reported the ledger as holding ZERO
   invoices — fire #71's registry bug, rebuilt from scratch.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/93's
   script line from index.html fails checks 1-6 and 8.
   Run: node scripts/qa/probe-the-credit-pool-names-its-source.mjs                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9141; const BASE = 'http://localhost:' + PORT;

/* three live invoices, one of them still owing, plus a soft-deleted one that must not be counted */
const FIN = [
  { id: 'f1', invoice_no: 'QA-1', amount_remaining_sar: 0, amount_received_sar: 1000, deleted_at: null, invoice_date: '2026-05-01', integrity_status: 'verified_paid' },
  { id: 'f2', invoice_no: 'QA-2', amount_remaining_sar: 5000, amount_received_sar: 0, deleted_at: null, invoice_date: '2026-06-01', integrity_status: 'verified_paid' },
  { id: 'f3', invoice_no: 'QA-3', amount_remaining_sar: 0, amount_received_sar: 2000, deleted_at: null, invoice_date: '2026-07-01', integrity_status: 'verified_paid' },
  { id: 'f4', invoice_no: 'QA-4', amount_remaining_sar: 99999, amount_received_sar: 0, deleted_at: '2026-08-01T00:00:00Z', invoice_date: '2026-08-01', integrity_status: 'verified_paid' },
];

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'contacted', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: null, created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: null, needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const srv = start(PORT, {
  businesses: [row({ id: 'b1', legacy_id: 'B1', name: 'QA Lead One' })], contacts: [], activities: [],
  finance_invoices: FIN,
  app_state: [{ id: 1, data: { invoices: [], meta: { name: 'QA' }, schemaVersion: 3, settings: {} } }],
});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
/* the app seeds demo invoices into DB.invoices; empty it so the card is in the LIVE condition —
   an empty array, which is the whole point of this fire */
await p.evaluate(() => { try { DB.invoices = []; current = 'today'; render(); } catch (_) { } });
/* the ledger lands async — wait for the line to carry a ledger sentence rather than guessing */
await p.waitForFunction(() => { try {
  const c = document.querySelector('.v25-pool-card'); const l = c && c.querySelector('.v93-source');
  return !!(l && /finance ledger/i.test(l.textContent || ''));
} catch (_) { return false; } }, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(1500);

/* empty the demo invoices and redraw, so every read happens in the LIVE condition: an empty
   DB.invoices, which is the whole point of this fire */
const read = async () => {
  await p.evaluate(() => { try { DB.invoices = []; render(); } catch (_) { } });
  await p.waitForTimeout(1800);
  return p.evaluate(() => {
  const c = document.querySelector('.v25-pool-card');
  const l = c && c.querySelector('.v93-source');
  return { card: !!c, line: !!l, text: l ? (l.textContent || '').replace(/\s+/g, ' ').trim() : '',
    marked: l ? l.getAttribute('data-v93-diverged') === '1' : false,
    cardFigures: c ? /EXTENDED/i.test(c.innerText || '') && /UTILIZATION/i.test(c.innerText || '') : false };
  });
};
const asAdmin = await read();

/* somebody without Finance: the gate must hold and no amount may appear */
await p.evaluate(() => { try {
  window.mayOpenPage = function (pg) { return pg !== 'finance'; };
  render();
} catch (_) { } });
await p.waitForTimeout(2600);
const noFinance = await read();

await p.evaluate(() => { try {
  window.mayOpenPage = function () { return true; };
  LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render();
} catch (_) { } });
await p.waitForTimeout(2800);
const arabic = await read();
await b.close(); srv.close?.();

const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const checks = [
  ['the line is on the pool card', asAdmin.card && asAdmin.line, JSON.stringify({ card: asAdmin.card, line: asAdmin.line })],
  ['it says the figures count invoices held in this app, and gives that count',
    /held in this app \(0\)/i.test(asAdmin.text), asAdmin.text.slice(0, 80)],
  ['it reports the ledger\'s real count, not counting soft-deleted rows',
    /holds 3 invoice/i.test(asAdmin.text), asAdmin.text],
  ['it reports the ledger\'s outstanding total', /(5,?000|5k)/i.test(asAdmin.text), asAdmin.text.slice(-70)],
  ['when the two disagree the line is marked', asAdmin.marked, String(asAdmin.marked)],
  ['without Finance: told it does not read the ledger, and shown no amount',
    noFinance.line && /does not read/i.test(noFinance.text) && !/(5,?000|5k)\b/i.test(noFinance.text) && !/holds 3/.test(noFinance.text),
    noFinance.text],
  ['the card\'s own figures are still drawn', asAdmin.cardFigures && noFinance.cardFigures,
    JSON.stringify({ admin: asAdmin.cardFigures, noFin: noFinance.cardFigures })],
  ['in Arabic the line is Arabic', arabic.line && hasArabic(arabic.text), arabic.text.slice(0, 60)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
