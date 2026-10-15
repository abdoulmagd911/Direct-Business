// Sabotage for the floating + clearance (the architect's ruling of 15 Oct): a page without its foot padding ends under the +.
const E2E = 'e2e:tests/e2e/plus-clear.spec.ts';

export const sabotages = [
  {
    name: 'page-foot-has-no-room-for-the-plus',
    breaks: [E2E],
    expect: 'the floating + covers nothing at the foot of',
    edits: [
      {
        file: 'src/ui/shell/AppShell.tsx',
        find: 'px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-6 sm:px-6',
        replace: 'px-4 pb-0 pt-6 sm:px-6',
      },
    ],
  },
];
