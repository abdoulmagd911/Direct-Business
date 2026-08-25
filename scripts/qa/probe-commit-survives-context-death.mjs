/* probe-commit-survives-context-death.mjs — M16 regression guard for the oversight session's
   reported failure: v65Commit() failing every time with "Failed to execute forEach on Headers:
   The provided callback is no longer runnable" — their browser-extension injection context
   dying mid-request (an "extension context invalidated" shape, the same root cause as the dead
   file-I/O layer they documented 2026-08-24; unrelated to M13's `year` bug). Verified on their
   side: nothing written, clean failure, no partial state — but also proof the old commit path
   (several sequential .insert()/.upsert() round trips) gave that teardown a wide window to hit
   mid-batch.

   THE CLAIM THIS PROBE PROVES DIRECTLY, not just argues for: once the commit request reaches
   the server, the write completes — regardless of what happens to the calling browser context
   afterward, because M16 moved the whole commit into ONE Postgres transaction
   (fn_commit_finance_import(), migration finance_commit_import_rpc) invoked by a single round
   trip. The response being unreadable does not undo an already-committed transaction.

   HOW: intercepts the RPC request at the network layer, node-side (NOT inside the page — this
   matters, see below), signals the instant the request has left the page, and DESTROYS THE
   BROWSER CONTEXT right then — before forwarding the request to the mock server and before any
   response could possibly reach the page. The forward-to-server fetch and the resulting write
   both happen in THIS test process's own JS, entirely independent of the browser context's
   lifecycle, so closing the context cannot cancel them — exactly the situation M16 is built for:
   a request that has left the client is no longer the client's problem. A direct read of the
   mock database afterward (a plain fetch, no browser involved) confirms the row actually
   changed, with the browser context already gone the entire time it happened. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8251;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  let requestArrivedResolve, serverWriteDoneResolve;
  const requestArrived = new Promise((res) => { requestArrivedResolve = res; });
  const serverWriteDone = new Promise((res) => { serverWriteDoneResolve = res; });
  let sawRpcRequest = false;

  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (route) => {
    const rq = route.request(); const u = new URL(rq.url());
    if (rq.method() === 'POST' && u.pathname === '/rest/v1/rpc/fn_commit_finance_import') {
      sawRpcRequest = true;
      requestArrivedResolve();
      // This fetch runs in the TEST PROCESS, not inside the browser page — closing the page/
      // context below cannot cancel it. It is the thing that actually performs the write.
      let resp, body;
      try {
        resp = await fetch(BASE + u.pathname + u.search, { method: 'POST', headers: rq.headers(), body: rq.postData() });
        body = await resp.text();
      } catch (e) {
        serverWriteDoneResolve();
        return;
      }
      serverWriteDoneResolve();
      // The page is expected to already be gone by the time we get here — fulfilling into a
      // closed context is exactly the "client never gets to read the response" situation this
      // probe exists to prove is survivable. Swallow the inevitable error from that.
      try { await route.fulfill({ status: resp.status, contentType: 'application/json', body }); } catch (_) {}
      return;
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await route.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await route.fulfill({ status: 500, body: '{}' }); }
  });

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); });
  await p.waitForTimeout(700);

  // 116361000 (i=0 fixture): zatca_dpin null, total 5000 — a single genuinely eligible row.
  const csv = ['invoice_no,tax_code,total_incl_vat_sar,invoice_status,issue_date', '116361000,DPIN-CTXDEATH,5300,Issued,2026-08-01'].join('\n');
  const ingested = await p.evaluate(([n, text]) => window.v65IngestText(n, text), ['ctx-death.csv', csv]);
  if (!ingested) fail('v65IngestText did not run');
  await p.waitForTimeout(800);

  const clicked = await p.evaluate(() => {
    const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm/i.test(x.textContent));
    if (bt) { bt.click(); return true; }
    return false;
  });
  if (!clicked) fail('no Confirm import button appeared');
  else ok('clicked Confirm — the RPC request is now in flight');

  // Bounded wait, not an indefinite one — if a future regression stops calling the RPC
  // entirely, this must fail cleanly (exit 1) rather than hang forever.
  const timedOut = Symbol('timeout');
  const arrived = await Promise.race([requestArrived.then(() => true), new Promise((res) => setTimeout(() => res(timedOut), 15000))]);
  if (arrived === timedOut) fail('the commit request never reached the network layer within 15s — v65Commit() may no longer be calling the RPC at all');
  else ok('the commit request reached the network layer — now destroying the browser context, before any response can arrive');

  // THE ACTUAL TEST: kill the page and its context right now, simulating the reported "context
  // invalidated mid-request" failure — deliberately BEFORE awaiting the server-side write.
  await p.close().catch(() => {});
  await ctx.close().catch(() => {});

  if (!sawRpcRequest) fail('the RPC request was never actually observed — this probe did not exercise anything');

  if (arrived === timedOut) {
    console.log('  (skipping the database check — the request never arrived, nothing to verify)');
  } else {
    // Wait for the write itself (running independently of the now-closed browser context) to
    // finish, then check the database directly — no browser involved in this check at all.
    const writeTimedOut = Symbol('write-timeout');
    const wrote = await Promise.race([serverWriteDone.then(() => true), new Promise((res) => setTimeout(() => res(writeTimedOut), 15000))]);
    if (wrote === writeTimedOut) fail('the server-side write never completed within 15s of the request arriving');
    const check = await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.116361000').then((r) => r.json());
    const row = Array.isArray(check) ? check[0] : null;
    if (!row) fail('SESSION-DEATH TEST FAILED: invoice 116361000 not found at all after the write');
    else if (row.zatca_dpin !== 'DPIN-CTXDEATH' || Number(row.total_incl_vat_sar) !== 5300) {
      fail(`THE CORE GUARANTEE FAILED: the write did not land after the browser context was destroyed mid-request — got ${JSON.stringify({ dpin: row.zatca_dpin, total: row.total_incl_vat_sar })}, expected {dpin:'DPIN-CTXDEATH',total:5300}. This is exactly the oversight session's reported failure: the write depends on the client surviving.`);
    } else {
      ok('THE CORE GUARANTEE HELD: the browser context was fully destroyed before any response could be read, and the write still landed — confirmed by a direct database read with no browser involved. The commit does not depend on the client staying alive.');
    }
  }

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION|Target page, context or browser has been closed/.test(e));
  console.log('\nJS/console errors (context-teardown noise excluded):', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} unexpected JS/console error(s) during the run`);

  await b.close().catch(() => {});
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\ncommit-survives-context-death OK — a commit request that reached the server completes even when the browser context that sent it is destroyed before the response comes back.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
