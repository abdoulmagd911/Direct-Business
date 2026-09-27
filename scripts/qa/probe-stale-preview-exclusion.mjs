/* probe-stale-preview-exclusion.mjs (2026-09-07, watch cycle 42; REWRITTEN for E, 2026-09-27) — a
   client ruled out between the preview and the Confirm must not be counted. Attack area (oo).

   E (2026-09-27, DECISIONS D16): until E the importer skipped an excluded client's rows, so this
   probe held the COMMIT to re-reading the exclusion list as it stood at the moment of writing,
   because the preview's decision could be stale. Under E a row a rule catches IS imported (so
   switching the rule off brings it back with no re-import), and the database view money_rows
   decides on every READ which rows are left out. The staleness this probe was written against
   cannot reach a total any more — a rule applies to whatever is stored, whenever it was stored —
   and that is exactly what it now proves, with the same ordinary-Tuesday sequence: a file is
   previewed, someone rules a partner out (as a typed NAME rule, in money_exclusion_rules, from the
   page's own session, with the page's copy of the rules left stale), the file is confirmed.

   Under test:
     1. Control — the standing rule's client is imported AND left out: the view marks it excluded
        and Finance counts only the ordinary row. (If this fails, nothing below means anything.)
     2. Setup — the preview sorted the late client as ordinary and the page still thinks so at
        Confirm, so only the server knows.
     3. THE ATTACK FAILS — the late client's invoice is stored (D16: that is what lets the rule be
        switched off later) but the view marks it excluded BY THE LATE RULE, and Finance counts the
        two ordinary rows only.
     4. The import summary, read back from the view after the write, says the late client was left
        out by that rule — the person is told what the database made of the file, not what the
        stale preview promised.
     5. Finance → Rules lists it under Excluded with the late rule and its reason.
     6. Retroactive both ways, with nothing re-imported: switching the late rule OFF brings its
        777,000 back into Finance; switching it back ON takes it out again.

   Run:  node scripts/qa/probe-stale-preview-exclusion.mjs        (port 8718)
   Sabotage: SABOTAGE=1 serves js/16 to the browser with live()'s excluded-row filter removed (the
   file on disk is untouched) — checks 1, 3 and 6 go red with the partner's 777,000 counted.     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8718;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const EXCLUDED = 'Tawthiq Test Services';   // the mock seed's standing exclusion
/* The client nobody has ruled out yet. It is ordinary while the file is previewed, and excluded
   by the time Confirm is pressed — which is the whole attack. */
const LATE = 'Late Ruling Partner Co';

const srv = start(PORT, { finance_invoices: [] });
/* held true only for the attack page's boot — released between its preview and its Confirm */

const BASE = 'http://localhost:' + PORT;

/* The real Direct Payments invoice-export signature. Cycle 28's lesson, met again in cycle 41:
   invented column names make the importer answer "not recognized", no preview runs, and a check
   then passes having exercised nothing. */
const HEAD = 'Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman';
const csvFor = (n, who) => [HEAD,
  'invoice,Direct Flights,' + who + ',REF-S' + n + ',SX-' + n + '1,05/08/2026 10:00:00 AM,Fully Paid,,,,,777000,Riyadh,QA',
  'item,Direct Flights,' + who + ',REF-S' + n + ',,,,Partner work,No,0,777000,,,',
  'invoice,Direct Hotels,Ordinary Client Co,REF-N' + n + ',NM-' + n + '2,06/08/2026 10:00:00 AM,Fully Paid,,,,,1500,Riyadh,QA',
  'item,Direct Hotels,Ordinary Client Co,REF-N' + n + ',,,,Ordinary work,No,0,1500,,,'
].join('\n');

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  let p = await ctx.newPage();
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());
  const wire = async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  };
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), wire);
  if (process.env.SABOTAGE) await p.route((u) => u.pathname === '/js/16-finance-ledger.js', async (r) => {
    const src = fs.readFileSync(new URL('../../js/16-finance-ledger.js', import.meta.url), 'utf8');
    const cut = src.replace('return !(m&&m.excluded); });', 'return true; });');
    if (cut === src) console.log('  ! sabotage did not apply — the line moved');
    await r.fulfill({ status: 200, contentType: 'application/javascript', body: cut });
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  try { await p.waitForFunction(() => typeof window.v65Commit === 'function', { timeout: 90000 }); } catch (_) { }
  await p.evaluate(() => { try { current = 'finance'; render(); } catch (_) { } });
  /* wait for the fact this probe depends on: the typed rules in the page (finExclusionCheck answers from them) */
  await p.waitForFunction((n) => { try { return !!(window.MR && MR.rules && finExclusionCheck(n)); } catch (_) { return false; } }, EXCLUDED, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(1200);

  const invoicesInDb = async () => (await fetch(BASE + '/rest/v1/finance_invoices?select=invoice_no,client_group,total_incl_vat_sar').then((r) => r.json())) || [];
  const viewRow = async (inv) => ((await fetch(BASE + '/rest/v1/money_rows?select=invoice_no,excluded,counts,rule_id,rule_kind,rule_value&invoice_no=eq.' + encodeURIComponent(inv)).then((r) => r.json())) || [])[0] || null;
  const reloadFin = async () => {
    await p.evaluate(() => { try { FIN.loading = false; FIN.rows = null; finLoad(); } catch (_) { } });
    try { await p.waitForFunction(() => window.FIN && FIN.rows != null, null, { timeout: 30000 }); } catch (_) { }
    await p.waitForTimeout(400);
  };
  const counted = async () => p.evaluate(() => { try { return (finLive() || []).map((r) => ({ inv: r.invoice_no, rev: Number(r.revenue_sar) || 0 })); } catch (e) { return [{ err: e.message }]; } });
  const sum = (rows, re) => rows.filter((x) => re.test(x.inv || '')).reduce((a, x) => a + x.rev, 0);
  /* a rule added (or switched) the way a person would, from a signed-in session — but the page's own copy of the rules
     (MR.rules) is deliberately NOT refreshed, so the page stays exactly as stale as a colleague's edit would leave it */
  const addRuleOnServer = (name) => p.evaluate(async (n) => {
    const r = await fc().from('money_exclusion_rules').insert({ kind: 'name', value: n, reason: 'ruled out between preview and confirm (QA)' }).select('id');
    return (r && r.data && r.data[0] && r.data[0].id) || ('ERR ' + JSON.stringify(r && r.error));
  }, name);
  const switchRule = (id, on) => p.evaluate(async (a) => { const r = await fc().from('money_exclusion_rules').update({ active: a.on }).eq('id', a.id).select('id,active'); return (r && r.data && r.data[0]) || { err: r && r.error }; }, { id, on });

  const runImport = async (csv, ruleOutLate) => {
    await p.evaluate(() => { try { if (typeof window.finGo === 'function') window.finGo('import'); } catch (_) { } });
    await p.waitForTimeout(800);
    const blindAtSort = await p.evaluate((n) => { try { return { chk: !!finExclusionCheck(n) }; } catch (e) { return { err: String(e.message) }; } }, LATE);
    const preview = await p.evaluate(async (text) => {
      const f = new File([text], 'aug.csv', { type: 'text/csv' });
      if (typeof window.v65Ingest === 'function') { await window.v65Ingest([f]); return 'ingested'; }
      const dz = document.getElementById('finDrop');
      if (dz) { const dt = new DataTransfer(); dt.items.add(f); dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true })); return 'dropped'; }
      return 'no entry point';
    }, csv);
    await p.waitForTimeout(3500);
    const previewText = await p.evaluate(() => { const el = document.getElementById('finImpOut'); return el ? el.innerText : ''; });
    /* THE ONLY THING THAT CHANGES BETWEEN THE PREVIEW AND THE CONFIRM: someone rules the client out */
    let ruleId = null; if (ruleOutLate) ruleId = await addRuleOnServer(LATE);
    const pageStillBlind = await p.evaluate((n) => { try { return !finExclusionCheck(n); } catch (_) { return null; } }, LATE);
    await p.evaluate(() => { window.__alerts = []; const oa = window.alert; window.alert = (m) => { window.__alerts.push(String(m)); }; window.__restoreAlert = () => { window.alert = oa; }; });
    /* watch for the import summary ever being painted, so a summary that appears and is then painted over is told apart
       from one that never came */
    await p.evaluate(() => { window.__sawSummary = ''; try { if (window.__sumObs) window.__sumObs.disconnect(); window.__sumObs = new MutationObserver(() => { const el = document.querySelector('.v117-import-summary'); if (el && !window.__sawSummary) window.__sawSummary = el.innerText; }); window.__sumObs.observe(document.body, { childList: true, subtree: true }); } catch (_) { } });
    await p.evaluate(() => { try { if (typeof window.v65Commit === 'function') window.v65Commit(); } catch (e) { window.__alerts.push('THREW ' + e.message); } });
    await p.waitForTimeout(4500);
    const sawSummary = await p.evaluate(() => window.__sawSummary || '');
    const alerted = await p.evaluate(() => { try { window.__restoreAlert(); } catch (_) { } return window.__alerts || []; });
    const done = await p.evaluate(() => { const el = document.getElementById('finImpOut'); return el ? el.innerText : ''; });
    return { preview, previewText, pageStillBlind, alerted, done, blindAtSort, ruleId, sawSummary };
  };

  /* ---- 1. control: the standing rule, known throughout ---- */
  const before1 = await invoicesInDb();
  const r1 = await runImport(csvFor(1, EXCLUDED), false);
  const after1 = await invoicesInDb();
  const wrote1 = after1.filter((x) => !before1.some((y) => y.invoice_no === x.invoice_no)).map((x) => x.invoice_no);
  const v1 = await viewRow('REF-S1');
  await reloadFin();
  const c1 = await counted();
  if (wrote1.includes('REF-S1') && wrote1.includes('REF-N1') && v1 && v1.excluded === true && v1.rule_kind === 'name' && !c1.some((x) => x.inv === 'REF-S1') && sum(c1, /^REF-N/) === 1500)
    ok('control: the standing rule\'s client is imported (D16) and left out — the view marks it excluded and Finance counts only the ordinary 1,500 — so the attack below is measured against a working importer and view');
  else fail(`control: expected REF-S1 stored and excluded, REF-N1 counted. wrote=${JSON.stringify(wrote1)} view=${JSON.stringify(v1)} counted=${JSON.stringify(c1)} preview=${JSON.stringify(r1.preview)} alerts=${JSON.stringify(r1.alerted)}`);

  /* ---- 2..5. THE ATTACK: previewed before the rule, committed after it ---- */
  const r2 = await runImport(csvFor(2, LATE), true);
  const lateId = r2.ruleId;
  const setUp = !!(lateId && !/^ERR/.test(lateId) && r2.blindAtSort && r2.blindAtSort.chk === false && r2.pageStillBlind === true && !new RegExp(LATE, 'i').test((r2.previewText.split('Left out by a rule')[1] || '')));
  if (setUp) ok(`the preview sorted "${LATE}" as an ordinary client and the page still thinks so at Confirm — so the attack is set up: only the server knows the partner has since been ruled out`);
  else fail(`the attack did not set itself up, so nothing below is a finding about the app: rule=${JSON.stringify(lateId)} at sort ${JSON.stringify(r2.blindAtSort)}, page unaware at commit=${JSON.stringify(r2.pageStillBlind)}. Preview said: ${JSON.stringify((r2.previewText || '').slice(0, 300))}`);

  const after2 = await invoicesInDb();
  const stored2 = after2.find((x) => x.invoice_no === 'REF-S2');
  const v2 = await viewRow('REF-S2');
  await reloadFin();
  const c2 = await counted();
  if (setUp) {
    if (stored2 && v2 && v2.excluded === true && v2.rule_id === lateId && !c2.some((x) => x.inv === 'REF-S2') && sum(c2, /^REF-N/) === 3000)
      ok('THE ATTACK FAILS: the late client\'s invoice is stored (so the rule can be switched off later) but the view leaves it out BY THE LATE RULE, and Finance counts the two ordinary rows only (3,000) — the rule that decides is the rule as it stands when the money is read, not the one the preview saw');
    else fail(`the ruled-out client's money is not left out: stored=${!!stored2} view=${JSON.stringify(v2)} (late rule ${lateId}) counted=${JSON.stringify(c2)}. Someone excluded that partner while the file sat in preview, and Finance counts it anyway — the Tawthiq incident by an ordinary Tuesday.`);
    const said2 = r2.done || '';
    const summary = said2.split('What the rules made of this import')[1] || '';
    if (/Left out by a rule/i.test(summary) && summary.includes(LATE) && /777/.test(summary))
      ok('the import summary, read back from the view after the write, says the late client was left out by that rule (count and SAR) — the person hears what the database made of the file, not what the stale preview promised');
    else fail(`the import summary does not say, on the screen after the import, that the late client was left out by its rule. ${r2.sawSummary ? 'It WAS painted (' + JSON.stringify(r2.sawSummary.slice(0, 300)) + ') and then painted over — ' : 'It was never painted — '}the screen now says: ${JSON.stringify(said2.slice(0, 400))}`);
    const exList = await p.evaluate(() => { try { current = 'finance'; FIN.tab = 'rules'; render(); const el = document.querySelector('#view .v117-excluded'); return el ? el.innerText : ''; } catch (e) { return 'ERR ' + e.message; } });
    if (/REF-S2/.test(exList) && exList.includes(LATE) && /ruled out between preview and confirm/.test(exList))
      ok('Finance → Rules lists the late client\'s invoice under Excluded, with the late rule and its reason');
    else fail(`Finance → Rules' Excluded list does not show REF-S2 with the late rule: ${JSON.stringify(exList.slice(0, 500))}`);

    /* ---- 6. retroactive, both ways, nothing re-imported ---- */
    const off = await switchRule(lateId, false);
    await reloadFin();
    const c3 = await counted();
    const on = await switchRule(lateId, true);
    await reloadFin();
    const c4 = await counted();
    const nNow = (await invoicesInDb()).length;
    if (off && off.active === false && c3.some((x) => x.inv === 'REF-S2' && x.rev === 777000) && on && on.active === true && !c4.some((x) => x.inv === 'REF-S2') && nNow === after2.length)
      ok('retroactive both ways: the late rule switched OFF brings the stored 777,000 back into Finance, switched ON takes it out again — no re-import, the row count unchanged');
    else fail(`the rule is not retroactive: off=${JSON.stringify(off)} counted-with-rule-off has REF-S2=${c3.some((x) => x.inv === 'REF-S2')}; on=${JSON.stringify(on)} counted-with-rule-on has REF-S2=${c4.some((x) => x.inv === 'REF-S2')}; rows ${after2.length} → ${nNow}`);
  } else console.log('  · the attack checks are REPORTED not asserted this run — the setup above did not hold');

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nstale-preview-exclusion OK — a client ruled out after the preview is stored and left out of every total, and the rule works retroactively both ways');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
