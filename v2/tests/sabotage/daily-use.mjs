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
        find: ': formatDate(`${shown}T12:00:00+03:00`, locale);',
        replace: ': shown;',
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
    name: 'date-box-writes-no-date-beside-the-field',
    breaks: [BOX],
    expect: '> writes the date beside the real field the app writes it, shown only while the field has keyboard focus',
    edits: [{ file: 'src/ui/Input.tsx', find: '        {written}\n      </p>', replace: '      </p>' }],
  },
  {
    name: 'date-box-never-shows-the-date-beside-the-field',
    breaks: ['e2e:tests/e2e/daily-use-12-14.spec.ts'],
    expect: 'the date typed is written beside the field the app way',
    edits: [{ file: 'src/ui/Input.tsx', find: ' shadow-2 peer-focus-visible:block', replace: ' shadow-2' }],
  },
  {
    name: 'date-box-writes-the-date-below-and-moves-the-page',
    breaks: ['e2e:tests/e2e/daily-use-12-14.spec.ts'],
    expect: 'writing the day beside the field moves nothing below it',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: 'pointer-events-none absolute bottom-full end-0 z-30 mb-0.5 hidden rounded-md border border-border bg-raised px-2 py-0.5 text-sm',
        replace: 'hidden pt-1 text-sm',
      },
    ],
  },
  {
    name: 'date-box-writes-the-date-over-the-browsers-own-text',
    breaks: ['e2e:tests/e2e/daily-use-12-14.spec.ts'],
    expect: 'the written day is above the field, not on its text',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: 'absolute bottom-full end-0 z-30 mb-0.5 hidden',
        replace: 'absolute inset-y-0 end-10 z-30 hidden items-center',
      },
    ],
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
        find: '<span className="block break-words">{r.text}</span>',
        replace: '<span className="block truncate">{r.text}</span>',
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
    name: 'toast-covers-the-bottom-bar-on-a-phone',
    breaks: ['e2e:tests/e2e/daily-use-12-14.spec.ts'],
    expect: 'the toast ends above the bottom bar',
    edits: [
      {
        file: 'src/ui/globals.css',
        find: '--offset-bottom: calc(68px + env(safe-area-inset-bottom)) !important;',
        replace: '--offset-bottom: 20px !important;',
      },
      {
        file: 'src/ui/globals.css',
        find: '--mobile-offset-bottom: calc(68px + env(safe-area-inset-bottom)) !important;',
        replace: '--mobile-offset-bottom: 20px !important;',
      },
    ],
  },
];
