// Sabotages for V661: the Today list's four boxes by the importance star and the due day.
const UNIT = 'unit:tests/unit/my-day/the-today-list-sorts-my-tasks-by-star-and-due-day.test.ts';

export const sabotages = [
  {
    // urgency forgets the 2 days: only overdue or due today counts as urgent
    name: 'urgent-means-today-only',
    breaks: [UNIT],
    expect: 'puts a starred task due within 2 days or overdue in Do now',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'daysUntil(t.due_on, day) <= URGENT_WITHIN_DAYS',
        replace: 'daysUntil(t.due_on, day) <= 0',
      },
    ],
  },
  {
    // the star is ignored: a starred task falls into Quick or Later like any other
    name: 'the-star-sorts-nothing',
    breaks: [UNIT],
    expect: 'puts a starred task due within 2 days or overdue in Do now',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "  if (t.starred) return urgent ? 'do_now' : 'plan_it';\n",
        replace: '',
      },
    ],
  },
];
