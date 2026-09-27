/* probe-exclusion-not-loaded.mjs (2026-09-07, watch cycle 41; REWRITTEN cycle 42; REWRITTEN again for E, 2026-09-27)
   — money must never be shown against exclusion rules nobody could read. Attack area (nn).

   E (2026-09-27, DECISIONS D16): the question moved. Until E the importer skipped an excluded
   client's rows, so "the list could not be read" was dangerous AT THE COMMIT, and this probe held
   js/62's finExclusionGateRows to refusing the write. Under E a row a rule catches IS imported (so
   switching the rule off brings it back with no re-import) and the database view money_rows leaves
   it out of every total; js/16 live() reads that view with the rows and drops what it marks
   excluded. The dangerous moment is now the READ: if the view cannot be read, a Finance that fell
   back to "count every row" would put the excluded client's money straight into Revenue. So the
   same purpose — no excluded money on the strength of rules nobody could read — is tested at the
   place it now lives:

     1. Control — with the view readable, BOTH rows are imported (the rule-caught one too, as D16
        says), the view marks the excluded client's row excluded with its rule, live() and the
        Overview carry the ordinary client's 1,000 and not the 500,000, and Finance → Rules lists
        the row under Excluded with the rule that caught it. (If this fails, nothing below means
        anything.)
     2. THE GATE — with the money_rows read FAILING, Finance shows NO money (live() is empty, the
        Overview carries neither figure) — fail closed, not fail open.
     3. …and it says why, on the page, rather than showing a quiet zero.
     4. It holds on a read that never answers, not only on one that errors: while the view hangs,
        no excluded money is counted.
     5. Recovery — once the view answers again, all three batches' excluded rows stay out and the
        three ordinary rows count (3,000), with nothing re-imported.

   The old cycle-41/42 history (the guard that read "loaded" at exactly the moment the list was
   absent) is why this probe breaks the READ itself rather than emptying page state by hand: no
   page state is trusted to answer the question.

   Run:  node scripts/qa/probe-exclusion-not-loaded.mjs        (port 8720)
   Sabotage: SABOTAGE=1 node scripts/qa/probe-exclusion-not-loaded.mjs serves js/16 to the browser
   without live()'s `if(FIN.rows&&FIN.mErr)return [];` line (the file on disk is untouched) — the
   gate goes red with every row, the excluded 500,000s included, counted.                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8720;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const EXCLUDED = 'Tawthiq Test Services';   // the mock seed's own standing NAME rule (money_exclusion_rules)
const srv = start(PORT, { finance_invoices: [] });
const BREAK = { view: false, mode: 'error' };
const BASE = 'http://localhost:' + PORT;

/* The real Direct Payments invoice-export signature. Cycle 28's lesson: invented column names
   make the importer answer "not recognized", no preview runs, and a check then passes having
   exercised nothing. */
const HEAD = 'Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman';
const csvFor = (n) => [HEAD,
  'invoice,Direct Flights,' + EXCLUDED + ',REF-X' + n + ',XL-' + n + '1,05/08/2026 10:00:00 AM,Fully Paid,,,,,500000,Riyadh,QA',
  'item,Direct Flights,' + EXCLUDED + ',REF-X' + n + ',,,,Excluded partner work,No,0,500000,,,',
  'invoice,Direct Hotels,Ordinary Client Co,REF-O' + n + ',OK-' + n + '2,06/08/2026 10:00:00 AM,Fully Paid,,,,,1000,Riyadh,QA',
  'item,Direct Hotels,Ordinary Client Co,REF-O' + n + ',,,,Ordinary work,No,0,1000,,,'
].join('\n');

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    /* switched on AFTER boot, so the app loads normally and only the later read of the view fails */
    if (BREAK.view && /\/money_rows/.test(u.pathname)) {
      if (BREAK.mode === 'hang') { await new Promise((x) => setTimeout(x, 40000)); }
      await r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"deliberate failure (probe)"}' });
      return;
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  /* SABOTAGE=1: serve js/16 with its fail-closed line removed (in the browser only; the file on disk is untouched) */
  if (process.env.SABOTAGE) await p.route((u) => u.pathname === '/js/16-finance-ledger.js', async (r) => {
    const src = fs.readFileSync(new URL('../../js/16-finance-ledger.js', import.meta.url), 'utf8');
    const cut = src.replace('if(FIN.rows&&FIN.mErr)return [];', '');
    if (cut === src) console.log('  ! sabotage did not apply — the line moved');
    await r.fulfill({ status: 200, contentType: 'application/javascript', body: cut });
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  try { await p.waitForFunction(() => typeof window.v65Commit === 'function', { timeout: 90000 }); } catch (_) { }
  await p.evaluate(() => { try { current = 'finance'; render(); } catch (_) { } });
  /* the typed rules (js/117) must be in the page: finExclusionCheck now answers from them */
  let rulesIn = false;
  try { await p.waitForFunction((n) => { try { return !!(window.MR && MR.rules && typeof finExclusionCheck === 'function' && finExclusionCheck(n)); } catch (_) { return false; } }, EXCLUDED, { timeout: 90000 }); rulesIn = true; } catch (_) { }
  if (!rulesIn) fail('the exclusion rules never arrived in the page (MR.rules / finExclusionCheck) — this probe is entirely about what happens with and without them, so it cannot run');
  await p.waitForTimeout(800);

  const invoicesInDb = async () => (await fetch(BASE + '/rest/v1/finance_invoices?select=id,invoice_no,client_group,total_incl_vat_sar,revenue_sar').then((r) => r.json())) || [];
  const viewInDb = async () => (await fetch(BASE + '/rest/v1/money_rows?select=invoice_no,excluded,counts,rule_kind,rule_value').then((r) => r.json())) || [];

  /* drive the importer the way the page does: ingest the file, then press Confirm */
  const runImport = async (csv) => {
    await p.evaluate(() => { try { if (typeof window.finGo === 'function') window.finGo('import'); } catch (_) { } });
    await p.waitForTimeout(800);
    const preview = await p.evaluate(async (text) => {
      const f = new File([text], 'aug.csv', { type: 'text/csv' });
      if (typeof window.v65Ingest === 'function') { await window.v65Ingest([f]); return 'ingested'; }
      const dz = document.getElementById('finDrop');
      if (dz) { const dt = new DataTransfer(); dt.items.add(f); dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true })); return 'dropped'; }
      return 'no entry point';
    }, csv);
    await p.waitForTimeout(3500);
    await p.evaluate(() => { window.__alerts = []; const oa = window.alert; window.alert = (m) => { window.__alerts.push(String(m)); }; window.__restoreAlert = () => { window.alert = oa; }; });
    await p.evaluate(() => { try { if (typeof window.v65Commit === 'function') window.v65Commit(); } catch (e) { window.__alerts.push('THREW ' + e.message); } });
    await p.waitForTimeout(4000);
    const alerted = await p.evaluate(() => { try { window.__restoreAlert(); } catch (_) { } return window.__alerts || []; });
    return { preview, alerted };
  };
  /* what Finance itself would count and show right now */
  const finState = async () => p.evaluate(() => {
    const out = { live: [], mErr: null, rowsNull: true, overview: '', nomoney: '', excludedList: '' };
    try { out.rowsNull = FIN.rows == null; out.mErr = FIN.mErr || null; out.live = (finLive() || []).map((r) => ({ inv: r.invoice_no, rev: Number(r.revenue_sar) || 0 })); } catch (e) { out.err = e.message; }
    try { current = 'finance'; FIN.tab = 'overview'; render(); const v = document.getElementById('view'); out.overview = v ? v.innerText : ''; const nm = v && v.querySelector('.v117-nomoney'); out.nomoney = nm ? nm.innerText : ''; } catch (e) { out.err2 = e.message; }
    return out;
  });
  const rulesTab = async () => p.evaluate(() => { try { current = 'finance'; FIN.tab = 'rules'; render(); const v = document.getElementById('view'); const ex = v && v.querySelector('.v117-excluded'); return ex ? ex.innerText : ''; } catch (e) { return 'ERR ' + e.message; } });
  const reloadFin = async () => { await p.evaluate(() => { try { FIN.loading = false; FIN.rows = null; finLoad(); } catch (_) { } }); };
  const waitRows = async (ms = 20000) => { try { await p.waitForFunction(() => window.FIN && FIN.rows != null, null, { timeout: ms }); } catch (_) { } await p.waitForTimeout(500); };
  /* the Overview writes money compactly ("1.0K SAR", "500K SAR"), so read its own figures rather than grep for digits:
     the invoice count in the header line and the Revenue key indicator */
  const ovCount = (t) => { const m = /(\d[\d,]*) invoices? · data through/.exec(t || ''); return m ? +m[1].replace(/,/g, '') : 0; };
  const ovRev = (t) => { const m = /\nRevenue\n([^\n]+)/.exec(t || ''); return m ? m[1].trim() : '(none)'; };
  const noMoney = (t) => ovCount(t) === 0 && /^(0 SAR|\(none\)|—)$/.test(ovRev(t));

  /* ---- 1. control: view readable ---- */
  const before1 = await invoicesInDb();
  const r1 = await runImport(csvFor(1));
  const after1 = await invoicesInDb();
  const wrote1 = after1.filter((x) => !before1.some((y) => y.invoice_no === x.invoice_no));
  const v1 = await viewInDb();
  const vx1 = v1.find((x) => x.invoice_no === 'REF-X1'), vo1 = v1.find((x) => x.invoice_no === 'REF-O1');
  await waitRows();
  const s1 = await finState();
  const liveX1 = s1.live.some((x) => /^REF-X/.test(x.inv)), liveO1 = s1.live.some((x) => x.inv === 'REF-O1');
  if (wrote1.length === 2 && vx1 && vx1.excluded === true && vx1.rule_kind === 'name' && vo1 && vo1.counts === true && liveO1 && !liveX1 && ovCount(s1.overview) === 1 && ovRev(s1.overview) === '1.0K SAR')
    ok('control: both rows imported (the rule-caught one too, D16), the view marks the excluded client\'s row excluded by its name rule, and Finance counts the ordinary 1,000 and not the 500,000 — so the gate below is measured against a working importer and a working view');
  else fail(`control: expected both rows imported, REF-X1 excluded by the name rule and out of Finance, REF-O1 counted. wrote=${JSON.stringify(wrote1.map((x) => x.invoice_no))} view X1=${JSON.stringify(vx1)} O1=${JSON.stringify(vo1)} live=${JSON.stringify(s1.live)} mErr=${s1.mErr} overview count=${ovCount(s1.overview)} revenue=${JSON.stringify(ovRev(s1.overview))} preview=${JSON.stringify(r1.preview)} alerts=${JSON.stringify(r1.alerted)}`);
  const ex1 = await rulesTab();
  if (/REF-X1/.test(ex1) && ex1.includes(EXCLUDED) && /verification services/i.test(ex1) && !/REF-O1/.test(ex1))
    ok('Finance → Rules lists the excluded row under Excluded, with the rule and its reason — and not the ordinary one');
  else fail(`Finance → Rules' Excluded list does not show REF-X1 with its rule (or shows REF-O1): ${JSON.stringify(ex1.slice(0, 400))}`);

  /* ---- 2 + 3. the gate: the view read fails ---- */
  BREAK.view = true; BREAK.mode = 'error';
  await runImport(csvFor(2));
  await reloadFin(); await waitRows();
  const s2 = await finState();
  const money2 = s2.live.length, shows2 = !noMoney(s2.overview);
  if (s2.mErr && money2 === 0 && !shows2)
    ok('with the money_rows view UNREADABLE Finance counts nothing at all (live() is empty, no excluded figure on the Overview) — it fails closed rather than counting rows it could not check');
  else fail(`with the view unreadable Finance still counted ${money2} row(s): ${JSON.stringify(s2.live)} (mErr=${JSON.stringify(s2.mErr)}, rows loaded=${!s2.rowsNull}, Overview count=${ovCount(s2.overview)} revenue=${JSON.stringify(ovRev(s2.overview))}) — the Tawthiq incident by a different road`);
  if (/could not be applied|تعذّر تطبيق/i.test(s2.nomoney) && /no money|لا تُعرض أي مبالغ/i.test(s2.nomoney))
    ok('…and the page says why — the rules could not be applied, so no money is shown — a refusal a person can act on, not a silent zero');
  else fail(`with the view unreadable the page did not explain the missing money. Banner: ${JSON.stringify(s2.nomoney.slice(0, 300))}`);

  /* ---- 4. a read that never answers ---- */
  BREAK.mode = 'hang';
  await runImport(csvFor(3));
  await reloadFin();
  await p.waitForTimeout(8000);   // mid-hang: the view has not answered
  const s3 = await finState();
  const bad3 = s3.live.filter((x) => /^REF-X/.test(x.inv));
  if (!bad3.length && !/[5-9]\d\dK|M SAR/.test(ovRev(s3.overview)))
    ok(`while the view read hangs, no excluded money is counted (rows loaded=${!s3.rowsNull}, counted=${s3.live.length}) — the page does not fall through to counting unchecked rows`);
  else fail(`while the view read hangs Finance counts excluded money: ${JSON.stringify(bad3)} Overview revenue=${JSON.stringify(ovRev(s3.overview))}`);
  await p.waitForTimeout(36000);  // outlast the hang (it then answers 500)
  const s3b = await finState();
  if (!s3b.live.some((x) => /^REF-X/.test(x.inv))) ok('…and once the hung read finally fails, still nothing excluded is counted');
  else fail(`after the hung read failed Finance counts excluded money: ${JSON.stringify(s3b.live)}`);

  /* ---- 5. recovery, no re-import ---- */
  BREAK.view = false; BREAK.mode = 'error';
  await reloadFin(); await waitRows();
  const s4 = await finState();
  const sumO = s4.live.filter((x) => /^REF-O/.test(x.inv)).reduce((a, x) => a + x.rev, 0);
  const anyX = s4.live.filter((x) => /^REF-X/.test(x.inv));
  const all = await invoicesInDb();
  const stored = all.filter((x) => /^REF-X/.test(x.invoice_no)).length;
  if (!s4.mErr && !anyX.length && sumO === 3000 && stored === 3 && ovCount(s4.overview) === 3 && ovRev(s4.overview) === '3.0K SAR')
    ok('with the view readable again, the three ordinary rows count (3,000) and the three excluded rows — all stored — stay out, with nothing re-imported');
  else fail(`after recovery: mErr=${s4.mErr} excluded counted=${JSON.stringify(anyX)} ordinary sum=${sumO} excluded rows stored=${stored} Overview count=${ovCount(s4.overview)} revenue=${JSON.stringify(ovRev(s4.overview))}`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexclusion-not-loaded OK — Finance shows no money, and says why, whenever the view that applies the exclusion rules cannot be read');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
