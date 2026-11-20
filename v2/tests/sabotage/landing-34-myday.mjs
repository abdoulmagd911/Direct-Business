// Sabotages for Landing 34, My day: Today's three and its streak (item 1), a title cut between words (item 22) and the
// real space between a name and its count (item 15).
const LOGIC = 'unit:tests/unit/my-day/todays-three-picks-three-of-each-from-my-own-tasks.test.ts';
const TITLE = 'unit:tests/unit/my-day/a-title-is-cut-between-words-never-inside-one.test.ts';
const SCREEN = 'unit:tests/unit/my-day/my-day-shows-todays-three-and-the-streak.test.tsx';

export const sabotages = [
  {
    // a group takes every task of its kind: nothing is left for the Today block below
    name: 'todays-three-takes-more-than-three',
    breaks: [LOGIC],
    expect: 'holds at most three in each group and leaves every other own task in the rest, none lost and none twice',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'out[g] = all[g].slice(0, THREE_EACH);',
        replace: 'out[g] = all[g].slice(0, 99);',
      },
    ],
  },
  {
    // Important forgets the starred tasks that are not urgent (Plan it)
    name: 'todays-three-important-is-do-now-only',
    breaks: [LOGIC],
    expect:
      'puts my starred tasks in Important, the urgent unstarred ones in Short and the other own tasks in Maintenance',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'important: [...boxes.do_now, ...boxes.plan_it].sort(byDueThenNumber),',
        replace: 'important: [...boxes.do_now].sort(byDueThenNumber),',
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
    expect:
      'draws Important, Short and Maintenance with at most three of my own tasks each, and keeps the rest in the Today block',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: 'tasks={belowThree}',
        replace: 'tasks={answer.tasks ?? []}',
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
