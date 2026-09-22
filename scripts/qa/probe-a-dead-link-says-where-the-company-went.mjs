/* probe-a-dead-link-says-where-the-company-went.mjs — opening a link to a company that is no
   longer in the list says what happened to it, and says nothing when the company is right there.

   Fire #212. Three of the four companies in this workspace's Archive were removed by a MERGE, so
   any link to one of them — a bookmark, a line in an e-mail, a note in another system — is now
   dead. Measured live:

       /leads/lead/<a merged company>   →  the Leads list, URL rewritten to /leads,
                                           2,182 characters of page and not one word about the
                                           company that was asked for.

   Same for a client link, same for an id that never existed. The fallback is deliberate
   (`if(!b){ openLead=null; return renderLeads(v); }`) and the silence is the defect: deleted,
   merged, renamed and mistyped all look identical. The app knows which — the Archive page prints
   it for each of the four — it just never told the person who asked.

   What this holds:
     1. a link to a MERGED company names it, names the company it was merged into, and offers a
        button;
     2. that button opens the surviving company's card;
     3. a company removed by an owner ruling is NOT promised a restore — js/76 refuses the Restore
        button for those, and this says the same thing rather than inventing a second policy;
     4. an id that never existed gets a plain "there is no record at that address";
     5. the brake: a link to a company that IS in the list opens the card and shows NO notice. A
        layer that spoke on every deep link would pass 1-4 and make every normal link annoying;
     6. the merged message reads Arabic in Arabic;
     7. no JS errors.

   The archived rows are answered by this probe rather than the mock, so "merged", "ruled" and
   "never existed" are exact — including the shape seen live, where archived_by carries a suffix:
   'merged-into:<uuid> (was: cleanup-…)'. Reading that with a plain slice() takes the suffix into
   the lookup and the name never resolves; my own first cut of the helper did that, and check 1
   is what caught it.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both real runs:
     · deleting js/103's script line from index.html — fails 1, 2, 3, 4 and 6: no notice at all,
       and the brake (5) still passes, which is what proves 5 is not simply always true;
     · putting the plain slice() back in js/76's merge parser — fails 1, 2 and 6, printing
       “another company” where the survivor's name belongs and leaving no button to click.
   Run: node scripts/qa/probe-a-dead-link-says-where-the-company-went.mjs                         */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9242 — one mock. */
const PORT = 9242; const BASE = 'http://localhost:' + PORT;

const GONE_MERGED = 'qa-gone-merged-0001';
const GONE_RULED = 'qa-gone-ruled-0002';
const NEVER = 'qa-never-existed-9999';
let SURVIVOR = null;                     /* filled from the workspace once it has loaded */
const archivedRows = () => ([
  { id: GONE_MERGED, name: 'QA Merged Away Co', is_client: true, stage: 'won',
    archived_at: '2026-08-22T13:12:00Z', archived_by: 'merged-into:' + (SURVIVOR ? SURVIVOR.uuid : 'unknown') + ' (was: cleanup-aug)' },
  { id: GONE_RULED, name: 'QA Ruled Out Co', is_client: true, stage: 'won',
    archived_at: '2026-08-23T02:51:00Z', archived_by: 'owner-ruling-2026-08-23' }
]);

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', (d) => { try { if (d.type() === 'beforeunload') return d.accept(); } catch (_) {} return d.dismiss(); });
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  /* the archived-companies query — js/76's, the only one asking for rows WITH archived_at set */
  if (m === 'GET' && u.pathname === '/rest/v1/businesses' && /archived_at=not\.is\.null/.test(u.search)) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(archivedRows()) }); return; }
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3500);

/* a real company from this workspace plays the survivor and the "still there" case */
SURVIVOR = await p.evaluate(() => {
  try {
    const b2 = (DB.businesses || []).find((x) => x && x.name); if (!b2) return null;
    return { id: b2.id, name: b2.name, uuid: (window.__bizUuid ? window.__bizUuid(b2.id) : b2.id) };
  } catch (_) { return null; }
});

const openLink = async (path, lang) => {
  await p.evaluate((l) => { try { window.localStorage.setItem('db_lang', l); } catch (_) {} }, lang || 'en');
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  if (lang) await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }, lang);
  await p.waitForFunction(() => window.__bizTableLoaded === true, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(6500);
  return p.evaluate(() => {
    const n = document.getElementById('v63Notice');
    const v = document.getElementById('view');
    return { notice: n ? (n.innerText || '').replace(/\s+/g, ' ').trim() : null,
      buttons: n ? [...n.querySelectorAll('button')].map((x) => (x.textContent || '').trim()) : [],
      hasGo: !!(n && n.querySelector('.v103-go')),
      openLead: (typeof openLead !== 'undefined') ? openLead : null,
      view: v ? (v.innerText || '').replace(/\s+/g, ' ').slice(0, 80) : '' };
  });
};

const merged = await openLink('/leads/lead/' + GONE_MERGED, 'en');
const landed = await p.evaluate(() => { const btn = document.querySelector('#v63Notice .v103-go'); if (!btn) return null; btn.click();
  return new Promise((r) => setTimeout(() => r({ openLead: (typeof openLead !== 'undefined') ? openLead : null, gone: !document.getElementById('v63Notice') }), 1500)); });
const ruled = await openLink('/clients/client/' + GONE_RULED, 'en');
const never = await openLink('/leads/lead/' + NEVER, 'en');
const alive = SURVIVOR ? await openLink('/leads/lead/' + SURVIVOR.id, 'en') : null;
const mergedAr = await openLink('/leads/lead/' + GONE_MERGED, 'ar');
await b.close(); srv.close?.();

const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const checks = [
  ['a link to a merged company names it, names what it was merged into, and offers a button',
    !!merged.notice && /QA Merged Away Co/.test(merged.notice) && !!SURVIVOR && merged.notice.indexOf(SURVIVOR.name) >= 0 &&
    !/another company/i.test(merged.notice) && merged.hasGo,
    JSON.stringify({ notice: merged.notice, survivor: SURVIVOR && SURVIVOR.name })],
  ['that button opens the surviving company\'s card',
    !!landed && !!SURVIVOR && landed.openLead === SURVIVOR.id && landed.gone === true,
    JSON.stringify({ landed, expected: SURVIVOR && SURVIVOR.id })],
  ['a company removed by an owner ruling is not promised a restore',
    !!ruled.notice && /owner ruling/i.test(ruled.notice) && /not brought back/i.test(ruled.notice) && !/bring it back/i.test(ruled.notice),
    JSON.stringify(ruled.notice)],
  ['an id that never existed gets a plain "there is no record at that address"',
    !!never.notice && /no record at that address/i.test(never.notice) && !/merged|deleted on/i.test(never.notice),
    JSON.stringify(never.notice)],
  ['brake: a link to a company that IS in the list opens the card and says nothing',
    !!alive && alive.notice === null && !!SURVIVOR && alive.openLead === SURVIVOR.id,
    JSON.stringify({ notice: alive && alive.notice, openLead: alive && alive.openLead, expected: SURVIVOR && SURVIVOR.id })],
  ['the merged message reads Arabic in Arabic',
    !!mergedAr.notice && arabic(mergedAr.notice) && !/was merged into/i.test(mergedAr.notice) && mergedAr.hasGo,
    JSON.stringify(mergedAr.notice)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
