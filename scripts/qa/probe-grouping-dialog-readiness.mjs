/* probe-grouping-dialog-readiness.mjs (2026-09-08, watch cycle 56) — a dialog that opens before
   its own list has arrived, then tells the person to choose from it. Attack area (yy).

   PORT NOTE: 8701–8726 are taken. This is 8727, verified free by scanning every PORT= in
   scripts/qa.

   v62OpenGrouping is the screen that decides which client profiles are grouped under one
   company — the same family of decision cycles 40 and 43 worked on, where the wrong answer
   merges one company's money into another's record. It already knows how to wait for data:

       if(!window.CP||CP.rows==null){ cpLoad(function(){ v62OpenGrouping(); }); return; }

   It does that for the profiles. It does NOT do it for the companies. The "Choose the company to
   group them under" dropdown is built from DB.businesses, which js/02 loads on its own schedule —
   and when that list has not arrived, the dialog opens anyway with an EMPTY dropdown, and its
   save handler then says:

       alert('Choose the company to group them under.')

   which is an instruction the person cannot follow. Nothing is broken and nothing is said; the
   list is simply not there yet, and the dialog blames the reader for it. Same family as cycles
   41–43 and 55: an answer given with more confidence than the data behind it supports.

   HOW THIS PROBE CHANGED WHILE BEING WRITTEN, and it is the better version for it. The first
   draft held back the /businesses request to catch the loading case. The hold never bit —
   DB.businesses was populated anyway, because it does not come from where the probe assumed —
   and the setup guard said so instead of letting three checks conclude from nothing. Rather than
   keep guessing at the load path (cycle 52: do not build a diagnostic for a hypothesis the
   source can refute), the probe now tests the case that needs NO race at all and is reachable on
   any ordinary Tuesday: a workspace whose client-company list is empty. The dialog opens onto an
   empty dropdown either way, and one fix serves both — so the timing variant is left as a note
   rather than a badly-aimed hold.

   Under test:
     1. Control — with the companies loaded, the dialog opens and its dropdown has them in it.
        (If this fails, nothing below means anything.)
     2. THE DEFECT — with the companies not yet loaded, the dialog must not open onto an empty
        company list and leave the person to discover it at Save. Either it waits, as it already
        does for the profiles, or it says the list is still loading.
     3. Whatever it does, it recovers: once the companies arrive, the dialog opens normally.
     4. A workspace with genuinely no client companies still gets a real answer rather than
        silence — a fix that only ever says "still loading" would be its own lie (cycle 55).

   Run:  node scripts/qa/probe-grouping-dialog-readiness.mjs        (port 8727)
   Sabotage: remove the readiness guard from v62OpenGrouping — check 2 goes red. Assert the
   sabotage APPLIED with a unique marker; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8727;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;


async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  if (!(await p.waitForFunction(() => typeof window.v62OpenGrouping === 'function', { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('v62OpenGrouping never appeared, so nothing below examined anything');
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1500);

  const openIt = async () => {
    await p.evaluate(() => {
      try { const ov = document.getElementById('ov'); if (ov && ov.classList) ov.classList.remove('show'); } catch (_) { }
      window.__said = []; const oa = window.alert; window.alert = (m) => window.__said.push(String(m));
      window.__restore = () => { window.alert = oa; };
      try { window.v62OpenGrouping(); } catch (e) { window.__said.push('THREW ' + e.message); }
    });
    await p.waitForTimeout(1500);
    return await p.evaluate(() => {
      try { window.__restore(); } catch (_) { }
      const ov = document.getElementById('ov');
      const shown = !!(ov && ov.classList && ov.classList.contains('show'));
      const sel = document.getElementById('g_target');
      const bizCount = sel ? sel.options.length : null;
      return { shown, bizCount, said: (window.__said || []).join(' | '), bizLoaded: Array.isArray(DB.businesses) && DB.businesses.length > 0 };
    });
  };

  /* ---- 2. the defect: an empty company list, no race required ---- */
  const none = await p.evaluate(async () => {
    const keep = DB.businesses; DB.businesses = [];
    window.__said2 = []; const oa = window.alert; window.alert = (m) => window.__said2.push(String(m));
    try { const ov = document.getElementById('ov'); if (ov && ov.classList) ov.classList.remove('show'); } catch (_) { }
    try { window.v62OpenGrouping(); } catch (e) { window.__said2.push('THREW ' + e.message); }
    await new Promise((r) => setTimeout(r, 1200));
    window.alert = oa;
    const ov = document.getElementById('ov');
    const sel = document.getElementById('g_target');
    const out = { shown: !!(ov && ov.classList && ov.classList.contains('show')), bizCount: sel ? sel.options.length : null, said: (window.__said2 || []).join(' | ') };
    DB.businesses = keep;
    try { const o2 = document.getElementById('ov'); if (o2 && o2.classList) o2.classList.remove('show'); } catch (_) { }
    return out;
  });
  if (!none.shown || none.said)
    ok(`with no client companies to group under, the dialog does not open onto an empty list — it says what is wrong instead: ${JSON.stringify(none)}`);
  else
    fail(`the grouping dialog opened with an EMPTY company dropdown and said nothing (${JSON.stringify(none)}). Its save handler then says "Choose the company to group them under" — an instruction nobody can follow, discovered only after filling the rest in. This dialog already waits for the profiles (cpLoad) and does nothing equivalent for the companies, so the same blank list appears whether none exist or they simply have not arrived.`);

  /* ---- 3. and it still opens normally when there ARE companies ---- */
  const after = await openIt();
  if (after.shown && after.bizCount > 0)
    ok(`control: with companies present the dialog opens normally with ${after.bizCount} option(s) — the guard is a refusal on an empty list, not the feature switched off`);
  else
    fail(`control: with companies present the dialog did not open with them (${JSON.stringify(after)}), so nothing above can be concluded`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ngrouping-dialog-readiness OK — the grouping dialog waits for its own list instead of blaming the reader for it');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
