// Sabotages for the 13 Oct sweep, PR 1 (builder B): New invoice on Finance, avatar initials.
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';

export const sabotages = [
  {
    name: 'finance-new-button-always-hidden',
    breaks: ['e2e:tests/e2e/finance-new-button.spec.ts'],
    expect: 'New invoice is on the page for Full',
    edits: [
      {
        file: OVERVIEW,
        find: '          full ? (\n            <Link',
        replace: '          full && !full ? (\n            <Link',
      },
    ],
  },
  {
    name: 'finance-new-button-for-everyone',
    breaks: ['e2e:tests/e2e/finance-new-button.spec.ts'],
    expect: 'a member does not get the New invoice button',
    edits: [
      {
        file: OVERVIEW,
        find: '          full ? (\n            <Link',
        replace: '          full || !full ? (\n            <Link',
      },
    ],
  },
  {
    name: 'initials-take-the-digit',
    breaks: ['unit:tests/unit/ui/initials-come-from-letters.test.ts'],
    expect: 'skips words that are not names',
    edits: [
      {
        file: 'src/ui/Avatar.tsx',
        find: 'const named = words.filter((w) => /^\\p{L}/u.test(w));',
        replace: 'const named = words;',
      },
    ],
  },
];
