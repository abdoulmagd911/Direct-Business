// Sabotage for V493, no zodiac badge (Architect's order of 14 Oct, builder B).
export const sabotages = [
  {
    name: 'avatar-draws-a-zodiac-glyph',
    breaks: ['unit:tests/unit/ui/no-zodiac-badge-is-drawn.test.tsx'],
    expect: 'draws nothing for a stored zodiac sign',
    edits: [
      {
        file: 'src/ui/Avatar.tsx',
        find: "  const Icon = badge?.kind === 'icon' ? BADGE_ICONS[badge.value!] : undefined;",
        replace:
          "  const Icon = badge?.kind === 'icon' ? BADGE_ICONS[badge.value!] : badge ? () => <span>♌</span> : undefined;",
      },
    ],
  },
];
