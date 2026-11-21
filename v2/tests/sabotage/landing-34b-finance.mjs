// Landing 34, the follow-up — the Finance "What needs attention" strip stuck on Loading. Each sabotage takes back one
// part of the fix — the window coming back counted as a write again (the mark shorter than the shell's wait, the mark
// never set, a write in flight or a Finance screen's own write read as the window, a return that counts for ever), a
// refusal read as a failure or a failure as a refusal, a Try again answered from what was kept, an answer of nothing
// kept, a refused strip that says "could not be loaded" or stays on Loading, a failed strip that vanishes, a strip
// that waits for the closed months, an answer that is not a list read as figures — and the test named must go red.
const READS = 'src/modules/finance/use-reads.ts';
const FIGURES = 'src/modules/finance/figures.ts';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const BACK = 'unit:tests/unit/finance/landing-34b-a-window-coming-back-is-not-a-write.test.tsx';
const STRIP = 'unit:tests/unit/finance/landing-34b-the-attention-strip-always-settles.test.tsx';

export const sabotages = [
  // ---- the cause: a window that comes back is not a write
  {
    name: 'window-back-mark-shorter-than-the-shells-wait',
    breaks: [BACK],
    expect: 'the mark outlasts the shell’s wait before its focus refetch',
    edits: [
      { file: READS, find: 'export const BACK_WINDOW_MS = 2_000;', replace: 'export const BACK_WINDOW_MS = 100;' },
    ],
  },
  {
    name: 'window-back-mark-is-never-set',
    breaks: [BACK],
    expect: 'a read still on its way is left alone when the window comes back',
    edits: [
      {
        file: READS,
        find: "document.visibilityState === 'visible') windowCameBack();",
        replace: "document.visibilityState === 'visible') void 0;",
      },
    ],
  },
  {
    name: 'a-write-in-flight-reads-as-the-window-back',
    breaks: [BACK],
    expect: 'a doubt is always a write',
    edits: [{ file: READS, find: 'if (at.busy || at.cameBackAt === null)', replace: 'if (at.cameBackAt === null)' }],
  },
  {
    name: 'a-finance-write-reads-as-the-window-back',
    breaks: [BACK],
    expect: 'a write still asks every block again',
    edits: [
      {
        file: READS,
        find: 'export function financeWrote() {\n  cameBackAt = null;\n}',
        replace: 'export function financeWrote() {}',
      },
    ],
  },
  {
    name: 'the-return-of-the-window-counts-for-ever',
    breaks: [BACK],
    expect: 'a write still asks every block again',
    edits: [
      {
        file: READS,
        find: "  if (cause === 'back')\n    setTimeout(() => {\n      cameBackAt = null;\n    }, 0);\n",
        replace: '',
      },
    ],
  },
  // ---- a refusal is an answer, not a failure
  {
    name: 'a-refusal-reads-as-a-failure',
    breaks: [BACK],
    expect: 'settles the block at once as refused',
    edits: [{ file: READS, find: 'refused: isRefusal(e)', replace: 'refused: false' }],
  },
  {
    name: 'a-timeout-reads-as-a-refusal',
    breaks: [BACK],
    expect: 'only the database’s "you may not" is a refusal',
    edits: [
      {
        file: READS,
        find: "e instanceof DbError && e.kind === 'PermissionDenied'",
        replace: "e instanceof DbError && e.kind !== 'RuleBroken'",
      },
    ],
  },
  // ---- Try again always goes to the database
  {
    name: 'try-again-answers-from-what-was-kept',
    breaks: [BACK],
    expect: 'Try again on a kept answer asks afresh too',
    edits: [{ file: READS, find: '  if (fresh) kept.delete(key);\n', replace: '' }],
  },
  {
    name: 'an-answer-of-nothing-is-kept',
    breaks: [BACK],
    expect: 'an answer of nothing is never kept',
    edits: [
      {
        file: READS,
        find: 'if (asked === epoch && data !== null && data !== undefined) kept.set',
        replace: 'if (asked === epoch) kept.set',
      },
    ],
  },
  // ---- the strip always settles
  {
    name: 'refused-strip-says-could-not-be-loaded',
    breaks: [STRIP],
    expect: 'a refusal leaves no strip at all',
    edits: [{ file: FIGURES, find: "  return read.refused ? 'hidden' : 'failed';", replace: "  return 'failed';" }],
  },
  {
    name: 'refused-strip-stays-on-loading',
    breaks: [STRIP],
    expect: 'a refusal leaves no strip at all',
    edits: [
      {
        file: FIGURES,
        find: "  if (read.loading) return 'loading';",
        replace: "  if (read.loading || read.refused) return 'loading';",
      },
    ],
  },
  {
    name: 'refused-strip-is-still-drawn-as-a-failed-read',
    breaks: [STRIP],
    expect: 'a refusal leaves no strip at all',
    edits: [{ file: OVERVIEW, find: "          ) : strip === 'hidden' ? null : (", replace: '          ) : (' }],
  },
  {
    name: 'failed-strip-vanishes',
    breaks: [STRIP],
    expect: 'a read that truly failed says so in words, with Try again',
    edits: [{ file: FIGURES, find: "  return read.refused ? 'hidden' : 'failed';", replace: "  return 'hidden';" }],
  },
  {
    name: 'strip-waits-for-the-closed-months',
    breaks: [STRIP],
    expect: 'does not wait for a sibling',
    edits: [
      {
        file: OVERVIEW,
        find: 'const strip = attentionState({ health: data.health,',
        replace: 'const strip = attentionState({ health: data.closed ? data.health : null,',
      },
    ],
  },
  {
    name: 'an-answer-that-is-not-a-list-reads-as-figures',
    breaks: [STRIP],
    expect: 'an answer of nothing at all (null, or not a list) is a failed read',
    edits: [
      {
        file: FIGURES,
        find: 'Array.isArray(answer) ? (answer as HealthEntry[]) : null;',
        replace: '(answer as HealthEntry[] | null) ?? null;',
      },
    ],
  },
];
