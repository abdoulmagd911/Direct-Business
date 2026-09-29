// Builder B's sabotages (screens): each check of §2.5/V11/V59/V60 must go red on a planted violation, each of their
// unit tests must go red when its check is made blind, the tokens test must go red on a drifted value, and the
// E2E promises must go red when the behaviour they guard is broken. Run: node scripts/sabotage.mjs --kind check …
const unit = (file) => `unit:tests/unit/checks/${file}.test.ts`;

export const sabotages = [
  // ---- planted violations, one per screen check
  {
    name: 'plant-banner',
    breaks: ['check:ui-no-hints'],
    expect: 'src/ui/DataState.tsx',
    edits: [
      {
        file: 'src/ui/DataState.tsx',
        find: 'export type DataStateKind =',
        replace:
          'export function Banner() {\n  return <div className="banner">Note: read this first</div>;\n}\nexport type DataStateKind =',
      },
    ],
  },
  {
    name: 'plant-white-on-accent',
    breaks: ['check:accent-fill-only'],
    expect: 'src/ui/Button.tsx',
    edits: [
      {
        file: 'src/ui/Button.tsx',
        find: 'bg-primary text-on-primary hover:bg-primary-hover',
        replace: 'bg-accent text-on-accent hover:bg-accent-hover',
      },
    ],
  },
  {
    name: 'plant-stray-ar-key',
    breaks: ['check:i18n-catalogs'],
    expect: 'missing "nav.collapse_stray"',
    edits: [
      {
        file: 'messages/ar.json',
        find: '    "collapse": "طي القائمة",\n',
        replace: '    "collapse": "طي القائمة",\n    "collapse_stray": "طي",\n',
      },
    ],
  },
  {
    name: 'plant-hard-coded-sentence',
    breaks: ['check:i18n-catalogs'],
    expect: 'hard-coded text "Click here to start"',
    edits: [
      {
        file: 'src/ui/shell/TopBar.tsx',
        find: '<CreateMenu />',
        replace: '<CreateMenu />\n      <span>Click here to start</span>',
      },
    ],
  },
  {
    name: 'plant-screen-word',
    breaks: ['check:screen-words'],
    expect: '"Companies" on screen',
    edits: [{ file: 'messages/en.json', find: '"clients": "Clients"', replace: '"clients": "Companies"' }],
  },
  // ---- blind checks: the unit test of each check must catch a check that stopped looking
  {
    name: 'blind-ui-no-hints',
    breaks: [unit('the-no-hints-check-refuses-banners-callouts-and-hint-text')],
    expect: 'refuses a hint or banner component',
    edits: [{ file: 'scripts/checks/ui-no-hints.mjs', find: '[COMPONENT, ', replace: '[/$^/g, ' }],
  },
  {
    name: 'blind-accent-fill-only',
    breaks: [unit('the-accent-check-refuses-text-in-the-accent-and-labels-on-it')],
    expect: 'refuses text-accent',
    edits: [
      { file: 'scripts/checks/accent-fill-only.mjs', find: 'if (TEXT_ACCENT.test(line))', replace: 'if (false)' },
    ],
  },
  {
    name: 'blind-i18n-catalogs',
    breaks: [unit('the-catalog-check-refuses-a-missing-key-and-a-hard-coded-sentence')],
    expect: 'refuses a key in ar.json only',
    edits: [
      { file: 'scripts/checks/i18n-catalogs.mjs', find: "if (lit.kind !== 'jsx') continue;", replace: 'continue;' },
    ],
  },
  {
    name: 'blind-screen-words',
    breaks: [unit('the-screen-words-check-refuses-company-and-margin')],
    expect: 'refuses them in a catalog and in JSX text',
    edits: [
      {
        file: 'scripts/checks/screen-words.mjs',
        find: "if (lit.kind !== 'jsx') continue;",
        replace: 'continue;',
      },
    ],
  },
  // ---- tokens: the design system table is the truth
  {
    name: 'tokens-drift',
    breaks: ['unit:tests/unit/tokens.test.ts'],
    expect: 'direct --primary',
    edits: [{ file: 'src/ui/tokens.css', find: '--primary: #c94c14;', replace: '--primary: #f06820;' }],
  },
  {
    name: 'prefs-accept-anything',
    breaks: ['unit:tests/unit/prefs.test.ts'],
    expect: 'setPref refuses a value outside the allow-list',
    edits: [
      {
        file: 'src/core/prefs/index.ts',
        find: 'if (!(def.values as readonly string[]).includes(value)) throw new Error(`prefs: ${key} cannot be ${String(value)}`);',
        replace: '',
      },
    ],
  },
  // ---- end to end
  {
    name: 'confirm-focuses-remove',
    breaks: ['e2e:tests/e2e/dialogs.spec.ts'],
    expect: 'Confirm names the item, has Cancel focused',
    edits: [
      {
        file: 'src/ui/Confirm.tsx',
        find: 'cancelRef.current?.focus();',
        replace: "(document.querySelector('[data-confirm-action]') as HTMLElement | null)?.focus();",
      },
    ],
  },
  {
    name: 'panel-ignores-escape',
    breaks: ['e2e:tests/e2e/dialogs.spec.ts'],
    expect: 'Escape closes the detail panel',
    edits: [
      {
        file: 'src/ui/DetailPanel.tsx',
        find: "if (e.key === 'Escape' && panel.current?.contains(document.activeElement)) {",
        replace: 'if (false) {',
      },
    ],
  },
  {
    name: 'label-on-orange',
    breaks: ['e2e:tests/e2e/kit.spec.ts'],
    expect: 'Direct never puts text on the accent fill',
    edits: [
      {
        file: 'src/app/(app)/kit/KitGallery.tsx',
        find: '<Section title="Buttons">',
        replace: '<Section title="Buttons">\n          <span className="bg-accent px-2">Label on orange</span>',
      },
    ],
  },
  {
    name: 'nav-shows-every-page',
    breaks: ['e2e:tests/e2e/shell.spec.ts'],
    expect: 'a team member sees no Settings and no page at level none',
    edits: [
      {
        file: 'src/ui/person.ts',
        find: "return (me.levels[pageKey] ?? 'none') !== 'none';",
        replace: 'return me.levels[pageKey] !== undefined || true;',
      },
    ],
  },
  {
    // Without the page's admin gate a member's request reaches api.settings, the database refuses it (V125) and the
    // page never draws — the spec waits for it and times out, which is the red the sabotage expects.
    name: 'settings-open-to-everyone',
    breaks: ['e2e:tests/e2e/org.spec.ts'],
    expect: 'page.waitForFunction: Test timeout',
    edits: [
      {
        file: 'src/app/(app)/settings/[group]/page.tsx',
        find: '  if (!isAdmin(me))\n',
        replace: '  if (!isAdmin(me) && me.person.role === undefined)\n',
      },
    ],
  },
  {
    name: 'team-arabic-optional',
    breaks: ['e2e:tests/e2e/org.spec.ts'],
    expect: 'the Arabic name is required (V97)',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: 'disabled={!f.name_en.trim() || !f.name_ar.trim() || !f.code.trim() || !f.department_id}',
        replace: 'disabled={!f.name_en.trim() || !f.code.trim() || !f.department_id}',
      },
    ],
  },
  {
    name: 'list-arabic-optional',
    breaks: ['e2e:tests/e2e/settings.spec.ts'],
    expect: 'the Arabic name is required (V76)',
    edits: [
      {
        file: 'src/modules/settings/screens/ListEditor.tsx',
        find: 'draft.name_en.trim().length > 0 && draft.name_ar.trim().length > 0;',
        replace: 'draft.name_en.trim().length > 0;',
      },
    ],
  },
  {
    name: 'setting-saves-without-reason',
    breaks: ['e2e:tests/e2e/settings.spec.ts'],
    expect: 'a reason is required',
    edits: [
      {
        file: 'src/modules/settings/screens/SettingCard.tsx',
        find: 'reason.trim().length > 0 &&',
        replace: 'true &&',
      },
    ],
  },
  {
    name: 'profile-saves-nothing',
    breaks: ['e2e:tests/e2e/profile.spec.ts'],
    expect: 'Profile saved',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: 'p_changes: changes as never,',
        replace: 'p_changes: {} as never,',
      },
    ],
  },
  {
    name: 'sign-in-grows-a-google-door',
    breaks: ['e2e:tests/e2e/password.spec.ts'],
    expect: 'the only door is email and password',
    edits: [
      {
        file: 'src/modules/org/screens/SignIn.tsx',
        find: '<p className="text-center text-sm text-muted">{t(\'sign_in.password.forgot\')}</p>',
        replace:
          '<Button type="button" variant="secondary">Continue with Google</Button>\n                <p className="text-center text-sm text-muted">{t(\'sign_in.password.forgot\')}</p>',
      },
    ],
  },
];
