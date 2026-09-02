/* probe-ops-margin-honest.mjs — "Booked margin" must not count an unrecorded cost as zero
   (2026-09-02, round 31). The same rule the proposal editor broke in round 29, in two more
   places: the Operations board's KPI row and the dashboard's KPI row.

   M8 — cost is approved expenses only: never fabricate a number to fill a gap; leave it
        unknown and say why.

   What was wrong: both tiles computed Σ(sell − cost) over EVERY request, and `+r.cost||0`
   turned a request whose cost nobody had recorded into a cost of ZERO. Its entire sale was
   therefore reported as booked margin, and the percentage printed beside it was computed on
   that. A desk with three costed requests and one uncosted 50,000 SAR job would have shown a
   margin inflated by the whole 50,000 and a percentage nobody could reconcile.

   What it does now: only requests that actually record a cost count toward the margin; the
   percentage is taken against those same requests' sales (not the whole pipeline, which would
   understate it); the requests left out are counted on the tile; and if NOTHING has a cost
   recorded the tile reads "—" rather than a confident zero.

   Nothing is hidden by this: "Pipeline value" still counts every request's sale, so the work
   is still visible — it is only the MARGIN claim that now requires evidence.

   Sabotage: restore Σ over every request with `+r.cost||0` -> the uncosted job's whole sale
   reappears in the margin -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

/* The fixture has to be SEEDED INTO THE MOCK, not assigned to DB.requests in the browser:
   js/35 loads requests from the real tables and then re-asserts that copy for ~20 s whenever
   DB.requests changes identity (an anti-clobber guard against the blob loader finishing late).
   An assignment from a probe looks exactly like the clobber it defends against, so the fixture
   was silently replaced by the seed a second later. Seeding the table drives the real path. */
function seed(rows) {
  return {
    app_requests: rows.map((r, i) => ({
      id: 'qa-req' + i,
      data: { id: 'qa-req' + i, client: r.client, service: 'Flights', detail: r.title, stage: r.stage, owner: 'QA', priority: 'Normal', createdAt: 1788300000000, supplier: 'Provider 1', pnr: '', sell: r.sell, cost: r.cost === undefined ? '' : r.cost, notes: '' },
      updated_at: '2026-08-01T00:00:00Z', updated_by: 'QA',
    })),
  };
}

// three costed requests and one uncosted one:
//   costed:  10,000/7,000 · 20,000/15,000 · 30,000/24,000  -> margin 14,000 on 60,000 = 23%
//   uncosted: 50,000 sale, no cost recorded at all
// Old code: margin 14,000 + 50,000 = 64,000, on 110,000 = 58%. Both figures fabricated.
const REQS = [
  { title: 'QA costed A', client: 'Test Company 1', stage: 'New', sell: 10000, cost: 7000 },
  { title: 'QA costed B', client: 'Test Company 2', stage: 'Quoting', sell: 20000, cost: 15000 },
  { title: 'QA costed C', client: 'Test Company 3', stage: 'Booked', sell: 30000, cost: 24000 },
  { title: 'QA uncosted big job', client: 'Test Company 4', stage: 'Quoting', sell: 50000 },
];

async function run(port, rows, fn) {
  const srv = start(port, seed(rows));
  const BASE = 'http://localhost:' + port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(7000);   // past js/35's table load
  try { await fn(p); } finally {
    const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
    if (realErrors.length) fail(realErrors.length + ' JS error(s): ' + JSON.stringify(realErrors.slice(0, 3)));
    await b.close(); srv.close();
  }
}

// read one KPI tile by the words on it, shortest match (the tile, not its container)
async function tile(p, words) {
  return p.evaluate((w) => {
    const re = new RegExp(w, 'i');
    let t = '';
    document.querySelectorAll('#view .kp, #view .kpi, #view .kpis > *, #view .card').forEach((el) => {
      const s = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (re.test(s) && s.length < 400 && (!t || s.length < t.length)) t = s;
    });
    return t;
  }, words);
}

async function main() {
  // ---- three costed requests and one uncosted 50,000 job
  await run(8397, REQS, async (p) => {
    await p.evaluate(() => { openLead = null; openSup = null; current = 'ops'; render(); });
    await p.waitForTimeout(1200);
    const ops = await tile(p, 'booked margin|\u0647\u0627\u0645\u0634 \u0627\u0644\u0645\u062d\u062c\u0648\u0632');
    if (!ops) { fail('could not find the "Booked margin" tile on the Operations board'); return; }
    if (/14,?000|14k/i.test(ops)) ok('Operations "Booked margin" reads the 14,000 that is actually evidenced (10k+20k+30k sold for 7k+15k+24k)');
    else fail('the Operations margin tile does not show 14,000: ' + JSON.stringify(ops.slice(0, 160)));
    if (/\b64,?000|64k/i.test(ops)) fail('the tile still contains 64,000 — the uncosted 50,000 job is counted as pure margin');
    else ok('…and NOT the 64,000 the old code showed, which counted an uncosted 50,000 job as 100% margin');
    const pct = (ops.match(/(\d+)\s*%/) || [])[1];
    if (pct === '23') ok('the percentage beside it is 23% — against the 60,000 that has costs, not the whole 110,000 pipeline');
    else fail('margin percentage reads ' + pct + '%, expected 23 (58% would be the old whole-pipeline maths)');
    if (/1 with no cost recorded/.test(ops)) ok('…and the tile says "1 with no cost recorded — not counted", so the uncosted job is not hidden');
    else fail('the tile does not say how many requests were left out: ' + JSON.stringify(ops.slice(0, 200)));

    const pipeline = await tile(p, 'pipeline value');
    if (/110,?000|110k/i.test(pipeline)) ok('"Pipeline value" still counts all four requests (110k) — only the MARGIN claim needs evidence, the work is not hidden');
    else fail('pipeline value changed: ' + JSON.stringify(pipeline.slice(0, 120)));

    // the dashboard tile, same rule
    await p.evaluate(() => { current = 'dashboard'; render(); });
    await p.waitForTimeout(1200);
    const dash = await tile(p, 'booked margin');
    if (!dash) { console.log('  · note: no "Booked margin" tile on the dashboard in this seed'); return; }
    if (/14,?000|14k/i.test(dash)) ok('the dashboard tile shows the same evidenced 14,000');
    else fail('dashboard margin tile: ' + JSON.stringify(dash.slice(0, 160)));
    if (/\b64,?000|64k/i.test(dash)) fail('the dashboard tile still counts the uncosted job (64,000)');
    else ok('…and not the 64,000');
    if (/no cost recorded/.test(dash)) ok('…and it names the request left out too');
    else fail('the dashboard tile does not say what was left out: ' + JSON.stringify(dash.slice(0, 200)));

    // Arabic
    await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); current = 'ops'; render(); });
    await p.waitForTimeout(1200);
    const ar = await tile(p, '\u0647\u0627\u0645\u0634 \u0627\u0644\u0645\u062d\u062c\u0648\u0632|booked margin');
    if (/\u0628\u062f\u0648\u0646 \u062a\u0643\u0644\u0641\u0629 \u0645\u0633\u062c/.test(ar)) ok('in Arabic the same note reads \u00ab\u0628\u062f\u0648\u0646 \u062a\u0643\u0644\u0641\u0629 \u0645\u0633\u062c\u0651\u0644\u0629 \u2014 \u063a\u064a\u0631 \u0645\u062d\u062a\u0633\u0628\u0629\u00bb');
    else fail('the Arabic tile does not carry the note: ' + JSON.stringify(ar.slice(0, 200)));
  });

  // ---- nothing costed anywhere: the tile must say so, not print a confident zero
  await run(8398, [{ title: 'QA only job', client: 'Test Company 1', stage: 'New', sell: 40000 }], async (p) => {
    await p.evaluate(() => { openLead = null; current = 'ops'; render(); });
    await p.waitForTimeout(1200);
    const none = await tile(p, 'booked margin');
    if (/\u2014/.test(none) && !/\b0\s*SAR/.test(none)) ok('with no cost recorded anywhere the tile reads "\u2014", not a confident 0 SAR: ' + JSON.stringify(none.slice(0, 120)));
    else fail('a margin was printed with nothing to base it on: ' + JSON.stringify(none.slice(0, 160)));
    if (/no request has a cost recorded/.test(none)) ok('…and it says plainly that no request has a cost recorded');
    else fail('no explanation on the empty-basis tile: ' + JSON.stringify(none.slice(0, 160)));
  });

  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nops-margin-honest OK — a margin is claimed only where a cost was actually recorded');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
