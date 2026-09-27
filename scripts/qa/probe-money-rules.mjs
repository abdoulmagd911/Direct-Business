/* probe-money-rules.mjs (2026-09-27, E — the money rules; DECISIONS D16). Finance → Rules (js/117) driven on the stand-in,
   which models the rules table and the one "what counts" view the way scripts/sql/e-money-rules.sql builds them (the SQL
   itself is tested on Postgres by scripts/qa/phase3 E-01..06). Harness data only, made-up names.

   Under test, as an ADMIN, in English and Arabic:
     1. Finance has a Rules tab with the two cards (Exclusion rules, Company merges) and the greyed Excluded list; the
        harness's seeded name rule is listed with who/when, and the row it catches is in the Excluded list with the rule;
     2. THE SAME TOTAL THREE WAYS before any change: Finance's Revenue tile, the Report Builder's rows (what it exports),
        and the revenue KPI (kpi_actuals) — all equal;
     3. a rule typed on the screen (client ID 12) leaves that client's rows out of all three AT ONCE, by the same amount,
        with no re-import; the Excluded list names the rule;
     4. switching it off brings every figure back; removing it asks first and is final;
     5. a transaction carrying a client ID nobody typed stands alone under "Not merged — review" with its Payments name;
        "Merge into a company…" types it into a company — it leaves the review list, and the totals do not move;
     6. typing the same client ID into a second company is refused in words, and nothing is added;
     7. exclusion beats merge: the company card of a company whose client ID a rule catches warns "Excluded";
     8. Clients & collections shows "Who to chase" with the four age columns;
   as a TEAM MEMBER (Finance on Full, not a manager) —
     9. the Rules tab shows the rules but no add / switch / remove, and a rule sent straight to the database is refused;
   10. no JS errors.
   Sabotage: make js/16 live() ignore FIN.m (return every non-deleted row) — checks 2-4 go red (Finance keeps the
   excluded money while the KPI drops it).
   PORTS 9701 … 9704. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

async function session(role, lang, PORT, finance) {
  process.env.MOCK_ROLE = role; process.env.MOCK_KPI_FROM_MONEY = '1';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', finance: finance || 'full', reports: 'full' });
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { }
    window.__notices = []; document.addEventListener('v63-notice', (ev) => window.__notices.push(ev.detail.text)); }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.v117AddRule === 'function' && (DB.businesses || []).length > 0 && window.__roleKnown === true && window.FIN && FIN.rows && FIN.m, null, { timeout: 150000 });
  await p.waitForTimeout(1500);
  return { p, b, srv, errors, BASE };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };
const tab = async (p, t) => { await p.evaluate((x) => { current = 'finance'; finGo(x); }, t); await p.waitForTimeout(700); };
const reloadFin = async (p) => { await p.evaluate(() => { FIN.rows = null; finLoad(); }); await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }); await p.waitForTimeout(600); };
/* the three readings: the Revenue tile, the Report Builder's (exported) rows, the revenue KPI */
async function three(p) {
  await tab(p, 'overview');
  await p.evaluate(() => { FIN.p = { year: 'all', part: 'all', sector: 'all' }; render(); }); await p.waitForTimeout(500);
  const tile = await p.evaluate(() => { const lab = [...document.querySelectorAll('#view .card div')].find((d) => /^(Revenue|الإيرادات)$/.test(d.textContent.trim()));
    const v = lab && lab.nextElementSibling; return v ? Number(String(v.getAttribute('title') || '').replace(/[^\d.-]/g, '')) : NaN; });
  await tab(p, 'reports'); await p.waitForTimeout(400);
  const rb = await p.evaluate(() => Math.round((FIN._csvRows || []).filter((r) => r.integrity_status === 'verified_paid').reduce((a, r) => a + (Number(r.revenue_sar) || 0), 0) * 100) / 100);
  const kpi = await p.evaluate(async () => { const r = await fc().from('kpi_actuals').select('*').eq('kpi_id', 'kpi-19'); const a = (r.data || []).find((x) => x.scope === 'company' && x.period_id === 'per-2026'); return a ? Number(a.actual) : NaN; });
  return { tile: Math.round(tile * 100) / 100, rb, kpi };
}
const same = (t) => Math.abs(t.tile - t.rb) < 0.01 && Math.abs(t.tile - t.kpi) < 0.01;
const txt = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, sel);
const notices = (p) => p.evaluate(() => (window.__notices || []).join(' | '));

for (const [lang, PORT] of [['en', 9701], ['ar', 9702]]) {
  const L = lang.toUpperCase(), ar = lang === 'ar';
  const s = await session('admin', lang, PORT); const p = s.p;
  /* 1 */
  await tab(p, 'rules');
  const tabLabel = await p.evaluate(() => { const b = [...document.querySelectorAll('#view button')].find((x) => /finGo\('rules'\)/.test(x.getAttribute('onclick') || '')); return b ? b.textContent.trim() : ''; });
  const rulesTxt = await txt(p, '.v117-rules'), mergesOk = await p.evaluate(() => !!document.querySelector('.v117-merges')), exTxt = await txt(p, '.v117-excluded');
  check(tabLabel === (ar ? 'القواعد' : 'Rules') && /Tawthiq Test Services/.test(rulesTxt) && /QA seed/.test(rulesTxt) && mergesOk && /Tawthiq/.test(exTxt) && /verification services/.test(exTxt),
    `${L} 1: a Rules tab with both cards; the seeded rule shows with who; its row sits in the greyed Excluded list with the rule`, tabLabel + ' | ' + rulesTxt.slice(0, 160) + ' | ' + exTxt.slice(0, 160));
  /* 2 */
  const t0 = await three(p);
  check(same(t0) && t0.tile > 0, `${L} 2: the same total three ways before any change — tile ${t0.tile} · Report Builder ${t0.rb} · KPI ${t0.kpi}`, JSON.stringify(t0));
  /* 3 — a rule typed on the screen */
  const cid12 = await p.evaluate(() => Math.round(FIN.rows.filter((r) => !r.deleted_at && r.payments_client_id === '12' && FIN.m[r.id] && FIN.m[r.id].counts).reduce((a, r) => a + (+r.revenue_sar || 0), 0) * 100) / 100);
  await tab(p, 'rules'); await p.click('[data-v117="add-rule"]'); await p.waitForSelector('#v117_kind');
  await p.selectOption('#v117_kind', 'client_id'); await p.fill('#v117_value', ' 12 '); await p.fill('#v117_reason', 'QA: test client'); await p.click('#mSave');
  await p.waitForFunction(() => (MR.rules || []).some((r) => r.value === '12'), null, { timeout: 15000 }).catch(() => { });
  await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }); await p.waitForTimeout(800);
  const t1 = await three(p);
  check(same(t1) && cid12 > 0 && Math.abs(t0.tile - t1.tile - cid12) < 0.01, `${L} 3: a rule on client ID 12 leaves its ${cid12} out of all three at once — tile ${t1.tile} · Report Builder ${t1.rb} · KPI ${t1.kpi}`, JSON.stringify({ t0, t1, cid12 }));
  await tab(p, 'rules'); const ex1 = await txt(p, '.v117-excluded');
  check(/QA: test client/.test(ex1), `${L} 3: the Excluded list names the rule that caught each row`, ex1.slice(0, 200));
  /* 4 — off, back on, removed */
  const rid = await p.evaluate(() => (MR.rules.find((r) => r.value === '12') || {}).id);
  await p.click(`[data-v117-switch="${rid}"]`); await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading && MR.rules && MR.rules.some((r) => r.value === '12' && !r.active), null, { timeout: 30000 }).catch(() => { }); await p.waitForTimeout(800);
  const t2 = await three(p);
  check(same(t2) && Math.abs(t2.tile - t0.tile) < 0.01, `${L} 4: switched off, every figure is back — ${t2.tile} / ${t2.rb} / ${t2.kpi}`, JSON.stringify(t2));
  /* 5 — a client ID nobody typed */
  await p.evaluate(async () => { await fc().from('finance_invoices').insert({ invoice_no: 'QA-LOOSE-1', line_no: 1, client_group: 'Loose Test Co', customer_raw_name: 'Loose Test Co', payments_client_id: '777', invoice_date: '2026-05-10', month: 'May', quarter: 'Q2', year: 2026, total_incl_vat_sar: 4321, wallet_portion_sar: 0, revenue_sar: 4321, cost_sar: 1000, profit_sar: 3321, amount_received_sar: 4321, amount_remaining_sar: 0, integrity_status: 'verified_paid', record_type: 'b2b', revenue_way: 'invoice', source_batch: 'qa' }).select('id'); });
  await reloadFin(p); const t3 = await three(p);
  await tab(p, 'rules'); const loose = await txt(p, '.v117-merges');
  check(/#777/.test(loose) && /Loose Test Co/.test(loose) && Math.abs(t3.tile - t0.tile - 4321) < 0.01 && same(t3), `${L} 5: an untyped client ID stands alone under "Not merged — review" with its Payments name, and counts`, loose.slice(0, 240) + ' | ' + JSON.stringify(t3));
  await p.click('[data-v117-loose="777"] button'); await p.waitForSelector('#v117_biz');
  await p.selectOption('#v117_biz', 'b1'); await p.selectOption('#v117_type', 'tender'); await p.click('#mSave');
  await p.waitForFunction(() => (CP.rows || []).some((x) => x.direct_client_id === '777'), null, { timeout: 15000 }).catch(() => { });
  await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading && FIN.m && Object.values(FIN.m).some((m) => m.merge_state === 'merged' && m.business_id === 'b1'), null, { timeout: 30000 }).catch(() => { });
  const t4 = await three(p); await tab(p, 'rules');
  const merged = await p.evaluate(() => { const row = document.querySelector('[data-v117-company="b1"]'); return { row: row ? row.innerText.replace(/\s+/g, ' ') : '', loose: !!document.querySelector('[data-v117-loose="777"]') }; });
  check(/#777/.test(merged.row) && !merged.loose && Math.abs(t4.tile - t3.tile) < 0.01 && same(t4), `${L} 5: "Merge into a company…" types it in — it leaves the review list, sits under the company, totals unchanged`, JSON.stringify(merged) + ' | ' + JSON.stringify(t4));
  /* 6 — a second company for the same ID */
  const before6 = await p.evaluate(() => CP.rows.length);
  await p.click('[data-v117="add-id"]'); await p.waitForSelector('#v117_biz'); await p.selectOption('#v117_biz', 'b2'); await p.fill('#v117_cid', '777'); await p.click('#mSave'); await p.waitForTimeout(900);
  const n6 = await notices(p), after6 = await p.evaluate(() => CP.rows.length); await p.evaluate(() => { try { closeModal(); } catch (_) { } });
  check(after6 === before6 && (ar ? /مسجّل بالفعل/.test(n6) : /already belongs to/.test(n6)), `${L} 6: the same client ID for a second company is refused in words, nothing added`, n6.slice(-200));
  /* 7 — exclusion beats merge, on the company card */
  await p.evaluate((id) => v117SwitchRule(id, true), rid); await p.waitForTimeout(1500);
  await p.evaluate(() => { const b = DB.businesses.find((x) => (window.__bizUuid ? __bizUuid(x.id) : x.id) === 'b4') || DB.businesses.find((x) => x.id === 'b4'); current = 'leads'; openLead = b.id; render(); });
  await p.waitForFunction(() => { const c = document.querySelector('.v113-card'); return c && !/Loading|جارٍ/.test(c.innerText); }, null, { timeout: 30000 }).catch(() => { }); await p.waitForTimeout(1500);
  const card = await txt(p, '.v113-card');
  check((ar ? /مستبعدة/.test(card) : /Excluded/.test(card)) && /12/.test(card) && /QA: test client/.test(card) && !(ar ? /من 3/.test(card) : /of 3 open/.test(card)),
    `${L} 7: exclusion beats merge — the company card warns that client ID 12 is excluded (and the cap of 3 is gone)`, card.slice(0, 260));
  /* 8 — who to chase */
  await p.evaluate(() => { current = 'finance'; render(); }); await tab(p, 'clients');
  const chase = await txt(p, '.v117-chase');
  check(/0-30/.test(chase) && /31-60/.test(chase) && /61-90/.test(chase) && /90\+/.test(chase), `${L} 8: Clients & collections shows "Who to chase" with the four age columns`, chase.slice(0, 160));
  /* remove, asked first */
  await tab(p, 'rules'); await p.evaluate((id) => v117RemoveRule(id), rid); await p.waitForTimeout(400);
  const asked = await p.evaluate(() => !!document.getElementById('pfConfirmYes'));
  await p.click('#pfConfirmYes').catch(() => { }); await p.waitForTimeout(1500);
  const gone = await p.evaluate(() => !(MR.rules || []).some((r) => r.value === '12'));
  check(asked && gone, `${L} 4: removing a rule asks first, then it is gone from the list`, JSON.stringify({ asked, gone }));
  check(s.errors.length === 0, `${L} 10: no JS errors`, s.errors.slice(0, 3).join(' | '));
  await done(s);
}
/* 9 — a team member with Finance on Full */
{
  const s = await session('team_member', 'en', 9703); const p = s.p;
  await tab(p, 'rules'); await p.waitForTimeout(500);
  const ui = await p.evaluate(() => ({ rules: !!document.querySelector('.v117-rules'), add: !!document.querySelector('[data-v117="add-rule"],[data-v117="add-id"],[data-v117="add-code"]'),
    sw: [...document.querySelectorAll('[data-v117-switch]')].every((x) => x.disabled), seed: /Tawthiq/.test((document.querySelector('.v117-rules') || {}).innerText || '') }));
  const direct = await p.evaluate(async () => { const r = await fc().from('money_exclusion_rules').insert({ kind: 'client_id', value: '99', reason: 'x' }).select('id'); return r.error ? r.error.code || 'err' : 'written'; });
  check(ui.rules && ui.seed && !ui.add && ui.sw && direct !== 'written', '9: a team member sees the rules, with no add / switch / remove, and a rule sent straight to the database is refused', JSON.stringify(ui) + ' · ' + direct);
  check(s.errors.length === 0, '10: no JS errors (team member)', s.errors.slice(0, 3).join(' | '));
  await done(s);
}
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — the money rules: one view, three readings, typed merges, exclusion beats merge');
process.exit(failures ? 1 : 0);
