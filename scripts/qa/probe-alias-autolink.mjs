/* probe-alias-autolink.mjs — M14 on the LINKING path, not only the display path.
   Owner's instruction (2026-08-25), verbatim shape: the client-name alias map "should sit
   beside [finExclusionCheck] and be called the same way" on the import path — not applied once
   at display time. The 2026-08-29 sweep found the letter of that unmet: finCanon() (display)
   consulted the map, but js/41's automatic finance↔client linker did not, so a freshly
   imported alias spelling that is not itself a business name stayed "needs linking" — and
   finSectorOf() (js/16), which reads the link by RAW client_group, would sector it as plain
   B2B even when its sibling spelling is a linked Tender client.

   THE CLAIM: an unlinked client_group that is a registered alias of an already-linked sibling
   gets linked to the SAME business automatically (confirmed_by 'auto-match-alias'), with the
   write going out in the same shape the real auto-linker uses. Sabotage: remove the alias
   fallback in js/41-money-in.js → the group stays unlinked → this fails. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8266;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

const SIB_LINKED = 'Alias Sibling Linked Spelling';
const SIB_NEW = 'Alias Sibling Fresh Spelling';   // not a business name in the mock — name-matching cannot link it
const BIZ = 'b2';

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const linkWrites = [];
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname === '/rest/v1/finance_client_links' && rq.method() === 'POST') {
      try { linkWrites.push(JSON.parse(rq.postData() || 'null')); } catch (_) {}
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

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
  await p.waitForTimeout(2500); // let the first linker pass over the fixture settle

  // Seed: two synthetic invoice rows under two spellings; only the first is linked (to b2);
  // an ACTIVE alias entry declares them the same company. Neither spelling is a business name.
  const seeded = await p.evaluate(([a, bName, biz]) => {
    if (!window.FIN || !Array.isArray(FIN.rows)) return 'no FIN.rows';
    const base = FIN.rows[0]; if (!base) return 'no base row';
    const mk = (g, no) => Object.assign({}, base, { id: 'alias-' + no, invoice_no: no, client_group: g, customer_raw_name: g, record_type: 'b2b', deleted_at: null, total_incl_vat_sar: 1000, revenue_sar: 1000, cost_sar: 0, profit_sar: 1000 });
    FIN.rows.push(mk(a, '777000001'), mk(bName, '777000002'));
    FIN.linkByGroup = FIN.linkByGroup || {};
    FIN.linkByGroup[a] = { client_group: a, business_id: biz, is_client: true, confirmed_by: 'manual' };
    DB.settings = DB.settings || {}; DB.settings.financeGroupMap = DB.settings.financeGroupMap || [];
    DB.settings.financeGroupMap.push({ id: 'fg-probe', canonicalName: a, aliases: [a, bName], active: true, addedBy: 'probe', addedAt: new Date().toISOString() });
    if (typeof clearFinCanon === 'function') clearFinCanon();
    return 'ok';
  }, [SIB_LINKED, SIB_NEW, BIZ]);
  if (seeded !== 'ok') fail('seeding failed: ' + seeded);

  const before = await p.evaluate((g) => { const l = (FIN.linkByGroup || {})[g]; return l ? (l.business_id || null) : null; }, SIB_NEW);
  if (before) fail(`test setup contaminated: "${SIB_NEW}" is already linked to ${before} before the linker ran`);
  else ok('baseline: the fresh alias spelling is unlinked (and is not a business name, so name-matching alone cannot link it)');

  // Trigger the linker the way the app does: a render schedules a pass ~400ms later.
  await p.evaluate(() => { if (typeof render === 'function') render(); });
  await p.waitForTimeout(2500);

  const after = await p.evaluate((g) => { const l = (FIN.linkByGroup || {})[g]; return l ? { business_id: l.business_id || null, confirmed_by: l.confirmed_by || null } : null; }, SIB_NEW);
  if (!after || after.business_id !== BIZ) fail(`ALIAS NOT CONSULTED ON THE LINKING PATH: "${SIB_NEW}" should have been linked to its sibling's business ${BIZ}, got ${JSON.stringify(after)}`);
  else ok(`the fresh alias spelling was linked to the sibling's business (${BIZ}) automatically`);
  if (after && after.confirmed_by !== 'auto-match-alias') fail(`link provenance should say auto-match-alias (so a human can see WHY it linked), got ${after && after.confirmed_by}`);
  else if (after) ok('provenance recorded as auto-match-alias — visible, never silent');

  const wrote = linkWrites.flat().find((w) => w && w.client_group === SIB_NEW);
  if (!wrote) fail('no finance_client_links write went out for the alias spelling — the link would not survive a reload');
  else if (wrote.business_id !== BIZ || wrote.is_client !== true) fail(`the persisted link payload is wrong: ${JSON.stringify(wrote)}`);
  else ok('the link was written to finance_client_links in the real auto-linker shape (business_id + is_client:true)');

  // ---- M18 precedence: a declared alias sibling WINS over a name match ----
  // The MDD split happened exactly this way: the Arabic spelling name-matched a second,
  // duplicate company record while the owner had already declared it the same company.
  const SIB2_LINKED = 'Alias Second Linked Spelling';
  const SIB2_NEW = 'Fresh Alias Name Co';   // ALSO the name of a business record seeded below → name index would say bZ
  await p.evaluate(([a, bName]) => {
    const base = FIN.rows[0];
    const mk = (g, no) => Object.assign({}, base, { id: 'alias2-' + no, invoice_no: no, client_group: g, customer_raw_name: g, record_type: 'b2b', deleted_at: null, total_incl_vat_sar: 1000, revenue_sar: 1000, cost_sar: 0, profit_sar: 1000 });
    FIN.rows.push(mk(a, '777000003'), mk(bName, '777000004'));
    FIN.linkByGroup[a] = { client_group: a, business_id: 'b2', is_client: true, confirmed_by: 'manual' };
    DB.businesses.push({ id: 'bZ', name: bName, stage: 'Prospect' });   // the decoy: a record whose name matches the fresh spelling
    DB.settings.financeGroupMap.push({ id: 'fg-probe-2', canonicalName: a, aliases: [a, bName], active: true, addedBy: 'probe', addedAt: new Date().toISOString() });
    if (typeof clearFinCanon === 'function') clearFinCanon();
  }, [SIB2_LINKED, SIB2_NEW]);
  await p.evaluate(() => { if (typeof render === 'function') render(); });
  await p.waitForTimeout(2500);
  const prec = await p.evaluate((g) => { const l = (FIN.linkByGroup || {})[g]; return l ? { business_id: l.business_id || null, confirmed_by: l.confirmed_by || null } : null; }, SIB2_NEW);
  if (!prec || prec.business_id !== 'b2') fail(`PRECEDENCE: the declared alias sibling (b2) must win over the name-matched decoy record (bZ) — got ${JSON.stringify(prec)}. This is the exact mechanism that split MDD into two records.`);
  else ok('PRECEDENCE: the declared alias sibling won over a same-name decoy record — the MDD split cannot recur through the linker');

  // ---- Arabic letter variants (2026-09-02): an alias spelled with ة must catch a row spelled with ه ----
  const AR_ALIAS = 'شركة الاختبار المحدودة';        // registered spelling (ta marbuta, alef)
  const AR_ROW = 'شركه الإختبار المحدوده';          // export spelling (ha, hamza) — same company to any reader
  await p.evaluate(([a, bName]) => {
    const base = FIN.rows[0];
    const mk = (g, no) => Object.assign({}, base, { id: 'alias3-' + no, invoice_no: no, client_group: g, customer_raw_name: g, record_type: 'b2b', deleted_at: null, total_incl_vat_sar: 1000, revenue_sar: 1000, cost_sar: 0, profit_sar: 1000 });
    FIN.rows.push(mk(a, '777000005'), mk(bName, '777000006'));
    FIN.linkByGroup[a] = { client_group: a, business_id: 'b2', is_client: true, confirmed_by: 'manual' };
    DB.settings.financeGroupMap.push({ id: 'fg-probe-3', canonicalName: a, aliases: [a], active: true, addedBy: 'probe', addedAt: new Date().toISOString() });
    if (typeof clearFinCanon === 'function') clearFinCanon();
  }, [AR_ALIAS, AR_ROW]);
  await p.evaluate(() => { if (typeof render === 'function') render(); });
  await p.waitForTimeout(2500);
  const arLink = await p.evaluate((g) => { const l = (FIN.linkByGroup || {})[g]; return l ? l.business_id || null : null; }, AR_ROW);
  if (arLink !== 'b2') fail(`ARABIC VARIANTS: "${AR_ROW}" should match the alias "${AR_ALIAS}" (ة/ه, أ/ا are the same word) and link to b2 — got ${JSON.stringify(arLink)}`);
  else ok('ARABIC VARIANTS: ta-marbuta/ha and hamza/alef spellings match the same alias and link automatically');

  // ---- Suggestion path (2026-09-02): two UNREGISTERED groups differing only by ة/ه must be
  //      offered as ONE "Possible duplicate" suggestion on Finance › Import ----
  const SUG_A = 'شركة النور للسفر', SUG_B = 'شركه النور للسفر';
  await p.evaluate(([a, bName]) => {
    const base = FIN.rows[0];
    const mk = (g, no) => Object.assign({}, base, { id: 'sug-' + no, invoice_no: no, client_group: g, customer_raw_name: g, record_type: 'b2b', deleted_at: null, total_incl_vat_sar: 500, revenue_sar: 500, cost_sar: 0, profit_sar: 500 });
    FIN.rows.push(mk(a, '777000007'), mk(bName, '777000008'));
    if (typeof clearFinCanon === 'function') clearFinCanon();
    document.querySelectorAll('.v62-guardrails').forEach((c) => c.remove());
    if (typeof window.finGo === 'function') window.finGo('import');
  }, [SUG_A, SUG_B]);
  await p.waitForTimeout(2000);
  const sug = await p.evaluate(([a, bName]) => { const t = (document.querySelector('.v62-guardrails') || {}).innerText || ''; const line = t.split('\n').find((l) => /Possible duplicate|احتمال تكرار/.test(l) && l.includes(a) && l.includes(bName)); return line || null; }, [SUG_A, SUG_B]);
  if (!sug) fail(`SUGGESTION: "${SUG_A}" and "${SUG_B}" (ة/ه) were not offered as one duplicate suggestion on the Import card`);
  else ok('SUGGESTION: the ة/ه pair is offered as one "Possible duplicate" suggestion with one click to merge');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} unexpected JS/console error(s)`);

  await b.close();
  srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nalias-autolink OK — the alias map is consulted on the linking path: a fresh alias spelling links to its sibling\'s business automatically, with visible provenance.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
