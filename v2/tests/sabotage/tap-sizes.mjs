// Sabotages for the Architect's ruling of 18 Oct (V630): every tappable thing is 44 px high on a phone, by one shared rule.
const E2E = 'e2e:tests/e2e/tap-sizes-everywhere.spec.ts';
export const sabotages = [
  {
    name: 'the-shared-tap-rule-is-gone',
    breaks: [E2E],
    expect: 'every tappable thing is 44 px high on a phone',
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
    expect: 'every tappable thing is 44 px high on a phone — /profile',
    edits: [
      {
        file: 'src/ui/Switch.tsx',
        find: 'relative inline-flex h-11 w-10 shrink-0 items-center',
        replace: 'relative inline-flex h-6 w-10 shrink-0 items-center',
      },
    ],
  },
];
