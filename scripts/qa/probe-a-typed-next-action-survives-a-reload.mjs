/* probe-a-typed-next-action-survives-a-reload.mjs — a next action typed on a lead card is still
   there after the record is read back, and a note never lands in the date.

   Fire #234. rowToApp mapped these two fields as:

       o.nextActionDate = r.next_action_date || o.nextAction || null;
       o.nextActionNote = r.next_action_note || null;

   Both break the reader's own ordering rule — the one CLAUDE.md states and M26 exists for: the
   blob wins for a field a PERSON edits, the column wins only for fields a pipeline writes. These
   are typed by a person on the lead card, and both ended in `|| null`, so a value in the blob was
   overwritten with nothing whenever the column was empty. A colleague's next action would simply
   not be there on the next load, with nothing said.

   HONEST ABOUT THE STAKES, because this project cares about the difference: this was measured
   live before it was changed, and **nothing is losing anything today**. Exactly one record in the
   database carries a next action, it has both the column and the blob, and it is a client. This is
   a latent fault fixed while it is cheap — not a live one.

   The date had a second problem, and that one is a correctness bug in any data: it fell back to
   `o.nextAction`, which is the note TEXT. A stray "Call the finance team" could land in a field the
   Leads table then renders as a date and compares against today to decide whether it is overdue.

   What this holds:
     1. a next-action NOTE that lives only in the blob survives the read — the column being empty
        does not erase it;
     2. the same for the DATE;
     3. the column still wins when it has a value — a pipeline write is not ignored;
     4. a record with neither ends up with neither, not with something invented;
     5. a note never becomes the date, however it is spelled — the old fallback would have put
        this note straight into the date field;
     6. what the Leads table then shows agrees with what the record holds;
     7. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched), two real runs:
     · the two lines put back to `|| null` — fails 1 and 2, both values gone after the read;
     · the `|| o.nextAction` date fallback put back — fails 2 AND 5: the blob date is lost and the
       note sits in the date field, printed in full. The NOTE check still passes there, which is why
       the two fields are checked separately rather than as one "next action survives".
   Run: node scripts/qa/probe-a-typed-next-action-survives-a-reload.mjs                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9262 — one mock. */
const PORT = 9262; const BASE = 'http://localhost:' + PORT;

const NOTE = 'QA234 call the finance team';
const DATE = '2026-11-20';
const mk = (legacy, raw, col) => Object.assign({
  id: '00000000-0000-4000-8000-00000000000' + legacy.slice(-1), legacy_id: legacy, name: 'QA234 ' + legacy,
  stage: 'new', is_client: false, archived_at: null, raw: raw || {},
  next_action_date: null, next_action_note: null, created_at: '2026-09-01T00:00:00+00:00',
}, col || {});
const ROWS = [
  mk('QA-BLOB',   { nextActionNote: NOTE, nextActionDate: DATE }),
  mk('QA-COLUMN', { nextActionNote: 'blob note', nextActionDate: '2020-01-01' },
     { next_action_note: 'column note', next_action_date: '2030-12-31' }),
  mk('QA-NONE',   {}),
  mk('QA-NOTEONLY', { nextAction: NOTE }),
];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run() {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    /* the four rows go in through the REAL load path — the app's own reader converts them, which
       is the thing under test. Exposing the conversion on window just to call it would be changing
       the app to suit the probe. */
    if (u.pathname === '/rest/v1/businesses' && m === 'GET' && !/archived_at=not/.test(u.search)) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => { try { return (DB.businesses || []).some((x) => String(x.id) === 'QA-BLOB'); } catch (_) { return false; } }, { timeout: 120000 });
  await p.waitForTimeout(2500);

  /* The conversion is what this is about, so the conversion is what is driven: four rows in the
     four states, handed to the app's own reader exactly as the loader hands it one. */
  const out = await p.evaluate(() => {
    const get = (lid) => {
      const b = (DB.businesses || []).filter((x) => String(x.id) === lid)[0];
      return b ? { nextActionNote: b.nextActionNote === undefined ? null : b.nextActionNote,
                   nextActionDate: b.nextActionDate === undefined ? null : b.nextActionDate } : null;
    };
    return { blobOnly: get('QA-BLOB'), columnWins: get('QA-COLUMN'),
             neither: get('QA-NONE'), noteNoDate: get('QA-NOTEONLY') };
  });
  if (!out.blobOnly) { await ctx.close(); return { out: { noReader: true } }; }

  /* and what the table makes of a record in that state */
  const shown = await p.evaluate(({ NOTE, DATE }) => {
    const b = (DB.businesses || []).filter((x) => String(x.id) === 'QA-BLOB')[0]; if (!b) return null;
    b.nextActionNote = NOTE; b.nextActionDate = DATE; delete b.nextAction;
    try { current = 'leads'; openLead = null; drawLeads(); } catch (_) {}
    const rows = [].slice.call(document.querySelectorAll('#view table tbody tr'));
    for (const r of rows) {
      const c = r.cells && r.cells[1];
      if (String((c && c.getAttribute('onclick')) || '').indexOf("'" + b.id + "'") >= 0) {
        return (r.cells[5] || {}).innerText.replace(/\s+/g, ' ').trim();
      }
    }
    return null;
  }, { NOTE, DATE });
  await ctx.close();
  return { out, shown, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const res = await run();
await b.close(); srv.close?.();

if (!res.out || res.out.noReader) { console.log('FAIL · the four rows never reached the app — nothing was checked'); process.exit(1); }
console.log('  four rows loaded through the app\'s own path: blob only, column and blob, neither, and a note with no date');

(res.out.blobOnly.nextActionNote === NOTE)
  ? pass('a note that lives only in the blob survives the read', JSON.stringify(res.out.blobOnly.nextActionNote))
  : fail('a note that lives only in the blob survives the read', JSON.stringify(res.out.blobOnly.nextActionNote));

(res.out.blobOnly.nextActionDate === DATE)
  ? pass('the same for the date', JSON.stringify(res.out.blobOnly.nextActionDate))
  : fail('the same for the date', JSON.stringify(res.out.blobOnly.nextActionDate));

(res.out.columnWins.nextActionNote === 'column note' && res.out.columnWins.nextActionDate === '2030-12-31')
  ? pass('the column still wins when it has a value — a pipeline write is not ignored')
  : fail('the column still wins when it has a value — a pipeline write is not ignored', JSON.stringify(res.out.columnWins));

(res.out.neither.nextActionNote === null && res.out.neither.nextActionDate === null)
  ? pass('a record with neither ends up with neither — nothing is invented')
  : fail('a record with neither ends up with neither — nothing is invented', JSON.stringify(res.out.neither));

(res.out.noteNoDate.nextActionDate === null || !String(res.out.noteNoDate.nextActionDate || '').includes('finance'))
  ? pass('a note never becomes the date', JSON.stringify(res.out.noteNoDate.nextActionDate))
  : fail('a note never becomes the date', JSON.stringify({ date: res.out.noteNoDate.nextActionDate, note: NOTE }));

(res.shown && res.shown.indexOf('QA234') >= 0 && res.shown.indexOf(DATE) >= 0)
  ? pass('the Leads table shows what the record holds', JSON.stringify(res.shown))
  : fail('the Leads table shows what the record holds', JSON.stringify(res.shown));

res.errors.length === 0 ? pass('no JS errors') : fail('no JS errors', res.errors.slice(0, 2).join(' | '));
process.exit(bad.length ? 1 : 0);
