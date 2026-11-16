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
        // since #292 the phone's one shared rule sets min-height, which only a class that says its own size beats
        replace: "'flex h-10 min-h-10 cursor-default select-none",
      },
      {
        // since #292 the shared phone rule (globals.css) also holds an option at 44 px, so the sabotage takes both away
        file: 'src/ui/globals.css',
        find: "      [role='menuitemcheckbox'],\n      [role='option']\n    ):not(",
        replace: "      [role='menuitemcheckbox']\n    ):not(",
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
  // The three names below were the colour swatches' (V636 removed them); they now guard the replacement control, the
  // Theme box on My profile: its size on a phone, its size on a wide screen, and one box to a row on a phone.
  {
    name: 'theme-cards-are-short-on-a-phone',
    breaks: [E2E],
    expect: 'every theme card is a 44 px target',
    edits: [
      {
        file: 'src/ui/ThemePicker.tsx',
        find: "'flex min-w-0 flex-col gap-2 rounded-lg border border-border-strong bg-raised px-2.5 pb-3 pt-2.5 text-start",
        replace:
          "'flex max-sm:h-8 max-sm:!min-h-8 max-sm:overflow-hidden min-w-0 flex-col gap-2 rounded-lg border border-border-strong bg-raised px-2.5 pb-3 pt-2.5 text-start",
      },
    ],
  },
  {
    name: 'theme-cards-do-not-share-a-row-on-a-wide-screen',
    breaks: [E2E],
    expect: 'on a wide screen the five cards share one row',
    edits: [
      {
        file: 'src/ui/ThemePicker.tsx',
        find: 'className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"',
        replace: 'className="grid grid-cols-2 gap-3 lg:grid-cols-3"',
      },
    ],
  },
  {
    name: 'theme-cards-run-off-the-phone',
    breaks: [E2E],
    expect: 'every card is inside the screen',
    edits: [
      {
        file: 'src/ui/ThemePicker.tsx',
        find: 'className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"',
        replace: 'className="grid w-[160vw] grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"',
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
        find: "'group flex min-w-0 flex-1 items-center justify-center focus-visible:outline-none'",
        replace:
          "'group fixed bottom-[calc(76px+env(safe-area-inset-bottom))] end-4 z-40 flex size-14 items-center justify-center focus-visible:outline-none'",
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
        // Landing 12 (#1582 triage): the search is the shared Input, and Landing 11's tap-sizes fix gave it
        // min-h-[var(--control-h)] (44 px on a phone), so h-9 alone no longer shrinks it — a zero minimum
        // (the same pattern as period-links-short-on-a-phone) lets the short height show.
        replace: 'className="h-9 min-h-0 w-[220px]"',
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
