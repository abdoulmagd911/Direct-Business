// Landing 35, item 4 — Today's three fills 3 + 3 + 3 (the fill itself is the database's: THREE-01 and its SQL plants).
// This plant is the screen's half: it draws every task the database picked.
export const sabotages = [
  {
    // the screen keeps two of a group's three
    name: 'e2e-l35-todays-three-draws-two-of-three',
    breaks: ['e2e:tests/e2e/landing-35-todays-three.spec.ts'],
    expect: 'important is filled to three',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'out[g].length >= THREE_EACH',
        replace: 'out[g].length >= THREE_EACH - 1',
      },
    ],
  },
];
