/* probe-a-tap-beside-the-tick-box-counts.mjs — a target that swallows your tap and does nothing is
   worse than no target.

   Fire #191. Driven at phone width (390 px, touch) against the live database over every page this
   session touched. Most of it held up: nothing scrolls sideways, the wide tables scroll inside their
   own boxes as designed, no JS errors in either language. The row-selection column did not.

     · the tick box on Leads and Suppliers is **13 × 13 px** — the browser default, never styled.
       js/04's pager raised its own controls to a 26 px floor because "these are the controls the
       team hits most on a long list from a phone"; this is half of that.
     · the cell around it is a comfortable **52 × 59 px** and carries
       `onclick="event.stopPropagation()"`, so a stray tap does not open the record. Right instinct —
       but stopping the row handler was all it did.

   So a 52 × 59 area looked tappable, absorbed the tap and did nothing. Miss the 13 px square and
   there is no tick, no navigation and no feedback: you cannot tell a miss from a slow app, so you
   tap again.

   js/100 makes the cell that was already absorbing the tap do the obvious thing. Nothing moves,
   nothing is restyled, no CSS is added — the effective target becomes the 52 × 59 px that was there
   all along, four times the project's own floor.

   What this holds:
     1. a tap in the CORNER of the cell, far from the box, ticks it;
     2. and the app's own selection state changes with it — not just the DOM;
     3. and it does not open the record: the cell still absorbs the tap, which is why it was given
        stopPropagation in the first place;
     4. a tap on the box ITSELF toggles once, not twice;
     5. a cell holding anything besides the box is left alone — a tap meant for a link or a button
        must never be hijacked into ticking something;
     6. Suppliers behaves the same as Leads: the handler is delegated, so this is not a Leads fix;
     7. it ticks again after an untick — a toggle, not a one-way setter;
     8. no JS errors.

   Checks 3, 4 and 5 are the brakes. A handler that navigated, or double-fired, or grabbed every
   cell that happens to contain a control would each pass checks 1, 2, 6 and 7 and be worse than the
   silence it replaced.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): dropping js/100
   fails checks 1, 2, 4 and 6 — 4 because the tap on the box is then the FIRST thing that has
   toggled anything, so the sequence ends the wrong way up; removing its "this cell is only the tick
   box" guard fails check 5, and only 5, which is what a brake is for.
   Run: node scripts/qa/probe-a-tap-beside-the-tick-box-counts.mjs                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9220-9220 — one mock (fire #188's rule; declared even when there is no offset). */
const PORT = 9220; const BASE = 'http://localhost:' + PORT;

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'contacted', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: null, created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: null, needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const BUSINESSES = [];
for (let i = 1; i <= 6; i++) BUSINESSES.push(row({ id: 't' + i, legacy_id: 'T' + i, name: 'QA Tap Target Co ' + i }));

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-GB' });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
await p.waitForTimeout(2500);

/* one page, one probe of the row-selection cell. selName is the app's own selection set. */
async function tapCell(page, boxClass, selName) {
  await p.evaluate((w) => { try { current = w; openLead = null; openSup = null; render(); } catch (_) {} }, page);
  await p.waitForTimeout(2600);
  return p.evaluate(([cls, sel]) => {
    const v = document.getElementById('view');
    /* Re-find the cell and the box EVERY time. Toggling redraws the row, so a reference held
       across an interaction points at a detached node whose `checked` is stale — which is exactly
       what the first run of this probe measured, reporting an untick that had actually worked. */
    const find = () => {
      const c = [].slice.call(document.getElementById('view').querySelectorAll('td'))
        .filter((td) => td.querySelector('input.' + cls))[0];
      return c ? { cell: c, box: c.querySelector('input.' + cls) } : null;
    };
    const first = find();
    if (!first) return { none: true };
    const cell = first.cell; const box = first.box;
    const rect = cell.getBoundingClientRect();
    const state = () => { const f = find(); return f ? f.box.checked : null; };
    const size = (n) => { try { const s = window[n]; return s ? (s.size !== undefined ? s.size : (s.length || 0)) : null; } catch (_) { return null; } };
    const fire = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const out = { cell: { w: Math.round(rect.width), h: Math.round(rect.height) },
      boxSize: { w: Math.round(box.getBoundingClientRect().width), h: Math.round(box.getBoundingClientRect().height) } };
    out.before = { checked: box.checked, sel: size(sel), page: current, open: (typeof openLead !== 'undefined' ? openLead : null) };
    /* the CORNER, 4px in — nowhere near a 13px box */
    const corner = document.elementFromPoint(Math.round(rect.left + 4), Math.round(rect.top + 4));
    out.cornerTag = corner ? corner.tagName : '?';
    fire(corner || cell);
    return new Promise((res) => setTimeout(() => {
      out.afterCorner = { checked: state(), sel: size(sel), page: current, open: (typeof openLead !== 'undefined' ? openLead : null) };
      /* the box itself — once, not twice */
      const f2 = find(); fire(f2 ? f2.box : box);
      setTimeout(() => {
        out.afterBox = { checked: state(), sel: size(sel) };
        /* and the corner again, to tick it back on */
        const f3 = find();
        const r3 = f3 ? f3.cell.getBoundingClientRect() : rect;
        const c2 = document.elementFromPoint(Math.round(r3.left + 4), Math.round(r3.top + 4));
        fire(c2 || (f3 ? f3.cell : cell));
        setTimeout(() => { out.afterSecondCorner = { checked: state(), sel: size(sel) }; res(out); }, 350);
      }, 350);
    }, 400));
  }, [boxClass, selName]);
}

const leads = await tapCell('leads', 'lchk', 'leadSel');
const sups = await tapCell('vendors', 'supchk', 'supSel');

/* a cell that holds a link as well as a box — the handler must keep its hands off */
const mixed = await p.evaluate(() => {
  const v = document.getElementById('view');
  const host = document.createElement('table'); host.id = 'v100mix';
  host.innerHTML = '<tbody><tr><td id="v100cell" style="padding:14px 16px">' +
    '<input type="checkbox" id="v100box"><a href="javascript:void 0" id="v100link">a link</a></td></tr></tbody>';
  v.appendChild(host);
  const cell = document.getElementById('v100cell'); const box = document.getElementById('v100box');
  let linkClicks = 0; document.getElementById('v100link').addEventListener('click', () => { linkClicks++; });
  const before = box.checked;
  const r = cell.getBoundingClientRect();
  const corner = document.elementFromPoint(Math.round(r.left + 4), Math.round(r.top + 4));
  (corner || cell).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return new Promise((res) => setTimeout(() => {
    res({ before, after: box.checked, linkClicks, cornerTag: corner ? corner.tagName : '?' });
    try { host.remove(); } catch (_) {}
  }, 400));
});
await b.close(); srv.close?.();

const ok = (r) => r && !r.none;
const checks = [
  ['a tap in the corner of the cell ticks the box',
    ok(leads) && leads.before.checked === false && leads.afterCorner.checked === true && leads.cornerTag === 'TD',
    JSON.stringify({ cell: leads.cell, box: leads.boxSize, corner: leads.cornerTag, checked: leads.afterCorner && leads.afterCorner.checked })],
  ['and the app\'s own selection changes with it',
    ok(leads) && leads.before.sel === 0 && leads.afterCorner.sel === 1,
    JSON.stringify({ before: leads.before.sel, after: leads.afterCorner.sel })],
  ['and it does not open the record',
    ok(leads) && leads.afterCorner.page === 'leads' && !leads.afterCorner.open,
    JSON.stringify({ page: leads.afterCorner && leads.afterCorner.page, open: leads.afterCorner && leads.afterCorner.open })],
  ['a tap on the box itself toggles once, not twice',
    ok(leads) && leads.afterBox.checked === false && leads.afterBox.sel === 0,
    JSON.stringify(leads.afterBox)],
  ['a cell holding anything else is left alone',
    mixed.after === mixed.before && mixed.linkClicks === 0,
    JSON.stringify(mixed)],
  ['Suppliers behaves the same — the handler is delegated, not written into one page',
    ok(sups) && sups.before.checked === false && sups.afterCorner.checked === true,
    sups.none ? '(no supplier rows)' : JSON.stringify({ cell: sups.cell, checked: sups.afterCorner.checked })],
  ['it ticks again after an untick — a toggle, not a one-way setter',
    ok(leads) && leads.afterSecondCorner.checked === true && leads.afterSecondCorner.sel === 1,
    JSON.stringify(leads.afterSecondCorner)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, okk, d] of checks) { console.log((okk ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!okk) bad++; }
process.exit(bad ? 1 : 0);
