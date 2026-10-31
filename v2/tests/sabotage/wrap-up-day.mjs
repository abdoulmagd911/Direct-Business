// Sabotage for the Wrap up day fix: the day under Tomorrow stays on one line because Tomorrow's column is the wider one.
export const sabotages = [
  {
    name: 'wrap-up-columns-are-equal-again',
    breaks: ['e2e:tests/e2e/wrap-up-tomorrow-day-stays-on-one-line.alone.spec.ts'],
    expect: 'the day under Tomorrow is written on one line',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: 'grid grid-cols-[1fr_1.4fr_1fr] gap-2',
        replace: 'grid grid-cols-3 gap-2',
      },
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: 'text-xs font-normal whitespace-nowrap text-muted tabular',
        replace: 'font-data text-xs font-normal text-muted',
      },
    ],
  },
];
