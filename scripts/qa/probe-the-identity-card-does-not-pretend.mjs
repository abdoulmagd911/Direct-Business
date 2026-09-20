/* probe-the-identity-card-does-not-pretend.mjs — a box you can type into is a promise.

   Fire #168. The company's identity is stored twice: the `company_identity` registry, which every
   document has read since #160-#162, and an older `agency` block inside the app_state record.
   Measured live the same day, seven of the thirteen comparable fields DISAGREE, including the VAT
   registration number and a bank IBAN.

   On `/dashboard` sat a card, "🇸🇦 Agency profile — KSA settings", with six input boxes for the
   trade name, the VAT number, the IBAN, the bank and the IATA Wakeel number, under the sentence
   "Used on every invoice header, ZATCA QR seed, and BSP payout reconciliation." Driven live:

     · it SHOWED the registry values (js/66 hydrates the AGENCY block before it renders);
     · each box WROTE to the older block, which nothing reads any more;
     · and the next page load re-hydrated from the registry, throwing the typed value away.

   Its sentence stopped being true on 2026-08-24. Somebody correcting the VAT number there would
   believe they had corrected it everywhere and have changed nothing.

   What this holds:
     1. the card is still there — this is not a deletion;
     2. it offers nothing to type into;
     3. it no longer claims to drive every invoice header;
     4. it says where the values are kept and that they are not edited here;
     5. the values are still SHOWN, and they are the registry's — the card must stay useful;
     6. the three fields the registry has no key for are NAMED, not drawn as empty boxes;
     7. a share-link holder is not shown any of it (M29);
     8. no JS errors.

   Checks 1 and 5 are the brakes: deleting the card outright would pass 2, 3, 4 and 6 and lose the
   one screen where these values can be seen at a glance.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/89's
   script line from index.html fails checks 2, 3, 4, 5 and 6, and check 2 prints the six boxes.
   Run: node scripts/qa/probe-the-identity-card-does-not-pretend.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9120; const BASE = 'http://localhost:' + PORT;
const TOKEN = 'qa-identity-card-token-0123456789';

const VAT = '300000000000003';
const IBAN = 'SA0000000000000000000001';
const IDENTITY = [
  { key: 'brand_name', category: 'brand', label_en: 'Brand', label_ar: '', value_en: 'QA Brand Name', value_ar: '', sort: 1, show_on_documents: true, sensitive: false },
  { key: 'legal_name', category: 'legal', label_en: 'Legal name', label_ar: '', value_en: 'QA Legal Name Ltd', value_ar: '', sort: 2, show_on_documents: true, sensitive: false },
  { key: 'vat_number', category: 'tax', label_en: 'VAT registration no.', label_ar: '', value_en: VAT, value_ar: '', sort: 3, show_on_documents: true, sensitive: false },
  { key: 'cr_number', category: 'legal', label_en: 'Commercial Registration (CR)', label_ar: '', value_en: '1010000001', value_ar: '', sort: 4, show_on_documents: true, sensitive: false },
  { key: 'iban_alinma', category: 'banking', label_en: 'Alinma Bank IBAN', label_ar: '', value_en: IBAN, value_ar: '', sort: 5, show_on_documents: true, sensitive: true },
  { key: 'iata', category: 'membership', label_en: 'IATA accreditation', label_ar: '', value_en: '12345678', value_ar: '', sort: 6, show_on_documents: true, sensitive: false },
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
  businesses: [row({ id: 'b1', legacy_id: 'B1', name: 'QA Lead One' })],
  contacts: [], activities: [], company_identity: IDENTITY,
  share_links: [{ token: TOKEN, scope: 'all', active: true, created_by: 'u-qa', created_at: new Date().toISOString(), last_used_at: null }],
});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function look(asShareLink) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push((asShareLink ? 'share' : 'signed-in') + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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

  if (asShareLink) {
    await p.goto(BASE + '/s/' + TOKEN + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => document.body.getAttribute('data-share') === '1' && typeof DB !== 'undefined', { timeout: 60000 });
  } else {
    await p.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('#cl_email', { timeout: 60000 });
    await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
    /* the registry arrives on its own timer — wait for it rather than guessing */
    await p.waitForFunction(() => { try { return typeof window.dgIdentityLoaded === 'function' && window.dgIdentityLoaded(); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => {});
  }
  await p.waitForTimeout(3500);
  const out = await p.evaluate(() => {
    try { current = 'dashboard'; openLead = null; render(); } catch (_) { }
    return new Promise((res) => setTimeout(() => {
      const v = document.getElementById('view');
      const cards = [].slice.call(v.querySelectorAll('.card'));
      const card = cards.find((c) => { const h = c.querySelector('h3'); return h && /Agency profile/i.test(h.textContent || ''); });
      res({ present: !!card,
        inputs: card ? card.querySelectorAll('input').length : -1,
        text: card ? (card.innerText || '').replace(/\s+/g, ' ') : '',
        /* textContent, not innerText: the old sentence lived in a .ch-sub that innerText skips,
           which made the claim-check unable to see the very thing it names (caught by the
           sabotage run — it passed against the broken copy) */
        all: card ? (card.textContent || '').replace(/\s+/g, ' ') : '',
        replaced: !!(card && card.querySelector('.v89-identity')) });
    }, 3000));
  });
  await ctx.close();
  return out;
}

const staff = await look(false);
const guest = await look(true);
await b.close(); srv.close?.();

const checks = [
  ['the card is still there — this is not a deletion', staff.present, String(staff.present)],
  ['it offers nothing to type into', staff.inputs === 0, 'input boxes: ' + staff.inputs],
  ['it no longer claims to drive every invoice header',
    !/invoice header/i.test(staff.all) && !/ZATCA QR seed/i.test(staff.all),
    (staff.all.match(/Used on every[^.]{0,70}/) || ['(claim gone — right)'])[0]],
  ['it says where the values are kept and that they are not edited here',
    /Company assets/i.test(staff.text) && /not edited here/i.test(staff.text), String(staff.replaced)],
  ['the values are still shown, and they are the registry\'s',
    staff.text.indexOf(VAT) >= 0 && staff.text.indexOf(IBAN) >= 0 && /QA Brand Name/.test(staff.text),
    JSON.stringify({ vat: staff.text.indexOf(VAT) >= 0, iban: staff.text.indexOf(IBAN) >= 0 })],
  ['the three fields the registry has no key for are named, not drawn as empty boxes',
    /IATA Wakeel/i.test(staff.text) && /Zakat/i.test(staff.text) && /Bank name/i.test(staff.text),
    (staff.text.match(/Not kept anywhere[^.]{0,80}/) || ['(missing)'])[0]],
  ['a share-link holder is not shown any of it', !guest.present && !guest.replaced,
    JSON.stringify({ card: guest.present, block: guest.replaced })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
