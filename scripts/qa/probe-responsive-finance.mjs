/* probe-responsive-finance.mjs — phone + tablet pass for the pages the oversight track
   works on (2026-08-26, owner: "I needed to work on tablet and mobile phone and the PC.
   I'm not sure if that's finished.").

   The record says: Round 12 (2026-08-13) ran a phone pass — but BEFORE the Finance rebuild
   and the whole Generator, and its own notes admit "Tablet widths (560-900px) were not
   specifically examined." So Finance's 8 tabs and the Generator's 6 tabs have never been
   measured at phone or tablet width. This probe closes that gap the same way the existing
   harness does everything: real app, mock supabase, real login, real tab clicks.

   Checks per tab per viewport:
     1. No page-level horizontal scroll (documentElement.scrollWidth <= innerWidth+2 —
        wide tables are fine only when they scroll inside their own container).
     2. The offenders, named: any element wider than the viewport whose overflow is not
        contained by a scrollable ancestor.
     3. Tab renders non-trivially (same settle rule as audit-finance-tabs). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8177;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

const VIEWPORTS = [
  { name: 'phone 390x844', width: 390, height: 844 },
  { name: 'tablet 820x1180', width: 820, height: 1180 },
];
const FIN_TABS = ['overview', 'clients', 'ledger', 'reports', 'import', 'expenses', 'proofs', 'b2c'];
const DG_TABS = ['assets', 'offer', 'sfp', 'profile', 'contract', 'tender'];

let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

async function settle(p, ms) {
  const t0 = Date.now(); let prev = null, stable = 0;
  while (Date.now() - t0 < ms) {
    const cur = await p.evaluate(() => (document.getElementById('view') || {}).innerHTML?.length ?? -1);
    if (cur === prev && cur > 60) { if (++stable >= 2) return cur; } else stable = 0;
    prev = cur; await p.waitForTimeout(60);
  }
  return prev;
}

async function overflowReport(p) {
  return p.evaluate(() => {
    const vw = window.innerWidth;
    const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const offenders = [];
    if (docW > vw + 2) {
      const seen = new Set();
      document.querySelectorAll('#view *').forEach((el) => {
        if (offenders.length >= 5) return;
        const r = el.getBoundingClientRect();
        if (r.width <= vw + 2 && r.right <= vw + 2) return;
        // contained by a scrollable ancestor? then it's fine by design
        let a = el.parentElement, contained = false;
        while (a && a !== document.body) {
          const s = getComputedStyle(a);
          if (/(auto|scroll)/.test(s.overflowX) && a.getBoundingClientRect().width <= vw + 2) { contained = true; break; }
          a = a.parentElement;
        }
        if (contained) return;
        const key = el.tagName + '.' + (el.className && el.className.baseVal !== undefined ? '' : String(el.className).split(' ')[0]);
        if (seen.has(key)) return; seen.add(key);
        offenders.push(key + ' w=' + Math.round(r.width));
      });
    }
    return { vw, docW, over: docW > vw + 2, offenders };
  });
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const vp of VIEWPORTS) {
    console.log(`\n===== ${vp.name} =====`);
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push('JS: ' + e.message));
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

    await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(2000);
    await p.fill('#cl_email', 'test@directksa.com');
    await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
    await p.click('#cl_go');
    await p.waitForTimeout(4000);
    await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
    const pre = await p.evaluate(() => (typeof current !== 'undefined' ? current : null));
    if (pre !== 'finance') { fail('preflight: not on finance, viewport ' + vp.name); continue; }

    // 2026-08-27 — added after the fact: the two 26/27 Aug features (Report Builder quick
    // views, Performance's Compare-to) both add markup that the default mock seed never
    // triggers (quick-view highlight math needs a click; the compare table only renders when
    // FIN.p.cmp isn't 'none'). The generic per-tab loop below would silently pass both tabs
    // without ever laying out either widget. Force them on before their tab's check runs.
    await p.evaluate(() => {
      try {
        const mk = (no, y, q, mo, rev, cost) => ({ id: 'resp-' + no, invoice_no: no, client_group: 'RESP CO', customer_raw_name: 'RESP CO',
          invoice_date: y + '-01-05', month: mo, quarter: q, year: y, service_type: 'Hotels', record_type: 'b2b',
          total_incl_vat_sar: rev, revenue_sar: rev, cost_sar: cost, profit_sar: rev - cost, amount_received_sar: rev,
          amount_remaining_sar: 0, wallet_portion_sar: 0, integrity_status: 'verified_paid', deleted_at: null });
        FIN.rows = (FIN.rows || []).concat([mk('RESP-CUR', 2026, 'Q1', 'January', 1000, 400), mk('RESP-YOY', 2025, 'Q1', 'January', 500, 300)]);
        if (typeof clearFinCanon === 'function') clearFinCanon();
      } catch (_) {}
    });

    for (const tab of FIN_TABS) {
      await p.evaluate((t) => { if (window.finGo) finGo(t); }, tab);
      if (tab === 'overview') await p.evaluate(() => { try { FIN.p.year = '2026'; FIN.p.part = 'Q1'; FIN.p.cmp = 'yoy'; render(); } catch (_) {} });
      if (tab === 'reports') await p.evaluate(() => { try { finRBPreset('exec'); } catch (_) {} });
      const len = await settle(p, 6000);
      if (process.env.SABOTAGE) await p.evaluate(() => { var d=document.createElement('div'); d.style.cssText='width:1600px;height:10px'; document.getElementById('view').appendChild(d); });
      const rep = await overflowReport(p);
      if (len <= 60) fail(`finance/${tab}: renders EMPTY at ${vp.name}`);
      else if (rep.over) fail(`finance/${tab}: page scrolls sideways (${rep.docW}px in ${rep.vw}px) — ${rep.offenders.join(' · ') || 'offender escaped the walker'}`);
      else ok(`finance/${tab}: fits ${vp.name}, no sideways scroll`);
      if (tab === 'overview') { const hasCmp = await p.evaluate(() => document.querySelector('#view').innerText.includes('2025 · Q1')); if (hasCmp) ok('finance/overview: Compare-to table actually rendered for this check (not a no-op pass)'); else fail('finance/overview: Compare-to table never rendered — this check would have passed even if the table overflowed'); }
      if (tab === 'reports') { const hasPreset = await p.evaluate(() => document.querySelectorAll('button[onclick^="finRBPreset"].pri').length === 1); if (hasPreset) ok('finance/reports: a quick-view preset was actually active for this check'); else fail('finance/reports: quick-view preset never activated — this check would have passed even if the button row overflowed'); }
    }

    await p.evaluate(() => { current = 'documents'; if (typeof render === 'function') render(); });
    await settle(p, 5000);
    for (const tab of DG_TABS) {
      const okGo = await p.evaluate((t) => { if (window.dgGo) { dgGo(t); return true; } return false; }, tab);
      if (!okGo) { fail('generator/' + tab + ': dgGo missing'); continue; }
      const len = await settle(p, 6000);
      const rep = await overflowReport(p);
      if (len <= 60) fail(`generator/${tab}: renders EMPTY at ${vp.name}`);
      else if (rep.over) fail(`generator/${tab}: page scrolls sideways (${rep.docW}px in ${rep.vw}px) — ${rep.offenders.join(' · ') || 'offender escaped the walker'}`);
      else ok(`generator/${tab}: fits ${vp.name}, no sideways scroll`);
    }
    const realErrors = errors.filter((e) => !/ResizeObserver|favicon/.test(e));
    if (realErrors.length) fail('JS errors at ' + vp.name + ': ' + realErrors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} FAILURE(S) — see above.` : '\nresponsive OK — every finance + generator tab fits phone and tablet with no page-level sideways scroll.');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
