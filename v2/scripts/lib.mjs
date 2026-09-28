import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = process.env.CHECK_ROOT ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '');

export function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p, exts, out);
    } else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

export function rel(p) {
  return relative(ROOT, p);
}

export function read(p) {
  return readFileSync(p, 'utf8');
}

export function report(name, problems) {
  if (problems.length === 0) {
    console.log(`✓ ${name}`);
    return true;
  }
  console.error(`✗ ${name} — ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  return false;
}

/** Source with block comments blanked (newlines kept, so line numbers stay right) and // comments cut. */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n');
}
