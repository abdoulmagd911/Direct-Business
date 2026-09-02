/* probe-people-bridge.mjs — js/72: the people and history stored in the `contacts` and
   `activities` TABLES appear on the company card, with the human "needs confirmation" flag
   visible; attaching is idempotent; and a save never writes the table rows back into raw.

   Born from the 2026-09-02 audit: 29 live companies had their people only in the contacts
   table, which no screen read — the team saw "No contacts yet". Sabotage: remove the attach
   in js/72 → the card shows no contact → this fails. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8268;
const CONTACTS = [...Array(20)].map((_, i) => ({ id: 'c' + i, business_id: 'b' + i, name: 'Contact ' + i, role: 'Manager', email: 'c' + i + '@example.com', phone: '+96650000000' + i, verification_source: 'manual', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null, meta: {}, source: 'import' }))
  .concat([{ id: 'cF', business_id: 'b3', name: 'Flagged Person', role: 'Finance', email: 'flag@example.com', phone: '+966511111222', verification_source: 'manual', needs_manual_confirmation: true, confirmation_reason: 'Possible duplicate of contact c3 (same e-mail or phone) after merging — confirm which record to keep.', confirmed_by: null, confirmed_at: null, meta: {}, source: 'import' }]);
const srv = start(PORT, { contacts: CONTACTS });
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const bizWrites = [];
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname === '/rest/v1/businesses' && (rq.method() === 'POST' || rq.method() === 'PATCH')) {
      try { bizWrites.push(JSON.parse(rq.postData() || 'null')); } catch (_) {}
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  // let the bridge's first run land
  await p.waitForFunction(() => window.__v72 && window.__v72.runs > 0, null, { timeout: 15000 }).catch(() => null);
  const applied = await p.evaluate(() => window.__v72 || null);
  if (!applied || !applied.runs) fail('the bridge never ran after load');
  else ok(`bridge ran: attached ${applied.contacts} people and ${applied.activities} history rows from the tables`);

  // open the card of Test Company 3 (app id L3 ↔ uuid b3)
  await p.evaluate(() => { openLead = 'L3'; current = 'leads'; render(); });
  await p.waitForTimeout(1200);
  const card = await p.evaluate(() => ({
    contacts: [...document.querySelectorAll('#view .contact-row')].map((r) => r.textContent.replace(/\s+/g, ' ')),
    empty: /No contacts yet/.test([...document.querySelectorAll('#view .card')].map((c) => c.textContent).join(' ')),
    timeline: [...document.querySelectorAll('#view .tl-item')].map((r) => r.textContent.replace(/\s+/g, ' ')),
  }));
  if (!card.contacts.some((t) => /Contact 3/.test(t))) fail('the table contact "Contact 3" is not shown on the company card — the team would see "No contacts yet" — rows: ' + JSON.stringify(card.contacts));
  else ok('the table contact is shown on the company card');
  if (card.empty) fail('the card still says "No contacts yet" although the table holds people');
  else ok('the empty-state is gone');
  const badge = await p.evaluate(() => { const el = document.querySelector('.v72-confirm'); return el ? { text: el.textContent, title: el.getAttribute('title') || '' } : null; });
  if (!badge) fail('the flagged contact shows NO "needs confirmation" badge — the flag would be invisible again');
  else if (!/duplicate/i.test(badge.title)) fail('the badge exists but does not carry the reason: ' + JSON.stringify(badge));
  else ok('the flagged contact shows a "needs confirmation" badge carrying the reason');
  if (!card.timeline.some((t) => /Activity 3/.test(t))) fail('the table activity "Activity 3" is not shown in the company history — timeline: ' + JSON.stringify(card.timeline));
  else ok('table activity history is shown on the card');

  // idempotent: a second run attaches nothing new
  const before = await p.evaluate(() => (DB.businesses.find((x) => x.id === 'L3').contacts || []).length);
  await p.evaluate(() => new Promise((res) => window.v72Apply(res)));
  const after = await p.evaluate(() => (DB.businesses.find((x) => x.id === 'L3').contacts || []).length);
  if (after !== before) fail(`re-running the bridge duplicated contacts (${before} → ${after})`);
  else ok('re-running the bridge is idempotent — no duplicates');

  // a save must not write table rows back into raw
  await p.evaluate(() => { const bz = DB.businesses.find((x) => x.id === 'L3'); bz.notes = 'probe touch ' + Date.now(); if (typeof save === 'function') save(); });
  await p.waitForTimeout(2500);
  const rows = bizWrites.flat().filter((w) => w && (w.legacy_id === 'L3' || w.id === 'b3'));
  if (!rows.length) fail('no business write went out after save() — cannot judge the raw payload');
  else {
    const leaked = rows.some((w) => (w.raw && w.raw.contacts || []).some((c) => c && c._fromTable) || (w.raw && w.raw.activities || []).some((a) => a && a._fromTable));
    if (leaked) fail('table rows were written back into businesses.raw on save — they would double on the next load');
    else ok('save() stripped the table rows from raw — the table stays the single home of those people');
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} unexpected JS/console error(s)`);
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\npeople-bridge OK — table contacts/activities show on the card with the human flag visible, idempotently, and never leak back into raw on save.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
