// D (26 Oct): open items stay visible. The sabotage gives the overdue notice the "coming due" words again.
const E2E = 'e2e:tests/e2e/an-overdue-task-says-overdue-in-the-bell.spec.ts';
export const sabotages = [
  {
    name: 'an-overdue-task-reads-as-coming-due',
    breaks: [E2E],
    expect: 'the bell says it is overdue',
    edits: [
      {
        file: 'src/ui/shell/NotificationsPanel.tsx',
        find: "'alert.overdue': 'notifications.kinds.alert_overdue',",
        replace: "'alert.overdue_never': 'notifications.kinds.alert_overdue',",
      },
    ],
  },
];
