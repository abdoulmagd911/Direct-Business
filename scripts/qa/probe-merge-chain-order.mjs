/* probe-merge-chain-order.mjs (2026-09-08, watch cycle 66) — undoing merges out of order. Attack
   area (aj). Company identity: the family of cycles 40, 43 and 56, where the wrong answer puts one
   company's money on another company's record.

   PORT NOTE: 8701–8735 are taken. This is 8736, verified free by scanning every PORT= in
   scripts/qa.

   The two scenarios in this cycle's brief were checked against the live database functions first
   (read-only, `pg_get_functiondef`), and BOTH are already refused server-side, which is worth
   recording rather than "fixing":
     · double undo — fn_unmerge_businesses selects `where id = p_merge_id and undone_at is null
       for update` and raises "merge not found or already undone";
     · merging into an archived company — fn_merge_businesses raises "the company to keep is
       archived".
   So neither is a defect. What is NOT guarded, on either side, is ORDER.

   Merge B into A. Then merge A into C. Both live in the history with an Undo button each, and
   nothing says they are chained. Undo the FIRST one and its `moved` list moves B's records back
   to B — but those records now sit on C, and undoing the second merge afterwards moves every id
   in ITS list (which includes B's records, since they were on A when A was merged) onto A. B
   silently loses back what it had just been given. The final state depends on the order the
   buttons are pressed, and the screen offers no way to know that.

   The database functions are not this session's to change (P4), and the fix does not need them:
   the history is rendered here, from rows this file already holds, and a merge whose kept company
   has itself been merged away can be recognised before the button is drawn.

   Under test:
     1. Control — an ordinary un-undone merge still offers Undo, and an already-undone one still
        does not. (If this fails the probe is misreading the table.)
     2. THE DEFECT — with B→A and A→C both live, the EARLIER merge must not offer a bare Undo as
        though its result were independent. Either it refuses, or it says the later one has to be
        undone first.
     3. The LATER merge in the chain still offers Undo — it is the one that can be undone safely,
        and a fix that froze the whole history would take away the only way out.
     4. A merge whose chain has already been undone becomes undoable again — the guard must be
        about the CURRENT state, not a permanent mark on the row.

   Run:  node scripts/qa/probe-merge-chain-order.mjs        (port 8736)
   Sabotage: remove the chain guard — check 2 goes red. Assert the sabotage APPLIED with a marker
   unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8736;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';
const E = '55555555-5555-4555-8555-555555555555';
const biz = (id, name, archived) => ({ id, name, is_client: true, archived_at: archived || null, archived_by: archived ? ('merged-into:' + archived) : null, raw: { name, isClient: true } });
const merge = (id, kept, dropped, droppedName, when, undoneAt) => ({
  id, kept_id: kept, dropped_id: dropped, dropped_snapshot: { name: droppedName },
  moved: {}, merged_at: when, actor: 'test@directksa.com', undone_at: undoneAt || null, undone_by: null,
});

/* B→A then A→C, both live: the chain. D→E, undone: the control for check 1 and check 4. */
const srv = start(PORT, {
  businesses: [biz(A, 'Ashcombe Holdings', C), biz(B, 'Brackley Freight', A), biz(C, 'Cotwell Group'), biz(D, 'Dunmarsh Ltd'), biz(E, 'Elverton Partners')],
  business_merges: [
    merge('m-2', C, A, 'Ashcombe Holdings', '2026-09-02T10:00:00Z'),      // later: A merged into C
    merge('m-1', A, B, 'Brackley Freight', '2026-09-01T10:00:00Z'),        // earlier: B merged into A
    merge('m-old', E, D, 'Dunmarsh Ltd', '2026-08-01T10:00:00Z', '2026-08-02T10:00:00Z'),
  ],
});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  if (!(await p.waitForFunction(() => typeof window.v62UnmergeBiz === 'function', { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('v62UnmergeBiz never appeared, so nothing below examined anything');

  await p.evaluate(() => { current = 'finance'; if (window.finGo) finGo('import'); else render(); });   // the guardrails card lives on the Import tab (js/62 inject())
  await p.waitForTimeout(2500);

  /* Read the merge history as it is printed: which rows offer Undo, and what each row says. */
  const readHistory = () => p.evaluate(() => {
    const t = document.querySelector('table.v62-merges');
    if (!t) return { err: 'the merge history table is not on screen' };
    return {
      rows: [].slice.call(t.querySelectorAll('tbody tr')).map((tr) => ({
        kept: (tr.cells[0] || {}).textContent || '', dropped: (tr.cells[1] || {}).textContent || '',
        when: (tr.cells[2] || {}).textContent || '',
        action: ((tr.cells[3] || {}).textContent || '').trim(),
        hasUndo: !!(tr.cells[3] && tr.cells[3].querySelector('button')),
        onclick: (tr.cells[3] && tr.cells[3].querySelector('button') && tr.cells[3].querySelector('button').getAttribute('onclick')) || '',
      })),
    };
  });

  let h = await readHistory();
  for (let i = 0; i < 12 && (h.err || !h.rows.length); i++) { await p.waitForTimeout(700); h = await readHistory(); }
  if (h.err) { fail(h.err + ' — nothing below examined anything'); }
  const row = (dropName) => (h.rows || []).find((r) => new RegExp(dropName).test(r.dropped));
  const earlier = row('Brackley'), later = row('Ashcombe'), undoneRow = row('Dunmarsh');
  note(`history: ${(h.rows || []).map((r) => r.dropped.trim() + '→' + r.kept.trim() + ' [' + (r.hasUndo ? 'Undo' : r.action || 'no button') + ']').join(' | ')}`);

  /* ---- 1. control ---- */
  if (later && later.hasUndo && undoneRow && !undoneRow.hasUndo)
    ok('control: a live merge offers Undo and an already-undone one does not — the table reads as it always did');
  else
    fail(`control: could not read the merge history (later: ${JSON.stringify(later)}, undone: ${JSON.stringify(undoneRow)}) — nothing below can be concluded`);

  /* ---- 2. the defect ---- */
  if (!earlier)
    fail('the earlier merge in the chain is not in the history at all, so nothing could be checked about it');
  else if (!earlier.hasUndo && /Ashcombe|first|later/i.test(earlier.action))
    ok(`the earlier merge in the chain does not offer a bare Undo — it says what has to happen first: "${earlier.action}"`);
  else if (!earlier.hasUndo)
    fail(`the earlier merge offers no Undo and no explanation either (cell reads "${earlier.action}"). Silently removing the only way back is not better than offering it wrongly — it must say the later merge has to be undone first.`);
  else
    fail(`the earlier merge (Brackley Freight → Ashcombe Holdings) offers a plain Undo, with nothing saying Ashcombe has since been merged into Cotwell Group. Undoing it moves Brackley's records off Cotwell; undoing the later merge afterwards moves them straight back onto Ashcombe, because its own moved-list still names them. Which company ends up with the money depends on the order the two buttons are pressed, and the screen gives no way to know that.`);

  /* ---- 3. the later merge is still undoable ---- */
  if (later && later.hasUndo && /m-2/.test(later.onclick))
    ok('the later merge in the chain still offers Undo — it is the one that is safe to undo, and the way out of the chain is not taken away');
  else
    fail(`the later merge no longer offers Undo (${JSON.stringify(later)}). A guard that freezes the whole chain leaves no way to reverse any of it.`);

  /* ---- 4. the guard is about the current state, not a mark on the row ---- */
  /* The later merge is undone, and the page comes back the way it does in the app — v62UnmergeBiz
     ends in location.reload(), and js/62 fetches the merge history once per page session. An
     earlier draft of this check called a window.v62ReloadMerges() that does not exist, so the
     history in memory never changed and the check failed on its own setup rather than on the app.
     This check is a regression guard on the SHAPE of the fix (the guard must read the chain as it
     is now, not stamp the row) rather than an independent finding — worth saying, because it
     could not fail before the guard existed. */
  const after = await p.evaluate(() => fetch('/rest/v1/business_merges?id=eq.m-2', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ undone_at: '2026-09-03T10:00:00Z' }),
  }).then((r) => r.ok).catch(() => false));
  if (after) {
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    try { await p.waitForSelector('#cl_email', { timeout: 20000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
    await p.waitForFunction(() => typeof window.v62UnmergeBiz === 'function', { timeout: 90000 }).catch(() => { });
    await p.evaluate(() => { current = 'finance'; if (window.finGo) finGo('import'); else render(); });
    await p.waitForTimeout(3000);
    const h2 = await readHistory();
    const e2 = (h2.rows || []).find((r) => /Brackley/.test(r.dropped));
    if (e2 && e2.hasUndo)
      ok('once the later merge is undone, the earlier one offers Undo again — the guard reads the current chain rather than marking a row permanently');
    else
      fail(`after the later merge was undone, the earlier one still does not offer Undo (${JSON.stringify(e2)}). The guard must be about the state of the chain now, not a permanent verdict on the row.`);
  } else {
    note('check 4 could not set up (the mock refused the PATCH), so it examined nothing');
  }

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nmerge-chain-order OK — a merge whose kept company has itself been merged away says so instead of offering an Undo that depends on the order it is pressed');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
