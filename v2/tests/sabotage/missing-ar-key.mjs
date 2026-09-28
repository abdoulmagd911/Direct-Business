export default {
  expect: 'check-i18n',
  files: ['messages/ar.json'],
  apply: (f, s) => s.replace('    "collapse": "طي القائمة",\n', ''),
  command: ['node', 'scripts/check-i18n.mjs'],
};
