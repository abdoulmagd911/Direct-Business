/* probe-a-logged-call-reaches-the-list.mjs — a lead whose history lives in the activities TABLE
   shows a last activity on the Leads list, and nothing is written on its account.

   Fire #233. Counted empty cells per column on the live Leads list, across the 78 rows it draws:

       BUSINESS 0/78 · STAGE 0/78 · FUNNEL 0/78 · **LAST ACTIVITY 78/78** ·
       NEXT ACTION 78/78 · OWNER 0/78 · PRIORITY 0/78

   A whole column of dashes — and **25 of those leads have a logged activity**. The row highlight
   that marks a lead nobody has touched for a fortnight fired on 0 of 78, because it tests the same
   field. So the app held the history, and the list said there was none.

   js/02's rowToApp already carries the right rule — "if the raw blob never stored lastContact, take
   the newest logged activity" — but it runs at load, against the blob alone, and these activities
   arrive afterwards from the activities TABLE through the js/72 bridge. The derivation is now
   applied there too, to the records that run just gave activities to.

   THE HALF THAT IS EASY TO GET WRONG, and why this probe checks it twice. js/72's own header
   records what happened the last time this layer created a key on a record: js/02 saw 29 untouched
   companies as CHANGED and rewrote them with this tab's copy. A derived lastContact is exactly that
   hazard, so it is marked `_v72lc` and js/02's stripBridged takes it back out at save time — the
   row still compares equal to what was loaded, the derived value never reaches the database, and a
   real stored lastContact is never overwritten.

   What this holds:
     1. a lead whose only history is in the activities table gets a last activity on the list, and
        the cell shows it rather than a dash;
     2. the value is the NEWEST activity, not the first one found;
     3. a lead with a stored lastContact keeps it — a derivation must never overrule a real value,
        even when an activity is newer;
     4. a lead with no history at all still shows a dash — the column is not filled with guesses;
     5. the "no touch in 14 days" highlight, which reads the same field, now works for such a lead;
     6. the brake: saving writes nothing for a record that only received a derived value — no
        phantom write, and the derived value never lands in the database;
     7. Arabic;
     8. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the derivation removed — fails 1, 2, 5 and 7, the cell back to a dash in both languages;
     · the `_v72lc` mark dropped so stripBridged cannot take the value back out — fails 6, the save
       carrying a record nobody edited.
   Run: node scripts/qa/probe-a-logged-call-reaches-the-list.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9261 — one mock. */
const PORT = 9261; const BASE = 'http://localhost:' + PORT;

const DAY = 86400000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  const wrote = [];
  let acts = [];
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/activities' && m === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(acts) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(m + ' ' + u.pathname.replace('/rest/v1/', '') + ' ' + String(rq.postData() || '').slice(0, 400));
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
  await p.waitForFunction(() => typeof render === 'function' && typeof drawLeads === 'function', { timeout: 120000 });
  await p.waitForFunction(() => { try { return (DB.businesses || []).filter((x) => !x.isClient).length >= 4; } catch (_) { return false; } }, { timeout: 120000 });
  await p.waitForTimeout(2500);

  /* three leads, three situations: history only in the table; a stored lastContact plus a NEWER
     table activity (which must not win); and nothing at all. The uuids are what the bridge keys on. */
  const plan = await p.evaluate(() => {
    /* The record used for the brake must be one this probe has NOT touched, or a save would write
       it for that reason and the check would be measuring the probe instead of the app. So the
       three are CHOSEN from leads that already have no history rather than cleared into that
       state, and only the "kept" one is deliberately given a stored value. */
    const clean = (DB.businesses || []).filter((x) => x && !x.isClient && !x.lastContact
      && !(Array.isArray(x.activities) && x.activities.length));
    if (clean.length < 3) return null;
    const uuid = (b) => { try { return (window.__ROWID && window.__ROWID[b.id]) || b.id; } catch (_) { return b.id; } };
    const stored = Date.now() - 40 * 86400000;
    clean[1].lastContact = stored;                       /* the only mutation the probe makes */
    return { table: { id: clean[0].id, uuid: uuid(clean[0]), name: clean[0].name },
             kept:  { id: clean[1].id, uuid: uuid(clean[1]), name: clean[1].name, stored },
             none:  { id: clean[2].id, uuid: uuid(clean[2]), name: clean[2].name } };
  });
  if (!plan) { await ctx.close(); return { plan: null }; }

  acts = [
    { id: 'qa-a1', business_id: plan.table.uuid, at: iso(30 * DAY), type: 'call', note: 'QA older call', by_user: 'QA' },
    { id: 'qa-a2', business_id: plan.table.uuid, at: iso(20 * DAY), type: 'call', note: 'QA newest call', by_user: 'QA' },
    { id: 'qa-a3', business_id: plan.kept.uuid,  at: iso(2 * DAY),  type: 'note', note: 'QA newer than stored', by_user: 'QA' },
  ];
  /* make the bridge run again now that the route has something to give it */
  await p.evaluate(() => { try { if (typeof window.v72Apply === 'function') window.v72Apply(); } catch (_) {} try { current = 'leads'; openLead = null; render(); } catch (_) {} });
  await p.waitForTimeout(5000);
  await p.evaluate(() => { try { drawLeads(); } catch (_) {} });
  await p.waitForTimeout(1200);

  const seen = await p.evaluate((pl) => {
    const get = (id) => (DB.businesses || []).filter((x) => String(x.id) === String(id))[0] || null;
    const rowOf = (id) => {
      const rows = [].slice.call(document.querySelectorAll('#view table tbody tr'));
      for (const r of rows) {
        const c = r.cells && r.cells[1];
        const h = c ? String(c.getAttribute('onclick') || '') : '';
        if (h.indexOf("'" + id + "'") >= 0) {
          return { last: ((r.cells[4] || {}).innerText || '').replace(/\s+/g, ' ').trim(),
                   stale: /FFF7EC|255, 247, 236/i.test(r.getAttribute('style') || '') };
        }
      }
      return null;
    };
    const one = (k) => { const b = get(pl[k].id); return { lastContact: b ? b.lastContact || null : null,
      marked: b ? b._v72lc === 1 : null, acts: b && b.activities ? b.activities.length : -1, row: rowOf(pl[k].id) }; };
    return { table: one('table'), kept: one('kept'), none: one('none') };
  }, plan);

  /* a save with nothing of the person's changed must carry no business row */
  wrote.length = 0;
  await p.evaluate(() => { try { save(); } catch (_) {} });
  await p.waitForTimeout(3000);
  const afterSave = wrote.slice();
  await ctx.close();
  return { plan, seen, afterSave, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

if (!en.plan || !ar.plan) { console.log('FAIL · the probe could not build its own case — too few leads in the harness'); process.exit(1); }
console.log('  three leads: one with history only in the activities table, one with a stored last contact and a newer table activity, one with nothing');

const t = en.seen.table;
(t.lastContact && t.row && t.row.last && !/^—|^-$/.test(t.row.last))
  ? pass('history that lives only in the activities table reaches the list', JSON.stringify(t.row.last))
  : fail('history that lives only in the activities table reaches the list', JSON.stringify(t));

const newestIsRight = t.lastContact && Math.abs((Date.now() - t.lastContact) / DAY - 20) < 1.5;
newestIsRight
  ? pass('it is the newest activity, not the first one found', Math.round((Date.now() - t.lastContact) / DAY) + ' days ago, from a 30-day-old and a 20-day-old call')
  : fail('it is the newest activity, not the first one found', JSON.stringify({ lastContact: t.lastContact, daysAgo: t.lastContact ? (Date.now() - t.lastContact) / DAY : null }));

const k = en.seen.kept;
(k.lastContact && Math.abs(k.lastContact - en.plan.kept.stored) < 2000 && k.marked !== true)
  ? pass('a stored last contact is kept, even against a newer table activity', Math.round((Date.now() - k.lastContact) / DAY) + ' days ago, as stored')
  : fail('a stored last contact is kept, even against a newer table activity', JSON.stringify({ got: k, wanted: en.plan.kept.stored }));

const n = en.seen.none;
(!n.lastContact && n.row && /^—|^-$/.test(n.row.last))
  ? pass('a lead with no history still shows a dash — no guesses', JSON.stringify(n.row.last))
  : fail('a lead with no history still shows a dash — no guesses', JSON.stringify(n));

(t.row && t.row.stale === true)
  ? pass('the "no touch in 14 days" highlight works for it now — it reads the same field')
  : fail('the "no touch in 14 days" highlight works for it now — it reads the same field', JSON.stringify(t.row));

/* the record that received ONLY a derived value must not be in the payload at all, and no payload
   anywhere may carry the derived field. The "kept" record legitimately is — the probe edited it. */
const carriesTable = en.afterSave.filter((w) => /businesses/.test(w) && w.indexOf('"' + en.plan.table.id + '"') >= 0);
const leaked = en.afterSave.filter((w) => /lastContact/.test(w));
(carriesTable.length === 0 && leaked.length === 0)
  ? pass('brake: a derived value causes no write, and never reaches the database',
    en.afterSave.filter((w) => /businesses/.test(w)).length + ' row payload(s) sent, none of them the derived record')
  : fail('brake: a derived value causes no write, and never reaches the database',
    JSON.stringify({ carriesDerivedRecord: carriesTable.slice(0, 1), leaked: leaked.slice(0, 1) }));

const at = ar.seen.table;
(at.lastContact && at.row && at.row.last && !/^—|^-$/.test(at.row.last) && /[؀-ۿ]/.test(at.row.last))
  ? pass('Arabic', JSON.stringify(at.row.last))
  : fail('Arabic', JSON.stringify(at));

const errs = en.errors.concat(ar.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
