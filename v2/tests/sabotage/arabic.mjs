// @ts-check
// Builder C's Arabic catalog (P3-11, V305): the catalog test goes red for each planted defect, for its reason (V100).
const CATALOG =
  'unit:tests/unit/arabic/every-arabic-message-formats-in-arabic-with-latin-digits-and-the-owners-words.test.ts';
const AR = 'messages/ar.json';
const LOADER = 'unit:tests/unit/arabic/the-language-loader-puts-english-beneath-arabic.test.ts';
const FALLBACK = 'unit:tests/unit/arabic/a-key-with-no-arabic-yet-shows-its-english.test.ts';

/** @type {{ name: string, breaks: string[], expect: string, edits: { file: string, find: string, replace: string }[] }[]} */
export const sabotages = [
  {
    name: 'ar-drops-a-placeholder',
    breaks: [CATALOG],
    expect: 'settings.people.added: [] ≠ [name]',
    edits: [
      {
        file: AR,
        // Anchored on the line before it: another record's `added` line reads the same.
        find: '"signedOutEverywhere": "تم تسجيل خروج {name} من كل الأجهزة",\n      "added": "تمت إضافة {name}"',
        replace: '"signedOutEverywhere": "تم تسجيل خروج {name} من كل الأجهزة",\n      "added": "تمت الإضافة"',
      },
    ],
  },
  {
    name: 'ar-breaks-a-plural',
    breaks: [CATALOG],
    expect: 'table.selected formats',
    edits: [{ file: AR, find: 'one {عنصر واحد محدد}', replace: 'one {عنصر واحد محدد' }],
  },
  {
    name: 'ar-prints-arabic-digits',
    breaks: [CATALOG],
    expect: 'sign_in.digit prints Latin digits',
    edits: [{ file: AR, find: '"digit": "الرقم {n} من 6"', replace: '"digit": "الرقم {n} من ٦"' }],
  },
  {
    name: 'ar-says-a-banned-word',
    breaks: [CATALOG],
    expect: 'منصة B2B للسفر',
    edits: [
      {
        file: AR,
        find: '"brand_line": "الذراع التجارية لتطبيق السفر الشامل"',
        replace: '"brand_line": "منصة B2B للسفر"',
      },
    ],
  },
  {
    name: 'ar-calls-an-admin-al-masool',
    breaks: [CATALOG],
    expect: 'راجع أحد المسؤولين',
    edits: [
      { file: AR, find: 'نسيت كلمة المرور؟ راجع مسؤول النظام.', replace: 'نسيت كلمة المرور؟ راجع أحد المسؤولين.' },
    ],
  },
  {
    name: 'ar-says-company',
    breaks: [CATALOG],
    expect: 'دمج شركتين',
    edits: [{ file: AR, find: '"partner_merge": "دمج شريكين"', replace: '"partner_merge": "دمج شركتين"' }],
  },
  {
    name: 'ar-leaves-english',
    breaks: [CATALOG],
    expect: 'common.saveChanges reads in Arabic',
    edits: [{ file: AR, find: '"saveChanges": "حفظ التغييرات"', replace: '"saveChanges": "Save changes"' }],
  },
  {
    name: 'ar-fallback-shows-the-key',
    breaks: [FALLBACK],
    expect: 'a key with no Arabic shows its English',
    edits: [
      {
        file: 'src/core/i18n/messages.ts',
        find: 'const out: Messages = { ...fallback };',
        replace: 'const out: Messages = {};',
      },
    ],
  },
  {
    name: 'plant-missing-ar-key',
    breaks: ['check:i18n-catalogs'],
    expect: 'missing "nav.collapse"',
    edits: [{ file: AR, find: '    "collapse": "طي القائمة",\n', replace: '' }],
  },
  {
    name: 'ar-writes-a-dotted-key',
    breaks: [FALLBACK],
    expect: 'a key name with a dot in ar.json',
    edits: [
      {
        file: AR,
        find: '      "profile": {\n        "updated": "تحديث الملف الشخصي"\n      },\n',
        replace: '      "profile.updated": "تحديث الملف الشخصي",\n',
      },
    ],
  },
  {
    name: 'request-drops-the-english-fallback',
    breaks: [LOADER],
    expect: 'a key with no Arabic arrives in English',
    edits: [
      {
        file: 'src/core/i18n/request.ts',
        find: 'withFallback((await import(`../../../messages/${locale}.json`)).default as Messages, en)',
        replace: '((await import(`../../../messages/${locale}.json`)).default as Messages)',
      },
    ],
  },
  {
    name: 'ar-calls-an-admin-a-manager',
    breaks: [CATALOG],
    expect: 'an admin is «مسؤول النظام»',
    edits: [{ file: AR, find: 'نسيت كلمة المرور؟ راجع مسؤول النظام.', replace: 'نسيت كلمة المرور؟ راجع مدير النظام.' }],
  },
  {
    name: 'ar-puts-tanween-after-the-alif',
    breaks: [CATALOG],
    expect: 'tanween sits before the alif',
    edits: [{ file: AR, find: 'الإدخال متأخرًا', replace: 'الإدخال متأخراً' }],
  },
  {
    name: 'ar-says-a-retired-form',
    breaks: [CATALOG],
    expect: 'one word for each term (V490)',
    edits: [{ file: AR, find: '"monday": "الاثنين"', replace: '"monday": "الإثنين"' }],
  },
];
