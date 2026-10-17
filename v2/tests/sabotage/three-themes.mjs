// Sabotages for the three themes and the profile colour that is gone (V636, owner 14 Oct; builder B).
const UNIT = 'unit:tests/unit/prefs.test.ts';
const E2E = 'e2e:tests/e2e/three-themes.spec.ts';
const AVATAR = 'unit:tests/unit/ui/the-avatar-has-no-colour-ring.test.tsx';

export const sabotages = [
  {
    name: 'colorful-is-offered-again',
    breaks: [UNIT, E2E],
    expect: 'Light, Dark and Direct',
    edits: [
      {
        file: 'src/core/prefs/index.ts',
        find: "export const THEMES = ['light', 'dark', 'direct'] as const;",
        replace: "export const THEMES = ['light', 'dark', 'colorful', 'direct'] as const;",
      },
    ],
  },
  {
    name: 'colorful-reads-as-itself',
    breaks: [UNIT],
    expect: 'a theme saved while Colorful was offered reads as Light',
    edits: [
      {
        file: 'src/core/prefs/index.ts',
        find: "stored === 'colorful' ? 'light' : (THEMES.find((t) => t === stored) ?? null);",
        replace: 'THEMES.find((t) => t === stored) ?? null;',
      },
    ],
  },
  {
    name: 'the-default-theme-is-direct-again',
    breaks: [UNIT],
    expect: 'defaults: Light theme',
    edits: [
      {
        file: 'src/core/prefs/index.ts',
        find: "theme: { cookie: 'v2.theme', values: THEMES, default: 'light' },",
        replace: "theme: { cookie: 'v2.theme', values: THEMES, default: 'direct' },",
      },
    ],
  },
  {
    name: 'my-profile-has-no-theme-box',
    breaks: [E2E],
    expect: 'My profile offers Light, Dark and Direct',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: "<Field label={t('profile.theme')}>",
        replace: "<Field label={t('profile.themeX')}>",
      },
    ],
  },
  {
    name: 'the-avatar-draws-a-colour-ring-again',
    breaks: [AVATAR],
    expect: 'the initials have no colour ring',
    edits: [
      {
        file: 'src/ui/Avatar.tsx',
        find: "const tint = 'bg-accent-soft';",
        replace: "const tint = 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--c3)]';",
      },
    ],
  },
];
