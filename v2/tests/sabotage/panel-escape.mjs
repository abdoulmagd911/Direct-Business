// M93: Escape closes the detail panel and returns focus; this drops the key handler.
export default {
  expect: 'e2e dialogs.spec.ts (Escape closes the detail panel)',
  files: ['src/ui/DetailPanel.tsx'],
  apply: (f, s) =>
    s.replace("if (e.key === 'Escape' && panel.current?.contains(document.activeElement)) {", 'if (false) {'),
  command: ['pnpm', 'playwright', 'test', 'tests/e2e/dialogs.spec.ts', '-g', 'detail panel'],
  env: { E2E_FRESH: '1', V2_DEV_ME: '1' },
};
