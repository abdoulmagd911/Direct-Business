/* probe-modals-ar.mjs — the dialog forms in Arabic, and the data-safety rule behind them
   (2026-09-02, attack round 26). Every modal form (Log activity, New request, New business,
   airline edit, New SOP) was English in Arabic: the Arabic layer only ever scanned the page body
   and the top bar, never the dialog overlay. Now the dialog opener is wrapped. The landmine
   inside the fix: many dropdowns in those forms carry no value attribute, so the option TEXT is
   the stored value — translating it would save an Arabic word as data. The layer therefore
   translates an option inside a dialog only when it has an explicit value attribute.
   Asserts (AR):
     - the five dialogs' titles / labels are Arabic; no known English label survives
     - the Log activity type dropdown and the airline ADM-risk dropdown keep their English
       option words (no value attributes) and saving a Log activity stores type "Call"
     - the Funnel dropdown (options WITH value attributes) is allowed to read Arabic
   Asserts (EN): the same dialogs read English (nothing over-translated); phone: the Log activity
   dialog fits. Sabotage: drop the openModal wrap → labels stay English → red. Drop the
   safe-options rule → the stage words in "Move stage to" / request Stage turn Arabic → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8389;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.accept());
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
  await p.waitForTimeout(7000);
  const setLang = (l) => p.evaluate((l) => { LANG = l; if (typeof applyLang === 'function') applyLang(); }, l);
  const openLeadCard = async () => { await p.evaluate(() => { const c = (DB.businesses || []).find((x) => !x.isClient); openLead = c.id; current = 'leads'; render(); }); await p.waitForTimeout(900); };
  const clickCard = async (re) => { const r = await p.evaluate((src) => { const rx = new RegExp(src); const b = [...document.querySelectorAll('#view button')].find((x) => rx.test(x.textContent) && x.offsetParent !== null); if (!b) return null; b.click(); return b.textContent.trim(); }, re.source); await p.waitForTimeout(500); return r; };
  const modalText = () => p.evaluate(() => { const m = document.getElementById('modal') || document.getElementById('ov'); return m ? m.textContent : ''; });
  const labels = () => p.evaluate(() => [...document.querySelectorAll('#modal label, #ov label')].map((l) => l.textContent.trim()));
  const close = async () => { await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); }); await p.waitForTimeout(300); };
  const optionTexts = (selId) => p.evaluate((id) => { const s = document.getElementById(id); return s ? [...s.options].map((o) => o.textContent.trim()) : null; }, selId);

  // ---- Arabic
  await setLang('ar'); await openLeadCard();
  // Log activity
  await clickCard(/تسجيل نشاط/);
  let ls = await labels();
  let must = ['النوع', 'نقل المرحلة إلى', 'ماذا حدث؟ — الصق المحادثة أو اكتب ملخصًا', 'الإجراء التالي (اختياري)'];
  let missing = must.filter((w) => !ls.includes(w));
  if (!missing.length) ok('AR Log activity: labels are Arabic'); else fail('AR Log activity labels ' + JSON.stringify(ls) + ' missing ' + JSON.stringify(missing));
  const typeOpts = await optionTexts('a_type');
  if (typeOpts && typeOpts[0] === 'Call' && typeOpts.includes('Note')) ok('AR Log activity: the type dropdown keeps its English option words (they ARE the stored values)'); else fail('AR Log activity type options → ' + JSON.stringify(typeOpts));
  // the "Move stage to" options are the stage words themselves (Prospect … Won) — every one of them
  // is in the stage dictionary, and the select carries no value attributes: an Arabic word here
  // would be SAVED as the lead's stage
  const stOpts = await optionTexts('a_status');
  if (stOpts && stOpts.includes('Prospect') && stOpts.includes('Won') && !stOpts.some((o) => /[؀-ۿ]/.test(o) && !/^— /.test(o))) ok('AR Log activity: the "Move stage to" options keep the English stage words (they are the stored values)'); else fail('AR Log activity stage options → ' + JSON.stringify(stOpts) + ' (an Arabic word here would be stored as the stage)');
  await p.evaluate(() => { document.getElementById('a_type').value = 'Call'; const n = document.getElementById('a_note'); if (n) n.value = 'QA probe — Arabic dialog save'; });
  await p.evaluate(() => { const s = document.getElementById('mSave'); if (s) s.click(); }); await p.waitForTimeout(1500);
  const savedType = await p.evaluate(() => { const c = (DB.businesses || []).find((x) => x.id === openLead); const a = ((c && c.activities) || []).find((y) => /QA probe — Arabic dialog save/.test(y.note || '')); return a ? a.type : null; });
  if (savedType === 'Call') ok('AR Log activity: saving stored the English type "Call" (data stays data)'); else fail('AR Log activity: stored type → ' + JSON.stringify(savedType));
  // New request
  await clickCard(/^＋ طلب$|^طلب$|＋ طلب/);
  ls = await labels();
  must = ['العميل / الجهة', 'الخدمة', 'تفاصيل الطلب', 'الأولوية', 'قيمة البيع (ر.س)', 'التكلفة (ر.س)'];
  missing = must.filter((w) => !ls.includes(w));
  if (!missing.length) ok('AR New request: labels are Arabic'); else fail('AR New request labels ' + JSON.stringify(ls.slice(0, 8)) + ' missing ' + JSON.stringify(missing));
  const prio = await p.evaluate(() => { const s = [...document.querySelectorAll('#modal select, #ov select')].find((x) => [...x.options].some((o) => o.textContent.trim() === 'Urgent')); return s ? [...s.options].map((o) => o.textContent.trim()) : null; });
  if (prio && prio.includes('Urgent') && prio.includes('Low')) ok('AR New request: priority options stay English (no value attributes)'); else fail('AR New request priority options → ' + JSON.stringify(prio));
  const rst = await p.evaluate(() => { const s = [...document.querySelectorAll('#modal select, #ov select')].find((x) => [...x.options].some((o) => o.textContent.trim() === 'Quoting')); return s ? [...s.options].map((o) => o.textContent.trim()) : null; });
  if (rst && rst.includes('New') && rst.includes('Quoting') && !rst.some((o) => /[؀-ۿ]/.test(o))) ok('AR New request: the stage options keep their English words ("New" is a dictionary word)'); else fail('AR New request stage options → ' + JSON.stringify(rst) + ' (an Arabic word here would be stored as the request stage)');
  await close();
  // New business (leads list)
  await p.evaluate(() => { openLead = null; current = 'leads'; render(); }); await p.waitForTimeout(700);
  await clickCard(/عمل جديد|جهة جديدة|New lead|New business/);
  ls = await labels();
  must = ['اسم الجهة (الرسمي)', 'الاسم بالعربية', 'الشريحة', 'الفئة', 'المسار — من أين جاء هذا العميل المحتمل'];
  missing = must.filter((w) => !ls.includes(w));
  if (!missing.length) ok('AR New business: labels are Arabic'); else fail('AR New business labels ' + JSON.stringify(ls.slice(0, 8)) + ' missing ' + JSON.stringify(missing));
  await close();
  // Airline edit
  await p.evaluate(() => { openSup = null; current = 'airlines'; render(); }); await p.waitForTimeout(500);
  await p.evaluate(() => editSupplier('air', 'air_qa1')); await p.waitForTimeout(500);
  ls = await labels();
  must = ['الاسم', 'رمز IATA', 'رمز التذاكر (3 أرقام IATA)', 'على IATA السعودية (BSP)؟', 'الدولة', 'مهلة الإبطال'];
  missing = must.filter((w) => !ls.includes(w));
  if (!missing.length) ok('AR airline edit: labels are Arabic'); else fail('AR airline edit labels missing ' + JSON.stringify(missing));
  const adm = await optionTexts('x_admrisk');
  if (adm && adm.includes('Low') && adm.includes('High') && !adm.some((o) => /[؀-ۿ]/.test(o))) ok('AR airline edit: ADM-risk options stay English (no value attributes)'); else fail('AR airline edit ADM-risk options → ' + JSON.stringify(adm));
  // "Yes" / "No" ARE dictionary words (tags elsewhere read نعم / لا) — the KSA-BSP dropdown's
  // value-less options must still read Yes / No, or x.ksa would be saved as an Arabic word
  const ksa = await optionTexts('x_ksa');
  if (ksa && ksa.includes('Yes') && ksa.includes('No') && !ksa.some((o) => /[؀-ۿ]/.test(o))) ok('AR airline edit: the KSA-BSP Yes/No options stay English even though Yes/No are dictionary words'); else fail('AR airline edit KSA options → ' + JSON.stringify(ksa) + ' (an Arabic word here would be stored as the flag)');
  await close();
  // New SOP
  await p.evaluate(() => { current = 'sopsla'; window.sopslaTab = 'sops'; render(); }); await p.waitForTimeout(500);
  await p.evaluate(() => editSop()); await p.waitForTimeout(500);
  ls = await labels(); const mt = await modalText();
  must = ['الرمز', 'العنوان', 'الغرض', 'الأوامر (اختياري)', 'الإجراء'];
  missing = must.filter((w) => !ls.includes(w));
  if (!missing.length && /إجراء جديد/.test(mt)) ok('AR New SOP: title and labels are Arabic'); else fail('AR New SOP: missing ' + JSON.stringify(missing) + ', title Arabic ' + /إجراء جديد/.test(mt));
  await close();

  // ---- English
  await setLang('en'); await openLeadCard();
  await clickCard(/Log activity/);
  ls = await labels();
  if (ls.includes('Move stage to') && ls.includes('Next action (optional)')) ok('EN Log activity: labels unchanged'); else fail('EN Log activity labels → ' + JSON.stringify(ls));
  await close();
  await clickCard(/Request/);
  ls = await labels();
  if (ls.includes('Request detail') && ls.includes('Sell value (SAR)')) ok('EN New request: labels unchanged'); else fail('EN New request labels → ' + JSON.stringify(ls.slice(0, 8)));
  await close();

  // ---- phone
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); await setLang('ar'); await openLeadCard();
  await clickCard(/تسجيل نشاط/);
  const fits = await p.evaluate(() => { const m = document.getElementById('modal'); if (!m) return null; const r = m.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1 && document.documentElement.scrollWidth <= window.innerWidth + 6; });
  if (fits) ok('phone AR: the Log activity dialog fits the viewport'); else fail('phone AR: dialog fit ' + fits);
  await close();

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nmodals-ar OK — dialogs read Arabic in Arabic, and the words that are data stay English');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
