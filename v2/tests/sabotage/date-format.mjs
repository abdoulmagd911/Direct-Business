// Finding F (one date format everywhere): the day is written as it is (4 Oct 2026), and an empty date box says how it will be
// written (dd mmm yyyy, V653 (2)).
const BOX = 'unit:tests/unit/ui/a-date-box-shows-the-date-the-way-the-app-writes-it.test.tsx';
export const sabotages = [
  {
    name: 'date-pads-the-day',
    breaks: [BOX],
    expect: 'writes the day as it is, never padded',
    edits: [
      {
        file: 'src/core/i18n/format.ts',
        find: "  if (dated) {\n    given.month = 'short';",
        replace: "  if (dated) {\n    given.day = '2-digit';\n    given.month = 'short';",
      },
    ],
  },
  {
    name: 'empty-date-box-shows-only-a-dash',
    breaks: [BOX],
    expect: 'says how the date will be written while the box is empty',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: ": t('common.datePlaceholder');",
        replace: ": '—';",
      },
    ],
  },
];
