# Landing 46 — the board-drag test aims clear of the board's scrolling edges (tests only)

24 Nov 2026 · base `39805a47` (Landing 45) · target `v2/main` · one push.

## Why

CI run #1629 (Landing 45) went red on one browser test: the Landing 33 board-drag test B5, at the phone step, with
"the column is still under the card at the drop". Landing 45 changed no screen, so the fault was looked for in the test.

The board scrolls sideways by itself while a carried card's pointer is within 56 px of its edge (`EDGE_PX` in
`board-drag.ts`) — that is how a column off the screen is reached. On a phone a column is nearly the board's width, so
the middle of the target column can sit inside that strip. The test aimed at the column's middle; when the middle was
in the strip the board kept scrolling under the still pointer, the column slid away, and the check failed.

Measured on the Landing 45 code, locally: B5 failed 1 run in 12. With a temporary log line (since removed), every
aim inside the right-hand strip lost the column (5 of 5) and every aim outside it kept it. The app behaves as built;
the test aimed badly. The aim Landing 44 added just before the drop had the same gap.

## The change

- `tests/e2e/landing-33-task-features.spec.ts` only. A new helper `aimAt` points at the middle of the part of the
  column that is on the board and clear of both scrolling strips; the drag uses it both while carrying the card and
  for the last aim before letting go, and says so in words if no such part is on the screen.
- No product code, no migration, no wording. No check is loosened: every assertion of B5 stands as it was.

## Verification

- B5 with the fix, 40 runs in a row locally: 40 passed (before the fix, 1 in 12 failed).
- The board's browser sabotages, each red with its own message: `e2e-l33-a-dropped-card-asks-no-move`,
  `e2e-l33-every-card-drags`, `e2e-l33-a-phone-loses-the-source-lines`.
- Full checks, all green: types, lint, format, 19 of 19 checks, generated types, registry; unit 1,821 passed; database 381 passed, 0 failed; browser 604 passed, 11 skipped (the 10 skipped on Landing 45, plus `when-chips` “a time that has passed”, which skips itself before nine in Riyadh); 811 unit/check/lint sabotages, 0 failures.
