// Sabotages for B (26 Oct): a record's Activity tab reads in words, with Undo on the reader's newest action only.
const E2E = 'e2e:tests/e2e/a-tasks-activity-reads-in-words.spec.ts';
const TIMELINE = 'src/ui/record/ActivityTimeline.tsx';

export const sabotages = [
  {
    // a person's id is shown as it is stored
    name: 'activity-shows-a-persons-id',
    breaks: [E2E],
    expect: 'no id is ever shown',
    edits: [
      {
        file: TIMELINE,
        find: "return people[v]?.displayName ?? '—';",
        replace: 'return v;',
      },
    ],
  },
  {
    // a day is shown as the database keeps it
    name: 'activity-shows-a-raw-date',
    breaks: [E2E],
    expect: 'no raw date is ever shown',
    edits: [
      {
        file: TIMELINE,
        find: "return formatDate(v, locale, { dateStyle: 'medium' });",
        replace: 'return v;',
      },
    ],
  },
  {
    // every request not undone offers Undo, as before
    name: 'activity-offers-undo-on-every-line',
    breaks: [E2E],
    expect: "Undo only on the reader's newest action",
    edits: [
      {
        file: TIMELINE,
        find: '(undoEvery || r.request_id === newestMine)',
        replace: '(undoEvery || true)',
      },
    ],
  },
];
