/* probe-ownership-visible.mjs — who owns this client, and can you find the ones nobody owns?
   (2026-09-03, round 43.)

   Found by sweeping the LIVE data rather than the code. Two things, both about ownership:

   1. rowToApp() — the one function that turns a database row into the object every screen reads —
      never looked at `assigned_to` or `account_manager` AT ALL. Ownership reached the screen only
      if it happened to be inside the `raw` JSON blob, which is true for every record the app itself
      saved. Measured live the same day: all 88 owned records carry the name in BOTH places, so
      nothing on screen was wrong. The trap is anything that assigns ownership WITHOUT the app — a
      SQL update, or an import like the one that created 20 corporate clients in August. It writes
      the column, raw stays empty, and the app shows "Unassigned" over a name sitting right there
      in the database. The raw blob still wins; the column is a fallback for a row the app has
      never saved.

   2. The account-manager filter was built from the names actually present, with .filter(Boolean) —
      so there was no way to ASK for the clients nobody owns. Live that day 20 of Direct's 28
      clients had no account manager (every one from that August import), and the only way to see
      them was to scroll and spot red tags. The filter now offers "Unassigned (n)".

   Sabotage: drop the two column fallbacks -> a client owned only in the column reads Unassigned
   -> red. Drop the __none__ option/branch -> the unowned clients cannot be listed -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
function fail(m) { failures++; console.log('  ✗ ' + m); }
function ok(m) { console.log('  ✓ ' + m); }

/* `raw` is what the app writes; the columns are what an import or a SQL update writes.
   The four shapes that matter are all here. */
const mk = (i, o) => Object.assign({
  id: 'b-own-' + i, name: 'QA Client ' + i, name_ar: 'عميل ' + i, city: 'Riyadh', sector: 'travel',
  stage: 'won', source: 'Direct Payments import', assigned_to: null, account_manager: null,
  contract_sla: '24h', next_review: null, total_sar: 1000, website: 'https://example.com',
  corp_email_flag: 'yes', is_client: true, converted_date: '2026-08-21', direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '',
  created_at: '2026-08-21T10:00:00Z', updated_at: '2026-08-21T10:00:00Z',
  raw: { isClient: 'true' }, verification_source: 'manual', needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null,
  funnel_id: null, funnel_details: {}, stage_legacy: null, next_action_date: null,
  next_action_note: null, lost_reason: null, archived_at: null, archived_by: null,
}, o);

const BIZ = [
  // 0: owned in the COLUMN only — the import case. Must read as owned.
  mk(0, { account_manager: 'Othman', assigned_to: 'Othman' }),
  // 1: owned in the RAW blob only — every record the app saved. Must keep working.
  mk(1, { raw: { isClient: 'true', accountManager: 'Raad', assignedTo: 'Raad' } }),
  // 2: both, and they disagree — raw wins, because that is the existing behaviour and this
  //    round deliberately did not change which one is authoritative
  mk(2, { account_manager: 'FromColumn', raw: { isClient: 'true', accountManager: 'FromRaw' } }),
  // 3,4,5: nobody owns them
  mk(3, {}), mk(4, {}), mk(5, { account_manager: '   ' }),   // whitespace is not an owner
];

async function run(port, fn) {
  const srv = start(port, { businesses: BIZ });
  const BASE = 'http://localhost:' + port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.dismiss());
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
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(7000);
  await p.evaluate(() => { openLead = null; current = 'clients'; render(); });
  await p.waitForTimeout(2200);
  try { await fn(p); } finally {
    const real = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
    if (real.length) fail(real.length + ' JS error(s): ' + JSON.stringify(real.slice(0, 3)));
    await b.close(); srv.close();
  }
}

const state = (p) => p.evaluate(() => ({
  owners: (DB.businesses || []).filter((b) => b.isClient).map((b) => ({ id: b.id, am: b.accountManager || '', as: b.assignedTo || '' })),
  rows: [...document.querySelectorAll('#view tbody tr')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()),
  opts: (() => { const s = [...document.querySelectorAll('#view select')].find((x) => /clFilter\.owner/.test(x.getAttribute('onchange') || '')); return s ? [...s.options].map((o) => o.value + '|' + o.text) : null; })(),
}));

async function main() {
  await run(8491, async (p) => {
    const s = await state(p);
    if (!s.opts) { fail('no account-manager filter on the Clients page at all'); return; }

    // ---------- 1. ownership written by an import (column only) must be seen
    const c0 = s.owners.find((x) => x.id === 'b-own-0');
    if (c0 && c0.am === 'Othman') ok('a client whose owner was set by an import — the column, not the app — reads as owned, not "Unassigned"');
    else fail('an owner sitting in the database column never reached the screen: ' + JSON.stringify(c0));
    if (/Othman/.test(s.rows.join(' '))) ok('…and the name is on the row a person actually looks at');
    else fail('the owner is on the object but not on the row');

    // ---------- 2. the existing path must not regress
    const c1 = s.owners.find((x) => x.id === 'b-own-1');
    if (c1 && c1.am === 'Raad') ok('a client the app itself saved still reads its owner from the saved record — unchanged');
    else fail('the existing ownership path broke: ' + JSON.stringify(c1));

    // ---------- 3. which source wins is deliberately unchanged
    const c2 = s.owners.find((x) => x.id === 'b-own-2');
    if (c2 && c2.am === 'FromRaw') ok('when both hold a name they disagree on, the saved record still wins — the column is a fallback, it did not quietly become the authority');
    else fail('the column overrode the saved record; that is a behaviour change this round did not intend: ' + JSON.stringify(c2));

    // ---------- 4. the unowned are countable and listable
    const none = s.opts.find((o) => o.startsWith('__none__|'));
    if (none) ok('the manager filter offers the clients nobody owns: ' + JSON.stringify(none.split('|')[1]));
    else fail('there is still no way to ask for the unowned clients: ' + JSON.stringify(s.opts));
    if (none && /\(3\)/.test(none)) ok('…and it counts them correctly — 3 here, and whitespace is not an owner');
    else fail('the unowned count is wrong (expected 3): ' + JSON.stringify(none));

    await p.evaluate(() => { clFilter.owner = '__none__'; render(); });
    await p.waitForTimeout(1500);
    const filtered = await state(p);
    if (filtered.rows.length === 3) ok('choosing it lists exactly those three and nothing else');
    else fail('the unowned filter returned ' + filtered.rows.length + ' rows, expected 3');
    if (!/Othman|Raad|FromRaw/.test(filtered.rows.join(' '))) ok('…with no owned client leaking into the list');
    else fail('an owned client showed up under "Unassigned": ' + JSON.stringify(filtered.rows));

    // a named manager still filters to just their own
    await p.evaluate(() => { clFilter.owner = 'Othman'; render(); });
    await p.waitForTimeout(1500);
    const one = await state(p);
    if (one.rows.length === 1 && /Othman/.test(one.rows[0])) ok('picking a named manager still filters to just their clients');
    else fail('the named-manager filter broke: ' + JSON.stringify(one.rows));

    // ---------- 5. Arabic
    await p.evaluate(() => { clFilter.owner = 'all'; LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render(); });
    await p.waitForTimeout(1800);
    const ar = await state(p);
    const arNone = (ar.opts || []).find((o) => o.startsWith('__none__|'));
    if (arNone && /غير معيّن/.test(arNone)) ok('the option reads Arabic on an Arabic page — built bilingual at source, because the translator matches an option\'s text exactly and "Unassigned (3)" is not the bare word its dictionary holds');
    else fail('the unassigned option is still English in Arabic: ' + JSON.stringify(arNone));
    if (arNone && /\(3\)/.test(arNone)) ok('…and still carries the count');
    else fail('the Arabic option lost its count');
    await p.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });
  });

  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nownership-visible OK — an owner in the database column is seen, and the clients nobody owns can be asked for by name');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
