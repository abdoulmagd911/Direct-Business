#!/usr/bin/env node
// @ts-check
// Runs the v2 checks (TECH-SPEC §9.1). Usage, from v2/:
//   node scripts/checks/run.mjs                 every check
//   node scripts/checks/run.mjs no-hex rule-7   only these
//   node scripts/checks/run.mjs --root <dir>    against another folder (tests use it)
//   node scripts/checks/run.mjs --list          names and rules
// Exit code 1 when any finding remains; each finding prints as `path:line [check] message`.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checks } from './index.mjs';
import { makeCtx, runCheck } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let root = path.resolve(here, '..', '..');
/** @type {string[]} */
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = /** @type {string} */ (args[i]);
  if (a === '--root') root = path.resolve(/** @type {string} */ (args[++i]));
  else if (a === '--list') {
    for (const c of checks) console.log(`${c.name.padEnd(26)} ${c.rule}`);
    process.exit(0);
  } else names.push(a);
}
const unknown = names.filter((n) => !checks.some((c) => c.name === n));
if (unknown.length) {
  console.error(`unknown check(s): ${unknown.join(', ')} — try --list`);
  process.exit(2);
}
const chosen = names.length ? checks.filter((c) => names.includes(c.name)) : checks;
const ctx = makeCtx(root);
let total = 0;
for (const check of chosen) {
  const findings = await runCheck(check, ctx);
  total += findings.length;
  const mark = findings.length ? 'RED  ' : 'green';
  console.log(`${mark} ${check.name} (${findings.length})`);
  for (const f of findings) console.log(`      ${f.file}${f.line ? ':' + f.line : ''} [${f.check}] ${f.message}`);
}
if (total) {
  console.log(`\n${total} finding(s). A true exception carries "check-allow: <check> — <reason>" on its line.`);
  process.exit(1);
}
