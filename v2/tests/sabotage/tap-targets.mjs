// Sabotages for the phone tap sizes (QA3-004 to 006, W41, builder B).
const E2E = 'e2e:tests/e2e/tap-targets.spec.ts';

export const sabotages = [
  {
    name: 'palette-rows-are-40-on-a-phone',
    breaks: [E2E],
    expect: 'the search, the palette rows and the bell',
    edits: [
      {
        file: 'src/ui/shell/CommandPalette.tsx',
        find: "'flex h-11 cursor-default select-none",
        replace: "'flex h-10 cursor-default select-none",
      },
    ],
  },
  {
    name: 'bell-tabs-are-24-wide',
    breaks: [E2E],
    expect: 'the search, the palette rows and the bell',
    edits: [
      { file: 'src/ui/Tabs.tsx', find: 'min-h-11 min-w-11 items-center', replace: 'min-h-11 min-w-6 items-center' },
      { file: 'src/ui/Tabs.tsx', find: "fill && 'min-w-0 flex-auto px-1',", replace: "fill && 'min-w-0 px-1'," },
    ],
  },
  {
    name: 'colour-swatches-are-32-on-a-phone',
    breaks: [E2E],
    expect: 'the colour swatches on My profile',
    edits: [
      { file: 'src/modules/org/screens/MyProfile.tsx', find: "'size-11 rounded-pill", replace: "'size-8 rounded-pill" },
    ],
  },
  {
    name: 'colour-swatches-grow-on-a-wide-screen',
    breaks: [E2E],
    expect: 'the colour swatches on My profile',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: 'focus-visible:outline-offset-2 sm:size-8',
        replace: 'focus-visible:outline-offset-2',
      },
    ],
  },
  {
    name: 'colour-swatches-do-not-wrap',
    breaks: [E2E],
    expect: 'the colour swatches on My profile',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: '<div className="flex flex-wrap gap-2" role="radiogroup"',
        replace: '<div className="flex gap-2" role="radiogroup"',
      },
    ],
  },
  {
    name: 'the-plus-covers-the-last-row',
    breaks: [E2E],
    expect: 'the + clears the last row on every page',
    edits: [
      {
        file: 'src/ui/shell/AppShell.tsx',
        find: 'overflow-y-auto px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-6',
        replace: 'overflow-y-auto px-4 pb-16 pt-6',
      },
      // Create is the bar's last slot (option C, 15 Oct): it is floated again, as the + was, so the short foot shows
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: "'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px]",
        replace:
          "'fixed bottom-[calc(76px+env(safe-area-inset-bottom))] end-4 z-40 flex size-14 flex-col items-center justify-center gap-1 text-[11px]",
      },
    ],
  },
  {
    name: 'client-search-is-36-on-a-phone',
    breaks: [E2E],
    expect: 'the + clears the last row on every page',
    edits: [
      {
        file: 'src/modules/partners/screens/PartnersList.tsx',
        find: 'className="h-[var(--control-h-sm)] w-[220px]"',
        replace: 'className="h-9 w-[220px]"',
      },
    ],
  },
  {
    name: 'bell-tabs-get-a-narrow-strip-again',
    breaks: [E2E],
    expect: "the bell's three tabs sit on one row",
    edits: [
      {
        file: 'src/ui/shell/NotificationsPanel.tsx',
        find: 'className="mt-2"',
        replace: 'className="mt-2 max-w-[164px]"',
      },
    ],
  },
];
