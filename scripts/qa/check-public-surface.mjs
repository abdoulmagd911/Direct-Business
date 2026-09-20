/* check-public-surface.mjs — what this project hands to somebody who has not signed in.
   Run: node scripts/qa/check-public-surface.mjs     (needs network; no secret of any kind)

   WHY THIS EXISTS. Every probe in the battery drives the app. Not one of them can see the live
   project's own settings, so 250 green probes said nothing about any of this. One sweep
   (2026-09-20, fires #131, #133, #134, #136) found four separate doors standing open:

     · two leftover backup tables from a 2026-09-09 clean-up with row-level security switched OFF —
       a full workspace snapshot, readable by anyone;
     · payment-proofs and expenses, the two storage buckets that hold documents for real money,
       marked public with a read policy that had no condition at all;
     · the manual-confirm function, holding the service-role key with no sign-in, able to PATCH any
       company or contact by id;
     · the `app` edge function still serving a 1 MB, sign-in-capable copy of the application that
       called save_state — the whole-blob write — so an old bookmark could overwrite everyone's work.

   All four were found by hand, with curl, one at a time. This is that search turned into one
   command, so the next session re-checks in a minute instead of rediscovering it.

   IT USES NO SECRET. It reads the publishable key out of the app's own page — the same key that
   ships to every browser — because that is exactly the position an outsider is in.

   WHAT IT CANNOT DO, said plainly: the API refuses to list its own tables to that key (401, which
   is itself good), so the table list here is a snapshot and a table added later is NOT covered.
   Supabase's own security advisor IS the check for that — `get_advisors(security)` flags an
   RLS-off table the moment it appears, and DECISIONS M20 says to read it during a sweep. The two
   together cover what neither does alone.

   It never writes. It never calls gstest, because a plain GET to that function IS a write.        */
import fs from 'fs';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const PROJECT = 'https://vkxoeeoauexyfpzqufqd.supabase.co';

/* the key an outsider has: the one printed in the app's own page */
const KEY = (() => {
  const files = ['index.html', ...fs.readdirSync(REPO + '/js').filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];
  for (const f of files) {
    const m = fs.readFileSync(REPO + '/' + f, 'utf8').match(/sb_publishable_[A-Za-z0-9_-]+/);
    if (m) return m[0];
  }
  return null;
})();

const TABLES = fs.readFileSync(REPO + '/scripts/qa/public-surface-tables.txt', 'utf8')
  .split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
const judged = new Map();
for (const line of fs.readFileSync(REPO + '/scripts/qa/public-surface-judged.txt', 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const [name, ...rest] = t.split('\t');
  judged.set(name.trim(), rest.join('\t').trim());
}

const problems = []; const notes = []; let reached = 0;

async function anon(path, init) {
  const r = await fetch(PROJECT + path, { ...(init || {}), headers: { apikey: KEY, ...((init || {}).headers || {}) } });
  reached++;
  return r;
}

if (!KEY) { console.log('FAILED — no publishable key found in the app; this check cannot run'); process.exit(2); }

/* ---- 1. no table may hand a row to somebody who has not signed in ---- */
const answering = [];
for (const t of TABLES) {
  let rows = null;
  try {
    const r = await anon('/rest/v1/' + t + '?select=*', { headers: { Range: '0-0' } });
    const j = await r.json().catch(() => null);
    if (Array.isArray(j)) rows = j.length;
  } catch (e) { /* counted below through `reached` */ }
  if (rows > 0) answering.push(t);
}
if (reached === 0) { console.log('FAILED — could not reach the project at all; this check has proved NOTHING (network?)'); process.exit(2); }
for (const t of answering) {
  const why = judged.get('table:' + t);
  if (why) notes.push('table ' + t + ' answers without a sign-in — judged: ' + why);
  else problems.push('table `' + t + '` hands rows to a caller with NO sign-in. Give it row-level security, or judge it in scripts/qa/public-surface-judged.txt with a reason');
}
for (const k of judged.keys()) {
  if (!k.startsWith('table:')) continue;
  const t = k.slice(6);
  if (!answering.includes(t)) problems.push('`' + t + '` is judged in public-surface-judged.txt as readable without a sign-in, but it no longer is — remove the stale entry');
}

/* ---- 2. the buckets holding documents for real money must not list to a stranger ---- */
for (const b of ['payment-proofs', 'expenses', 'company-docs']) {
  let n = null;
  try {
    const r = await anon('/storage/v1/object/list/' + b, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 100 }) });
    const j = await r.json().catch(() => null);
    if (Array.isArray(j)) n = j.length;
  } catch (e) { n = null; }
  if (n === null) problems.push('could not ask the `' + b + '` bucket what it lists — treat as unproven, not as passing');
  else if (n > 0) problems.push('the `' + b + '` bucket lists ' + n + ' entr(y/ies) to a caller with NO sign-in — it holds documents for real money (DECISIONS M21)');
}

/* ---- 3. the old Storage copy of the app must not be served (fire #136) ---- */
try {
  const r = await fetch(PROJECT + '/functions/v1/app', { redirect: 'manual' });
  const body = r.status >= 300 && r.status < 400 ? '' : await r.text();
  if (body.length > 50000) problems.push('the `app` function is serving a whole copy of the application again (' + body.length + ' bytes). An old copy calls save_state — the whole-blob write — so anybody signing into it can overwrite everyone\'s work. It must redirect (fire #136)');
} catch (e) { problems.push('could not ask the `app` function what it serves — treat as unproven'); }

/* ---- 4. doors known to be open, each with a written reason ---- */
for (const [k, why] of judged) {
  if (k.startsWith('table:')) continue;
  notes.push(k + ' — ' + why);
}

console.log('checked ' + TABLES.length + ' tables, 3 buckets and the app function, as a caller with no sign-in\n');
for (const n of notes) console.log('  · known and judged: ' + n);
if (notes.length) console.log('');
if (problems.length) {
  console.log('PUBLIC SURFACE CHECK FAILED:\n');
  for (const p of problems) console.log('  ✗ ' + p);
  console.log('\nalso read Supabase\'s own security advisor — get_advisors(security) — which catches a table added since this list was written');
  process.exit(1);
}
console.log('public surface OK — nothing on this list answers a caller who has not signed in.');
console.log('NOT covered here: a table created after this list was written. get_advisors(security) is the check for that (DECISIONS M20).');
