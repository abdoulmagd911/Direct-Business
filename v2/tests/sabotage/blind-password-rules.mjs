// Sabotages for the password rules' unit test (V166): each blinds one rule, and its promise must go red.
const target = 'unit:tests/unit/auth/a-password-is-ten-characters-at-least-and-never-the-email.test.ts';

export const sabotages = [
  {
    name: 'a-short-password-passes',
    breaks: [target],
    expect: '> refuses fewer than ten characters, counted as a person sees them',
    edits: [
      {
        file: 'src/core/auth/password.ts',
        find: 'if ([...password].length < PASSWORD_MIN_LENGTH)',
        replace: 'if (new TextEncoder().encode(password).length < PASSWORD_MIN_LENGTH)',
      },
    ],
  },
  {
    name: 'a-guessable-temporary-password',
    breaks: [target],
    expect: '> generates a temporary password of fourteen characters or more, different every time',
    edits: [
      {
        file: 'src/core/auth/password.ts',
        find: 'out += ALPHABET[randomInt(ALPHABET.length)];',
        replace: 'out += ALPHABET[i % ALPHABET.length];',
      },
    ],
  },
  {
    name: 'a-password-cut-by-auth',
    breaks: [target],
    expect: '> refuses what Auth would cut and the email itself',
    edits: [
      {
        file: 'src/core/auth/password.ts',
        find: 'if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES)',
        replace: 'if ([...password].length > PASSWORD_MAX_BYTES)',
      },
    ],
  },
];
