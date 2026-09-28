// The runtime half of V7: a label drawn on the accent fill in the kit must be caught by the Direct walk.
export default {
  expect: 'e2e kit.spec.ts (Direct never puts text on the accent fill)',
  files: ['src/app/(app)/kit/KitGallery.tsx'],
  apply: (f, s) =>
    s.replace(
      '<Section title="Buttons">',
      '<Section title="Buttons"><span className="bg-accent px-2">Label on orange</span>',
    ),
  command: ['pnpm', 'playwright', 'test', 'tests/e2e/kit.spec.ts', '-g', 'accent fill'],
  env: { E2E_FRESH: '1', V2_DEV_ME: '1' },
};
