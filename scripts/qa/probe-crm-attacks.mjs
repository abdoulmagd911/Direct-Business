/* probe-crm-attacks.mjs — adversarial checks for Today ("Your day"), the nickname layer,
   the Leads list, lead quick-edit, the Clients page, login/password screens, the people
   bridge, and the hardcoded-name leftovers. Every check below is written to FAIL when the
   behaviour it guards regresses (each one was sabotage-tested against the code it covers).

   Runs entirely against the local Supabase stand-in (scripts/qa/mock-supabase.mjs) as the QA
   admin test@directksa.com. Nothing here touches the live project. All people, companies and
   amounts are synthetic (CLAUDE.md rule 7).

   Run:  NODE_PATH=/tmp/node_modules node scripts/qa/probe-crm-attacks.mjs
   Exit code 1 when any check fails. "REPORT" lines are observations that are not asserted
   (the code they concern lives outside the lane this probe was written for).             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs'; import os from 'os'; import path from 'path';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const UID = '11111111-1111-1111-1111-111111111111';
const ME = 'QA Test Account';           // full_name of the signed-in mock user
const ME_NICK = 'QA Nick';

/* dates in UTC — the app compares toISOString().slice(0,10) strings */
const dayISO = (off) => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10);
const TODAY = dayISO(0), YEST = dayISO(-1), P3 = dayISO(3), P7 = dayISO(7), P8 = dayISO(8);
const msAgo = (days) => Date.now() - days * 864e5;

/* ---------- synthetic roster: one person's nickname equals ANOTHER person's full name ---------- */
const ROSTER = [
  { id: UID, email: 'test@directksa.com', full_name: ME, name_ar: 'حساب الاختبار', nickname: ME_NICK, nickname_ar: 'أبو اختبار', role: 'admin', active: true },
  // listed BEFORE Salem on purpose: Salem's nickname alias is registered after this person's
  // full name, which is the order that lets a naive alias index overwrite the real person
  { id: 'u-abufaris', email: 'abu.faris@example.com', full_name: 'Abu Faris', name_ar: 'أبو فارس', nickname: 'Faris', nickname_ar: 'فارس', role: 'team_member', active: true },
  { id: 'u-salem', email: 'salem.tester@example.com', full_name: 'Salem Tester', name_ar: 'سالم المختبر', nickname: 'Abu Faris', nickname_ar: 'أبو فارس', role: 'team_member', active: true },
  { id: 'u-blank', email: 'blank.nick@example.com', full_name: 'Blank Nick', name_ar: 'بدون لقب', nickname: '', nickname_ar: '', role: 'team_member', active: true },
  { id: 'u-off', email: 'gone@example.com', full_name: 'Switched Off', name_ar: 'موقوف', nickname: 'Off', nickname_ar: '', role: 'viewer', active: false },
];
const NICKS = ROSTER.filter(u => u.active).map(u => ({ full_name: u.full_name, nickname: u.nickname, nickname_ar: u.nickname_ar }));
const ROSTER_NAMES = ROSTER.filter(u => u.active).map(u => u.full_name).sort();

/* ---------- synthetic businesses (shape of a real `businesses` row) ---------- */
function biz(o) {
  return Object.assign({
    id: o.id, legacy_id: o.id, name: o.name, name_ar: o.name_ar || null, source: ('source' in o) ? o.source : 'Import',
    stage: o.stage || 'contacted', status: 'active', category: 'Corporate', segment: 'MICE / Events',
    assigned_to: null, account_manager: null, tier: null, entity_type: null, legal_name: null, cr_vat: null,
    payment_terms: null, credit_limit: null, contract_start: null, contract_end: null, contract_scope: null,
    contract_sla: null, next_review: null, total_sar: 0, website: null, corp_email_flag: null,
    is_client: !!o.is_client, converted_date: o.is_client ? '2026-03-01' : null, direct_client_id: null,
    channels: [], prefs: {}, airline_deals: [], pricing: [], notes: o.notes || '',
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', raw: o.raw || {},
    verification_source: 'manual', needs_manual_confirmation: false, confirmation_reason: null,
    confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null, funnel_details: {},
    stage_legacy: null, next_action_date: o.nad || null, next_action_note: o.nan || null,
    lost_reason: null, archived_at: null, archived_by: null,
  });
}
const XSS1 = '<script>window.__xss=1</script>';
const XSS2 = '<img src=x onerror="window.__xss=2">';
const HOSTILE = { qa_csv_eq: "=cmd|' /C calc'!A0", qa_csv_plus: '+SUM(1)', qa_csv_at: '@cmd', qa_csv_dash: '-Dash Trading', qa_csv_tab: '\tTab Co', qa_csv_cr: '\rCR Co', qa_csv_lf: '\nLF Co' };

const LEADS = [
  // ---- Your day ----
  biz({ id: 'qa_over', name: 'Overdue Lead Co', name_ar: 'شركة المتأخرة', raw: { assignedTo: ME }, nad: YEST, nan: 'Call back' }),
  biz({ id: 'qa_due', name: 'Due Today Co', name_ar: 'شركة اليوم', raw: { assignedTo: ME }, nad: TODAY, nan: 'Send deck' }),
  biz({ id: 'qa_cold', name: 'Never Contacted Co', name_ar: 'شركة بلا تواصل', raw: { assignedTo: ME } }),
  biz({ id: 'qa_won_open', name: 'Won Unconverted Co', raw: { assignedTo: ME }, stage: 'won', nad: YEST }),
  biz({ id: 'qa_lost', name: 'Lost Lead Co', raw: { assignedTo: ME }, stage: 'lost', nad: YEST }),
  biz({ id: 'qa_other', name: 'Someone Elses Co', raw: { assignedTo: 'Salem Tester' }, nad: YEST }),
  biz({ id: 'qa_alias', name: 'Alias Owned Co', raw: { assignedTo: ME_NICK }, nad: YEST, nan: 'Alias follow-up' }),
  // ---- hostile names ----
  biz({ id: 'qa_xss1', name: XSS1, name_ar: '<b>عربي</b>', raw: { assignedTo: ME }, nad: YEST }),
  biz({ id: 'qa_xss2', name: XSS2, raw: { assignedTo: ME }, nad: YEST }),
  ...Object.keys(HOSTILE).map(id => biz({ id, name: HOSTILE[id], raw: { assignedTo: ME } })),
  // ---- Arabic search ----
  biz({ id: 'qa_ar1', name: 'Arabic Search Co', name_ar: 'شركة البحث العربي', raw: {} }),
  biz({ id: 'qa_ar2', name: 'Second Arabic Co', name_ar: 'مؤسسة البحث', raw: {} }),
  // ---- blanks for the sort attack ----
  biz({ id: 'qa_blank', name: 'Blank Fields Co', source: null, raw: {} }),
  // ---- nickname display ----
  biz({ id: 'qa_nick_salem', name: 'Salem Owned Co', raw: { assignedTo: 'Salem Tester' } }),
  biz({ id: 'qa_nick_abu', name: 'Abu Faris Owned Co', raw: { assignedTo: 'Abu Faris' } }),
  biz({ id: 'qa_nick_blank', name: 'Blank Nick Owned Co', raw: { assignedTo: 'Blank Nick' } }),
  // ---- stage spread (Prospect=new, Contacted, Qualified=in_discussion, Proposal, Won, Lost) ----
  biz({ id: 'qa_s_new1', name: 'Stage New 1', stage: 'new', raw: {} }),
  biz({ id: 'qa_s_new2', name: 'Stage New 2', stage: 'new', raw: {} }),
  biz({ id: 'qa_s_q1', name: 'Stage Qualified 1', stage: 'in_discussion', raw: {} }),
  biz({ id: 'qa_s_p1', name: 'Stage Proposal 1', stage: 'proposal', raw: {} }),
  biz({ id: 'qa_s_p2', name: 'Stage Proposal 2', stage: 'proposal', raw: {} }),
  biz({ id: 'qa_s_l1', name: 'Stage Lost 1', stage: 'lost', raw: {} }),
];
const CLIENTS = [
  biz({ id: 'qc_mine_over', name: 'Review Overdue Client', is_client: true, stage: 'won', raw: { accountManager: ME, nextReview: YEST, lastContact: msAgo(2) } }),
  biz({ id: 'qc_mine_stale', name: 'Stale Client', is_client: true, stage: 'won', raw: { accountManager: ME, lastContact: msAgo(100) } }),
  biz({ id: 'qc_mine_watch', name: 'Watch Client', is_client: true, stage: 'won', raw: { accountManager: ME, lastContact: msAgo(50) } }),
  biz({ id: 'qc_mine_new', name: 'Brand New Client', is_client: true, stage: 'won', raw: { accountManager: ME } }),
  biz({ id: 'qc_mine_good', name: 'Good Client', is_client: true, stage: 'won', raw: { accountManager: ME, lastContact: msAgo(2), nextReview: P7 } }),
  biz({ id: 'qc_abdel', name: 'Old Literal Client', is_client: true, stage: 'won', raw: { accountManager: 'Abdelrahman', lastContact: msAgo(2) } }),
  biz({ id: 'qc_salem', name: 'Salem Client', is_client: true, stage: 'won', raw: { accountManager: 'Salem Tester', lastContact: msAgo(2) } }),
  biz({ id: 'qc_alias', name: 'Alias Managed Client', is_client: true, stage: 'won', raw: { accountManager: ME_NICK, lastContact: msAgo(2) } }),
];
const OFFERS = [
  { id: 'qo7', ref: 'OFR-QA-7', subject: 'Seven days out', client: 'Client Seven Co', value: 120000, total: 120000, currency: 'SAR', owner: ME, status: 'Sent', date: TODAY, validUntil: P7 },
  { id: 'qo8', ref: 'OFR-QA-8', subject: 'Eight days out', client: 'Client Eight Co', value: 75500, total: 75500, currency: 'SAR', owner: ME, status: 'Sent', date: TODAY, validUntil: P8 },
  { id: 'qo_acc', ref: 'OFR-QA-ACC', subject: 'Already accepted', client: 'Client Acc Co', value: 99000, total: 99000, currency: 'SAR', owner: ME, status: 'Accepted', date: TODAY, validUntil: P3 },
  { id: 'qo_other', ref: 'OFR-QA-OTH', subject: 'Not mine', client: 'Client Oth Co', value: 88000, total: 88000, currency: 'SAR', owner: 'Salem Tester', status: 'Sent', date: TODAY, validUntil: P3 },
  { id: 'qo_alias', ref: 'OFR-QA-ALIAS', subject: 'Mine by nickname', client: 'Client Alias Co', value: 66000, total: 66000, currency: 'SAR', owner: ME_NICK, status: 'Sent', date: TODAY, validUntil: P3 },
];

/* ---------- harness ---------- */
const RESULTS = []; const REPORTS = [];
function check(name, ok, detail) { RESULTS.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS' : 'FAIL') + ' · ' + name + (ok || detail == null ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)))); }
function report(line) { REPORTS.push(line); console.log('REPORT · ' + line); }

function baseUsers() {
  return [
    { id: UID, email: 'test@directksa.com', full_name: ME, role: 'admin', active: true, created_at: '2026-08-08T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: null },
    { id: 'u-salem', email: 'salem.tester@example.com', full_name: 'Salem Tester', role: 'team_member', active: true, created_at: '2026-08-09T00:00:00Z', must_change_password: true, allowed_pages: ['today', 'leads', 'clients'] },
    { id: 'u-blank', email: 'blank.nick@example.com', full_name: 'Blank Nick', role: 'operations', active: true, created_at: '2026-08-09T00:00:00Z', must_change_password: false, allowed_pages: ['today', 'finance'] },
  ];
}

async function openApp(BASE, opts = {}) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e.message || e).slice(0, 300)));
  const adminCalls = []; const dialogs = []; const dlg = { mode: 'accept' };
  p.on('dialog', async d => { dialogs.push({ type: d.type(), message: d.message() }); if (dlg.mode === 'accept') await d.accept('QA'); else await d.dismiss(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname === '/rest/v1/rpc/team_nicknames') { return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NICKS) }); }
    if (u.pathname.startsWith('/functions/v1/admin-users')) { try { adminCalls.push(JSON.parse(rq.postData() || '{}')); } catch (_) {} }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.route('**logo.clearbit.com/**', r => r.abort());
  await p.goto(BASE + (opts.path || '/today'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { browser, p, errors, adminCalls, dialogs, dlg };
}
async function signIn(p) {
  await p.waitForSelector('#cl_email', { timeout: 20000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
}
async function waitReady(p) {
  await p.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && !!window.__userName, null, { timeout: 30000 }).catch(() => {});
  await p.waitForFunction(() => !!(window.__TEAM && window.__TEAM.length) && !!window.__nickMap && !!window.__ROSTER, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800);
}
const go = async (p, view, ms = 900) => { await p.evaluate(v => { try { openLead = null; } catch (_) {} current = v; render(); }, view); await p.waitForTimeout(ms); };

/* read the Your-day card into rows: [{section, title, meta, tag}] */
const readYourDay = () => {
  const card = document.querySelector('.v57-yourday'); if (!card) return null;
  const rows = []; let section = '';
  card.querySelectorAll('h3, .v19-today-card').forEach(el => {
    if (el.tagName === 'H3') { if (!el.closest('.v19-today-card') && el !== card.querySelector('h3')) section = el.textContent.trim(); return; }
    rows.push({ section, title: (el.querySelector('.ti') || {}).textContent || el.textContent.trim(), meta: (el.querySelector('.meta') || {}).textContent || '', tag: (el.querySelector('.v') || {}).textContent || '' });
  });
  return { head: card.querySelector('h3').textContent.trim(), text: card.innerText, rows, dir: getComputedStyle(card).direction, htmlDir: document.documentElement.dir, scripts: card.querySelectorAll('script').length, imgs: card.querySelectorAll('img').length };
};
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* =================================================================================== */
async function phaseA() {
  const PORT = 8301, BASE = 'http://localhost:' + PORT;
  start(PORT, { businesses: LEADS.concat(CLIENTS), contacts: [], activities: [], team_directory: ROSTER, app_users: baseUsers() });
  const { browser, p, errors, adminCalls, dialogs, dlg } = await openApp(BASE);
  await signIn(p); await waitReady(p);
  const who = await p.evaluate(() => ({ name: window.__userName, team: window.__TEAM, nick: window.__nickMap && Object.keys(window.__nickMap) }));
  check('A0 signed in as the QA admin and the roster loaded from team_directory', who.name === ME && Array.isArray(who.team) && who.team.length === ROSTER_NAMES.length, who);

  /* ---------------- 1. Your day (EN) ---------------- */
  await p.evaluate((offers) => { DB.offers = offers; current = 'today'; render(); }, OFFERS);
  await p.waitForTimeout(1200);
  const yd = await p.evaluate(readYourDay);
  const find = (t) => (yd && yd.rows.find(r => r.title.indexOf(t) >= 0)) || null;
  check('1a Your-day card rendered for the signed-in user', !!yd && yd.head.indexOf('Your day') >= 0, yd && yd.head);
  check('1b lead with nextActionDate=yesterday shows Overdue under Follow-ups due', find('Overdue Lead Co') && find('Overdue Lead Co').tag === 'Overdue' && /Follow-ups due/.test(find('Overdue Lead Co').section), find('Overdue Lead Co'));
  check('1c lead with nextActionDate=today shows Due', find('Due Today Co') && find('Due Today Co').tag === 'Due', find('Due Today Co'));
  check('1d lead with no activities and no lastContact shows "never contacted" under Going cold', find('Never Contacted Co') && /never contacted/.test(find('Never Contacted Co').meta) && /Going cold/.test(find('Never Contacted Co').section), find('Never Contacted Co'));
  check('1e a Won (unconverted) lead never appears', !find('Won Unconverted Co'));
  check('1f a Lost lead never appears (not in due, not in cold)', !find('Lost Lead Co'));
  check('1g another person\'s overdue lead does not appear', !find('Someone Elses Co'));
  check('1h proposal expiring in 7 days appears', !!find('OFR-QA-7'), yd && yd.rows.map(r => r.title));
  check('1i proposal expiring in 8 days does NOT appear', !find('OFR-QA-8'));
  check('1j accepted proposal and someone else\'s proposal do not appear', !find('OFR-QA-ACC') && !find('OFR-QA-OTH'));
  const txtNoDates = (yd ? yd.text : '').replace(/\d{4}-\d{2}-\d{2}/g, '');
  check('1k card prints NO amount and NO currency (regression)', !/\d{1,3}(,\d{3})+|\b\d{4,}\b/.test(txtNoDates) && !/\bSAR\b|ر\.س|ريال/.test(yd ? yd.text : ''), txtNoDates.slice(0, 200));
  check('1l hostile lead names are escaped on the card (no script/img elements, literal text shown)', yd && yd.scripts === 0 && yd.imgs === 0 && yd.text.indexOf('<script>') >= 0 && yd.text.indexOf('<img src=x') >= 0, yd && { scripts: yd.scripts, imgs: yd.imgs });
  check('1m lead assigned under the signed-in person\'s nickname counts as theirs (same rule as the Mine filters)', find('Alias Owned Co') && find('Alias Owned Co').tag === 'Overdue', find('Alias Owned Co'));
  check('1n proposal owned under the nickname counts as theirs too', !!find('OFR-QA-ALIAS'));

  /* ---------------- 1. Your day (AR) ---------------- */
  await p.evaluate(() => { if (typeof LANG !== 'undefined' && LANG !== 'ar') toggleLang(); });
  await p.waitForTimeout(1200);
  const ya = await p.evaluate(readYourDay);
  const findA = (t) => (ya && ya.rows.find(r => r.title.indexOf(t) >= 0 || r.meta.indexOf(t) >= 0)) || null;
  check('1o Arabic: card header and section labels are Arabic', ya && /يومك/.test(ya.head) && /متابعات مستحقة/.test(ya.text) && /تبرد/.test(ya.text) && /عروض تنتهي/.test(ya.text), ya && ya.head);
  check('1p Arabic: Overdue/Due/never-contacted labels are Arabic', findA('المتأخرة') && findA('المتأخرة').tag === 'متأخرة' && findA('شركة اليوم') && findA('شركة اليوم').tag === 'اليوم' && findA('بلا تواصل') && /لا تواصل بعد/.test(findA('بلا تواصل').meta), ya && ya.rows.slice(0, 4));
  check('1q Arabic: page and card lay out right-to-left', ya && ya.htmlDir === 'rtl' && ya.dir === 'rtl', ya && { htmlDir: ya.htmlDir, dir: ya.dir });
  check('1r Arabic: still no amount/currency on the card', ya && !/\d{1,3}(,\d{3})+|\b\d{4,}\b/.test(ya.text.replace(/\d{4}-\d{2}-\d{2}/g, '')) && !/\bSAR\b|ر\.س|ريال/.test(ya.text));
  const arLiteral = await p.evaluate(() => (document.body.innerText || '').indexOf('عبدالرحمن') >= 0);
  check('8a Arabic Today page shows no hardcoded "عبدالرحمن"', !arLiteral);
  await p.evaluate(() => { if (typeof LANG !== 'undefined' && LANG === 'ar') toggleLang(); });
  await p.waitForTimeout(900);

  /* ---------------- 2. nickname layer ---------------- */
  await go(p, 'today', 1300);
  const greet = await p.evaluate(() => {
    const hub = document.getElementById('v26TodayHub');
    const big = hub ? [...hub.querySelectorAll('div')].find(d => d.children.length === 0 && (d.textContent || '').trim() && /font-size:26px/.test(d.getAttribute('style') || '')) : null;
    const yd = document.querySelector('.v57-yourday h3');
    return { hub: big ? big.textContent.trim() : null, yd: yd ? yd.textContent.trim() : null, footer: (document.querySelector('.side .foot b') || {}).textContent || null };
  });
  check('2a Today greeting uses the nickname, not the full name', greet.hub === ME_NICK && greet.yd && greet.yd.indexOf(ME_NICK) >= 0 && greet.yd.indexOf(ME) < 0, greet);
  check('8b sidebar footer shows the signed-in person (no static "Abdelrahman")', greet.footer === ME || greet.footer === ME_NICK, greet.footer);
  await go(p, 'leads', 1500);
  // wait for js/54's nickname pass to actually run over the owner cells (each localized cell is
  // marked data-nsw, changed or not) so this read is deterministic, not a race with the paint
  await p.waitForFunction(() => document.querySelectorAll('#board table tbody td[data-nsw]').length >= 3, null, { timeout: 8000 }).catch(() => {});
  const owners = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll('#board table tbody tr').forEach(tr => { const nm = tr.querySelector('td b'); if (!nm) return; out[nm.textContent.trim()] = (tr.cells[6] || {}).textContent.trim(); });
    return out;
  });
  check('2b owner with a nickname shows the nickname', owners['Abu Faris Owned Co'] === 'Faris', owners['Abu Faris Owned Co']);
  check('2c owner with an EMPTY nickname falls back to the full name', owners['Blank Nick Owned Co'] === 'Blank Nick', owners['Blank Nick Owned Co']);
  check('2d alias collision: Salem (nickname "Abu Faris") must not be re-mapped through the other person\'s nickname', owners['Salem Owned Co'] === 'Abu Faris', owners['Salem Owned Co']);
  const alias = await p.evaluate(() => ({ canonAbu: ownerCanon('Abu Faris'), canonSalem: ownerCanon('Salem Tester'), canonNick: ownerCanon('QA Nick'), same: sameOwner('Abu Faris', 'Salem Tester'), mine: sameOwner('QA Nick', window.__userName) }));
  check('2e alias index: "Abu Faris" resolves to the person whose full name it is, not to Salem', alias.canonAbu === 'Abu Faris' && alias.same === false, alias);
  check('2f alias index: the signed-in person\'s nickname resolves to them', alias.canonNick === ME && alias.mine === true, alias);
  const teamScreen = await p.evaluate(async () => { v48Users(); await new Promise(r => setTimeout(r, 1200)); const lb = document.getElementById('v48list'); const names = lb ? [...lb.querySelectorAll('.v48-nm b')].map(b => b.textContent.trim()) : []; const rst = lb ? lb.querySelectorAll('[data-rst]').length : -1; const txt = lb ? lb.innerText : ''; return { names, rst, txt }; });
  check('2g Team & Access keeps official names (nickname layer must not rewrite it)', teamScreen.names.indexOf(ME) >= 0 && teamScreen.names.indexOf(ME_NICK) < 0 && teamScreen.names.indexOf('Salem Tester') >= 0, teamScreen.names);
  check('6d admin sees a "Send reset link" button on every row of Team & Access', teamScreen.rst === 3 && /Send reset link/.test(teamScreen.txt), teamScreen.rst);
  // password-length rule on the create form: a 9-character password must be refused with the 10-character message, before any call
  const beforeCreate = adminCalls.filter(c => c.action === 'create').length;
  await p.fill('#v48n', 'New Person'); await p.fill('#v48e', 'new.person@example.com'); await p.fill('#v48pw', 'Abcdefgh9');
  await p.click('#v48create'); await p.waitForTimeout(700);
  const createCalls = adminCalls.filter(c => c.action === 'create').length - beforeCreate;
  const alertMsg = (dialogs.filter(d => d.type === 'alert').slice(-1)[0] || {}).message || '';
  check('6e Team & Access refuses a 9-character password with the 10-character rule, before any network call', createCalls === 0 && /10/.test(alertMsg), { createCalls, alertMsg });
  await p.evaluate(() => { const o = document.getElementById('v48ov'); if (o) o.remove(); });

  /* ---------------- 3. leads list ---------------- */
  await go(p, 'leads', 1200);
  const chipRes = await p.evaluate(async () => {
    const out = [];
    const chips = [...document.querySelectorAll('.v26_3-chips .v26_3-chip')];
    for (const c of chips) {
      c.click(); await new Promise(r => setTimeout(r, 450));
      const f = c.getAttribute('data-filter');
      const rows = [...document.querySelectorAll('#board table tbody tr')].filter(tr => !tr.querySelector('td.empty'));
      const badge = parseInt((c.querySelector('.count') || {}).textContent || '-1', 10);
      const st = b => leadStage(b);
      const expected = DB.businesses.filter(b => !b.isClient).filter(b => f === 'all' ? (!leadFilter.hideClosed || (st(b) !== 'Won' && st(b) !== 'Lost')) : st(b) === f).length;
      const wrongStage = f === 'all' ? 0 : rows.filter(tr => (tr.cells[2] || {}).textContent.trim() !== (f === 'Won' ? 'Client' : f)).length;
      const pg = document.querySelector('#board .pg-bar span'); const m = pg ? (pg.textContent.match(/of\s+(\d+)/) || []) : [];
      out.push({ f, rows: rows.length, badge, expected, wrongStage, pagerTotal: m[1] ? parseInt(m[1], 10) : null });
    }
    return out;
  });
  // Filter correctness (in-lane invariant): clicking a chip shows exactly that stage's leads.
  const filterBad = chipRes.filter(r => r.rows !== r.expected || r.wrongStage);
  check('3a every stage chip filters to exactly its stage and shows exactly that stage\'s leads (' + chipRes.length + ' chips)', chipRes.length >= 6 && filterBad.length === 0, filterBad.length ? filterBad : chipRes.map(r => r.f + ':' + r.rows));
  // Badge vs rows: correct for All + open stages; the Won/Lost badges read 0 while the chip shows leads (out of lane).
  const badgeBad = chipRes.filter(r => r.badge !== r.rows);
  const openBadgeBad = badgeBad.filter(r => r.f !== 'Won' && r.f !== 'Lost');
  check('3a2 the All chip and every OPEN-stage chip badge equals the rows it shows', openBadgeBad.length === 0, openBadgeBad);
  const closedBadgeBad = badgeBad.filter(r => r.f === 'Won' || r.f === 'Lost');
  if (closedBadgeBad.length) report('Leads chip badges: the ' + closedBadgeBad.map(r => r.f + ' badge reads ' + r.badge + ' but clicking it shows ' + r.rows).join(' and ') + '. js/core/core-09-v26.js:1093 (v26_3LeadCount) strips Won/Lost from B before counting whenever hide-closed is on (the default), so a closed-stage chip always reads 0 even though clicking it disables hide-closed (leadTableList, js/core/core-10-v29-reports.js:697) and shows them. Out of my lane (core-09). Proposed: count closed stages before applying hideClosed — e.g. `if(hideClosed && filter!=="Won" && filter!=="Lost"){B=B.filter(...)}` so a stage chip always reports its true total.');
  await p.evaluate(() => { const c = document.querySelector('.v26_3-chip[data-filter="all"]'); if (c) c.click(); leadFilter.hideClosed = false; drawLeads(); });
  await p.fill('#lq', 'شركة البحث'); await p.waitForTimeout(500);
  const search = await p.evaluate(() => [...document.querySelectorAll('#board table tbody tr')].filter(tr => !tr.querySelector('td.empty')).map(tr => tr.querySelector('td b').textContent.trim()));
  check('3b search matches Arabic names (only the matching lead is listed)', search.length === 1 && search[0] === 'Arabic Search Co', search);
  await p.fill('#lq', ''); await p.waitForTimeout(400);
  const errBefore = errors.length;
  await p.evaluate(async () => { for (const k of ['name', 'stage', 'funnel', 'last', 'owner', 'score']) { leadSortBy(k); await new Promise(r => setTimeout(r, 120)); leadSortBy(k); await new Promise(r => setTimeout(r, 120)); } });
  const sortRows = await p.evaluate(() => document.querySelectorAll('#board table tbody tr').length);
  check('3c sorting every column with blank owner/source/last-contact values throws nothing and keeps the rows', errors.length === errBefore && sortRows >= LEADS.length - 3, { errs: errors.slice(errBefore), sortRows });
  const xss = await p.evaluate(() => ({ flag: window.__xss, scripts: document.querySelectorAll('#view script').length, imgs: document.querySelectorAll('#view img[src="x"]').length, literal: [...document.querySelectorAll('#board td b')].some(b => b.textContent.indexOf('<script>') >= 0) }));
  check('3d hostile lead names render escaped in the list (no script/img executed, literal text visible)', xss.flag === undefined && xss.scripts === 0 && xss.imgs === 0 && xss.literal, xss);
  // CSV export of the leads view
  const tableRowsForExport = await p.evaluate(() => [...document.querySelectorAll('#board table tbody tr')].filter(tr => !tr.querySelector('td.empty')).length);
  const [download] = await Promise.all([
    p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Export this view \(CSV\)/.test(x.textContent)); if (!b) throw new Error('no export button'); b.click(); }),
  ]);
  if (!download) check('3e leads CSV export produced a download', false);
  else {
    const tmp = path.join(os.tmpdir(), 'crm-' + Math.random().toString(36).slice(2) + '.csv'); await download.saveAs(tmp);
    const text = fs.readFileSync(tmp, 'utf8').replace(/^﻿/, ''); fs.unlinkSync(tmp);
    const rows = parseCsv(text).filter(r => r.length > 1); const nameCol = rows[0].indexOf('Name');
    const cellFor = (nm) => { const r = rows.slice(1).find(r => r[nameCol] === "'" + nm || r[nameCol] === nm); return r ? r[nameCol] : null; };
    const owasp = ['qa_csv_eq', 'qa_csv_plus', 'qa_csv_at', 'qa_csv_dash', 'qa_csv_tab', 'qa_csv_cr'].map(k => ({ k, cell: cellFor(HOSTILE[k]) }));
    const bad = owasp.filter(x => x.cell !== "'" + HOSTILE[x.k]);
    check('3e CSV export neutralises leading = + @ - tab CR in lead names (6 cells)', nameCol >= 0 && bad.length === 0, bad);
    const lf = cellFor(HOSTILE.qa_csv_lf); const xs = cellFor(XSS1);
    if (lf !== "'" + HOSTILE.qa_csv_lf) report('CSV guard: a name starting with a bare LF is exported unguarded (' + JSON.stringify(lf) + ') — csvGuard() in js/core/core-01-foundation.js:12 guards \\t and \\r but not \\n; Excel does not run a formula from it, so this is a completeness note, not an execution risk.');
    check('3f CSV keeps the <script> name as plain text (quoted, not a formula)', xs === XSS1, xs);
    if (rows.length - 1 !== tableRowsForExport) report('"Export this view (CSV)" exported ' + (rows.length - 1) + ' rows while the table showed ' + tableRowsForExport + ' — js/09-funnels.js:135 filters with matchLead() only, so converted clients are included even though leadTableList() hides them from the view.');
  }

  /* ---------------- 4. quick edit ---------------- */
  await p.evaluate(() => { leadFilter.hideClosed = true; leadFilter.stage = 'all'; drawLeads(); });
  dlg.mode = 'accept';
  const emptyName = await p.evaluate(async () => { editBusiness('qa_due'); await new Promise(r => setTimeout(r, 300)); document.getElementById('f_name').value = '   '; document.getElementById('mSave').click(); await new Promise(r => setTimeout(r, 300)); const open = document.getElementById('ov').classList.contains('show'); const name = getLead('qa_due').name; closeModal(); return { open, name }; });
  const emptyAlert = (dialogs.filter(d => d.type === 'alert').slice(-1)[0] || {}).message || '';
  check('4a saving a lead with an empty name is refused (alert, modal stays open, name unchanged)', emptyName.open && emptyName.name === 'Due Today Co' && /name required/i.test(emptyAlert), { emptyName, emptyAlert });
  const won = await p.evaluate(async () => { leadQuickEdit('qa_due'); await new Promise(r => setTimeout(r, 300)); document.getElementById('qe_stage').value = 'Won'; document.getElementById('mSave').click(); await new Promise(r => setTimeout(r, 700)); const b = getLead('qa_due'); const r = { isClient: b.isClient, stage: leadStage(b), inLeads: leadTableList().some(x => x.id === 'qa_due'), inClients: clientsView().some(x => x.id === 'qa_due'), handover: !!document.getElementById('c_did') }; closeModal(); return r; });
  check('4b quick-edit stage → Won flips isClient and the record moves from Leads to Clients (handover opens)', won.isClient === true && won.stage === 'Won' && !won.inLeads && won.inClients && won.handover, won);
  dlg.mode = 'dismiss';
  const nDialogs = dialogs.length;
  const back1 = await p.evaluate(async () => { leadQuickEdit('qa_due'); await new Promise(r => setTimeout(r, 300)); document.getElementById('qe_stage').value = 'Proposal'; document.getElementById('mSave').click(); await new Promise(r => setTimeout(r, 500)); const b = getLead('qa_due'); return { isClient: b.isClient, stage: leadStage(b) }; });
  const backConfirm = dialogs.slice(nDialogs).find(d => d.type === 'confirm');
  check('4c moving a client back from Won asks first (confirm), and Cancel keeps it a client', !!backConfirm && /currently a client/i.test(backConfirm.message) && back1.isClient === true, { back1, backConfirm });
  if (back1.stage !== 'Won') report('Quick-edit: after Cancel on "move back to leads?" the stage still changed to ' + back1.stage + ' while the record stayed a client — js/core/core-10-v29-reports.js:776 only re-asks while leadStage(b)==="Won", so the next stage edit will never ask again and the record is stuck as client+' + back1.stage + '. Proposed: condition `if(b.isClient&&ns!=="Won")` (drop the leadStage check) and keep `ns=leadStage(b)` on Cancel.');
  const back2 = await p.evaluate(async () => { leadQuickEdit('qa_due'); await new Promise(r => setTimeout(r, 300)); document.getElementById('qe_stage').value = 'Qualified'; document.getElementById('mSave').click(); await new Promise(r => setTimeout(r, 500)); const b = getLead('qa_due'); return { isClient: b.isClient, stage: leadStage(b), asked: false }; });
  const askedAgain = dialogs.slice(nDialogs + 1).some(d => d.type === 'confirm' && /currently a client/i.test(d.message));
  if (!askedAgain && back2.isClient) report('Quick-edit: a second stage change on that stuck record (' + back2.stage + ') did not ask again and silently kept it a client — confirms the dead end above.');
  dlg.mode = 'accept';
  const back3 = await p.evaluate(async () => { const b = getLead('qa_due'); b.stage = 'Won'; b.status = 'Won'; leadQuickEdit('qa_due'); await new Promise(r => setTimeout(r, 300)); document.getElementById('qe_stage').value = 'Proposal'; document.getElementById('mSave').click(); await new Promise(r => setTimeout(r, 500)); const x = getLead('qa_due'); return { isClient: x.isClient, stage: leadStage(x), inLeads: leadTableList().some(y => y.id === 'qa_due') }; });
  check('4d ...and OK moves it back to the pipeline (isClient false, listed under Leads again)', back3.isClient === false && back3.stage === 'Proposal' && back3.inLeads, back3);
  dlg.mode = 'dismiss'; const nd2 = dialogs.length;
  const del1 = await p.evaluate(async () => { editBusiness('qa_over'); await new Promise(r => setTimeout(r, 300)); document.getElementById('mDel').click(); await new Promise(r => setTimeout(r, 400)); return { exists: !!getLead('qa_over') }; });
  const delConfirm = dialogs.slice(nd2).find(d => d.type === 'confirm');
  check('4e Delete asks with confirm() and a "Cancel" answer leaves the company in place', !!delConfirm && /Delete this company/.test(delConfirm.message) && del1.exists === true, { del1, delConfirm });
  dlg.mode = 'accept';
  const del2 = await p.evaluate(async () => { editBusiness('qa_over'); await new Promise(r => setTimeout(r, 300)); document.getElementById('mDel').click(); await new Promise(r => setTimeout(r, 400)); return { exists: !!getLead('qa_over') }; });
  check('4f ...and an "OK" answer removes it', del2.exists === false, del2);

  /* ---------------- 5. clients ---------------- */
  await go(p, 'clients', 1200);
  const mine = await p.evaluate(async () => { clToggleMine(); await new Promise(r => setTimeout(r, 700)); const names = [...document.querySelectorAll('#view table tbody tr[data-client-row]')].map(tr => tr.querySelector('td b').textContent.trim()); const r = { owner: clFilter.owner, names }; clToggleMine(); await new Promise(r => setTimeout(r, 400)); r.after = clFilter.owner; return r; });
  const mineExpected = ['Alias Managed Client', 'Brand New Client', 'Good Client', 'Review Overdue Client', 'Stale Client', 'Watch Client'];
  check('5a Clients "Mine" uses the real signed-in identity (not a hardcoded name) and lists exactly my clients incl. the nickname-managed one', mine.owner === ME && JSON.stringify(mine.names.slice().sort()) === JSON.stringify(mineExpected) && mine.after === 'all', mine);
  const amOpts = await p.evaluate(async () => { leadQuickEdit('qc_mine_good'); await new Promise(r => setTimeout(r, 300)); const am = [...document.querySelectorAll('#qe_am option')].map(o => o.value).filter(Boolean); const ow = [...document.querySelectorAll('#qe_owner option')].map(o => o.value).filter(v => v && v !== '__add__'); closeModal(); return { am, ow }; });
  check('5b account-manager and assigned-to dropdowns list the real roster (active people only), not the hardcoded TEAM list', JSON.stringify(amOpts.am.slice().sort()) === JSON.stringify(ROSTER_NAMES) && JSON.stringify(amOpts.ow.slice().sort()) === JSON.stringify(ROSTER_NAMES), amOpts);
  const risk = await p.evaluate(async () => {
    current = 'clients'; render(); await new Promise(r => setTimeout(r, 900));
    const chip = document.querySelector('.v26_3-chip[data-filter="AtRisk"]'); if (!chip) return { noChip: true };
    chip.click(); await new Promise(r => setTimeout(r, 500));
    const vis = [...document.querySelectorAll('#view table tbody tr[data-client-row]')].filter(tr => tr.style.display !== 'none').map(tr => tr.querySelector('td b').textContent.trim());
    const expected = DB.businesses.filter(b => b.isClient && clientHealth(b).l === 'At risk').map(b => b.name).sort();
    return { vis: vis.sort(), expected, counter: (document.getElementById('cl_kv_count') || {}).textContent };
  });
  check('5c At-risk chip shows exactly the clients whose health is At risk (review overdue or 90+ days silent) and the counter follows', !risk.noChip && JSON.stringify(risk.vis) === JSON.stringify(['Review Overdue Client', 'Stale Client']) && JSON.stringify(risk.expected) === JSON.stringify(risk.vis) && risk.counter === '2', risk);

  /* ---------------- 8. hardcoded-name leftovers seen on screen ---------------- */
  const lit = await p.evaluate(async () => {
    current = 'today'; render(); await new Promise(r => setTimeout(r, 900));
    const queueH = [...document.querySelectorAll('#view h3')].find(h => /My queue/.test(h.textContent));
    const queueVisible = !!(queueH && queueH.offsetParent !== null);
    const bodyHas = (document.body.innerText || '').indexOf('Abdelrahman') >= 0;
    current = 'dashboard'; render(); await new Promise(r => setTimeout(r, 400));
    const dashEn = (document.querySelector('.hero h2') || {}).textContent || '';
    if (typeof LANG !== 'undefined' && LANG !== 'ar') toggleLang(); await new Promise(r => setTimeout(r, 400));
    const dashAr = (document.querySelector('.hero h2') || {}).textContent || '';
    if (typeof LANG !== 'undefined' && LANG === 'ar') toggleLang(); await new Promise(r => setTimeout(r, 300));
    current = 'today'; render();
    return { queueVisible, bodyHas, dashEn, dashAr };
  });
  check('8c Today (EN) shows no "Abdelrahman" anywhere on screen for the QA user', !lit.bodyHas, lit);
  if (lit.queueVisible) report('Today still renders the "My queue" group, which js/core/core-06-v18-v21.js:475 fills with bookings whose queueAssignee is the literal "Abdelrahman" (or blank) — not the signed-in person.');
  if (/عبدالرحمن/.test(lit.dashAr)) report('The old dashboard view (current="dashboard", not in the nav) greets every Arabic user as "عبدالرحمن": js/core/core-08-v25.js:86. EN reads "' + lit.dashEn + '".');

  check('A-end no JavaScript errors during phase A', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

/* =================================================================================== */
async function phaseB_employee() {
  const PORT = 8302, BASE = 'http://localhost:' + PORT;
  const users = baseUsers(); users[0].role = 'team_member';
  start(PORT, { app_users: users });
  const { browser, p, errors } = await openApp(BASE);
  await signIn(p);
  await p.waitForFunction(() => !!window.__userTier && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const nav = [...document.querySelectorAll('#nav button[data-view]')].filter(b => b.style.display !== 'none').map(b => b.getAttribute('data-view'));
    v48Users(); await new Promise(r => setTimeout(r, 1200));
    const lb = document.getElementById('v48list');
    return { tier: window.__userTier, role: window.__userRole, nav, rst: lb ? lb.querySelectorAll('[data-rst]').length : -1, note: lb ? /admin-only/.test(lb.innerText) : false, teamBtn: !!document.getElementById('cl_team') };
  });
  check('6f employee: "Send reset link" is absent from Team & Access (admin-only note shown instead)', r.tier === 'team' && r.rst === 0 && r.note === true, r);
  check('6g employee: no Team button in the top bar', r.teamBtn === false, r);
  report('employee nav (mock, team_member): ' + JSON.stringify(r.nav));
  check('B-end no JavaScript errors during phase B', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

/* =================================================================================== */
async function phaseC_firstLogin() {
  const PORT = 8303, BASE = 'http://localhost:' + PORT;
  const users = baseUsers(); users[0].must_change_password = true;
  start(PORT, { app_users: users });
  const pwlog = async () => (await (await fetch(BASE + '/__pwupdatelog')).json()).length;
  const before = await pwlog();
  const { browser, p, errors } = await openApp(BASE);
  await signIn(p);
  const forced = await p.waitForSelector('#fl_pw1', { timeout: 15000 }).then(() => true).catch(() => false);
  check('6a first login: must_change_password=true forces the "choose your own password" screen', forced);
  if (forced) {
    await p.fill('#fl_pw1', 'Abcdefgh9'); await p.fill('#fl_pw2', 'Abcdefgh9'); await p.click('#fl_go'); await p.waitForTimeout(600);
    const msg = await p.evaluate(() => (document.getElementById('cl_err') || {}).textContent || '');
    const still = await p.evaluate(() => !!document.getElementById('fl_pw1'));
    check('6b first login: a 9-character password is refused with the exact 10-character message, before any network call', still && msg === 'Use at least 10 characters.' && (await pwlog()) === before, { msg, calls: (await pwlog()) - before });
    await p.fill('#fl_pw1', 'Abcdefgh12'); await p.fill('#fl_pw2', 'Abcdefgh13'); await p.click('#fl_go'); await p.waitForTimeout(500);
    const mism = await p.evaluate(() => (document.getElementById('cl_err') || {}).textContent || '');
    check('6b2 first login: a mismatched repeat is refused', mism === 'The two passwords do not match.' && (await pwlog()) === before, mism);
    await p.fill('#fl_pw1', 'Abcdefgh12'); await p.fill('#fl_pw2', 'Abcdefgh12'); await p.click('#fl_go'); await p.waitForTimeout(1500);
    const log = await (await fetch(BASE + '/__pwupdatelog')).json();
    check('6b3 first login: the 10-character password is sent exactly once (length 10, never logged in clear)', log.length === before + 1 && log[log.length - 1].passwordLen === 10 && log[log.length - 1].hadPassword === true && !('password' in log[log.length - 1]), log.slice(-1));
  }
  check('C-end no JavaScript errors during phase C', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

/* =================================================================================== */
async function phaseD_recovery() {
  const PORT = 8304, BASE = 'http://localhost:' + PORT;
  start(PORT, { app_users: baseUsers() });
  const pwlog = async () => (await (await fetch(BASE + '/__pwupdatelog')).json()).length;
  const before = await pwlog();
  const TOKEN = 'header.' + Buffer.from(JSON.stringify({ sub: UID, email: 'test@directksa.com', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
  const { browser, p, errors } = await openApp(BASE, { path: '/today#access_token=' + TOKEN + '&refresh_token=refresh-abc&expires_in=3600&token_type=bearer&type=recovery' });
  const shown = await p.waitForSelector('#rp_pw1', { timeout: 15000 }).then(() => true).catch(() => false);
  check('6c recovery link shows the set-new-password screen', shown);
  if (shown) {
    await p.fill('#rp_pw1', 'Abcdefgh9'); await p.fill('#rp_pw2', 'Abcdefgh9'); await p.click('#rp_go'); await p.waitForTimeout(600);
    const msg = await p.evaluate(() => (document.getElementById('cl_err') || {}).textContent || '');
    check('6c2 recovery: a 9-character password is refused with the exact 10-character message, before any network call', msg === 'Password must be at least 10 characters.' && (await pwlog()) === before, { msg });
    const hint = await p.evaluate(() => (document.body.innerText || '').match(/At least (\d+) characters/) || []);
    check('6c3 recovery: the on-screen hint states the same minimum (10)', hint[1] === '10', hint[0]);
  }
  check('D-end no JavaScript errors during phase D', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

/* =================================================================================== */
async function phaseE_peopleBridge() {
  const PORT = 8305, BASE = 'http://localhost:' + PORT;
  const rowC = (o) => Object.assign({ id: o.id, business_id: 'qa_bridge', name: o.name, role: 'Manager', email: o.email || null, phone: o.phone || null, verification_source: 'manual', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null, meta: {}, source: 'import' });
  start(PORT, {
    businesses: [biz({ id: 'qa_bridge', name: 'Bridge Test Co', raw: { assignedTo: ME, contacts: [{ name: 'Embedded One', email: 'dup@example.com', phone: '0500000001' }] } })],
    contacts: [
      rowC({ id: 'tc_spaced', name: 'Dup By Email', email: '  Dup@Example.COM ', phone: '' }),          // same person, e-mail differs only by case + spaces
      rowC({ id: 'tc_intl', name: 'Dup By Phone', email: '', phone: '+966 50 000 0001' }),               // same person, phone in international format
      rowC({ id: 'tc_clean', name: 'Genuinely New', email: 'new@example.com', phone: '+966500000009' }),
    ],
    activities: [], team_directory: ROSTER, app_users: baseUsers(),
  });
  const { browser, p, errors } = await openApp(BASE);
  await signIn(p);
  // Wait until the bridge has actually ATTACHED something (it attaches on a later cycle than
  // its first fetch — the upstream probe-people-bridge covers timing; here we only read state).
  await p.waitForFunction(() => window.__v72 && window.__v72.contacts >= 1, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => { const b = getLead('qa_bridge'); return { runs: window.__v72 && window.__v72.runs, contacts: (b.contacts || []).map(c => ({ name: c.name, email: c.email, phone: c.phone, fromTable: !!c._fromTable })) }; });
  const names = r.contacts.map(c => c.name);
  check('7a people bridge attached the genuinely new table contact', names.indexOf('Genuinely New') >= 0, r);
  check('7b people bridge: an e-mail that differs only by case and surrounding spaces is recognised as the same person (not doubled)', names.indexOf('Dup By Email') < 0, r);
  if (names.indexOf('Dup By Phone') >= 0) report('People bridge (js/72): the same person is shown twice when the embedded phone is local (0500000001) and the table phone is international (+966 50 000 0001) — dig() compares raw digit strings, so 0500000001 ≠ 966500000001. Normalising both to the 9 significant digits (as pdPhoneId() in core-10 already does) would close it. Report only.');
  else report('People bridge (js/72): local-vs-international phone spelling of one person was de-duplicated.');
  check('E-end no JavaScript errors during phase E', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

/* =================================================================================== */
try {
  await phaseA();
  await phaseB_employee();
  await phaseC_firstLogin();
  await phaseD_recovery();
  await phaseE_peopleBridge();
} catch (e) { console.log('PROBE CRASH: ' + (e && e.stack || e)); RESULTS.push({ name: 'probe ran to completion', ok: false, detail: String(e) }); }
const fails = RESULTS.filter(r => !r.ok);
console.log('\n' + RESULTS.length + ' checks · ' + (RESULTS.length - fails.length) + ' pass · ' + fails.length + ' fail · ' + REPORTS.length + ' report-only notes');
if (fails.length) console.log('FAILED: ' + fails.map(f => f.name).join(' | '));
process.exit(fails.length ? 1 : 0);
