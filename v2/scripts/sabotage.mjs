#!/usr/bin/env node
// @ts-check
// The sabotage runner (TECH-SPEC §9.1, §9.4): every test and check must be seen to fail. For each sabotage under
// tests/sabotage/ it
//   1. runs the targets the sabotage names on the clean tree — each must pass (else the sabotage proves nothing);
//   2. plants the sabotage — a .patch (git apply) or the declarative edits of a .mjs file;
//   3. runs the targets again — each must FAIL, and its output must contain the sabotage's `expect` text, so it failed
//      for the planted reason and not some other one (the old suite's "…but this was sabotage X" guard);
//   4. restores the tree and checks that nothing is left behind.
// A sabotage whose patch or edit no longer applies is itself a failure: the code it broke has moved, so it is updated
// in the same PR, never deleted to get green (MF3).
//
// A .patch file starts with a header, then the diff:
//     Sabotage: <name>
//     Breaks: check:<name> | lint | unit:<test file> | e2e:<spec file>   (one or more, space-separated)
//     Expect: <text the red output must contain>
// A .mjs file exports `sabotages`: [{ name, breaks: [...], expect, edits?: [{ file, find, replace }],
// writes?: [{ file, content }] }] — paths relative to v2/; `find` must occur exactly once.
// A .sql file under supabase/tests/sabotage/ has the same header as `-- ` comments and breaks the database: the SQL
// suite applies it after the migrations (V2_DB_AFTER) of a database built from zero (a copy of one such build, kept
// while the migrations stay the same: test.mjs --reuse); targets are sql:<test ID>.
//
// Usage (from v2/): node scripts/sabotage.mjs [--only <name>]... [--kind check|lint|unit|e2e|sql]... [--list]
// If it is killed half-way, the tree may still hold a sabotage: `git status` shows it; `git checkout -- <file>` and
// removing the planted files restores it.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(V2, 'tests', 'sabotage');
const SQL_DIR = path.join(V2, 'supabase', 'tests', 'sabotage');
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: V2 }).toString().trim();

/**
 * @typedef {{ file: string, find: string, replace: string }} Edit
 * @typedef {{ file: string, content: string }} Write
 * @typedef {{ name: string, breaks: string[], expect: string, source: string, patch?: string,
 *             edits?: Edit[], writes?: Write[], sqlAfter?: string }} Sabotage
 */

// ---------------------------------------------------------------- loading

/** A header field of a patch or SQL sabotage. @param {string} head @param {string} k */
function field(head, k) {
  return new RegExp(`^(?:-- )?${k}:\\s*(.+)$`, 'm').exec(head)?.[1]?.trim() ?? '';
}

/** @param {string} head @param {string} f */
function header(head, f) {
  const s = {
    name: field(head, 'Sabotage'),
    breaks: field(head, 'Breaks')
      .split(/[\s,]+/)
      .filter(Boolean),
    expect: field(head, 'Expect'),
  };
  if (!s.name || !s.breaks.length || !s.expect) throw new Error(`${f}: header needs Sabotage, Breaks and Expect`);
  return s;
}

/** @returns {Promise<Sabotage[]>} */
async function load() {
  /** @type {Sabotage[]} */
  const all = [];
  if (fs.existsSync(SQL_DIR))
    for (const f of fs.readdirSync(SQL_DIR).sort())
      if (f.endsWith('.sql')) {
        const abs = path.join(SQL_DIR, f);
        all.push({ ...header(fs.readFileSync(abs, 'utf8'), f), source: `supabase/tests/sabotage/${f}`, sqlAfter: abs });
      }
  for (const f of fs.readdirSync(DIR).sort()) {
    const abs = path.join(DIR, f);
    if (f.endsWith('.patch')) {
      const text = fs.readFileSync(abs, 'utf8');
      const head = text.slice(0, Math.max(0, text.indexOf('diff --git')));
      all.push({ ...header(head, f), source: f, patch: abs });
    } else if (f.endsWith('.mjs')) {
      const mod = await import(pathToFileURL(abs).href);
      for (const s of mod.sabotages ?? []) all.push({ ...s, source: f });
    }
  }
  const names = new Set();
  for (const s of all) {
    if (names.has(s.name)) throw new Error(`two sabotages are named "${s.name}"`);
    names.add(s.name);
  }
  return all;
}

// ---------------------------------------------------------------- targets

/** @param {string} target */
function command(target) {
  const [kind, arg = ''] = target.split(/:(.*)/s);
  switch (kind) {
    case 'check':
      return ['node', ['scripts/checks/run.mjs', arg]];
    case 'lint':
      return [
        'pnpm',
        ['exec', 'eslint', '--max-warnings', '0', '--no-error-on-unmatched-pattern', ...(arg ? [arg] : ['.'])],
      ];
    case 'unit':
      return ['pnpm', ['exec', 'vitest', 'run', arg]];
    case 'e2e':
      // one browser project is proof enough of a red (the second — UTC, Arabic, the moved clock — is for the green
      // run), plus the specs that run alone; --no-deps, so the alone project does not wait for the whole suite
      return [
        'sh',
        [
          '-c',
          `pnpm build >/dev/null && pnpm exec playwright test --no-deps --project=chromium --project=alone ${JSON.stringify(arg)}`,
        ],
      ];
    case 'sql':
      // --reuse: a copy of one from-zero build, not a fresh replay of every migration per run (see test.mjs)
      return ['node', ['scripts/db/test.mjs', '--reuse', '--only', arg]];
    default:
      throw new Error(`unknown target kind in "${target}"`);
  }
}

/** @param {string} target @param {Record<string, string>} [extraEnv] @returns {{ ok: boolean, output: string }} */
function run(target, extraEnv = {}) {
  const [cmd, args] = /** @type {[string, string[]]} */ (command(target));
  const r = spawnSync(cmd, args, {
    cwd: V2,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', V2_DB_AFTER: '', ...extraEnv },
    maxBuffer: 64 << 20,
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '');
  return { ok: r.status === 0, output };
}

// ---------------------------------------------------------------- planting

/** @param {string[]} args */
function git(args) {
  return execFileSync('git', args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

/**
 * Plants a sabotage; returns the function that takes it out again, and the environment its targets run in.
 * @param {Sabotage} s @returns {{ takeOut: () => void, env: Record<string, string> }}
 */
function plant(s) {
  if (s.sqlAfter) return { takeOut: () => {}, env: { V2_DB_AFTER: s.sqlAfter } };
  return { takeOut: plantFiles(s), env: {} };
}

/** @param {Sabotage} s */
function plantFiles(s) {
  if (s.patch) {
    try {
      git(['apply', '--check', s.patch]);
    } catch (e) {
      throw new Error(
        `the patch no longer applies — update it to the code it breaks: ${String(/** @type {any} */ (e).stderr ?? e)}`,
      );
    }
    git(['apply', s.patch]);
    return () => git(['apply', '-R', /** @type {string} */ (s.patch)]);
  }
  /** @type {(() => void)[]} */
  const undo = [];
  try {
    for (const w of s.writes ?? []) {
      const abs = path.join(V2, w.file);
      if (fs.existsSync(abs)) throw new Error(`${w.file} already exists — a planted file must be new`);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      /** @type {string[]} */
      const madeDirs = [];
      for (
        let d = path.dirname(abs);
        d.startsWith(V2) && d !== V2 && fs.readdirSync(d).length === 0;
        d = path.dirname(d)
      )
        madeDirs.push(d);
      fs.writeFileSync(abs, w.content);
      undo.push(() => {
        fs.rmSync(abs, { force: true });
        for (const d of madeDirs) if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
      });
    }
    for (const e of s.edits ?? []) {
      const abs = path.join(V2, e.file);
      const before = fs.readFileSync(abs, 'utf8');
      const count = before.split(e.find).length - 1;
      if (count !== 1)
        throw new Error(
          `edit of ${e.file}: the text to replace occurs ${count} times (must be exactly once) — update the sabotage`,
        );
      fs.writeFileSync(abs, before.replace(e.find, e.replace));
      undo.push(() => fs.writeFileSync(abs, before));
    }
  } catch (err) {
    for (const u of undo.reverse()) u();
    throw err;
  }
  return () => {
    for (const u of undo.reverse()) u();
  };
}

// ---------------------------------------------------------------- main

const argv = process.argv.slice(2);
/** @type {string[]} */
const only = [];
/** @type {string[]} */
const kinds = [];
let list = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--only') only.push(/** @type {string} */ (argv[++i]));
  else if (argv[i] === '--kind') kinds.push(/** @type {string} */ (argv[++i]));
  else if (argv[i] === '--list') list = true;
  else {
    console.error(`unknown argument ${argv[i]}`);
    process.exit(2);
  }
}

const all = await load();
const chosen = all.filter(
  (s) =>
    (!only.length || only.includes(s.name)) &&
    (!kinds.length || s.breaks.every((b) => kinds.includes(/** @type {string} */ (b.split(':')[0])))),
);
if (list) {
  for (const s of all) console.log(`${s.name.padEnd(34)} ${s.breaks.join(' ')}  (${s.source})`);
  process.exit(0);
}
if (only.length && chosen.length !== only.length) {
  console.error(`unknown sabotage in --only: ${only.filter((n) => !all.some((s) => s.name === n)).join(', ')}`);
  process.exit(2);
}

const statusBefore = git(['status', '--porcelain', '--untracked-files=all', '--', 'v2', 'docs/v2', '.github']);
/** @type {Map<string, boolean>} */
const baselineOk = new Map();
let failures = 0;
const rows = [];
for (const s of chosen) {
  for (const t of s.breaks) {
    // An e2e target's clean run is the job's own E2E step, just before; everything else is re-run here.
    if (t.startsWith('e2e:') || baselineOk.has(t)) continue;
    const r = run(t);
    baselineOk.set(t, r.ok);
    if (!r.ok) console.log(`\n--- ${t} is already red on the clean tree:\n${r.output.slice(-3000)}`);
  }
  /** @type {() => void} */
  let takeOut = () => {};
  /** @type {Record<string, string>} */
  let env = {};
  try {
    ({ takeOut, env } = plant(s));
  } catch (e) {
    failures++;
    rows.push([s.name, '(plant)', `FAILED — ${/** @type {Error} */ (e).message}`]);
    continue;
  }
  try {
    for (const t of s.breaks) {
      if (baselineOk.get(t) === false) {
        failures++;
        rows.push([s.name, t, 'FAILED — the target is red without the sabotage']);
        continue;
      }
      const r = run(t, env);
      if (r.ok) {
        failures++;
        rows.push([s.name, t, 'FAILED — stayed green under the sabotage']);
      } else if (!r.output.includes(s.expect)) {
        failures++;
        rows.push([s.name, t, `FAILED — went red, but its output never says "${s.expect}"`]);
        console.log(`\n--- ${s.name} / ${t} output:\n${r.output.slice(-3000)}`);
      } else rows.push([s.name, t, 'red, as it must be']);
    }
  } finally {
    takeOut();
  }
}
const statusAfter = git(['status', '--porcelain', '--untracked-files=all', '--', 'v2', 'docs/v2', '.github']);
if (statusAfter !== statusBefore) {
  failures++;
  rows.push(['(tree)', '', `FAILED — the tree was not restored:\n${statusAfter}`]);
}
console.log('');
for (const [name, target, verdict] of rows)
  console.log(`${String(name).padEnd(34)} ${String(target).padEnd(70)} ${verdict}`);
console.log(`\n${chosen.length} sabotage(s), ${rows.length} target run(s), ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
