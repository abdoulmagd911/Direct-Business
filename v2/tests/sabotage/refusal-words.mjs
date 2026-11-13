// Sabotage for the general refusal line (13 Nov): with no detail to give, a refused change is said in a whole sentence,
// never "This change was refused:" and nothing after the colon.
export const sabotages = [
  {
    name: 'a-refusal-with-no-detail-ends-on-a-colon',
    breaks: ['unit:tests/unit/db/a-refusal-with-no-detail-never-ends-on-a-colon.test.ts'],
    expect: 'and no detail is said in a whole sentence, without the colon',
    edits: [
      {
        file: 'src/core/db/words.ts',
        find: "key === 'errors.kind.RuleBroken' && !detail.trim() ? 'errors.kind.RuleBrokenBare' : key",
        replace: 'key',
      },
    ],
  },
];
