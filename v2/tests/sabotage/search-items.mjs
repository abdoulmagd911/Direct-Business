// Sabotages for V660: the search box names the checklist item a task or a note was found by.
const E2E = 'e2e:tests/e2e/search-finds-checklist-items.spec.ts';

export const sabotages = [
  {
    // the search box finds the task by its item but never says which item
    name: 'search-box-hides-the-item',
    breaks: [E2E],
    expect: 'and the search box names the item',
    edits: [
      {
        file: 'src/ui/shell/CommandPalette.tsx',
        find: `                        {k.title}
                        {k.item ? (`,
        replace: `                        {k.title}
                        {k.item && false ? (`,
      },
    ],
  },
];
