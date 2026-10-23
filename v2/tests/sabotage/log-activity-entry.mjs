// Sabotages for Log activity in the + (V646).
const UNIT = 'unit:tests/unit/shell/the-plus-offers-log-activity-between-task-and-achievement.test.ts';
const E2E = 'e2e:tests/e2e/log-activity-from-the-plus.spec.ts';

export const sabotages = [
  {
    name: 'plus-has-no-log-activity',
    breaks: [UNIT],
    expect: 'puts it between Task and the achievement',
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: "    key: 'activity',",
        replace: "    key: 'activity_off',\n    // sabotage",
      },
    ],
  },
  {
    name: 'plus-offers-log-activity-to-anyone',
    breaks: [UNIT],
    expect: 'leaves it out for someone who may not log activities',
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: "    at: ['own', 'full'],\n    dialog: openLogActivity,",
        replace: "    at: ['view', 'own', 'full', 'none'],\n    dialog: openLogActivity,",
      },
    ],
  },
  {
    name: 'log-activity-does-not-ask-who',
    breaks: [E2E],
    expect: 'asks who it was with',
    edits: [
      {
        file: 'src/modules/partners/screens/LogActivityEntry.tsx',
        find: 'disabled={!who}',
        replace: 'disabled={false}',
      },
    ],
  },
  {
    name: 'log-activity-type-opens-empty',
    breaks: ['unit:tests/unit/partners/log-activity-says-where-it-lands.test.tsx'],
    expect: 'opens on Call the first time',
    edits: [
      {
        file: 'src/modules/partners/screens/record/LogActivityDialog.tsx',
        find: "return { type, outcome: '', on: today()",
        replace: "return { type: '', outcome: '', on: today()",
      },
    ],
  },
  {
    name: 'log-activity-title-names-nobody',
    breaks: ['unit:tests/unit/partners/log-activity-says-where-it-lands.test.tsx'],
    expect: 'names the organisation in the title',
    edits: [
      {
        file: 'src/modules/partners/screens/record/LogActivityDialog.tsx',
        find: "title={partnerName ? t('partners.activity.logFor', { name: partnerName }) : t('partners.activity.log')}",
        replace: "title={t('partners.activity.log')}",
      },
    ],
  },
];
