// Sabotages for one theme everywhere and the two name boxes (oversight's live walk, 14 Oct, builder B).
const THEME = 'e2e:tests/e2e/one-theme-everywhere.spec.ts';
const NAMES = 'e2e:tests/e2e/profile-names.spec.ts';

export const sabotages = [
  {
    name: 'theme-own-cookie-beats-the-profile',
    breaks: [THEME],
    expect: 'a second browser holding an older value of its own',
    edits: [
      {
        file: 'src/core/prefs/effective.ts',
        find: "const own = (key: 'theme' | 'density') => !me && ownChoice(key, get);",
        replace: "const own = (key: 'theme' | 'density') => ownChoice(key, get);",
      },
    ],
  },
  {
    name: 'my-profile-pins-the-theme-as-a-choice',
    breaks: [THEME],
    expect: 'opening My profile does not turn the theme into a choice',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: "setPref('theme', readTheme(me.profile?.theme) ?? PREF_DEFS.theme.default, { cache: true });",
        replace: "setPref('theme', readTheme(me.profile?.theme) ?? PREF_DEFS.theme.default);",
      },
      {
        file: 'src/core/prefs/effective.ts',
        find: "const own = (key: 'theme' | 'density') => !me && ownChoice(key, get);",
        replace: "const own = (key: 'theme' | 'density') => ownChoice(key, get);",
      },
    ],
  },
  {
    name: 'english-box-shows-the-arabic-name',
    breaks: [NAMES],
    expect: 'each name box shows and saves its own name',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: "value={state.profile?.display_name_en ?? ''}",
        replace: "value={state.profile?.display_name_ar ?? ''}",
      },
    ],
  },
  {
    name: 'arabic-box-saves-into-the-english-column',
    breaks: [NAMES],
    expect: 'each name box shows and saves its own name',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: "onSave={(v) => saveName('display_name_ar', v)}",
        replace: "onSave={(v) => saveName('display_name_en', v)}",
      },
    ],
  },
  {
    name: 'name-boxes-have-no-grey-words',
    breaks: [NAMES],
    expect: "an empty name box shows the header's name in grey",
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: '          placeholder={placeholder}\n',
        replace: '',
      },
    ],
  },
  {
    name: 'name-grey-words-are-saved-as-a-name',
    breaks: [NAMES],
    expect: "an empty name box shows the header's name in grey and saves nothing",
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: '    const v = draft.trim();\n    if (v === value || busy) return;',
        replace: "    const v = draft.trim() || placeholder || '';\n    if (v === value || busy) return;",
      },
    ],
  },
];
