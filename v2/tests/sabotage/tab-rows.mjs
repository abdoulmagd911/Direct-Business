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
        find: "'flex gap-6 overflow-x-auto overflow-y-hidden border-b border-border pb-px max-sm:flex-wrap max-sm:gap-x-4',",
        replace: "'flex gap-6 overflow-x-auto border-b border-border max-sm:flex-wrap max-sm:gap-x-4',",
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
        find: "'flex gap-6 overflow-x-auto overflow-y-hidden border-b border-border pb-px',",
        replace: "'flex gap-6 overflow-x-auto border-b border-border',",
      },
    ],
  },
];
