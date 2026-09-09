/* probe-leads-dash-tiles.mjs (2026-09-09, live test findings L1-dash, L2, L4, L5) — the Leads
   page's Dashboard view and conversion strip say true things in readable tiles.
   Attack area (ad). EX3 (Clients list: a Lost client reads Lost, not Good) added the same evening.

   PORT NOTE: 8701–8753 are taken. This is 8754, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand:
     · Dashboard view with the Lost chip on: "Total leads 2 · Lost 3" — a converted CLIENT whose
       stage still read Lost was counted as a lost lead.
     · The four tiles drew as faint outlined strips with the number jammed top-left (.chip is
       styled for the dark hero, not a white board).
     · "Conversion rate 26 %" beside stage chips reading Won 0 — the rate counts clients out of
       everyone and nothing said so.
     · "New this month 0" straight after creating a lead — the new record carried no created
       date until the next reload.

   Under test:
     1. Dashboard, Lost chip on: Total leads == Lost, and neither counts a client.
     2. Dashboard tiles are readable on a white board: white background, dark number, muted
        (not #AEB4CC) label, number ≥ 22px.
     3. The conversion tile names what it counts ("Became clients · N of M") and N/M match the
        data (clients+won over everyone).
     4. A lead created through the app's own form carries createdAt at once, and "New this
        month" goes up by one without a reload.

   Run:  node scripts/qa/probe-leads-dash-tiles.mjs        (port 8754)
   Sabotage: in core-02 drawLeadsDash count `lost` from `_all` instead of `B` — check 1 goes
   red; drop the createdAt line in the new-lead save — check 4 goes red. Assert the sabotage
   APPLIED with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8754;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof drawLeads === 'function' && document.querySelector('#view table'), { timeout: 90000 }).catch(() => fail('the Leads page never rendered'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies over DB for ~20 s after load (see probe-today-queue-card)

  /* ---- 1. dashboard, Lost chip on: a client with stage Lost is not a lost lead ---- */
  const r1 = await p.evaluate(() => new Promise((res) => {
    openLead = null; current = 'leads';
    DB.businesses = (DB.businesses || []).filter((x) => !/^probe-ld-/.test(x.id));
    DB.businesses.push({ id: 'probe-ld-lost1', name: 'Probe Lost Lead A', stage: 'Lost', status: 'Lost', isClient: false, contacts: [], activities: [] });
    DB.businesses.push({ id: 'probe-ld-lost2', name: 'Probe Lost Lead B', stage: 'Lost', status: 'Lost', isClient: false, contacts: [], activities: [] });
    DB.businesses.push({ id: 'probe-ld-clientlost', name: 'Probe Client With Lost Stage', stage: 'Lost', status: 'Lost', isClient: true, contacts: [], activities: [] });
    leadFilter.stage = 'Lost'; leadFilter.hideClosed = true; leadView = 'dash'; render();
    setTimeout(() => {
      const tiles = [...document.querySelectorAll('#board .leads-dash-tiles .chip')].map((c) => ({ v: +c.querySelector('.v').textContent, l: c.querySelector('.l').textContent.trim(), bg: getComputedStyle(c).backgroundColor, color: getComputedStyle(c.querySelector('.v')).color, lcolor: getComputedStyle(c.querySelector('.l')).color, size: parseFloat(getComputedStyle(c.querySelector('.v')).fontSize) }));
      const lostLeads = DB.businesses.filter((x) => !x.isClient && leadStage(x) === 'Lost').length;
      res({ tiles, lostLeads });
    }, 800);
  }));
  const t = (l) => r1.tiles.find((x) => x.l === l) || {};
  if (r1.tiles.length === 4 && t('Total leads').v === r1.lostLeads && t('Lost').v === r1.lostLeads)
    ok(`Lost chip on: Total leads ${t('Total leads').v} = Lost ${t('Lost').v} = the ${r1.lostLeads} lost LEADS — the client with a Lost stage is not counted as a lost lead`);
  else fail(`Lost chip on: ${JSON.stringify(r1.tiles.map((x) => x.l + '=' + x.v))} vs ${r1.lostLeads} lost leads — the live-site "Total leads 2 · Lost 3"`);

  /* ---- 2. readable tiles ---- */
  const bad = r1.tiles.filter((x) => !/rgb\(255, 255, 255\)/.test(x.bg) || x.size < 22 || /rgb\(174, 180, 204\)/.test(x.lcolor) || /rgb\(255, 255, 255\)/.test(x.color));
  if (r1.tiles.length === 4 && !bad.length) ok(`all four tiles: white card, ${r1.tiles[0].size}px dark number, muted label — readable on the white board`);
  else fail(`tiles not readable on a white board: ${JSON.stringify(bad.length ? bad : r1.tiles)}`);

  /* ---- 3. conversion tile says what it counts ---- */
  const r3 = await p.evaluate(() => new Promise((res) => {
    leadFilter.stage = 'all'; leadView = 'table'; render();
    setTimeout(() => {
      const strip = document.querySelector('.v31-conv'); const txt = strip ? strip.innerText.replace(/\s+/g, ' ') : '';
      const all = DB.businesses; const won = all.filter((x) => leadStage(x) === 'Won' || x.isClient).length;
      const m = txt.match(/Became clients · (\d+) of (\d+)/);
      res({ txt: txt.slice(0, 200), n: m ? +m[1] : null, d: m ? +m[2] : null, won, all: all.length, pct: Math.round(won / all.length * 100) });
    }, 800);
  }));
  if (r3.n === r3.won && r3.d === r3.all && new RegExp(r3.pct + '%').test(r3.txt)) ok(`conversion tile reads "${r3.pct}% · Became clients · ${r3.n} of ${r3.d}" — the rate names its own numerator and denominator`);
  else fail(`conversion tile: ${JSON.stringify(r3)}`);

  /* ---- 4. a lead created through the form counts as new at once ---- */
  const r4 = await p.evaluate(() => new Promise((res) => {
    const before = +(document.querySelector('.v31-conv') || { innerText: '' }).innerText.match(/(\d+)\s*New this month/)?.[1] || 0;
    if (typeof editBusiness !== 'function') return res({ err: 'no editBusiness' });
    editBusiness();
    setTimeout(() => {
      const nm = document.getElementById('f_name'); if (!nm) return res({ err: 'no form' });
      nm.value = 'Probe Fresh Lead ' + Date.now();
      const save = document.getElementById('mSave'); if (!save) return res({ err: 'no save' });
      save.click();
      setTimeout(() => {
        const rec = DB.businesses.find((x) => /^Probe Fresh Lead/.test(x.name));
        const after = +(document.querySelector('.v31-conv') || { innerText: '' }).innerText.match(/(\d+)\s*New this month/)?.[1] || 0;
        res({ before, after, createdAt: rec ? rec.createdAt : null, month: new Date().toISOString().slice(0, 7) });
      }, 900);
    }, 500);
  }));
  if (r4.createdAt && String(r4.createdAt).slice(0, 7) === r4.month && r4.after === r4.before + 1) ok(`a lead saved through the form carries createdAt (${String(r4.createdAt).slice(0, 10)}) and "New this month" went ${r4.before} → ${r4.after} without a reload`);
  else fail(`new lead: ${JSON.stringify(r4)} — the live-site "New this month 0" after creating one`);

  /* ---- EX3 (2026-09-09): a client whose stage is Lost says so on the Clients list ---- */
  const r5 = await p.evaluate(() => new Promise((res) => { openLead = null; current = 'clients'; render(); setTimeout(() => {
    const tr = [...document.querySelectorAll('#view tr[data-client-row]')].find((x) => /Probe Client With Lost Stage/.test(x.innerText));
    res({ found: !!tr, health: tr ? tr.getAttribute('data-health') : null, txt: tr ? tr.innerText.replace(/\s+/g, ' ').slice(0, 120) : null }); }, 800); }));
  if (r5.found && r5.health === 'Lost' && /Lost/.test(r5.txt)) ok(`a client whose stage is Lost reads "Lost" on the Clients list, not "Good": "${r5.txt}"`);
  else fail(`Lost client on the Clients list: ${JSON.stringify(r5)} — the live-site Health "Good" beside "Won: converted"`);
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nleads-dash-tiles OK — the dashboard tiles count leads, read on white, and a new lead is new at once');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
