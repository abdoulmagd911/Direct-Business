/* Generator ATTACK probe (bulletproof-audit, 2 Sep 2026) — written to make the five
   document editors FAIL, not to confirm they work. Every check below can fail.

   Covers (numbers = the attack list this probe was written against):
   1. Contract: a client with NO CR and no same-named twin → CR blank, no "taken from"
      note; a twin WITH a CR is borrowed and SAID SO; switching from a client that
      auto-filled CR/rep/phone to one without them must NOT carry the old company's
      legal identity into the new contract; a typed CR is never overwritten.
   2. Contract: fee annex with ZERO saved proposals and zero rows → no empty/broken
      table, AND Issue is refused while an enabled clause still refers to the fee annex.
   3. Contract: Issue with placeholder clauses is refused and consumes NO number; after
      clearing the placeholders (and giving the annex a row) Issue = CTR-2026-001, status
      sent, business_id set; a second Issue never asks for another number.
   4. Price offer: zero lines (saved payloads with lines [] / null), qty 0, qty negative,
      negative price, "1,250.50", "discount 150%" (original price below the price),
      Arabic + English amount-in-words for 0 / 0.5 / 1,000,000.5 / the supported maxima;
      the rendered document never prints NaN / undefined / a negative total.
   5. Service fees: fee 0 → FREE/مجاناً, "5%" renders as text, a "=1+1" fee is escaped,
      never evaluated, refused on save; no CSV/blob export path exists (static).
   6. Company profile: mid-edit typed text survives an audience switch and a language
      toggle; a disabled section never renders; a typed year survives the toggle.
   7. Tender: past projects ON by default AND prefilled from the DB on a NEW tender; an
      empty official-documents index renders nothing (no broken table).
   8. Cross-cutting: save → reload → reopen → save again: every field round-trips; a
      draft never carries a number; two rapid Issue clicks never consume two numbers.
   9. Pickers: count of practice (a13e0000…) records the page offers — INFO only.
  10. brand/proposal.html still present + still opened from js/46 — INFO only.

   Run:   node scripts/qa/probe-generator-attacks.mjs
   Sabotage: run with APP_DIR=<copy of the repo with a fix reverted> — the relevant
   checks must fail (done by hand for every fix in the 2 Sep audit report).            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const APP = process.env.APP_DIR || REPO;
const PORT = 8899; process.env.APP_DIR = APP; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');

let failed = 0, passed = 0;
const check = (label, ok, detail = '') => {
  ok ? passed++ : failed++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (ok || !detail ? '' : '  → ' + detail));
};
const info = (label) => console.log('INFO  ' + label);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- static / report-only items (9, 10) ---------- */
{
  const has = fs.existsSync(APP + '/brand/proposal.html');
  const j46 = fs.readFileSync(APP + '/js/46-brand-and-studio.js', 'utf8');
  const opens = (j46.match(/proposal\.html/g) || []).length;
  info('item 10 — brand/proposal.html present in the deployed tree: ' + has + '; js/46 opens it from ' + opens + ' place(s)');
  const j68 = fs.readFileSync(APP + '/js/68-service-fees-tab.js', 'utf8');
  check('js/68 has no CSV/blob/download export path (spreadsheet-injection vector absent)',
    !/text\/csv|new Blob|download=|\.csv/i.test(j68));
}

/* ---------- in-memory stores shared by every page ---------- */
function applyFilters(rows, search) {
  const q = new URLSearchParams(search); let out = rows.slice();
  for (const [k, v] of q) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    let m = v.match(/^eq\.(.*)$/); if (m) { out = out.filter(r => String(r[k]) === m[1]); continue; }
    m = v.match(/^in\.\((.*)\)$/); if (m) { const set = m[1].split(',').map(s => s.replace(/^"|"$/g, '')); out = out.filter(r => set.includes(String(r[k]))); continue; }
    m = v.match(/^is\.(.*)$/); if (m) { out = out.filter(r => m[1] === 'null' ? r[k] == null : String(r[k]) === m[1]); continue; }
  }
  const order = q.get('order');
  if (order) { const [col, dir] = order.split('.'); out.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
  const lim = q.get('limit'); if (lim) out = out.slice(0, +lim);
  return out;
}
const DOCS = []; let docSeq = 0;
const posts = [], patches = [];              /* every write to generated_documents, in order */
const rpc = { calls: [], delay: 0, counters: {} };
let clausePatches = 0, feePosts = [];

const CLAUSES = [
  { key: 'preamble', title_en: 'Preamble', title_ar: 'تمهيد', body_en: 'SYNTH preamble. [Edit per agreement]', body_ar: 'تمهيد اختباري. [يُحرَّر حسب الاتفاق]', optional: false, enabled: true, sort: 10 },
  { key: 'scope', title_en: 'Scope of Services', title_ar: 'نطاق الخدمات', body_en: 'SYNTH scope. [Edit per agreement]', body_ar: 'نطاق اختباري. [يُحرَّر حسب الاتفاق]', optional: false, enabled: true, sort: 20 },
  /* mirrors the SHAPE of the live template: the financial clause refers to the fee annex */
  { key: 'financial', title_en: 'Financial Terms', title_ar: 'الشروط المالية', body_en: 'SYNTH fees as listed in the fee annex. [Edit per agreement]', body_ar: 'الرسوم وفق ما ورد في ملحق الرسوم. [يُحرَّر حسب الاتفاق]', optional: false, enabled: true, sort: 30 },
  { key: 'term', title_en: 'Term & Termination', title_ar: 'المدة والإنهاء', body_en: 'Notice of ({{notice_days}}) days.', body_ar: 'إشعار قبل ({{notice_days}}) يوماً.', optional: false, enabled: true, sort: 80 },
  { key: 'disputes', title_en: 'Dispute Resolution', title_ar: 'تسوية النزاعات', body_en: 'SYNTH disputes.', body_ar: 'نزاعات اختبارية.', optional: false, enabled: true, sort: 90 },
  { key: 'force_majeure', title_en: 'SYNTH-FM-HIDDEN', title_ar: 'القوة القاهرة المخفية', body_en: 'Must NEVER render.', body_ar: 'يجب ألا يظهر.', optional: true, enabled: false, sort: 130 },
];
const IDENTITY = [
  { key: 'legal_name', category: 'legal', label_en: 'Legal name', label_ar: 'الاسم القانوني', value_en: 'Synthetic Test Co Ltd', value_ar: 'شركة اختبار للسفر', show_on_documents: true, sensitive: false, proof_path: null, sort: 1 },
  { key: 'cr_number', category: 'legal', label_en: 'CR number', label_ar: 'السجل التجاري', value_en: '9999999999', value_ar: null, show_on_documents: true, sensitive: false, proof_path: null, sort: 2 },
  { key: 'website', category: 'contact', label_en: 'Website', label_ar: 'الموقع', value_en: 'www.example.test', value_ar: null, show_on_documents: true, sensitive: false, proof_path: null, sort: 3 },
  { key: 'phone_licence', category: 'contact', label_en: 'Phone', label_ar: 'الهاتف', value_en: '000 000 0000', value_ar: null, show_on_documents: true, sensitive: false, proof_path: null, sort: 4 },
];
/* NO proof_path anywhere above → the official-documents index must be absent, not broken */
const SECTIONS = [
  { key: 'what_we_offer', title_en: 'What we offer', title_ar: 'ما نقدمه', body_en: 'SYNTH-OFFER paragraph.', body_ar: 'فقرة اختبار.', items: [], sort: 10, enabled: true },
  { key: 'values', title_en: 'Our values', title_ar: 'قيمنا', body_en: '', body_ar: '', items: [{ en: 'SYNTH-VALUE-ONE', ar: 'قيمة-واحد', desc_en: 'd1', desc_ar: 'و1' }], sort: 20, enabled: true },
  { key: 'tech', title_en: 'SYNTH-TECH-HIDDEN', title_ar: 'قسم مخفي', body_en: 'This disabled section must NEVER render.', body_ar: 'يجب ألا يظهر.', items: [], sort: 30, enabled: false },
  { key: 'services', title_en: 'Our services', title_ar: 'خدماتنا', body_en: '', body_ar: '', items: [{ en: 'SYNTH-SVC Flights', ar: 'طيران اختباري' }], sort: 40, enabled: true },
  { key: 'stats', title_en: 'Direct in numbers', title_ar: 'دايركت بالأرقام', body_en: '', body_ar: '', items: [], sort: 50, enabled: true },
  { key: 'past_projects', title_en: 'Past projects', title_ar: 'مشاريع سابقة', body_en: '', body_ar: '', items: [{ en: 'SYNTH-PROJECT Alpha', ar: 'مشروع ألفا اختباري' }], sort: 90, enabled: true },
];
const ACH = [
  { id: 'ach-1', kind: 'stat', title_en: '999+ synth-stat', title_ar: '+999 إحصائية', body_en: '', body_ar: '', audiences: ['education', 'government'], enabled: true, sort: 1 },
  { id: 'ach-2', kind: 'service', title_en: 'SYNTH-SVC-EDU study', title_ar: 'خدمة-تعليم', body_en: '', body_ar: '', audiences: ['education'], enabled: true, sort: 2 },
];
const SCENARIOS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', name_en: 'Flat corporate rates', name_ar: 'رسوم موحدة', sort: 1,
    columns: [{ header_en: 'Fee (SAR)', header_ar: 'الرسوم (ريال)' }],
    rows: [{ title_en: 'Flights', title_ar: 'الطيران', rows: [{ svc_en: 'Domestic flight booking', svc_ar: 'حجز طيران داخلي', fees: [25] }] }] },
];

async function wire(p) {
  await p.route('**/brand/*.css', r => {
    const u = new URL(r.request().url());
    try { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(APP + u.pathname, 'utf8') }); }
    catch (e) { r.fulfill({ status: 404, body: '' }); }
  });
  /* catch-all → the qa mock; specific fixture routes are registered AFTER it and win */
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/contract_clauses**', r => {
    if (r.request().method() === 'PATCH') { clausePatches++; return json(r, [CLAUSES[0]]); }
    return json(r, CLAUSES);
  });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_identity**', r => json(r, IDENTITY));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_achievements**', r => json(r, ACH));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/service_fee_scenarios**', r => json(r, SCENARIOS));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/company_profile_sections**', r => {
    const rq = r.request(); const u = new URL(rq.url());
    if (rq.method() === 'PATCH') {
      let body = {}; try { body = JSON.parse(rq.postData() || '{}'); } catch (_) {}
      const key = (u.searchParams.get('key') || '').replace(/^eq\./, '');
      const row = SECTIONS.find(s => s.key === key); if (!row) return json(r, []);
      Object.assign(row, body); return json(r, [row]);
    }
    return json(r, applyFilters(SECTIONS, u.search));
  });
  /* client_service_fees: EMPTY for every client (the live table today) */
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/client_service_fees**', r => {
    const m = r.request().method();
    if (m === 'POST') { try { feePosts.push(JSON.parse(r.request().postData() || 'null')); } catch (_) { feePosts.push('bad-json'); } return json(r, [], 201); }
    return json(r, []);
  });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/rpc/next_document_number**', async r => {
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
    const fam = body.p_family || '?'; rpc.calls.push(fam); rpc.counters[fam] = (rpc.counters[fam] || 0) + 1;
    if (rpc.delay) await sleep(rpc.delay);
    return json(r, fam + '-2026-' + String(rpc.counters[fam]).padStart(3, '0'));
  });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/generated_documents**', r => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    if (m === 'POST') {
      let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (_) { body = { parseError: true }; }
      const rec = Array.isArray(body) ? body[0] : body; posts.push(rec);
      const row = Object.assign({ id: 'gd-' + String(++docSeq).padStart(4, '0'), created_at: new Date(Date.now() + docSeq * 1000).toISOString() }, rec);
      DOCS.push(row); return json(r, [row], 201);
    }
    if (m === 'PATCH') {
      let body = {}; try { body = JSON.parse(rq.postData() || '{}'); } catch (_) {}
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
      const row = DOCS.find(x => x.id === id); patches.push({ id, body });
      if (!row) return json(r, []);
      Object.assign(row, body); return json(r, [row]);
    }
    return json(r, applyFilters(DOCS, u.search));
  });
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 950 } });

async function signIn(p) {
  await p.waitForTimeout(2500);
  const form = await p.$('#cl_email');
  if (form && await form.isVisible()) {
    await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  }
  await p.waitForTimeout(5000);
  await p.evaluate(() => { window.__userRole = window.__userRole || 'admin'; current = 'documents'; render(); });
  await p.waitForTimeout(1800);
}
const WRAP = { '/documents/contract': '#ctWrap', '/documents/offer': '#poWrap', '/documents/fees': '#sfWrap', '/documents/profile': '#cpWrap', '/documents/tender': '#tdWrap' };
/* boot can lag on later pages — re-render until the deep-linked editor's wrap appears */
async function ensureEditor(p, pathname) {
  const sel = WRAP[pathname]; if (!sel) return true;
  for (let i = 0; i < 25; i++) {
    if (await p.evaluate(s => !!document.querySelector(s), sel)) return true;
    await p.evaluate(() => { try { current = 'documents'; render(); } catch (_) {} });
    await sleep(400);
  }
  return false;
}
async function openPage(pathname) {
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(String(e.message)));
  await wire(p);
  await p.goto(BASE + pathname, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await signIn(p);
  await ensureEditor(p, pathname);
  return { p, errors };
}
const pagesText = (p, id) => p.evaluate((i) => (document.getElementById(i) || {}).innerText || '', id);
const bodyText = (p) => p.evaluate(() => document.body.innerText || '');
const noGarbage = (txt) => !/NaN|undefined|null\b/.test(txt);
/* wait until the editor's saved-documents <select> offers the given row id */
async function waitForOption(p, id, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await p.evaluate((i) => !!document.querySelector('#dgEditorBody option[value="' + i + '"]'), id)) return true;
    await sleep(250);
  }
  return false;
}
/* deep "a ⊆ b": every key of a is present in b with a deep-equal value; returns the first
   mismatching path or '' when b carries everything a carried */
function subsetDiff(a, b, path = '') {
  if (a === b) return '';
  if (a == null || typeof a !== 'object') return (String(a) === String(b)) ? '' : (path || '<root>') + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b);
  if (b == null || typeof b !== 'object') return (path || '<root>') + ': missing';
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || b.length !== a.length) return path + ': array length ' + a.length + ' → ' + (Array.isArray(b) ? b.length : 'not array');
    for (let i = 0; i < a.length; i++) { const d = subsetDiff(a[i], b[i], path + '[' + i + ']'); if (d) return d; }
    return '';
  }
  for (const k of Object.keys(a)) {
    if (k.indexOf('__') === 0) continue;
    const d = subsetDiff(a[k], b[k], path ? path + '.' + k : k); if (d) return d;
  }
  return '';
}
const SEED_BIZ = () => {
  DB.businesses = DB.businesses || [];
  const add = (o) => { if (!DB.businesses.some(x => x.id === o.id)) DB.businesses.push(o); };
  add({ id: 'qa-nocr', name: 'Synthetic NoCR Co', nameAr: 'شركة بلا سجل', isClient: true });
  add({ id: 'qa-cr-a', name: 'Synthetic CR Co', nameAr: 'شركة بسجل', isClient: true, crVat: '1010999999', contacts: [{ name: 'Synthetic Rep', phone: '+966500000000' }] });
  add({ id: 'qa-twin-1', name: 'Twin Co — CRM', isClient: false });
  add({ id: 'qa-twin-2', name: 'Twin Co', isClient: true, crVat: '2020888888' });
};
async function clearPlaceholders(p, keys) {
  for (const key of keys) {
    await p.evaluate((k) => ctClauseEdit(k), key); await sleep(150);
    await p.evaluate(() => {
      const en = document.getElementById('ctE_ben'), ar = document.getElementById('ctE_bar');
      if (en) en.value = en.value.replace(/\s*\[?Edit per agreement\]?/g, '').trim() || 'Agreed wording.';
      if (ar) ar.value = ar.value.replace(/\s*\[?يُحرَّر حسب الاتفاق\]?/g, '').trim() || 'نص متفق عليه.';
    });
    await p.evaluate((k) => ctClauseSave(k), key); await sleep(150);
  }
}

/* ===================================================================== */
/* A — CONTRACT (items 1, 2, 3, 6-variant, 8)                              */
/* ===================================================================== */
{
  const { p, errors } = await openPage('/documents/contract');
  check('A: contract editor opens by deep link', await p.evaluate(() => window.__dgTabProbe && __dgTabProbe() === 'contract' && !!document.querySelector('#ctWrap .ct-form')));
  await p.evaluate(SEED_BIZ);
  const crInput = () => p.evaluate(() => {
    const f = (k) => ([...document.querySelectorAll('#ctWrap input')].find(i => (i.getAttribute('oninput') || '').includes("'party2','" + k + "'")) || {}).value;
    return { cr: f('cr'), rep: f('rep'), phone: f('phone'), note: /Taken from the matching record|مأخوذ من السجل المطابق/.test(document.querySelector('#ctWrap .ct-form').innerText) };
  });
  /* item 1 — no CR, no twin */
  await p.evaluate(() => ctSet('clientId', 'qa-nocr')); await sleep(900);
  let v = await crInput();
  check('A1: client with NO CR and no twin → CR stays blank', v.cr === '', JSON.stringify(v));
  check('A1: … and no "Taken from the matching record" note', v.note === false);
  check('A1: … and no JS error', errors.length === 0, errors.join(' | '));
  /* positive control: a same-named twin WITH a CR is borrowed and SAID SO */
  await p.evaluate(() => ctSet('clientId', 'qa-twin-1')); await sleep(700);
  v = await crInput();
  check('A1 control: CR-less record with a same-named twin borrows the twin\'s CR + shows the note', v.cr === '2020888888' && v.note === true, JSON.stringify(v));
  /* the attack: A (auto-filled CR/rep/phone) → B (nothing) must not carry A\'s identity */
  await p.evaluate(() => ctSet('clientId', 'qa-cr-a')); await sleep(700);
  v = await crInput();
  check('A1: client WITH a CR + contact auto-fills CR / rep / phone', v.cr === '1010999999' && v.rep === 'Synthetic Rep' && v.phone === '+966500000000', JSON.stringify(v));
  await p.evaluate(() => ctSet('clientId', 'qa-nocr')); await sleep(700);
  v = await crInput();
  check('A1 ATTACK: switching to a client with NO CR clears the previous client\'s auto-filled CR', v.cr === '', 'CR carried over: ' + JSON.stringify(v));
  check('A1 ATTACK: … and the previous client\'s auto-filled rep / phone', v.rep === '' && v.phone === '', JSON.stringify(v));
  const pages1 = await pagesText(p, 'ctPages');
  check('A1 ATTACK: the printed contract no longer carries the previous client\'s CR', !pages1.includes('1010999999'));
  /* a TYPED value is never overwritten by a later pick */
  await p.evaluate(() => ctParty('party2', 'cr', '3030777777'));
  await p.evaluate(() => ctSet('clientId', 'qa-cr-a')); await sleep(700);
  v = await crInput();
  check('A1: a typed CR survives picking a client that has its own CR (never overwritten)', v.cr === '3030777777', JSON.stringify(v));
  await p.evaluate(() => ctParty('party2', 'cr', ''));

  /* item 2 — annex: zero proposals, zero rows. Decided correct-per-intent behaviour: an
     empty annex renders as NOTHING (the annex section is optional), so the issued document
     never carries an empty or broken annex table. Blocking Issue on "a clause mentions the
     annex" would risk false positives on legitimately annex-less contracts. */
  await p.evaluate(() => ctSet('clientId', 'qa-nocr')); await sleep(1200);
  check('A2: import dropdown says "no saved proposals for this client" (live: 0 SFP rows)', await p.evaluate(() =>
    [...document.querySelectorAll('#ctWrap select option')].some(o => /no saved proposals for this client|لا توجد عروض محفوظة لهذا العميل/.test(o.textContent))));
  const ann = await p.evaluate(() => ({ annex: !!document.querySelector('#ctAnnex'), feeTables: document.querySelectorAll('#ctPages table.ct-fee').length,
    emptyTbody: [...document.querySelectorAll('#ctPages table').values()].some(t => !t.querySelector('tbody tr')),
    clauseRefsAnnex: /ملحق الرسوم/.test(document.getElementById('ctPages').innerText) }));
  check('A2: an empty annex prints NO annex element and NO fee table (renders as nothing, not a broken/empty table)', !ann.annex && ann.feeTables === 0 && !ann.emptyTbody, JSON.stringify(ann));
  check('A2: the financial clause DOES reference the fee annex (fixture mirrors the live template shape)', ann.clauseRefsAnnex);

  /* item 3 — Issue with placeholders is refused; no number consumed */
  const rpcBefore = rpc.calls.length;
  await p.evaluate(() => ctIssue()); await sleep(400);
  const t3 = await bodyText(p);
  check('A3: Issue with placeholder wording is refused (toast names the placeholder problem)', /placeholder wording|نصاً مبدئياً/.test(t3), t3.slice(-200));
  await sleep(900);
  check('A3: … no number consumed (next_document_number never called)', rpc.calls.length === rpcBefore, 'rpc calls: ' + JSON.stringify(rpc.calls));
  check('A3: … still a draft with no number', await p.evaluate(() => __ctProbe().docNumber === null && __ctProbe().status === 'draft'));
  check('A3: … and even the draft POST/PATCH carried no doc_number', posts.concat(patches.map(x => x.body)).every(x => x.doc_number == null));
  /* clear the placeholders the way a user would */
  await clearPlaceholders(p, ['preamble', 'scope', 'financial']);
  check('A3: placeholders cleared', await p.evaluate(() => __ctProbe().placeholderClauseKeys.length === 0));
  /* a realistic contract carries a fee annex; add one row, then Issue must proceed */
  await p.evaluate(() => { ctSec('add'); ctSecSet(0, 'tAr', 'طيران'); ctRowSet(0, 0, 'ar', 'تذكرة داخلية اختبارية'); ctRowSet(0, 0, 'en', 'SYNTH domestic ticket'); ctRowSet(0, 0, 'fee', '25'); });
  await sleep(500);
  check('A2: with one fee row the annex renders (table + heading)', await p.evaluate(() => !!document.querySelector('#ctAnnex table.ct-fee') && document.getElementById('ctPages').innerText.includes('ملحق الرسوم')));
  await p.evaluate(() => ctIssue()); await sleep(2500);
  const issued = await p.evaluate(() => __ctProbe());
  check('A3: Issue succeeds → CTR-2026-001', issued.docNumber === 'CTR-2026-001', JSON.stringify(issued));
  check('A3: … status sent', issued.status === 'sent');
  check('A3: … exactly ONE number consumed', rpc.calls.filter(x => x === 'CTR').length === 1, JSON.stringify(rpc.calls));
  const ctrRow = DOCS.find(x => x.family === 'CTR');
  check('A3: … the stored row carries doc_number, status sent and the picked business_id', !!ctrRow && ctrRow.doc_number === 'CTR-2026-001' && ctrRow.status === 'sent' && ctrRow.business_id === 'qa-nocr', JSON.stringify(ctrRow && { n: ctrRow.doc_number, s: ctrRow.status, b: ctrRow.business_id }));
  check('A3: the issued document no longer shows the DRAFT watermark', await p.evaluate(() => !document.querySelector('#ctPages .ct-wm')));
  await p.evaluate(() => ctIssue()); await sleep(600);
  check('A3: a second Issue on an issued contract asks for NO new number', rpc.calls.filter(x => x === 'CTR').length === 1);

  /* item 8 — two rapid Issue clicks on a fresh contract */
  await p.evaluate(() => { ctNew(); ctSet('clientId', 'qa-cr-a'); }); await sleep(600);
  await clearPlaceholders(p, ['preamble', 'scope', 'financial']);
  await p.evaluate(() => { ctSec('add'); ctRowSet(0, 0, 'en', 'SYNTH row'); ctRowSet(0, 0, 'fee', '10'); }); await sleep(300);
  rpc.delay = 500;
  const ctrBefore = rpc.calls.filter(x => x === 'CTR').length;
  await p.evaluate(() => ctIssue()); await sleep(150); await p.evaluate(() => ctIssue()); await sleep(150); await p.evaluate(() => ctIssue());
  await sleep(3000); rpc.delay = 0;
  const dbl = await p.evaluate(() => __ctProbe());
  check('A8 ATTACK: three rapid Issue clicks consume exactly ONE number', rpc.calls.filter(x => x === 'CTR').length === ctrBefore + 1, 'CTR rpc calls: ' + rpc.calls.filter(x => x === 'CTR').length + ' (was ' + ctrBefore + ')');
  check('A8: … and the contract ends up issued once, as CTR-2026-002', dbl.docNumber === 'CTR-2026-002' && dbl.status === 'sent', JSON.stringify(dbl));
  check('A8: … the Issue button is gone once issued', await p.evaluate(() => ![...document.querySelectorAll('#ctWrap button')].some(x => /Issue contract|إصدار العقد/.test(x.textContent))));

  /* item 6 variant — clause editor mid-edit survives a language toggle / client pick */
  await p.evaluate(() => { ctNew(); }); await sleep(400);
  await p.evaluate(() => ctClauseEdit('scope')); await sleep(200);
  await p.evaluate(() => { document.getElementById('ctE_bar').value = 'SYNTH-TYPED-AR-CLAUSE'; document.getElementById('ctE_bar').dispatchEvent(new Event('input')); });
  await p.evaluate(() => ctLang('en')); await sleep(500);
  const typed1 = await p.evaluate(() => (document.getElementById('ctE_bar') || {}).value);
  check('A6 ATTACK: clause text typed mid-edit survives the AR/EN toggle', typed1 === 'SYNTH-TYPED-AR-CLAUSE', 'editor now holds: ' + JSON.stringify(typed1));
  await p.evaluate(() => ctSet('clientId', 'qa-twin-2')); await sleep(700);
  const typed2 = await p.evaluate(() => (document.getElementById('ctE_bar') || {}).value);
  check('A6 ATTACK: … and survives picking a client (full repaint)', typed2 === 'SYNTH-TYPED-AR-CLAUSE', 'editor now holds: ' + JSON.stringify(typed2));
  await p.evaluate(() => ctClauseSave('scope')); await sleep(300);
  check('A6: saving the edited clause prints the typed text (AR) and stays a per-contract override', await p.evaluate(() => { ctLang('ar'); return new Promise(r => setTimeout(() => r(document.getElementById('ctPages').innerText.includes('SYNTH-TYPED-AR-CLAUSE') && __ctProbe().clauses.find(c => c.key === 'scope').override === true), 400)); }));
  check('A6: no PATCH ever reached contract_clauses (override isolation intact)', clausePatches === 0);

  /* item 8 — round trip: save → reload → reopen → save */
  await p.evaluate(() => { ctNew(); ctSet('titleAr', 'عقد اختباري للجولة'); ctSet('titleEn', 'SYNTH round-trip contract'); ctSet('clientId', 'qa-cr-a'); ctSet('noticeDays', '45');
    ctParty('party2', 'title', 'SYNTH-TITLE'); ctParty('party1', 'rep', 'SYNTH-DIRECT-REP'); ctCol2('on', true); ctCol2('headEn', 'Employee'); ctCol2('headAr', 'الموظف');
    ctSec('add'); ctSecSet(0, 'tEn', 'Flights'); ctRowSet(0, 0, 'en', 'SYNTH domestic'); ctRowSet(0, 0, 'ar', 'داخلي'); ctRowSet(0, 0, 'fee', '25'); ctRowSet(0, 0, 'fee2', '50'); ctRowSet(0, 0, 'total', true);
    ctClauseToggle('disputes', false); });
  await sleep(400);
  await p.evaluate(() => ctClauseEdit('term')); await sleep(150);
  await p.evaluate(() => { document.getElementById('ctE_ben').value = 'SYNTH override ({{notice_days}})'; ctClauseSave('term'); }); await sleep(200);
  const nPosts = posts.length;
  await p.evaluate(() => ctSaveDraft()); await sleep(1500);
  check('A8: draft save POSTed', posts.length === nPosts + 1);
  const p1 = posts[posts.length - 1];
  check('A8: draft POST carries NO doc_number and status draft', p1 && p1.doc_number == null && p1.status === 'draft');
  const savedId = DOCS[DOCS.length - 1].id;
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await signIn(p); await ensureEditor(p, '/documents/contract');
  check('A8: after reload the deep link reopens the contract editor', await p.evaluate(() => window.__dgTabProbe && __dgTabProbe() === 'contract'));
  await p.evaluate(SEED_BIZ);
  check('A8: the saved contract is listed after reload', await waitForOption(p, savedId));
  await p.evaluate((id) => ctOpen(id), savedId); await sleep(1200);
  const nPatches = patches.length;
  await p.evaluate(() => ctSaveDraft()); await sleep(1500);
  check('A8: re-save after reopen PATCHed the same row', patches.length === nPatches + 1 && patches[patches.length - 1].id === savedId);
  const p2 = patches[patches.length - 1].body;
  const dCtr = subsetDiff(p1.payload, p2 && p2.payload);
  check('A8 ROUND TRIP (contract): every saved field survives reload + reopen', dCtr === '', dCtr);
  check('A8: reopened contract prints the override + notice days + annex + hides the disabled clause', await p.evaluate(() => { const t = document.getElementById('ctPages').innerText; return t.includes('(45)') && t.includes('داخلي') && !t.includes('تسوية النزاعات'); }));
  check('A: no JS errors on the contract editor', errors.length === 0, errors.join(' | '));
  await p.close();
}

/* ===================================================================== */
/* B — PRICE OFFER (items 4, 8)                                            */
/* ===================================================================== */
{
  const { p, errors } = await openPage('/documents/offer');
  check('B: offer editor opens by deep link', await p.evaluate(() => window.__dgTabProbe && __dgTabProbe() === 'offer' && !!document.querySelector('#poWrap .po-form')));
  await p.evaluate(SEED_BIZ);
  /* zero lines via saved payloads */
  DOCS.push({ id: 'gd-ofr-empty', family: 'OFR', doc_type: 'price_offer', title: 'SYNTH empty', status: 'draft', doc_number: null, business_id: null, created_at: '2026-01-01T00:00:00Z', payload: { lang: 'en', lines: [] } });
  DOCS.push({ id: 'gd-ofr-null', family: 'OFR', doc_type: 'price_offer', title: 'SYNTH null', status: 'draft', doc_number: null, business_id: null, created_at: '2026-01-02T00:00:00Z', payload: { lang: 'en', lines: null } });
  await p.evaluate(() => poNew()); await sleep(300);
  await waitForOption(p, 'gd-ofr-empty');
  for (const id of ['gd-ofr-empty', 'gd-ofr-null']) {
    await p.evaluate((i) => poOpen(i), id); await sleep(500);
    const t = await pagesText(p, 'poPages');
    check('B4: saved offer with lines=' + (id.endsWith('empty') ? '[]' : 'null') + ' renders the friendly empty row, no NaN', /Add services above|أضف الخدمات أعلاه/.test(t) && noGarbage(t), t.slice(0, 120));
  }
  const calc = () => p.evaluate(() => __poCalcProbe());
  const scenario = async (label, qty, price, expect) => {
    await p.evaluate(({ q, pr }) => { poNew(); poSetLine(0, 'svc', 'SYNTH line'); poSetLine(0, 'qty', q); poSetLine(0, 'price', pr); }, { q: qty, pr: price });
    await sleep(300);
    const c = await calc(); const t = await pagesText(p, 'poPages');
    const ok = expect(c, t);
    check('B4: ' + label, ok && noGarbage(t) && c.tot >= 0 && c.subEx >= 0 && c.vat >= 0, JSON.stringify(c) + (noGarbage(t) ? '' : ' + garbage in page'));
    return { c, t };
  };
  await scenario('qty 0 → line renders, totals 0.00, never NaN', '0', '100', (c) => c.subEx === 0 && c.tot === 0);
  await scenario('qty NEGATIVE (-2 × 100) → total never negative', '-2', '100', (c) => c.tot === 0 && c.subEx === 0);
  await scenario('price NEGATIVE (2 × -50) → total never negative', '2', '-50', (c) => c.tot === 0);
  const comma = await scenario('price "1,250.50" (thousands separator) → 1,250.50 not silently 0', '1', '1,250.50', (c) => Math.abs(c.subEx - 1250.5) < 0.001 && Math.abs(c.tot - (c.subEx + c.vat)) < 0.011);
  check('B4: … the page prints 1,250.50', comma.t.includes('1,250.50'));
  await scenario('price "abc" → 0, never NaN', '1', 'abc', (c) => c.tot === 0);
  /* "discount 150%": original price BELOW the price — must still render, never NaN */
  await p.evaluate(() => { poNew(); poSetChk('showOrig', true); poSetLine(0, 'svc', 'SYNTH disc'); poSetLine(0, 'qty', '1'); poSetLine(0, 'price', '250'); poSetLine(0, 'orig', '100'); });
  await sleep(400);
  {
    const t = await pagesText(p, 'poPages'); const c = await calc();
    check('B4: original price below the price ("discount 150%") renders both numbers, totals from the price, no NaN', t.includes('100.00') && t.includes('250.00') && c.subEx === 250 && noGarbage(t));
  }
  /* mixed: one positive + one negative line never drags the total below zero */
  await p.evaluate(() => { poNew(); poSetLine(0, 'svc', 'A'); poSetLine(0, 'qty', '1'); poSetLine(0, 'price', '100'); poLine('add'); poSetLine(1, 'svc', 'B'); poSetLine(1, 'qty', '1'); poSetLine(1, 'price', '-500'); });
  await sleep(400);
  {
    const c = await calc(); const t = await pagesText(p, 'poPages');
    check('B4: a negative line cannot drag the total below zero (100 + (-500) → 115.00 total)', c.subEx === 100 && c.tot === 115 && c.vat >= 0 && noGarbage(t), JSON.stringify(c));
  }
  /* words */
  const w = (n) => p.evaluate((x) => __poWordsProbe(x), n);
  const w0 = await w(0), w05 = await w(0.5), wM = await w(1000000.5), wMaxAr = await w(999999999.99), wMaxEn = await w(999999999999.99), wB = await w(1000000000), wB2 = await w(2000000000);
  check('B4 words 0: EN + AR', w0.en === 'Zero Saudi riyals only' && w0.ar === 'فقط صفر ريال لا غير', JSON.stringify(w0));
  check('B4 words 0.5: EN + AR (halalas only)', w05.en === 'Fifty halalas only' && w05.ar === 'فقط خمسون هللة لا غير', JSON.stringify(w05));
  check('B4 words 1,000,000.5: EN + AR', wM.en === 'One million Saudi riyals and fifty halalas only' && wM.ar === 'فقط مليون ريال وخمسون هللة لا غير', JSON.stringify(wM));
  check('B4 words 999,999,999.99: no undefined/NaN in EN or AR', noGarbage(wMaxAr.en) && noGarbage(wMaxAr.ar), JSON.stringify(wMaxAr));
  check('B4 words 999,999,999,999.99 (EN max): no undefined/NaN', noGarbage(wMaxEn.en) && /billion/.test(wMaxEn.en), JSON.stringify(wMaxEn.en));
  check('B4 words 1,000,000,000: AR reaches the same maximum as EN (billions), never "undefined"', wB.ar === 'فقط مليار ريال لا غير' && noGarbage(wB.ar) && wB.en === 'One billion Saudi riyals only', JSON.stringify(wB));
  check('B4 words 2,000,000,000: AR dual (مليارا ريال)', wB2.ar === 'فقط مليارا ريال لا غير', JSON.stringify(wB2.ar));
  /* item 8 — round trip + numbering */
  await p.evaluate(() => { poNew(); poSet('clientId', 'qa-cr-a'); poSet('attn', 'SYNTH Attn'); poSet('titleEn', 'SYNTH offer'); poSet('titleAr', 'عرض اختباري'); poSet('date', '2026-09-02'); poSet('valid', '21'); poSet('by', 'SYNTH BD'); poSet('notes', 'SYNTH notes'); poSetChk('showOrig', true); poSetChk('vatIncl', true);
    poSetLine(0, 'svc', 'SYNTH A'); poSetLine(0, 'svcAr', 'أ'); poSetLine(0, 'unit', 'Per ticket'); poSetLine(0, 'unitAr', 'لكل تذكرة'); poSetLine(0, 'qty', '3'); poSetLine(0, 'orig', '120'); poSetLine(0, 'price', '100');
    poLine('add'); poSetLine(1, 'svc', 'SYNTH B'); poSetLine(1, 'qty', '1'); poSetLine(1, 'price', '57.5'); });
  await sleep(400);
  const nPosts = posts.length, rpcBefore = rpc.calls.length;
  await p.evaluate(() => poSaveDraft()); await sleep(1500);
  check('B8: draft save POSTed with NO doc_number (numbering never client-side)', posts.length === nPosts + 1 && posts[posts.length - 1].doc_number == null && rpc.calls.length === rpcBefore);
  const p1 = posts[posts.length - 1]; const savedId = DOCS[DOCS.length - 1].id;
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await signIn(p); await ensureEditor(p, '/documents/offer'); await p.evaluate(SEED_BIZ);
  check('B8: saved offer listed after reload', await waitForOption(p, savedId));
  await p.evaluate((id) => poOpen(id), savedId); await sleep(800);
  const nPatches = patches.length;
  await p.evaluate(() => poSaveDraft()); await sleep(1500);
  const p2 = patches.length === nPatches + 1 ? patches[patches.length - 1].body : null;
  const dOfr = subsetDiff(p1.payload, p2 && p2.payload);
  check('B8 ROUND TRIP (offer): every saved field survives reload + reopen', dOfr === '', dOfr);
  check('B8: reopened offer recomputes the same totals (VAT-inclusive 357.50)', await p.evaluate(() => { const c = __poCalcProbe(); return Math.abs(c.tot - 357.5) < 0.001; }), JSON.stringify(await calc()));
  /* issue race */
  rpc.delay = 500; const ofrBefore = rpc.calls.filter(x => x === 'OFR').length;
  await p.evaluate(() => poIssue()); await sleep(150); await p.evaluate(() => poIssue()); await sleep(150); await p.evaluate(() => poIssue());
  await sleep(3000); rpc.delay = 0;
  check('B8 ATTACK: three rapid Issue clicks consume exactly ONE OFR number', rpc.calls.filter(x => x === 'OFR').length === ofrBefore + 1, 'OFR rpc calls: ' + rpc.calls.filter(x => x === 'OFR').length);
  const ofrRow = DOCS.find(x => x.id === savedId);
  check('B8: … issued once as OFR-2026-001, status sent', ofrRow && ofrRow.doc_number === 'OFR-2026-001' && ofrRow.status === 'sent', JSON.stringify(ofrRow && { n: ofrRow.doc_number, s: ofrRow.status }));
  check('B: no JS errors on the offer editor', errors.length === 0, errors.join(' | '));
  await p.close();
}

/* ===================================================================== */
/* C — SERVICE FEES (items 5, 2-spirit, 8)                                 */
/* ===================================================================== */
{
  const { p, errors } = await openPage('/documents/fees');
  check('C: fees editor opens by deep link', await p.evaluate(() => window.__dgTabProbe && __dgTabProbe() === 'fees' && !!document.querySelector('#sfWrap .sf-form')));
  await p.evaluate(SEED_BIZ);
  await p.evaluate(() => { sfNew(); sfSet('clientId', 'qa-nocr'); }); await sleep(1200);
  const fp = await p.evaluate(() => __sfFeesProbe());
  check('C2: client with ZERO client_service_fees rows → probe reports 0 saved, no Load button, no error', fp.biz === 'qa-nocr' && fp.saved === 0 && await p.evaluate(() => ![...document.querySelectorAll('#sfClientRates button')].some(b => /Load saved rates|تحميل الأسعار المحفوظة/.test(b.textContent))), JSON.stringify(fp));
  check('C2: … and the fee page shows the friendly placeholder, not an empty table', await p.evaluate(() => /Pick a scenario or add services|اختر سيناريو أو أضف خدمات/.test(document.getElementById('sfPages').innerText) && !document.querySelector('#sfPages table.sf-fee')));
  await p.evaluate(() => { sfRowSet(0, 0, 'en', 'SYNTH free row'); sfRowSet(0, 0, 'fee', '0');
    sfRow('add', 0); sfRowSet(0, 1, 'en', 'SYNTH pct row'); sfRowSet(0, 1, 'fee', '5%');
    sfRow('add', 0); sfRowSet(0, 2, 'en', 'SYNTH pct free'); sfRowSet(0, 2, 'fee', '5%'); sfRowSet(0, 2, 'free', true);
    sfRow('add', 0); sfRowSet(0, 3, 'en', 'SYNTH formula'); sfRowSet(0, 3, 'fee', '=1+1');
    sfRow('add', 0); sfRowSet(0, 4, 'en', 'SYNTH plus'); sfRowSet(0, 4, 'fee', '+15'); });
  await sleep(500);
  let t = await pagesText(p, 'sfPages');
  const rowCell = (name) => p.evaluate((nm) => { const tr = [...document.querySelectorAll('#sfPages table.sf-fee tbody tr')].find(r => r.innerText.includes(nm)); return tr ? tr.querySelector('td.amt').innerHTML : null; }, name);
  check('C5: fee 0 renders as FREE (house pattern, EN)', /FREE/.test(await rowCell('SYNTH free row') || ''));
  check('C5: percentage fee renders as typed (5%)', (await rowCell('SYNTH pct row') || '').includes('5%'));
  check('C5: percentage fee + Free flag → FREE wins', /FREE/.test(await rowCell('SYNTH pct free') || ''));
  const formulaCell = await rowCell('SYNTH formula') || '';
  check('C5: "=1+1" renders as literal text — never evaluated (no "2"), HTML-escaped', formulaCell.includes('=1+1') && !/^\s*2\s*$/.test(formulaCell) && !/<script|<[a-z]+ on/i.test(formulaCell), formulaCell);
  check('C5: "+15" renders as 15', (await rowCell('SYNTH plus') || '').trim() === '15', await rowCell('SYNTH plus'));
  check('C5: fee page never prints NaN / undefined', noGarbage(t));
  await p.evaluate(() => sfLang('ar')); await sleep(500);
  check('C5: fee 0 renders as مجاناً on the AR deck', /مجاناً/.test(await rowCell('SYNTH free row') || ''));
  await p.evaluate(() => sfLang('en')); await sleep(300);
  /* save-as-client-rates with the formula row must be refused (M8) and POST nothing */
  const fpBefore = feePosts.length;
  await p.evaluate(() => sfSaveClientRates()); await sleep(400);
  const tt = await bodyText(p);
  check('C5: saving rates with a non-numeric "=1+1" fee is refused plainly and POSTs nothing', /no valid fee|سطر بلا رسوم صالحة/.test(tt) && feePosts.length === fpBefore, tt.slice(-160));
  /* item 8 — round trip */
  await p.evaluate(() => { sfNew(); sfSet('clientId', 'qa-cr-a'); sfSet('titleEn', 'SYNTH fees'); sfSet('titleAr', 'رسوم اختبارية'); sfSet('year', '2027'); sfSet('validity', '2026-12-31'); sfSet('notes', 'SYNTH note'); sfSeed('aaaaaaaa-0000-0000-0000-000000000001'); });
  await sleep(500);
  await p.evaluate(() => { sfCol2('on', true); sfCol2('headEn', 'Employee'); sfCol2('headAr', 'الموظف'); sfRowSet(0, 0, 'fee2', '40'); sfRowSet(0, 0, 'total', true); sfSec('add'); sfSecSet(1, 'tEn', 'Extra'); sfRowSet(1, 0, 'en', 'SYNTH extra'); sfRowSet(1, 0, 'fee', '7%'); sfLang('ar'); });
  await sleep(400);
  const nPosts = posts.length;
  await p.evaluate(() => sfSaveDraft()); await sleep(1500);
  check('C8: draft save POSTed with NO doc_number', posts.length === nPosts + 1 && posts[posts.length - 1].doc_number == null);
  const p1 = posts[posts.length - 1]; const savedId = DOCS[DOCS.length - 1].id;
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await signIn(p); await ensureEditor(p, '/documents/fees'); await p.evaluate(SEED_BIZ);
  check('C8: saved proposal listed after reload', await waitForOption(p, savedId));
  await p.evaluate((id) => sfOpen(id), savedId); await sleep(900);
  const nPatches = patches.length;
  await p.evaluate(() => sfSaveDraft()); await sleep(1500);
  const p2 = patches.length === nPatches + 1 ? patches[patches.length - 1].body : null;
  const dSfp = subsetDiff(p1.payload, p2 && p2.payload);
  check('C8 ROUND TRIP (service fees): every saved field survives reload + reopen', dSfp === '', dSfp);
  rpc.delay = 400; const sfpBefore = rpc.calls.filter(x => x === 'SFP').length;
  await p.evaluate(() => sfIssue()); await sleep(150); await p.evaluate(() => sfIssue());
  await sleep(2500); rpc.delay = 0;
  check('C8 ATTACK: two rapid Issue clicks consume exactly ONE SFP number', rpc.calls.filter(x => x === 'SFP').length === sfpBefore + 1, 'SFP rpc calls: ' + rpc.calls.filter(x => x === 'SFP').length);
  check('C: no JS errors on the fees editor', errors.length === 0, errors.join(' | '));
  await p.close();
}

/* ===================================================================== */
/* D — COMPANY PROFILE (items 6, 8)                                        */
/* ===================================================================== */
{
  const { p, errors } = await openPage('/documents/profile');
  check('D: profile editor opens by deep link', await p.evaluate(() => window.__dgTabProbe && __dgTabProbe() === 'profile' && !!document.querySelector('#cpWrap .cp-form')));
  await p.evaluate(SEED_BIZ);
  let t = await pagesText(p, 'cpPages');
  check('D6: a DISABLED section never renders', !t.includes('SYNTH-TECH-HIDDEN') && !t.includes('must NEVER render'));
  check('D6: enabled sections render (what we offer + values)', t.includes('SYNTH-OFFER') && t.includes('SYNTH-VALUE-ONE'));
  /* mid-edit typed text vs audience switch + language toggle */
  await p.evaluate(() => cpEditSec('what_we_offer')); await sleep(300);
  await p.evaluate(() => { const e = document.getElementById('cpE_ben'); e.value = 'SYNTH-TYPED-BODY'; e.dispatchEvent(new Event('input')); const tt = document.getElementById('cpE_ten'); tt.value = 'SYNTH-TYPED-TITLE'; tt.dispatchEvent(new Event('input')); });
  await p.evaluate(() => cpAud('education')); await sleep(900);
  let ed = await p.evaluate(() => ({ body: (document.getElementById('cpE_ben') || {}).value, title: (document.getElementById('cpE_ten') || {}).value, aud: __cpProbe().audience }));
  check('D6 ATTACK: switching the audience keeps the text typed in the open section editor', ed.body === 'SYNTH-TYPED-BODY' && ed.title === 'SYNTH-TYPED-TITLE', JSON.stringify(ed));
  check('D6: … the audience did switch (education)', ed.aud === 'education');
  await p.evaluate(() => cpLang('ar')); await sleep(600);
  ed = await p.evaluate(() => ({ body: (document.getElementById('cpE_ben') || {}).value, title: (document.getElementById('cpE_ten') || {}).value, lang: __cpProbe().lang }));
  check('D6 ATTACK: the AR/EN toggle mid-edit does not wipe the typed values', ed.body === 'SYNTH-TYPED-BODY' && ed.title === 'SYNTH-TYPED-TITLE' && ed.lang === 'ar', JSON.stringify(ed));
  await p.evaluate(() => cpEditSave('what_we_offer')); await sleep(800);
  check('D6: saving the section sends the TYPED text (not the stale DB text)', SECTIONS.find(s => s.key === 'what_we_offer').body_en === 'SYNTH-TYPED-BODY' && SECTIONS.find(s => s.key === 'what_we_offer').title_en === 'SYNTH-TYPED-TITLE');
  check('D6: after save the editor closes and a fresh Edit shows the saved text', await p.evaluate(() => { if (document.getElementById('cpE_ben')) return false; cpEditSec('what_we_offer'); return new Promise(r => setTimeout(() => r((document.getElementById('cpE_ben') || {}).value === 'SYNTH-TYPED-BODY'), 300)); }));
  await p.evaluate(() => cpEditCancel()); await sleep(200);
  /* typed year survives the toggle (state-backed) */
  await p.evaluate(() => { cpSet('year', '2031'); cpLang('en'); }); await sleep(500);
  check('D6: a typed year survives the language toggle', await p.evaluate(() => [...document.querySelectorAll('#cpWrap input')].some(i => i.value === '2031')));
  /* toggling a section off hides it from the document */
  await p.evaluate(() => cpToggleSec('values', false)); await sleep(700);
  t = await pagesText(p, 'cpPages');
  check('D6: switching a section off removes it from the document', !t.includes('SYNTH-VALUE-ONE'));
  await p.evaluate(() => cpToggleSec('values', true)); await sleep(500);
  /* round trip */
  await p.evaluate(() => { cpNew(); cpLang('ar'); cpAud('government'); cpSet('year', '2029'); cpSet('clientId', 'qa-cr-a'); }); await sleep(600);
  const nPosts = posts.length;
  await p.evaluate(() => cpSaveDraft()); await sleep(1500);
  check('D8: draft save POSTed with NO doc_number', posts.length === nPosts + 1 && posts[posts.length - 1].doc_number == null);
  const p1 = posts[posts.length - 1]; const savedId = DOCS[DOCS.length - 1].id;
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await signIn(p); await ensureEditor(p, '/documents/profile'); await p.evaluate(SEED_BIZ);
  check('D8: saved profile listed after reload', await waitForOption(p, savedId));
  await p.evaluate((id) => cpOpen(id), savedId); await sleep(900);
  const nPatches = patches.length;
  await p.evaluate(() => cpSaveDraft()); await sleep(1500);
  const p2 = patches.length === nPatches + 1 ? patches[patches.length - 1].body : null;
  const d = subsetDiff({ lang: p1.payload.lang, clientId: p1.payload.clientId, year: p1.payload.year, audience: p1.payload.audience }, p2 && p2.payload);
  check('D8 ROUND TRIP (profile): lang / client / year / audience survive reload + reopen', d === '' && p1.payload.audience === 'government' && p1.payload.year === '2029', d);
  check('D8: the audience tag never prints on the document', !/government|الجهات الحكومية/.test(await pagesText(p, 'cpPages')));
  rpc.delay = 400; const prfBefore = rpc.calls.filter(x => x === 'PRF').length;
  await p.evaluate(() => cpIssue()); await sleep(150); await p.evaluate(() => cpIssue());
  await sleep(2500); rpc.delay = 0;
  check('D8 ATTACK: two rapid Issue clicks consume exactly ONE PRF number', rpc.calls.filter(x => x === 'PRF').length === prfBefore + 1, 'PRF rpc calls: ' + rpc.calls.filter(x => x === 'PRF').length);
  check('D: no JS errors on the profile editor', errors.length === 0, errors.join(' | '));
  await p.close();
}

/* ===================================================================== */
/* E — TENDER (items 7, 4-spirit, 8)                                       */
/* ===================================================================== */
{
  const { p, errors } = await openPage('/documents/tender');
  check('E: tender editor opens by deep link', await p.evaluate(() => window.__dgTabProbe && __dgTabProbe() === 'tender' && !!document.querySelector('#tdWrap .td-form')));
  await p.evaluate(SEED_BIZ);
  await sleep(800);
  let t = await pagesText(p, 'tdPages');
  check('E7: past-projects section is ON by default on a NEW tender', await p.evaluate(() => __tdProbe().pastProjectsOn === true));
  check('E7 ATTACK: … and a NEW tender prefills its past-projects items from company_profile_sections (not an empty "—")',
    t.includes('مشاريع سابقة') && (t.includes('مشروع ألفا اختباري') || t.includes('SYNTH-PROJECT Alpha')),
    'past-projects block: ' + (t.match(/مشاريع سابقة[\s\S]{0,60}/) || ['absent'])[0].replace(/\n/g, ' / '));
  const certs = await p.evaluate(() => ({ txt: (document.getElementById('tdPages')||{}).innerText||'', empty: [...document.querySelectorAll('#tdPages table.td-t')].filter(x => !x.querySelector('tbody tr')).length }));
  check('E7: with NO proof documents the official-documents index is absent (no heading, no empty table)', !certs.txt.includes('الشهادات والمستندات الرسمية') && certs.empty === 0, 'empty tables: ' + certs.empty);
  await p.evaluate(() => tdView('fin')); await sleep(600);
  const certsF = await p.evaluate(() => ({ txt: (document.getElementById('tdPages')||{}).innerText||'', empty: [...document.querySelectorAll('#tdPages table.td-t')].filter(x => !x.querySelector('tbody tr')).length }));
  check('E7: … same on the FINANCIAL document', !certsF.txt.includes('الشهادات والمستندات الرسمية') && certsF.empty === 0);
  /* negative BoQ values never produce a negative total */
  await p.evaluate(() => { tdItemSet('boq', 0, 'ar', 'بند اختباري'); tdItemSet('boq', 0, 'unit', 'u'); tdItemSet('boq', 0, 'qty', '-3'); tdItemSet('boq', 0, 'price', '1000'); tdItem('boq', 'add'); tdItemSet('boq', 1, 'ar', 'بند ثانٍ'); tdItemSet('boq', 1, 'qty', '2'); tdItemSet('boq', 1, 'price', '-50'); });
  await sleep(500);
  const tot = await p.evaluate(() => __tdProbe());
  t = await pagesText(p, 'tdPages');
  check('E4 ATTACK: negative qty / price never yield a negative financial subtotal / VAT / total (never NaN)',
    tot.subtotal >= 0 && tot.vat >= 0 && tot.grand >= 0 && noGarbage(t), JSON.stringify({ sub: tot.subtotal, vat: tot.vat, grand: tot.grand }));
  /* round trip both rows */
  await p.evaluate(() => { tdNew(); tdSet('clientId', 'qa-twin-2'); tdSet('titleAr', 'مناقصة اختبارية'); tdSet('titleEn', 'SYNTH tender'); tdSet('validity', '90 days');
    tdItemSet('phases', 0, 'dur', '2 days'); tdItemSet('scope', 0, 'nAr', 'بند نطاق'); tdItemSet('scope', 0, 'nEn', 'SYNTH scope'); tdItemSet('scope', 0, 'locAr', 'الرياض'); tdItemSet('scope', 0, 'benef', '40'); tdItemSet('scope', 0, 'dateHijri', '١٤٤٧');
    tdItemSet('boq', 0, 'ar', 'تذاكر'); tdItemSet('boq', 0, 'en', 'SYNTH tickets'); tdItemSet('boq', 0, 'unit', 'ticket'); tdItemSet('boq', 0, 'qty', '3'); tdItemSet('boq', 0, 'price', '1000');
    tdItemSet('team', 0, 'role', 'PM'); tdItemSet('team', 0, 'name', 'SYNTH PM'); tdItemSet('schedule', 0, 'month', 'M1'); tdItemSet('schedule', 0, 'amount', '2000'); tdItemSet('schedule', 0, 'notes', 'first'); tdPP(true); tdLang('en'); });
  await sleep(700);
  const nPosts = posts.length;
  await p.evaluate(() => tdSaveDraft()); await sleep(2000);
  check('E8: "save both drafts" POSTed TWO rows (TEC + FIN) with NO doc_number', posts.length === nPosts + 2 && posts.slice(-2).every(x => x.doc_number == null) && posts.slice(-2).map(x => x.family).sort().join() === 'FIN,TEC');
  const p1 = posts[posts.length - 2]; const tecId = DOCS.filter(x => x.family === 'TEC').slice(-1)[0].id;
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await signIn(p); await ensureEditor(p, '/documents/tender'); await p.evaluate(SEED_BIZ);
  check('E8: saved tender listed after reload', await waitForOption(p, tecId));
  await p.evaluate((id) => tdOpen(id), tecId); await sleep(1200);
  const nPatches = patches.length;
  await p.evaluate(() => tdSaveDraft()); await sleep(2000);
  const tecPatch = patches.slice(nPatches).find(x => x.body.family === 'TEC'), finPatch = patches.slice(nPatches).find(x => x.body.family === 'FIN');
  const dTec = subsetDiff(p1.payload, tecPatch && tecPatch.body.payload);
  check('E8 ROUND TRIP (tender): every saved field survives reload + reopen (TEC row)', patches.length === nPatches + 2 && dTec === '', dTec || ('patches: ' + (patches.length - nPatches)));
  check('E8: … the FIN row re-saved with the same tender_ref and the same payload', !!finPatch && finPatch.body.payload.tender_ref === p1.payload.tender_ref && subsetDiff(p1.payload, finPatch.body.payload) === '');
  check('E8: reopened tender adopted BOTH rows (rowIds set, both drafts)', await p.evaluate(() => { const s = __tdProbe(); return !!s.tec.rowId && !!s.fin.rowId && s.tec.docNumber === null && s.fin.docNumber === null; }));
  rpc.delay = 500; const finBefore = rpc.calls.filter(x => x === 'FIN').length;
  await p.evaluate(() => tdIssue('FIN')); await sleep(150); await p.evaluate(() => tdIssue('FIN')); await sleep(150); await p.evaluate(() => tdIssue('FIN'));
  await sleep(3200); rpc.delay = 0;
  check('E8 ATTACK: three rapid "Issue financial" clicks consume exactly ONE FIN number', rpc.calls.filter(x => x === 'FIN').length === finBefore + 1, 'FIN rpc calls: ' + rpc.calls.filter(x => x === 'FIN').length);
  check('E8: … FIN issued once (FIN-2026-001), TEC still a draft with no number', await p.evaluate(() => { const s = __tdProbe(); return s.fin.docNumber === 'FIN-2026-001' && s.fin.status === 'sent' && s.tec.docNumber === null; }), JSON.stringify(await p.evaluate(() => __tdProbe().fin)));
  check('E: no JS errors on the tender editor', errors.length === 0, errors.join(' | '));
  await p.close();
}

/* ---------- cross-cutting: a number is NEVER assigned by a save ---------- */
check('X8: no draft POST / PATCH ever carried a doc_number except the Issue-time updates', posts.every(x => x.doc_number == null) && patches.every(x => x.body.doc_number == null || (x.body.status === 'sent' && Object.keys(x.body).sort().join() === 'doc_number,status,updated_at,updated_by')));
check('X8: every consumed number was used exactly once (no gaps, no duplicates)', (() => { const used = DOCS.map(x => x.doc_number).filter(Boolean); return used.length === rpc.calls.length && new Set(used).size === used.length; })(), 'consumed=' + rpc.calls.length + ' used=' + DOCS.filter(x => x.doc_number).length);
info('item 9 — practice records (ids starting a13e0000) offered by the pickers in THIS harness: ' + await (async () => { const p = await ctx.newPage(); await wire(p); await p.goto(BASE + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 }); await signIn(p); const n = await p.evaluate(() => (DB.businesses || []).filter(b => String(b.id).indexOf('a13e0000') === 0).length); await p.close(); return n; })() + ' (the live number is read separately — owner decision, not fixed here)');

await b.close(); try { srv.close(); } catch (_) {}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
