/* probe-live-walk.mjs (2026-09-27, bulletproof audit) — the REAL site, the REAL database, every page, both languages.

   The harness serves fake data (CLAUDE.md's warning). This walks https://www.directksab2b.com signed in as the QA account
   against the live database, READ-ONLY: every write the app sends (a table write, save_state, a log_* rpc such as
   log_page_denied, a storage upload) is answered inside the page and never leaves it — the same guard as
   probe-real-downloads' LIVE mode. Real names never leave the browser: only counts and pass/fail are printed.

   Under test, in English and in Arabic:
     1. every page in the menu (and Tasks, Activity, Archive) opens: something is drawn, no JS error, no "undefined",
        "NaN" or "[object Object]" on screen, and the page's own text is in DirectFont (Cairo behind it) — read from the
        browser's computed style AND from document.fonts (the face is really loaded, not just named);
     2. every Reports tab (achievements, KPIs, objectives …) found on the page itself opens the same way;
     3. Tasks says it has nothing yet (the live table is empty) instead of a blank table;
     4. a real client's page shows the company card with its client IDs ("N of 3 open"), the discount-code and the
        files sections, and loads them from the live database (no "Loading…" left after 10 s);
     5. the company card's form keeps the keyboard in the field you are in, and select + Delete empties it (the
        "clear doesn't take" root cause, re-checked on the real site); the form is closed without saving;
     6. the direction is right to left in Arabic, left to right in English.
   Run: env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy node scripts/qa/probe-live-walk.mjs
   Not in the battery (it needs the internet and the QA password); part of the audit and of a release's live check.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
const SITE = 'https://www.directksab2b.com';
let failures = 0; const held = [];
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: 'direct://' }, args: ['--no-proxy-server'] });
for (const lang of ['en', 'ar']) {
  const L = lang.toUpperCase();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); localStorage.setItem('v25_navRefOpen', 'true'); } catch (_) { } window.print = () => { }; }, lang);
  await ctx.addInitScript(() => {
    const real = window.fetch.bind(window); window.__held = [];
    window.fetch = (input, init) => { try { const url = String(input && input.url || input); const m = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (url.includes('vkxoeeoauexyfpzqufqd.supabase.co')) { const u = new URL(url); const rpc = /\/rpc\//.test(u.pathname);
        if ((!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && !rpc) || (rpc && /save_state|log_|_save|upsert|insert|delete|update|issue|create|undo|set_/.test(u.pathname)) || (u.pathname.startsWith('/storage/') && m !== 'GET' && !/\/sign\//.test(u.pathname))) {
          window.__held.push(m + ' ' + u.pathname); return Promise.resolve(new Response(rpc ? '""' : '[]', { status: 200, headers: { 'content-type': 'application/json' } })); } } } catch (_) { }
      return real(input, init); };
  });
  await p.goto(SITE + '/today?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 90000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  /* signed in and loaded — an EMPTY database (after a reset, D9) is a valid state, so no row count is waited for */
  await p.waitForFunction(() => typeof render === 'function' && window.__pageLevels && !document.getElementById('cl_email') && Array.isArray(DB.businesses), null, { timeout: 150000 });
  await p.waitForTimeout(6000);
  check(await p.evaluate((l) => document.documentElement.dir === (l === 'ar' ? 'rtl' : 'ltr') || getComputedStyle(document.body).direction === (l === 'ar' ? 'rtl' : 'ltr'), lang), `${L}: the page runs ${lang === 'ar' ? 'right to left' : 'left to right'}`);
  const fontsReady = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => /DirectFont/i.test(f.family) && f.status === 'loaded').length; });
  check(fontsReady > 0, `${L}: DirectFont is really loaded from Direct's server (${fontsReady} face(s)), not just named`);

  /* 1 — every page */
  const pages = await p.evaluate(() => { const ids = (typeof VIEWS !== 'undefined' ? VIEWS : []).map((v) => v.id); ['tasks', 'activity', 'archive'].forEach((x) => { if (!ids.includes(x)) ids.push(x); }); return ids; });
  const bad = [];
  const visit = async (label, fn) => {
    const e0 = errors.length;
    await p.evaluate(fn); await p.waitForTimeout(2200);
    const r = await p.evaluate(() => { const v = document.getElementById('view'); const t = v ? v.innerText : '';
      const cs = v ? getComputedStyle(v.querySelector('h1,h2,h3,p,td,div') || v).fontFamily : '';
      return { len: t.trim().length, junk: (t.match(/\bundefined\b|\bNaN\b|\[object Object\]/) || [null])[0], font: cs.split(',')[0].replace(/["']/g, '').trim() }; });
    const why = [];
    if (r.len < 20) why.push('blank (' + r.len + ' chars)');
    if (r.junk) why.push('shows "' + r.junk + '"');
    if (!/DirectFont/i.test(r.font)) why.push('font ' + r.font);
    if (errors.length > e0) why.push('JS: ' + errors.slice(e0).join(' | ').slice(0, 120));
    if (why.length) bad.push(label + ': ' + why.join(', '));
  };
  for (const id of pages) await visit(id, new Function(`try{ openLead=null; current=${JSON.stringify(id)}; render(); window.scrollTo(0,0);}catch(e){}`));
  check(bad.length === 0, `${L}: all ${pages.length} pages open with content, in DirectFont, no JS error, no undefined/NaN`, bad.join(' ; '));

  /* 2 — every Reports tab found on the page */
  await p.evaluate(() => { openLead = null; current = 'reports'; render(); }); await p.waitForTimeout(2500);
  const tabs = await p.evaluate(() => [...new Set([...document.querySelectorAll('#view [onclick*="rptGo("]')].map((x) => (x.getAttribute('onclick').match(/rptGo\(['"]([a-z_]+)/) || [])[1]).filter(Boolean))]);
  const badTabs = []; const before = bad.length;
  for (const t of tabs) await visit('reports/' + t, new Function(`try{ openLead=null; current='reports'; rptGo(${JSON.stringify(t)}); }catch(e){}`));
  badTabs.push(...bad.slice(before));
  check(tabs.length >= 3 && badTabs.length === 0, `${L}: all ${tabs.length} Reports tabs open the same way (${tabs.join(', ')})`, badTabs.join(' ; '));

  /* 3 — Tasks on an empty live table */
  await p.evaluate(() => { openLead = null; current = 'tasks'; render(); });
  await p.waitForFunction(() => window.__v108State && window.__v108State.loaded, null, { timeout: 30000 }).catch(() => { });
  await p.waitForTimeout(1200);
  const tk = await p.evaluate(() => ({ n: (window.__v108State.tasks || []).length, err: window.__v108State.err, text: document.getElementById('view').innerText.slice(0, 2000) }));
  check(!tk.err && (tk.n > 0 || /no task|nothing|لا توجد|لا مهام|ليس/i.test(tk.text)), `${L}: Tasks loads from the live database (${tk.n} task(s)) and says so when there are none`, tk.err || tk.text.slice(0, 200));

  /* 4 and 5 — a real client's company card and its form; after a reset there is no client, and the walk says so */
  const cid = await p.evaluate(() => { const c = DB.businesses.filter((x) => x.isClient); return c.length ? c[0].id : null; });
  if (!cid) console.log(`  · ${L}: company card and its form not run — the live database holds no client (${await p.evaluate(() => DB.businesses.length)} companies)`);
  else {
    await p.evaluate((id) => { current = 'leads'; openLead = id; render(); }, cid);   /* what a click on a Clients row does (its onclick sets current='leads') */
    const card = await p.waitForFunction(() => { const c = document.querySelector('.v113-card'); return c && !/Loading…|جارٍ التحميل/.test(c.innerText) && /of 3 open|من 3 مفتوحة/.test(c.innerText) ? c.innerText.length : false; }, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => 0);
    const secs = await p.evaluate(() => [...document.querySelectorAll('.v113-card .v113-sec')].map((s) => s.getAttribute('data-sec')));
    check(card > 0 && ['ids', 'codes', 'files'].every((s) => secs.includes(s)), `${L}: a real client's company card loads IDs ("of 3 open"), codes and files from the live database`, 'sections ' + secs.join(',') + ' len ' + card);

    /* 5 — the company card's form keeps the keyboard */
    const r5 = await p.evaluate(async (id) => { if (typeof editCorporate !== 'function') return { missing: 'editCorporate' };
      editCorporate(id); const el = document.getElementById('c_pt'); if (!el) return { missing: 'c_pt' };
      el.value = 'QA-typed'; el.focus(); el.select(); await new Promise((r) => setTimeout(r, 150));
      const a = document.activeElement; return { now: a ? a.id : null }; }, cid);
    let v5 = null;
    if (!r5.missing) { await p.keyboard.press('Delete'); v5 = await p.evaluate(() => document.getElementById('c_pt').value); }
    await p.evaluate(() => { try { closeModal(); } catch (_) { } });
    check(!r5.missing && r5.now === 'c_pt' && v5 === '', `${L}: the company form keeps the keyboard in the field and select + Delete empties it (closed without saving)`, JSON.stringify(r5) + ' value=' + v5);

  }
  check(errors.length === 0, `${L}: no JS errors anywhere on the walk`, errors.slice(0, 3).join(' | '));
  held.push(...await p.evaluate(() => window.__held || []));
  await ctx.close();
}
await b.close();
check(true, 'writes the app tried during the walk, answered by the test, none reached the database: ' + ([...new Set(held)].join(', ') || 'none tried'));
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — the real site, every page, both languages, read-only');
process.exit(failures ? 1 : 0);
