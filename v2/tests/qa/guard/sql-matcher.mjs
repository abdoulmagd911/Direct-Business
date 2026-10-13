#!/usr/bin/env node
// @ts-check
// The QA lane's matcher test for the database guard (`.claude/hooks/sql-guard.mjs`, #118; QA-134): for each SQL
// string, what the hook answers before mcp__Supabase__execute_sql or apply_migration runs it — ASK, or FREE (no
// click). The hook is run from the checkout under test exactly as the harness runs it: the call as JSON on stdin.
//
//   node v2/tests/qa/guard/sql-matcher.mjs [repo-root]     exits 1 when any statement runs freer than it must
//
// "must" is the hook's own header: on the v2 project destructive statements are asked (a whole-table DELETE or
// UPDATE, turning row-level security or a trigger off); on any other project a write outside a rolled-back dry run is
// asked, and a migration that deletes live data is asked. Every value is made up; no statement here is ever run.
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || join(import.meta.dirname, '..', '..', '..', '..'));
const hook = join(root, '.claude/hooks/sql-guard.mjs');
const V2 = 'kimadjvaxgiqzjaukuqg';
const OTHER = 'abcdefghijklmnopqrst';
const SQL = 'mcp__Supabase__execute_sql';
const MIG = 'mcp__Supabase__apply_migration';

/** @param {string} tool @param {string} project @param {string} query @returns {'ASK'|'FREE'} */
function outcome(tool, project, query) {
  const input = JSON.stringify({ tool_name: tool, tool_input: { project_id: project, query } });
  const run = spawnSync(process.execPath, [hook], { input, encoding: 'utf8' });
  const said = /"permissionDecision"\s*:\s*"(ask|deny)"/.exec(run.stdout ?? '');
  return said || run.status !== 0 ? 'ASK' : 'FREE';
}

/**
 * [tool, project, SQL, the freest answer allowed, why]
 * @type {[string, string, string, 'ASK' | 'FREE', string][]}
 */
const CASES = [
  // the v2 project: destructive statements are asked, whatever their spelling
  [SQL, V2, 'delete from core.person', 'ASK', 'a DELETE without WHERE (the hook catches this spelling)'],
  [SQL, V2, 'delete from core.person where true', 'ASK', 'every row, with a WHERE that filters nothing'],
  [SQL, V2, 'update core.person_auth set must_change_password = true where 1=1', 'ASK', 'every row, WHERE 1=1'],
  [
    SQL,
    V2,
    'with gone as (delete from core.person where true returning 1) select count(*) from gone',
    'ASK',
    'a whole-table DELETE inside a SELECT',
  ],
  [
    SQL,
    V2,
    "update auth.users set encrypted_password = '' where true",
    'ASK',
    "every person's password: nobody signs in",
  ],
  [SQL, V2, 'set session_replication_role = replica', 'ASK', 'every trigger off, the audit triggers included'],
  [SQL, V2, 'alter table core.person disable row level security', 'ASK', 'row-level security off'],
  // any other project: writes outside a rolled-back dry run are asked
  [SQL, OTHER, 'select public.golive_reset()', 'ASK', 'a write hidden in a function call'],
  [SQL, OTHER, 'begin; delete from t where true; end; rollback;', 'ASK', 'END commits before the ROLLBACK'],
  [MIG, OTHER, 'delete from core.person where true', 'ASK', 'a migration that deletes live rows'],
  [MIG, OTHER, 'alter table t drop column c', 'ASK', "a migration that deletes a column's live data"],
  // ordinary work that must stay click-free (recorded to catch over-blocking)
  [SQL, V2, 'select count(*) from core.person', 'FREE', 'reading'],
  [
    SQL,
    V2,
    "update core.person set nickname = 'x' where id = '00000000-0000-0000-0000-000000000001'",
    'FREE',
    'one row',
  ],
  [SQL, OTHER, 'select 1', 'FREE', 'reading'],
  [SQL, OTHER, 'begin; delete from t where id = 1; rollback;', 'FREE', 'a rolled-back dry run'],
];

let bad = 0;
for (const [tool, project, query, most, why] of CASES) {
  const got = outcome(tool, project, query);
  const tooLoose = got === 'FREE' && most === 'ASK';
  const tooTight = got === 'ASK' && most === 'FREE';
  if (tooLoose) bad += 1;
  const where = project === V2 ? 'v2' : 'other';
  const kind = tool === MIG ? 'migration' : 'sql';
  console.log(
    `${(tooLoose ? 'FAIL' : tooTight ? 'tight' : 'ok').padEnd(5)} ${got.padEnd(4)} (at most ${most.padEnd(4)}) ${where}/${kind} ${why} — ${query}`,
  );
}
console.log(`\n${bad} statement(s) run with less protection than they must`);
process.exit(bad ? 1 : 0);
