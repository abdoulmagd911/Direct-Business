// D19: Cancel must hold focus; this makes Remove the focused button.
export default {
  expect: 'e2e dialogs.spec.ts (Confirm has Cancel focused)',
  files: ['src/ui/Confirm.tsx'],
  apply: (f, s) =>
    s.replace(
      'cancelRef.current?.focus();',
      "(document.querySelector('[data-confirm-action]') as HTMLElement | null)?.focus();",
    ),
  command: ['pnpm', 'playwright', 'test', 'tests/e2e/dialogs.spec.ts', '-g', 'Confirm'],
  env: { E2E_FRESH: '1', V2_DEV_ME: '1' },
};
