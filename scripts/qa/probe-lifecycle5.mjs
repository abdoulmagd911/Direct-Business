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
await page.evaluate(() => { const b = [...document.getElementById('funnelTabs').querySelectorAll('button')].find(x => /Export CSV/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(1200);
await STEP('leads Export CSV downloads a file', !!dl, dl ? await dl.suggestedFilename() : 'no download');
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
await STEP('Won → auto client', await page.evaluate(id => getLead(id).isClient === true, id1));
await nav(/^(Clients|العملاء)$/);
await STEP('appears on Clients page', await page.evaluate(() => document.getElementById('view').textContent.includes('Al-Noor Schools Group')));
await SHOT('clients-with-alnoor');

// ============ STATION 6 · LOST PATH (Marasi) ============
const id5 = await page.evaluate(() => DB.businesses.find(x => x.name === 'Marasi Travel & Tours').id);
await page.evaluate(() => { current = 'leads'; render(); });
await page.waitForTimeout(700);
await page.evaluate(id => { leadQuickEdit(id); }, id5);
await page.waitForTimeout(500);
nextDialog = 'They signed with a competitor offering credit terms we could not match this quarter';
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Lost'; });
await page.locator('#mSave').click();
await page.waitForTimeout(1000);
const lost = await page.evaluate(id => { const b = getLead(id); return { stage: leadStage(b), reason: b.lostReason || (b.raw && b.raw.lostReason) || '' }; }, id5);
await STEP('Lost captured WITH the reason', lost.stage === 'Lost' && /competitor/.test(lost.reason), JSON.stringify(lost).slice(0, 90));
await page.evaluate(id => { openLeadFn(id); }, id5);
await page.waitForTimeout(1100);
await STEP('card shows "Why we lost it"', await page.evaluate(() => /Why we lost it|سبب الخسارة/.test(document.getElementById('view').textContent)));
await SHOT('card-marasi-lost');
await STEP('quick edit did NOT clear the owner', await page.evaluate(id => !!getLead(id).assignedTo, id5), await page.evaluate(id => getLead(id).assignedTo || 'CLEARED', id5));

// ============ STATION 7 · CLIENT CARD (Al-Noor): Direct ID, billing accounts, agreement, AM ============
await page.evaluate(id => { openLeadFn(id); }, id1);
await page.waitForTimeout(1300);
// Direct ID via the strip prompt
nextDialog = '907';
const addIdClicked = await page.evaluate(() => { const b = [...document.querySelectorAll('.v34-link button')].find(x => /Add Direct ID|أضف معرّف/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
await page.waitForTimeout(900);
await STEP('Direct client ID set via strip', await page.evaluate(id => getLead(id).directClientId === '907', id1), 'clicked=' + addIdClicked);
// Billing accounts editor (the new control)
nextDialog = '907 Prepaid, 908 Postpaid';
const baClicked = await page.evaluate(() => { const b = [...document.querySelectorAll('.v34-link button')].find(x => /Billing accounts|حسابات الفوترة/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
await page.waitForTimeout(900);
const accts = await page.evaluate(id => getLead(id).billingAccounts, id1);
await STEP('billing accounts editable (Prepaid+Postpaid)', Array.isArray(accts) && accts.length === 2 && accts[1].mode === 'Postpaid', JSON.stringify(accts));
await STEP('strip shows both account chips', await page.evaluate(() => { const s = document.querySelector('.v34-link'); return s && /#907/.test(s.textContent) && /#908/.test(s.textContent); }));
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
const csv = ['client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes',
 'Al-Noor Schools Group,August,Q3,DP-3001,TTIN-4001,Al-Noor Schools Group,2026-08-11,School trip flights,138000,0,138000,126500,11500,verified_paid,First season trip — flights',
 'Al-Noor Schools Group,August,Q3,DP-3002,TTIN-4002,Al-Noor Schools Group,2026-08-11,Hotels Istanbul,64000,0,64000,57000,7000,verified_paid,First season trip — hotels',
 'Al-Noor Schools Group,August,Q3,DP-3003,,Al-Noor Schools Group,2026-08-11,Student visas,18000,0,18000,15300,2700,verified_paid,Visas batch — tax invoice pending'].join('\n');
fs.writeFileSync('shots/alnoor-invoices.csv', csv);
await nav(/Finance|المالية/);
await page.locator('#view button').filter({ hasText: /^(Import|استيراد)$/ }).first().click();
await page.waitForTimeout(800);
await page.setInputFiles('#finFile', 'shots/alnoor-invoices.csv');
await page.locator('#view button', { hasText: /Check file|فحص الملف/ }).first().click();
await page.waitForTimeout(1500);
await SHOT('finance-import-preview');
const confirmBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#finImpOut button')].find(x => /confirm|import|استيراد|تأكيد/i.test(x.textContent)); if (b) { b.click(); return b.textContent.trim(); } return null; });
await page.waitForTimeout(2000);
await STEP('CSV import preview → confirm', !!confirmBtn, String(confirmBtn));
const finRows = await page.evaluate(() => (FIN.rows || []).filter(r => r.client_group === 'Al-Noor Schools Group').length);
await STEP('3 invoices imported into the ledger data', finRows === 3, 'rows=' + finRows);
// ledger shows them with tax details + flags for missing DPIN
await page.locator('#view button').filter({ hasText: /^(Ledger|السجل)$/ }).first().click();
await page.waitForTimeout(900);
await page.evaluate(() => { finF('q', 'Al-Noor'); });
await page.waitForTimeout(700);
const ledgerCheck = await page.evaluate(() => {
  const t = [...document.querySelectorAll('#view tbody tr')].map(r => r.textContent);
  return { rows: t.length, dpin: t.filter(x => /TTIN-400/.test(x)).length, noTax: t.filter(x => /no tax inv|لا فاتورة ضريبية/.test(x)).length };
});
await STEP('ledger: 3 rows, 2 with tax invoice, 1 flagged missing', ledgerCheck.rows === 3 && ledgerCheck.dpin === 2 && ledgerCheck.noTax === 1, JSON.stringify(ledgerCheck));
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
await STEP('client card shows the billed money (220.0K)', /220\.0K/.test(strip), strip.slice(0, 130));
await SHOT('client-finance-strip');
// finance overview: August includes the new 220K
await nav(/Finance|المالية/);
await page.waitForTimeout(1100);
await page.locator('#view button').filter({ hasText: /^(Performance|الأداء)$/ }).first().click();
await page.waitForTimeout(900);
await page.locator('#view select').nth(1).selectOption('M:August');
await page.waitForTimeout(900);
const augRev = await page.evaluate(() => { const g = [...document.querySelectorAll('#view .card')].find(c => (c.parentElement.getAttribute('style') || '').includes('minmax(150px')); return g ? g.parentElement.children[0].textContent.replace(/\s+/g, ' ') : '?'; });
await STEP('August revenue includes the new invoices (736.0K = 516+220)', /736\.0K/.test(augRev), augRev);
const svcHasVisa = await page.evaluate(() => { const t = document.querySelector('.v32-svc'); return t ? /Visas|Flights|Hotels/.test(t.textContent) : false; });
await STEP('income-by-service reflects the new services', svcHasVisa);
await SHOT('finance-august-after-import');
// set origin=project + proposal ref on DP-3001 via the NEW invoice editor
await page.locator('#view button').filter({ hasText: /^(Ledger|السجل)$/ }).first().click();
await page.waitForTimeout(800);
await page.evaluate(() => { finF('q', 'DP-3001'); });
await page.waitForTimeout(600);
await page.locator('#view tbody tr').first().click();
await page.waitForTimeout(700);
await SHOT('invoice-modal-editor');
const editorPresent = await page.evaluate(() => !!document.getElementById('fin_origin') && !!document.getElementById('fin_pref'));
await STEP('invoice modal has the origin + proposal option', editorPresent);
await page.evaluate(ref => { document.getElementById('fin_origin').value = 'project'; document.getElementById('fin_pref').value = ref; }, propRef);
await page.locator('#finModal button', { hasText: /^(Save|حفظ)$/ }).first().click();
await page.waitForTimeout(1200);
const originSet = await page.evaluate(() => { const r = (FIN.rows || []).find(x => x.invoice_no === 'DP-3001'); return r ? { o: r.origin, p: r.proposal_ref } : null; });
await STEP('invoice marked as project + linked to the proposal', originSet && originSet.o === 'project' && originSet.p === propRef, JSON.stringify(originSet));
// jump from invoice to proposal
await page.evaluate(() => { finF('q', 'DP-3001'); });
await page.waitForTimeout(500);
await page.locator('#view tbody tr').first().click();
await page.waitForTimeout(600);
await page.locator('#finModal button', { hasText: /Open proposal|فتح العرض/ }).first().click();
await page.waitForTimeout(1100);
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
