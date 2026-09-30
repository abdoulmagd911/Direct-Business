#!/usr/bin/env node
// @ts-check
// Production and main hold the same migrations (V181). The db-production job of .github/workflows/v2.yml runs this
// after `supabase db push`, on every merge to v2/main: every migration file in supabase/migrations must be in the
// project's history, and the project's history must hold nothing else. Any difference fails the job and is named.
//
//   node scripts/db/prod-sync.mjs --db-url   production, at SUPABASE_PROD_DB_URL (found by scripts/db/prod-url.mjs)
//   node scripts/db/prod-sync.mjs --local    the local stack (CI proves the check agrees with a stack built from zero)
//
// Needs the Supabase CLI (`supabase`, or SUPABASE_BIN). It only reads: `supabase migration list`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS = path.join(V2, 'supabase', 'migrations');

/** The versions of the migration files, read as the CLI reads them (`<digits>_<name>.sql`):
 * `20260929000000_core_foundation.sql` → `20260929000000`.
 * @param {string[]} files @returns {string[]} */
export function fileVersions(files) {
  return files
    .map((f) => /^(\d+)_.*\.sql$/.exec(f)?.[1])
    .filter(/** @returns {v is string} */ (v) => v !== undefined)
    .sort();
}

/** What `supabase migration list --output-format json` names on the project's side.
 * @param {string} json @returns {string[]} */
export function remoteVersions(json) {
  // the JSON document alone, should the CLI print a notice around it
  const parsed = JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1));
  if (!parsed || !Array.isArray(parsed.migrations)) {
    throw new Error('supabase migration list answered without a "migrations" list');
  }
  return parsed.migrations
    .map((/** @type {{ remote?: unknown }} */ m) => (typeof m.remote === 'string' ? m.remote.trim() : ''))
    .filter((/** @type {string} */ v) => v !== '')
    .sort();
}

/** The difference, both ways: a file the project has not applied, and a version the project holds with no file.
 * @param {string[]} local @param {string[]} remote @returns {{ notApplied: string[], notInMain: string[] }} */
export function compare(local, remote) {
  const l = new Set(local);
  const r = new Set(remote);
  return {
    notApplied: local.filter((v) => !r.has(v)),
    notInMain: remote.filter((v) => !l.has(v)),
  };
}

/** The lines the job prints: `::error::` lines GitHub shows on the run, or one line saying they agree.
 * @param {{ notApplied: string[], notInMain: string[] }} d @param {number} count @param {string} where
 * @returns {{ ok: boolean, lines: string[] }} */
export function report(d, count, where) {
  if (d.notApplied.length === 0 && d.notInMain.length === 0) {
    return { ok: true, lines: [`${where} and main agree: the same ${count} migrations.`] };
  }
  return {
    ok: false,
    lines: [
      `::error title=Production and main differ::${where} and main do not hold the same migrations.`,
      ...d.notApplied.map((v) => `::error::${v} is in main but not applied on ${where}.`),
      ...d.notInMain.map((v) => `::error::${v} is applied on ${where} but is not a file in main.`),
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const onStack = process.argv.includes('--local');
  const where = onStack ? 'the local stack' : 'production';
  const url = process.env.SUPABASE_PROD_DB_URL;
  if (!onStack && !url) {
    console.error('::error title=Production check could not run::SUPABASE_PROD_DB_URL is not set');
    process.exit(1);
  }
  const target = onStack ? ['--local'] : ['--db-url', String(url)];
  const bin = process.env.SUPABASE_BIN || 'supabase';
  const r = spawnSync(bin, ['migration', 'list', ...target, '--output-format', 'json'], {
    cwd: V2,
    encoding: 'utf8',
    maxBuffer: 16 << 20,
  });
  if (r.error || r.status !== 0) {
    console.error(`::error title=Production check could not run::supabase migration list on ${where} failed`);
    console.error(String(r.error ?? r.stderr));
    process.exit(1);
  }
  const local = fileVersions(fs.readdirSync(MIGRATIONS));
  let remote;
  try {
    remote = remoteVersions(r.stdout);
  } catch (e) {
    console.error(`::error title=Production check could not run::${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  const out = report(compare(local, remote), local.length, where);
  for (const line of out.lines) (out.ok ? console.log : console.error)(line);
  process.exit(out.ok ? 0 : 1);
}
