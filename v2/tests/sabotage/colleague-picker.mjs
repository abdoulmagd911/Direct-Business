// Sabotages for the colleague picker of a note shared with named colleagues (typing narrows the list).
const E2E = 'e2e:tests/e2e/the-colleague-picker-finds-by-typing.spec.ts';

export const sabotages = [
  {
    name: 'the-colleague-picker-ignores-what-is-typed',
    breaks: [E2E],
    expect: 'a name that does not fit is not',
    edits: [
      {
        file: 'src/modules/my-day/screens/PeoplePicker.tsx',
        find: 'options.filter((o) => paletteMatches(o.name, q))',
        replace: 'options',
      },
    ],
  },
  {
    name: 'the-colleague-picker-keeps-the-typed-words-after-a-pick',
    breaks: [E2E],
    expect: 'the box clears for the next name',
    edits: [
      {
        file: 'src/modules/my-day/screens/PeoplePicker.tsx',
        find: "                    onPick(o.id);\n                    setQ('');",
        replace: '                    onPick(o.id);',
      },
    ],
  },
];
