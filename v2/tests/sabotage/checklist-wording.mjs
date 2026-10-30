// Sabotage for the Turn into wording (tests/unit/my-day/the-checklist-dialog-is-titled-as-its-turn-into-entry.test.ts):
// the dialog's title goes back to its own words, not the menu entry's.
export const sabotages = [
  {
    name: 'the-checklist-dialog-has-its-own-title',
    breaks: ['unit:tests/unit/my-day/the-checklist-dialog-is-titled-as-its-turn-into-entry.test.ts'],
    expect: '> English: the dialog title is the menu entry',
    edits: [
      {
        file: 'messages/en.json',
        find: '"itemTitle": "Item on a task\'s checklist"',
        replace: '"itemTitle": "Add to a task\'s checklist"',
      },
    ],
  },
];
