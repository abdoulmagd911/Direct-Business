/* probe-tier-filter-bilingual.mjs — the Clients tier filter reads Arabic but stores English
   (2026-09-03, round 45).

   Found by fixing the measuring instrument, not the app. sweep-language.mjs read `textContent`,
   which happily reads nodes the app has HIDDEN — js/22 hides the developer/QA cards on Settings
   with display:none, and the sweep reported all fourteen of their buttons as untranslated
   user-facing text, on two pages, 28 of its 36 findings. None of them visible to anybody. With the
   sweep taught to judge only what is on screen (and to stop flagging NDC / EMD / ZATCA / API,
   which a travel professional in Riyadh writes in Latin anyway), 36 findings became 1: a person's
   name, which is data and correctly untranslated.

   The one real leak it did find: the tier filter's two options carried NO value attribute, so the
   browser used their visible text as the value and `clFilter.tier=this.value` compared it against
   b.tier==='Key'. js/21 therefore refused to translate them — correctly, and by its own documented
   rule that a value-less option must never be translated because that changes what gets stored.
   The translator was right; the markup was the bug.

   This holds the fix in both directions at once, because either half alone is a defect:
     - in Arabic the words read رئيسي / قياسي, not "Key" / "Standard"
     - the VALUES stay "Key" / "Standard" — English, matching what b.tier holds
     - filtering actually works in Arabic, returning the same rows as in English
     - "All tiers" still means all

   Sabotage: drop the value attributes -> Arabic text becomes the stored value -> the Arabic
   filter matches nothing -> red. Translate the value instead of the text -> same. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8511;
let failures = 0;
function fail(m) { failures++; console.log('  ✗ ' + m); }
function ok(m) { console.log('  ✓ ' + m); }

const mk = (i, tier) => ({
  id: 'b-tier-' + i, name: 'QA Client ' + i, name_ar: 'عميل ' + i, city: 'Riyadh', sector: 'travel',
  stage: 'won', source: 'Direct Payments import', assigned_to: 'Othman', account_manager: 'Othman',
  contract_sla: '24h', next_review: null, total_sar: 1000, website: 'https://example.com',
  corp_email_flag: 'yes', is_client: true, converted_date: '2026-08-21', direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '',
  created_at: '2026-08-21T10:00:00Z', updated_at: '2026-08-21T10:00:00Z',
  raw: { isClient: 'true', tier: tier }, verification_source: 'manual',
  needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null,
  scrub_run_id: null, funnel_id: null, funnel_details: {}, stage_legacy: null,
  next_action_date: null, next_action_note: null, lost_reason: null, archived_at: null, archived_by: null,
});
// 2 Key, 3 Standard (one of them by omission — the app defaults a missing tier to Standard)
const BIZ = [mk(0, 'Key'), mk(1, 'Key'), mk(2, 'Standard'), mk(3, 'Standard'), mk(4, undefined)];

async function main() {
  const srv = start(PORT, { businesses: BIZ });
  const BASE = 'http://localhost:' + PORT;
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

  const tierSel = () => p.evaluate(() => {
    const s = [...document.querySelectorAll('#view select')].find((x) => /clFilter\.tier/.test(x.getAttribute('onchange') || ''));
    return s ? [...s.options].map((o) => ({ value: o.value, text: o.text.trim() })) : null;
  });
  const rows = () => p.evaluate(() => [...document.querySelectorAll('#view tbody tr')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
  const pick = async (v) => { await p.evaluate((x) => { clFilter.tier = x; render(); }, v); await p.waitForTimeout(1300); return rows(); };

  // ---------- English baseline
  await p.evaluate(() => { openLead = null; current = 'clients'; clFilter.tier = 'all'; render(); });
  await p.waitForTimeout(2200);
  const en = await tierSel();
  if (!en) { fail('no tier filter on the Clients page'); await b.close(); srv.close(); process.exit(1); }
  if (en.length === 3) ok('the tier filter offers all three choices');
  else fail('the tier filter has ' + en.length + ' options, expected 3');
  const enAll = (await pick('all')).length;
  const enKey = (await pick('Key')).length;
  const enStd = (await pick('Standard')).length;
  if (enAll === 5) ok(`"All tiers" shows every client (${enAll})`);
  else fail(`"All tiers" showed ${enAll} of 5`);
  if (enKey === 2) ok('filtering to Key returns exactly the two Key clients');
  else fail(`Key returned ${enKey}, expected 2`);
  if (enStd === 3) ok('filtering to Standard returns the three Standard clients — including the one whose tier was never set, which the app treats as Standard');
  else fail(`Standard returned ${enStd}, expected 3`);

  // ---------- the values are English, whatever the page language
  await p.evaluate(() => { clFilter.tier = 'all'; LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render(); });
  await p.waitForTimeout(1800);
  const ar = await tierSel();
  const vals = ar.map((o) => o.value).join(',');
  if (vals === 'all,Key,Standard') ok('in Arabic the stored values are still all,Key,Standard — English, matching what the record holds');
  else fail('the Arabic page changed what the filter stores: ' + vals);
  if (ar.some((o) => o.text === 'رئيسي') && ar.some((o) => o.text === 'قياسي')) ok('…while the words a person reads are Arabic — رئيسي and قياسي');
  else fail('the tier words are still English on an Arabic page: ' + JSON.stringify(ar.map((o) => o.text)));
  if (ar.some((o) => /كل الفئات/.test(o.text))) ok('…and so is "All tiers"');
  else fail('"All tiers" is still English in Arabic');
  if (!ar.some((o) => /[؀-ۿ]/.test(o.value))) ok('…with no Arabic anywhere in a value — Arabic never reaches the data (the rule probe-option-values-are-data holds)');
  else fail('an Arabic word ended up in a stored value: ' + vals);

  // ---------- and it still filters, in Arabic
  const arKey = (await pick('Key')).length;
  const arStd = (await pick('Standard')).length;
  const arAll = (await pick('all')).length;
  if (arKey === enKey && arStd === enStd && arAll === enAll) ok(`filtering works identically in Arabic — ${arKey} Key, ${arStd} Standard, ${arAll} all, the same rows as English`);
  else fail(`Arabic filtering differs from English: Key ${arKey}/${enKey}, Standard ${arStd}/${enStd}, all ${arAll}/${enAll}`);
  if (arKey > 0) ok('…and specifically it is not the empty list a translated value would produce');
  else fail('the Arabic tier filter matched nothing — the stored value no longer matches the data');

  await p.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); clFilter.tier = 'all'; render(); });
  const real = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', real.length ? JSON.stringify(real.slice(0, 3)) : 'none');
  if (real.length) fail(real.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ntier-filter-bilingual OK — the words are Arabic, the values are English, and the filter still finds the right clients');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
