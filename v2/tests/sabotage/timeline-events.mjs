// Sabotages for the client timeline's system lines (D5, builder B): each breaks one promise of the unit test and spec.
export const sabotages = [
  {
    name: 'timeline-event-has-no-words',
    breaks: ['unit:tests/unit/partners/a-system-line-on-the-timeline-is-worded-in-both-languages.test.ts'],
    expect: 'words a task added and a task done',
    edits: [{ file: 'src/modules/partners/event-words.ts', find: 'if (!event) return null;', replace: 'return null;' }],
  },
  {
    name: 'timeline-event-has-no-words-on-the-page',
    breaks: ['e2e:tests/e2e/timeline-events.spec.ts'],
    expect: 'a task added to a client',
    edits: [
      {
        file: 'src/modules/partners/event-words.ts',
        find: 'partners.activity.event.',
        replace: 'partners.activity.eventless.',
      },
    ],
  },
];
