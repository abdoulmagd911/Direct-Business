/* probe-the-access-editor-admits-what-it-enforces.mjs — a dropdown that offers a permission is
   promising that permission works.

   Fire #189, following #184. Team & Access lets an admin set every person to **No access / Viewer /
   Editor** on each of fifteen pages. Fire #184 measured what "Viewer" actually does, by setting the
   matrix to Viewer everywhere and counting the write controls still offered:

       Airlines    + New airline · Edit       139 typeable fields
       Leads       Convert · + New business · Edit    83
       Suppliers   + New provider              26
       Events      + Add event · Edit · DELETE   5
       …and Clients, Proposals, Operations, Reports, SOP & SLA the same way.

   Nine of the fifteen ignored the setting completely. The only thing on the editor hinting at any of
   this was a green dot with a `title` tooltip naming the three pages the DATABASE enforces —
   invisible on a phone, and answering a different question from the one the admin is asking. This
   project has been bitten by a warning trapped in a hover before (fire #95).

   The editor now says it in words, on the row, and only where it is true: a page set to Viewer that
   does not check the setting is marked "buttons still show" (was "not enforced yet" until the
   database learned the levels in Phase 1b, 2026-09-25), and one sentence underneath names them
   all. The list of pages that DO hold lives in js/52 beside `mayEditPage` — the thing that decides —
   so fixing a page clears the warning by editing one array.

   What this holds:
     1. a page set to Viewer that does not honour it is marked, in visible text (not a tooltip);
     2. a page that DOES honour it is not marked — Finance, Settings, Activity, Archive, the
        Generator and Today;
     3. the same page set to Editor or No access is not marked either: the warning is about relying
        on Viewer, not about the page existing;
     4. one sentence underneath names how many and which;
     5. it says nothing at all when no page is set to Viewer;
     6. the editor still works — every page still offers all three levels and Save is still there;
     7. the marked set is read from js/52, not copied: emptying that list silences every mark rather
        than leaving a second stale copy behind;
     8. in Arabic the mark and the sentence are Arabic;
     9. no JS errors.

   Checks 2, 3, 5 and 7 are the brakes. Marking every row, or marking a page whose setting is
   honoured, or shouting when nobody chose Viewer, would each pass checks 1 and 4 and make the
   screen worse — and 7 is what stops the list becoming a second source that drifts from the truth.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/56's
   `viewerHolds` guard so every Viewer row is marked fails check 2; dropping the mark fails 1 and 4.
   Run: node scripts/qa/probe-the-access-editor-admits-what-it-enforces.mjs                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9210-9213 — four mocks: PORT, PORT+1, PORT+2, PORT+3. Declared because the
   offsets are real ports, which is the whole of fire #188; and 9205 was the first choice until
   check-probe-integrity named it as already inside probe-today-on-the-audit-log's range. */
const PORT = 9210; const BASE = 'http://localhost:' + PORT;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function rows(access, port, opts) {
  opts = opts || {};
  const srv = start(port, {});
  const base = 'http://localhost:' + port;
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(base + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(base + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof window.__axCardProbe === 'function', { timeout: 120000 });
  await p.waitForTimeout(2500);
  if (opts.arabic) { await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }); await p.waitForTimeout(1000); }
  if (opts.blankList) await p.evaluate(() => { try { window.PAGES_VIEWER_ENFORCED = []; } catch (_) {} });

  const out = await p.evaluate((acc) => {
    try { window.__userRole = 'admin'; window.__userTier = 'admin'; window.__roleKnown = true; } catch (_) {}
    /* render the matrix for one made-up teammate, through the layer's own markup function */
    const host = document.createElement('div'); host.id = 'axProbeHost';
    document.getElementById('view').appendChild(host);
    try {
      if (typeof window.__axCardProbe !== 'function') return { noSeam: true };
      host.innerHTML = window.__axCardProbe({ id: 'u-probe', full_name: 'QA Teammate', email: 'q@qa.test', role: 'team_member', active: true, page_access: acc });
    } catch (e) { return { err: e.message }; }
    const marks = [].slice.call(host.querySelectorAll('[data-ax-notheld]'));
    const note = host.querySelector('[data-ax-notheld-note]');
    /* the FIRST select in a card is the person's level (admin/manager/team_member) — the page
       selects are the ones wired to axSet. Counting them all read 16 and compared the level
       dropdown's options against the page levels, which is what the first run of this probe did. */
    const selects = [].slice.call(host.querySelectorAll('select'))
      .filter((sel) => /axSet\(/.test(sel.getAttribute('onchange') || ''));
    const levelSelects = host.querySelectorAll('select').length;
    return {
      markedPages: marks.map((m) => m.getAttribute('data-ax-notheld')),
      markText: marks.length ? (marks[0].textContent || '').trim() : '',
      markVisibleText: marks.length ? (marks[0].textContent || '').trim().length > 0 : false,
      note: note ? (note.textContent || '').replace(/\s+/g, ' ').trim() : '',
      selectCount: selects.length,
      allSelects: levelSelects,
      levelsPerSelect: selects.length ? [].slice.call(selects[0].options).map((o) => o.value) : [],
      ownOpenAnywhere: selects.some((sel) => [].slice.call(sel.options).some((o) => o.value === 'own' && !o.disabled && !o.selected)),
      hasSave: /axSave/.test(host.innerHTML),
    };
  }, access);
  await ctx.close(); srv.close?.();
  return out;
}

/* 2026-09-25 (Phase 1a, D2): the grid covers twenty pages (the fifteen plus Projects, Bookings,
   Invoices, Tickets and Sync) in four levels — none / view / own / full. The person handed to the
   editor below is still drawn in the older stored words ('viewer' / 'editor'), which the editor
   must read exactly as the database does. */
const ALL = ['today', 'leads', 'clients', 'offers', 'documents', 'ops', 'reports', 'finance',
  'settings', 'events', 'airlines', 'vendors', 'sopsla', 'activity', 'archive',
  'projects', 'bookings', 'invoices', 'tickets', 'sync'];
const viewerEverywhere = {}; ALL.forEach((k) => { viewerEverywhere[k] = 'viewer'; });
const editorEverywhere = {}; ALL.forEach((k) => { editorEverywhere[k] = 'editor'; });

const allViewer = await rows(viewerEverywhere, PORT);
const allEditor = await rows(editorEverywhere, PORT + 1);
const blank = await rows(viewerEverywhere, PORT + 2, { blankList: true });
const arab = await rows(viewerEverywhere, PORT + 3, { arabic: true });
await b.close();

const HELD = ['today', 'finance', 'settings', 'activity', 'archive', 'documents'];
const marked = allViewer.markedPages || [];
const hasArabic = (s) => /[؀-ۿ]/.test(s || '');

const checks = [
  ['a Viewer page that does not honour the setting is marked in visible text',
    /* 2026-09-25 (Phase 1b): the database now refuses every change a View person tries, so the old
       mark "not enforced yet" became untrue; what is still true is that the page shows its buttons */
    marked.length > 0 && allViewer.markVisibleText && /buttons still show/i.test(allViewer.markText),
    marked.length + ' marked: ' + marked.join(', ')],
  ['a page that DOES honour it is not marked',
    HELD.every((h) => marked.indexOf(h) < 0),
    HELD.filter((h) => marked.indexOf(h) >= 0).join(', ') || 'none wrongly marked'],
  ['the same pages set to Editor are not marked', (allEditor.markedPages || []).length === 0 && !allEditor.note,
    JSON.stringify({ marks: (allEditor.markedPages || []).length, note: allEditor.note.slice(0, 40) })],
  ['one sentence underneath names how many and which',
    new RegExp('^' + marked.length + ' of the pages set to View ').test(allViewer.note) && /Airlines/.test(allViewer.note),
    allViewer.note.slice(0, 120)],
  ['it says nothing when no page is set to View', allEditor.note === '', JSON.stringify(allEditor.note)],
  ['the editor still works — four levels on every one of the twenty pages, Save still there',
    allViewer.selectCount === ALL.length && allViewer.allSelects === ALL.length + 1 &&
    JSON.stringify(allViewer.levelsPerSelect) === JSON.stringify(['none', 'view', 'own', 'full']) &&
    allViewer.hasSave === true,
    JSON.stringify({ selects: allViewer.selectCount, levels: allViewer.levelsPerSelect, save: allViewer.hasSave })],
  ['"Own work" cannot be chosen on any page yet — no page knows whose records are whose (M55)',
    allViewer.ownOpenAnywhere === false, String(allViewer.ownOpenAnywhere)],
  ['the marked set is read from js/52, not copied — emptying that list silences every mark',
    (blank.markedPages || []).length === 0 && blank.note === '' && blank.selectCount === ALL.length,
    JSON.stringify({ marks: (blank.markedPages || []).length, note: blank.note.slice(0, 30), selects: blank.selectCount })],
  ['in Arabic the mark and the sentence are Arabic',
    hasArabic(arab.markText) && hasArabic(arab.note) && !/buttons still show/i.test(arab.markText) && !/of the pages/i.test(arab.note),
    (arab.markText + ' | ' + arab.note.slice(0, 50))],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
