export default {
  expect: 'unit tokens.test.ts',
  files: ['src/ui/tokens.css'],
  apply: (f, s) => s.replace('--primary: #c94c14;', '--primary: #f06820;'),
  command: ['pnpm', 'vitest', 'run', 'tests/unit/tokens.test.ts'],
};
