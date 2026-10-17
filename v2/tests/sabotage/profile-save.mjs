// Sabotages for V641 (owner's live test, 17 Oct; builder B): My profile's Save button and the one-line density help.
const E2E = 'e2e:tests/e2e/profile-save.spec.ts';
const FILE = 'src/modules/org/screens/MyProfile.tsx';
export const sabotages = [
  {
    name: 'a-half-typed-name-saves-itself',
    breaks: [E2E],
    expect: 'a half-typed name is not saved by itself',
    edits: [
      {
        file: FILE,
        find: '            onChange={(e) => setDraft(e.target.value)}\n',
        replace: '            onChange={(e) => setDraft(e.target.value)}\n            onBlur={commit}\n',
      },
    ],
  },
  {
    name: 'the-name-save-button-is-always-on',
    breaks: [E2E],
    expect: 'Save is off until the text changes',
    edits: [{ file: FILE, find: 'disabled={!changed}', replace: 'disabled={false}' }],
  },
  {
    name: 'the-density-box-says-nothing',
    breaks: [E2E],
    expect: 'the density line',
    edits: [{ file: FILE, find: "{t('profile.densityHint')}", replace: "{''}" }],
  },
  {
    name: 'a-theme-pick-does-not-save',
    breaks: [E2E],
    expect: 'one pick of the theme saves at once',
    edits: [
      {
        file: FILE,
        find: "onValueChange={(v) => void save({ theme: v as Profile['theme'] })}",
        replace: 'onValueChange={(v) => void v}',
      },
    ],
  },
];
