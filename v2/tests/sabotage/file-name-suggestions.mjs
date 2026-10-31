// Sabotages for E (31 Oct): a file's name is suggested from what it says, and never from an identity (V655 B).
const UNIT = 'unit:tests/unit/files/a-file-name-is-suggested-from-what-it-says-and-never-from-an-id.test.ts';
const RULES = 'src/core/files/suggest-name.ts';

export const sabotages = [
  {
    name: 'name-suggested-from-an-id-file',
    breaks: [UNIT],
    expect: 'anywhere in the text suggests nothing at all',
    edits: [
      {
        file: RULES,
        find: 'if (SENSITIVE.some((r) => r.test(asciiDigits(input.text)))) return',
        replace: 'if (false) return',
      },
    ],
  },
  {
    name: 'name-suggested-from-a-never-read-kind',
    breaks: [UNIT],
    expect: 'a kind marked never-read is not read at all',
    edits: [
      {
        file: RULES,
        find: 'k.key === input.chosenKind && k.neverRead',
        replace: 'k.key === input.chosenKind && !k.neverRead',
      },
    ],
  },
  {
    name: 'name-suggested-from-a-scan',
    breaks: [UNIT],
    expect: 'an image or a scan with no text gets the pattern name only',
    edits: [
      { file: RULES, find: "if (input.mime.startsWith('image/') || input.text.trim() === '')", replace: 'if (false)' },
    ],
  },
  {
    name: 'name-guesses-between-two-kinds',
    breaks: [UNIT],
    expect: 'finds the kind from English or Arabic words',
    edits: [{ file: RULES, find: 'return tied ? null : best;', replace: 'return best;' }],
  },
  {
    name: 'name-takes-a-day-that-is-not-a-day',
    breaks: [UNIT],
    expect: 'reads the first real day in the text',
    edits: [{ file: RULES, find: 'if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;', replace: '' }],
  },
  {
    name: 'name-suggested-from-a-15-digit-card',
    breaks: [UNIT],
    expect: 'a 15-digit card number anywhere in the text suggests nothing at all',
    edits: [{ file: RULES, find: '(?:\\d[ -]?){12,18}\\d', replace: '(?:\\d[ -]?){15}\\d' }],
  },
  {
    name: 'name-suggested-from-a-digit-only-passport',
    breaks: [UNIT],
    expect: 'a passport number of digits only anywhere in the text suggests nothing at all',
    edits: [
      { file: RULES, find: '[\\s.:]*[a-z]?\\d{7,9}\\b/i,\n  /جواز', replace: '[\\s.:]*[a-z]\\d{7,9}\\b/i,\n  /جواز' },
    ],
  },
];
