#!/usr/bin/env node
// @ts-check
// The QA lane's matcher test for the shell allow list and the shell guard (QA on #110 and its fix): for each command
// string, what actually happens to it — DENY, ASK, or ALLOW (runs with no click). The guard's decide() is imported from
// the checkout under test; the allow list is read from its .claude/settings.json and matched the way the harness
// matches `Bash(prefix:*)` (every simple command of a compound one must match an allow rule, or it is asked).
//
//   node v2/tests/qa/guard/matcher.mjs [repo-root]     exits 1 when any command gets a looser answer than it must
//
// "must" is the owner's rule for this repository: nothing that rewrites or deletes history, a branch or the hosted
// database, and nothing that deletes outside /tmp, runs without a person's click.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] || join(import.meta.dirname, '..', '..', '..', '..'));
const { decide, segmentsOf } = await import(pathToFileURL(join(root, '.claude/hooks/bash-guard.mjs')).href);
const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
/** @type {(kind: string) => string[]} */
const rules = (kind) =>
  (settings.permissions?.[kind] ?? [])
    .filter((/** @type {string} */ r) => r.startsWith('Bash('))
    .map((/** @type {string} */ r) => r.slice(5, -1));
const matches = (/** @type {string} */ rule, /** @type {string} */ seg) =>
  rule.endsWith(':*') ? seg.startsWith(rule.slice(0, -2)) : seg === rule;

/** @param {string} cmd @returns {'DENY'|'ASK'|'ALLOW'} */
function outcome(cmd) {
  const g = decide(cmd);
  if (g?.decision === 'deny') return 'DENY';
  if (g?.decision === 'ask') return 'ASK';
  const segs = segmentsOf(cmd);
  if (segs.some((/** @type {string} */ s) => rules('deny').some((r) => matches(r, s)))) return 'DENY';
  if (segs.some((/** @type {string} */ s) => rules('ask').some((r) => matches(r, s)))) return 'ASK';
  return segs.every((/** @type {string} */ s) => rules('allow').some((r) => matches(r, s))) ? 'ALLOW' : 'ASK';
}

/**
 * [command, the loosest answer allowed, why] — every value is made up; no command here is ever run.
 * @type {[string, 'DENY' | 'ASK' | 'ALLOW', string][]}
 */
const CASES = [
  // the independent QA's strings (#110)
  ['git push --force origin v2/q-1', 'ASK', 'a force push'],
  ['git push origin v2/q-1 --force', 'ASK', 'a force flag at the end'],
  ['git push -f origin v2/q-1', 'ASK', '-f'],
  ['git -C /home/user/repo push -f origin v2/q-1', 'ASK', '-C then -f'],
  ['git -C . push origin --delete v2/q-1', 'ASK', 'a remote branch delete'],
  ['git -C . push origin :v2/q-1', 'ASK', 'a :branch delete'],
  ['git push origin +v2/q-1', 'ASK', 'a +refspec'],
  ['supabase db reset --linked', 'DENY', 'wipes the hosted database'],
  ['supabase db push', 'DENY', 'changes the hosted database'],
  ['git -C . branch -D v2/q-1', 'ASK', 'throws a branch away'],
  ['git -C . reset --hard origin/v2/main', 'ASK', 'throws work away'],
  // wrappers: the same commands, hidden from a reader that looks only at the words
  ['echo $(git push --force origin v2/q-1)', 'ASK', 'a force push inside $( )'],
  ['echo `git push -f origin v2/q-1`', 'ASK', 'a force push inside backticks'],
  ["node -e \"require('child_process').execSync('git push -f origin v2/q-1')\"", 'ASK', 'a force push through node -e'],
  ['python3 -c "import os; os.system(\'git push --force origin v2/q-1\')"', 'ASK', 'a force push through python3 -c'],
  [
    "node -e \"require('child_process').execSync('supabase db reset --linked')\"",
    'ASK',
    'db reset --linked through node -e',
  ],
  ['echo $(supabase db reset --linked)', 'ASK', 'db reset --linked inside $( )'],
  // pushes that throw remote branches away or skip review without any force flag
  ['git -C . push --mirror origin', 'ASK', '--mirror deletes every remote branch the checkout lacks'],
  ['git -C . push --prune origin refs/heads/v2/*', 'ASK', '--prune deletes remote branches'],
  ['git push origin v2/main', 'ASK', 'straight onto the integration branch, past review'],
  ['git -C . push --all origin', 'ASK', 'every local branch, the production one included'],
  // deletes outside /tmp
  ['rm -rf /tmp/ /home/user/repo', 'ASK', '/tmp/ plus a second path'],
  ['rm -rf /tmp/../home/user/repo', 'ASK', 'out of /tmp by ..'],
  ['find /home/user/repo -delete', 'ASK', 'find -delete'],
  ['find /home/user/repo -exec rm -rf {} +', 'ASK', 'find -exec rm'],
  // ordinary work that must stay click-free (not a looser answer than ALLOW needed; recorded to catch over-blocking)
  ['git -C . log --oneline -3', 'ALLOW', 'reading'],
  ['git push -u origin v2/q-1', 'ALLOW', "the lane's own branch"],
  ['git commit -F -', 'ALLOW', 'a commit message from stdin'],
];

const rank = { DENY: 0, ASK: 1, ALLOW: 2 };
let bad = 0;
const rows = CASES.map(([cmd, most, why]) => {
  const got = outcome(cmd);
  const tooLoose = rank[got] > rank[most];
  const tooTight = most === 'ALLOW' && got !== 'ALLOW';
  if (tooLoose) bad += 1;
  return { verdict: tooLoose ? 'FAIL' : tooTight ? 'tight' : 'ok', got, must: most, why, cmd };
});
for (const r of rows)
  console.log(`${r.verdict.padEnd(5)} ${r.got.padEnd(5)} (at most ${r.must.padEnd(5)}) ${r.why} — ${r.cmd}`);
console.log(`\n${bad} command(s) run with less protection than they must`);
process.exit(bad ? 1 : 0);
