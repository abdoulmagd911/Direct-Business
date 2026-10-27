// Sabotage for QA 2's finding of 26 Oct: the Arabic word of a note's task link is taken out again.
export const sabotages = [
  {
    name: 'arabic-note-task-link-word-missing',
    breaks: ['unit:tests/unit/words/the-my-day-note-links-read-in-arabic.test.ts'],
    expect: 'My day words with no Arabic',
    edits: [
      {
        file: 'messages/ar.json',
        find: '        "linkTask": "مهمة {number} · {title}",\n',
        replace: '',
      },
    ],
  },
];
