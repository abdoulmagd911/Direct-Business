// Sabotages for the reminder alert (productivity stage 2, PR 2, builder B).
const UNIT = 'unit:tests/unit/my-day/the-reminder-alert-asks-once-at-the-next-time.test.ts';
const E2E = 'e2e:tests/e2e/reminder-alert.spec.ts';
const SHOWS = 'a reminder at its time shows the alert on any page';
const COMPONENT = 'src/modules/my-day/screens/ReminderAlert.tsx';

export const sabotages = [
  {
    name: 'alert-timer-ignores-the-next-time',
    breaks: [UNIT],
    expect: 'waits for the next reminder, a few seconds past its time',
    edits: [
      {
        file: 'src/modules/my-day/reminder-alert.ts',
        find: 'wait > 0 ? wait + SLACK_MS',
        replace: 'wait > 0 ? SLACK_MS',
      },
    ],
  },
  {
    name: 'alert-snooze-is-sent-as-utc',
    breaks: [UNIT],
    expect: 'sends the Riyadh day and time as an instant at UTC+3',
    edits: [
      {
        file: 'src/modules/my-day/reminder-alert.ts',
        find: 'snoozeInstant = (when: When) => instantOf(when);',
        replace: 'snoozeInstant = (when: When) => `${when.day}T${when.time}:00Z`;',
      },
    ],
  },
  {
    name: 'alert-notifies-again-and-again',
    breaks: [UNIT],
    expect: 'is shown once per reminder id',
    edits: [
      {
        file: 'src/modules/my-day/reminder-alert.ts',
        find: 'return due.filter((r) => !seen.has(r.id));',
        replace: 'return due.filter(() => seen.size < 1000);',
      },
    ],
  },
  {
    name: 'alert-done-leaves-it-in-the-bell',
    breaks: [E2E],
    expect: SHOWS,
    edits: [
      {
        file: COMPONENT,
        find: '{ p_ids: [first.notification_id] }',
        replace: '{ p_ids: [first.notification_id].slice(1) }',
      },
    ],
  },
  {
    name: 'alert-snooze-moves-it-to-the-wrong-day',
    breaks: [E2E],
    expect: 'Snooze > Tomorrow moves the reminder',
    edits: [
      {
        file: COMPONENT,
        find: 'p_at: snoozeInstant(when)',
        replace: "p_at: snoozeInstant({ ...when, day: '2099-01-01' })",
      },
    ],
  },
  {
    name: 'alert-never-sets-its-timer',
    breaks: [E2E],
    expect: 'the alert comes up by itself at the reminder',
    edits: [{ file: COMPONENT, find: 'Math.min(wait, LONGEST_WAIT_MS)', replace: 'LONGEST_WAIT_MS' }],
  },
  {
    name: 'alert-takes-focus-from-a-field',
    breaks: [E2E],
    expect: 'the alert comes up by itself at the reminder',
    edits: [
      {
        file: COMPONENT,
        find: 'onClick={() => void done()}',
        replace: 'autoFocus onClick={() => void done()}',
      },
    ],
  },
  {
    name: 'alert-sits-over-the-plus',
    breaks: [E2E],
    expect: SHOWS,
    edits: [
      {
        file: COMPONENT,
        find: 'className="shrink-0 border-b border-border bg-raised',
        replace: 'className="fixed inset-x-3 bottom-[8px] z-40 border border-border bg-raised',
      },
    ],
  },
  {
    name: 'alert-floats-over-the-page',
    breaks: [E2E],
    expect: 'Hide for now puts the bar away',
    edits: [
      {
        file: COMPONENT,
        find: 'className="shrink-0 border-b border-border bg-raised',
        replace: 'className="fixed inset-x-3 top-[calc(var(--topbar-h)+8px)] z-40 border border-border bg-raised',
      },
    ],
  },
  {
    name: 'alert-hide-also-finishes-it',
    breaks: [E2E],
    expect: 'Hide for now puts the bar away',
    edits: [
      {
        file: COMPONENT,
        find: '    setHidden(next);\n',
        replace:
          "    setHidden(next);\n    void rpc('notifications_mark_read', { p_ids: due.map((r) => r.notification_id) });\n",
      },
    ],
  },
  {
    name: 'alert-hidden-comes-back-on-reload',
    breaks: [E2E],
    expect: 'Hide for now puts the bar away',
    edits: [
      {
        file: COMPONENT,
        find: '    writeHidden(hiddenKey(me.person.id), next);\n',
        replace: '',
      },
    ],
  },
  {
    name: 'alert-snoozed-reminder-stays-hidden',
    breaks: [E2E],
    expect: 'a snoozed reminder that is due again',
    edits: [
      {
        file: 'src/core/prefs/hidden-reminders.ts',
        find: 'hidden[id] === remindAt',
        replace: 'id in hidden',
      },
    ],
  },
  {
    name: 'alert-bar-stacks-its-buttons-on-a-phone',
    breaks: [E2E],
    expect: 'Hide for now puts the bar away',
    edits: [{ file: COMPONENT, find: 'grid grid-cols-3 gap-2 sm:flex', replace: 'flex flex-col gap-2 sm:flex' }],
  },
  {
    name: 'snooze-has-no-one-hour',
    breaks: [UNIT],
    expect: 'offers In 1 hour, Later today, Tomorrow and Next week',
    edits: [
      {
        file: 'src/modules/my-day/reminder-alert.ts',
        find: "['one_hour', 'later_today', 'tomorrow', 'next_week']",
        replace: "['later_today', 'tomorrow', 'next_week']",
      },
    ],
  },
];
