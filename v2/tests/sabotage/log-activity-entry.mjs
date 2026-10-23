// Sabotages for Log activity in the + (V646).
const UNIT = 'unit:tests/unit/shell/the-plus-offers-log-activity-between-task-and-achievement.test.ts';
const PHONE = 'e2e:tests/e2e/log-activity-title-and-reason.spec.ts';
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
        find: "{partnerName ? t('partners.activity.logFor', { name: partnerName }) : t('partners.activity.log')}",
        replace: "{t('partners.activity.log')}",
      },
    ],
  },
  {
    name: 'log-activity-saves-without-a-line',
    breaks: ['unit:tests/unit/partners/log-activity-says-where-it-lands.test.tsx'],
    expect: 'keeps Save off and says what to write',
    edits: [
      {
        file: 'src/modules/partners/screens/record/LogActivityDialog.tsx',
        find: '    !!f.body.trim() &&\n',
        replace: '',
      },
    ],
  },
  {
    name: 'log-activity-outcome-never-says-optional',
    breaks: ['unit:tests/unit/partners/log-activity-says-where-it-lands.test.tsx'],
    expect: 'reads Outcome (optional)',
    edits: [
      {
        file: 'src/modules/partners/screens/record/LogActivityDialog.tsx',
        find: "own.length ? t('partners.activity.outcome') : t('partners.activity.outcomeOptional')",
        replace: "t('partners.activity.outcome')",
      },
    ],
  },
  {
    name: 'log-activity-title-has-no-cap',
    breaks: [PHONE],
    expect: 'keeps to three lines',
    edits: [
      {
        file: 'src/modules/partners/screens/record/LogActivityDialog.tsx',
        find: "open ? 'break-words' : 'line-clamp-3 break-words'",
        replace: "'break-words'",
      },
    ],
  },
  {
    name: 'log-activity-reason-is-left-in-the-form',
    breaks: [PHONE],
    expect: 'sits next to Save',
    edits: [
      {
        file: 'src/modules/partners/screens/record/LogActivityDialog.tsx',
        find: '<p className="w-full text-sm text-muted sm:w-auto sm:flex-1" role="status" data-activity-why>',
        replace:
          '<p className="w-full text-sm text-muted sm:w-auto sm:flex-1 absolute -bottom-96" role="status" data-activity-why>',
      },
    ],
  },
];
