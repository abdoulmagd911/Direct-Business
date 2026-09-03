/* probe-funnel-details.mjs — the funnel details card and its editor (2026-09-03, round 42).

   WHY THIS DID NOT EXIST. The mock's only funnel was {key:'default', field_template:[]} and every
   seeded lead had funnel_id:null — so fdef() never matched, the card never rendered, and not one
   of the 120-odd probes had ever drawn a single funnel field. Seven funnels are live, 91 leads
   carry answers, and 1,010 of 1,013 leads are assigned to a funnel. The same shape that hid
   defects in rounds 19, 20, 33 and 41: an unseeded mock table is not a passing test, it is no test.

   What driving it found, both confirmed by hand before the fix:

   1. THE CARD AND EDITOR WERE ENGLISH-ONLY. Every funnel carries name_ar and every field in
      field_template carries label_ar — the Arabic was already written, sitting in the data — and
      the card printed name_en / label_en whatever the language, plus "Yes"/"No" and an English
      "details" heading. 72 of the 91 funnelled leads are Website Form — Entities, worked by BD
      staff in Arabic.

   2. PRESSING SAVE DESTROYED ANSWERS NOBODY SAW. The save built a fresh {} from the CURRENT
      template and assigned it over funnelDetails, so any stored key the template no longer lists
      was deleted — silently, by someone editing an unrelated field. Measured live the same day:
      zero leads carry an orphan key right now, so nothing has been lost yet. But templates are
      edited (past_invoices was built three weeks ago) and the importer writes funnel_details
      straight in. This is the latent half of the round, guarded so it stays latent.

   3. NO GUARD ON THE EDITOR. window.__editFunnelDetails was callable by anyone, and the Edit
      button was drawn for everyone — including a read-only share link. Exactly the shape fixed in
      Finance the day before (a share link that could write).

   Deliberately NOT changed: a select:'s option values stay English. They are stored values, not
   labels — translating them would write Arabic into the data and break every filter that reads
   them. That is the rule probe-option-values-are-data already holds.

   Sabotage each fix in turn: print label_en unconditionally -> red; rebuild out={} from the
   template -> red; drop the fnMayEdit checks -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
function fail(m) { failures++; console.log('  ✗ ' + m); }
function ok(m) { console.log('  ✓ ' + m); }

/* Every type the seven live funnels actually use, read from the database on 2026-09-03:
   text, textarea, boolean, date, number, and select:a,b,c. */
const TEMPLATE = [
  { key: 'how_identified', label_en: 'How we identified them', label_ar: 'كيف تعرفنا عليهم', type: 'text' },
  { key: 'official_site', label_en: 'Official website', label_ar: 'الموقع الرسمي', type: 'text' },
  { key: 'form_received', label_en: 'Form received on', label_ar: 'تاريخ استلام النموذج', type: 'date' },
  { key: 'research_status', label_en: 'Research status', label_ar: 'حالة البحث', type: 'select:pending,done' },
  { key: 'has_app', label_en: 'Has mobile app', label_ar: 'لديهم تطبيق', type: 'boolean' },
  { key: 'tender_value', label_en: 'Tender value', label_ar: 'قيمة المناقصة', type: 'number' },
  { key: 'notes_long', label_en: 'Original message', label_ar: 'الرسالة الأصلية', type: 'textarea' },
  // a template row with NO Arabic: must fall back to its English label, never to a blank
  { key: 'no_arabic_yet', label_en: 'Partnership angle', label_ar: '', type: 'text' },
];

const FUNNELS = [{
  id: 'f-ent', key: 'website_form_entity', name_en: 'Website Form — Entities', name_ar: 'نموذج الموقع — جهات',
  color: 'orange', sort_order: 1, active: true, field_template: TEMPLATE, created_at: null, updated_at: null,
}];

const biz = (i, extra) => Object.assign({
  id: 'b-fn-' + i, name: 'QA Funnel Co ' + i, name_ar: 'شركة قمعية ' + i, city: 'Riyadh', sector: 'travel',
  stage: 'new', source: 'website', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  email: 'a@example.com', phone: '+96650000000' + i, contract_sla: '24h', next_review: null,
  total_sar: 0, website: 'https://example.com', corp_email_flag: 'yes', is_client: false, converted_date: null,
  direct_client_id: null, channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '',
  created_at: '2026-06-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', raw: {}, verification_source: 'manual',
  needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null,
  scrub_run_id: null, funnel_id: 'f-ent', stage_legacy: null, next_action_date: null, next_action_note: null,
  lost_reason: null, archived_at: null, archived_by: null,
}, extra);

const BIZ = [
  // lead 0 carries an answer for a key the template no longer lists — the destruction case
  biz(0, { funnel_details: { how_identified: 'Chamber list', research_status: 'pending', has_app: true, tender_value: 45000, legacy_note: 'kept from the 2026 sheet import' } }),
  biz(1, { funnel_details: { how_identified: 'Referral', official_site: 'https://example.org' } }),
  // an answer carrying characters that must survive escaping intact
  biz(2, { funnel_details: { how_identified: 'Sales & Ops <team> "A"' } }),
];

async function run(port, fn, tier) {
  const srv = start(port, { funnels: FUNNELS, businesses: BIZ });
  const BASE = 'http://localhost:' + port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.accept());
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
  if (tier) await p.evaluate((t) => { window.__userTier = t; }, tier);
  try { await fn(p, BASE); } finally {
    const real = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
    if (real.length) fail(real.length + ' JS error(s): ' + JSON.stringify(real.slice(0, 3)));
    await b.close(); srv.close();
  }
}

// the card must be visible to a person, not merely present in the DOM (round 33's lesson:
// index.html force-hides some classes, and textContent happily reads an invisible node)
const cardText = (p) => p.evaluate(() => {
  const c = document.getElementById('funnelCard');
  if (!c) return { missing: true };
  const r = c.getBoundingClientRect();
  return { txt: c.innerText.replace(/\s+/g, ' ').trim(), shown: r.width > 0 && r.height > 0, editBtn: !!c.querySelector('button') };
});

async function main() {
  await run(8471, async (p, BASE) => {
    // ---------- 1. the card renders at all
    await p.evaluate(() => { current = 'leads'; openLead = 'b-fn-0'; render(); });
    await p.waitForTimeout(2000);
    const en = await cardText(p);
    if (en.missing) { fail('no funnel details card rendered at all — the whole feature is dark'); return; }
    if (en.shown) ok('the funnel details card renders and is actually visible on screen');
    else fail('the card is in the DOM but has no size — invisible to the person reading it');
    const enLabels = TEMPLATE.map((f) => f.label_en).filter((l) => !en.txt.includes(l));
    if (!enLabels.length) ok(`all ${TEMPLATE.length} template fields are on the English card`);
    else fail('fields missing from the English card: ' + enLabels.join(', '));
    if (/45000/.test(en.txt) && /Chamber list/.test(en.txt)) ok('…showing the stored answers, not empty placeholders');
    else fail('stored answers are not on the card: ' + JSON.stringify(en.txt.slice(0, 200)));

    // ---------- 2. escaping: an answer with & < > " survives intact
    await p.evaluate(() => { openLead = 'b-fn-2'; render(); });
    await p.waitForTimeout(1600);
    const esc = await cardText(p);
    if (/Sales & Ops <team> "A"/.test(esc.txt)) ok('an answer containing & < > and quotes is shown exactly as typed');
    else fail('an answer with special characters came out mangled: ' + JSON.stringify(esc.txt.slice(0, 200)));

    // ---------- 3. ARABIC — the heart of this round
    await p.evaluate(() => { LANG = 'ar'; applyLang(); openLead = 'b-fn-0'; render(); });
    await p.waitForTimeout(2000);
    const ar = await cardText(p);
    const missingAr = TEMPLATE.filter((f) => f.label_ar).map((f) => f.label_ar).filter((l) => !ar.txt.includes(l));
    if (!missingAr.length) ok('in Arabic every field label is the Arabic one from the template — the Arabic was always in the data, it just was not being used');
    else fail('Arabic labels not used on the Arabic card: ' + missingAr.join(', '));
    const leakedEn = TEMPLATE.filter((f) => f.label_ar).map((f) => f.label_en).filter((l) => ar.txt.includes(l));
    if (!leakedEn.length) ok('…and no English label is left behind on it');
    else fail('English labels still on the Arabic card: ' + leakedEn.join(', '));
    if (/نموذج الموقع/.test(ar.txt)) ok('…the funnel name is the Arabic name too, not name_en');
    else fail('the Arabic card still heads with the English funnel name: ' + JSON.stringify(ar.txt.slice(0, 120)));
    if (/نعم/.test(ar.txt) && !/\bYes\b/.test(ar.txt)) ok('…and a yes/no answer reads نعم, not "Yes"');
    else fail('boolean answers are still English on the Arabic card');
    if (/Partnership angle/.test(ar.txt)) ok('a template row with no Arabic yet falls back to its English label rather than showing a blank row');
    else fail('a field with no label_ar lost its label entirely in Arabic — worse than the English it replaced');
    // stored option VALUES must stay as they are: they are data, not labels
    if (/pending/.test(ar.txt)) ok('a select answer keeps its stored value ("pending") in Arabic — translating it would write Arabic into the data and break every filter that reads it');
    else fail('a stored select value was translated for display and no longer matches what is in the database');

    // ---------- 4. the editor, in Arabic
    await p.evaluate(() => window.__editFunnelDetails('b-fn-0'));
    await p.waitForTimeout(900);
    const modal = await p.evaluate(() => { const m = document.getElementById('fdModal'); return m ? m.innerText.replace(/\s+/g, ' ') : null; });
    if (!modal) { fail('the editor did not open'); return; }
    if (/حفظ/.test(modal) && /إلغاء/.test(modal)) ok('the editor buttons are Arabic in Arabic');
    else fail('Save/Cancel are still English in the Arabic editor: ' + JSON.stringify(modal.slice(-120)));
    if (/كيف تعرفنا عليهم/.test(modal)) ok('…and its field labels lead with the Arabic');
    else fail('the Arabic editor labels lead with English');

    // ---------- 5. THE DESTRUCTION CASE: save must not delete an answer it never showed
    await p.evaluate(() => { const e = document.getElementById('fd_official_site'); if (e) e.value = 'https://typed-by-qa.example'; document.getElementById('fd_save').click(); });
    await p.waitForTimeout(2500);
    const mem = await p.evaluate(() => (DB.businesses.find((x) => x.id === 'b-fn-0') || {}).funnelDetails);
    if (mem && mem.legacy_note === 'kept from the 2026 sheet import') ok('saving one field does NOT delete a stored answer whose key is no longer in the template');
    else fail('an answer the form never showed was destroyed by pressing Save: ' + JSON.stringify(mem));
    if (mem && mem.official_site === 'https://typed-by-qa.example') ok('…and the field that was actually edited is the one that changed');
    else fail('the edit did not take: ' + JSON.stringify(mem));

    // it really reached the database, not just the screen (M13 in spirit)
    const row = await fetch(BASE + '/rest/v1/businesses?id=eq.b-fn-0&select=funnel_details').then((r) => r.json()).catch(() => null);
    const fd = row && row[0] && row[0].funnel_details;
    if (fd && fd.official_site === 'https://typed-by-qa.example' && fd.legacy_note) ok('…and the database holds both the edit and the preserved answer — this was not a screen-only effect');
    else fail('the database does not match the screen: ' + JSON.stringify(fd));

    // ---------- 6. clearing a box still clears the answer (the preserve fix must not block that)
    await p.evaluate(() => { LANG = 'en'; applyLang(); window.__editFunnelDetails('b-fn-0'); });
    await p.waitForTimeout(900);
    await p.evaluate(() => { const e = document.getElementById('fd_official_site'); if (e) e.value = ''; document.getElementById('fd_save').click(); });
    await p.waitForTimeout(2200);
    const cleared = await p.evaluate(() => (DB.businesses.find((x) => x.id === 'b-fn-0') || {}).funnelDetails);
    if (cleared && !('official_site' in cleared)) ok('emptying a box still removes that answer — preserving unknown keys did not turn clearing into a no-op');
    else fail('a field emptied on purpose was not cleared: ' + JSON.stringify(cleared));
    if (cleared && cleared.legacy_note) ok('…while the untouched hidden answer is still there');
    else fail('clearing one field took the hidden answer with it');
  });

  // ---------- 7. a read-only share link, and a viewer
  await run(8472, async (p) => {
    await p.evaluate(() => { window.__isShareView = true; current = 'leads'; openLead = 'b-fn-1'; render(); });
    await p.waitForTimeout(2000);
    const share = await cardText(p);
    if (!share.missing && !share.editBtn) ok('a read-only share link still SEES the funnel details, but is offered no Edit button');
    else if (share.missing) fail('the share view lost the card entirely — it should read, just not write');
    else fail('a read-only share link is offered an Edit button');
    const before = await p.evaluate(() => JSON.stringify((DB.businesses.find((x) => x.id === 'b-fn-1') || {}).funnelDetails));
    await p.evaluate(() => { try { window.__editFunnelDetails('b-fn-1'); } catch (_) {} });
    await p.waitForTimeout(900);
    const opened = await p.evaluate(() => !!document.getElementById('fdModal'));
    const after = await p.evaluate(() => JSON.stringify((DB.businesses.find((x) => x.id === 'b-fn-1') || {}).funnelDetails));
    if (!opened) ok('…and calling the editor directly does nothing — the function is guarded, not just the button');
    else fail('the editor opened inside a read-only share view');
    if (before === after) ok('…the record is byte-identical afterwards');
    else fail('a share view changed the record: ' + before + ' -> ' + after);
  });

  await run(8473, async (p) => {
    await p.evaluate(() => { current = 'leads'; openLead = 'b-fn-1'; render(); });
    await p.waitForTimeout(2000);
    const v = await cardText(p);
    if (!v.missing && !v.editBtn) ok('a viewer reads the funnel details and is offered no Edit button');
    else if (v.missing) fail('a viewer cannot see the funnel details at all');
    else fail('a viewer is offered an Edit button');
    await p.evaluate(() => { try { window.__editFunnelDetails('b-fn-1'); } catch (_) {} });
    await p.waitForTimeout(800);
    if (!await p.evaluate(() => !!document.getElementById('fdModal'))) ok('…and the editor refuses to open for them too');
    else fail('a viewer opened the funnel details editor');
  }, 'viewer');

  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nfunnel-details OK — the card speaks Arabic on an Arabic page, Save keeps answers it never showed, and read-only means read-only');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
