// Sabotages for daily use, items 12–14 (V638): the date written one way, a date box that shows it, a scrolling row that
// shows there is more, and a reminder row that says Done and wraps its words. Each breaks one promise of a unit test.
const FORMAT = 'unit:tests/unit/format.test.ts';
const BOX = 'unit:tests/unit/ui/a-date-box-shows-the-date-the-way-the-app-writes-it.test.tsx';
const ROW = 'unit:tests/unit/my-day/a-later-reminder-says-done-and-wraps-its-title.test.tsx';

export const sabotages = [
  {
    name: 'date-writes-sept-again',
    breaks: [FORMAT],
    expect: '> every month is three letters, whichever way the date is asked for',
    edits: [{ file: 'src/core/i18n/format.ts', find: 'p.value.slice(0, 3)', replace: 'p.value' }],
  },
  {
    name: 'date-keeps-a-long-month',
    breaks: [FORMAT],
    expect: '> every month is three letters, whichever way the date is asked for',
    edits: [
      { file: 'src/core/i18n/format.ts', find: "    given.month = 'short';\n", replace: '' },
      { file: 'src/core/i18n/format.ts', find: 'p.value.slice(0, 3)', replace: 'p.value' },
    ],
  },
  {
    name: 'date-box-shows-the-browser-format',
    breaks: [BOX],
    expect: '> shows 14 Oct 2026 and keeps the value and the type of the input under it',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: ': formatDate(`${shown}T12:00:00+03:00`, locale)}',
        replace: ': shown}',
      },
    ],
  },
  {
    name: 'date-box-hides-the-field-while-typing',
    breaks: [BOX],
    expect: '> shows the real field, and hides the written date, while the field has keyboard focus',
    edits: [{ file: 'src/ui/Input.tsx', find: ' focus-visible:opacity-100', replace: '' }],
  },
  {
    name: 'date-box-hides-the-field-while-typing-in-the-browser',
    breaks: ['e2e:tests/e2e/daily-use-12-14.spec.ts'],
    expect: 'the real date field shows while it has keyboard focus',
    edits: [{ file: 'src/ui/Input.tsx', find: ' focus-visible:opacity-100', replace: '' }],
  },
  {
    name: 'date-time-box-is-left-to-the-browser',
    breaks: [BOX],
    expect: '> shows a date with a time the same way',
    edits: [{ file: 'src/ui/Input.tsx', find: " || rest.type === 'datetime-local'", replace: '' }],
  },
  {
    name: 'scrolling-row-never-says-there-is-more',
    breaks: [BOX],
    expect: '> more at the end at the start, both in the middle, more at the start at the end',
    edits: [
      {
        file: 'src/ui/use-scroll-more.ts',
        find: "return start && end ? 'both' : start ? 'start' : end ? 'end' : undefined;",
        replace: 'return undefined;',
      },
    ],
  },
  {
    name: 'reminder-row-says-remove-again',
    breaks: [ROW],
    expect: '> says Done, not Remove',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "{t('pages.myDay.alert.done')}",
        replace: "{t('common.remove')}",
      },
    ],
  },
  {
    name: 'reminder-title-is-cut-off-again',
    breaks: [ROW],
    expect: '> wraps its words instead of cutting them off',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: '<span className="min-w-0 flex-1 break-words">{r.text}</span>',
        replace: '<span className="min-w-0 flex-1 truncate">{r.text}</span>',
      },
    ],
  },
  {
    name: 'wrap-next-week-lands-on-the-wrong-day',
    breaks: ['unit:tests/unit/my-day/my-day-turns-a-note-into-what-has-landed-and-wraps-up-the-day.test.tsx'],
    expect: '> shows the day Next week lands on: the first Sunday after the next working day',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'while (d.getUTCDay() !== 0);',
        replace: 'while (d.getUTCDay() !== 1);',
      },
    ],
  },
  {
    name: 'wrap-next-week-shows-no-date',
    breaks: ['e2e:tests/e2e/capture-wrap.spec.ts'],
    expect: 'Next week shows its date in the same format as Tomorrow',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: "move === 'next_week'",
        replace: "(move as string) === 'never'",
      },
    ],
  },
  {
    name: 'toast-covers-the-bottom-bar-on-a-phone',
    breaks: ['e2e:tests/e2e/daily-use-12-14.spec.ts'],
    expect: 'the toast ends above the bottom bar',
    edits: [
      {
        file: 'src/ui/globals.css',
        find: '--offset-bottom: calc(140px + env(safe-area-inset-bottom)) !important;',
        replace: '--offset-bottom: 20px !important;',
      },
      {
        file: 'src/ui/globals.css',
        find: '--mobile-offset-bottom: calc(140px + env(safe-area-inset-bottom)) !important;',
        replace: '--mobile-offset-bottom: 20px !important;',
      },
    ],
  },
];
