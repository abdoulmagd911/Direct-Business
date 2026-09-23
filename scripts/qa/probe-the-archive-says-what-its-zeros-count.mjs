/* probe-the-archive-says-what-its-zeros-count.mjs — the Archive page's zeros say what they count,
   and its list of deleted companies keeps its reasons.

   Fire #227. The Archive page reads, at the top:

       ARCHIVED INVOICES 0    ARCHIVED BOOKINGS 0    ARCHIVED OFFERS 0    DELETED COMPANIES 4

   Those three zeros count THIS WORKSPACE'S OWN drafts — DB.invoices / DB.bookings / DB.offers —
   which are empty. Measured against the live database the same day, the finance ledger holds 45
   soft-deleted invoices. Somebody who deleted rows on the Finance page and came to the Archive to
   find them reads that zero as "they are gone". They are not: Finance soft-deletes by setting
   deleted_at and restores from its own screen. The zero is true of what it counts and false to the
   person reading it — the same shape as #210's board of zeros and #223's silent count. Today's hub
   already carries this sentence about these collections; this page did not.

   A note on where the fix went, because it cost a wrong edit first: core-06's `renderArchive` still
   contains the original page, but js/76 REPLACES the last card's contents after it draws, so a
   sentence added in core-06 never reaches the screen. The live page is js/76's.

   What this holds:
     1. the page says what those three counts cover, and names Finance as the place the ledger's
        deleted invoices live;
     2. it does not quote a NUMBER for them — the ledger is not loaded on this page, so a figure
        here could only be a second copy drifting out of step (M-family: one number, one owner);
     3. the older sentence about deleted companies is still there — the new line was added beside
        it, not over it;
     4. Arabic;
     5. the brake: a company archived by an ordinary deletion still gets its Restore button, and
        pressing it asks first and sends nothing on Cancel. All four archived companies in the live
        data are merges or an owner ruling, so nothing in the real data exercises that path — the
        probe rewrites one row's reason in the RESPONSE to reach it;
     6. a merged company still shows where it went, and offers no Restore (fire #212);
     7. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · dropping the new sentence — fails 1, 2 and 4;
     · offering Restore on a merged row — fails 6, printing three buttons where there should be
       one: the row then promises something that would resurrect the duplicate the merge removed,
       and the owner-ruled row offers it too.
   Run: node scripts/qa/probe-the-archive-says-what-its-zeros-count.mjs                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9253 — one mock. */
const PORT = 9253; const BASE = 'http://localhost:' + PORT;

/* a synthetic archive: one ordinary deletion, one merge, one owner ruling */
const ARCHIVED = [
  { id: 'qa_arch_plain',  name: 'QAARCH Plain Co',  archived_at: '2026-09-01T10:00:00+00:00', archived_by: 'someone@example.test', is_client: false, stage: 'lost' },
  { id: 'qa_arch_merged', name: 'QAARCH Merged Co', archived_at: '2026-08-02T10:00:00+00:00', archived_by: 'merged-into:qa_arch_plain (was: cleanup-2026-08-02)', is_client: true, stage: 'won' },
  { id: 'qa_arch_ruled',  name: 'QAARCH Ruled Co',  archived_at: '2026-08-23T10:00:00+00:00', archived_by: 'owner-ruling-2026-08-23', is_client: true, stage: 'won' },
];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const open = async (lang) => {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  const sent = [];
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/businesses' && /archived_at=not\.is\.null/.test(u.search) && m === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ARCHIVED) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      sent.push(m + ' ' + u.pathname + ' ' + String(rq.postData() || '').slice(0, 60));
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
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
  await p.goto(BASE + '/archive', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(3500);
  await p.evaluate(() => { try { current = 'archive'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(4200);
  return { ctx, p, errors, sent };
};
const shape = (p) => p.evaluate(() => {
  const v = document.getElementById('view'); if (!v) return { no: true };
  const t = (v.innerText || '');
  /* the SMALLEST element that carries the name — the first version took anything under 400 chars,
     which matched the whole card and reported every row as having the one Restore button on it. */
  const rowOf = (name) => {
    const all = [...v.querySelectorAll('div,tr,li')].filter((e) => (e.innerText || '').indexOf(name) >= 0);
    if (!all.length) return null;
    const el = all.sort((x, y) => (x.innerText || '').length - (y.innerText || '').length)[0];
    return { text: (el.innerText || '').replace(/\s+/g, ' ').trim(), restore: !!el.querySelector('[data-v76-restore]') };
  };
  return {
    finNote: (v.querySelector('[data-v76-note-fin]') || {}).textContent || null,
    oldNote: (v.querySelector('[data-v76-note]') || {}).textContent || null,
    plain: rowOf('QAARCH Plain Co'), merged: rowOf('QAARCH Merged Co'), ruled: rowOf('QAARCH Ruled Co'),
    restoreButtons: v.querySelectorAll('[data-v76-restore]').length,
    text: t,
  };
});

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d && d !== '[]' ? ' — ' + d : ''));

const A = await open('en');
const a = await shape(A.p);
/* press Restore on the ordinary row and CANCEL */
const box = await A.p.evaluate(() => {
  const btn = document.querySelector('[data-v76-restore]'); if (!btn) return { none: true };
  btn.click();
  return new Promise((res) => setTimeout(() => {
    const d = document.getElementById('pfConfirmBox');
    const t = d ? (d.innerText || '').replace(/\s+/g, ' ').trim() : null;
    const n = document.getElementById('pfConfirmNo'); if (n) n.click();
    setTimeout(() => res({ text: t }), 400); }, 900));
});
const sentAfter = A.sent.slice();
await A.ctx.close();
const B_ = await open('ar');
const bb = await shape(B_.p);
await B_.ctx.close();
await b.close(); srv.close?.();

const isAr = (s) => /[؀-ۿ]/.test(String(s || ''));
(a.finNote && /Finance/i.test(a.finNote) && /own drafts|this workspace/i.test(a.finNote))
  ? pass('the page says what those three counts cover, and names Finance', JSON.stringify(String(a.finNote).slice(0, 80)))
  : fail('the page says what those three counts cover, and names Finance', JSON.stringify(a.finNote));
(a.finNote && !/\b\d{2,}\b/.test(a.finNote))
  ? pass('it quotes no number for them — one number, one owner')
  : fail('it quotes no number for them — one number, one owner', JSON.stringify(a.finNote));
(a.oldNote && /archived, never erased|Activity & Audit/i.test(a.oldNote))
  ? pass('the older sentence about deleted companies is still there')
  : fail('the older sentence about deleted companies is still there', JSON.stringify(a.oldNote));
(bb.finNote && isAr(bb.finNote) && bb.oldNote && isAr(bb.oldNote))
  ? pass('Arabic', JSON.stringify(String(bb.finNote).slice(0, 46)))
  : fail('Arabic', JSON.stringify({ fin: bb.finNote, old: bb.oldNote }));
(a.plain && a.plain.restore === true && box.text && /QAARCH Plain Co/.test(box.text) && sentAfter.length === 0)
  ? pass('brake: an ordinary deletion still offers Restore, asks first, sends nothing on Cancel', JSON.stringify(String(box.text).slice(0, 60)))
  : fail('brake: an ordinary deletion still offers Restore, asks first, sends nothing on Cancel',
    JSON.stringify({ row: a.plain, box, sent: sentAfter }));
(a.merged && a.merged.restore === false && /merged into/i.test(a.merged.text) &&
 a.ruled && a.ruled.restore === false && a.restoreButtons === 1)
  ? pass('a merged company shows where it went and offers no Restore (fire #212)', JSON.stringify({ buttons: a.restoreButtons }))
  : fail('a merged company shows where it went and offers no Restore (fire #212)',
    JSON.stringify({ merged: a.merged, ruled: a.ruled, buttons: a.restoreButtons }));
const errs = A.errors.concat(B_.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));
process.exit(bad.length ? 1 : 0);
