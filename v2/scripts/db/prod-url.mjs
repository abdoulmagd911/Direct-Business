#!/usr/bin/env node
// @ts-check
// How the production job reaches the database (V181): with the database password alone — no access token, whose
// permissions `supabase link` would need. GitHub's runners reach no IPv6, so the project's own address
// (db.<ref>.supabase.co) is out of reach; Supabase's shared pooler of the project's region answers on IPv4, in session
// mode (port 5432). A project sits on one of its region's poolers (aws-1-… for the newer ones, aws-0-… for the older),
// so each is tried with a read (`supabase migration list`) and the first that knows the project is kept.
//
//   node scripts/db/prod-url.mjs    needs SUPABASE_PROJECT_REF, SUPABASE_REGION, SUPABASE_DB_PASSWORD and GITHUB_ENV
//
// The address found, password and all, is masked in the job's log and handed to its next steps as
// SUPABASE_PROD_DB_URL. Nothing is written to the database.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The session-mode addresses of the region's poolers, the newer first; the password percent-encoded.
 * @param {string} ref @param {string} region @param {string} password @returns {{ host: string, url: string }[]} */
export function candidates(ref, region, password) {
  const secret = encodeURIComponent(password);
  return ['aws-1', 'aws-0'].map((pool) => {
    const host = `${pool}-${region}.pooler.supabase.com`;
    // check-allow: rule-7 — the address's shape; its ref and password come from the job's environment at run time
    return { host, url: `postgresql://postgres.${ref}:${secret}@${host}:5432/postgres` };
  });
}

/** A text with the password taken out, as typed and as encoded, for the log.
 * @param {string} text @param {string} password @returns {string} */
export function hide(text, password) {
  if (!password) return text;
  return text.split(encodeURIComponent(password)).join('***').split(password).join('***');
}

/** Why the CLI refused, in one line: the message of its JSON error when it printed one, else its last line that is not
 * "Connecting to …".
 * @param {string} output @returns {string} */
export function reason(output) {
  const lines = output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const l of lines) {
    if (!l.startsWith('{')) continue;
    try {
      const m = JSON.parse(l)?.error?.message;
      if (typeof m === 'string' && m) return m;
    } catch {
      // not the CLI's JSON; the lines below still say something
    }
  }
  return lines.filter((l) => !l.startsWith('Connecting to')).at(-1) ?? 'no answer';
}

/** The first candidate the check accepts; or, when none does, why each one refused.
 * @template {{ host: string }} C
 * @param {C[]} list @param {(c: C) => { ok: boolean, error?: string }} tryOne
 * @returns {{ found: C | null, refusals: string[] }} */
export function pick(list, tryOne) {
  /** @type {string[]} */
  const refusals = [];
  for (const c of list) {
    const r = tryOne(c);
    if (r.ok) return { found: c, refusals };
    refusals.push(`${c.host}: ${reason(r.error ?? '')}`);
  }
  return { found: null, refusals };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {
    SUPABASE_PROJECT_REF: ref,
    SUPABASE_REGION: region,
    SUPABASE_DB_PASSWORD: password,
    GITHUB_ENV,
  } = process.env;
  if (!ref || !region || !password || !GITHUB_ENV) {
    console.error(
      '::error title=Production not reached::SUPABASE_PROJECT_REF, SUPABASE_REGION, SUPABASE_DB_PASSWORD and GITHUB_ENV are needed',
    );
    process.exit(1);
  }
  const list = candidates(ref, region, password);
  console.log(`::add-mask::${encodeURIComponent(password)}`);
  for (const c of list) console.log(`::add-mask::${c.url}`);
  const bin = process.env.SUPABASE_BIN || 'supabase';
  const { found, refusals } = pick(list, (c) => {
    const r = spawnSync(bin, ['migration', 'list', '--db-url', c.url, '--output-format', 'json'], {
      cwd: V2,
      encoding: 'utf8',
      maxBuffer: 16 << 20,
    });
    const said = r.error ? String(r.error) : `${r.stderr ?? ''}\n${r.stdout ?? ''}`;
    return { ok: !r.error && r.status === 0, error: hide(said, password) };
  });
  if (!found) {
    console.error(`::error title=Production not reached::no pooler of ${region} answered for the project`);
    for (const line of refusals) console.error(`::error::${line}`);
    process.exit(1);
  }
  fs.appendFileSync(GITHUB_ENV, `SUPABASE_PROD_DB_URL=${found.url}\n`);
  console.log(`production reached through ${found.host} (session mode)`);
}
