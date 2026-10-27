// Sabotages for the Arabic sweep of 27 Oct: words of the bell and the Tasks layout switch taken out again.
const WORDS = 'unit:tests/unit/words/every-word-of-the-live-screens-exists-in-arabic.test.ts';

export const sabotages = [
  {
    name: 'arabic-bell-mark-all-read-missing',
    breaks: [WORDS],
    expect: 'notifications.markAllRead',
    edits: [{ file: 'messages/ar.json', find: '    "markAllRead": "تعليم الكل كمقروء",\n', replace: '' }],
  },
  {
    name: 'arabic-tasks-layout-switch-missing',
    breaks: [WORDS],
    expect: 'pages.tasks.layout.calendar',
    edits: [
      {
        file: 'messages/ar.json',
        find: '        "board": "لوحة",\n        "calendar": "تقويم"\n',
        replace: '        "board": "لوحة"\n',
      },
    ],
  },
];
