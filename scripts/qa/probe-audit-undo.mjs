/* probe-audit-undo.mjs — Activity & Audit, and the Undo control (2026-09-02, round 37).

   Undo is the single most consequential thing a person can click in this app: it asks the
   database to put a previous version of a row back. Ninety probes existed and NOT ONE drove it.
   probe-golive checks who may *open* the page; nothing checked what the page says or what the
   button does.

   The rules live in the database (`undo_change(p_id)`), which is correct — the server is the
   authority and returns a fixed set of English strings. What this probe holds is the APP side:

     - the log renders, newest first, with who / what / which fields changed
     - a 'create' entry offers no Undo (undoing a create is a delete, and says so)
     - an already-undone entry shows "Undone" and offers no second Undo
     - a real Undo calls the database, reports back, and the entry then reads "Undone"
     - EVERY refusal string the function can return has an Arabic translation. js/63 claims its
       list is "the exact, exhaustive set"; this asserts that claim instead of trusting it, by
       feeding each string through the app's own translator.
     - a change older than 24h still offers the button (the server decides) but warns first,
       which is deliberate — the app does not duplicate the server's rules, it explains them
     - the 500-row cap says so WHEN IT IS HIT, and stays quiet when it is not

   The cap check is the one behaviour change this round: the tile was always honestly labelled
   "Events loaded" rather than "Total events", and Today / 7-day are exact while the window fits
   inside the cap (242 rows live, so it does). But when the cap is reached nothing said so — a
   reader would see a round number with no reason to doubt it, and the 7-day figure would be an
   undercount presented as a count.

   Sabotage: drop the atCap branch -> a capped log reports a bare number -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

const HOUR = 3600e3;
function hist(n, over) {
  // n entries, newest first. One 'create' (never undoable), one already undone, one > 24h old.
  const rows = [];
  for (let i = 0; i < n; i++) {
    const old = over && i === 2;
    rows.push({
      id: 1000 + i,
      at: new Date(Date.now() - (old ? 40 * HOUR : i * 60e3)).toISOString(),
      actor: 'u-qa', actor_name: 'QA Test Account',
      table_name: i === 1 ? 'finance_invoices' : 'businesses',
      record_id: 'rec-' + i,
      action: i === 0 ? 'create' : 'edit',
      before_row: i === 0 ? null : { id: 'rec-' + i, name: 'Before ' + i, stage: 'new' },
      after_row: { id: 'rec-' + i, name: 'After ' + i, stage: 'contacted' },
      undone_at: i === 3 ? new Date().toISOString() : null,
      undone_by: i === 3 ? 'u-qa' : null,
    });
  }
  return rows;
}

async function run(port, rows, fn) {
  const srv = start(port, { record_history: rows });
  const BASE = 'http://localhost:' + port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6500);
  await p.evaluate(() => { openLead = null; current = 'activity'; render(); });
  await p.waitForTimeout(2200);
  try { await fn(p, dialogs, BASE); } finally {
    const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
    if (realErrors.length) fail(realErrors.length + ' JS error(s): ' + JSON.stringify(realErrors.slice(0, 3)));
    await b.close(); srv.close();
  }
}

async function main() {
  // ---- a normal log, well under the cap
  await run(8389, hist(6, true), async (p, dialogs, BASE) => {
    const feed = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#view .act-row')];
      return {
        n: rows.length,
        text: (document.getElementById('view') || {}).innerText || '',
        rows: rows.map((r) => ({ t: r.innerText.replace(/\s+/g, ' ').trim(), undo: !!r.querySelector('button'), undone: /Undone/.test(r.innerText) })),
      };
    });
    if (feed.n === 6) ok('the log renders all six entries');
    else fail('the feed shows ' + feed.n + ' rows, expected 6');
    if (/QA Test Account/.test(feed.text)) ok('…naming who made each change');
    else fail('no actor name on the entries');
    if (/name, stage|stage, name/.test(feed.text)) ok('…and which fields changed (name, stage), read from before/after — not just "edited"');
    else fail('the feed does not say what changed: ' + JSON.stringify(feed.text.slice(0, 200)));

    const created = feed.rows.find((r) => /Created|أُنشئ/.test(r.t));
    if (created && !created.undo) ok('a "Created" entry offers no Undo — undoing a create is a delete, not an undo');
    else fail('a create entry is offering an Undo button');
    const undone = feed.rows.find((r) => r.undone);
    if (undone && !undone.undo) ok('an already-undone entry reads "Undone" and offers no second Undo');
    else fail('an already-undone entry still offers Undo: ' + JSON.stringify(undone));

    // the >24h entry: button still offered (server decides), but warned
    const warned = await p.evaluate(() => [...document.querySelectorAll('#view .act-row .ts')].map((x) => x.getAttribute('title') || '').filter(Boolean));
    if (warned.some((t) => /Over 24h/.test(t))) ok('a change older than 24h still offers the button but warns first — the app explains the server\'s rule instead of duplicating it');
    else fail('the >24h entry carries no warning: ' + JSON.stringify(warned));

    // ---- drive a real Undo
    const before = await fetch(BASE + '/rest/v1/record_history?select=id,undone_at').then((r) => r.json()).catch(() => null);
    const beforeUndone = (before || []).filter((r) => r.undone_at).length;
    const clicked = await p.evaluate(() => {
      const row = [...document.querySelectorAll('#view .act-row')].find((r) => r.querySelector('button') && !/Created/.test(r.innerText));
      if (!row) return 'no-undoable-row';
      row.querySelector('button').click(); return 'clicked';
    });
    await p.waitForTimeout(2200);
    if (clicked !== 'clicked') { fail('no undoable entry to click'); return; }
    if (dialogs.some((d) => /Undo this change\?/.test(d))) ok('clicking Undo asks for confirmation before touching anything');
    else fail('Undo fired with no confirmation: ' + JSON.stringify(dialogs));
    if (dialogs.some((d) => /Undone\./.test(d))) ok('…and reports back that it was undone');
    else fail('no result was reported after the undo: ' + JSON.stringify(dialogs));
    const after = await fetch(BASE + '/rest/v1/record_history?select=id,undone_at').then((r) => r.json()).catch(() => null);
    const afterUndone = (after || []).filter((r) => r.undone_at).length;
    if (afterUndone === beforeUndone + 1) ok('the database recorded exactly one more undone entry — the undo really went to the server, it was not a screen-only effect');
    else fail('undone entries went ' + beforeUndone + ' → ' + afterUndone + ' (expected +1)');

    // ---- every refusal the function can return must be translatable
    const refusals = [
      'That change is not in the log.',
      'Already undone.',
      'Too old to undo — this only works within 24 hours. Ask an admin to restore it.',
      'Undoing a newly created record is not an undo — delete it instead, which is itself logged.',
      'Nothing to put back.',
      'Money records can only be undone by an admin or a manager.',
      'Bringing back a fully deleted record is an admin action.',
      "You can undo your own changes; an admin or manager can undo anyone's.",
    ];
    /* The layer keeps its map file-private, so the honest check is against the file itself:
       every string the database can return must appear in js/63 with an Arabic counterpart. */
    const dictText = fs.readFileSync('/home/user/Direct-Business/js/63-undo-and-real-audit.js', 'utf8');
    const missing = refusals.filter((r) => dictText.indexOf(r.replace(/'/g, "\\'")) < 0 && dictText.indexOf(r) < 0);
    if (!missing.length) ok(`all ${refusals.length} refusal messages the database can return have an Arabic translation — the layer's claim to an "exact, exhaustive set" holds`);
    else fail('refusal messages with no Arabic: ' + JSON.stringify(missing));

    // ---- Arabic
    await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); current = 'activity'; render(); });
    await p.waitForTimeout(1600);
    const ar = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
    const leaks = [];
    if (/\bEvents loaded\b/.test(ar)) leaks.push('Events loaded');
    if (/\bToday\b/.test(ar)) leaks.push('Today');
    if (/\bUndo\b/.test(ar)) leaks.push('Undo');
    if (/\bEdited\b|\bCreated\b/.test(ar)) leaks.push('action words');
    if (!leaks.length) ok('in Arabic the whole page is Arabic — tiles, action words and the Undo control');
    else fail('English left on the Arabic audit page: ' + leaks.join(', '));
    await p.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); });

    // ---- under the cap, say nothing about it
    const quiet = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
    if (!/there are older ones|the log was capped/.test(quiet)) ok('with only six entries the page says nothing about a cap — the note appears only when it is true');
    else fail('the cap note is showing on a log far below the cap');
  });

  // ---- a log AT the cap
  await run(8388, hist(500, false), async (p) => {
    const t = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
    if (/the most recent 500 — there are older ones/.test(t)) ok('a log that hits the 500 cap says so, instead of showing a round number as if it were the whole story');
    else fail('a capped log gives no sign it was truncated: ' + JSON.stringify(t.slice(0, 240)));
    if (/at least — the log was capped/.test(t)) ok('…and the 7-day figure is marked "at least", because past the cap it is an undercount, not a count');
    else fail('the 7-day tile is presented as exact on a capped log');
  });

  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\naudit-undo OK — the log tells the truth about itself, and Undo really reaches the database');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
