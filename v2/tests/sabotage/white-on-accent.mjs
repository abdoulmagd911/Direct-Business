export default {
  expect: 'check-accent-fill-only',
  files: ['src/ui/Button.tsx'],
  apply: (f, s) =>
    s.replace(
      'bg-primary text-on-primary hover:bg-primary-hover',
      'bg-accent text-on-accent hover:bg-accent-hover',
    ),
  command: ['node', 'scripts/check-accent-fill-only.mjs'],
};
