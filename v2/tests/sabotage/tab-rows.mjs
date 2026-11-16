// Sabotage for the tab rows: a row that scrolls sideways must not also scroll up and down (a 1 px overhang from the
// underline made a small scrollbar with arrows appear on My day).
const SPEC = 'e2e:tests/e2e/tab-rows-do-not-scroll-up-and-down.spec.ts';

export const sabotages = [
  {
    name: 'tab-row-scrolls-up-and-down-again',
    breaks: [SPEC],
    expect: 'does not scroll up and down',
    edits: [
      {
        file: 'src/ui/Tabs.tsx',
        find: 'overflow-x-auto overflow-y-hidden rounded-pill bg-surface p-1',
        replace: 'h-6 overflow-auto rounded-pill bg-surface p-1',
      },
    ],
  },
  {
    name: 'tab-row-keeps-the-overhang-without-room',
    breaks: [SPEC],
    expect: 'does not scroll up and down',
    edits: [
      {
        file: 'src/ui/Tabs.tsx',
        find: 'gap-1 overflow-x-auto overflow-y-hidden rounded-pill',
        replace: 'max-h-5 gap-1 overflow-x-auto overflow-y-scroll rounded-pill',
      },
    ],
  },
  {
    name: 'tab-focus-ring-is-cut-by-the-row',
    breaks: [SPEC],
    expect: 'the focus ring is drawn inside the tab, not around it',
    edits: [
      {
        file: 'src/ui/Tabs.tsx',
        find: 'focus-visible:-outline-offset-2',
        replace: 'focus-visible:outline-offset-2',
      },
    ],
  },
];
