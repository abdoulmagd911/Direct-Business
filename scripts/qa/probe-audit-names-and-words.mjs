/* probe-audit-names-and-words.mjs (2026-09-09, live test findings AU2, AU3, AU5) — the Activity
   & Audit log names the record and says what changed in words. Attack area (ad).

   PORT NOTE: 8701–8756 are taken. This is 8757, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: 245 rows reading "Lead / client · Edited — unknown — raw" or
   "Contact · Edited — unknown — business_id". No row named the record it touched; the
   description was the database's column names; a change inside the stored record showed as
   the one word "raw". A person cannot tell WHICH client changed or WHAT about it.

   Under test (screen read, not internals):
     1. A lead edit whose only column change is inside `raw` (an activity logged, last contact
        moved) → the row names the company and says "activity log, last contact" — not "raw".
     2. An invoice cost edit → the row names the invoice number and says "cost, profit".
     3. A contact edit of business_id → the row names the contact and says "linked company".
     4. The database column names are still there as a tooltip on the words (for whoever needs
        them) but are not the visible text.
     5. Rows are laid out as one line each on a hairline — not four separate boxes.
     6. (2026-09-10) raw-field keys outside the word list read as words (created date, funnel
        details, next action date); js/64's page-denied row reads "Page access · Refused ·
        Operations"; in Arabic the 'unknown' actor reads "غير معروف" — never "access · denied",
        "createdAt" or "unknown" on the Arabic page.

   Run:  node scripts/qa/probe-audit-names-and-words.mjs        (port 8757)
   Sabotage: in js/63 make recordName() return '' — checks 1–3 lose the name and go red; make
   fieldWord() return its key unchanged — the "raw"/"business_id" wording comes back and checks
   1 and 3 go red. Assert the sabotage APPLIED with a marker unique to it; confirm the restore by
   marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8757;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const now = Date.now();
const ROWS = [
  { id: 5001, at: new Date(now - 60e3).toISOString(), actor: 'u-qa', actor_name: 'QA Test Account', table_name: 'businesses', record_id: 'rec-a', action: 'edit',
    before_row: { id: 'rec-a', name: 'Harbor Lantern Probe', stage: 'won', raw: { name: 'Harbor Lantern Probe', activities: [{ type: 'Note', note: 'old' }], lastContact: 1786352400000 } },
    after_row: { id: 'rec-a', name: 'Harbor Lantern Probe', stage: 'won', raw: { name: 'Harbor Lantern Probe', activities: [{ type: 'Note', note: 'old' }, { type: 'Note', note: 'new' }], lastContact: now } }, undone_at: null, undone_by: null },
  { id: 5002, at: new Date(now - 120e3).toISOString(), actor: 'u-qa', actor_name: 'QA Test Account', table_name: 'finance_invoices', record_id: 'inv-1', action: 'edit',
    before_row: { id: 'inv-1', invoice_no: 'QA-INV-77', client_group: 'Quill Meadow Probe', cost_sar: 0, profit_sar: 1000 }, after_row: { id: 'inv-1', invoice_no: 'QA-INV-77', client_group: 'Quill Meadow Probe', cost_sar: 400, profit_sar: 600 }, undone_at: null, undone_by: null },
  { id: 5003, at: new Date(now - 180e3).toISOString(), actor: null, actor_name: 'unknown', table_name: 'contacts', record_id: 'c-1', action: 'edit',
    before_row: { id: 'c-1', name: 'Delegations Office Probe', business_id: 'rec-old' }, after_row: { id: 'c-1', name: 'Delegations Office Probe', business_id: 'rec-a' }, undone_at: null, undone_by: null },
  /* 2026-09-10 (second live pass): a raw-field edit whose keys are not in the word list, a page-denied row, a delete by 'unknown' */
  { id: 5004, at: new Date(now - 240e3).toISOString(), actor: 'u-qa', actor_name: 'QA Test Account', table_name: 'businesses', record_id: 'rec-b', action: 'edit',
    before_row: { id: 'rec-b', name: 'Cedar Compass Probe', raw: { name: 'Cedar Compass Probe', createdAt: 1, funnelDetails: {}, nextActionDate: null } },
    after_row: { id: 'rec-b', name: 'Cedar Compass Probe', raw: { name: 'Cedar Compass Probe', createdAt: 2, funnelDetails: { a: 1 }, nextActionDate: '2026-10-01' } }, undone_at: null, undone_by: null },
  { id: 5005, at: new Date(now - 300e3).toISOString(), actor: 'u-qa', actor_name: 'QA Test Account', table_name: 'access', record_id: 'ops', action: 'denied', before_row: null, after_row: { page: 'ops' }, undone_at: null, undone_by: null },
  { id: 5006, at: new Date(now - 360e3).toISOString(), actor: null, actor_name: 'unknown', table_name: 'businesses', record_id: 'rec-c', action: 'delete', before_row: { id: 'rec-c', name: 'Willow Gate Probe' }, after_row: null, undone_at: null, undone_by: null },
];
const srv = start(PORT, { record_history: ROWS });
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof render === 'function' && typeof window.renderActivity === 'function', { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.evaluate(() => { openLead = null; current = 'activity'; render(); });
  await p.waitForFunction(() => document.querySelector('#view .act-row[data-hist-id="5001"]'), { timeout: 30000 }).catch(() => fail('the log rows never rendered'));
  const rows = await p.evaluate(() => {
    const out = {};
    [5001, 5002, 5003].forEach((id) => {
      const r = document.querySelector('#view .act-row[data-hist-id="' + id + '"]'); if (!r) { out[id] = null; return; }
      const name = r.querySelector('[data-hist-name]'); const f = r.querySelector('[data-hist-fields]');
      const cs = getComputedStyle(r);
      out[id] = { txt: r.innerText.replace(/\s+/g, ' ').trim(), name: name ? name.textContent : '', words: f ? f.textContent : '', tip: f ? f.getAttribute('title') : '', display: cs.display, boxes: [...r.children].filter((c) => getComputedStyle(c).borderStyle !== 'none' && getComputedStyle(c).borderWidth !== '0px').length };
    });
    return out;
  });
  const a = rows[5001], i = rows[5002], c = rows[5003];
  if (a && a.name === 'Harbor Lantern Probe' && /activity log/.test(a.words) && /last contact/.test(a.words) && !/\braw\b/.test(a.txt))
    ok(`lead edit inside raw → "${a.txt.slice(0, 110)}" — names the company, says what moved, never "raw"`);
  else fail(`lead edit inside raw: ${JSON.stringify(a)} — the live-site "Lead / client · Edited — unknown — raw"`);
  if (i && i.name === 'QA-INV-77' && /cost/.test(i.words) && /profit/.test(i.words) && !/cost_sar/.test(i.txt))
    ok(`invoice edit → names ${i.name}, says "${i.words.trim()}"`);
  else fail(`invoice edit: ${JSON.stringify(i)}`);
  if (c && c.name === 'Delegations Office Probe' && /linked company/.test(c.words) && !/business_id/.test(c.txt))
    ok(`contact edit → names the contact, says "${c.words.trim()}" not business_id`);
  else fail(`contact edit: ${JSON.stringify(c)} — the live-site "Contact · Edited — unknown — business_id"`);
  if (a && /raw/.test(a.tip) && c && /business_id/.test(c.tip)) ok('the database column names survive as a tooltip on the words');
  else fail(`tooltip with the column names missing: ${JSON.stringify({ a: a && a.tip, c: c && c.tip })}`);
  if (a && a.display === 'grid' && a.boxes === 0) ok('each row is one gridded line on a hairline — no boxed cells');
  else fail(`row layout: ${JSON.stringify({ display: a && a.display, boxes: a && a.boxes })} — the live-site four-boxes-per-row look`);
  /* ---- 6. (2026-09-10) keys outside the word list, the page-denied row, the 'unknown' actor — EN then AR ---- */
  const more = await p.evaluate(() => { const g = (id) => { const r = document.querySelector('#view .act-row[data-hist-id="' + id + '"]'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; }; return { k: g(5004), d: g(5005), u: g(5006) }; });
  if (more.k && /created date/.test(more.k) && /funnel details/.test(more.k) && /next action date/.test(more.k) && !/createdAt|funnelDetails|nextActionDate/.test(more.k)) ok(`raw-field keys read as words: "${more.k.slice(0, 110)}"`); else fail(`raw-field keys: ${JSON.stringify(more.k)} — the live-site "createdAt, funnelDetails, nextActionDate"`);
  if (more.d && /Page access · Refused · Operations/.test(more.d)) ok(`a page-denied row reads "${more.d.slice(0, 80)}"`); else fail(`page-denied row: ${JSON.stringify(more.d)} — the live-site "access · denied"`);
  await p.evaluate(() => { toggleLang(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { openLead = null; current = 'activity'; render(); });
  await p.waitForFunction(() => document.querySelector('#view .act-row[data-hist-id="5006"]'), { timeout: 30000 }).catch(() => {});
  const ar = await p.evaluate(() => { const g = (id) => { const r = document.querySelector('#view .act-row[data-hist-id="' + id + '"]'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; }; return { k: g(5004), d: g(5005), u: g(5006) }; });
  if (ar.u && /غير معروف/.test(ar.u) && !/unknown/.test(ar.u)) ok('AR: the actor the trigger could not name reads "غير معروف", not "unknown"'); else fail(`AR unknown actor: ${JSON.stringify(ar.u)}`);
  if (ar.d && /الوصول إلى صفحة · رُفض · العمليات/.test(ar.d)) ok(`AR: the page-denied row reads "${ar.d.slice(0, 60)}"`); else fail(`AR page-denied row: ${JSON.stringify(ar.d)}`);
  if (ar.k && !/createdAt|funnelDetails|nextActionDate/.test(ar.k) && /تاريخ الإنشاء/.test(ar.k)) ok('AR: raw-field keys read as Arabic words'); else fail(`AR raw-field keys: ${JSON.stringify(ar.k)}`);
  await p.evaluate(() => { toggleLang(); });

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\naudit-names-and-words OK — the log says who changed what, about which record, in words');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
