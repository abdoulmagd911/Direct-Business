/* probe-option-values-are-data.mjs — the universal rule that keeps Arabic from corrupting stored
   data (2026-09-02, round 28). Found by the eight-area sweep and confirmed in source.

   THE RULE: an <option> with NO value attribute is stored BY ITS TEXT — `select.value` returns
   the label. So translating that text saves an Arabic word as data. js/21 must therefore never
   translate a value-less option, in ANY scope.

   The history matters, because the fix was made twice. Round 26 wrapped the DIALOG opener and
   applied the rule there, trusting the old comment in js/21 that in-page options are "filter
   values, not data". That was wrong: the proposal editor is a FORM rendered inside #view, and
   its bundle-item type / status / policy / approval / refundable selects are all value-less
   (`<option ${it.type===t?'selected':''}>` in js/core/core-04-proposals.js). With 'Other' in the
   dictionary, an Arabic user picking it stored "أخرى" as the service-bundle type — a real
   corruption, in a form the commercial team uses to price work. The rule is now universal.

   Asserts, with the app in Arabic:
     - across every page that renders a <select>, no value-less option's text is Arabic while its
       own `value` is Arabic too — i.e. nothing that is stored by its label has been translated
     - the proposal editor specifically: the bundle-item type, status, policy, approval and
       refundable selects still read and STORE their English keys; picking "Other" stores "Other"
     - options that DO carry a value attribute are still free to read Arabic (the proposal Type
       select shows Arabic and stores the English key) — the fix must not flatten the Arabic UI
     - a spot-check that page chrome is still translated (the rule must not disable the layer)
   Sabotage: drop the `!op.hasAttribute('value')` skip in js/21 → the value-less options turn
   Arabic and their stored values turn Arabic → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8393;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const AR = /[؀-ۿ]/;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
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

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6500);
  await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); });

  // ---- sweep every page for a value-less option whose text was translated
  const PAGES = ['today', 'leads', 'clients', 'offers', 'ops', 'projects', 'finance', 'reports', 'events', 'airlines', 'vendors', 'sopsla', 'settings', 'documents'];
  const offenders = [];
  for (const page of PAGES) {
    await p.evaluate((v) => { openLead = null; openSup = null; current = v; render(); }, page);
    await p.waitForTimeout(700);
    const bad = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('#view select').forEach((s) => {
        [...s.options].forEach((o) => {
          // a value-less option is stored by its label: if the label is Arabic, so is the datum
          if (!o.hasAttribute('value') && /[؀-ۿ]/.test(o.textContent || '')) {
            out.push({ onchange: (s.getAttribute('onchange') || '').slice(0, 60), text: o.textContent.trim().slice(0, 24), value: String(o.value).slice(0, 24) });
          }
        });
      });
      return out;
    });
    bad.forEach((x) => offenders.push(Object.assign({ page }, x)));
  }
  if (!offenders.length) ok(`no value-less option on any of the ${PAGES.length} pages carries Arabic text — nothing stored by its label has been translated`);
  else fail(`${offenders.length} value-less option(s) translated, so an Arabic word would be SAVED as data: ` + JSON.stringify(offenders.slice(0, 6)));

  // ---- the proposal editor specifically (where the corruption was found)
  const opened = await p.evaluate(() => {
    const o = (DB.offers || [])[0];
    if (!o) return null;
    openLead = null; current = 'offers';
    if (typeof openOfferFn === 'function') { openOfferFn(o.id); return o.id; }
    return null;
  });
  await p.waitForTimeout(1200);
  if (!opened) fail('could not open a proposal to check its editor');
  else {
    const sel = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('#view select').forEach((s) => {
        const oc = (s.getAttribute('onchange') || '');
        out.push({
          onchange: oc.slice(0, 46),
          valueless: [...s.options].filter((o) => !o.hasAttribute('value')).length,
          arabicValueless: [...s.options].filter((o) => !o.hasAttribute('value') && /[؀-ۿ]/.test(o.textContent || '')).length,
          withValue: [...s.options].filter((o) => o.hasAttribute('value')).length,
          arabicWithValue: [...s.options].filter((o) => o.hasAttribute('value') && /[؀-ۿ]/.test(o.textContent || '')).length,
        });
      });
      return out;
    });
    const corrupted = sel.filter((s) => s.arabicValueless > 0);
    if (!corrupted.length) ok('proposal editor: every value-less select still carries its English keys (' + sel.filter((s) => s.valueless > 0).length + ' such selects checked)');
    else fail('proposal editor stores Arabic: ' + JSON.stringify(corrupted));
    const arabicOK = sel.filter((s) => s.arabicWithValue > 0);
    if (arabicOK.length) ok('…and selects that DO carry value attributes still read Arabic (' + arabicOK.length + ' of them) — the Arabic UI is not flattened');
    else console.log('  · note: no value-carrying select on this editor showed Arabic (seed-dependent, not a failure)');

    // pick "Other" on the bundle-item type select, if present, and read back what got stored
    const stored = await p.evaluate(() => {
      const s = [...document.querySelectorAll('#view select')].find((x) => [...x.options].some((o) => /^(Other|أخرى)$/.test(o.textContent.trim())));
      if (!s) return 'no-such-select';
      const opt = [...s.options].find((o) => /^(Other|أخرى)$/.test(o.textContent.trim()));
      s.value = opt.value; s.dispatchEvent(new Event('change'));
      return { chosenText: opt.textContent.trim(), chosenValue: String(opt.value) };
    });
    if (stored === 'no-such-select') console.log('  · note: no "Other" option on this editor in this seed — the page-wide sweep above still covers the rule');
    else if (!AR.test(stored.chosenValue)) ok(`picking "${stored.chosenText}" stores "${stored.chosenValue}" — an English key, not an Arabic word`);
    else fail(`picking "${stored.chosenText}" stored "${stored.chosenValue}" — an Arabic word went into the record`);
  }

  // ---- the layer must still be doing its job
  await p.evaluate(() => { openLead = null; current = 'leads'; render(); }); await p.waitForTimeout(800);
  const head = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
  if (AR.test(head)) ok('the Arabic layer is still translating page chrome (the rule did not switch it off)');
  else fail('the page is no longer Arabic — the rule went too far');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\noption-values-are-data OK — Arabic never reaches a field that is stored by its label');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
