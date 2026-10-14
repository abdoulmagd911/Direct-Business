#!/usr/bin/env node
// @ts-check
// The QA sweep's own LOCAL Supabase stack (never a cloud project). It is v2/supabase copied into the run folder with
// the QA lane's ports (9600–9699; QA_STACK_PORT_BASE picks the ten) and its own project id (QA_STACK_PROJECT), so it
// never collides with a builder's stack on 54321/54322, or with a second sweep's stack, in the same container. The migrations are copied as they are: the database is built from zero by `supabase start`
// (or by `supabase db reset --local` when the branch's migrations changed — run.sh decides).
//
//   node tests/qa/sweep/stack.mjs prepare   (re)write <run>/stack/supabase from v2/supabase
//   node tests/qa/sweep/stack.mjs env       print the stack's settings as KEY=value lines (the app's and the sweep's)
//   node tests/qa/sweep/stack.mjs stale     exit 1 when the running database's migrations differ from the branch's
//
// The keys printed are the CLI's fixed local ones (the same on every machine), never a cloud project's (rule 7).
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_PORT, STACK_DIR, STACK_PORT_BASE, STACK_PROJECT, V2_DIR } from './paths.mjs';

// QA_STACK_PORT_BASE moves the whole stack (a second sweep beside the first: see paths.mjs); unset, 9620–9629.
const B = STACK_PORT_BASE;
const PORTS = { api: B + 1, db: B + 2, shadow: B, pooler: B + 9, studio: B + 3, smtp: B + 4, analytics: B + 7 };
const INSPECTOR_PORT = B === 9620 ? 9683 : B + 8;
const PROJECT_ID = STACK_PROJECT;

/** @param {string[]} args */
function supabase(args) {
  const bin = process.env.SUPABASE_BIN;
  const cmd = bin || 'npx';
  const pre = bin ? [] : ['-y', 'supabase@2.118.0'];
  return spawnSync(cmd, [...pre, ...args, '--workdir', STACK_DIR], { encoding: 'utf8' });
}

function prepare() {
  const src = join(V2_DIR, 'supabase');
  const dst = join(STACK_DIR, 'supabase');
  rmSync(join(dst, 'migrations'), { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  cpSync(join(src, 'migrations'), join(dst, 'migrations'), { recursive: true });
  cpSync(join(src, 'templates'), join(dst, 'templates'), { recursive: true });
  let toml = readFileSync(join(src, 'config.toml'), 'utf8');
  /** Replaces `key = …` inside `[section]` only. @param {string} section @param {string} key @param {string | number} value */
  const set = (section, key, value) => {
    const re = new RegExp(`(\\n\\[${section.replace(/\./g, '\\.')}\\][^\\[]*?\\n)${key} = [^\\n]*`);
    if (!re.test(toml)) throw new Error(`config.toml has no ${key} in [${section}]`);
    toml = toml.replace(re, `$1${key} = ${value}`);
  };
  toml = toml.replace(/^project_id = .*$/m, `project_id = "${PROJECT_ID}"`);
  set('api', 'port', PORTS.api);
  set('db', 'port', PORTS.db);
  set('db', 'shadow_port', PORTS.shadow);
  set('db.pooler', 'port', PORTS.pooler);
  set('studio', 'port', PORTS.studio);
  set('local_smtp', 'port', PORTS.smtp);
  set('analytics', 'port', PORTS.analytics);
  set('edge_runtime', 'inspector_port', INSPECTOR_PORT);
  set('auth', 'site_url', `"http://127.0.0.1:${APP_PORT}"`);
  set('auth', 'additional_redirect_urls', `["http://127.0.0.1:${APP_PORT}/**"]`);
  writeFileSync(join(dst, 'config.toml'), toml);
  console.log(`prepared ${dst} (project ${PROJECT_ID}, API ${PORTS.api}, DB ${PORTS.db})`);
}

/** The stack's addresses and keys, from `supabase status`. @returns {Record<string, string>} */
function stackEnv() {
  const r = supabase(['status', '-o', 'json']);
  if (r.error || r.status !== 0) {
    throw new Error(`supabase status failed — is the QA stack running?\n${r.error ?? r.stderr}`);
  }
  /** @type {Record<string, string>} */
  const s = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  /** @param {string[]} names */
  const need = (...names) => {
    for (const n of names) if (s[n]) return s[n];
    throw new Error(`supabase status has none of ${names.join(', ')}`);
  };
  return {
    NEXT_PUBLIC_SUPABASE_URL: need('API_URL'),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: need('PUBLISHABLE_KEY', 'ANON_KEY'),
    SUPABASE_SECRET_KEY: need('SECRET_KEY', 'SERVICE_ROLE_KEY'),
    V2_DB_URL: need('DB_URL'),
    V2_MAILPIT_URL: s.MAILPIT_URL || s.INBUCKET_URL || `http://127.0.0.1:${PORTS.smtp}`,
  };
}

function stale() {
  const env = stackEnv();
  const files = readdirSync(join(V2_DIR, 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.split('_')[0] ?? f)
    .sort();
  const sql = 'select version from supabase_migrations.schema_migrations order by version';
  const r = spawnSync('psql', [env.V2_DB_URL ?? '', '-At', '-c', sql], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`could not read the applied migrations: ${r.stderr}`);
    process.exit(1);
  }
  const applied = r.stdout.trim().split('\n').filter(Boolean);
  const same = applied.length === files.length && applied.every((v, i) => v === files[i]);
  if (!same) {
    console.error(`the QA database has ${applied.length} migrations, the branch ${files.length}: rebuilding from zero`);
    process.exit(1);
  }
  console.log(`the QA database has the branch's ${files.length} migrations`);
}

const cmd = process.argv[2];
if (cmd === 'prepare') prepare();
else if (cmd === 'env') for (const [k, v] of Object.entries(stackEnv())) console.log(`${k}=${v}`);
else if (cmd === 'stale') stale();
else {
  console.error('usage: stack.mjs prepare | env | stale');
  process.exit(2);
}
