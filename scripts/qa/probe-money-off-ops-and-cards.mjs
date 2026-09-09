/* probe-money-off-ops-and-cards.mjs (2026-09-09, live test findings OPS1, C2, EX2) — the owner's
   21 Aug ruling ("any numbers of revenue or money or at all, I wanted all to be on the finance
   page") measured on three surfaces it had not reached. Attack area (ad).

   PORT NOTE: 8701–8754 are taken. This is 8755, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand:
     · Operations board: "Pipeline value 183k SAR", "Booked margin 28k SAR · margin 15%" and a
       "25k SAR · △3k" line on every card.
     · A client card's Partners & Tenders details printing "Tender value (SAR) 150000".
     · The Clients CSV export carrying a totalSAR column with seven amounts.

   Under test:
     1. Ops board with one costed request and one uncosted request: no "SAR" anywhere on the
        board; the tile "Needs a cost recorded" reads 1; the uncosted card says "no cost yet";
        the request FORM still holds the sell and cost inputs (money is entered here, not read).
     2. A Partners & Tenders lead with tender_value_sar = 150000: the funnel details card shows
        "recorded — read on Finance", never 150000; the edit form still offers the value in an
        input; the hover pop does not print it.
     3. The Leads and Clients exports (captured inside the page, nothing downloaded) carry no
        totalSAR column and no amount.

   Run:  node scripts/qa/probe-money-off-ops-and-cards.mjs        (port 8755)
   Sabotage: in core-03 put "Pipeline value" back into kp — check 1 goes red; in js/09 make
   fnIsMoney return false — check 2 goes red; in core-05 add 'totalSAR' back to the clients
   list — check 3 goes red. Assert the sabotage APPLIED with a marker unique to it; confirm the
   restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8755;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const FUNNELS = [{ id: 'f-pt', key: 'partners_tenders', name_en: 'Partners & Tenders', name_ar: 'شركاء ومناقصات', color: 'violet', sort_order: 1, active: true,
  field_template: [{ key: 'partner_type', label_en: 'Partner type', label_ar: 'نوع الشريك', type: 'text' }, { key: 'tender_value_sar', label_en: 'Tender value (SAR)', label_ar: 'قيمة المناقصة (ريال)', type: 'number', hover: true }, { key: 'tender_status', label_en: 'Tender status', label_ar: 'حالة المناقصة', type: 'text', hover: true }], created_at: null, updated_at: null }];
const BIZ = [{ id: 'b-pt-1', name: 'Harbor Authority Probe', name_ar: '', city: 'Riyadh', sector: 'gov', stage: 'won', source: 'tender', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  email: 'x@example.com', phone: '+966500000001', total_sar: 143750, website: '', is_client: true, converted_date: '2026-02-14', direct_client_id: null, channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '',
  created_at: '2026-01-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', raw: { isClient: 'true', totalSAR: 143750 }, funnel_id: 'f-pt', funnel_details: { partner_type: 'Government tender', tender_value_sar: 150000, tender_status: 'Won' }, archived_at: null },
  { id: 'b-pt-2', name: 'Orchard Freight Probe', name_ar: '', city: 'Jeddah', sector: 'logistics', stage: 'new', source: 'tender', assigned_to: 'QA Test Account', account_manager: null, email: 'y@example.com', phone: '+966500000002', total_sar: 0, website: 'https://example.org', is_client: false, converted_date: null, direct_client_id: null, channels: ['email'], prefs: {}, airline_deals: [], pricing: [], notes: 'probe lead',
    created_at: '2026-03-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', raw: { linkedin: 'x', licenceNumber: 'L-1', decisionMakers: 'CEO' }, funnel_id: 'f-pt', funnel_details: { partner_type: 'Partner', tender_value_sar: 9000 }, archived_at: null }];
const srv = start(PORT, { funnels: FUNNELS, businesses: BIZ, app_requests: [
  { id: 'r-probe-1', data: { id: 'r-probe-1', client: 'Harbor Authority Probe', service: 'Flights', stage: 'Booked', owner: 'QA', priority: 'Normal', sell: 25000, cost: 21000, createdAt: Date.now() } },
  { id: 'r-probe-2', data: { id: 'r-probe-2', client: 'Orchard Freight Probe', service: 'Hotels', stage: 'Quoting', owner: 'QA', priority: 'High', sell: 18000, createdAt: Date.now() } },
] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.requests) && DB.requests.some((r) => r.id === 'r-probe-1'), { timeout: 90000 }).catch(() => fail('the requests never loaded from the table'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s (see probe-today-queue-card)

  /* ---- 1. the Operations board ---- */
  const r1 = await p.evaluate(() => new Promise((res) => {
    current = 'ops'; render();
    setTimeout(() => {
      const view = document.getElementById('view'); const txt = (view.innerText || '').replace(/\s+/g, ' ');
      const tiles = [...view.querySelectorAll('.kpi')].map((k) => k.querySelector('.l').textContent.trim() + '=' + k.querySelector('.v').textContent.trim().split('\n')[0]);
      const card2 = [...view.querySelectorAll('.card, .col > div')].map((c) => c.innerText || '').find((t) => /Orchard Freight Probe/.test(t)) || '';
      res({ sar: /\bSAR\b|ريال/.test(txt), tiles, needsCost: (txt.match(/Needs a cost recorded\s*(\d+)/) || [])[1], noCostYet: /no cost yet/.test(card2), amounts: /25,?000|18,?000|△/.test(txt) });
    }, 900);
  }));
  if (!r1.sar && !r1.amounts && r1.needsCost === '1' && r1.noCostYet) ok(`Operations board: no SAR, no amounts, "Needs a cost recorded" = 1, the uncosted card says "no cost yet" (${r1.tiles.join(' · ')})`);
  else fail(`Operations board still reports money or miscounts: ${JSON.stringify(r1)} — the live-site "Pipeline value 183k SAR / Booked margin 28k SAR"`);
  const r1b = await p.evaluate(() => new Promise((res) => { try { editRequest('r-probe-1'); } catch (e) { return res({ err: String(e) }); } setTimeout(() => { const s = document.getElementById('r_sell'), c = document.getElementById('r_cost'); res({ sell: s && s.value, cost: c && c.value }); try { closeModal(); } catch (_) { } }, 400); }));
  if (r1b.sell === '25000' && r1b.cost === '21000') ok('…and the request form still holds sell 25000 / cost 21000 — money is entered here, read on Finance');
  else fail(`the request form lost its money inputs: ${JSON.stringify(r1b)}`);

  /* ---- 2. the funnel details card on a client ---- */
  const r2 = await p.evaluate(() => new Promise((res) => {
    current = 'leads'; openLead = 'b-pt-1'; render();   // a client card IS the lead detail with current='leads' (how the Clients list opens one)
    setTimeout(() => {
      const c = document.getElementById('funnelCard'); const txt = c ? c.innerText.replace(/\s+/g, ' ') : '(no card)';
      const masked = c ? c.querySelectorAll('[data-money-masked="1"]').length : 0;
      const viewTxt = (document.getElementById('view').innerText || '').replace(/\s+/g, ' ');
      res({ txt: txt.slice(0, 300), masked, shows150k: /150,?000/.test(viewTxt), recorded: /recorded — read on Finance/.test(txt), hasStatus: /Won/.test(txt) });
    }, 1500);
  }));
  if (r2.masked === 1 && r2.recorded && !r2.shows150k && r2.hasStatus) ok('client card: "Tender value (SAR)" reads "recorded — read on Finance"; 150,000 is nowhere on the page; the other answers still show');
  else fail(`client card prints money or lost its answers: ${JSON.stringify(r2)} — the live-site "Tender value (SAR) 150000"`);
  const r2b = await p.evaluate(() => new Promise((res) => { try { window.__editFunnelDetails('b-pt-1'); } catch (e) { return res({ err: String(e) }); } setTimeout(() => { const m = document.getElementById('fdModal'); const inp = m && [...m.querySelectorAll('input,select,textarea')].find((i) => String(i.value) === '150000'); res({ form: !!m, hasInput: !!inp }); if (m) m.remove(); }, 400); }));
  if (r2b.form && r2b.hasInput) ok('…and the edit form still offers the value (150000) in an input — nothing was erased');
  else fail(`the edit form lost the value: ${JSON.stringify(r2b)}`);

  /* ---- 3. the exports, captured in the page ---- */
  const r3 = await p.evaluate(() => new Promise(async (res) => {
    const caps = []; const oc = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { caps.push({ name: this.download, href: this.href }); return; } return oc.apply(this, arguments); };
    const out = {};
    for (const cur of ['clients', 'leads']) { current = cur; openLead = null; render(); await new Promise((r) => setTimeout(r, 400)); const got = {};
      for (const scope of ['list', 'full']) { caps.length = 0; try { exportCurrent(scope); } catch (e) { got[scope] = 'ERR ' + e.message; continue; } const c = caps[0]; if (!c) { got[scope] = 'no file'; continue; } const txt = await (await fetch(c.href)).text(); got[scope] = { header: txt.split('\n')[0].replace(/^﻿/, ''), cols: txt.split('\n')[0].split(',').length, has143750: /143750/.test(txt), hasSAR: /"[^"]*sar[^"]*"/i.test(txt.split('\n')[0]) }; }
      out[cur] = { header: got.list.header, has143750: got.list.has143750 || got.full.has143750, hasSAR: got.list.hasSAR || got.full.hasSAR, summaryCols: got.list.cols, fullCols: got.full.cols }; }
    HTMLAnchorElement.prototype.click = oc; res(out);
  }));
  const bad3 = Object.entries(r3).filter(([k, v]) => typeof v !== 'object' || /totalSAR/.test(v.header) || v.has143750 || v.hasSAR);
  if (!bad3.length) ok(`Leads and Clients exports (summary AND full) carry no money column and no amount (clients header: ${r3.clients.header.slice(0, 90)}…)`);
  else fail(`export still carries money: ${JSON.stringify(r3)}`);
  /* 2026-09-09 (live test, EX1): "summary" and "full details" used to be the same file */
  if (r3.clients.fullCols > r3.clients.summaryCols && r3.leads.fullCols > r3.leads.summaryCols) ok(`"full details" is a bigger file than "summary" (clients ${r3.clients.summaryCols} → ${r3.clients.fullCols} columns, leads ${r3.leads.summaryCols} → ${r3.leads.fullCols})`);
  else fail(`"full details" and "summary" are the same file again: ${JSON.stringify({ c: [r3.clients.summaryCols, r3.clients.fullCols], l: [r3.leads.summaryCols, r3.leads.fullCols] })} — the live-site EX1`);

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nmoney-off-ops-and-cards OK — money is entered where it is entered and read on Finance');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
