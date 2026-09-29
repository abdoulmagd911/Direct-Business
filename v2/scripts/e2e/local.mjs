#!/usr/bin/env node
// @ts-check
// Runs the E2E specs on this machine against the local Supabase stack, the way CI does: the stack's settings from
// scripts/e2e/stack-env.mjs, a production build, then Playwright. One command, so no shell variables are needed.
//   node scripts/e2e/local.mjs [--no-build] [playwright args…]      e.g. node scripts/e2e/local.mjs tests/e2e/signin.spec.ts
// Needs the stack running (supabase start) with this branch's migrations (supabase db reset --local).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const build = !args.includes('--no-build');
const rest = args.filter((a) => a !== '--no-build');

const envOut = spawnSync('node', ['scripts/e2e/stack-env.mjs'], { cwd: V2, encoding: 'utf8' });
if (envOut.status !== 0) {
  process.stderr.write(envOut.stderr);
  process.exit(1);
}
/** @type {NodeJS.ProcessEnv} */
const env = { ...process.env };
for (const line of envOut.stdout.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
}

const run = (/** @type {string} */ cmd, /** @type {string[]} */ a) => {
  const r = spawnSync(cmd, a, { cwd: V2, env, stdio: 'inherit' });
  if (r.error) console.error(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (build) run('pnpm', ['build']);
run('pnpm', ['exec', 'playwright', 'test', ...rest]);
