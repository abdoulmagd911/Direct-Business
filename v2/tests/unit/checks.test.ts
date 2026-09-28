/**
 * Each check must fail on a planted violation (spec A15: a test that cannot fail proves nothing).
 * The sabotages themselves live in tests/sabotage/*.mjs; scripts/sabotage.mjs runs them all.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
let tmp = '';
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'v2-check-'));
  cpSync(`${ROOT}/src`, `${tmp}/src`, { recursive: true });
  cpSync(`${ROOT}/messages`, `${tmp}/messages`, { recursive: true });
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function run(check: string) {
  return spawnSync(process.execPath, [`${ROOT}/scripts/${check}.mjs`], {
    env: { ...process.env, CHECK_ROOT: tmp },
    encoding: 'utf8',
  });
}
function plant(file: string, mutate: (s: string) => string) {
  const p = `${tmp}/${file}`;
  writeFileSync(p, mutate(readFileSync(p, 'utf8')));
}

describe('the checks pass on the tree as it is', () => {
  it.each([
    'check-no-hex',
    'check-no-physical-css',
    'check-ui-no-hints',
    'check-accent-fill-only',
    'check-i18n',
  ])('%s', (c) => {
    const r = run(c);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('and each goes red on its planted violation', () => {
  it('check-no-hex: a hex colour in a component', () => {
    plant('src/ui/Button.tsx', (s) =>
      s.replace("'use client';", "'use client';\nconst leak = '#123456';\nvoid leak;"),
    );
    expect(run('check-no-hex').status).toBe(1);
  });
  it('check-no-hex: a Tailwind palette class', () => {
    plant('src/ui/Button.tsx', (s) => s.replace('bg-primary text-on-primary', 'bg-red-500 text-white'));
    expect(run('check-no-hex').status).toBe(1);
  });
  it('check-no-physical-css: ml-2', () => {
    plant('src/ui/Chip.tsx', (s) => s.replace('ms-0.5', 'ml-2'));
    expect(run('check-no-physical-css').status).toBe(1);
  });
  it('check-no-physical-css: a physical property in CSS', () => {
    plant('src/ui/globals.css', (s) => s + '\n.x { margin-left: 4px; }\n');
    expect(run('check-no-physical-css').status).toBe(1);
  });
  it('check-ui-no-hints: a Banner component', () => {
    plant('src/ui/Field.tsx', (s) => s + '\nexport function Banner() { return null; }\n');
    expect(run('check-ui-no-hints').status).toBe(1);
  });
  it('check-ui-no-hints: a hint prop', () => {
    plant('src/ui/Field.tsx', (s) => s.replace('<div className={cn', '<div hint="x" className={cn'));
    expect(run('check-ui-no-hints').status).toBe(1);
  });
  it('check-accent-fill-only: a white label on the accent fill (Direct)', () => {
    plant('src/ui/Button.tsx', (s) => s.replace('bg-primary text-on-primary', 'bg-accent text-on-accent'));
    expect(run('check-accent-fill-only').status).toBe(1);
  });
  it('check-accent-fill-only: text in the accent colour', () => {
    plant('src/ui/EntityLink.tsx', (s) =>
      s.replace('text-link hover:underline', 'text-accent hover:underline'),
    );
    expect(run('check-accent-fill-only').status).toBe(1);
  });
  it('check-i18n: a key missing from ar.json', () => {
    plant('messages/ar.json', (s) => s.replace('"signOut": "تسجيل الخروج",\n', ''));
    expect(run('check-i18n').status).toBe(1);
  });
  it('check-i18n: a hard-coded sentence in a screen', () => {
    plant('src/ui/shell/TopBar.tsx', (s) =>
      s.replace('<CreateMenu />', '<CreateMenu /><span>Click here to start</span>'),
    );
    expect(run('check-i18n').status).toBe(1);
  });
});
