export default {
  expect: 'check-no-hex',
  files: ['src/ui/Button.tsx'],
  apply: (f, s) => s.replace('bg-primary text-on-primary', 'bg-[#C94C14] text-white'),
  command: ['node', 'scripts/check-no-hex.mjs'],
};
