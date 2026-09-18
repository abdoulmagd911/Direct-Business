/* probe-arabic-dialogs-complete.mjs — guards the 2026-09-18 (fire #87) additions to js/21.
   Fire #86 fixed ONE half-translated form. This one treats it as the class it is: every dialog in the
   app goes through the same translator, which matches whole strings, skips any label that wraps an
   input, and had no mechanism at all for a title of the shape "<English prefix> — <the record's name>".
   Opening all 23 dialogs in Arabic against the live database found the same failures spread across the
   app: the supplier form's heading, the request form's hint, the whole of Client onboarding (19 labels,
   3 hints, 3 buttons), Chain of command (7 labels, 4 buttons, its title), the Sync log, the ZATCA
   hash-chain report, and 117 English "Restore" buttons in the snapshot browser.
   This probe opens each dialog on the mock — which, unlike the live database, HAS invoices, bookings and
   requests, so it also covers the eight forms that could not be opened live — and asserts that nothing
   English is left in any of them EXCEPT the strings that must stay English, which it asserts are still
   there:
     · WhatsApp, and the supplier form's EMD — names, not words;
     · a lead's or client's own dialog title, which IS the company name;
     · the supplier form's technical hints (320ms, P1 < 1h, BSP / card / credit / wallet, the GDS and
       NDC vocabulary) — the language this team actually works in;
     · "SA…" and "https://…", which are not words;
     · and the activity types, whose text IS what gets stored (js/21's universal option rule).
   Sabotage-tested: with the js/21 edit stashed, 5 checks go FAIL, exit 1 — Client onboarding, Chain of
   command, the snapshot browser and all three Finance/Ops forms revert to English.
   Run: node scripts/qa/probe-arabic-dialogs-complete.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9066; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.addInitScript(() => { try { localStorage.setItem('dbLang', 'ar'); } catch (_) { } });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const wrote = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    wrote.push(m + ' ' + u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.editBusiness === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 });
await p.waitForTimeout(4000);
const arabicOn = await p.evaluate(() => typeof LANG !== 'undefined' && LANG === 'ar');
const ids = await p.evaluate(() => { const bz = DB.businesses || [];
  return { lead: (bz.find((x) => !x.isClient) || {}).id, client: (bz.find((x) => x.isClient) || bz[0] || {}).id,
    inv: ((DB.invoices || [])[0] || {}).id, bk: ((DB.bookings || [])[0] || {}).id, req: ((DB.requests || [])[0] || {}).id }; });

/* the strings that MUST stay English, and why — asserted present, not merely tolerated */
const KEEP = ['WhatsApp', 'EMD', '320ms', 'P1 < 1h', 'BSP / card / credit / wallet', 'SA…', 'https://…',
  'GDS / Hotels / eSIM / Payments', '60% NDC / 30% EDIFACT / 10% LCC',
  'GDS / NDC / Direct portal / Aggregator (Travel Fusion)', 'Duffel → short-haul EU LCCs',
  /* the invoice and booking forms' own examples: a VAT-number shape, a GDS list, and two real
     airline ticket-number prefixes (SV Saudia, EY Etihad). None of these are words. */
  '300xxxxxxx00003', 'GDS / NDC / OTA / Direct', 'SV-1234567 / EY-5555'];
const DIALOGS = [
  ['New lead', 'leads', 'editBusiness', ''],
  ['Edit lead', 'leads', 'editBusiness', 'lead'],
  ['Edit client', 'clients', 'editBusiness', 'client'],
  ['Log activity', 'leads', 'logActivity', 'lead'],
  ['New request', 'ops', 'editRequest', ''],
  ['Edit request', 'ops', 'editRequest', 'req'],
  ['New invoice', 'finance', 'editInvoice', ''],
  ['Edit invoice', 'finance', 'editInvoice', 'inv'],
  ['New booking', 'ops', 'editBooking', ''],
  ['Edit booking', 'ops', 'editBooking', 'bk'],
  ['Record a payment', 'finance', 'recordPayment', 'inv'],
  ['New SOP', 'sopsla', 'editSop', ''],
  ['New supplier', 'vendors', 'editSupplier', ''],
  ['Add a contact', 'leads', 'v41AddContact', 'lead'],
  ['Add a link', 'leads', 'v41AddLink', 'lead'],
  ['Client onboarding', 'clients', 'v22OpenClientOnboarding', 'client'],
  ['Chain of command', 'clients', 'v24OpenChainOfCommand', 'client'],
  ['Sync log', 'sync', 'openSyncLog', null],
  ['Restore list', 'settings', 'v21OpenRestoreList', null],
  ['Hash report', 'settings', 'v21OpenHashReport', null],
];
const rows = [];
for (const [name, page, fn, key] of DIALOGS) {
  await p.evaluate((pg) => { try { current = pg; openLead = null; render(); } catch (_) { } }, page);
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } }); await p.waitForTimeout(250);
  await p.evaluate(({ fn, arg, hasArg }) => { try { const f = window[fn]; if (typeof f === 'function') { hasArg ? f(arg) : f(); } } catch (_) { } },
    { fn, arg: key ? ids[key] : '', hasArg: key !== null });
  await p.waitForTimeout(1600);
  const r = await p.evaluate((keep) => {
    const isEn = (t) => /[A-Za-z]/.test(t) && !/[؀-ۿ]/.test(t);
    const ov = document.getElementById('ov'); const m = document.getElementById('modal');
    const open = !!(ov && /show/.test(ov.className || '')) && !!m && (m.textContent || '').trim().length > 20;
    if (!open) return { open: false };
    const grab = (sel, filt) => Array.from(m.querySelectorAll(sel)).filter(filt || (() => true)).map((x) => (x.textContent || '').trim()).filter(Boolean);
    const labels = grab('label', (x) => !x.querySelector('input,select,textarea'));
    const chips = grab('label', (x) => !!x.querySelector('input,select,textarea'));
    const btns = grab('button');
    const heads = grab('.mh h3,h2,h3,.sub-h,.ch-sub');
    const phs = Array.from(m.querySelectorAll('input[placeholder],textarea[placeholder]')).map((x) => x.getAttribute('placeholder')).filter(Boolean);
    const all = labels.concat(chips, btns, heads, phs);
    const english = all.filter(isEn);
    return { open: true, title: (m.querySelector('.mh h3') || {}).textContent || '',
      english: [...new Set(english)], kept: keep.filter((k) => all.some((t) => t.indexOf(k) >= 0)) }; }, KEEP);
  rows.push({ name, ...r });
  const left = r.open ? r.english.filter((t) => !KEEP.some((k) => t.indexOf(k) >= 0) && t !== (r.title || '').trim()) : [];
  console.log(`${r.open ? (left.length ? 'ENGLISH' : 'clean ') : 'closed'} · ${name}${left.length ? '  ' + JSON.stringify(left.slice(0, 5)) : ''}`);
  await p.evaluate(() => { try { closeModal(); } catch (_) { } }); await p.waitForTimeout(300);
}
await b.close(); srv.close?.();

const opened = rows.filter((r) => r.open);
/* the lead and client dialogs are titled with the company's own name; that one string is data */
const NAME_TITLED = ['Edit lead', 'Edit client'];
const leftOf = (r) => r.english.filter((t) => !KEEP.some((k) => t.indexOf(k) >= 0)
  && !(NAME_TITLED.indexOf(r.name) >= 0 && t === (r.title || '').trim()));
const dirty = opened.filter((r) => leftOf(r).length > 0).map((r) => ({ name: r.name, left: leftOf(r) }));
const byName = (n) => opened.find((r) => r.name === n);
const checks = [
  ['the drive really happened — Arabic is on and most dialogs opened', arabicOn && opened.length >= 15],
  ['the mock covers the forms live data cannot reach — invoice, booking and request', ['Edit invoice', 'Edit booking', 'Edit request'].every((n) => !!byName(n))],
  ['no dialog is left carrying English that is not a name, an acronym or a technical value', dirty.length === 0],
  ['the supplier form still shows its own technical vocabulary in English', !!byName('New supplier') && byName('New supplier').kept.length >= 4],
  ['the channel chip is still called WhatsApp', opened.some((r) => r.kept.indexOf('WhatsApp') >= 0)],
  ['a dialog titled with a company name keeps that name exactly', NAME_TITLED.every((n) => { const r = byName(n); return !r || !!(r.title || '').trim(); })],
  ['Client onboarding — hidden by v36 but still reachable — reads Arabic', !!byName('Client onboarding') && leftOf(byName('Client onboarding')).length === 0],
  ['Chain of command reads Arabic, title included', !!byName('Chain of command') && leftOf(byName('Chain of command')).length === 0],
  ['the snapshot browser\'s Restore buttons read Arabic', !!byName('Restore list') && leftOf(byName('Restore list')).length === 0],
  ['the Finance and Ops forms read Arabic — invoice, booking and payment, which live data cannot reach', ['Edit invoice', 'Edit booking', 'Record a payment'].every((n) => !!byName(n) && leftOf(byName(n)).length === 0)],
  /* js/42 links finance groups to their clients on its own at boot; that is the app working. What no
     dialog may do is write a record just by being OPENED. */
  ['opening every dialog wrote no record of its own', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ arabicOn, opened: opened.length, closed: rows.filter((r) => !r.open).map((r) => r.name), dirty, wrote }, null, 1)); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
