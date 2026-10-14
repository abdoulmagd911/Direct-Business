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
];
