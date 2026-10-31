// Sabotages for the Arabic sweep of 27 Oct: words of the bell, the Tasks layout switch, Activity, My profile and the sign-in door taken out again.
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
  {
    name: 'arabic-activity-title-missing',
    breaks: [WORDS],
    expect: 'activity.none',
    edits: [{ file: 'messages/ar.json', find: '    "none": "لا تغييرات بعد",\n', replace: '' }],
  },
  {
    name: 'arabic-profile-saved-missing',
    breaks: [WORDS],
    expect: 'profile.saved',
    edits: [{ file: 'messages/ar.json', find: '    "saved": "حُفظ ملفك",\n', replace: '' }],
  },
  {
    name: 'arabic-sign-in-signing-in-missing',
    breaks: [WORDS],
    expect: 'sign_in.password.signingIn',
    edits: [{ file: 'messages/ar.json', find: '      "signingIn": "جارٍ تسجيل الدخول…",\n', replace: '' }],
  },
  {
    name: 'arabic-finance-ready-missing',
    breaks: [WORDS],
    expect: 'finance.ready',
    edits: [{ file: 'messages/ar.json', find: '    "ready": "جاهز",\n', replace: '' }],
  },
  {
    name: 'arabic-finance-refusal-missing',
    breaks: [WORDS],
    expect: 'errors.finance.month_closed',
    edits: [{ file: 'messages/ar.json', find: '      "month_closed": "هذا الشهر مغلق بالفعل",\n', replace: '' }],
  },
];
