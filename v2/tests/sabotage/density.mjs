// V644: Compact must visibly tighten the list rows. Each sabotage plants the old behaviour; the test must go red.
const E2E = 'e2e:tests/e2e/density-is-visible.spec.ts';
export const sabotages = [
  {
    name: 'compact-keeps-the-list-rows-as-roomy-as-comfortable',
    breaks: [E2E],
    expect: 'Compact makes',
    edits: [
      {
        file: 'src/ui/tokens.css',
        find: '  --list-row-py: 6px;\n  --list-row-min: 44px;\n',
        replace: '  --list-row-py: 12px;\n  --list-row-min: 56px;\n',
      },
      { file: 'src/ui/tokens.css', find: '    --list-row-min: 36px;\n', replace: '    --list-row-min: 56px;\n' },
    ],
  },
];
