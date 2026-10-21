// Sabotages for "the app never draws a raw key" (QA-574, builder C): each breaks one promise of
// tests/unit/i18n/the-app-never-draws-a-raw-key.test.ts.
const UNIT = 'unit:tests/unit/i18n/the-app-never-draws-a-raw-key.test.ts';

export const sabotages = [
  {
    name: 'arabic-has-no-english-underneath',
    breaks: [UNIT],
    expect: 'a line with no Arabic yet',
    edits: [
      {
        file: 'src/core/i18n/fallback.ts',
        find: 'const out: Catalog = { ...base };',
        replace: 'const out: Catalog = {};',
      },
    ],
  },
  {
    name: 'a-key-in-no-catalog-draws-its-key',
    breaks: [UNIT],
    expect: 'a key found in no catalog',
    edits: [
      {
        file: 'src/core/i18n/fallback.ts',
        find: "export const noRawKey = () => '';",
        replace:
          'export const noRawKey = ({ namespace, key }: { namespace?: string; key: string }) =>\n  namespace ? `${namespace}.${key}` : key;',
      },
    ],
  },
  {
    name: 'the-density-help-line-loses-its-arabic',
    breaks: [UNIT],
    expect: 'has an Arabic word for the Density help line',
    edits: [{ file: 'messages/ar.json', find: '"densityHint": "«مريح»', replace: '"densityHintGone": "«مريح»' }],
  },
];
