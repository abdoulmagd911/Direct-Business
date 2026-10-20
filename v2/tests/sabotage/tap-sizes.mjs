// Sabotages for the Architect's ruling of 18 Oct (V630): every tappable thing is 44 px wide and high on a phone, by one shared rule.
const E2E = 'e2e:tests/e2e/tap-sizes-everywhere.spec.ts';
const ARABIC = 'e2e:tests/e2e/app-settings.alone.spec.ts';
export const sabotages = [
  {
    name: 'the-shared-tap-rule-is-gone',
    breaks: [E2E, ARABIC],
    expect: 'every tappable thing is 44 px wide and high on a phone',
    edits: [{ file: 'src/ui/globals.css', find: '      min-height: var(--hit);', replace: '      min-height: 0;' }],
  },
  {
    name: 'the-my-day-chips-go-back-to-36',
    breaks: [E2E],
    expect: 'the All / Note chips are 44 px on a phone',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "'inline-flex min-h-11 items-center rounded-pill sm:min-h-9 border px-3 text-sm font-medium",
        replace: "'inline-flex min-h-9 items-center rounded-pill border px-3 text-sm font-medium",
      },
    ],
  },
  {
    name: 'the-switch-is-24-px-on-a-phone',
    breaks: [E2E],
    expect: '/profile — ',
    edits: [
      {
        file: 'src/ui/Switch.tsx',
        find: 'relative inline-flex h-11 w-11 shrink-0 items-center',
        replace: 'relative inline-flex h-6 w-11 shrink-0 items-center',
      },
    ],
  },
  {
    name: 'the-tap-rule-forgets-the-width',
    breaks: [E2E, ARABIC],
    expect: 'every tappable thing is 44 px wide and high on a phone',
    edits: [{ file: 'src/ui/globals.css', find: '      min-width: var(--hit);', replace: '      min-width: 0;' }],
  },
  {
    name: 'the-switch-is-40-px-wide-on-a-phone',
    breaks: [E2E],
    expect: 'every tappable thing is 44 px wide and high on a phone',
    edits: [
      {
        file: 'src/ui/Switch.tsx',
        find: 'relative inline-flex h-11 w-11 shrink-0 items-center sm:w-10',
        replace: 'relative inline-flex h-11 w-10 shrink-0 items-center sm:w-10',
      },
    ],
  },
  {
    name: 'a-row-link-centres-its-words',
    breaks: [E2E, ARABIC],
    expect: 'the words start at the start edge of their link, not centred in it',
    edits: [
      {
        file: 'src/ui/globals.css',
        find: '      display: inline-flex;\n      align-items: center;\n',
        replace: '      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n',
      },
    ],
  },
];
