/* probe-client-card-address.mjs (2026-09-09, live test finding C5) — a client's card has a
   client's address. Attack area (ad).

   PORT NOTE: 8701–8763 are taken. This is 8764, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: opening a client from the Clients page put
   /leads/lead/<id> in the address bar — the card is the same screen as a lead's, and js/03
   named it after the screen, not after what the person opened.

   Under test:
     1. Open a client card → the address reads /clients/client/<id>; open a lead card → it still
        reads /leads/lead/<id>.
     2. Boot the app at /clients/client/<id> → that client's card is open.
     3. Boot at the old shape /leads/lead/<clientId> → still opens the card (old links keep
        working), and the address is rewritten to the client shape.
     4. Browser Back from the client card returns to the Clients list.
     5. Booting at /leads/lead/<leadId> opens the lead's card. Found while writing this probe: a
        card deep link never survived a boot on any machine — js/03 applied the route while
        DB.businesses still held the start-up copy, the card render could not find the record and
        cleared openLead, and nothing re-applied the route when the rows arrived. js/03 now opens
        the card when the record is actually present.

   Run:  node scripts/qa/probe-client-card-address.mjs        (port 8764)
   Sabotage: in js/03 buildPath drop the isClientId branch — check 1 goes red (/leads/lead/ for a
   client); in parse() drop `client` from the alternation — check 2 goes red; make
   openWhenPresent() assign openLead at once (the old behaviour) — checks 2, 3 and 5 go red. Assert the sabotage
   APPLIED with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8764;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

async function wire(p) {
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
}
async function boot(p, path) {
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded at ' + path));
  await p.waitForTimeout(1500);
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await wire(p);
  await boot(p, '/clients');
  const ids = await p.evaluate(() => ({ client: (DB.businesses.find((x) => x.isClient) || {}).id, lead: (DB.businesses.find((x) => !x.isClient) || {}).id }));

  /* ---- 1. addresses ---- */
  await p.evaluate((id) => { openLead = id; current = 'leads'; render(); }, ids.client); await p.waitForTimeout(600);
  const c1 = await p.evaluate(() => location.pathname);
  await p.evaluate(() => { openLead = null; current = 'leads'; render(); }); await p.waitForTimeout(400);
  await p.evaluate((id) => { openLead = id; current = 'leads'; render(); }, ids.lead); await p.waitForTimeout(600);
  const l1 = await p.evaluate(() => location.pathname);
  if (c1 === '/clients/client/' + ids.client) ok(`a client card's address reads ${c1}`); else fail(`client card address: ${c1} — the live-site /leads/lead/… for a client`);
  if (l1 === '/leads/lead/' + ids.lead) ok(`a lead card's address still reads ${l1}`); else fail(`lead card address: ${l1}`);

  /* ---- 2. boot at the client shape ---- */
  await boot(p, '/clients/client/' + ids.client);
  const b2 = await p.evaluate(() => ({ cur: current, open: openLead, path: location.pathname, card: !!document.querySelector('#view .detail-head') }));
  if (b2.open === ids.client && b2.card && b2.path === '/clients/client/' + ids.client) ok('booting at /clients/client/<id> opens that client\'s card');
  else fail(`boot at client shape: ${JSON.stringify(b2)}`);

  /* ---- 3. the old shape keeps working and is rewritten ---- */
  await boot(p, '/leads/lead/' + ids.client);
  const b3 = await p.evaluate(() => ({ open: openLead, path: location.pathname, card: !!document.querySelector('#view .detail-head') }));
  if (b3.open === ids.client && b3.card && b3.path === '/clients/client/' + ids.client) ok('an old /leads/lead/<clientId> link still opens the card and is rewritten to the client shape');
  else fail(`old shape: ${JSON.stringify(b3)}`);

  /* ---- 5. a LEAD card deep link survives a boot too (never did, on any machine) ---- */
  await boot(p, '/leads/lead/' + ids.lead);
  const b5 = await p.evaluate(() => ({ open: openLead, path: location.pathname, card: !!document.querySelector('#view .detail-head') }));
  if (b5.open === ids.lead && b5.card && b5.path === '/leads/lead/' + ids.lead) ok('booting at /leads/lead/<id> opens that lead\'s card once its record has arrived');
  else fail(`lead card deep link at boot: ${JSON.stringify(b5)} — the route used to be applied against the start-up copy and the card cleared itself`);

  /* ---- 4. Back from the card returns to the Clients list ---- */
  await boot(p, '/clients');
  await p.evaluate((id) => { openLead = id; current = 'leads'; render(); }, ids.client); await p.waitForTimeout(700);
  await p.goBack({ waitUntil: 'commit' }).catch(() => {}); await p.waitForTimeout(900);
  const b4 = await p.evaluate(() => ({ cur: current, open: openLead || '', path: location.pathname }));
  if (b4.cur === 'clients' && !b4.open && b4.path === '/clients') ok('Back from the client card returns to the Clients list');
  else fail(`Back: ${JSON.stringify(b4)}`);

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nclient-card-address OK — a client\'s card has a client\'s address');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
