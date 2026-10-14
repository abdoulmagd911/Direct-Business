// Sabotages for Quick capture and Wrap up v2 (productivity stage 1, builder B): each breaks one promise of its specs.
const E2E = 'e2e:tests/e2e/capture-wrap.spec.ts';
const UNIT = 'unit:tests/unit/my-day/quick-capture-and-wrap-up-v2-rules.test.ts';
const TITLE = 'Quick capture from another page files a note, an idea, a checklist and a reminder';
const WRAP = 'Wrap up moves the day in one request';

export const sabotages = [
  {
    name: 'capture-a-reminder-without-a-time',
    breaks: [UNIT],
    expect: 'refuses a reminder with no time',
    edits: [
      {
        file: 'src/modules/my-day/quick-capture.ts',
        find: 'if (!opts.remindAt) return null;',
        replace: 'if (!opts.remindAt && false) return null;',
      },
    ],
  },
  {
    name: 'capture-checklist-drops-the-items',
    breaks: [UNIT],
    expect: 'makes every line after the title a checklist item',
    edits: [{ file: 'src/modules/my-day/quick-capture.ts', find: 'rest.length ? rest : [title]', replace: '[title]' }],
  },
  {
    name: 'wrap-up-lets-done-lose-to-a-move',
    breaks: [UNIT],
    expect: 'chooses Tomorrow unless told otherwise, and Done wins',
    edits: [
      { file: 'src/modules/my-day/logic.ts', find: "choice: s.done ? 'done' : s.move", replace: 'choice: s.move' },
    ],
  },
  {
    name: 'wrap-up-walks-later-tasks',
    breaks: [UNIT],
    expect: "walks my overdue and today's tasks",
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "(t.group === 'overdue' || t.group === 'today')",
        replace: "(t.group !== 'helping')",
      },
    ],
  },
  {
    name: 'capture-starts-shared-from-the-sheet',
    breaks: [E2E],
    expect: TITLE,
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "setVisibility('private');\n      setWhen",
        replace: "setVisibility('workspace');\n      setWhen",
      },
    ],
  },
  {
    name: 'capture-takes-the-person-away',
    breaks: [E2E],
    expect: TITLE,
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "if (args.kind === 'reminder') askToNotify();",
        replace: "if (args.kind === 'reminder') askToNotify();\n          window.location.assign('/my-day');",
      },
    ],
  },
  {
    name: 'capture-is-not-in-the-create-menu',
    breaks: [E2E],
    expect: TITLE,
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: "at: ['view', 'own', 'full'], sheet: true",
        replace: "at: ['full'], sheet: true, except: () => true",
      },
    ],
  },
  {
    name: 'wrap-up-defaults-to-next-week',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "{ done: false, move: 'tomorrow' }",
        replace: "{ done: false, move: 'next_week' }",
      },
    ],
  },
  {
    name: 'wrap-up-sends-one-request-per-item',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: 'p_items: wrapPayload(items, states) as never',
        replace: 'p_items: wrapPayload(items, states).slice(0, 1) as never',
      },
    ],
  },
  {
    name: 'carried-over-line-is-missing',
    breaks: [E2E],
    expect: 'the morning after, the Today block says what was carried over',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '{carried > 0 ? (',
        replace: '{carried > 0 && false ? (',
      },
    ],
  },
  {
    name: 'wrap-up-summary-hides-the-default',
    breaks: [UNIT],
    expect: 'counts what one Save will do',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'out[p.choice as keyof typeof out] += 1;',
        replace: "if (p.choice !== 'tomorrow') out[p.choice as keyof typeof out] += 1;",
      },
    ],
  },
  {
    name: 'wrap-up-refusal-keeps-the-gone-row',
    breaks: [UNIT],
    expect: 'names the rows that left and keeps the rest',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'return { gone: before.filter((i) => !still.has(i.id)), items: after };',
        replace: 'return { gone: [], items: after };',
      },
    ],
  },
  {
    name: 'wrap-up-refusal-forgets-the-other-choices',
    breaks: [E2E],
    expect: 'a Save refused because a task changed hands',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: '        setItems(back.items);',
        replace: '        setItems(back.items);\n        setStates({});',
      },
    ],
  },
  {
    name: 'wrap-up-save-does-not-say-what-it-does',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: "{parts ? t('pages.myDay.wrap.saveWith', { parts }) : t('pages.myDay.wrap.title')}",
        replace: "{t('pages.myDay.wrap.title')}",
      },
    ],
  },
];
