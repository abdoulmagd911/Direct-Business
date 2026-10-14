import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// On a pull request the end-to-end sabotages run only for what the change touches (V634 (2), V281): the runner's
// --changed-since is driven here for real, in a throwaway git repository holding a copy of the runner, three demo specs
// and their sabotages. Sabotages: tests/sabotage/sabotage-select.mjs.
const V2 = path.resolve(import.meta.dirname, '../../..');
let repo = '';

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}
function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), content);
}
/** Commits one change on a new branch off main, plans against main, and returns the planned names (sorted). */
function plan(branch: string, change: () => void) {
  git('checkout', '-q', '-B', branch, 'main');
  change();
  git('add', '-A');
  git('commit', '-q', '-m', branch);
  const out = execFileSync('node', ['v2/scripts/sabotage.mjs', '--kind', 'e2e', '--changed-since', 'main', '--plan'], {
    cwd: repo,
    env: { ...process.env, GITHUB_OUTPUT: '' },
  }).toString();
  const names = [...out.matchAll(/^ {2}(\S+) — /gm)].map((m) => m[1]).sort();
  return { out, names };
}

const sabotage = (name: string, spec: string, file: string) =>
  `{ name: '${name}', breaks: ['e2e:tests/e2e/${spec}'], expect: 'x', edits: [{ file: '${file}', find: 'a', replace: 'b' }] }`;

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sabotage-select-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'demo@example.test');
  git('config', 'user.name', 'Demo');
  for (const f of ['sabotage.mjs', 'sabotage-select.mjs'])
    fs.cpSync(path.join(V2, 'scripts', f), path.join(repo, 'v2', 'scripts', f));
  write('v2/tests/e2e/support/demo-stack.ts', 'export const a = 1;\n');
  write('v2/tests/e2e/tasks-demo.spec.ts', "import { a } from './support/demo-stack';\n");
  write('v2/tests/e2e/tasks-phone-demo.spec.ts', 'a\n');
  write('v2/tests/e2e/finance-demo.spec.ts', 'a\n');
  write('v2/src/modules/tasks/List.tsx', 'a\n');
  write('v2/src/modules/tasks/Board.tsx', 'a\n');
  write('v2/src/modules/finance/Overview.tsx', 'a\n');
  write('v2/src/ui/Tabs.tsx', 'a\n');
  write('v2/messages/en.json', '{"a": 1}\n');
  write(
    'v2/tests/sabotage/demo.mjs',
    `export const sabotages = [\n  ${[
      sabotage('tasks-one', 'tasks-demo.spec.ts', 'src/modules/tasks/List.tsx'),
      sabotage('tasks-two', 'tasks-demo.spec.ts', 'src/ui/Tabs.tsx'),
      sabotage('tasks-phone-one', 'tasks-phone-demo.spec.ts', 'src/modules/tasks/Board.tsx'),
      sabotage('finance-one', 'finance-demo.spec.ts', 'src/modules/finance/Overview.tsx'),
      sabotage('finance-words', 'finance-demo.spec.ts', 'messages/en.json'),
    ].join(',\n  ')}\n];\n`,
  );
  git('add', '-A');
  git('commit', '-q', '-m', 'main');
});
afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('the sabotage runner runs only what a change touches', () => {
  it("a change to one spec runs exactly that spec's sabotages", () => {
    const { names, out } = plan('one-spec', () => write('v2/tests/e2e/finance-demo.spec.ts', 'a\nb\n'));
    expect(names).toEqual(['finance-one', 'finance-words']);
    expect(out).toContain('its spec tests/e2e/finance-demo.spec.ts changed');
  });

  it("a change in a module runs every sabotage of the specs that cover it, and no other spec's", () => {
    const { names, out } = plan('one-module', () => write('v2/src/modules/tasks/Calendar.tsx', 'new\n'));
    expect(names).toEqual(['tasks-one', 'tasks-phone-one', 'tasks-two']);
    expect(out).toContain('src/modules/tasks changed, and tests/e2e/tasks-demo.spec.ts covers it');
  });

  it('a file in no module runs only the sabotages that plant into it', () => {
    expect(plan('catalog', () => write('v2/messages/en.json', '{"a": 2}\n')).names).toEqual(['finance-words']);
    expect(plan('kit', () => write('v2/src/ui/Tabs.tsx', 'b\n')).names).toEqual(['tasks-two']);
  });

  it('a helper a spec imports runs that spec', () => {
    const { names } = plan('helper', () => write('v2/tests/e2e/support/demo-stack.ts', 'export const a = 2;\n'));
    expect(names).toEqual(['tasks-one', 'tasks-two']);
  });

  it('a new or edited sabotage runs itself alone, not the rest of its file', () => {
    const { names, out } = plan('new-sabotage', () => {
      const f = path.join(repo, 'v2/tests/sabotage/demo.mjs');
      const text = fs.readFileSync(f, 'utf8');
      fs.writeFileSync(f, text.replace('\n];', `,\n  ${sabotage('brand-new', 'finance-demo.spec.ts', 'x.ts')}\n];`));
    });
    expect(names).toEqual(['brand-new']);
    expect(out).toContain('the sabotage itself is new or edited (demo.mjs)');
  });

  it('a change that touches nothing they cover runs none, and says so', () => {
    const { names, out } = plan('docs', () => write('docs/v2/notes.md', 'words\n'));
    expect(names).toEqual([]);
    expect(out).toContain('nothing to run (v2/main runs the full set on every push)');
    expect(out).toContain('0 sabotage(s) would run.');
  });

  it('a change to the runner or CI runs every sabotage', () => {
    const { names, out } = plan('ci', () => write('.github/workflows/v2.yml', 'name: v2\n'));
    expect(names).toEqual(['finance-one', 'finance-words', 'tasks-one', 'tasks-phone-one', 'tasks-two']);
    expect(out).toContain('../.github/workflows/v2.yml is one the whole set leans on, so every sabotage runs');
  });
});
