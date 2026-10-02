// @ts-check
// QA-502: the production database job keeps its three guards. It writes production only from v2/main (its `if:`), only
// inside the GitHub environment "production" that holds the password and admits v2/main alone (QA-186), and only
// after main's checks and both databases built from zero are green (`needs:`, QA-185). Nothing else reads the
// workflow, so deleting a guard would otherwise leave CI green. The workflow sits beside v2/ at
// .github/workflows/v2.yml; a fixture folder without one has nothing to check.
import fs from 'node:fs';
import path from 'node:path';
import { defineCheck } from './lib.mjs';

const CHECK = 'production-job';
const WORKFLOW = '.github/workflows/v2.yml';
const JOB = 'db-production';
const NEEDS = ['checks', 'db-plain', 'db-supabase'];
const MAIN = "github.ref == 'refs/heads/v2/main'";

/** Whether `inner` is one balanced group, so `(inner)` cannot be split by a top-level `||`. @param {string} inner */
function balanced(inner) {
  let depth = 0;
  for (const ch of inner) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Whether a job's `if:` holds only on v2/main: the ref test first, and anything after it ANDed in one group.
 * @param {string} cond
 */
export function mainOnly(cond) {
  const c = cond.trim().replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  if (!c.startsWith(MAIN)) return false;
  const rest = c.slice(MAIN.length).trim();
  if (rest === '') return true;
  const m = /^&&\s*\((.*)\)$/.exec(rest);
  return !!m && balanced(/** @type {string} */ (m[1]));
}

/** @typedef {{ start: number, lines: string[] }} Block */

/** The job's own lines (at two spaces) and the line it starts on, or null. @param {string} text @returns {Block | null} */
function jobBlock(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `  ${JOB}:`);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !/^ {0,2}\S/.test(/** @type {string} */ (lines[end]))) end++;
  return { start, lines: lines.slice(start + 1, end) };
}

/**
 * A key of the job (four spaces in), its value and its line; list items under it are joined.
 * @param {Block} block @param {string} name @returns {{ value: string, line: number } | null}
 */
function key(block, name) {
  const i = block.lines.findIndex((l) => new RegExp(`^ {4}${name}:`).test(l));
  if (i < 0) return null;
  let value = /** @type {string} */ (block.lines[i])
    .replace(new RegExp(`^ {4}${name}:\\s*`), '')
    .replace(/\s+#.*$/, '');
  for (let j = i + 1; j < block.lines.length && /^ {6}/.test(/** @type {string} */ (block.lines[j])); j++)
    value += ` ${/** @type {string} */ (block.lines[j]).trim()}`;
  return { value: value.trim(), line: block.start + i + 2 };
}

export default defineCheck({
  name: CHECK,
  rule: `QA-185/186/502: the ${JOB} job keeps its v2/main-only if:, environment production and needs ${NEEDS.join(', ')}`,
  run(ctx) {
    const abs = path.join(ctx.root, '..', WORKFLOW);
    const file = `../${WORKFLOW}`;
    if (!fs.existsSync(abs)) {
      const inRepo = ctx.repoRoot && path.relative(ctx.repoRoot, ctx.root) === 'v2';
      return inRepo ? [{ check: CHECK, file, line: 0, message: `${WORKFLOW} is missing` }] : [];
    }
    const block = jobBlock(fs.readFileSync(abs, 'utf8'));
    if (!block) return [{ check: CHECK, file, line: 0, message: `the ${JOB} job is missing from ${WORKFLOW}` }];
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const at = block.start + 1;
    const cond = key(block, 'if');
    if (!cond || !mainOnly(cond.value))
      out.push({
        check: CHECK,
        file,
        line: cond?.line ?? at,
        message: `${JOB} must run on v2/main only: its if: starts with ${MAIN} and ANDs anything else in one group`,
      });
    const env = key(block, 'environment');
    if (!env || !/^(production|name:\s*production(\s|$))/.test(env.value))
      out.push({
        check: CHECK,
        file,
        line: env?.line ?? at,
        message: `${JOB} must run in the GitHub environment "production" (environment: production), which holds the password`,
      });
    const needs = key(block, 'needs');
    const listed = (needs?.value ?? '')
      .replace(/[[\]]|(^|\s)-\s/g, ' ')
      .split(/[\s,]+/)
      .filter(Boolean);
    const missing = NEEDS.filter((n) => !listed.includes(n));
    if (missing.length)
      out.push({
        check: CHECK,
        file,
        line: needs?.line ?? at,
        message: `${JOB} must wait for ${NEEDS.join(', ')} (needs:) — missing ${missing.join(', ')}`,
      });
    return out;
  },
});
