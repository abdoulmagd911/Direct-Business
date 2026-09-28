/**
 * The sabotage runner (spec §9.1): applies each tests/sabotage/*.mjs mutation to the working tree,
 * runs the command that sabotage names, expects it to FAIL, and restores the files — whatever
 * happens. A sabotage that leaves its tests green fails this run. Usage: node scripts/sabotage.mjs [name…]
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ROOT } from './lib.mjs';

const only = process.argv.slice(2);
const dir = `${ROOT}/tests/sabotage`;
const names = readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, '')).filter((n) => only.length === 0 || only.includes(n));
let bad = 0;
for (const name of names) {
  const sab = (await import(`${dir}/${name}.mjs`)).default;
  const originals = new Map(sab.files.map((f) => [f, readFileSync(`${ROOT}/${f}`, 'utf8')]));
  try {
    for (const f of sab.files) {
      const next = sab.apply(f, originals.get(f));
      if (next === originals.get(f)) throw new Error(`sabotage ${name} changed nothing in ${f}`);
      writeFileSync(`${ROOT}/${f}`, next);
    }
    const r = spawnSync(sab.command[0], sab.command.slice(1), { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...(sab.env ?? {}) } });
    const failed = r.status !== 0;
    console.log(`${failed ? '✓' : '✗'} ${name} — ${sab.expect} ${failed ? 'went red as it should' : 'STAYED GREEN'}`);
    if (!failed) bad++;
  } finally {
    for (const [f, src] of originals) writeFileSync(`${ROOT}/${f}`, src);
  }
}
if (bad) {
  console.error(`${bad} sabotage(s) were not caught`);
  process.exit(1);
}
