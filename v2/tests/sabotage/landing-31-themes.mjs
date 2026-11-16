// Landing 31 · the five themes and their switcher. Each plant breaks one promise of the theme rules board.
const UNIT = 'unit:tests/unit/theme/the-theme-switcher-changes-at-once-and-saves.test.tsx';
export const sabotages = [
  {
    name: 'theme-pick-is-not-saved-to-the-profile',
    breaks: [UNIT],
    expect: 'applies first, then writes the profile at its current version',
    edits: [
      {
        file: 'src/core/prefs/use-theme-choice.ts',
        find: "    await io.rpc('profile_update', {\n      p_changes: { theme: next },",
        replace: "    await io.rpc('me', {\n      p_changes: { theme: next },",
      },
    ],
  },
  {
    name: 'theme-pick-waits-for-the-save-before-changing',
    breaks: [UNIT],
    expect: 'applies first, then writes the profile at its current version',
    edits: [
      {
        file: 'src/core/prefs/use-theme-choice.ts',
        find: "  io.apply(next);\n  try {\n    const now = (await io.rpc('me', {})) as MeAnswer;",
        replace: "  try {\n    const now = (await io.rpc('me', {})) as MeAnswer;\n    io.apply(next);",
      },
    ],
  },
  {
    name: 'a-failed-theme-save-leaves-the-screen-changed',
    breaks: [UNIT],
    expect: 'a save that fails puts the screen back and says so',
    edits: [
      {
        file: 'src/core/prefs/use-theme-choice.ts',
        find: "    io.apply(readTheme(before) ?? 'light');\n",
        replace: '',
      },
    ],
  },
  {
    name: 'turquoise-is-not-marked-opt-in',
    breaks: [UNIT],
    expect: 'marks Turquoise as opt-in',
    edits: [
      {
        file: 'src/ui/ThemePicker.tsx',
        find: "            {k === 'turquoise' ? <StatusChip tone=\"info\">{t('themePicker.optIn')}</StatusChip> : null}\n            {k === defaultTheme",
        replace: '            {k === defaultTheme',
      },
    ],
  },
  {
    name: 'the-theme-list-loses-system',
    breaks: ['unit:tests/unit/prefs.test.ts'],
    expect: 'five',
    edits: [
      {
        file: 'src/core/prefs/index.ts',
        find: "['light', 'dark', 'direct', 'turquoise', 'system']",
        replace: "['light', 'dark', 'direct', 'turquoise']",
      },
    ],
  },
];
