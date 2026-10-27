// Sabotages for QA-600 (27 Oct): an empty date box says how the day will be written, in the language of the screen.
const UNIT = 'unit:tests/unit/ui/a-date-box-shows-the-date-the-way-the-app-writes-it.test.tsx';

export const sabotages = [
  {
    name: 'empty-date-box-in-arabic-shows-only-a-dash',
    breaks: [UNIT],
    expect: 'Arabic: day month year, not a dash',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: "type === 'time' ? '—'",
        replace: "type === 'time' || locale !== 'en' ? '—'",
      },
    ],
  },
  {
    name: 'empty-date-box-hint-has-no-arabic',
    breaks: [UNIT],
    expect: 'Arabic: day month year, not a dash',
    edits: [{ file: 'messages/ar.json', find: '    "datePlaceholder": "يوم شهر سنة",\n', replace: '' }],
  },
];
