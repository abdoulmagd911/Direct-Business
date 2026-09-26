/* probe-the-form-keeps-your-keyboard.mjs (2026-09-26) — a form never takes the keyboard away from the field you are in.

   The root cause of BACKLOG's "the clear doesn't take": two layers (core-06 v21TrapFocus, core-08's openModal wrapper)
   each moved the keyboard to the form's first control 30 ms after it opened — unconditionally. On a busy machine that
   timer lands after the person is already in a field: the keyboard jumps to the close button (×), and the Delete they
   press goes there, so the old value stays (and Enter or Space would close the form). The company-card probe met it as
   a clear that "sometimes did not take" under a loaded battery and retyped around it; that retry is gone now.
   Also: core-08 added one more Tab-trap listener to the form every time a form opened — they piled up.

   Under test (the company card's form and the lead form, English and Arabic):
     1. you are in "Payment terms" the moment the form opens; 100 ms later the keyboard is still there;
     2. select its text and press Delete — the field is empty (the keyboard did not go to the × button);
     3. a form opened with the keyboard outside it still puts the keyboard in the form (the accessibility the timers
        were for is kept);
     4. opening forms six times leaves ONE Tab-trap listener from core-08 on the form, not six.
   Sabotage-tested 2026-09-26: with the two `contains(document.activeElement)` guards taken out, checks 1 and 2 go red;
   with the listener replacement taken out, 4 goes red.
   PORT 9492 (free when written).                                                                                   */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
process.env.MOCK_ROLE = 'admin'; delete process.env.MOCK_PAGE_ACCESS;
const { start } = await import('./mock-supabase.mjs');
const PORT = 9492; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failures = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
for (const lang of ['en', 'ar']) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof editCorporate === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 }); await p.waitForTimeout(1500);
  const L = lang.toUpperCase();
  for (const [form, open, field, val] of [['company card', (id) => editCorporate(id), 'c_pt', 'Net 30'], ['lead form', (id) => editBusiness(id), 'f_next', 'Call back Sunday']]) {
    /* 1 — in the field the moment the form opens (same instant — what a busy machine turns a quick click into) */
    const r1 = await p.evaluate(async ([f, fld, v, fn]) => {
      const id = DB.businesses.find((x) => x.isClient).id; const bz = getLead(id);
      if (fld === 'c_pt') bz.paymentTerms = v; else bz.nextAction = v;
      (0, eval)(fn)(id);
      const el = document.getElementById(fld); if (!el) return { missing: true };
      el.focus(); el.select();
      await new Promise((res) => setTimeout(res, 100));
      const a = document.activeElement; return { value: el.value, now: a ? (a.id || a.className || a.tagName) : null };
    }, [form, field, val, open.toString()]);
    check(!r1.missing && r1.value === val, `${L} ${form}: the form opened with "${val}" in it`, JSON.stringify(r1));
    check(r1.now === field, `${L} ${form}: 100 ms after opening, the keyboard is still in the field you are in`, 'it moved to ' + r1.now);
    /* 2 — the person presses Delete */
    await p.keyboard.press('Delete');
    const v2 = await p.evaluate((fld) => (document.getElementById(fld) || {}).value, field);
    check(v2 === '', `${L} ${form}: select + Delete empties the field (the clear takes)`, 'field still holds "' + v2 + '"');
    await p.evaluate(() => { try { closeModal(); } catch (_) { } }); await p.waitForTimeout(300);
  }
  /* 3 — opened from outside, the form still takes the keyboard */
  const r3 = await p.evaluate(async () => { document.activeElement && document.activeElement.blur && document.activeElement.blur();
    editCorporate(DB.businesses.find((x) => x.isClient).id); await new Promise((res) => setTimeout(res, 150));
    const m = document.getElementById('modal'); const inside = !!(m && m.contains(document.activeElement)); try { closeModal(); } catch (_) { } return inside; });
  check(r3, `${L}: a form opened while the keyboard is outside it still puts the keyboard in the form`);
  /* 4 — one Tab-trap listener, however many times a form opens */
  for (let i = 0; i < 6; i++) { await p.evaluate(() => { editCorporate(DB.businesses.find((x) => x.isClient).id); }); await p.waitForTimeout(80); await p.evaluate(() => { try { closeModal(); } catch (_) { } }); }
  await p.evaluate(() => { editCorporate(DB.businesses.find((x) => x.isClient).id); window.__qaModal = document.getElementById('modal'); });
  const cdp = await ctx.newCDPSession(p);
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__qaModal' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  const kd = listeners.filter((x) => x.type === 'keydown').length;
  check(kd <= 3, `${L}: after seven openings the form carries ${kd} keydown listener(s), not one more per opening`);
  check(errors.length === 0, `${L}: no JS errors`, errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await b.close(); srv.close?.();
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — a form never takes the keyboard from the field you are in; the clear takes');
process.exit(failures ? 1 : 0);
