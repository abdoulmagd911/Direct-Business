// The shared "Who was it with?" picker: one press picks, Enter picks the highlighted row, rows are 44 px high on a phone.
const E2E = 'e2e:tests/e2e/the-who-picker-selects-in-one-click.spec.ts';
export const sabotages = [
  {
    name: 'the-who-picker-needs-a-second-click',
    breaks: [E2E],
    expect: 'one press picks the result',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: '                    e.preventDefault();\n                    pick(p);\n',
        replace:
          '                    e.preventDefault();\n                    if (i === current && e.detail > 1) pick(p);\n                    else setActive(i);\n',
      },
    ],
  },
  {
    name: 'the-who-picker-ignores-enter',
    breaks: [E2E],
    expect: 'Enter picks the highlighted row',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: "          } else if (e.key === 'Enter') {",
        replace: "          } else if (e.key === 'Escape') {",
      },
    ],
  },
  {
    name: 'the-who-picker-rows-are-40-px-on-a-phone',
    breaks: [E2E],
    expect: 'a result row is 44 px high on a phone',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: 'min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-start hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus sm:min-h-10',
        replace:
          'min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-start hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus',
      },
    ],
  },
];
