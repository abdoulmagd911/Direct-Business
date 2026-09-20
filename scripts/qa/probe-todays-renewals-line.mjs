/* probe-todays-renewals-line.mjs — a warning nobody passes is not a warning.

   Fire #163. The Generator's Renewals radar is a good instrument and it tells the truth. Driven
   against the live registry on 2026-09-21 it read: ISO 9001 EXPIRED, DUNS EXPIRED, Saudization
   EXPIRED, PCI DSS EXPIRED, Monsha'at 50 days left, **Commercial Registration 85 days left**. Four
   lapsed and the CR itself inside three months — and none of it reaches anybody who does not open
   Generator → Company assets & registry, which is not a page you visit unless you already suspect
   something.

   js/88 puts one line on Today when, and only when, there is something to say: a paper already
   expired, or expiring within sixty days.

   What this holds:
     1. with something expired, the line is on Today and names the most urgent first;
     2. a paper with no expiry date on file is NOT counted — the radar shows those as "date not on
        file" and inventing urgency for them would be the same sin as inventing a number;
     3. a paper comfortably in date does not raise it;
     4. when nothing is expired or near, there is no line at all — this must stay quiet to be worth
        anything on a page people open every morning;
     5. it is for admins and managers: with the role an employee's, the line is not drawn;
     6. it is bilingual;
     7. nothing is written — renewing a certificate happens in the world, not on a card;
     8. no JS errors.

   Check 4 is the one that decides whether this line survives contact with a working registry, and
   check 5 is why seven of the eleven live accounts will never see it.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): letting rows with
   no expiry date into the list fails checks 2 AND 4 — the line then appears on a morning where
   nothing is actually due, which is how a warning stops being read; removing the role gate fails
   check 5.
   Run: node scripts/qa/probe-todays-renewals-line.mjs                                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9114; const BASE = 'http://localhost:' + PORT;

const iso = (days) => { const d = new Date(Date.now() + days * 86400000); return d.toISOString().slice(0, 10); };
const row = (key, label, expires) => ({ id: 'rn-' + key, key: key, category: 'membership', label_en: label,
  label_ar: 'ع-' + label, value_en: 'x', value_ar: null, sort: 1, expires_on: expires, proof_path: null,
  show_on_documents: true, sensitive: false });

const EXPIRED = row('qa_expired', 'QA Expired Certificate', iso(-40));
const SOON = row('qa_soon', 'QA Soon Certificate', iso(20));
const FAR = row('qa_far', 'QA Far Certificate', iso(400));
const NODATE = row('qa_nodate', 'QA No Date Certificate', null);
const ALL = [EXPIRED, SOON, FAR, NODATE];
const QUIET = [FAR, NODATE];

const srv = start(PORT, { company_identity: ALL });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const wrote = [];

async function run(lang, registry, roleOverride) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (/\/rest\/v1\/company_identity/.test(u.pathname) && ['GET', 'HEAD'].includes(m)) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(registry) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(8000);                       /* the registry loads eagerly after sign-in */
  if (roleOverride) await p.evaluate((r) => { try { window.__userRole = r; window.__userTier = (r === 'team_member') ? 'team' : r; } catch (_) { } }, roleOverride);
  await p.evaluate(() => { try { openLead = null; current = 'today'; render(); } catch (_) { } });
  await p.waitForTimeout(2500);
  const out = await p.evaluate(() => {
    const v = document.getElementById('view'); const el = v.querySelector('.v88-renewals');
    return { shown: !!el, txt: el ? (el.innerText || '').replace(/\s+/g, ' ') : '',
      count: v.querySelectorAll('.v88-renewals').length,
      due: (typeof window.__v88Probe === 'function') ? window.__v88Probe() : null };
  });
  await ctx.close();
  return out;
}

const admin = await run('en', ALL, null);
const employee = await run('en', ALL, 'team_member');
const quiet = await run('en', QUIET, null);
const ar = await run('ar', ALL, null);
await b.close(); srv.close?.();

const keys = (o) => ((o.due || []).map((x) => x.label));
/* js/41 auto-matches finance groups on load and that write is blocked at the route; excluded here
   the same way every probe in this battery excludes it. */
const realWrites = [...new Set(wrote)].filter((w) => !/finance_client_links/.test(w));
const checks = [
  ['with something expired, the line is on Today and names the most urgent first',
    admin.shown && /QA Expired Certificate/.test(admin.txt) && (keys(admin)[0] === 'QA Expired Certificate'),
    admin.txt.slice(0, 120)],
  ['a paper with no expiry date on file is NOT counted',
    keys(admin).indexOf('QA No Date Certificate') < 0, JSON.stringify(keys(admin))],
  ['a paper comfortably in date does not raise it',
    keys(admin).indexOf('QA Far Certificate') < 0, JSON.stringify(keys(admin))],
  ['when nothing is expired or near there is no line at all',
    !quiet.shown && (quiet.due || []).length === 0, JSON.stringify(keys(quiet))],
  ['it is for admins and managers — with an employee\'s role the line is not drawn',
    !employee.shown, JSON.stringify(employee.shown)],
  ['it is bilingual', ar.shown && /[؀-ۿ]/.test(ar.txt), ar.txt.slice(0, 80)],
  ['nothing was written', realWrites.length === 0, JSON.stringify(realWrites)],
  ['exactly one line, not one per render', admin.count <= 1, String(admin.count)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
