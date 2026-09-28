/* probe-rules-round2.mjs (2026-09-28) — the oversight's Rules round 2 findings and the load-after-sign-in fault, on the
   stand-in (made-up data). DECISIONS D19, D20.
     1. the rules are read only once signed in (every read of money_exclusion_rules carries the person's token, never the
        public key) and the card lists them straight after sign-in — no "No exclusion rules" over real ones;
     2. F4: a rule switched off, on, then removed — "Change log" shows all three edits, labelled with the rule;
     3. F5 / D19: the remove question names the rule, Cancel has focus, the button says "Remove" (red), not "Confirm";
        a non-removal question still says "Confirm"; Arabic says "إزالة";
     4. F1 / D20: dayRiyadh() gives Riyadh's date for a late-evening UTC time, and the Added column uses it;
     5. F2: the sync badge's "last saved" moves when a rule is saved straight to its table;
     6. F3: the Excluded summary counts the active rules;
     7. F6: the Finance tabs, Rules included, sit on one line at 1280 px;
     8. no native dialog, no JS error;
     9. js/118: a 6-second stall on Finance → Rules is named in a note after the reload.
   Sabotage: restore js/117's old load() (no sign-in wait) — check 1 goes red (the first read goes out with the public key).
   PORTS 9711, 9712. */
const natives = [];
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
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.type() + ': ' + d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { }
    window.__notices = []; document.addEventListener('v63-notice', (ev) => window.__notices.push(ev.detail.text)); }, lang);
  const auths = [];
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    if (/money_exclusion_rules/.test(u.pathname) && rq.method() === 'GET') auths.push(String(rq.headers()['authorization'] || ''));
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.v117AddRule === 'function' && (DB.businesses || []).length > 0 && window.__roleKnown === true && window.FIN && FIN.rows && FIN.m, null, { timeout: 150000 });
  await p.waitForTimeout(1500);
  return { p, b, srv, errors, BASE, auths };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };

const tab = async (p, t) => { await p.evaluate((x) => { current = 'finance'; finGo(x); }, t); await p.waitForTimeout(700); };
(async () => {
  console.log('\nEN · admin');
  let s = await session('admin', 'en', 9711);
  let p = s.p;
  await p.setViewportSize({ width: 1280, height: 900 });
  await tab(p, 'rules'); await p.waitForTimeout(800);
  const a1 = await p.evaluate(() => ({ n: document.querySelectorAll('[data-v117-rule]').length, empty: !!document.querySelector('[data-v117-empty="rules"]'), err: MR.err }));
  check(s.auths.length > 0 && s.auths.every((h) => /^Bearer /.test(h) && !/sb_publishable/.test(h)), '1. every read of the rules carries the signed-in token', JSON.stringify(s.auths.map((h) => h.slice(0, 14))));
  check(a1.n > 0 && !a1.empty && !a1.err, '1. the rules are listed straight after sign-in', JSON.stringify(a1));

  const add = await p.evaluate(async () => { const r = await fc().from('money_exclusion_rules').insert({ kind: 'client_id', value: 'QA-77', reason: 'probe' }).select('id'); await new Promise((z) => { MR.rules = null; moneyRulesLoad(z); setTimeout(z, 4000); }); return r.data && r.data[0] && r.data[0].id; });
  const before = await p.evaluate(() => window.__syncBadgeState().lastOk || 0);
  await p.waitForTimeout(1100);
  await p.evaluate((id) => v117SwitchRule(id, false), add); await p.waitForTimeout(300);
  await p.click('#pfConfirmYes'); await p.waitForTimeout(900);   // D19 (28 Sep): switching a rule off asks first
  const after = await p.evaluate(() => window.__syncBadgeState().lastOk || 0);
  check(after > before, '5. F2: the sync badge moves when a rule is saved', before + ' → ' + after);
  await p.evaluate((id) => v117SwitchRule(id, true), add); await p.waitForTimeout(900);
  await p.evaluate((id) => v117RemoveRule(id), add); await p.waitForTimeout(400);
  const box = await p.evaluate(() => { const d = document.getElementById('pfConfirmBox'); if (!d) return null; const y = document.getElementById('pfConfirmYes');
    return { txt: d.innerText, focus: document.activeElement && document.activeElement.id, yes: y.textContent, red: /B42318|rgb\(180, 35, 24\)/i.test(y.getAttribute('style') || '') }; });
  check(!!box && /QA-77/.test(box.txt), '3. D19: the remove question names the rule', JSON.stringify(box));
  check(!!box && box.focus === 'pfConfirmNo', '3. D19: Cancel has the focus', box && box.focus);
  check(!!box && box.yes === 'Remove' && box.red, '3. D19: the button says "Remove", in red — not "Confirm"', box && box.yes);
  await p.click('#pfConfirmYes'); await p.waitForTimeout(1200);
  await p.evaluate(() => v117Log()); await p.waitForTimeout(1500);
  const log = await p.evaluate(() => { const ev = [...document.querySelectorAll('.v115-event')].map((e) => e.innerText.split('\n')[0]); return ev; });
  const mine = log.filter((t) => /QA-77/.test(t));
  check(mine.filter((t) => /edit|Edited|changed|Changed/i.test(t)).length >= 3 && mine.some((t) => /removed/i.test(t)), '2. F4: the change log shows the switch-off, switch-on and removal of the removed rule', JSON.stringify(mine));
  await p.evaluate(() => closeChangeLog && closeChangeLog());
  const q = await p.evaluate(() => { pfConfirm('Save this price?', function () {}); const y = document.getElementById('pfConfirmYes').textContent; document.getElementById('pfConfirmNo').click(); return y; });
  check(q === 'Confirm', '3. a question that removes nothing still says "Confirm"', q);

  const d = await p.evaluate(() => ({ late: dayRiyadh('2026-09-27T21:30:00Z'), early: dayRiyadh('2026-09-27T20:30:00Z'), plain: dayRiyadh('2026-09-27'),
    cells: [...document.querySelectorAll('[data-v117-rule]')].map((tr) => { const id = tr.getAttribute('data-v117-rule'); const r = MR.rules.find((x) => x.id === id); return tr.innerText.includes(dayRiyadh(r.created_at)); }) }));
  check(d.late === '2026-09-28' && d.early === '2026-09-27' && d.plain === '2026-09-27', '4. D20: 21:30 UTC is the next day in Riyadh; 20:30 UTC is not; a plain date stays', JSON.stringify(d));
  check(d.cells.length > 0 && d.cells.every(Boolean), '4. D20: the Added column shows the Riyadh date', JSON.stringify(d.cells));
  const f3 = await p.evaluate(() => { const s = document.querySelector('.v117-excluded summary'); return s ? s.innerText : ''; });
  check(/active rule/.test(f3), '6. F3: the Excluded summary counts the active rules', f3);
  const f6 = await p.evaluate(() => { const bs = [...document.querySelectorAll('[data-fin-tabs] button')]; return { n: bs.length, tops: [...new Set(bs.map((b) => b.offsetTop))], rules: bs.some((b) => /finGo\('rules'\)/.test(b.getAttribute('onclick') || '')) }; });
  check(f6.rules && f6.tops.length === 1, '7. F6: every Finance tab, Rules included, sits on one line at 1280 px', JSON.stringify(f6));
  check(!s.errors.length, '8. no JS errors (EN)', s.errors.slice(0, 3).join(' | '));
  /* 9 — the freeze recorder (js/118): a 6-second stall on the Rules tab, then a reload → the note names it */
  await p.evaluate(() => { const t = Date.now(); while (Date.now() - t < 6000) { /* a stall */ } });
  await p.waitForTimeout(2500);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(9000);
  const bb = await p.evaluate(() => { const n = document.getElementById('v118Note'); return { note: n ? n.innerText : null, last: window.__blackboxLast && { maxGap: window.__blackboxLast.maxGap, page: window.__blackboxLast.page } }; });
  check(!!bb.note && /6 s|Longest pause|ran for/.test(bb.note) && /rules/.test(bb.note), '9. the freeze recorder names a 6-second stall on finance/rules after a reload', JSON.stringify(bb));
  await done(s);

  console.log('\nAR · admin');
  s = await session('admin', 'ar', 9712); p = s.p;
  await tab(p, 'rules'); await p.waitForTimeout(800);
  const ar = await p.evaluate(() => { const id = MR.rules[0] && MR.rules[0].id; v117RemoveRule(id); const y = document.getElementById('pfConfirmYes'); const f = document.activeElement && document.activeElement.id; const t = y ? y.textContent : null; const n = document.getElementById('pfConfirmNo'); if (n) n.click(); return { t, f }; });
  check(ar.t === 'إزالة' && ar.f === 'pfConfirmNo', '3. Arabic: "إزالة", Cancel focused', JSON.stringify(ar));
  check(!s.errors.length, '8. no JS errors (AR)', s.errors.slice(0, 3).join(' | '));
  await done(s);
  check(!natives.length, '8. no native browser dialog opened', natives.join(' | '));
  console.log(failures ? `\nFAILED — ${failures} check(s)` : '\nPASS — round 2 findings fixed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
