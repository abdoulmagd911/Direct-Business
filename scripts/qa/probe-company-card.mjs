/* probe-company-card.mjs (2026-09-26, Phase 3 release 4) — the company card on a client's page (js/113).

   The stand-in models company_documents / company_discount_codes / promo_codes / the company-docs store and the
   client-ID rules with the release's rules (scripts/sql/phase3-r4-company-card.sql; tested on Postgres by
   scripts/qa/phase3 R4-01..08). Under test, in English and Arabic:
   as an employee with Full control of Clients —
     1. the card shows the company's client IDs with their type, "N of 3 open", each linking OUT to Direct Payments;
     2. adding a 3rd ID works; the card then says 3 is the most and offers no more; an ID another company holds is
        refused in words ("already belongs to a company"), nothing added;
     3. linking a discount code shows it with its value and status and the B2C note; removing it takes it off;
     4. adding a CR file shows it (named, openable through a signed link); removing it puts "Missing" back;
     5. adding an IBAN letter works, and the card shows it only as "🔒 On file — managers and admins only" with no link;
   as a manager — 6. the IBAN letter is a link that opens;
   as someone on VIEW for Clients — 7. the card shows, with no add / link / remove button at all;
   8. in Arabic the card speaks Arabic; 9. no JS errors.
   Sabotage: make js/113's canWrite() answer true — check 7 goes red.
   PORTS 9501 … 9506 (free when written).                                                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function session(role, clients, lang, PORT) {
  process.env.MOCK_ROLE = role; process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients, documents: 'view' });
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq)); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } }); const p = await ctx.newPage();
  const errors = [], alerts = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { alerts.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { }
    window.__notices = []; document.addEventListener('v63-notice', (ev) => window.__notices.push(ev.detail.text)); }, lang);   /* the app's alerts are in-page notices (js/63) */
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.v113Upload === 'function' && (DB.businesses || []).length > 0 && window.__pageLevels, { timeout: 120000 }); await p.waitForTimeout(1500);
  const open = async (bizRow) => { await p.evaluate((rid) => { const b = DB.businesses.find((x) => (window.__bizUuid ? window.__bizUuid(x.id) : x.id) === rid) || DB.businesses.find((x) => x.id === rid);
      current = 'leads'; openLead = b.id; render(); }, bizRow);
    await p.waitForFunction(() => { const c = document.querySelector('.v113-card'); return c && !/Loading|جارٍ/.test(c.innerText); }, { timeout: 30000 }).catch(() => { }); await p.waitForTimeout(300); };
  const card = () => p.evaluate(() => { const c = document.querySelector('.v113-card'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
  const has = (sel) => p.evaluate((s) => !!document.querySelector('.v113-card ' + s), sel);
  const modalSave = async () => { await p.click('#mSave'); await p.waitForTimeout(900); };
  return { p, b, srv, errors, alerts, open, card, has, modalSave, ctx };
}
const done = async (s) => { await s.b.close(); s.srv.close?.(); };

for (const [lang, base] of [['en', 9501], ['ar', 9504]]) {
  const L = lang.toUpperCase(); const ar = lang === 'ar';
  /* ---------------- an employee with Full control of Clients ---------------- */
  let s = await session('team_member', 'full', lang, base);
  await s.open('b4');
  let t = await s.card();
  const pdHref = await s.p.evaluate(() => [...document.querySelectorAll('.v113-card a.chiplink')].map((a) => a.href));
  check(/#12/.test(t) && /#13/.test(t) && (ar ? /2 من 3/.test(t) : /2 of 3 open/.test(t)) && pdHref.length === 2 && pdHref.every((h) => /payments\.directksa\.com/.test(h)),
    `${L} 1: the card shows both client IDs, "2 of 3 open", each linking out to Direct Payments`, t.slice(0, 200) + ' | ' + pdHref.join(' '));
  await s.p.click('.v113-card .v113-add-id'); await s.p.waitForSelector('#cp_id'); await s.p.fill('#cp_id', 'QA-777'); await s.p.selectOption('#cp_type', 'tender'); await s.modalSave();
  await s.p.waitForTimeout(800); await s.open('b4'); t = await s.card();
  check(/#QA-777/.test(t) && (ar ? /3 من 3/.test(t) : /3 of 3 open/.test(t)) && !(await s.has('.v113-add-id')), `${L} 2a: a 3rd ID is added; the card says 3 is the most and offers no more`, t.slice(0, 220));
  await s.open('b0'); await s.p.click('.v113-card .v113-add-id'); await s.p.waitForSelector('#cp_id'); await s.p.fill('#cp_id', '12'); await s.modalSave();
  let dupSaid = '';
  for (let i = 0; i < 30 && !dupSaid; i++) { await s.p.waitForTimeout(200); dupSaid = await s.p.evaluate(() => window.__notices.join(' | ')); }   /* the refusal comes back from the database */
  const b0ids = await s.p.evaluate(() => (window.CP.byBiz['b0'] || []).map((x) => x.direct_client_id).join(','));
  check((ar ? /مسجّل لشركة أخرى/ : /already belongs to a company/).test(dupSaid) && b0ids === '95', `${L} 2b: an ID another company holds is refused in words, nothing added`, dupSaid + ' | b0 holds ' + b0ids);
  try { await s.p.evaluate(() => { closeModal(); const n = document.getElementById('v63Notice'); if (n) n.remove(); }); } catch (_) { }
  /* discount code */
  await s.open('b4'); await s.p.click('.v113-card .v113-link'); await s.p.waitForSelector('#v113_code');
  await s.p.selectOption('#v113_code', 'pc0'); await s.p.fill('#v113_note', 'staff leisure'); await s.modalSave(); await s.p.waitForTimeout(600);
  t = await s.card();
  check(/B2C-SUMMER10/.test(t) && /10%/.test(t) && (ar ? /فعّال/ : /active/).test(t) && (ar ? /ليست من مالية الشركة/ : /not part of this company's B2B finance/).test(t), `${L} 3a: a linked discount code shows its value, status and the B2C note`, t.slice(0, 300));
  await s.p.click('.v113-card .v113-unlink'); await s.p.waitForTimeout(300);
  await s.p.click('#pfConfirmYes');   /* the app's own "are you sure?" box */
  await s.p.waitForTimeout(900); t = await s.card();
  check(!/B2C-SUMMER10/.test(t), `${L} 3b: removing the link takes the code off the card`, t.slice(0, 200));
  /* a CR file */
  await s.p.click('.v113-card .v113-upload'); await s.p.waitForSelector('#v113_file');
  await s.p.selectOption('#v113_type', 'cr'); await s.p.setInputFiles('#v113_file', { name: 'cr-2026.pdf', mimeType: 'application/pdf', buffer: PDF }); await s.modalSave(); await s.p.waitForTimeout(900);
  t = await s.card();
  const crLink = await s.p.evaluate(() => { const r = document.querySelector('.v113-doc[data-type="cr"] a'); return r ? r.innerText : null; });
  /* the new tab is pointed at the signed link the store hands back — the link is what is checked */
  const signed = []; s.p.on('request', (r) => { if (/\/object\/sign\/company-docs\//.test(r.url())) signed.push(r.url()); });
  const [pop] = await Promise.all([s.ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null), s.p.click('.v113-doc[data-type="cr"] a').catch(() => null)]);
  await s.p.waitForTimeout(1200); const popUrl = signed.join(' '); if (pop) await pop.close().catch(() => { });
  check(crLink === 'cr-2026.pdf' && /sign\/company-docs\//.test(popUrl), `${L} 4a: an added CR shows by name and opens through a signed link`, crLink + ' | ' + popUrl);
  await s.p.click('.v113-doc[data-type="cr"] .v113-remove'); await s.p.waitForTimeout(300);
  await s.p.click('#pfConfirmYes');
  await s.p.waitForTimeout(900);
  const crRow = await s.p.evaluate(() => { const r = document.querySelector('.v113-doc[data-type="cr"]'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; });
  check((ar ? /غير موجود/ : /Missing/).test(crRow), `${L} 4b: removing it puts "Missing" back`, crRow);
  /* an IBAN letter — added, but not openable by an employee */
  await s.p.click('.v113-card .v113-upload'); await s.p.waitForSelector('#v113_file');
  await s.p.selectOption('#v113_type', 'iban'); await s.p.setInputFiles('#v113_file', { name: 'iban.pdf', mimeType: 'application/pdf', buffer: PDF }); await s.modalSave(); await s.p.waitForTimeout(900);
  const ibanRow = await s.p.evaluate(() => { const r = document.querySelector('.v113-doc[data-type="iban"]'); return r ? { t: r.innerText.replace(/\s+/g, ' '), links: r.querySelectorAll('a').length } : null; });
  check(ibanRow && (ar ? /محفوظ \(1\)/ : /On file \(1\)/).test(ibanRow.t) && (ar ? /للمديرين/ : /managers and admins only/).test(ibanRow.t) && ibanRow.links === 0, `${L} 5: an employee adds an IBAN letter; it shows as "🔒 On file — managers and admins only", no link`, JSON.stringify(ibanRow));
  const stored = await s.p.evaluate(() => (window.__v113.state['b4'] || {}).presence);
  check(s.errors.length === 0, `${L} 9a: no JS errors (employee)`, s.errors.slice(0, 2).join(' | '));
  await done(s);

  /* ---------------- a manager opens a money file (fresh store: one IBAN letter written by the manager) ---------------- */
  s = await session('manager', 'full', lang, base + 1);
  await s.open('b4'); await s.p.click('.v113-card .v113-upload'); await s.p.waitForSelector('#v113_file');
  await s.p.selectOption('#v113_type', 'iban'); await s.p.setInputFiles('#v113_file', { name: 'iban-mgr.pdf', mimeType: 'application/pdf', buffer: PDF }); await s.modalSave(); await s.p.waitForTimeout(900);
  const mgrIban = await s.p.evaluate(() => { const a = document.querySelector('.v113-doc[data-type="iban"] a'); return a ? a.innerText : null; });
  check(mgrIban === 'iban-mgr.pdf', `${L} 6: a manager sees the IBAN letter as a link to open`, String(mgrIban));
  check(s.errors.length === 0, `${L} 9b: no JS errors (manager)`, s.errors.slice(0, 2).join(' | '));
  await done(s);

  /* ---------------- View on Clients ---------------- */
  s = await session('team_member', 'view', lang, base + 2);
  await s.open('b4'); t = await s.card();
  const btns = await s.p.evaluate(() => document.querySelectorAll('.v113-card button').length);
  check(t.length > 20 && btns === 0 && /#12/.test(t), `${L} 7: on View the card shows, with no add / link / remove button`, `${btns} buttons · ${t.slice(0, 120)}`);
  if (ar) { const title = await s.p.evaluate(() => (document.querySelector('.v113-card .v113-title') || {}).innerText); check(title === 'بطاقة الشركة' && /معرّفات العميل/.test(t) && /رموز الخصم/.test(t) && /ملفات الشركة/.test(t), `AR 8: the card speaks Arabic`, t.slice(0, 200)); }
  check(s.errors.length === 0, `${L} 9c: no JS errors (View)`, s.errors.slice(0, 2).join(' | '));
  await done(s);
}
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — the company card: IDs linked out, codes linked, files kept, money files for managers, View only looks');
process.exit(failures ? 1 : 0);
