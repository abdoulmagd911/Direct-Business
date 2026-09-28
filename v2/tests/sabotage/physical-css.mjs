export default {
  expect: 'check-no-physical-css',
  files: ['src/ui/Chip.tsx'],
  apply: (f, s) => s.replace('ms-0.5', 'ml-2'),
  command: ['node', 'scripts/check-no-physical-css.mjs'],
};
