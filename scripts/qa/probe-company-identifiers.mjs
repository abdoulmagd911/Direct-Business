/* probe-company-identifiers.mjs (2026-09-28) — D27, company identifiers and automatic matching, driven in the browser on the
   stand-in, which matches every money row through the identifiers the way scripts/sql/company-identifiers.sql does (the SQL
   itself: phase3 IDN-01…11). Made-up companies, emails and amounts only (rule 7).

   As an ADMIN, in English and Arabic:
     1. Finance → Rules has the "Company identifiers" card; a row carrying only an email waits under "Needs a decision" as an
        EMAIL entry (its strongest detail), with its amount;
     2. "Belongs to" company A adds that email to A's identifiers (a decision) — the row leaves the list and sits under A at
        once (live, nothing stamped on the row), and the card lists it under A;
     3. on A's company card the Identifiers section lists it; a name typed there in one Arabic spelling ("مدد الذكية") picks
        up a row written in another ("شركة مـدد الذكيّة");
     4. removing the email on the card asks in the app's own box, naming it; the row is unmatched at once and waits again;
        putting it back matches it again;
     5. a row two companies claim (its two names are held by A and by B) waits as "two companies", naming both with the
        identifiers that collide; removing the wrong one places the row under the other — nothing is guessed;
     6. the form refuses a Direct staff email and an identifier another company holds, in words, and adds nothing;
     7. (Arabic) the card, the Rules card and the list read Arabic;
   as a TEAM MEMBER with Finance on Full (not a manager):
     8. no add or remove controls, and an identifier sent straight to the database is refused;
     9. no JS error.
   Sabotage (SABOTAGE=A|B|C|D swaps in a broken layer; each run 28 Sep, each caught):
     A  js/117 groups a waiting row by its name even when it carries an email   → 1–4 red
     B  js/113 still draws the old client-ID and code sections                  → 3, 4, 7 red
     C  js/117's "Belongs to" always adds a NAME, whatever the row carries       → 2, 4 red
     D  js/117 treats a row two companies claim like any other waiting row      → 5 red
   PORTS 9881 … 9883. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SAB = process.env.SABOTAGE || '';
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

async function session(role, lang, PORT, finance) {
  process.env.MOCK_ROLE = role; delete process.env.MOCK_KPI_FROM_MONEY;
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', finance: finance || 'full', reports: 'full' });
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } }); const p = await ctx.newPage();
  const errors = [], dialogs = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { }
    window.__notices = []; document.addEventListener('v63-notice', (ev) => window.__notices.push(ev.detail.text)); }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  const swap = (file, fn) => p.route((u) => u.pathname === '/js/' + file, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fn(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8')) }));
  if (SAB === 'A') await swap('117-money-rules.js', (s) => s.replace("else if(em&&!window.identIsStaffEmail(em)){ k='email'; val=em.toLowerCase(); }", ''));
  if (SAB === 'B') await swap('113-company-card.js', (s) => s.replace("(typeof window.v123CardSection==='function'?window.v123CardSection(biz):", "(false?0:"));
  if (SAB === 'C') await swap('117-money-rules.js', (s) => s.replace("var ik=kind==='vat_cr'?(type==='cr'?'cr':'vat'):kind;", "var ik='name';"));
  if (SAB === 'D') await swap('117-money-rules.js', (s) => s.replace('        if(l.conflict) return conflictRow(l,ix);', ''));
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.v117AddRule === 'function' && typeof window.identAdd === 'function' && (DB.businesses || []).length > 1 && window.__roleKnown === true && window.FIN && FIN.rows && FIN.m, null, { timeout: 150000 });
  await p.waitForTimeout(1200);
  return { p, b, srv, errors, dialogs };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };
const tab = async (p, t) => { await p.evaluate((x) => { current = 'finance'; finGo(x); }, t); await p.waitForTimeout(700); };
const settle = async (p) => { await p.waitForFunction(() => MR && MR.idents && !MR.loading && FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }).catch(() => { }); await p.waitForTimeout(900); };
const refresh = async (p) => { await p.evaluate(() => { if (window.v117RefreshAll) v117RefreshAll(); }); await settle(p); };
const row = (p, no) => p.evaluate(async (n) => { const r = await fc().from('money_rows').select('invoice_no,business_id,match_state,match_level').eq('invoice_no', n); return (r.data || [])[0] || null; }, no);
const idents = (p) => p.evaluate(async () => { const r = await fc().from('company_identifiers').select('*'); return r.data || []; });
const openCard = async (p, biz) => { await p.evaluate((u) => { const b = DB.businesses.find((x) => (window.__bizUuid ? window.__bizUuid(x.id) : x.id) === u); current = 'leads'; openLead = b.id; render(); }, biz);
  await p.waitForFunction(() => { const c = document.querySelector('.v113-card'); return c && !/Loading|جارٍ/.test(c.innerText); }, null, { timeout: 30000 }).catch(() => { }); await p.waitForTimeout(500); };
const cardTxt = (p) => p.evaluate(() => { const c = document.querySelector('.v113-card [data-sec="identifiers"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
const addInForm = async (p, kind, value) => { if (!(await p.waitForSelector('#v123_kind', { timeout: 8000 }).then(() => true).catch(() => false))) return false;
  await p.selectOption('#v123_kind', kind); await p.fill('#v123_value', value); await p.click('#mSave'); await p.waitForTimeout(900); return true; };

for (const [lang, PORT] of [['en', 9881], ['ar', 9882]]) {
  const L = lang.toUpperCase(), ar = lang === 'ar';
  console.log(`— ${L} · an admin —`);
  const s = await session('admin', lang, PORT); const p = s.p;
  const [A, B] = await p.evaluate(() => DB.businesses.filter((b) => !b.archived && !b.archivedAt).slice(0, 2).map((b) => (window.__bizUuid ? window.__bizUuid(b.id) : b.id)));
  await p.evaluate(async () => { const base = { line_no: 1, invoice_date: '2026-07-10', integrity_status: 'verified_paid', revenue_way: 'invoice', source: 'import', row_kind: 'sale', payments_status: 'Fully Paid' };
    const rows = [Object.assign({ invoice_no: 'QA-ID-1', client_group: 'QA Ident Buyer', customer_raw_name: 'QA Ident Buyer', customer_email: 'buyer@qa-ident.test', total_incl_vat_sar: 1000, revenue_sar: 1000 }, base),
      Object.assign({ invoice_no: 'QA-ID-2', client_group: 'شركة مـدد الذكيّة', customer_raw_name: 'شركة مـدد الذكيّة', total_incl_vat_sar: 500, revenue_sar: 500 }, base),
      Object.assign({ invoice_no: 'QA-ID-3', client_group: 'QA Twin One', customer_raw_name: 'QA Twin Two', total_incl_vat_sar: 300, revenue_sar: 300 }, base)];
    await fc().from('finance_invoices').insert(rows).select('id'); FIN.rows = null; finLoad(); });
  await refresh(p);
  /* 1 */
  await tab(p, 'rules');
  const card1 = await p.evaluate(() => !!document.querySelector('.v117-idents'));
  const e1 = await p.evaluate(() => { const r = document.querySelector('[data-v117-loose="buyer@qa-ident.test"]'); return r ? { kind: r.getAttribute('data-v117-kind'), t: r.innerText.replace(/\s+/g, ' ') } : null; });
  check(card1 && e1 && e1.kind === 'email' && /1,000/.test(e1.t), `${L} 1: the Company identifiers card; the email-only row waits under Needs a decision as an EMAIL entry with its amount`, JSON.stringify({ card1, e1 }));
  /* 2 */
  const ix = await p.evaluate(() => { const r = document.querySelector('[data-v117-loose="buyer@qa-ident.test"]'); const sel = r && r.querySelector('select[id^="v117_d"]'); return sel ? sel.id.replace('v117_d', '') : null; });
  if (ix != null) { await p.selectOption('#v117_d' + ix, A); await p.click(`[data-v117-loose="buyer@qa-ident.test"] [data-v117-decide="belongs"]`); }
  await settle(p);
  const r2 = await row(p, 'QA-ID-1'), id2 = (await idents(p)).find((x) => x.value === 'buyer@qa-ident.test');
  const gone2 = await p.evaluate(() => !document.querySelector('[data-v117-loose="buyer@qa-ident.test"]'));
  const listed2 = await p.evaluate((a) => { const r = document.querySelector(`.v117-idents [data-v117-company="${a}"]`); return r ? r.innerText : ''; }, A);
  check(r2 && r2.business_id === A && r2.match_level === 'email' && id2 && id2.kind === 'email' && id2.source === 'decision' && id2.business_id === A && gone2 && /buyer@qa-ident\.test/.test(listed2),
    `${L} 2: "Belongs to" adds the EMAIL to A (a decision) — the row sits under A at once, leaves the list, and the card lists it`, JSON.stringify({ r2, id2: id2 && [id2.kind, id2.source, id2.business_id === A], gone2 }));
  /* 3 */
  await openCard(p, A);
  const c3 = await cardTxt(p);
  await p.click('.v113-card .v123-add', { timeout: 8000 }).catch(() => { }); const added3 = await addInForm(p, 'name', 'مدد الذكية');
  await refresh(p); await openCard(p, A);
  const r3 = await row(p, 'QA-ID-2'), c3b = await cardTxt(p);
  check(added3 && /buyer@qa-ident\.test/.test(c3) && r3 && r3.business_id === A && r3.match_level === 'name' && /مدد الذكية/.test(c3b),
    `${L} 3: A's card lists the email under Identifiers; a name typed in one Arabic spelling picks up the row written in another`, JSON.stringify({ c3: c3.slice(0, 160), r3 }));
  /* 4 */
  const eid = id2 && id2.id;
  await p.click(`.v113-card [data-v123-remove="${eid}"]`, { timeout: 8000 }).catch(() => { });
  const box = await p.waitForSelector('#pfConfirmYes', { timeout: 8000 }).then(() => true).catch(() => false);
  const boxTxt = await p.evaluate(() => { const m = document.querySelector('#pfConfirmBox'); return m ? m.innerText.replace(/\s+/g, ' ').slice(0, 400) : ''; });
  if (box) await p.click('#pfConfirmYes');
  await refresh(p);
  const r4a = await row(p, 'QA-ID-1');
  await openCard(p, A); await p.click(`.v113-card [data-v123-putback="${eid}"]`, { timeout: 8000 }).catch(() => { }); await refresh(p);
  const r4b = await row(p, 'QA-ID-1');
  check(box && /buyer@qa-ident\.test/.test(boxTxt) && r4a && r4a.business_id == null && r4a.match_state === 'none' && r4b && r4b.business_id === A,
    `${L} 4: removing the email asks in the app's box naming it; the row is unmatched at once; putting it back matches it again`, JSON.stringify({ box, r4a, r4b }));
  /* 5 */
  await p.evaluate(({ a, b }) => new Promise((ok) => { identAdd(a, 'name', 'QA Twin One', {}, () => identAdd(b, 'name', 'QA Twin Two', {}, ok)); }), { a: A, b: B });
  await refresh(p); await tab(p, 'rules');
  const c5 = await p.evaluate(() => { const r = [...document.querySelectorAll('[data-v117-conflict]')].find((x) => /QA Twin/.test(x.innerText)); return r ? { t: r.innerText.replace(/\s+/g, ' '), n: r.querySelectorAll('[data-v117-conflict-ident]').length } : null; });
  const r5a = await row(p, 'QA-ID-3');
  const bTwin = (await idents(p)).find((x) => x.value === 'QA Twin Two' && !x.removed_at);
  await p.evaluate((id) => identRemove(id), bTwin && bTwin.id); await p.click('#pfConfirmYes', { timeout: 8000 }).catch(() => { }); await refresh(p);
  const r5b = await row(p, 'QA-ID-3');
  check(c5 && c5.n === 2 && r5a && r5a.match_state === 'conflict' && r5a.business_id == null && r5b && r5b.business_id === A,
    `${L} 5: a row two companies claim waits as "two companies", naming both identifiers; removing the wrong one places it under the other`, JSON.stringify({ c5, r5a, r5b }));
  /* 6 */
  const nBefore = (await idents(p)).length; s.dialogs.length = 0; await p.evaluate(() => { window.__notices = []; });
  await p.evaluate((a) => { identAdd(a, 'email', 'someone@directksa.com'); identAdd(a, 'name', 'QA Twin One'); }, B); await p.waitForTimeout(800);
  const nAfter = (await idents(p)).length, said = s.dialogs.concat(await p.evaluate(() => window.__notices || [])).join(' | ');
  check(nAfter === nBefore && (ar ? /موظفي دايركت/.test(said) : /staff email/.test(said)) && (ar ? /مسجّل بالفعل/.test(said) : /already belongs to/.test(said)),
    `${L} 6: the form refuses a staff email and an identifier another company holds, in words; nothing is added`, said.slice(0, 240));
  /* 7 */
  if (ar) { await tab(p, 'rules'); const t7 = await p.evaluate(() => (document.querySelector('.v117-idents') || {}).innerText || ''); await openCard(p, A); const c7 = await cardTxt(p);
    check(/معرّفات الشركات/.test(t7) && /المعرّفات/.test(c7) && !/Identifiers|Add an identifier/.test(c7), `${L} 7: the Rules card and the card's section read Arabic`, (t7.slice(0, 80) + ' | ' + c7.slice(0, 80))); }
  check(s.errors.length === 0, `${L} 9: no JS error`, JSON.stringify(s.errors.slice(0, 3)));
  await done(s);
}
{
  console.log('— a team member with Finance on Full (not a manager) —');
  const s = await session('team_member', 'en', 9883); const p = s.p;
  const A = await p.evaluate(() => (window.__bizUuid ? window.__bizUuid(DB.businesses[0].id) : DB.businesses[0].id));
  await tab(p, 'rules'); const ctl = await p.evaluate(() => ({ add: !!document.querySelector('[data-v117="add-ident"]'), rm: !!document.querySelector('.v117-idents button') }));
  await openCard(p, A); const cardCtl = await p.evaluate(() => !!document.querySelector('.v113-card .v123-add'));
  const direct = await p.evaluate(async (a) => { const r = await fc().from('company_identifiers').insert({ business_id: a, kind: 'name', value: 'Team Member Name' }).select('id'); return r.error ? String(r.error.message) : 'WROTE'; }, A);
  check(!ctl.add && !ctl.rm && !cardCtl && /row-level security/.test(direct), '8: a team member sees no add or remove control, and a direct write is refused', JSON.stringify({ ctl, cardCtl, direct }));
  check(s.errors.length === 0, '9: no JS error (team member)', JSON.stringify(s.errors.slice(0, 3)));
  await done(s);
}
console.log(failures ? `\nFAILED — ${failures} check(s) did not pass.` + (SAB ? ' (sabotage ' + SAB + ')' : '') : '\ncompany identifiers OK' + (SAB ? ' — but this was sabotage ' + SAB + ', which should have failed' : ''));
process.exit(failures ? 1 : 0);
