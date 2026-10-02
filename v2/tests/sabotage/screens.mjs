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
    // the navigation's label: the same words also name a start page under Settings → App
    edits: [
      {
        file: 'messages/en.json',
        find: '"settings_home": "Settings",\n    "clients": "Clients"',
        replace: '"settings_home": "Settings",\n    "clients": "Companies"',
      },
    ],
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
    // with the crash page inside the shell (V216) the refused read no longer hangs the page: the no-access line is missing
    expect: 'Settings says no access in words',
    edits: [
      {
        file: 'src/app/(app)/settings/[group]/page.tsx',
        find: '  if (!isAdmin(me))\n',
        replace: '  if (!isAdmin(me) && me.person.role === undefined)\n',
      },
    ],
  },
  // ---- P3-7 (V401, FLOW-08): each promise of tests/e2e/p3-7.spec.ts seen red
  {
    name: 'conflict-silently-overwrites',
    breaks: ['e2e:tests/e2e/p3-7.spec.ts'],
    expect: "locator('[data-conflict-dialog]')",
    edits: [
      {
        file: 'src/core/commands/command.ts',
        find: '.filter((f) => !same(theirs.values[f.key], f.read) && !same(theirs.values[f.key], f.mine))',
        replace: '.filter(() => false)',
      },
    ],
  },
  {
    name: 'bell-never-marks-read',
    breaks: ['e2e:tests/e2e/p3-7.spec.ts'],
    expect: 'data-notification][data-unread',
    edits: [
      {
        file: 'src/ui/shell/NotificationsPanel.tsx',
        find: 'onClick={() => void act(() => markRead(unreadShown))}',
        replace: 'onClick={() => undefined}',
      },
    ],
  },
  {
    name: 'follow-does-nothing',
    breaks: ['e2e:tests/e2e/p3-7.spec.ts'],
    expect: 'data-follow][data-following',
    edits: [{ file: 'src/ui/FollowButton.tsx', find: 'p_on: !on }', replace: 'p_on: false }' }],
  },
  {
    name: 'restore-never-restores',
    breaks: ['e2e:tests/e2e/p3-7.spec.ts'],
    expect: 'data-deleted-row',
    edits: [
      {
        file: 'src/modules/settings/screens/RecentlyDeleted.tsx',
        find: '() => restoreRecord(d.entity, d.id),',
        replace: '() => Promise.resolve({ request_id: null }),',
      },
    ],
  },
  {
    name: 'bulk-one-request-per-row',
    breaks: ['e2e:tests/e2e/p3-7.spec.ts'],
    expect: "locator('[data-bulk-calls]')",
    edits: [
      {
        file: 'src/ui/BulkBar.tsx',
        find: '() => a.run(ids)',
        replace: 'async () => { let r; for (const id of ids) r = await a.run([id]); return r; }',
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
        find: '    draft.name_ar.trim().length > 0 &&\n',
        replace: '',
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
        file: 'src/modules/org/screens/PasswordDoor.tsx',
        find: '<p className="door-muted text-[13px]">{t(\'sign_in.password.forgot\')}</p>',
        replace:
          '<button type="button" className="door-button">Continue with Google</button>\n        <p className="door-muted text-[13px]">{t(\'sign_in.password.forgot\')}</p>',
      },
    ],
  },
  // ---- the door (the visual spec of 29 Sep, V213)
  {
    name: 'door-offline-reads-as-wrong-password',
    breaks: ['e2e:tests/e2e/door.spec.ts'],
    expect: 'offline is said as offline',
    edits: [
      {
        file: 'src/modules/org/screens/PasswordDoor.tsx',
        find: "        setError('unavailable');\n",
        replace: "        setError('wrong_password');\n",
      },
    ],
  },
  {
    name: 'door-eye-shows-nothing',
    breaks: ['e2e:tests/e2e/door.spec.ts'],
    expect: 'the eye shows the password',
    edits: [
      {
        file: 'src/modules/org/screens/PasswordDoor.tsx',
        find: 'onClick={() => setShown((s) => !s)}',
        replace: 'onClick={() => setShown(false)}',
      },
    ],
  },
  {
    name: 'door-panel-grows-a-tagline',
    breaks: ['e2e:tests/e2e/door.spec.ts'],
    expect: 'no tagline, no copyright in the panel',
    edits: [
      {
        file: 'src/modules/org/screens/DoorFrame.tsx',
        find: '<span aria-hidden="true" className="door-rule block h-[3px] w-6 rounded-full" />',
        replace:
          '<span aria-hidden="true" className="door-rule block h-[3px] w-6 rounded-full" />\n          <p>{t(\'app.brand_line\')}</p>',
      },
    ],
  },
  // ---- the QA fixes on #92 (My profile reachable, failed reads named, only changed fields sent, Undo resyncs)
  {
    name: 'profile-chip-leads-nowhere',
    breaks: ['e2e:tests/e2e/profile.spec.ts'],
    expect: 'the chip opens My profile',
    edits: [
      {
        file: 'src/ui/shell/ProfileMenu.tsx',
        find: '<Link href="/profile">',
        replace: '<Link href="/settings/profile">',
      },
    ],
  },
  {
    name: 'profile-keeps-the-undone-value',
    breaks: ['e2e:tests/e2e/profile.spec.ts'],
    expect: 'the undone value is gone from the screen',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: '  if (me !== seenMe) {\n    setSeenMe(me);\n    setState(stateOf(me));\n  }\n',
        replace: '  void seenMe;\n  void setSeenMe;\n',
      },
    ],
  },
  {
    name: 'profile-keeps-the-undone-density',
    breaks: ['e2e:tests/e2e/profile.spec.ts'],
    expect: 'the undone density is gone from the page',
    edits: [
      {
        file: 'src/modules/org/screens/MyProfile.tsx',
        find: "    setPref('density', me.profile?.density ?? PREF_DEFS.density.default);\n",
        replace: '',
      },
    ],
  },
  {
    name: 'person-edit-sends-every-field',
    breaks: ['e2e:tests/e2e/org.spec.ts'],
    expect: 'only the changed fields are sent',
    edits: [
      {
        file: 'src/modules/org/screens/PersonRecord.tsx',
        find: '      if (next === stored[k]) continue;\n',
        replace: '',
      },
    ],
  },
  {
    name: 'person-edit-starts-from-a-stale-copy',
    breaks: ['e2e:tests/e2e/org.spec.ts'],
    expect: 'the form shows the stored value',
    edits: [
      {
        file: 'src/modules/org/screens/PersonRecord.tsx',
        find: '    setF(stored);\n    setFormVersion(row?.version ?? null);\n',
        replace: '',
      },
    ],
  },
  {
    name: 'failed-read-drawn-as-no-access',
    breaks: ['unit:tests/unit/org/a-failed-read-is-named-never-drawn-empty.test.ts'],
    expect: 'names a read that failed',
    edits: [
      {
        file: 'src/modules/org/read-or-fail.ts',
        find: "    if (kind !== 'PermissionDenied') failed.push(name);\n",
        replace: '',
      },
    ],
  },
  // ---- the catalogue gaps (ACC-090/091/127/129/139, PRF-002/123)
  {
    name: 'none-gets-an-empty-page',
    breaks: ['e2e:tests/e2e/access.spec.ts'],
    expect: 'says no access',
    edits: [
      {
        file: 'src/ui/shell/Page.tsx',
        find: "  if (page && (me.levels[page] ?? 'none') === 'none') {",
        replace: "  if (page && (me.levels[page] ?? 'none') === 'none' && !page) {",
      },
    ],
  },
  {
    name: 'root-ignores-the-start-page',
    breaks: ['e2e:tests/e2e/access.spec.ts'],
    expect: 'the start page is Tasks',
    edits: [
      {
        file: 'src/app/(app)/[[...path]]/page.tsx',
        find: '  for (const key of [me.profile?.start_page, app.default_start_page]) {',
        replace: '  for (const key of [app.default_start_page]) {',
      },
    ],
  },
  {
    name: 'admins-start-page-ignored',
    breaks: ['e2e:tests/e2e/app-settings.alone.spec.ts'],
    expect: "the admin's default start page applies to a person without their own",
    edits: [
      {
        file: 'src/app/(app)/[[...path]]/page.tsx',
        find: '  for (const key of [me.profile?.start_page, app.default_start_page]) {',
        replace: '  for (const key of [me.profile?.start_page]) {',
      },
    ],
  },
  {
    name: 'arabic-never-switched-on',
    breaks: ['e2e:tests/e2e/app-settings.alone.spec.ts'],
    expect: 'once Arabic is on, the switch shows and the cookie is honoured',
    edits: [
      {
        file: 'src/core/prefs/effective.ts',
        find: "  return app.arabic_enabled ? cookieLocale : 'en';",
        replace: "  return 'en';",
      },
    ],
  },
  {
    name: 'arabic-cookie-wins-while-off',
    breaks: ['e2e:tests/e2e/access.spec.ts'],
    expect: 'the door stays English',
    edits: [
      {
        file: 'src/core/prefs/effective.ts',
        find: "  return app.arabic_enabled ? cookieLocale : 'en';",
        replace: '  return cookieLocale;',
      },
    ],
  },
  {
    name: 'profile-link-lost-in-the-drawer',
    breaks: ['e2e:tests/e2e/access.spec.ts'],
    expect: 'the drawer foot opens My profile',
    edits: [
      {
        file: 'src/ui/shell/Drawer.tsx',
        find: '          href="/profile"\n          data-entity="person"',
        replace: '          href="/settings/profile"\n          data-entity="person"',
      },
    ],
  },
  {
    name: 'failed-read-drawn-as-empty',
    breaks: ['e2e:tests/e2e/person-reads.spec.ts'],
    expect: 'the failed read is named',
    edits: [
      {
        file: 'src/modules/org/screens/PersonRecord.tsx',
        find: "          {failedRead('signIns', t('settings.people.signInLog'))}\n",
        replace: '',
      },
    ],
  },
  {
    name: 'profile-link-lost-in-the-bottom-bar',
    breaks: ['e2e:tests/e2e/access.spec.ts'],
    expect: 'the bottom bar opens My profile',
    edits: [
      {
        file: 'src/ui/shell/BottomBar.tsx',
        find: '              href="/profile"\n              data-entity="person"',
        replace: '              href="/settings/profile"\n              data-entity="person"',
      },
    ],
  },
  {
    name: 'at-risk-needs-no-reason',
    breaks: ['e2e:tests/e2e/partners.spec.ts'],
    expect: 'At risk asks for a reason',
    edits: [
      {
        file: 'src/modules/partners/screens/record/SideDialogs.tsx',
        find: "  const needsReason = f.status === 'at_risk' || f.status === 'lost';\n",
        replace: '  const needsReason = false;\n',
      },
    ],
  },
  {
    name: 'bulk-assign-one-by-one',
    breaks: ['e2e:tests/e2e/partners.spec.ts'],
    expect: 'every selected organisation is owned by the new owner',
    edits: [
      {
        file: 'src/modules/partners/screens/PartnersList.tsx',
        find: '          p_ids: ids,\n',
        replace: '          p_ids: ids.slice(0, 1),\n',
      },
    ],
  },
  {
    name: 'hover-card-shows-one-side',
    breaks: ['e2e:tests/e2e/partners.spec.ts'],
    expect: 'the hover card names both sides',
    edits: [
      {
        file: 'src/modules/partners/screens/PartnerHover.tsx',
        find: '              {p.sides.map((s) => (\n',
        replace: '              {p.sides.slice(0, 1).map((s) => (\n',
      },
    ],
  },
  {
    name: 'no-role-reads-as-allowed',
    breaks: ['e2e:tests/e2e/review-1.spec.ts'],
    expect: 'no role in words',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: '  if (!row.role) return <StatusChip tone="warning">{t(\'settings.people.noRole\')}</StatusChip>;\n  return <StatusChip tone="success">{t(\'settings.people.signInOn\')}</StatusChip>;',
        replace: '  return <StatusChip tone="success">{t(\'settings.people.signInOn\')}</StatusChip>;',
      },
    ],
  },
  {
    name: 'not-found-shows-the-raw-path',
    breaks: ['e2e:tests/e2e/review-1.spec.ts'],
    expect: 'never the raw path as a title',
    edits: [
      {
        // W32: the Not found page is (app)/not-found.tsx, answered with status 404
        file: 'src/app/(app)/not-found.tsx',
        find: "      <PageHeader title={t('errors.notFound.title')} />",
        replace: '      <PageHeader title={address} />',
      },
    ],
  },
  {
    name: 'activity-shows-column-names',
    breaks: ['e2e:tests/e2e/review-1.spec.ts'],
    expect: 'the field in words',
    edits: [
      {
        file: 'src/ui/record/ActivityTimeline.tsx',
        find: '    if (t.has(`activity.fields.${f}`)) return t(`activity.fields.${f}`);\n',
        replace: '    if (f) return f;\n',
      },
    ],
  },
  {
    name: 'setting-value-shows-the-key',
    breaks: ['e2e:tests/e2e/review-1.spec.ts'],
    expect: 'a word, not a key',
    edits: [
      {
        file: 'src/modules/settings/screens/SchemaEditor.tsx',
        find: '    for (const k of [`settings.values.${settingKey}.${v}`, `theme.${v}`, `density.${v}`, `profile.notify.${v}`])\n      if (t.has(k)) return t(k);\n',
        replace: '',
      },
    ],
  },
  {
    name: 'account-read-from-kind',
    breaks: ['e2e:tests/e2e/qa-127.spec.ts'],
    expect: 'named from core.person.account',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: "  if (row.account === 'test_account')",
        replace: "  if (row.account === 'not_an_account')",
      },
    ],
  },
  {
    // the brief's own sabotage (F7): a manage page given the work tier reaches a member's menu
    name: 'menu-shows-own-manage-page',
    breaks: ['e2e:tests/e2e/employee-view.spec.ts'],
    expect: 'the member menu',
    edits: [
      {
        file: 'src/modules/projects/module.ts',
        find: "nav: { group: 'main', order: 60, tier: 'manage' },",
        replace: "nav: { group: 'main', order: 60, tier: 'work' },",
      },
    ],
  },
  {
    name: 'create-offers-an-unbuilt-screen',
    breaks: ['e2e:tests/e2e/employee-view.spec.ts'],
    expect: 'Create offers only built screens',
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: '  return CREATE_ACTIONS.filter((a) => BUILT.has(a.page) && ',
        replace: '  return CREATE_ACTIONS.filter((a) => BUILT.size > 0 && ',
      },
    ],
  },
  {
    name: 'access-list-closed-for-admins',
    breaks: ['e2e:tests/e2e/employee-view.spec.ts'],
    expect: 'open with Show less',
    edits: [
      {
        file: 'src/modules/org/screens/PersonRecord.tsx',
        find: '  const [allAccess, setAllAccess] = useState(me.person.role?.is_admin === true);',
        replace: '  const [allAccess, setAllAccess] = useState(false);',
      },
    ],
  },
  {
    name: 'list-hides-its-side',
    breaks: ['e2e:tests/e2e/qa-127.spec.ts'],
    expect: 'Side type shows each side',
    edits: [
      {
        file: 'src/modules/settings/screens/ListEditor.tsx',
        find: '  const extra = EXTRA[entity];\n',
        replace: '  const extra = undefined as (typeof EXTRA)[string] | undefined;\n',
      },
    ],
  },
  {
    name: 'page-squeezes-its-tabs',
    breaks: ['e2e:tests/e2e/qa-127.spec.ts'],
    expect: 'the strip keeps its height',
    edits: [
      {
        file: 'src/ui/shell/AppShell.tsx',
        find: ' [&>*]:shrink-0 ${className}',
        replace: ' ${className}',
      },
    ],
  },
  {
    name: 'admin-account-gets-a-day',
    breaks: ['e2e:tests/e2e/qa-127.spec.ts'],
    expect: 'the admin account starts on Settings (V444)',
    edits: [
      {
        file: 'src/app/(app)/[[...path]]/page.tsx',
        find: "  if ((await accountOf(me.person.id)) === 'admin_account') return '/settings';\n",
        replace: '',
      },
    ],
  },
  {
    name: 'turn-into-offers-a-task-too-soon',
    breaks: ['unit:tests/unit/my-day/my-day-turns-a-note-into-what-has-landed-and-wraps-up-the-day.test.tsx'],
    expect: 'a task waits for Tasks',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "  task: 'tasks',\n  action_item: 'tasks',\n",
        replace: "  action_item: 'tasks',\n",
      },
    ],
  },
  {
    name: 'block-draws-every-row',
    breaks: ['unit:tests/unit/my-day/my-day-turns-a-note-into-what-has-landed-and-wraps-up-the-day.test.tsx'],
    expect: 'seven rows',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: '  return { rows: rows.slice(0, BLOCK_ROWS),',
        replace: '  return { rows,',
      },
    ],
  },
  {
    name: 'wrap-up-carries-to-a-friday',
    breaks: ['unit:tests/unit/my-day/my-day-turns-a-note-into-what-has-landed-and-wraps-up-the-day.test.tsx'],
    expect: 'Sunday after a Thursday',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: '  while (d.getUTCDay() === 5 || d.getUTCDay() === 6);',
        replace: '  while (false);',
      },
    ],
  },
  {
    name: 'private-note-reads-as-everyone',
    breaks: ['unit:tests/unit/my-day/my-day-turns-a-note-into-what-has-landed-and-wraps-up-the-day.test.tsx'],
    expect: 'Only me',
    edits: [
      {
        file: 'src/modules/my-day/screens/NoteBits.tsx',
        find: '      {t(`pages.myDay.visibility.${visibility}`)}',
        replace: "      {t('pages.myDay.visibility.workspace')}",
      },
    ],
  },
  {
    name: 'capture-starts-shared',
    breaks: ['e2e:tests/e2e/my-day.spec.ts'],
    expect: 'private by default',
    edits: [
      {
        file: 'src/modules/my-day/screens/CaptureRow.tsx',
        find: "useState<Visibility>('private')",
        replace: "useState<Visibility>('workspace')",
      },
    ],
  },
  {
    name: 'wrap-up-defaults-to-done',
    breaks: ['e2e:tests/e2e/my-day.spec.ts'],
    expect: 'data-wrap-choice',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: "choices[id] ?? 'carry'",
        replace: "choices[id] ?? 'done'",
      },
    ],
  },
  {
    name: 'turned-into-chip-leads-nowhere',
    breaks: ['e2e:tests/e2e/my-day.spec.ts'],
    expect: 'the chip opens the organisation',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "if (link.entity === 'activity' && link.partner_id) return `/partners/${link.partner_id}`;",
        replace: 'if (link.partner_id === "never") return null;',
      },
    ],
  },
  {
    name: 'from-note-chip-hidden',
    breaks: ['e2e:tests/e2e/my-day.spec.ts'],
    expect: 'where the call says where it came from',
    edits: [
      {
        file: 'src/modules/partners/screens/PartnerRecord.tsx',
        find: '{n.from_note ? <FromNoteChip',
        replace: '{n.from_note && n.id === "never" ? <FromNoteChip',
      },
    ],
  },
  {
    name: 'record-tabs-lose-their-words',
    breaks: ['e2e:tests/e2e/partners.spec.ts'],
    expect: 'Overview',
    edits: [
      {
        file: 'messages/en.json',
        find: '    "tabs": {\n      "overview": "Overview",',
        replace: '    "tabsGone": {\n      "overview": "Overview",',
      },
    ],
  },
  {
    name: 'mark-seen-keeps-the-block',
    breaks: ['e2e:tests/e2e/my-day.spec.ts'],
    expect: 'Mark seen clears the block',
    edits: [
      {
        file: 'src/modules/my-day/screens/SinceBlock.tsx',
        find: '            setSince(null);\n',
        replace: '            void 0;\n',
      },
    ],
  },
  {
    name: 'prefsync-copies-the-default-as-a-choice',
    breaks: ['e2e:tests/e2e/prefsync-keeps-a-cache-not-a-choice.spec.ts'],
    expect: 'the profile still wins over what was copied',
    edits: [
      {
        file: 'src/ui/shell/PrefsSync.tsx',
        find: "setPref('theme', theme, { cache: true });",
        replace: "setPref('theme', theme);",
      },
    ],
  },
  {
    name: 'own-last-email-offers-remove',
    breaks: ['e2e:tests/e2e/own-last-email.spec.ts'],
    expect: "no Remove on one's own last email",
    edits: [
      {
        file: 'src/modules/org/screens/PersonRecord.tsx',
        find: '{admin && !(self && row.emails.length <= 1) ? (',
        replace: '{admin ? (',
      },
    ],
  },
  {
    name: 'remove-email-skips-the-ban',
    breaks: ['e2e:tests/e2e/review-1.spec.ts'],
    expect: 'its auth user is banned',
    edits: [
      {
        file: 'src/core/auth/allow-list.ts',
        find: 'for (const authUserId of removed.ban) await setBanned(authUserId, true);',
        replace: '',
      },
    ],
  },
  {
    name: 'clients-none-reads-as-a-list',
    breaks: ['e2e:tests/e2e/clients-none.spec.ts'],
    expect: 'no-access',
    edits: [
      {
        file: 'src/modules/partners/screens/list-page.tsx',
        find: "if ((me.levels[page] ?? 'none') === 'none')",
        replace: 'if (!me)',
      },
    ],
  },
  {
    name: 'suppliers-door-lost-when-clients-none',
    breaks: ['e2e:tests/e2e/clients-none.spec.ts'],
    expect: 'a person with Clients none still has a door to Suppliers',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: '(e.tabOf && canSee(me, e.tabOf))',
        replace: 'e.tabOf',
      },
    ],
  },
  {
    name: 'capped-list-says-nothing',
    breaks: ['unit:tests/unit/partners/a-list-that-reads-its-first-rows-says-so.test.tsx'],
    expect: 'says how many it shows of how many',
    edits: [
      {
        file: 'src/modules/partners/screens/CappedNote.tsx',
        find: 'if (total <= shown) return null;',
        replace: 'if (total >= 0) return null;',
      },
    ],
  },
  {
    name: 'achievement-record-has-no-address',
    breaks: ['unit:tests/unit/shell/an-achievement-opens-on-its-record-page.test.ts'],
    expect: 'an achievement opens on its record page',
    edits: [
      {
        file: 'src/ui/entity-route.ts',
        find: '      return `/kpis/achievements/${id}`;',
        replace: '      return null;',
      },
    ],
  },
  {
    name: 'kpis-page-hides-the-achievements-link',
    breaks: ['e2e:tests/e2e/achievements-doors.spec.ts'],
    expect: 'the KPIs page links to Achievements',
    edits: [
      {
        file: 'src/app/(app)/kpis/page.tsx',
        find: 'data-achievements-link',
        replace: 'data-achievements-gone',
      },
    ],
  },
  {
    name: 'kpis-page-not-built-for-create',
    breaks: ['e2e:tests/e2e/shell.spec.ts'],
    expect: 'Create menu offers only built screens',
    edits: [
      {
        file: 'src/modules/perf/module.ts',
        find: '      built: true,\n',
        replace: '',
      },
    ],
  },
  {
    name: 'kpis-built-offers-an-achievement-turn-into-nobody-can-take',
    breaks: ['unit:tests/unit/my-day/my-day-turns-a-note-into-what-has-landed-and-wraps-up-the-day.test.tsx'],
    expect: 'the KPIs page alone does not offer an achievement',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "  achievement: 'kpis.turn_into',",
        replace: "  achievement: 'kpis',",
      },
    ],
  },
];
