// Sabotages for Quick capture and Wrap up v2 (productivity stage 1, builder B): each breaks one promise of its specs.
const E2E = 'e2e:tests/e2e/capture-wrap.spec.ts';
const UNIT = 'unit:tests/unit/my-day/quick-capture-and-wrap-up-v2-rules.test.ts';
const TITLE = 'Quick capture from another page files a note, an idea, a checklist and a reminder';
const MY = 'e2e:tests/e2e/my-day.spec.ts';
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
    name: 'wrap-up-sends-the-rows-nobody-chose',
    breaks: [UNIT],
    expect: 'sends only the rows the person chose',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'return choice ? [{ kind: i.kind, id: i.id, choice }] : [];',
        replace: "return [{ kind: i.kind, id: i.id, choice: choice ?? 'tomorrow' }];",
      },
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
    name: 'wrap-up-chooses-tomorrow-by-itself',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: 'const chosen = states[i.id];',
        replace: "const chosen = states[i.id] ?? 'tomorrow';",
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
    name: 'wrap-up-summary-counts-the-rows-left-alone',
    breaks: [UNIT],
    expect: 'counts what one Save will do',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'for (const p of wrapPayload(items, states)) out[p.choice] += 1;',
        replace: "for (const i of items) out[states[i.id] ?? 'tomorrow'] += 1;",
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
        find: "{parts ? t('pages.myDay.wrap.saveWith', { parts }) : t('common.save')}",
        replace: "{t('common.save')}",
      },
    ],
  },
  {
    name: 'wrap-up-tomorrow-shows-no-date',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: "{c === 'tomorrow' ? (",
        replace: "{c === 'tomorrow' && false ? (",
      },
    ],
  },
  {
    name: 'wrap-up-save-can-be-pressed-with-nothing-chosen',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: 'disabled={!parts} onClick',
        replace: 'onClick',
      },
    ],
  },
  {
    name: 'wrap-up-offers-a-fourth-choice',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "['done', 'tomorrow', 'drop'];",
        replace: "['done', 'tomorrow', 'drop', 'tomorrow'];",
      },
    ],
  },
  {
    name: 'wrap-up-names-every-capture-a-note',
    breaks: [UNIT],
    expect: 'names each capture by its real kind',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'word: captureWord(n),',
        replace: "word: 'note',",
      },
    ],
  },
  {
    name: 'wrap-up-repeats-the-kind-on-every-row',
    breaks: [MY],
    expect: 'the group heading says the kind once',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: "{i.title || t('pages.myDay.note.untitled')}\n                        </Link>",
        replace:
          "{i.title || t('pages.myDay.note.untitled')}\n                        </Link>\n                        <span data-wrap-word={i.word}>{i.word}</span>",
      },
    ],
  },
  {
    name: 'wrap-up-heads-every-group-note',
    breaks: [MY],
    expect: 'toHaveText',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: "{t(g.word === 'task' ? 'pages.myDay.wrap.task' : `pages.myDay.quick.kinds.${g.word}`)}",
        replace: "{t('pages.myDay.quick.kinds.note')}",
      },
    ],
  },
  {
    name: 'wrap-up-draws-no-group-headings',
    breaks: ['e2e:tests/e2e/my-day.spec.ts'],
    expect: 'sits in the note group',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: 'data-wrap-group={g.word}',
        replace: 'data-wrap-group="all"',
      },
    ],
  },
  {
    name: 'wrap-up-puts-every-row-in-every-group',
    breaks: [UNIT],
    expect: 'groups the rows by kind',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'items.filter((i) => i.word === word)',
        replace: 'items',
      },
    ],
  },
  {
    name: 'wrap-up-moves-wrap-onto-two-lines',
    breaks: [E2E],
    expect: WRAP,
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: 'grid grid-cols-3 gap-2',
        replace: 'flex flex-wrap gap-2',
      },
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: "'min-w-0 flex-col justify-center gap-0.5 px-2 text-center'",
        replace: "'gap-1.5 px-3'",
      },
    ],
  },
  {
    name: 'wrap-up-draws-a-disabled-save-on-an-empty-day',
    breaks: [E2E],
    expect: 'QA-570',
    edits: [
      { file: 'src/modules/my-day/screens/WrapUpDialog.tsx', find: 'items?.length ? (', replace: 'true ? (' },
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: '<Button variant="primary" loading={busy} disabled={!parts}',
        replace: '<Button variant="primary" loading={busy} disabled={!items?.length}',
      },
    ],
  },
  {
    name: 'wrap-up-greyed-save-says-nothing',
    breaks: [E2E],
    expect: 'a greyed Save says in one line what is missing',
    edits: [
      {
        file: 'src/modules/my-day/screens/WrapUpDialog.tsx',
        find: '{!parts ? (\n              <p',
        replace: '{!parts && false ? (\n              <p',
      },
    ],
  },
];
