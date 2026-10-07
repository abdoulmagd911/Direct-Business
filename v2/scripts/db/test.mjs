#!/usr/bin/env node
// @ts-check
// The SQL suite (TECH-SPEC §9.1). Builds the database from zero and runs every test file in supabase/tests/ in its
// own transaction, rolled back at the end, so tests never see each other's rows.
//
//   node scripts/db/test.mjs                    plain Postgres: drop and re-create the test database, apply the
//                                               Supabase stand-ins, every migration in order, the harness; run all
//   node scripts/db/test.mjs --target supabase  the local Supabase stack (`supabase start` has applied the
//                                               migrations): apply the harness, run all
//   --only <ID>        run the tests whose ID starts with this (repeatable), e.g. --only GRANTS-01
//   --after <file>     apply this SQL after the migrations (repeatable; also V2_DB_AFTER, ':'-separated) — how a
//                      sabotage breaks a migration without touching it
//   --write-grants     write supabase/grants.expected from the database just built (a deliberate change: say why)
//   --reuse            plain target: copy a from-zero build of the same stand-ins and migrations, kept as
//                      <test database>_built and rebuilt when any of them changes, instead of replaying every
//                      migration; --after files are applied to the copy. How the sabotage runner fits its several
//                      hundred builds into CI (one build from zero takes seconds, a copy a fraction of one)
//   --list             list the tests
// Connection: PGHOST/PGPORT/PGUSER/PGPASSWORD (default 127.0.0.1:5432, postgres/postgres; the Supabase target defaults
// to port 54322 and database postgres), test database V2_TEST_DB (default v2_test). Needs `psql`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUPA = path.join(V2, 'supabase');
const TESTS = path.join(SUPA, 'tests');
const MIGRATIONS = path.join(SUPA, 'migrations');
const GRANTS = path.join(SUPA, 'grants.expected');

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
/** @type {string[]} */
const only = [];
/** @type {string[]} */
const after = (process.env.V2_DB_AFTER || '').split(':').filter(Boolean);
let target = 'plain';
let writeGrants = false;
let list = false;
let reuse = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--only') only.push(/** @type {string} */ (argv[++i]));
  else if (a === '--reuse') reuse = true;
  else if (a === '--after') after.push(path.resolve(/** @type {string} */ (argv[++i])));
  else if (a === '--target') target = /** @type {string} */ (argv[++i]);
  else if (a === '--write-grants') writeGrants = true;
  else if (a === '--list') list = true;
  else {
    console.error(`unknown argument ${a}`);
    process.exit(2);
  }
}
if (!['plain', 'supabase'].includes(target)) {
  console.error('--target is plain or supabase');
  process.exit(2);
}
if (target === 'supabase' && reuse) {
  console.error('--reuse copies a plain build: the Supabase stack keeps what it applied');
  process.exit(2);
}
if (target === 'supabase' && after.length) {
  console.error('--after rebuilds from zero: run it on the plain target (the Supabase stack keeps what it applied)');
  process.exit(2);
}

// ---------------------------------------------------------------- tests on disk
/** @param {string} dir @returns {string[]} */
function sqlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name === 'sabotage') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sqlFiles(abs));
    else if (e.name.endsWith('.sql')) out.push(abs);
  }
  return out.sort();
}
const ID = /^([A-Z][A-Z0-9]*-\d+[a-z]?)-/;
const tests = sqlFiles(TESTS).map((file) => {
  const base = path.basename(file, '.sql');
  const m = ID.exec(base);
  if (!m) throw new Error(`${path.relative(V2, file)}: a test file is named <ID>-<a sentence>.sql, e.g. GRANTS-01-…`);
  return { id: /** @type {string} */ (m[1]), title: base.slice(m[0].length).replace(/-/g, ' '), file };
});
const ids = new Set();
for (const t of tests) {
  if (ids.has(t.id)) throw new Error(`two test files use the ID ${t.id}`);
  ids.add(t.id);
}
if (list) {
  for (const t of tests) console.log(`${t.id.padEnd(12)} ${t.title}`);
  process.exit(0);
}
const chosen = only.length ? tests.filter((t) => only.some((o) => t.id.startsWith(o))) : tests;
if (only.length && !chosen.length) {
  console.error(`no test matches ${only.join(', ')}`);
  process.exit(2);
}

// ---------------------------------------------------------------- psql
const conn = {
  PGHOST: process.env.PGHOST || '127.0.0.1',
  PGPORT: process.env.PGPORT || (target === 'supabase' ? '54322' : '5432'),
  PGUSER: process.env.PGUSER || 'postgres',
  PGPASSWORD: process.env.PGPASSWORD || 'postgres',
};
const DB = target === 'supabase' ? process.env.V2_TEST_DB || 'postgres' : process.env.V2_TEST_DB || 'v2_test';

/**
 * @param {string} db
 * @param {string[]} args
 * @param {string} [input]
 */
function psql(db, args, input) {
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', db, ...args], {
    env: { ...process.env, ...conn, PGOPTIONS: '--client-min-messages=warning' },
    input,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  });
  if (r.error) throw r.error;
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
}

/** @param {string} what @param {{ ok: boolean, err: string }} r */
function must(what, r) {
  if (!r.ok) {
    console.error(`${what} failed:\n${r.err}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- build
const t0 = Date.now();
if (target === 'plain') {
  const stubs = path.join(TESTS, '_harness', 'stubs.sql');
  const migrations = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  /** Drops `db`, creates it (from `template` when given) and, without a template, builds it from zero. */
  const build = (/** @type {string} */ db, template = '') => {
    must(`dropping ${db}`, psql('postgres', ['-c', `drop database if exists ${db} with (force)`]));
    must(`creating ${db}`, psql('postgres', ['-c', `create database ${db}${template ? ` template ${template}` : ''}`]));
    if (template) return;
    must('the Supabase stand-ins', psql(db, ['-f', stubs]));
    for (const m of migrations) must(`migration ${m}`, psql(db, ['-1', '-f', path.join(MIGRATIONS, m)]));
  };
  let how = 'from zero';
  if (reuse) {
    // The stand-ins and every migration, by name and content: any change to them builds the copy again.
    const hash = createHash('sha256').update(fs.readFileSync(stubs));
    for (const m of migrations) hash.update(`\0${m}\0`).update(fs.readFileSync(path.join(MIGRATIONS, m)));
    const key = `v2 build ${hash.digest('hex')}`;
    const BUILT = `${DB}_built`;
    const r = psql('postgres', [
      '-At',
      '-c',
      `select shobj_description(oid, 'pg_database') from pg_database where datname = '${BUILT}'`,
    ]);
    must(`reading ${BUILT}`, r);
    if (r.out.trim() === key) how = `as a copy of ${BUILT}`;
    else {
      build(BUILT);
      must(`marking ${BUILT}`, psql('postgres', ['-c', `comment on database ${BUILT} is '${key}'`]));
      how = `from zero (kept as ${BUILT})`;
    }
    build(DB, BUILT);
  } else build(DB);
  for (const f of after) must(`--after ${f}`, psql(DB, ['-1', '-f', f]));
  console.log(
    `built ${DB} ${how}: ${migrations.length} migration(s)${after.length ? `, then ${after.join(', ')}` : ''}`,
  );
}
must('the harness', psql(DB, ['-f', path.join(TESTS, '_harness', 'harness.sql')]));

if (writeGrants) {
  const r = psql(DB, ['-At', '-c', 'select test.grants_actual()']);
  must('reading the grants', r);
  const header =
    "# Every privilege a request role (public, anon, authenticated, service_role, authenticator) holds on v2's schemas,\n" +
    "# tables, columns, functions and types, and the migration role's default privileges (A8). Written by\n" +
    '# `node scripts/db/test.mjs --write-grants` on a database built from zero; GRANTS-01 compares the live catalog with\n' +
    '# it. A change here is deliberate and its PR says why.\n';
  fs.writeFileSync(GRANTS, header + r.out.trim() + '\n');
  console.log(`wrote ${path.relative(V2, GRANTS)} (${r.out.trim().split('\n').filter(Boolean).length} lines)`);
}
if (fs.existsSync(GRANTS)) {
  const lines = fs
    .readFileSync(GRANTS, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const values = lines.map((l) => `('${l.replace(/'/g, "''")}')`).join(',\n');
  if (values) must('loading grants.expected', psql(DB, ['-c', `insert into test.grants_expected values ${values}`]));
}

const REGISTRY = path.join(SUPA, 'registry.json');
if (fs.existsSync(REGISTRY)) {
  const doc = fs.readFileSync(REGISTRY, 'utf8');
  if (doc.includes('$registry$')) throw new Error("registry.json holds the loader's quote tag");
  must(
    'loading registry.json',
    psql(DB, [], `insert into test.registry_expected values ($registry$${doc}$registry$::jsonb);`),
  );
}

// ---------------------------------------------------------------- run
let failed = 0;
for (const t of chosen) {
  const script = `\\o /dev/null\nbegin;\n\\i '${t.file.replace(/'/g, "''")}'\nrollback;\n`;
  const r = psql(DB, [], script);
  if (r.ok) console.log(`ok    ${t.id.padEnd(10)} ${t.title}`);
  else {
    failed++;
    const msg = r.err
      .split('\n')
      .filter((l) => !/^\s*$/.test(l))
      .map((l) => l.replace(/^psql:[^:]+:\d+: /, ''))
      .join('\n        ');
    console.log(`FAIL  ${t.id.padEnd(10)} ${t.title}\n        ${path.relative(V2, t.file)}\n        ${msg}`);
  }
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `\n${chosen.length - failed} passed, ${failed} failed (${chosen.length} test file(s), ${target}, ${secs}s)`,
);
process.exit(failed ? 1 : 0);
