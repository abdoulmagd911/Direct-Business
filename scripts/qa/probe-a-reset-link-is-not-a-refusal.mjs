/* probe-a-reset-link-is-not-a-refusal.mjs — the Activity & Audit page tells a password-reset link an
   admin sent apart from a refused page visit, names it in both languages, and says "merged into" in
   Arabic when a company was merged.

   Fire #265. Driven on the live Activity page against the real log (394 rows): the access table
   holds two kinds of row — a refused page visit (action 'denied', what js/64 writes) and a
   password-reset link sent from the Team page (action 'reset_link_sent'). The page counted both as
   refusals ("147 refused page visits hidden" — 145 were), hid the two reset rows behind that badge,
   and when shown printed them as "Page access · reset_link_sent" — the raw key, in English and in
   Arabic — with no name. And a company merged into another had its change described as "merged
   into" in English on the Arabic page, because the field the merge writes (raw.mergedInto) was the
   one field in the whole live log the dictionary did not know.

   Now js/63 decides a refusal by its ACTION (isRefusal), labels the reset row "Account · Password
   reset link sent · <email>" / «الحساب · أُرسل رابط إعادة تعيين كلمة المرور», and knows mergedInto.

   The rows are fed to the page by the probe (record_history is answered here, synthetic names and
   addresses only — rule 7), so nothing depends on the seed.

   What this holds, in EN and in AR:
     1. the default feed shows the two reset rows, each reading Account · Password reset link sent ·
        its address, and no row anywhere prints the raw key;
     2. the badge counts the three refusals only ("3 refused page visits hidden"), and the
        Events-loaded tile says 3 of these were refused — not 5;
     3. the merged company's row describes the change as "merged into" / «دُمجت في»;
     4. "Show" brings every row (7) into the feed; "Hide" takes the three refusals back out;
     5. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): the tree before
   this fire — fails 1, 2, 3 and 4 (the old tree hid the reset rows too, so the default feed held two
   rows, not four); 5 stays green.
   Run: node scripts/qa/probe-a-reset-link-is-not-a-refusal.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9317 — one mock. */
const PORT = 9317; const BASE = 'http://localhost:' + PORT;

const DAY = 86400000; const now = Date.now(); const iso = (ago) => new Date(now - ago).toISOString();
const ROWS = [
  { id: 911, at: iso(2 * DAY), actor: null, actor_name: 'QA Rig', table_name: 'access', record_id: 'x1', action: 'denied', after_row: { page: 'settings' }, before_row: null, undone_at: null },
  { id: 912, at: iso(2 * DAY + 60000), actor: null, actor_name: 'QA Rig', table_name: 'access', record_id: 'x2', action: 'denied', after_row: { page: 'finance' }, before_row: null, undone_at: null },
  { id: 913, at: iso(2 * DAY + 120000), actor: null, actor_name: 'QA Rig', table_name: 'access', record_id: 'x3', action: 'denied', after_row: { page: 'reports' }, before_row: null, undone_at: null },
  { id: 914, at: iso(3 * DAY), actor: null, actor_name: 'QA Admin', table_name: 'access', record_id: 'u1', action: 'reset_link_sent', after_row: { target_email: 'qa-one@example.test' }, before_row: null, undone_at: null },
  { id: 915, at: iso(3 * DAY + 5000), actor: null, actor_name: 'QA Admin', table_name: 'access', record_id: 'u2', action: 'reset_link_sent', after_row: { target_email: 'qa-two@example.test' }, before_row: null, undone_at: null },
  { id: 916, at: iso(10 * DAY), actor: null, actor_name: 'Someone', table_name: 'businesses', record_id: 'b1', action: 'edit', undone_at: null,
    before_row: { id: 'b1', name: 'QA Merged Co', archived_at: null, archived_by: null, raw: { name: 'QA Merged Co' } },
    after_row: { id: 'b1', name: 'QA Merged Co', archived_at: iso(10 * DAY), archived_by: 'merged-into:b2', raw: { name: 'QA Merged Co', mergedInto: 'b2' } } },
  { id: 917, at: iso(40 * DAY), actor: null, actor_name: 'Someone', table_name: 'businesses', record_id: 'b3', action: 'create', before_row: null, after_row: { id: 'b3', name: 'QA Created Co' }, undone_at: null },
];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method(); const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/record_history' && m === 'GET') { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { current = 'activity'; openLead = null; try { histRefresh(); } catch (_) { render(); } });
  await p.waitForFunction(() => document.querySelectorAll('#view .v63-row').length > 0, { timeout: 30000 });
  await p.waitForTimeout(800);
  const read = () => p.evaluate(() => {
    const v = document.getElementById('view'); const txt = (e) => (e.innerText || '').replace(/\s+/g, ' ').trim();
    const rows = [...v.querySelectorAll('.v63-row')].map(txt);
    const badge = v.querySelector('[data-hist-denied]');
    const kl = [...v.querySelectorAll('.kl')].find((k) => /Events loaded|الأحداث المحمّلة/.test(k.textContent || ''));
    const tile = kl ? (kl.parentNode.textContent || '').replace(/\s+/g, ' ').trim() : null;
    return { rows, badge: badge ? { state: badge.getAttribute('data-hist-denied'), text: txt(badge) } : null, tile };
  });
  /* the page opens with refusals shown (fire #241); hide them for the default-feed reading */
  const opened = await read();
  if (opened.badge && opened.badge.state === 'shown') { await p.evaluate(() => histToggleDenied()); await p.waitForTimeout(800); }
  const hidden = await read();
  await p.evaluate(() => histToggleDenied()); await p.waitForTimeout(800);
  const shown = await read();
  await p.evaluate(() => histToggleDenied()); await p.waitForTimeout(800);
  const again = await read();
  await ctx.close();
  return { hidden, shown, again, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  7 synthetic history rows fed to the page: 3 refusals, 2 reset links, 1 merge, 1 creation');

const resetEn = en.hidden.rows.filter((t) => /Account · Password reset link sent · qa-(one|two)@example\.test/.test(t));
const resetAr = ar.hidden.rows.filter((t) => /الحساب · أُرسل رابط إعادة تعيين كلمة المرور · qa-(one|two)@example\.test/.test(t));
const rawAny = en.hidden.rows.concat(ar.hidden.rows, en.shown.rows, ar.shown.rows).filter((t) => /reset_link_sent|Page access · Password|الوصول إلى صفحة · أُرسل/.test(t));
(resetEn.length === 2 && resetAr.length === 2 && rawAny.length === 0)
  ? pass('the default feed shows both reset rows as "Account · Password reset link sent · <address>" in each language, never the raw key')
  : fail('the default feed shows both reset rows as "Account · Password reset link sent · <address>" in each language, never the raw key', JSON.stringify({ resetEn, resetAr, rawAny: rawAny.slice(0, 2), sample: en.hidden.rows.slice(0, 3) }));

(en.hidden.badge && /^3 refused page visits hidden/.test(en.hidden.badge.text) && /3 of these were refused page visits/.test(en.hidden.tile || '')
  && ar.hidden.badge && /^3 زيارة مرفوضة لصفحات مخفية/.test(ar.hidden.badge.text) && /3 منها زيارات مرفوضة/.test(ar.hidden.tile || ''))
  ? pass('the badge and the tile count the three refusals only, in each language')
  : fail('the badge and the tile count the three refusals only, in each language', JSON.stringify({ en: [en.hidden.badge, en.hidden.tile], ar: [ar.hidden.badge, ar.hidden.tile] }));

const mergeEn = en.hidden.rows.find((t) => /QA Merged Co/.test(t)) || ''; const mergeAr = ar.hidden.rows.find((t) => /QA Merged Co/.test(t)) || '';
(/merged into/.test(mergeEn) && /دُمجت في/.test(mergeAr) && !/merged into/.test(mergeAr))
  ? pass('the merged company\'s row says "merged into" / «دُمجت في»')
  : fail('the merged company\'s row says "merged into" / «دُمجت في»', JSON.stringify({ mergeEn, mergeAr }));

(en.hidden.rows.length === 4 && en.shown.rows.length === 7 && en.again.rows.length === 4 && ar.hidden.rows.length === 4 && ar.shown.rows.length === 7 && ar.again.rows.length === 4)
  ? pass('"Show" brings all 7 rows into the feed and "Hide" takes the three refusals back out')
  : fail('"Show" brings all 7 rows into the feed and "Hide" takes the three refusals back out', JSON.stringify({ en: [en.hidden.rows.length, en.shown.rows.length, en.again.rows.length], ar: [ar.hidden.rows.length, ar.shown.rows.length, ar.again.rows.length] }));

const errs = en.errors.concat(ar.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
