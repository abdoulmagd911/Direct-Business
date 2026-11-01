// Sabotages for the Turn into refusal words (tests/unit/my-day/a-turn-into-dialog-refuses-in-its-own-words-not-a-pages.test.ts).
const BOX = 'unit:tests/unit/my-day/a-turn-into-dialog-refuses-in-its-own-words-not-a-pages.test.ts';
export const sabotages = [
  {
    name: 'turn-into-refusal-says-page-again',
    breaks: [BOX],
    expect: 'says its own sentence, with no page in it',
    edits: [
      {
        file: 'src/core/commands/refusal.ts',
        find: 'key === NEEDS_LEVEL ? line : words.failed(key, detail)',
        replace: 'words.failed(key, detail)',
      },
    ],
  },
  {
    name: 'turn-into-checklist-sentence-reworded',
    breaks: [BOX],
    expect: 'says it in the supervisor',
    edits: [
      {
        file: 'messages/en.json',
        find: 'You can only view this task, so you cannot add to its checklist.',
        replace: 'You need more access on this task.',
      },
    ],
  },
  {
    name: 'turn-into-refusal-eats-other-refusals',
    breaks: [BOX],
    expect: 'leaves every other refusal in the catalog',
    edits: [
      {
        file: 'src/core/commands/refusal.ts',
        find: 'key === NEEDS_LEVEL ? line',
        replace: "key.startsWith('errors.access.') ? line",
      },
    ],
  },
  {
    name: 'turn-into-arabic-line-names-a-page',
    breaks: [BOX],
    expect: 'ar · action_item: says its own sentence, with no page in it',
    edits: [
      {
        file: 'messages/ar.json',
        find: 'يمكنك عرض هذه المهمة فقط، لذلك لا يمكنك إضافة بند إلى قائمتها.',
        replace: 'تحتاج صلاحية أعلى على هذه الصفحة.',
      },
    ],
  },
  {
    name: 'turn-into-task-dialog-keeps-the-page-words',
    breaks: [BOX],
    expect: 'the task made from a note and the achievement made from a note',
    edits: [
      {
        file: 'src/modules/tasks/screens/QuickAdd.tsx',
        find: "return fromNote ? withRefusal(w, t('pages.myDay.turn.refused.task')) : w;",
        replace: 'return w;',
      },
    ],
  },
];
