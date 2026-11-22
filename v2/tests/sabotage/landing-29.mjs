// Landing 29 — the window coming back sends no read twice (the proof of the spec's section 6 bar on the Landing 34
// mechanism, and the one duplicate it found), every browser attempt logs its line, and finance.payments_as_of runs
// with JIT off. Each sabotage takes one part back, and the test named must go red.
const READS = 'src/modules/finance/use-reads.ts';
const RPC = 'src/core/db/rpc.ts';
const LOG = 'src/core/db/attempt-log.ts';
const PROOF = 'unit:tests/unit/finance/landing-29-a-window-coming-back-sends-no-read-twice.test.tsx';
const LINES = 'unit:tests/unit/db/landing-29-every-browser-attempt-logs-one-line.test.ts';

export const sabotages = [
  // ---- section 6: no duplicate request, no read on its way sent again
  {
    name: 'l29-a-window-back-counts-as-a-write',
    breaks: [PROOF],
    expect: 'l29_a_done_1 was sent more than once',
    edits: [
      {
        file: READS,
        find: "  return since >= 0 && since <= BACK_WINDOW_MS ? 'back' : 'write';",
        replace: "  return since < 0 ? 'back' : 'write';",
      },
    ],
  },
  {
    name: 'l29-a-read-answered-while-its-twin-waited-is-sent-again',
    breaks: [PROOF],
    expect: 'l29_a_slow_1 was sent more than once',
    edits: [
      { file: READS, find: '  if (landed && landed.at >= queuedAt) {', replace: '  if (landed && landed.at < 0) {' },
    ],
  },
  {
    name: 'l29-an-old-answer-is-never-asked-again',
    breaks: [PROOF],
    expect: 'an old answer is asked again when the window comes back',
    edits: [
      {
        file: READS,
        find: 'now - block.answeredAt > BACK_STALE_MS',
        replace: 'now - block.answeredAt > Number.MAX_SAFE_INTEGER',
      },
    ],
  },
  {
    name: 'l29-a-window-back-flashes-loading',
    breaks: [PROOF],
    expect: 'the figures gave way to Loading when the window came back',
    edits: [
      {
        file: READS,
        find: "        held.current = { status: 'loading', answeredAt: 0 };\n        setTurn((n) => n + 1);",
        replace:
          "        held.current = { status: 'loading', answeredAt: 0 };\n        setState((s) => ({ key: s.key, block: { status: 'loading' } }));\n        setTurn((n) => n + 1);",
      },
    ],
  },
  // ---- every attempt logs its line
  {
    name: 'l29-rpc-logs-no-line-for-an-answer',
    breaks: [LINES],
    expect: 'a call that answered logged no line',
    edits: [{ file: RPC, find: "      log('ready');\n", replace: '' }],
  },
  {
    name: 'l29-rpc-retry-is-not-marked',
    breaks: [LINES],
    expect: 'the second attempt is numbered 2 and marked as the retry',
    edits: [{ file: RPC, find: 'retry: n > 1,', replace: 'retry: false,' }],
  },
  {
    name: 'l29-a-failed-attempt-loses-its-kind',
    breaks: [LINES],
    expect: 'a failed attempt names its error kind',
    edits: [{ file: LOG, find: "? ` kind=${at.kind ?? 'Error'}` : ''", replace: "? '' : ''" }],
  },
  {
    name: 'l29-a-finance-read-logs-no-line-for-an-answer',
    breaks: [LINES],
    expect: 'a Finance read that answered logged no line',
    edits: [
      {
        file: READS,
        find: "      logAttempt({ fn, ms: Date.now() - started, outcome: 'ready', attempt: n, retry: n > 1 });\n",
        replace: '',
      },
    ],
  },
  {
    name: 'l29-the-finance-second-ask-is-numbered-one',
    breaks: [LINES],
    expect: 'the second Finance ask is numbered 2 and marked as the retry',
    edits: [{ file: READS, find: '    data = await attempt(2);', replace: '    data = await attempt(1);' }],
  },
  {
    name: 'l29-a-line-carries-the-arguments',
    breaks: [LINES],
    expect: "not to contain 'made-up-secret'",
    edits: [
      {
        file: RPC,
        find: 'logAttempt({\n        fn,',
        replace: 'logAttempt({\n        fn: `${fn} ${JSON.stringify(args)}`,',
      },
    ],
  },
];
