// Sabotages for the sign-in helpers' unit tests (P3-2): each blinds one helper, and its promise must go red.
const target = 'unit:tests/unit/auth/the-sign-in-helpers-mask-return-and-name-safely.test.ts';

export const sabotages = [
  {
    name: 'blind-mask-email',
    breaks: [target],
    expect: '> masks an email to its first letters and ending',
    edits: [{ file: 'src/core/auth/mask.ts', find: 'return `${hide(name, 5)}@', replace: 'return `${name}@' }],
  },
  {
    name: 'blind-safe-next',
    breaks: [target],
    expect: '> returns only to an address on this site, never to the sign-in page',
    edits: [{ file: 'src/core/auth/safe-next.ts', find: " || next.startsWith('//')", replace: '' }],
  },
  {
    name: 'blind-device-label',
    breaks: [target],
    expect: '> names a device by its browser and system only',
    edits: [{ file: 'src/core/auth/device-label.ts', find: "  [/\\bEdg(?:e|A|iOS)?\\//, 'Edge'],\n", replace: '' }],
  },
  {
    name: 'blind-db-errors',
    breaks: [target],
    expect: '> turns a database refusal into its typed error and key',
    edits: [
      {
        file: 'src/core/db/errors.ts',
        find: "if (code === 'P0001' || code.startsWith('23'))",
        replace: "if (code === 'P0001')",
      },
    ],
  },
  {
    name: 'blind-refusal-lines',
    breaks: [target],
    expect: '> shows the right line for each refusal the gate reports',
    edits: [
      { file: 'src/core/auth/me.ts', find: "return 'signed_out_by_admin';", replace: "return 'signed_out_elsewhere';" },
    ],
  },
];
