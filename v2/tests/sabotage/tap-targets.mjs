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
  // The three names below were the colour swatches' (V636 removed them); they now guard the replacement control, the
  // Theme box on My profile: its size on a phone, its size on a wide screen, and one box to a row on a phone.
  {
    name: 'colour-swatches-are-32-on-a-phone',
    breaks: [E2E],
    expect: 'the Theme box on My profile',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: '                options={THEMES.map((k) => ({ value: k, label: t(`theme.${k}`) }))}\n',
        replace:
          '                options={THEMES.map((k) => ({ value: k, label: t(`theme.${k}`) }))}\n                className="h-8"\n',
      },
    ],
  },
  {
    name: 'colour-swatches-grow-on-a-wide-screen',
    breaks: [E2E],
    expect: 'the Theme box on My profile',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: '                options={THEMES.map((k) => ({ value: k, label: t(`theme.${k}`) }))}\n',
        replace:
          '                options={THEMES.map((k) => ({ value: k, label: t(`theme.${k}`) }))}\n                className="h-11"\n',
      },
    ],
  },
  {
    name: 'colour-swatches-do-not-wrap',
    breaks: [E2E],
    expect: 'the Theme box on My profile',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: '<div className="grid gap-4 sm:grid-cols-2">\n          <Field label={t(\'profile.theme\')}>',
        replace: '<div className="grid grid-cols-2 gap-4">\n          <Field label={t(\'profile.theme\')}>',
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
