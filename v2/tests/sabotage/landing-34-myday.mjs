// Sabotages for Landing 34, My day: Today's three and its streak (item 1; Landing 34b: the database's pick, read as it
// is), a title cut between words (item 22) and the
// real space between a name and its count (item 15).
const LOGIC = 'unit:tests/unit/my-day/todays-three-picks-three-of-each-from-my-own-tasks.test.ts';
const TITLE = 'unit:tests/unit/my-day/a-title-is-cut-between-words-never-inside-one.test.ts';
const SCREEN = 'unit:tests/unit/my-day/my-day-shows-todays-three-and-the-streak.test.tsx';

export const sabotages = [
  {
    // a group draws every row the answer holds, not three
    name: 'todays-three-takes-more-than-three',
    breaks: [LOGIC],
    expect: 'holds at most three in each group even when the answer holds more, and counts the others in the total',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'picked.has(row.id) || out[g].length >= THREE_EACH) continue;',
        replace: 'picked.has(row.id) || out[g].length >= 99) continue;',
      },
    ],
  },
  {
    // Landing 34b: the screen sorts the database's pick again, so the order is no longer the database's own
    name: 'todays-three-is-sorted-again-on-the-screen',
    breaks: [LOGIC],
    expect: "keeps the database's order as given",
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'out[g].push(row);',
        replace: 'out[g].push(row);\n      out[g].sort(byDueThenNumber);',
      },
    ],
  },
  {
    // an answer without a pick (an older database), or a broken one, is read without care: the page falls over
    name: 'todays-three-a-broken-pick-crashes',
    breaks: [LOGIC],
    expect: 'reads a missing, empty or broken answer (an older database) as three empty groups',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'const rows = Array.isArray(three?.[g]) ? (three?.[g] ?? []) : [];',
        replace: 'const rows = three![g];',
      },
    ],
  },
  {
    // a row the answer repeats is drawn in every group that holds it
    name: 'todays-three-a-repeated-row-is-drawn-twice',
    breaks: [LOGIC],
    expect: 'draws a row repeated across the groups, or inside one, once',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "typeof row.id !== 'string' || picked.has(row.id) || out[g]",
        replace: "typeof row.id !== 'string' || out[g]",
      },
    ],
  },
  {
    // the rest keeps the picked tasks too: they are drawn above and again below
    name: 'todays-three-rest-keeps-a-picked-task',
    breaks: [LOGIC],
    expect: 'leaves in the rest exactly the Today-list tasks that were not picked',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'out.rest = tasks.filter((task) => !picked.has(task.id));',
        replace: 'out.rest = tasks;',
      },
    ],
  },
  {
    // a total smaller than what is drawn is believed
    name: 'todays-three-a-total-is-below-what-is-drawn',
    breaks: [LOGIC],
    expect: 'never says a total below what is drawn',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'Math.max(Math.floor(total), out[g].length)',
        replace: 'Math.floor(total)',
      },
    ],
  },
  {
    // "more" counts the whole group, the three drawn included
    name: 'todays-three-more-counts-the-drawn-ones',
    breaks: [LOGIC],
    expect: 'says how many of a group are not drawn',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'Math.max(three.totals[g] - three[g].length, 0);',
        replace: 'three.totals[g];',
      },
    ],
  },
  {
    // an answer that is not a streak is drawn as one
    name: 'a-streak-is-read-from-anything',
    breaks: [LOGIC],
    expect: 'answers no streak for anything that is not one, so the line is not drawn',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "if (typeof r.days !== 'number' || !Number.isFinite(r.days) || r.days < 0) return null;",
        replace: "if (typeof r.days !== 'number' && r.days !== undefined) return null;",
      },
    ],
  },
  {
    // the cut goes back to the cap itself, in the middle of a word
    name: 'a-title-is-cut-inside-a-word',
    breaks: [TITLE],
    expect: 'ends at the last whole word that fits, and keeps the words after it',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'const at = lead && lead[0].trim() ? lead[0].length - 1 : max;',
        replace: 'const at = max;',
      },
    ],
  },
  {
    // the note page's heading is cut to one line again
    name: 'the-note-page-title-is-one-line-again',
    breaks: [TITLE],
    expect: 'wraps on the note page instead of being cut to one line',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: '<bdi className="min-w-0 break-words" data-note-title>',
        replace: '<bdi className="min-w-0 truncate" data-note-title>',
      },
    ],
  },
  {
    // the bug itself: My day has no Today's three
    name: 'my-day-has-no-todays-three',
    breaks: [SCREEN],
    expect: 'still draws the section for someone with no tasks at all, each group saying so in a line',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "{scope === 'me' ? <TodaysThree three={three} statuses={data.statuses} /> : null}",
        replace: '',
      },
    ],
  },
  {
    // the picked tasks are drawn twice: above, and again in the Today block
    name: 'todays-three-rows-are-drawn-twice',
    breaks: [SCREEN],
    expect: 'never draws a picked task again in the Today block',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: 'tasks={belowThree}',
        replace: 'tasks={answer.tasks ?? []}',
      },
    ],
  },
  {
    // Landing 34b: My day forgets the database's pick — the section is empty whatever the database answered
    name: 'my-day-ignores-the-databases-pick',
    breaks: [SCREEN],
    expect: "draws the three from the answer's own pick, in the order the database gave",
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: 'todaysThree(answer.three, answer.tasks ?? [])',
        replace: 'todaysThree(undefined, answer.tasks ?? [])',
      },
    ],
  },
  {
    // the "N more in Tasks" line is drawn under every group, with nothing more to show
    name: 'the-more-line-shows-when-nothing-more-is-there',
    breaks: [SCREEN],
    expect: 'says nothing more when every group is drawn whole, and nothing at all for someone with no tasks',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodaysThree.tsx',
        find: '{threeMore(three, g) > 0 ? (',
        replace: '{threeMore(three, g) >= 0 ? (',
      },
    ],
  },
  {
    // the more line is never drawn: a group's other tasks are not spoken of
    name: 'the-more-line-is-never-drawn',
    breaks: [SCREEN],
    expect: 'says "N more in Tasks", linked to Tasks, only under a group that holds more than the three drawn',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodaysThree.tsx',
        find: '<p className="py-2 text-sm" data-three-more={threeMore(three, g)}>',
        replace: '<p className="py-2 text-sm" hidden>',
      },
    ],
  },
  {
    // an answer without a pick takes the whole page down
    name: 'my-day-falls-over-without-a-pick',
    breaks: [SCREEN],
    expect: 'with no pick in the answer (an older database) draws three empty groups, no crash',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'const rows = Array.isArray(three?.[g]) ? (three?.[g] ?? []) : [];',
        replace: 'const rows = three![g];',
      },
    ],
  },
  {
    // 0 days reads as a streak of nothing instead of "No streak yet"
    name: 'zero-days-reads-as-a-streak',
    breaks: [SCREEN],
    expect: 'says there is no streak yet at 0 days',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodaysThree.tsx',
        find: "{streak.days > 0 ? t('streak.days', { days: streak.days }) : t('streak.none')}",
        replace: "{t('streak.days', { days: streak.days })}",
      },
    ],
  },
  {
    // the team's streaks are never asked for
    name: 'the-team-tab-has-no-streaks',
    breaks: [SCREEN],
    expect: 'lists each person I manage with their working days, the longest first',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "{scope === 'team' ? <TeamStreaks /> : null}",
        replace: '',
      },
    ],
  },
  {
    // a group's name and its count are glued again: "Quick or pass to someone1"
    name: 'a-group-name-and-its-count-are-glued',
    breaks: [SCREEN],
    expect: "in Today's three and in the Today block's groups, read as text",
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "{t(`pages.myDay.today.${x.key}`)}{' '}",
        replace: '{t(`pages.myDay.today.${x.key}`)}',
      },
    ],
  },
];
