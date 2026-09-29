// Sabotages for the pages' own level checks (PRF-002): a page that forgets to ask its level on the server must turn
// its spec red. Run: node scripts/sabotage.mjs --kind e2e --only e2e-a-page-forgets-its-level
const e2e = (spec) => `e2e:tests/e2e/${spec}.spec.ts`;

export const sabotages = [
  {
    name: 'e2e-a-page-forgets-its-level',
    breaks: [e2e('a-page-with-no-level-shows-no-access-by-address')],
    expect: '/finance refuses by address',
    edits: [
      {
        file: 'src/app/(app)/finance/page.tsx',
        find: "const allowed = (me.levels['finance'] ?? 'none') !== 'none';",
        replace: 'const allowed = true; void me;',
      },
    ],
  },
];
