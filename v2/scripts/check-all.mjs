import { spawnSync } from 'node:child_process';
const checks = ['check-no-hex', 'check-no-physical-css', 'check-ui-no-hints', 'check-accent-fill-only', 'check-i18n'];
let failed = 0;
for (const c of checks) {
  const r = spawnSync(process.execPath, [new URL(`./${c}.mjs`, import.meta.url).pathname], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');
