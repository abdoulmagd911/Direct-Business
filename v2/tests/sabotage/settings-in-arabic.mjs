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
        find: '${keyWord(t, k)}: ${valueText(t, `${settingKey}.${k}`, v)}',
        replace: '${keyWord(t, k)}: ${valueText(t, settingKey, v)}',
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
];
