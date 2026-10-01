// Sabotages for W43's one more try: a server read that failed on its way is tried again, a refusal never is.
const target = 'unit:tests/unit/db/a-server-read-that-failed-on-its-way-is-tried-once-more.test.ts';

export const sabotages = [
  {
    name: 'a-failed-read-is-never-tried-again',
    breaks: [target],
    expect: '> a gateway that gave up, then an answer: the page gets the answer',
    edits: [
      {
        file: 'src/core/db/retry.ts',
        find: '  if (!isTransient(first)) return first;',
        replace: '  if (first) return first;',
      },
    ],
  },
  {
    name: 'a-refusal-is-tried-again',
    breaks: [target],
    expect: '> a refusal or an error the database gave is an answer, never retried',
    edits: [
      {
        file: 'src/core/db/retry.ts',
        find: "  if (code !== '' && !TRANSIENT_CODES.has(code) && !code.startsWith('08')) return false;\n",
        replace: '',
      },
    ],
  },
];
