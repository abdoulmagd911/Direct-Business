#!/usr/bin/env node
// @ts-check
// Writes a SQL sabotage from a function as a migration defines it, with one rule taken out — so a sabotage is the real
// function minus exactly one line, never a hand copy that drifts.
//   node scripts/db/sabotage-from.mjs --migration <file> --function '<create … function schema.name(>' \
//        --find '<text>' --replace '<text>' --name <sabotage> --breaks <TEST-ID> --expect '<text>' --why '<one line>'
// The function is taken from its `create [or replace] function` line to its closing `$$;`; `--find` must occur in it
// exactly once. The file goes to supabase/tests/sabotage/<name>.sql.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** @type {Map<string, string>} */
const a = new Map();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) a.set((argv[i] ?? '').replace(/^--/, ''), argv[i + 1] ?? '');
/** @param {string} k @returns {string} */
const arg = (k) => {
  const v = a.get(k);
  if (!v) {
    console.error(`--${k} is required`);
    process.exit(1);
  }
  return v;
};
const migration = arg('migration');
const fn = arg('function');
const find = arg('find');
const name = arg('name');
const breaks = arg('breaks');
const expect = arg('expect');
const why = arg('why');
const replace = a.get('replace') ?? '';

const file = path.isAbsolute(migration) ? migration : path.join(V2, 'supabase/migrations', migration);
const sql = fs.readFileSync(file, 'utf8');
const start = sql.indexOf(fn);
if (start < 0) {
  console.error(`${fn} is not in ${migration}`);
  process.exit(1);
}
const end = sql.indexOf('\n$$;\n', sql.indexOf('as $$', start)) + 5;
let body = sql.slice(start, end).replace(/^create function/, 'create or replace function');
const hits = body.split(find).length - 1;
if (hits !== 1) {
  console.error(`--find occurs ${hits} times in the function (must be once)`);
  process.exit(1);
}
body = body.replace(find, replace);
const out = path.join(V2, 'supabase/tests/sabotage', `${name}.sql`);
fs.writeFileSync(out, `-- Sabotage: ${name}\n-- Breaks: sql:${breaks}\n-- Expect: ${expect}\n-- ${why}\n${body}`);
console.log(`wrote ${path.relative(V2, out)}`);
