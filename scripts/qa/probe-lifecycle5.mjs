/* Five-lead full lifecycle rehearsal — every station screenshotted, nothing assumed. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8913, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
let nextDialog = null;
page.on('dialog', async d => {
  if (nextDialog !== null) { const v = nextDialog; nextDialog = null; if (d.type() === 'prompt') await d.accept(v); else await d.accept(); }
  else await d.accept();
});
const route = async r => {
  const u = r.request().url();
  if (u.includes('cdn.jsdelivr.net')) {
    if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  }
  const url = new URL(u);
  const resp = await fetch(BASE + url.pathname + url.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
};
await page.route('**cdn.jsdelivr.net/**', route);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);

const LOG = [];
let shotN = 0;
const STEP = async (name, ok, detail = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ' — ' + detail : ''}`); };
/* 2026-09-06 (round 52): this rehearsal builds LOG for 60-odd stations and prints it once at the
   very end, so a single hard error — a locator that never appears — threw away everything it had
   already measured and left only a Playwright timeout on screen. That is why it sat on the
   "pre-existing red" list for rounds without anyone being able to say WHICH station broke. Any
   hard stop now prints the whole run first, so the FIRST divergence is visible, not just the last
   symptom. Exit 1, because a rehearsal that could not finish is not a pass. */
const DUMP = (why) => {
  console.log(LOG.join('\n'));
  console.log('\nSTOPPED at station ' + (LOG.length + 1) + ' (after "' + (LOG[LOG.length - 1] || 'nothing') + '")');
  console.log('REASON: ' + String(why && why.message || why).split('\n')[0]);
  console.log('FAILS:', LOG.filter(l => l.startsWith('FAIL')).length, '/', LOG.length, '· did not reach the end');
  console.log('PAGEERRORS:', errs.length, errs.slice(0, 5));
  process.exit(1);
};
process.on('uncaughtException', DUMP);
process.on('unhandledRejection', DUMP);
const SHOT = async (name) => { shotN++; await page.screenshot({ path: `shots/lc${String(shotN).padStart(2, '0')}-${name}.png` }); };
const nav = async (re) => { await page.locator('#nav button').filter({ hasText: re }).first().click(); await page.waitForTimeout(1100); };

// ============ STATION 1 · LOGIN PAGE ============
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await SHOT('login-page');
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('WRONG-password-1');
await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await page.waitForTimeout(1800);
const badLogin = await page.evaluate(() => document.body.textContent.match(/Invalid|incorrect|خطأ|wrong|failed/i) !== null && !!document.querySelector('input[type=email]'));
await STEP('login: wrong password rejected with a message', badLogin);
await SHOT('login-wrong-password');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await page.waitForTimeout(4000);
await STEP('login: correct password signs in', await page.evaluate(() => !document.querySelector('#view input[type=email]')));
await SHOT('after-login');

// ============ STATION 2 · CREATE FIVE LEADS via the real modal ============
const FIVE = [
  { name: 'Al-Noor Schools Group', ar: 'مجموعة مدارس النور', seg: 'Education', funnel: 'website_form_entity', contact: ['Huda Al-Salem', 'h.salem@alnoor.edu.sa', '+966501000001'] },
  { name: 'Sahara Logistics Co', ar: 'شركة صحارى للخدمات اللوجستية', seg: 'Logistics', funnel: 'inbound', contact: ['Fahad Al-Mutlaq', 'fahad@saharalog.sa', '+966501000002'] },
  { name: 'Jeel Medical Conferences', ar: 'جيل للمؤتمرات الطبية', seg: 'MICE / Medical', funnel: 'outreach', contact: ['Dr. Amal Nasser', 'amal@jeelmed.sa', '+966501000003'] },
  { name: 'Waseel Fintech', ar: 'وصيل للتقنية المالية', seg: 'Fintech partner', funnel: 'partners_tenders', contact: ['Talal Harbi', 't.harbi@waseel.sa', '+966501000004'] },
  { name: 'Marasi Travel & Tours', ar: 'مراسي للسفر والسياحة', seg: 'Travel agency', funnel: 'travel_trade', contact: ['Noura Qahtani', 'noura@marasitravel.sa', '+966501000005'] },
];
await nav(/^(Leads|العملاء المحتملون)$/);
for (const L of FIVE) {
  await page.locator('#view button', { hasText: '+ New business' }).first().click();
  await page.waitForTimeout(600);
  await page.fill('#f_name', L.name);
  await page.fill('#f_ar', L.ar);
  await page.fill('#f_seg', L.seg);
  const fOk = await page.evaluate(k => { const el = document.getElementById('f_funnel'); if (!el) return false; el.value = k; return el.value === k; }, L.funnel);
  await STEP(`create ${L.name}: funnel selectable in the form`, fOk, L.funnel);
  await page.evaluate(c => { addContactRow(); window._contacts[window._contacts.length - 1] = { name: c[0], email: c[1], phone: c[2] }; drawContacts(); }, L.contact);
  await page.waitForTimeout(200);
  await page.locator('#mSave').click();
  await page.waitForTimeout(900);
}
const created = await page.evaluate(names => names.map(n => { const b = DB.businesses.find(x => x.name === n); return b ? { owner: b.assignedTo, funnel: b.funnelKey, contacts: (b.contacts || []).length } : null; }), FIVE.map(l => l.name));
await STEP('all five created', created.every(Boolean), JSON.stringify(created));
await STEP('every new lead has an owner stamped', created.every(c => c && c.owner), created.map(c => c && c.owner).join(','));
await STEP('every new lead kept its funnel', created.every((c, i) => c && c.funnel === FIVE[i].funnel));
await STEP('every new lead kept its contact', created.every(c => c && c.contacts === 1));
await SHOT('five-created');

// ============ STATION 3 · LEADS PAGE: tabs, attention, exports, sort, search ============
const tabClicks = await page.evaluate(() => {
  const strip = document.getElementById('funnelTabs'); if (!strip) return null;
  return [...strip.querySelectorAll('button')].map(b => b.textContent.trim());
});
await STEP('funnel tab strip present with counts', !!tabClicks, (tabClicks || []).slice(0, 5).join(' | '));
// click the travel-trade tab and verify the new agency shows
await page.evaluate(() => { const b = [...document.getElementById('funnelTabs').querySelectorAll('button')].find(x => /Travel Trade/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(700);
await STEP('Travel Trade tab shows Marasi', await page.evaluate(() => document.getElementById('view').textContent.includes('Marasi Travel')));
await SHOT('funnel-tab-traveltrade');
await page.evaluate(() => { window.__funnelTab = 'all'; renderLeads(document.getElementById('view')); });
await page.waitForTimeout(500);
// needs-attention toggle
await page.evaluate(() => { const b = [...document.getElementById('funnelTabs').querySelectorAll('button')].find(x => /Needs attention/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(600);
await STEP('needs-attention toggle filters', await page.evaluate(() => window.__needsAttn === true));
await page.evaluate(() => { window.__needsAttn = false; renderLeads(document.getElementById('view')); });
await page.waitForTimeout(400);
// leads Export CSV (strip button) — real download
let dl = null; page.once('download', d => dl = d);
/* 2026-09-06 (round 52): this looked for a button reading "Export CSV". It was renamed on
   2026-08-20 — deliberately, so it would stop looking like a duplicate of the top bar's own
   Export menu — to "↓ Export this view (CSV)". The probe went on searching for the old words
   and reported "no download" as if the button were broken. Matched on what it says now, in
   both languages. */
await page.evaluate(() => { const b = [...document.getElementById('funnelTabs').querySelectorAll('button')].find(x => /Export this view|تصدير هذا العرض/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(1200);
await STEP('leads "Export this view" downloads a file', !!dl, dl ? await dl.suggestedFilename() : 'no download');
// global Export ▾ menu
dl = null; page.once('download', d => dl = d);
const expOpen = await page.evaluate(() => { const m = document.getElementById('expmenu'); if (!m) return false; m.classList.add('show'); return true; });
if (expOpen) { await page.locator('#expmenu button', { hasText: 'CSV - summary' }).first().click().catch(() => {}); await page.waitForTimeout(1200); }
await STEP('global Export ▾ CSV summary downloads', !!dl, dl ? await dl.suggestedFilename() : 'no download');
await SHOT('leads-after-exports');

// ============ STATION 4 · LEAD CARD DEEP DIVE (Al-Noor) ============
const id1 = await page.evaluate(() => DB.businesses.find(x => x.name === 'Al-Noor Schools Group').id);
await page.evaluate(id => { openLeadFn(id); }, id1);
await page.waitForTimeout(1400);
await SHOT('card-alnoor-initial');
// 4a. log a Teams meeting (pasted notes)
await page.evaluate(id => { logActivity(id); }, id1);
await page.waitForTimeout(500);
await page.evaluate(() => { document.getElementById('a_type').value = 'Teams / Zoom / Meet'; });
await page.fill('#a_note', 'Teams meeting 11 Aug — attendees: Huda Al-Salem, Saif.\nThey run 6 school trips a year, ~40 students each.\nWant flights + hotels + visas bundled. Budget ~450K/season.\nNext: send tailored proposal by Thursday.');
await page.fill('#a_next', 'Send proposal by Thursday');
await page.locator('#mSave').click();
await page.waitForTimeout(800);
await STEP('meeting notes pasted & logged (Teams type)', await page.evaluate(id => { const b = getLead(id); return (b.activities || []).some(a => a.type === 'Teams / Zoom / Meet' && /40 students/.test(a.note)); }, id1));
// 4b. log an email paste
await page.evaluate(id => { logActivity(id); }, id1);
await page.waitForTimeout(400);
await page.evaluate(() => { document.getElementById('a_type').value = 'Email'; });
await page.fill('#a_note', 'From: h.salem@alnoor.edu.sa — "Thank you for the meeting. Please include Istanbul and London options in the proposal."');
await page.locator('#mSave').click();
await page.waitForTimeout(700);
await STEP('email pasted & logged', await page.evaluate(id => (getLead(id).activities || []).some(a => a.type === 'Email' && /Istanbul/.test(a.note)), id1));
// 4c. comment (find the Comments card input on the card)
const commentDone = await page.evaluate(() => {
  const card = [...document.querySelectorAll('#view .card')].find(c => { const h = c.querySelector('h3'); return h && /Comments|تعليقات/i.test(h.textContent); });
  if (!card) return 'no comments card';
  const inp = card.querySelector('textarea, input[type=text], input:not([type])');
  if (!inp) return 'no input in comments card';
  inp.value = 'Strategic note: education vertical fits our study-abroad strength — treat as priority.';
  inp.dispatchEvent(new Event('input'));
  const btn = [...card.querySelectorAll('button')].find(b => /add|post|send|أضف|إرسال|\+/i.test(b.textContent));
  if (!btn) return 'no add button';
  btn.click(); return 'clicked';
});
await page.waitForTimeout(800);
const commentSaved = await page.evaluate(() => document.getElementById('view').textContent.includes('education vertical fits'));
await STEP('comment added on the card', commentSaved, String(commentDone));
await SHOT('card-alnoor-logged');
// 4d. add a second contact then remove it (via edit modal)
await page.evaluate(id => { editBusiness(id); }, id1);
await page.waitForTimeout(600);
await page.evaluate(() => { addContactRow(); window._contacts[window._contacts.length - 1] = { name: 'Majed Finance Dept', email: 'finance@alnoor.edu.sa', phone: '+966501000099' }; drawContacts(); });
await page.locator('#mSave').click();
await page.waitForTimeout(800);
await STEP('second contact added', await page.evaluate(id => (getLead(id).contacts || []).length === 2, id1));
await page.evaluate(id => { editBusiness(id); }, id1);
await page.waitForTimeout(600);
const removeUI = await page.evaluate(() => {
  const rows = document.querySelectorAll('#contacts input');
  const btns = [...document.querySelectorAll('#contacts button, #contacts span')].filter(b => /✕|×|remove|حذف/i.test(b.textContent));
  if (btns.length) { btns[btns.length - 1].click(); return 'ui-remove'; }
  window._contacts.pop(); drawContacts(); return 'no-remove-control';
});
await page.locator('#mSave').click();
await page.waitForTimeout(800);
await STEP('contact removable', await page.evaluate(id => (getLead(id).contacts || []).length === 1, id1), removeUI);
// 4e. quick edit: change owner + stage Contacted + funnel visible
await page.evaluate(id => { leadQuickEdit(id); }, id1);
await page.waitForTimeout(500);
const qeFunnel = await page.evaluate(() => { const el = document.getElementById('qe_funnel'); return el ? el.value : 'MISSING'; });
await STEP('quick edit shows the funnel (correct key)', qeFunnel === 'website_form_entity', qeFunnel);
await page.evaluate(() => {
  document.getElementById('qe_stage').value = 'Contacted';
  const ow = document.getElementById('qe_owner'); if (ow && ow.options.length > 1) ow.value = [...ow.options].map(o => o.value).find(v => v && v !== '__add__') || ow.value;
  document.getElementById('qe_note').value = 'First call done — moving to Contacted.';
});
await page.locator('#mSave').click();
await page.waitForTimeout(900);
await STEP('stage → Contacted via quick edit', await page.evaluate(id => leadStage(getLead(id)) === 'Contacted', id1));
// 4f. funnel details card editable?
const fdRes = await page.evaluate(id => {
  if (typeof window.__editFunnelDetails !== 'function') return 'no fn';
  window.__editFunnelDetails(id); return 'opened';
}, id1);
await page.waitForTimeout(800);
const fdSaved = await page.evaluate(() => {
  const btn = document.getElementById('fd_save'); if (!btn) return 'no dialog';
  const box = btn.closest('div[style], .card, body');
  const inputs = [...document.querySelectorAll('textarea, input')].filter(el => el.offsetParent && !['lq','gsearch','clq'].includes(el.id));
  const near = inputs.find(el => el.getBoundingClientRect().top > 80);
  if (near) { near.value = 'Form received via the school website'; near.dispatchEvent(new Event('input')); }
  btn.click(); return 'saved';
});
await page.waitForTimeout(800);
await STEP('funnel-details editable via its Edit dialog', fdRes === 'opened' && fdSaved === 'saved', fdRes + '/' + fdSaved);
await SHOT('card-alnoor-after-edits');

// ============ STATION 5 · PROPOSAL + WON ============
await page.evaluate(() => { current = 'offers'; render(); });
await page.waitForTimeout(900);
await page.locator('#view button', { hasText: /New proposal|عرض جديد/ }).first().click();
await page.waitForTimeout(900);
const propId = await page.evaluate(() => openOffer);
await page.evaluate(id1 => {
  const o = curOffer();
  o.proposalType = 'Business solution'; o.client = 'Al-Noor Schools Group'; o.linkedLeadId = id1;
  o.subject = 'School trips 2026–27 season'; o.value = '450000';
  o.scope = 'Six school trips — flights, hotels, visas bundled\nIstanbul and London options\nDedicated education advisor';
  o.docUrl = 'https://drive.google.com/file/d/PROPOSAL-ALNOOR/view';
  save();
}, id1);
const propRef = await page.evaluate(() => curOffer().ref);
await STEP('proposal created & linked to the lead', !!propRef, 'ref ' + propRef);
await SHOT('proposal-alnoor');
// Won via quick edit
await page.evaluate(() => { current = 'leads'; render(); });
await page.waitForTimeout(700);
await page.evaluate(id => { leadQuickEdit(id); }, id1);
await page.waitForTimeout(500);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Won'; });
await page.locator('#mSave').click();
await page.waitForTimeout(900);
// NEW (2026-08-12): winning now opens the "complete the client" handover — fill the Direct ID there
const handoverShown = await page.evaluate(() => !!document.getElementById('c_did'));
await STEP('Won opens the complete-the-client handover', handoverShown);
await SHOT('won-handover-alnoor');
if (handoverShown) { await page.fill('#c_did', '905'); await page.locator('#mSave').click(); await page.waitForTimeout(800); }
await STEP('Won → auto client', await page.evaluate(id => getLead(id).isClient === true, id1));
await STEP('handover stored the Direct ID', await page.evaluate(id => getLead(id).directClientId === '905', id1));
await nav(/^(Clients|العملاء)$/);
await STEP('appears on Clients page', await page.evaluate(() => document.getElementById('view').textContent.includes('Al-Noor Schools Group')));
await SHOT('clients-with-alnoor');

// ============ STATION 6 · LOST PATH (Marasi) ============
const id5 = await page.evaluate(() => DB.businesses.find(x => x.name === 'Marasi Travel & Tours').id);
await page.evaluate(() => { current = 'leads'; render(); });
await page.waitForTimeout(700);
await page.evaluate(id => { leadQuickEdit(id); }, id5);
await page.waitForTimeout(500);
// 2026-09-10 (D1 family): the Lost reason is asked in the page (js/57 pfPrompt) — answer it there, never a native prompt
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Lost'; });
await page.locator('#mSave').click();
await page.waitForTimeout(500);
const lostBox = await page.evaluate(() => ({ box: !!document.getElementById('pfPromptBox'), q: (document.querySelector('#pfPromptBox [data-pf-prompt-text]') || { textContent: '' }).textContent }));
await STEP('Lost asks for the reason in the page', lostBox.box && /Why did we lose|لماذا خسرنا/.test(lostBox.q), JSON.stringify(lostBox).slice(0, 120));
await page.fill('#pfPromptInput', 'They signed with a competitor offering credit terms we could not match this quarter');
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
const lost = await page.evaluate(id => { const b = getLead(id); return { stage: leadStage(b), reason: b.lostReason || (b.raw && b.raw.lostReason) || '' }; }, id5);
await STEP('Lost captured WITH the reason', lost.stage === 'Lost' && /competitor/.test(lost.reason), JSON.stringify(lost).slice(0, 90));
await page.evaluate(id => { openLeadFn(id); }, id5);
await page.waitForTimeout(1100);
await STEP('card shows "Why we lost it"', await page.evaluate(() => /Why we lost it|سبب الخسارة/.test(document.getElementById('view').textContent)));
await SHOT('card-marasi-lost');
await STEP('quick edit did NOT clear the owner', await page.evaluate(id => !!getLead(id).assignedTo, id5), await page.evaluate(id => getLead(id).assignedTo || 'CLEARED', id5));

/* 2026-09-06 (round 57): the Leads pipeline chips were being injected above the DETAIL card too —
   "All 6 · Prospect 0 · Contacted 2" over ONE company, filtering nothing, highlighting themselves
   when tapped. Already fixed for the client card and guarded by probe-stress; the lead card kept
   it. Checked on a LEAD (Marasi, still open from the station above) and on a CLIENT below. */
const chipsOnLead = await page.evaluate(id => { openLeadFn(id); return null; }, id5);
await page.waitForTimeout(1400);
await STEP('a lead\'s own card shows no pipeline stage chips — there is nothing on it to filter',
  await page.evaluate(() => { const c = document.querySelector('#view .v26_3-chips'); return !c || c.style.display === 'none' || c.offsetParent === null; }));
await STEP('and the Leads LIST still has them', await page.evaluate(() => { openLead = null; current = 'leads'; render(); return true; }) && await (async () => { await page.waitForTimeout(1200); return page.evaluate(() => { const c = document.querySelector('#view .v26_3-chips'); return !!(c && c.offsetParent !== null); }); })());

// ============ STATION 7 · CLIENT CARD (Al-Noor): Direct ID, billing accounts, agreement, AM ============
await page.evaluate(id => { openLeadFn(id); }, id1);
await page.waitForTimeout(1300);
/* Direct ID: the handover captured 905 a moment ago. THE BUG THIS CAUGHT (fixed 2026-09-06,
   round 52, js/27): the banner asked only the client_profiles table, so a client whose ID the
   app had just asked for and saved still read "⚠️ Not linked to Direct yet — add a billing
   profile", inviting the same number to be typed in twice. It now has three states, and this
   is the middle one: linked by ID, no billing profile recorded yet. */
const stripLinked = await page.evaluate(() => (document.querySelector('.v34-link') || {}).textContent || '');
await STEP('strip shows Linked to Direct after the handover', /Linked to Direct|مرتبط بدايركت/.test(stripLinked) && stripLinked.includes('905'), stripLinked.slice(0, 90));
await STEP('strip says what is still missing (the billing profile), not that the client is unlinked',
  /No billing profile recorded yet|لم يُسجَّل ملف فوترة بعد/.test(stripLinked) && !/Not linked to Direct yet|غير مرتبط بدايركت بعد/.test(stripLinked), stripLinked.slice(0, 90));
/* Billing profiles: the old free-text b.billingAccounts blob was REPLACED on 2026-08-21 by the
   client_profiles table (one company, several Direct Payments profiles). This probe went on
   driving prompt() dialogs and reading b.billingAccounts for rounds after that, so three
   stations reported failures against a model the app had deliberately dropped. Driven through
   the real control now: the strip's "+ Add profile" button and its modal. */
const addProfileClicked = await page.evaluate(() => { const b = [...document.querySelectorAll('.v34-link button')].find(x => /Add profile|إضافة ملف/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
await page.waitForTimeout(700);
await STEP('strip offers the billing-profile control', addProfileClicked && await page.evaluate(() => !!document.getElementById('cp_id')));
await page.fill('#cp_id', '907');
await page.selectOption('#cp_type', 'postpaid');
await page.fill('#cp_terms', 'Net 30');
await page.locator('#mSave').click();
await page.waitForTimeout(1600);
const profs = await page.evaluate(id => { const u = (window.__bizUuid ? __bizUuid(id) : id); return (window.CP && CP.byBiz && CP.byBiz[u]) || []; }, id1);
await STEP('billing profile saved against the company', profs.length === 1 && String(profs[0].direct_client_id) === '907' && profs[0].profile_type === 'postpaid', JSON.stringify(profs).slice(0, 120));
await page.evaluate(id => { openLeadFn(id); }, id1);
await page.waitForTimeout(1400);
const stripProf = await page.evaluate(() => (document.querySelector('.v34-link') || {}).textContent || '');
await STEP('strip shows the profile chip with its type and terms', /#907/.test(stripProf) && /Postpaid|آجل/.test(stripProf) && /Net 30/.test(stripProf), stripProf.slice(0, 110));
/* Money never appears on this strip — the owner's 2026-08-21 ruling, and the reason
   v34AddProfile's own modal says the figures live on Finance. Guarded here too. */
await STEP('the Direct-link strip carries no money', !/\d[\d,]*\.\d{2}|\bSAR\b|ريال/.test(stripProf), stripProf.slice(0, 110));
await SHOT('client-strip-billing');
// Agreement pasted from the Direct system (activity Note)
await page.evaluate(id => { logActivity(id); }, id1);
await page.waitForTimeout(400);
await page.evaluate(() => { document.getElementById('a_type').value = 'Note'; });
await page.fill('#a_note', 'AGREEMENT — pasted from Direct Payments client record #907:\nClient: Al-Noor Schools Group · CR 1010333444 · VAT 300123456700003\nMode: Prepaid (#907) + Postpaid (#908) · Terms: Net 30 · Contract: 2026-09-01 → 2027-08-31\nScope: flights, hotels, visas for school trips · Service fee per agreement schedule.');
await page.locator('#mSave').click();
await page.waitForTimeout(700);
await STEP('agreement text stored on the client', await page.evaluate(id => (getLead(id).activities || []).some(a => /CR 1010333444/.test(a.note)), id1));
// Different account manager than lead owner + tier + review
await page.evaluate(id => { leadQuickEdit(id); }, id1);
await page.waitForTimeout(500);
const amSet = await page.evaluate(() => {
  const am = document.getElementById('qe_am'); if (!am) return null;
  const owner = (document.getElementById('qe_owner') || {}).value || '';
  const other = [...am.options].map(o => o.value).find(v => v && v !== owner);
  if (other) am.value = other;
  document.getElementById('qe_tier').value = 'Key';
  document.getElementById('qe_review').value = '2026-11-01';
  return { owner, am: am.value };
});
await page.locator('#mSave').click();
await page.waitForTimeout(900);
const amCheck = await page.evaluate(id => { const b = getLead(id); return { am: b.accountManager, owner: b.assignedTo, tier: b.tier, review: b.nextReview }; }, id1);
await STEP('account manager ≠ lead owner, tier Key, review set', !!amCheck.am && amCheck.am !== amCheck.owner && amCheck.tier === 'Key' && amCheck.review === '2026-11-01', JSON.stringify(amCheck));
await SHOT('client-alnoor-managed');

// ============ STATION 8 · FINANCE: import invoices, tax, periods, origin+proposal ============
/* The August headline used to be checked against a hard-coded "736.0K = 516+220", which only
   held while the fixture's arithmetic held, and said nothing about whether the page agreed with
   the ledger underneath it. Read before and after instead, and require the movement to equal
   what the ledger itself recorded for the imported invoices — an invariant that survives any
   change to the fixture, and that actually catches a headline drifting from its own rows. */
const readAugRevenue = async () => {
  await nav(/Finance|المالية/);
  await page.waitForTimeout(1100);
  await page.locator('#view button').filter({ hasText: /^(Performance|الأداء)$/ }).first().click();
  await page.waitForTimeout(900);
  await page.locator('#view select').nth(1).selectOption('M:August').catch(() => {});
  await page.waitForTimeout(900);
  const txt = await page.evaluate(() => { const g = [...document.querySelectorAll('#view .card')].find(c => (c.parentElement.getAttribute('style') || '').includes('minmax(132px')); return g ? g.parentElement.children[0].textContent.replace(/\s+/g, ' ') : '?'; });
  const m = txt.match(/([\d.,]+)\s*([KM])?/);
  let n = m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
  if (m && m[2] === 'K') n *= 1000; else if (m && m[2] === 'M') n *= 1000000;
  return { txt, n };
};
const augBefore = await readAugRevenue();
/* 8a — the app's OWN ledger export, dropped back in. This station used to BE the import: the
   probe wrote a file in our export's shape and expected it to load, which was true until the
   universal importer (js/65) took the Import tab over. After that it was refused as an
   unrecognised file, with a Teach button inviting a mapping that would read revenue_sar and
   profit_sar back in as if a person had supplied them — they are worked out by the database.
   Round 52 made the refusal say so by name and dropped the Teach button. Guarded here. */
const ourExport = ['client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes',
 'Al-Noor Schools Group,August,Q3,DP-9001,TTIN-9001,Al-Noor Schools Group,2026-08-11,School trip flights,138000,0,138000,126500,11500,verified_paid,round-trip attempt'].join('\n');
fs.writeFileSync('shots/alnoor-our-export.csv', ourExport);
await nav(/Finance|المالية/);
await page.locator('#view button').filter({ hasText: /^(Import|استيراد)$/ }).first().click();
await page.waitForTimeout(800);
await page.setInputFiles('#finFile', 'shots/alnoor-our-export.csv');
await page.locator('#view button', { hasText: /Check file|فحص الملف/ }).first().click();
await page.waitForTimeout(2200);
const ownBack = await page.evaluate(() => { const o = document.getElementById('finImpOut'); return { txt: o ? o.innerText.replace(/\s+/g, ' ') : '', btns: [...document.querySelectorAll('#finImpOut button')].map(b => b.textContent.trim()) }; });
await STEP('our own ledger export is refused BY NAME, not as a generic unknown file',
  /this app exported|صدّره هذا التطبيق/.test(ownBack.txt), ownBack.txt.slice(0, 120));
await STEP('and it is not offered a column mapping (teaching this shape is the mistake)',
  !ownBack.btns.some(b => /Teach|عيّن/.test(b)), JSON.stringify(ownBack.btns));
await STEP('nothing from our own export reached the ledger',
  await page.evaluate(() => !(FIN.rows || []).some(r => r.invoice_no === 'DP-9001')));
await SHOT('finance-import-own-export-refused');

/* 8b — a real Direct Payments Invoice Export, the shape the importer is actually for.
   Three invoices for the client just handed over; none of them carries a ZATCA tax-invoice
   number, because that arrives in a separate capture file — the app must say so on every row
   rather than leave the column silently blank. */
const csv = ['Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman',
 'invoice,Direct Flights,Al-Noor Schools Group,REF-3001,DP-3001,11/08/2026 10:00:00 AM,Fully Paid,,,,,138000,Riyadh,QA',
 'item,Direct Flights,Al-Noor Schools Group,REF-3001,,,,School trip flights,No,0,138000,,,',
 'invoice,Direct Hotels,Al-Noor Schools Group,REF-3002,DP-3002,11/08/2026 10:00:00 AM,Fully Paid,,,,,64000,Riyadh,QA',
 'item,Direct Hotels,Al-Noor Schools Group,REF-3002,,,,Hotels Istanbul,No,0,64000,,,',
 'invoice,Direct Visas,Al-Noor Schools Group,REF-3003,DP-3003,11/08/2026 10:00:00 AM,Fully Paid,,,,,18000,Riyadh,QA',
 'item,Direct Visas,Al-Noor Schools Group,REF-3003,,,,Student visas,No,0,18000,,,'].join('\n');
fs.writeFileSync('shots/alnoor-invoices.csv', csv);
await page.setInputFiles('#finFile', 'shots/alnoor-invoices.csv');
await page.locator('#view button', { hasText: /Check file|فحص الملف/ }).first().click();
await page.waitForTimeout(2200);
await SHOT('finance-import-preview');
const confirmBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#finImpOut button')].find(x => /confirm|import|استيراد|تأكيد/i.test(x.textContent)); if (b) { b.click(); return b.textContent.trim(); } return null; });
await page.waitForTimeout(2500);
await STEP('Direct Payments export: preview → confirm', !!confirmBtn, String(confirmBtn));
const finRows = await page.evaluate(() => (FIN.rows || []).filter(r => r.client_group === 'Al-Noor Schools Group').length);
await STEP('3 invoices imported into the ledger data', finRows === 3, 'rows=' + finRows);
/* The Ledger tab was rebuilt on 2026-08-21 to list finance_transactions by company; it is no
   longer a table of finance_invoices, so this station's old "find the invoice row and click it"
   could never work again, and its search key (FIN.f.q) has not been read since. What an imported
   invoice must still do is show up in the count the Finance page prints about itself. */
await page.locator('#view button').filter({ hasText: /^(Ledger|السجل)$/ }).first().click();
await page.waitForTimeout(900);
const headCount = await page.evaluate(() => { const s = [...document.querySelectorAll('#view span')].map(x => x.textContent).find(t => /invoices . data through|فاتورة . حتى/.test(t || '')); return s || ''; });
await STEP('the Finance header counts the imported invoices', /\d+\s*(invoices|فاتورة)/.test(headCount), headCount.trim());
await SHOT('ledger-alnoor');
// link the finance group to the client (v53 mapping UI or direct)
const linked = await page.evaluate(async (id1) => {
  const uuid = (window.__bizUuid ? __bizUuid(id1) : null);
  const c = window.supabase.createClient();
  const r = await c.from('finance_client_links').upsert({ id: 'lnk-alnoor', client_group: 'Al-Noor Schools Group', business_id: uuid, is_client: true, note: 'rehearsal link' }, { onConflict: 'id' });
  await new Promise(res => { FIN.rows = null; finLoad(() => res()); });
  return { err: r.error && r.error.message, groups: FIN.groupsByBiz && uuid ? (FIN.groupsByBiz[uuid] || []) : [] };
}, id1);
await STEP('finance group linked to the client card', (linked.groups || []).includes('Al-Noor Schools Group'), JSON.stringify(linked).slice(0, 100));
// client card finance strip reflects
await page.evaluate(id => { current = 'leads'; openLeadFn(id); }, id1);
await page.waitForTimeout(1600);
const strip = await page.evaluate(() => { const c = document.querySelector('.v29-fin'); return c ? c.textContent.replace(/\s+/g, ' ') : 'MISSING'; });
/* This step used to demand the card print "220.0K". The owner ruled on 2026-08-21 that money
   lives on the Finance page ONLY and that Leads and Clients report the RELATIONSHIP — so the
   probe was asserting the opposite of the rule, and of probe-money-placement sitting in the
   same battery. Inverted: the card must show that finance exists and offer the way through to
   it, and must not carry an amount. */
await STEP('client card shows the finance relationship (invoice count + a way through)',
  strip !== 'MISSING' && /3\b/.test(strip) && /Open in Finance ledger|افتح في سجل المالية/.test(strip), strip.slice(0, 130));
await STEP('client card carries NO amount — money lives on Finance only',
  strip !== 'MISSING' && !/\bSAR\b|ريال|\d{1,3}(,\d{3})+|\d+(\.\d)?K\b/.test(strip), strip.slice(0, 130));
await SHOT('client-finance-strip');
// finance overview: the August headline must move by exactly what the ledger recorded
const impRev = await page.evaluate(() => (FIN.rows || []).filter(r => r.client_group === 'Al-Noor Schools Group').reduce((s, r) => s + (Number(r.revenue_sar) || 0), 0));
const augAfter = await readAugRevenue();
const moved = augAfter.n - augBefore.n;
await STEP('August revenue moved by exactly what the ledger recorded for the import',
  Number.isFinite(moved) && Math.abs(moved - impRev) <= 100,
  `before ${augBefore.txt} · after ${augAfter.txt} · moved ${moved} · ledger says ${impRev}`);
const svcHasVisa = await page.evaluate(() => { const t = document.querySelector('.v32-svc'); return t ? /Visas|Flights|Hotels/.test(t.textContent) : false; });
await STEP('income-by-service reflects the new services', svcHasVisa);
await SHOT('finance-august-after-import');
/* Both drill-downs into this Ledger were writing filter keys nothing reads any more — fixed
   2026-09-06 (round 52). The client card's "Open in Finance ledger" now goes through
   finClient(), which resolves the company; the income-by-service tap now says plainly that this
   Ledger has no service filter instead of opening everything and letting it read as an answer. */
await page.evaluate(id => { current = 'leads'; openLeadFn(id); }, id1);
await page.waitForTimeout(1500);
await page.evaluate(() => { const b = [...document.querySelectorAll('.v29-fin button')].find(x => /Open in Finance ledger|افتح في سجل المالية/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(1500);
const drillClient = await page.evaluate(id => { const u = (window.__bizUuid ? __bizUuid(id) : id); return { onFinance: current === 'finance', tab: FIN.tab, business: TXN.f.business, wanted: u, selectShowsIt: [...document.querySelectorAll('#view select option')].some(o => o.value === u && o.selected) }; }, id1);
await STEP('client card → Finance really filters the Ledger to that company (not all of them)',
  drillClient.onFinance && drillClient.tab === 'ledger' && drillClient.business === drillClient.wanted, JSON.stringify(drillClient));
await STEP('and the company filter says so in its own control, even with nothing to list',
  drillClient.selectShowsIt, JSON.stringify(drillClient));
await SHOT('drill-client-to-ledger');
await page.evaluate(() => { finClientClear(); finTxnF('business', 'all'); });
await page.waitForTimeout(800);
await page.evaluate(() => { if (typeof v32DrillService === 'function') v32DrillService('Flights'); });
await page.waitForTimeout(1400);
const drillSvc = await page.evaluate(() => ({ tab: FIN.tab, txt: (document.getElementById('view') || {}).innerText || '' }));
await STEP('income-by-service tap says the Ledger has no service filter instead of silently showing everything',
  drillSvc.tab === 'ledger' && /no service filter|لا يحتوي على فلتر للخدمة/.test(drillSvc.txt), drillSvc.tab);
await SHOT('drill-service-note');
await page.evaluate(() => { finServiceClear(); });
await page.waitForTimeout(600);

/* The invoice modal (finRow) still holds the origin + proposal editor and it still works — but
   NOTHING in the interface opens it any more since the Ledger rebuild; every remaining caller is
   a probe. Driven directly here and labelled as such, so these stations do not quietly imply a
   route that a person can take. The missing route is recorded in docs/BACKLOG.md. */
await page.evaluate(() => { current = 'finance'; FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(700);
/* Resolve the invoice by the client it belongs to, not by a number this probe assumed the
   importer would choose — the Invoice Export carries both a reference and an invoice number and
   which one becomes invoice_no is the importer's business, not this probe's. */
const targetInv = await page.evaluate(() => { const r = (FIN.rows || []).find(x => x.client_group === 'Al-Noor Schools Group'); return r ? { id: r.id, no: r.invoice_no } : null; });
await STEP('an imported invoice can be identified for editing', !!targetInv, JSON.stringify(targetInv));
await page.evaluate(id => { if (id) window.finRow(id); }, targetInv && targetInv.id);
await page.waitForTimeout(900);
await SHOT('invoice-modal-editor');
const editorPresent = await page.evaluate(() => !!document.getElementById('fin_origin') && !!document.getElementById('fin_pref'));
await STEP('invoice modal (opened in code — no UI route to it) has the origin + proposal option', editorPresent);
await page.evaluate(ref => { document.getElementById('fin_origin').value = 'project'; document.getElementById('fin_pref').value = ref; }, propRef);
await page.locator('#finModal button', { hasText: /^(Save|حفظ)$/ }).first().click();
await page.waitForTimeout(1400);
const originSet = await page.evaluate(no => { const r = (FIN.rows || []).find(x => x.invoice_no === no); return r ? { o: r.origin, p: r.proposal_ref } : null; }, targetInv && targetInv.no);
await STEP('invoice marked as project + linked to the proposal', originSet && originSet.o === 'project' && originSet.p === propRef, JSON.stringify(originSet));
await page.evaluate(no => { const r = (FIN.rows || []).find(x => x.invoice_no === no); if (r) window.finRow(r.id); }, targetInv && targetInv.no);
await page.waitForTimeout(900);
await page.locator('#finModal button', { hasText: /Open proposal|فتح العرض/ }).first().click();
await page.waitForTimeout(1300);
await STEP('invoice → proposal jump lands on the Al-Noor proposal', await page.evaluate(ref => current === 'offers' && (curOffer() || {}).ref === ref, propRef));
await SHOT('proposal-from-invoice');
// proposals library: table lists it with the document link paperclip
await page.evaluate(() => { openOffer = null; render(); });
await page.waitForTimeout(800);
const lib = await page.evaluate(ref => { const row = [...document.querySelectorAll('#view tbody tr')].find(r => r.textContent.includes(ref)); return row ? { paperclip: row.textContent.includes('📎'), text: row.textContent.replace(/\s+/g, ' ').slice(0, 80) } : null; }, propRef);
await STEP('proposals library lists it with its file link', !!lib && lib.paperclip, lib ? lib.text : 'row missing');
await SHOT('proposals-library');

// ============ STATION 9 · SESSION BEHAVIOR: refresh, back/forward, sign out ============
await page.evaluate(id => { current = 'leads'; openLeadFn(id); }, id1);
await page.waitForTimeout(900);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await STEP('refresh keeps the session (no login form)', await page.evaluate(() => !document.querySelector('#view input[type=email]') && !document.body.textContent.includes('Sign in to Direct')));
await nav(/^(Clients|العملاء)$/); await nav(/Finance|المالية/);
await page.goBack(); await page.waitForTimeout(900);
const backPage = await page.evaluate(() => current);
await STEP('browser Back returns to Clients', backPage === 'clients', backPage);
await page.goForward(); await page.waitForTimeout(900);
await STEP('browser Forward returns to Finance', await page.evaluate(() => current === 'finance'));
// sign out
const signedOut = await page.evaluate(() => { const b = document.getElementById('cl_signout') || document.getElementById('pd_out'); if (b) { b.click(); return true; } const alt = [...document.querySelectorAll('button')].find(x => /^(Sign out|تسجيل الخروج)$/.test(x.textContent.trim())); if (alt) { alt.click(); return true; } return false; });
await page.waitForTimeout(6500);
await page.waitForSelector('input[type=email]', { timeout: 15000 }).catch(() => {});
await STEP('Sign out returns to the login page', signedOut && await page.evaluate(() => !!document.querySelector('input[type=email]')));
await SHOT('after-signout');
// log back in
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await page.waitForTimeout(4000);
await STEP('log back in works', await page.evaluate(() => !document.querySelector('#view input[type=email]')));
await SHOT('logged-back-in');

console.log(LOG.join('\n'));
console.log('FAILS:', LOG.filter(l => l.startsWith('FAIL')).length, '/', LOG.length);
console.log('PAGEERRORS:', errs.length, errs.slice(0, 5));
await browser.close(); process.exit(0);
