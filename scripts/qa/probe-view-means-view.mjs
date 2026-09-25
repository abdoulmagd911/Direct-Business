/* probe-view-means-view.mjs (2026-09-25, Phase 1) — an employee on View sees no way to change a page,
   on every page that used to say "buttons still show", and can still read everything.

   Why: the database refuses changes from View since Phase 1b, but fourteen pages still offered them.
   js/107 withholds them from the one answer the database gives (mayEditPage). This drives the app as
   an EMPLOYEE whose grid is View on those pages (Today full), then as an employee with Full on the
   same pages for control.

   Under test, as the View employee, on each list page and on a lead, a client, a proposal, a booking,
   an invoice, an airline and a supplier record:
     1. the screen says "View only";
     2. no visible button in the page calls a changing function (the list js/107 guards — read from
        the page itself, so a name added there is checked here);
     3. no enabled field that writes on change (proposal fields, stage picker, NDC/capability pickers),
        and no field open for typing at all except searches, filters and the page-size picker;
     4. a request card still OPENS, read-only: fields disabled, no Save, no Delete;
     5. calling a changing function directly (advanceReq, evDelete, setLeadStage) changes nothing;
     6. the Team & Access editor no longer marks any page "buttons still show" (js/52's list).
   Control, as the Full employee: no "View only", and the New / Edit buttons are there.
   Sabotage (both run 2026-09-25): make js/107's roHere() return false — checks 1–3 go red; make its
   function wrapper always pass the call through — check 5 goes red (the request and the stage change;
   evDelete asks "are you sure?" first and the probe declines, so it cannot show the difference).
   PORT = 9343, 9344, 9346 (free when written).                                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const PAGES = ['leads', 'clients', 'offers', 'ops', 'events', 'airlines', 'vendors', 'sopsla', 'projects', 'bookings', 'invoices', 'tickets', 'sync', 'reports'];

async function session(level, PORT, lang = 'en') {
  process.env.MOCK_ROLE = 'team_member';
  const grid = { today: 'full' }; PAGES.forEach((p) => { grid[p] = level; });
  process.env.MOCK_PAGE_ACCESS = JSON.stringify(grid);
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__pageAccessLoaded === true && window.__pageLevels && typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(2500);
  return { p, b, srv, errors };
}

/* what is on screen now: banner, visible changing buttons, enabled writing fields */
const LOOK = () => {
  const fns = (window.__v107Probe && window.__v107Probe.fns) || [];
  const view = document.getElementById('view');
  const vis = (el) => el.offsetParent !== null && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const bad = [];
  view.querySelectorAll('button[onclick],a.btn[onclick]').forEach((el) => {
    const on = el.getAttribute('onclick') || '';
    const hit = fns.find((n) => on.includes(n + '('));
    if (hit && vis(el)) bad.push(hit + ':' + (el.innerText || '').trim().slice(0, 24));
  });
  const W = /\b(o_set|o_setClient|o_loadClient|o_uploadFile|setLeadStage|setNdc|setNdcNotes|setCap)\(/;
  const fields = [];
  view.querySelectorAll('input,select,textarea').forEach((el) => {
    const h = (el.getAttribute('onchange') || '') + (el.getAttribute('oninput') || '') + (el.getAttribute('onclick') || '');
    if (W.test(h) && !el.disabled && vis(el)) fields.push((el.id || el.tagName) + ':' + h.slice(0, 30));
  });
  /* and ANY field still open for typing that is not a search, a filter or a page-size picker */
  const F = /draw|filter|Filter|Sort|sort|Search|search|rq|pg-size|evF_|fnsel|stgsel|clFilter|leadFilter/;
  [...view.querySelectorAll('input,select,textarea,[contenteditable=true]')].filter((el) => vis(el) && !el.disabled).forEach((el) => {
    const h = (el.id || '') + ' ' + (el.className || '') + ' ' + (el.getAttribute('onchange') || '') + (el.getAttribute('oninput') || '') + (el.getAttribute('onclick') || '') + ' ' + (el.placeholder || '');
    if (!F.test(h) && !fields.some((x) => x.startsWith((el.id || el.tagName) + ':'))) fields.push('open:' + (el.tagName + '#' + el.id + ' ' + h.trim()).slice(0, 50));
  });
  const banner = !!view.querySelector('.v107-banner') && view.hasAttribute('data-v107-ro');
  return { banner, bad, fields, newBtn: [...view.querySelectorAll('button')].filter((x) => vis(x) && /^\+ New|^Edit$|^\+ Add event/.test((x.innerText || '').trim())).length };
};

async function tour(p) {
  const res = {};
  for (const pg of PAGES) {
    res[pg] = await p.evaluate(async ([pg, LOOKs]) => {
      current = pg; openLead = ''; render();
      await new Promise((r) => setTimeout(r, 900));
      return (0, eval)('(' + LOOKs + ')')();
    }, [pg, LOOK.toString()]);
  }
  const details = {
    lead: `const x=DB.businesses.find(b=>!b.isClient&&!b.archived); current='leads'; openLead=x.id; render();`,
    client: `const x=DB.businesses.find(b=>b.isClient&&!b.archived); current='leads'; openLead=x.id; render();`,
    offer: `current='offers'; openLead=''; render(); await new Promise(r=>setTimeout(r,600)); document.querySelector('#view tr[onclick*="openOfferFn"]').click();`,
    booking: `current='bookings'; render(); await new Promise(r=>setTimeout(r,600)); document.querySelector('#view tr[onclick*="openBookingFn"]').click();`,
    invoice: `current='invoices'; render(); await new Promise(r=>setTimeout(r,600)); document.querySelector('#view tr[onclick*="openInvoice"] td:nth-child(2)').click();`,
    airline: `current='airlines'; render(); await new Promise(r=>setTimeout(r,600)); document.querySelector('#view tr[onclick*="openSupFn"] td:nth-child(3)').click();`,
    supplier: `current='vendors'; render(); await new Promise(r=>setTimeout(r,600)); document.querySelector('#view tr[onclick*="openSupFn"] td:nth-child(3)').click();`,
  };
  for (const [k, code] of Object.entries(details)) {
    res['detail:' + k] = await p.evaluate(async ([code, LOOKs]) => {
      try { await (0, eval)('(async()=>{' + code + '})')(); } catch (e) { return { err: String(e) }; }
      await new Promise((r) => setTimeout(r, 1200));
      return (0, eval)('(' + LOOKs + ')')();
    }, [code, LOOK.toString()]);
  }
  return res;
}

/* ---------------- the View employee ---------------- */
{
  const { p, b, srv, errors } = await session('view', 9343);
  const res = await tour(p);
  const noBanner = Object.keys(res).filter((k) => !res[k].banner);
  noBanner.length === 0 ? ok(`"View only" is on all ${Object.keys(res).length} screens (14 pages + 7 records)`) : fail('no "View only" on ' + noBanner.join(', ') + ' — ' + JSON.stringify(noBanner.map((k) => res[k].err || '').filter(Boolean)));
  const btn = Object.keys(res).filter((k) => (res[k].bad || []).length);
  btn.length === 0 ? ok('no visible button calls a changing function, anywhere') : fail('changing buttons still visible: ' + btn.map((k) => k + ' → ' + res[k].bad.slice(0, 4).join(' | ')).join(' ;; '));
  const fld = Object.keys(res).filter((k) => (res[k].fields || []).length);
  fld.length === 0 ? ok('no enabled field that writes on change') : fail('writing fields still enabled: ' + fld.map((k) => k + ' → ' + res[k].fields.slice(0, 3).join(' | ')).join(' ;; '));

  const modal = await p.evaluate(async () => {
    current = 'ops'; openLead = ''; render();
    await new Promise((r) => setTimeout(r, 700));
    const card = document.querySelector('#view .reqcard'); if (!card) return { err: 'no request card' };
    card.click(); await new Promise((r) => setTimeout(r, 500));
    const ov = document.getElementById('ov'), m = document.getElementById('modal');
    const open = ov && ov.classList.contains('show');
    const sv = document.getElementById('mSave'), dl = document.getElementById('mDel');
    const svVis = !!(sv && sv.offsetParent !== null), dlVis = !!(dl && dl.offsetParent !== null);
    const enabled = [...m.querySelectorAll('.mb input,.mb select,.mb textarea')].filter((x) => !x.disabled).length;
    const note = !!m.querySelector('.v107-note');
    try { closeModal(); } catch (_) { }
    return { open, svVis, dlVis, enabled, note };
  });
  (modal.open && !modal.svVis && !modal.dlVis && modal.enabled === 0 && modal.note)
    ? ok('a request still opens to read — every field locked, no Save, no Delete, and it says why') : fail('request read-only view: ' + JSON.stringify(modal));

  const direct = await p.evaluate(async () => {
    const r0 = JSON.stringify(DB.requests || []), e0 = JSON.stringify(DB.ksaEvents || []);
    const lead = DB.businesses.find((b) => !b.isClient && !b.archived); const st0 = lead.stage;
    try { const r = (DB.requests || [])[0]; if (r) advanceReq(r.id, { stopPropagation() { } }); } catch (_) { }
    try { const e = (DB.ksaEvents || [])[0]; if (e) evDelete(e.id); } catch (_) { }
    try { setLeadStage(lead.id, lead.stage === 'Won' ? 'Lost' : 'Won'); } catch (_) { }
    await new Promise((r) => setTimeout(r, 400));
    return { req: JSON.stringify(DB.requests || []) === r0, ev: JSON.stringify(DB.ksaEvents || []) === e0, stage: getLead(lead.id).stage === st0, nReq: (DB.requests || []).length, nEv: (DB.ksaEvents || []).length };
  });
  (direct.req && direct.ev && direct.stage && direct.nReq > 0 && direct.nEv > 0)
    ? ok('calling advanceReq / evDelete / setLeadStage directly changes nothing') : fail('direct calls changed something: ' + JSON.stringify(direct));

  const marks = await p.evaluate(() => (window.PAGES_VIEWER_ENFORCED || []).slice());
  const missing = PAGES.filter((x) => marks.indexOf(x) < 0);
  missing.length === 0 ? ok('the access editor has no page left to mark "buttons still show"') : fail('still unmarked: ' + missing.join(', '));
  errors.length === 0 ? ok('View employee: no JS errors') : fail('View employee JS errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close?.();
}

/* ---------------- the same, in Arabic ---------------- */
{
  const { p, b, srv, errors } = await session('view', 9346, 'ar');
  const ar = await p.evaluate(async () => {
    current = 'leads'; openLead = ''; render(); await new Promise((r) => setTimeout(r, 900));
    const bn = document.querySelector('#view .v107-banner');
    return { text: bn ? bn.textContent : null, dir: bn ? bn.getAttribute('dir') : null };
  });
  (ar.text && /مشاهدة فقط/.test(ar.text) && /العملاء المحتملون/.test(ar.text) && ar.dir === 'rtl')
    ? ok('in Arabic the screen says «مشاهدة فقط», names the page in Arabic, right to left') : fail('Arabic banner: ' + JSON.stringify(ar));
  errors.length === 0 ? ok('Arabic: no JS errors') : fail('Arabic JS errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close?.();
}

/* ---------------- control: the Full employee ---------------- */
{
  const { p, b, srv, errors } = await session('full', 9344);
  const res = await tour(p);
  const banners = Object.keys(res).filter((k) => res[k].banner);
  banners.length === 0 ? ok('control: with Full control no screen says "View only"') : fail('Full employee sees "View only" on ' + banners.join(', '));
  const withNew = ['leads', 'offers', 'ops', 'events', 'airlines', 'vendors', 'sopsla', 'projects'].filter((k) => res[k].newBtn > 0);
  withNew.length === 8 ? ok('control: New / Edit buttons are there with Full control (8 of 8 pages checked)') : fail('control: New/Edit missing with Full on ' + ['leads', 'offers', 'ops', 'events', 'airlines', 'vendors', 'sopsla', 'projects'].filter((k) => !withNew.includes(k)).join(', '));
  errors.length === 0 ? ok('Full employee: no JS errors') : fail('Full employee JS errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close?.();
}
console.log(failures ? 'FAILED — ' + failures : 'view-means-view OK — on View every page shows no way to change it, records still open to read, and Full control is untouched');
process.exit(failures ? 1 : 0);
