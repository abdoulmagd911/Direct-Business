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
    name: 'the-who-picker-rows-are-short-on-a-phone',
    breaks: [E2E],
    expect: 'a result row is 44 px high on a phone',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: 'min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-start hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus sm:min-h-10',
        // a zero minimum height (a utility beats the phone rule's 44 px) and tight lines: a row of a name and a code is then about 36 px
        replace:
          'min-h-0 w-full items-center gap-2.5 rounded-md px-2.5 text-start leading-none hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus',
      },
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: '<span className="flex min-w-0 flex-1 flex-col py-1">',
        replace: '<span className="flex min-w-0 flex-1 flex-col py-0">',
      },
    ],
  },
  {
    name: 'the-who-picker-cuts-a-long-name-with-an-ellipsis',
    breaks: [E2E],
    expect: 'the name is not cut with an ellipsis',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: 'className="min-w-0 [overflow-wrap:anywhere]"',
        replace: 'className="min-w-0 truncate"',
      },
    ],
  },
  {
    name: 'the-who-picker-puts-the-code-beside-the-name',
    breaks: [E2E],
    expect: 'the code is on its own line under the name',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: '<span className="flex min-w-0 flex-1 flex-col py-1">',
        replace: '<span className="flex min-w-0 flex-1 flex-row py-1">',
      },
    ],
  },
  {
    name: 'the-chosen-chip-cuts-the-name',
    breaks: [E2E],
    expect: 'the name is not cut with an ellipsis',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: '<span className="min-w-0 [overflow-wrap:anywhere]" data-partner-picked-name>',
        replace: '<span className="min-w-0 truncate" data-partner-picked-name>',
      },
    ],
  },
];
