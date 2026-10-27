// Sabotages for QA-591, Settings in Arabic: each plants the break the tests of tests/unit/settings/ exist to catch.
const PAGES = 'unit:tests/unit/settings/the-settings-pages-read-in-arabic.test.tsx';
const CHOICES = 'unit:tests/unit/settings/every-choice-and-field-of-a-setting-has-arabic-words.test.tsx';
const ORG = 'unit:tests/unit/settings/people-teams-and-access-read-in-arabic.test.tsx';

export const sabotages = [
  {
    name: 'arabic-settings-button-word-missing',
    breaks: [PAGES],
    expect: 'no catalog key',
    edits: [
      {
        file: 'messages/ar.json',
        find: '      "saved": "تم حفظ الإعداد",\n      "change": "تغيير",\n',
        replace: '      "saved": "تم حفظ الإعداد",\n',
      },
    ],
  },
  {
    name: 'arabic-notification-kind-word-missing',
    breaks: [PAGES, CHOICES],
    expect: 'alert_file_review',
    edits: [
      {
        file: 'messages/ar.json',
        find: '      "alert_file_review": "ملف ينتظر المراجعة",\n',
        replace: '',
      },
    ],
  },
  {
    name: 'arabic-settings-object-field-drawn-as-its-key',
    breaks: [CHOICES],
    expect: 'prefix',
    edits: [
      {
        file: 'src/modules/settings/screens/SchemaEditor.tsx',
        find: '          <Field key={k} label={keyWords(k)}>',
        replace: '          <Field key={k} label={k}>',
      },
    ],
  },
  {
    name: 'arabic-settings-object-value-worded-without-its-field',
    breaks: [CHOICES],
    expect: 'finance.revenue_definition',
    edits: [
      {
        file: 'src/modules/settings/words.ts',
        find: '${valueText(t, `${settingKey}.${k}`, v, names)}',
        replace: '${valueText(t, settingKey, v, names)}',
      },
    ],
  },
  {
    name: 'arabic-people-list-shows-the-english-name',
    breaks: [ORG],
    expect: 'the Arabic name of p1',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: '(arabic && p.full_name_ar) || p.full_name_en;',
        replace: 'p.full_name_en;',
      },
    ],
  },
  {
    name: 'arabic-access-checkbox-label-is-the-capability-key',
    breaks: [ORG],
    expect: 'no catalog key',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: 'label={`${roleName(r)} · ${capWord(c.key)}`}',
        replace: 'label={`${roleName(r)} · ${c.key}`}',
      },
    ],
  },
  {
    name: 'arabic-roles-table-shows-the-key-column',
    breaks: [ORG],
    expect: 'no English role name or role key',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: '{arabic ? null : <td className="px-4 py-2.5 font-data text-muted">{r.key}</td>}',
        replace: '<td className="px-4 py-2.5 font-data text-muted">{r.key}</td>',
      },
    ],
  },
  {
    name: 'arabic-avatar-takes-english-initials',
    breaks: [ORG],
    expect: 'the avatar of',
    edits: [
      {
        file: 'src/modules/org/types.ts',
        find: "fullName: locale === 'ar' && p.full_name_ar ? p.full_name_ar : p.full_name_en,",
        replace: 'fullName: p.full_name_en,',
      },
    ],
  },
  {
    name: 'arabic-initials-take-the-article',
    breaks: [ORG],
    expect: 'the avatar of',
    edits: [
      {
        file: 'src/ui/Avatar.tsx',
        find: "w?.replace(/^ال(?=\\p{L}{2})/u, '')[0] ?? ''",
        replace: "w?.[0] ?? ''",
      },
    ],
  },
  {
    name: 'arabic-list-valued-setting-shows-the-keys',
    breaks: [CHOICES],
    expect: 'flights',
    edits: [
      {
        file: 'src/modules/settings/words.ts',
        find: '  const listed = names?.(settingKey, v);\n  if (listed) return listed;\n',
        replace: '',
      },
    ],
  },
  {
    name: 'arabic-gate-person-page-word-missing',
    breaks: ['unit:tests/unit/words/every-word-the-settings-screens-use-exists-in-arabic.test.ts'],
    expect: 'ar: settings.people.signInLog',
    edits: [
      {
        file: 'messages/ar.json',
        find: '      "signInLog": "سجل الدخول",\n',
        replace: '',
      },
    ],
  },
  {
    name: 'arabic-gate-new-screen-word-has-no-wording',
    breaks: ['unit:tests/unit/words/every-word-the-settings-screens-use-exists-in-arabic.test.ts'],
    expect: 'ar: settings.setting.brandNew',
    edits: [
      {
        file: 'src/modules/settings/screens/SettingCard.tsx',
        find: "{t('settings.setting.change')}",
        replace: "{t('settings.setting.change')}{t('settings.setting.brandNew')}",
      },
    ],
  },
  {
    name: 'arabic-gate-level-word-missing',
    breaks: ['unit:tests/unit/words/every-word-the-settings-screens-use-exists-in-arabic.test.ts'],
    expect: 'ar: levels.own',
    edits: [
      {
        file: 'messages/ar.json',
        find: '    "own": "سجلاته فقط",\n',
        replace: '',
      },
    ],
  },
];
