// Sabotages for V656 (the bar and the Sign in as test user action):
// tests/unit/shell/the-test-user-bar-names-the-test-user-and-the-owner.test.tsx
const T = 'unit:tests/unit/shell/the-test-user-bar-names-the-test-user-and-the-owner.test.tsx';

export const sabotages = [
  {
    name: 'the-bar-leaves-the-owner-out',
    breaks: [T],
    expect: '> names the TEST user and the owner, in English and in Arabic',
    edits: [
      {
        file: 'src/ui/shell/TestSwitchBar.tsx',
        find: "owner: by ? (ar && by.by_name_ar) || by.by_name_en : '',",
        replace: "owner: '',",
      },
    ],
  },
  {
    name: 'the-switch-is-offered-on-every-row',
    breaks: [T],
    expect: '> is not offered on a real colleague, nor to someone who is not an admin',
    edits: [
      {
        file: 'src/core/test-switch/offer.ts',
        find: 'return !me.test_switch && !!me.person?.role?.is_admin && row.is_test === true;',
        replace: 'return !me.test_switch && !!me.person?.role?.is_admin;',
      },
    ],
  },
  {
    name: 'the-switch-is-offered-to-a-member',
    breaks: [T],
    expect: '> is not offered on a real colleague, nor to someone who is not an admin',
    edits: [
      {
        file: 'src/core/test-switch/offer.ts',
        find: 'return !me.test_switch && !!me.person?.role?.is_admin && row.is_test === true;',
        replace: 'return !me.test_switch && row.is_test === true;',
      },
    ],
  },
  {
    name: 'back-to-my-account-calls-the-wrong-function',
    breaks: [T],
    expect: '> the two presses call the server and start the page over',
    edits: [
      {
        file: 'src/core/test-switch/use-test-switch.ts',
        find: "await rpc('test_switch_end', {} as never);",
        replace: "await rpc('test_switch_start', {} as never);",
      },
    ],
  },
  {
    name: 'a-refused-switch-still-leaves-the-page',
    breaks: [T],
    expect: '> a refusal leaves the page where it is',
    edits: [
      {
        file: 'src/core/test-switch/use-test-switch.ts',
        find: "  await rpc('test_switch_start', { p_person: person } as never);\n  page.go(AFTER_SWITCH_PATH);",
        replace:
          "  try {\n    await rpc('test_switch_start', { p_person: person } as never);\n  } catch {\n    page.go(AFTER_SWITCH_PATH);\n    return;\n  }\n  page.go(AFTER_SWITCH_PATH);",
      },
    ],
  },
  {
    name: 'the-switch-is-offered-while-already-switched',
    breaks: [T],
    expect: '> is not offered while this device is already signed in as a test user (QA-615)',
    edits: [
      {
        file: 'src/core/test-switch/offer.ts',
        find: 'return !me.test_switch && !!me.person?.role?.is_admin && row.is_test === true;',
        replace: 'return !!me.person?.role?.is_admin && row.is_test === true;',
      },
    ],
  },
];
