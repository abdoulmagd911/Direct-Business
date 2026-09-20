/* probe-a-view-only-link-cannot-take-a-copy.mjs — reading a screen is what the link is for; taking
   a copy away is not.

   Fire #166. The panel that mints a share link promises: "A link opens Today, Leads and Clients
   read-only to anyone holding it — no sign-in needed — until it is switched off here. Nothing can
   be edited through it." Measured on a real link: on Leads and on Clients the holder was offered

     · the top bar's **Export ▾** menu — CSV / Excel, summary / full details, always ALL records;
     · and the Leads page's own **"↓ Export this view (CSV)"**, whose file carries each lead's
       owner, next action and contact details.

   Downloading the pipeline is not editing, so the promise was kept to the letter and broken in
   substance: "view-only" does not mean "take a copy of the company's pipeline away with you".

   What this holds:
     1. on Leads, a link holder is offered no top-bar Export menu;
     2. and no "Export this view" button;
     3. the same on Clients;
     4. the pages still READ — rows are there, which is the whole purpose of the link;
     5. signed in, both controls are back: a wall, not a feature removal;
     6. no JS errors.

   Checks 4 and 5 are the brakes. Hiding everything would pass 1-3 and destroy the feature.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing the
   export rule from js/79's stylesheet fails checks 1, 2 and 3.
   Run: node scripts/qa/probe-a-view-only-link-cannot-take-a-copy.mjs                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9117; const BASE = 'http://localhost:' + PORT;
const TOKEN = 'qa-share-copy-token-0123456789abcd';

const srv = start(PORT, { share_links: [{ token: TOKEN, scope: 'all', active: true, created_by: 'u-qa', created_at: new Date().toISOString(), last_used_at: null }] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function look(asShareLink) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push((asShareLink ? 'share' : 'signed-in') + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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

  if (asShareLink) {
    await p.goto(BASE + '/s/' + TOKEN + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => document.body.getAttribute('data-share') === '1' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 60000 });
  } else {
    await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('#cl_email', { timeout: 60000 });
    await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  }
  await p.waitForTimeout(4000);
  const page = async (which) => {
    await p.evaluate((x) => { try { current = x; openLead = null; render(); } catch (_) { } }, which);
    await p.waitForTimeout(2500);
    return p.evaluate(() => {
      const vis = (el) => !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none');
      const v = document.getElementById('view');
      const inView = [].slice.call(v.querySelectorAll('button')).filter(vis)
        .filter((x) => /export/i.test((x.textContent || '')) || /تصدير/.test(x.textContent || ''));
      return { topExport: vis(document.querySelector('.exp-wrap')),
        viewExport: inView.length, rows: v.querySelectorAll('tbody tr').length };
    });
  };
  const leads = await page('leads');
  const clients = await page('clients');
  await ctx.close();
  return { leads, clients };
}

const guest = await look(true);
const staff = await look(false);
await b.close(); srv.close?.();

const checks = [
  ['on Leads, a link holder is offered no top-bar Export menu', !guest.leads.topExport, String(guest.leads.topExport)],
  ['and no "Export this view" button', guest.leads.viewExport === 0, String(guest.leads.viewExport)],
  ['the same on Clients', !guest.clients.topExport && guest.clients.viewExport === 0,
    JSON.stringify(guest.clients)],
  ['the pages still READ — rows are there, which is the whole purpose of the link',
    guest.leads.rows > 0 && guest.clients.rows > 0, JSON.stringify({ leads: guest.leads.rows, clients: guest.clients.rows })],
  ['signed in, both controls are back — a wall, not a feature removal',
    staff.leads.topExport && staff.leads.viewExport > 0, JSON.stringify(staff.leads)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
