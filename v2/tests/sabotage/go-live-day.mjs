// The day the app went live is chosen in the date box and written the one way the app writes a date.
const T = 'unit:tests/unit/settings/the-go-live-day-is-chosen-in-a-date-box.test.tsx';
export const sabotages = [
  {
    name: 'go-live-day-is-typed-as-text',
    breaks: [T],
    expect: 'is chosen in the date box',
    edits: [
      {
        file: 'src/modules/settings/screens/SchemaEditor.tsx',
        find: "if (schema.type === 'string' && schema.pattern === DAY_PATTERN)",
        replace: "if (schema.type === 'string' && schema.pattern === `${DAY_PATTERN}x`)",
      },
    ],
  },
  {
    name: 'go-live-day-is-written-as-stored',
    breaks: [T],
    expect: 'is written 27 Oct 2026 on the card',
    edits: [
      {
        file: 'src/modules/settings/words.ts',
        find: '  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return formatDate(',
        replace: '  if (/^\\d{4}-\\d{2}-\\d{2}x$/.test(v)) return formatDate(',
      },
    ],
  },
];
