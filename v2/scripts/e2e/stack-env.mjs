#!/usr/bin/env node
// @ts-check
// The local Supabase stack's addresses and keys (`supabase status`), as the settings the app and the E2E specs read:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY   — the app (src/core/db/env.ts)
//   V2_DB_URL, V2_MAILPIT_URL                                                             — the specs' fixtures and codes
// Printed as KEY=value lines: CI appends them to $GITHUB_ENV; locally, `export $(node scripts/e2e/stack-env.mjs)`.
// The stack's keys are the CLI's fixed local ones (the same on every machine) — never the cloud project's, and never
// written to a file in the repository (rule 7).
import { spawnSync } from 'node:child_process';

const bin = process.env.SUPABASE_BIN || 'supabase';
const r = spawnSync(bin, ['status', '-o', 'json'], { encoding: 'utf8' });
if (r.error || r.status !== 0) {
  console.error(`supabase status failed — is the stack running (supabase start)?\n${r.error ?? r.stderr}`);
  process.exit(1);
}
const json = r.stdout.slice(r.stdout.indexOf('{'));
/** @type {Record<string, string>} */
const s = JSON.parse(json);
const need = (/** @type {string[]} */ ...names) => {
  for (const n of names) if (s[n]) return s[n];
  console.error(`supabase status has none of ${names.join(', ')}`);
  process.exit(1);
};
const out = {
  NEXT_PUBLIC_SUPABASE_URL: need('API_URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: need('PUBLISHABLE_KEY', 'ANON_KEY'),
  SUPABASE_SECRET_KEY: need('SECRET_KEY', 'SERVICE_ROLE_KEY'),
  V2_DB_URL: need('DB_URL'),
  V2_MAILPIT_URL: need('MAILPIT_URL', 'INBUCKET_URL'),
};
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
