/* probe-history-actor-and-sync-words.mjs — guards two wording fixes from the 2026-09-15 live deep-link
   pass (fire #49), both seen by eye on a real client card opened from a pasted address:
     1. js/63 · a history row whose actor the trigger could not name is stored as 'unknown'. On the
        card it read "unknown — last contact" — a ghost edit, or a colleague nobody can name. It is
        neither: the businesses write policy needs a signed-in account, so such a row can only be a
        DIRECT database change (SQL / service role). The row must now say so, in EN and AR, while
        keeping the word "unknown" / "غير معروف".
     2. js/75 · the sync badge on a fresh browser said, in Arabic, "not yet saved on the server"
        (لم يُحفظ على الخادم بعد) where English said the neutral "Not synced yet". Same meaning
        in both languages now: "لم تتم المزامنة بعد".
   Sabotage-tested: restoring the old one-word actorWord() makes checks 1–2 fail; restoring the old
   Arabic badge string makes check 4 fail; exit 1 either way.
   Run: node scripts/qa/probe-history-actor-and-sync-words.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9035;
const now = Date.now();
const ROWS = [
  { id: 6001, at: new Date(now - 60e3).toISOString(), actor: null, actor_name: 'unknown', table_name: 'businesses', record_id: 'rec-z', action: 'edit',
    before_row: { id: 'rec-z', name: 'Quiet Harbor Probe', stage: 'new', raw: { name: 'Quiet Harbor Probe', lastContact: 1786352400000 } },
    after_row: { id: 'rec-z', name: 'Quiet Harbor Probe', stage: 'new', raw: { name: 'Quiet Harbor Probe', lastContact: now } }, undone_at: null, undone_by: null },
  /* 2026-09-15 (fire #53): a refused visit to a page js/15's PAGES list does not know — the Generator —
     read "documents" (the raw key) in both languages; the row must name the page as the sidebar does */
  { id: 6002, at: new Date(now - 120e3).toISOString(), actor: 'u-qa', actor_name: 'QA Test Account', table_name: 'access', record_id: '00000000-0000-4000-8000-000000006002', action: 'denied',
    before_row: null, after_row: { page: 'documents' }, undone_at: null, undone_by: null },
];
const srv = start(PORT, { record_history: ROWS }); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
/* the badge before any save: a fresh browser, nothing attempted */
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.renderActivity === 'function', { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2500);
const badgeEn = await p.evaluate(() => (window.__syncBadgeState ? window.__syncBadgeState().text : ''));
await p.evaluate(() => { openLead = null; current = 'activity'; render(); });
await p.waitForFunction(() => document.querySelector('#view .act-row[data-hist-id="6001"]'), { timeout: 30000 }).catch(() => {});
const rowEn = await p.evaluate(() => { const r = document.querySelector('#view .act-row[data-hist-id="6001"]'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; });
const pageEn = await p.evaluate(() => { const r = document.querySelector('#view .act-row[data-hist-id="6002"]'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; });
await p.evaluate(() => { toggleLang(); }); await p.waitForTimeout(1500);
await p.evaluate(() => { openLead = null; current = 'activity'; render(); });
await p.waitForFunction(() => document.querySelector('#view .act-row[data-hist-id="6001"]'), { timeout: 30000 }).catch(() => {});
const rowAr = await p.evaluate(() => { const r = document.querySelector('#view .act-row[data-hist-id="6001"]'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; });
const pageAr = await p.evaluate(() => { const r = document.querySelector('#view .act-row[data-hist-id="6002"]'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; });
const badgeAr = await p.evaluate(() => (window.__syncBadgeState ? window.__syncBadgeState().text : ''));
await p.evaluate(() => { toggleLang(); });
await b.close(); srv.close?.();

const checks = [
  ['EN: an actor-null row says it was a direct database change, keeping "unknown"', !!rowEn && /unknown — changed directly in the database, not via the app/.test(rowEn)],
  ['AR: the same row says it in Arabic, keeping "غير معروف", with no English "unknown"', !!rowAr && /غير معروف — تغيير مباشر في قاعدة البيانات، ليس عبر التطبيق/.test(rowAr) && !/unknown/.test(rowAr)],
  ['EN: fresh-browser sync badge is the neutral "Not synced yet"', badgeEn === 'Not synced yet'],
  ['AR: fresh-browser sync badge is the neutral "لم تتم المزامنة بعد" (not "not saved on the server")', badgeAr === 'لم تتم المزامنة بعد' && !/يُحفظ/.test(badgeAr)],
  ['EN: a refused visit to the Generator names the page ("Generator"), not the key "documents"', !!pageEn && /Page access · Refused · Generator/.test(pageEn) && !/\bdocuments\b/.test(pageEn)],
  ['AR: the same row names it "المولّد", not "documents"', !!pageAr && /المولّد/.test(pageAr) && !/\bdocuments\b/.test(pageAr)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ rowEn, rowAr, pageEn, pageAr, badgeEn, badgeAr })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
