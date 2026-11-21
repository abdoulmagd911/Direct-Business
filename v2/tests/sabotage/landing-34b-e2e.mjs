// Landing 34b in the browser — the Finance "What needs attention" strip. Each sabotage takes back one part of the
// fix on the screen, in one line, and the browser test named must go red for it, with the words given:
// a window that comes back counted as a write again (every Finance read thrown away and asked again, the one still
// on its way too), a refused health read said as "could not be loaded", and a strip kept from a View reader.
// The spec: tests/e2e/finance-overview-reads.spec.ts.
const READS_SPEC = 'e2e:tests/e2e/finance-overview-reads.spec.ts';

export const sabotages = [
  {
    // the mark "the window came back" is gone before the shell's refetch (400 ms later) arrives: a write again
    name: 'e2e-l34b-a-window-coming-back-asks-finance-again',
    breaks: [READS_SPEC],
    expect: 'the health read on its way is not asked again when the window comes back',
    edits: [
      {
        file: 'src/modules/finance/use-reads.ts',
        find: 'export const BACK_WINDOW_MS = 2_000;',
        replace: 'export const BACK_WINDOW_MS = 100;',
      },
    ],
  },
  {
    // a refusal is drawn as a failed read: "could not be loaded", with a Try again that can only be refused again
    name: 'e2e-l34b-a-refused-strip-says-could-not-be-loaded',
    breaks: [READS_SPEC],
    expect: 'a refused health read hides the strip',
    edits: [
      {
        file: 'src/modules/finance/figures.ts',
        find: "  return read.refused ? 'hidden' : 'failed';",
        replace: "  return 'failed';",
      },
    ],
  },
  {
    // the strip is kept for people with Full on Finance: a View reader's answer is thrown away
    name: 'e2e-l34b-a-view-reader-has-no-attention-strip',
    breaks: [READS_SPEC],
    expect: 'a View reader’s strip is drawn',
    edits: [
      {
        file: 'src/modules/finance/screens/FinanceOverviewLive.tsx',
        find: '    health: healthOf(dataOf(health.block)),',
        replace: '    health: full ? healthOf(dataOf(health.block)) : null,',
      },
    ],
  },
];
