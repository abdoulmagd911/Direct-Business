// Landing 33 (the task features, B1–B5). What each fix promises, and one sabotage that takes it back:
//   B1  one comment is THE DECISION, pinned above the thread, offered only to whoever may decide; a linked record
//       opens its record and a hidden one names nothing;
//   B2  "@" opens the picker at the start of a word only; a mention links to the person, the longest name first, and
//       is sent to the database (which makes the person a helper);
//   B3  a hand-over needs its reason, 120 characters at most, in the owner's words; the deputy ticks steps; only the
//       Responsible is offered Hand over;
//   B4  a row or a card says how many of its steps are done;
//   B5  a card dropped on a column makes the pill's move — none where it already is, Block on Blocked — and only a
//       card whose status the reader may move drags, by a grip that gives up the browser's scrolling.
// Each sabotage breaks one of those, and the test named must go red for it.
const COMMENTS = 'src/ui/record/Comments.tsx';
const EXTRAS = 'src/ui/record/CommentExtras.tsx';
const RULES = 'src/modules/tasks/rules.ts';
const LOOK = 'src/modules/tasks/screens/look.ts';
const BOARD = 'src/modules/tasks/screens/TaskBoard.tsx';
const BITS = 'src/modules/tasks/screens/TaskBits.tsx';
const DELEGATE = 'src/modules/tasks/screens/Delegate.tsx';
const RECORD = 'src/modules/tasks/screens/TaskRecord.tsx';
const THREE = 'src/modules/my-day/screens/TodaysThree.tsx';
const THREAD = 'unit:tests/unit/record/landing-33-the-decision-is-pinned-and-a-comment-links-and-mentions.test.tsx';
const TASKS = 'unit:tests/unit/tasks/landing-33-hand-over-deputy-steps-and-the-drop.test.tsx';
const BROWSER = 'e2e:tests/e2e/landing-33-task-features.spec.ts';

const MAY_ACT = '  const mayAct = r.can_act ?? r.can_edit;';

export const sabotages = [
  // ---------------------------------------------------------------- B1 · the decision and the links
  {
    name: 'l33-the-decision-is-not-pinned',
    breaks: [THREAD],
    expect: '> is pinned above the filters and the thread, once, with who marked it',
    edits: [
      {
        file: COMMENTS,
        find: '  const decision = shown.find((c) => c.is_decision) ?? null;',
        replace: '  const decision = shown.find((c) => c.is_decision && !c.id) ?? null;',
      },
    ],
  },
  {
    name: 'l33-anyone-is-offered-the-decision-mark',
    breaks: [THREAD],
    expect: '> offers neither to a reader who may not decide, who still sees the decision',
    edits: [
      {
        file: COMMENTS,
        find: '                  (list.can_decide && !c.is_decision) ||',
        replace: '                  !c.is_decision ||',
      },
      {
        file: COMMENTS,
        find: '                    {list.can_decide && !c.is_decision ? (',
        replace: '                    {!c.is_decision ? (',
      },
    ],
  },
  {
    name: 'l33-a-hidden-link-is-drawn-as-a-link',
    breaks: [THREAD],
    expect: '> a record the reader may not see says only that a record is linked',
    edits: [{ file: EXTRAS, find: '        l.hidden ? (', replace: '        l.hidden && false ? (' }],
  },
  {
    name: 'l33-a-project-link-opens-the-projects-page',
    breaks: [THREAD],
    expect: '> open the record: a partner its page, a project its tasks, a code its view',
    edits: [
      {
        file: EXTRAS,
        find: "  if (l.kind === 'project') return `/tasks?project=${l.id}`;",
        replace: "  if (l.kind === 'project') return '/projects';",
      },
    ],
  },
  // ---------------------------------------------------------------- B2 · mentions
  {
    name: 'l33-a-short-name-cuts-a-long-mention',
    breaks: [THREAD],
    expect: '> is a link to the person, the longest name first',
    edits: [
      {
        file: EXTRAS,
        find: '    .sort((a, b) => b.text.length - a.text.length);',
        replace: '    .sort((a, b) => a.text.length - b.text.length);',
      },
    ],
  },
  {
    name: 'l33-an-at-sign-inside-a-word-opens-the-picker',
    breaks: [THREAD],
    expect: '> and not inside a word, across a line, or past 40 characters',
    edits: [{ file: EXTRAS, find: '  if (at > 0 && !/\\s/.test(before[at - 1]!)) return null;\n', replace: '' }],
  },
  // ---------------------------------------------------------------- B3 · hand-over and deputy
  {
    name: 'l33-a-hand-over-needs-no-reason',
    breaks: [TASKS],
    expect: '> needs a person, never myself, and a reason',
    edits: [
      {
        file: RULES,
        find: "  if (!reason) return { error: 'reason_required' };\n  if (reason.length > HAND_OVER_REASON_MAX)",
        replace: '  if (reason.length > HAND_OVER_REASON_MAX)',
      },
    ],
  },
  {
    name: 'l33-a-reason-runs-to-two-hundred',
    breaks: [TASKS],
    expect: '> takes a reason of 120 characters and refuses 121',
    edits: [
      {
        file: RULES,
        find: 'export const HAND_OVER_REASON_MAX = 120;',
        replace: 'export const HAND_OVER_REASON_MAX = 200;',
      },
    ],
  },
  {
    name: 'l33-the-deputy-ticks-nothing',
    breaks: [TASKS],
    expect: '> lets the task’s deputy tick its steps, and not a stranger',
    edits: [{ file: RULES, find: 'task.can_edit || task.deputy_id === me || ', replace: 'task.can_edit || ' }],
  },
  // ---------------------------------------------------------------- B4 · steps
  {
    name: 'l33-the-steps-count-the-open-ones-as-done',
    breaks: [TASKS],
    expect: '> say "3 of 4 steps" on a task with four steps and one still open',
    edits: [
      {
        file: BITS,
        find: '  const done = Math.max(0, total - row.open_action_items);',
        replace: '  const done = row.open_action_items;',
      },
    ],
  },
  {
    name: 'l33-a-card-says-no-steps',
    breaks: [TASKS],
    expect: '> says the steps done on a card that has steps, and nothing on one that has none',
    edits: [{ file: BOARD, find: '      <StepsMark row={r} locale={names.locale} />\n', replace: '' }],
  },
  // ---------------------------------------------------------------- B5 · the drop
  {
    name: 'l33-a-card-dropped-where-it-is-moves',
    breaks: [TASKS],
    expect: '> makes no move where it already is',
    edits: [{ file: LOOK, find: '  if (now === column.key) return null;\n', replace: '' }],
  },
  {
    name: 'l33-a-drop-on-blocked-asks-no-reason',
    breaks: [TASKS],
    expect: '> dropped on Blocked is the Block move, which asks its reason',
    edits: [
      {
        file: LOOK,
        find: "  if (column.kind === 'blocked') return now === 'blocked' ? null : { kind: 'block' };",
        replace: "  if (column.kind === 'blocked') return null;",
      },
    ],
  },
  {
    name: 'l33-every-card-drags',
    breaks: [TASKS],
    expect: '> does not drag for a reader who may not move it',
    edits: [{ file: BOARD, find: MAY_ACT, replace: '  const mayAct = true;' }],
  },
  {
    name: 'l33-the-deputy-cannot-drag',
    breaks: [TASKS],
    expect: '> drags for whoever may move its status — the editor and the deputy',
    edits: [{ file: BOARD, find: MAY_ACT, replace: '  const mayAct = r.can_edit;' }],
  },
  {
    name: 'l33-the-grip-lets-the-page-scroll',
    breaks: [TASKS],
    expect: '> has a grip a finger can hold: 44 px, and no browser scrolling on it',
    edits: [{ file: BOARD, find: 'cursor-grab touch-none items-center', replace: 'cursor-grab items-center' }],
  },

  // ---------------------------------------------------------------- in the browser
  {
    name: 'e2e-l33-the-decision-is-not-pinned',
    breaks: [BROWSER],
    expect: 'the decision is pinned',
    edits: [
      {
        file: COMMENTS,
        find: '  const decision = shown.find((c) => c.is_decision) ?? null;',
        replace: '  const decision = shown.find((c) => c.is_decision && !c.id) ?? null;',
      },
    ],
  },
  {
    name: 'e2e-l33-a-mention-is-not-sent',
    breaks: [BROWSER],
    expect: 'the mention links to the person',
    edits: [
      {
        file: COMMENTS,
        find: '          ...(sentPeople.length ? { p_mentions: sentPeople.map((p) => p.id) } : {}),\n',
        replace: '',
      },
    ],
  },
  {
    name: 'e2e-l33-an-empty-reason-hands-the-task-over',
    breaks: [BROWSER],
    expect: 'an empty reason is refused in the owner’s words',
    edits: [
      {
        file: DELEGATE,
        find: '    const r = handOverValues({ to, reason }, me.person.id);',
        replace: "    const r = handOverValues({ to, reason: reason || 'none given' }, me.person.id);",
      },
    ],
  },
  {
    name: 'e2e-l33-a-manager-is-offered-a-members-task',
    breaks: [BROWSER],
    expect: 'a manager is not offered a team member’s task',
    edits: [
      {
        file: RECORD,
        find: '  const mayAssign = !closed && !!task.can_hand_over && mayGive;',
        replace: '  const mayAssign = !closed && task.can_edit && mayGive;',
      },
    ],
  },
  {
    name: 'e2e-l33-a-dropped-card-asks-no-move',
    breaks: [BROWSER],
    expect: 'the drop changed the card’s status',
    edits: [{ file: BOARD, find: '    if (move) askers.current.get(cardId)?.(move);\n', replace: '' }],
  },
  {
    name: 'e2e-l33-every-card-drags',
    breaks: [BROWSER],
    expect: 'may not drag the card',
    edits: [{ file: BOARD, find: MAY_ACT, replace: '  const mayAct = true;' }],
  },
  {
    name: 'e2e-l33-a-phone-loses-the-source-lines',
    breaks: [BROWSER],
    expect: 'important at 390',
    edits: [
      {
        file: THREE,
        find: 'className="flex flex-col gap-1 pt-3 text-xs text-muted max-lg:border-t max-lg:border-border lg:flex-row lg:flex-wrap lg:gap-x-5"',
        replace:
          'className="hidden flex-col gap-1 pt-3 text-xs text-muted max-lg:border-t max-lg:border-border lg:flex lg:flex-row lg:flex-wrap lg:gap-x-5"',
      },
    ],
  },
];
