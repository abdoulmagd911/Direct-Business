// Sabotages for Landing 53 — My day as the boards draw it: the day written in full, Today's three with its sub-lines,
// kind tags, ticked rows and the streak line's count, the rest of today grouped by kind, and the one switch to the
// four boxes. (The database's half — a done task keeps its place, every row names its kind — is THREE-02 and its SQL
// plants.)
const SCREEN = 'unit:tests/unit/my-day/landing-53-my-day-follows-the-boards.test.tsx';

export const sabotages = [
  {
    // the heading goes back to the short weekday and month
    name: 'l53-the-day-is-written-short',
    breaks: [SCREEN],
    expect: 'in English and in Arabic, Latin digits',
    edits: [
      {
        file: 'src/modules/my-day/my-work.ts',
        find: "const month = formatDate(d, 'en', { ...alone, month: 'long' });",
        replace: "const month = formatDate(d, 'en', { ...alone, month: 'short' });",
      },
    ],
  },
  {
    // a row no longer says its kind
    name: 'l53-a-row-has-no-kind-tag',
    breaks: [SCREEN],
    expect: "says each row's kind in a tag",
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '{kindTag && kind ? (',
        replace: '{kindTag && kind && false ? (',
      },
    ],
  },
  {
    // a task finished today is drawn as if it were open
    name: 'l53-a-done-row-is-not-ticked',
    breaks: [SCREEN],
    expect: 'keeps a task finished today in its place, ticked',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "{...(task.done ? { 'data-row-done': '' } : {})}",
        replace: '',
      },
    ],
  },
  {
    // the streak line counts nothing as done
    name: 'l53-the-streak-line-counts-no-done-row',
    breaks: [SCREEN],
    expect: 'counts the ticked rows in the streak line',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'return { done: rows.filter((task) => task.done).length, total: rows.length };',
        replace: 'return { done: 0, total: rows.length };',
      },
    ],
  },
  {
    // My day opens on the four boxes again
    name: 'l53-the-rest-opens-by-priority',
    breaks: [SCREEN],
    expect: 'sits right under the three, headed with its count, and opens by kind',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: 'initialView="kind"',
        replace: 'initialView="priority"',
      },
    ],
  },
  {
    // the kinds come in no fixed order
    name: 'l53-the-kinds-are-not-ordered',
    breaks: [SCREEN],
    expect: 'orders the kinds as the board does',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'if (g.key === OTHER_KIND) return 999;',
        replace: 'if (g.key === OTHER_KIND) return -2;',
      },
    ],
  },
  {
    // a follow-up reminder is listed with the plain reminders
    name: 'l53-a-follow-up-is-a-plain-reminder',
    breaks: [SCREEN],
    expect: 'lists a follow-up reminder with the Follow-ups',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "of(r.about ? FOLLOW_UP_KIND : 'reminders')",
        replace: "of('reminders')",
      },
    ],
  },
  {
    // a kind draws every row at once
    name: 'l53-a-kind-draws-every-row',
    breaks: [SCREEN],
    expect: 'draws seven rows of a kind at most',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'k.rows.slice(0, Math.max(BLOCK_ROWS - reminders.length, 0))',
        replace: 'k.rows',
      },
    ],
  },
  {
    // the Follow-up arrow points the wrong way in Arabic
    name: 'l53-the-follow-up-arrow-is-not-mirrored',
    breaks: [SCREEN],
    expect: 'mirrors the Follow-up arrow in Arabic only',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "MIRRORED.has(k.key) && locale === 'ar' && '-scale-x-100'",
        replace: "MIRRORED.has(k.key) && locale === 'en' && '-scale-x-100'",
      },
    ],
  },
  {
    // the switch does nothing
    name: 'l53-the-switch-does-not-turn',
    breaks: [SCREEN],
    expect: 'by priority draws Do now',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'const choose = (v: RestView) => {\n    setMode(v);',
        replace: 'const choose = (v: RestView) => {',
      },
    ],
  },
  {
    // the choice is not kept
    name: 'l53-the-view-choice-is-forgotten',
    breaks: [SCREEN],
    expect: 'remembers the choice in this browser',
    edits: [
      {
        file: 'src/core/prefs/rest-view.ts',
        find: 'window.localStorage.setItem(KEY, view);',
        replace: 'void view;',
      },
    ],
  },
];
