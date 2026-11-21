// Landing 34 (the 19 Nov test round) — Settings and the language. Each sabotage takes back one fix of the round — the
// stored reason printed on a setting's card, the language choice missing when Arabic is on or shown when it is off,
// the words following the cookie instead of the person's profile, Arabic answered while it is off, a language applied
// before it is saved, a failed settings read drawn as settings, a card that crashes without its rows — and the test
// named must go red for it.
const CARD = 'src/modules/settings/screens/SettingCard.tsx';
const SCHEMA = 'src/modules/settings/schema.ts';
const EFFECTIVE = 'src/core/prefs/effective.ts';
const CHOICE = 'src/core/prefs/use-language-choice.ts';
const TEST = 'unit:tests/unit/settings/landing-34-the-arabic-switch-opens-a-language-choice.test.tsx';

export const sabotages = [
  {
    name: 'setting-card-prints-the-stored-reason',
    breaks: [TEST],
    expect: 'says Applies from and the date, and never the reason typed with the change',
    edits: [
      {
        file: CARD,
        find: '  return `${words.appliesFrom} ${day(row.valid_from)}`;',
        replace: "  return `${words.appliesFrom} ${day(row.valid_from)}${row.reason ? ` · ${row.reason}` : ''}`;",
      },
    ],
  },
  {
    name: 'arabic-on-offers-no-language-choice',
    breaks: [TEST],
    expect: 'the Arabic card offers English and العربية while Arabic is on',
    edits: [
      {
        file: CARD,
        find: '{def.key === ARABIC_KEY && def.value === true ? <LanguageChoice /> : null}',
        replace: '{null}',
      },
    ],
  },
  {
    name: 'language-choice-shows-while-arabic-is-off',
    breaks: [TEST],
    expect: 'while Arabic is off there is nothing to choose',
    edits: [
      {
        file: CARD,
        find: '{def.key === ARABIC_KEY && def.value === true ? <LanguageChoice /> : null}',
        replace: '{def.key === ARABIC_KEY ? <LanguageChoice /> : null}',
      },
    ],
  },
  {
    name: 'words-follow-the-cookie-not-the-profile',
    breaks: [TEST],
    expect: 'one rule for the language',
    edits: [
      {
        file: EFFECTIVE,
        // Landing 34b: the cookie left the rule (a person who chose nothing reads the workspace's Arabic), so the
        // sabotage is the nearest one that still ignores the profile — everyone is answered in the workspace's language
        find: "return profileLocale === 'ar' || profileLocale === 'en' ? profileLocale : 'ar';",
        replace: "return 'ar';",
      },
    ],
  },
  {
    name: 'arabic-off-still-answers-in-arabic',
    breaks: [TEST],
    expect: 'one rule for the language',
    edits: [{ file: EFFECTIVE, find: "  if (!app.arabic_enabled) return 'en';\n", replace: '' }],
  },
  {
    name: 'language-is-applied-before-it-is-saved',
    breaks: [TEST],
    expect: 'a save that fails changes nothing on screen and says so',
    edits: [
      {
        file: CHOICE,
        find: "  try {\n    const now = (await io.rpc('me', {})) as MeAnswer;",
        replace: "  io.apply(next);\n  try {\n    const now = (await io.rpc('me', {})) as MeAnswer;",
      },
    ],
  },
  {
    name: 'a-failed-settings-read-is-drawn-as-settings',
    breaks: [TEST],
    expect: 'a read that failed, or an answer with no list of settings, is not an answer',
    edits: [
      {
        file: SCHEMA,
        find: '  if (!Array.isArray(a.settings)) return null;',
        replace: '  if (!Array.isArray(a.settings)) return { can_edit: false, settings: [] };',
      },
    ],
  },
  {
    name: 'a-setting-without-rows-crashes-the-card',
    breaks: [TEST],
    expect: 'the card of a setting whose rows did not arrive is drawn',
    edits: [
      { file: CARD, find: 'const rows = Array.isArray(def.rows) ? def.rows : [];', replace: 'const rows = def.rows;' },
    ],
  },
];
