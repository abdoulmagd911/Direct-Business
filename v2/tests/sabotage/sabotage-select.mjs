// Sabotages for the runner's --changed-since (V634 (2), V281): each breaks one rule of which sabotages a change runs,
// and its test must go red.
const target = 'unit:tests/unit/checks/the-sabotage-runner-runs-only-what-a-change-touches.test.ts';
const select = 'scripts/sabotage-select.mjs';
const runner = 'scripts/sabotage.mjs';

export const sabotages = [
  {
    name: 'selection-ignores-a-changed-spec',
    breaks: [target],
    expect: "> a change to one spec runs exactly that spec's sabotages",
    edits: [{ file: select, find: '    if (spec) {', replace: '    if (spec && false) {' }],
  },
  {
    name: 'selection-ignores-modules',
    breaks: [target],
    expect: "> a change in a module runs every sabotage of the specs that cover it, and no other spec's",
    edits: [{ file: select, find: '      for (const p of s.plants) {', replace: '      for (const p of []) {' }],
  },
  {
    name: 'selection-treats-a-loose-file-as-a-module',
    breaks: [target],
    expect: '> a file in no module runs only the sabotages that plant into it',
    edits: [{ file: select, find: '  return m ? m[0] : null;', replace: '  return m ? m[0] : file;' }],
  },
  {
    name: 'selection-misses-a-spec-helper',
    breaks: [target],
    expect: '> a helper a spec imports runs that spec',
    edits: [{ file: runner, find: '    uses.set(spec, [...seen]);', replace: '    uses.set(spec, []);' }],
  },
  {
    name: 'selection-runs-the-whole-file-for-a-new-sabotage',
    breaks: [target],
    expect: '> a new or edited sabotage runs itself alone, not the rest of its file',
    edits: [
      {
        file: runner,
        find: 'if (sourcePath(s) === src && before.get(s.name) !== s.fingerprint) edited.add(s.name);',
        replace: 'if (sourcePath(s) === src) edited.add(s.name);',
      },
    ],
  },
  {
    name: 'selection-says-nothing-when-nothing-runs',
    breaks: [target],
    expect: '> a change that touches nothing they cover runs none, and says so',
    edits: [
      {
        file: runner,
        find: ': nothing to run (v2/main runs the full set on every push).',
        replace: '.',
      },
    ],
  },
  {
    name: 'selection-forgets-ci-runs-everything',
    breaks: [target],
    expect: '> a change to the runner or CI runs every sabotage',
    edits: [{ file: select, find: "  '../.github/workflows/v2.yml',\n", replace: '' }],
  },
];
