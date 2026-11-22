# Landing 39 — one stale browser sabotage follows Landing 38 (CI #1622, tests only)

23 Nov 2026 · base `89683abd` (Landing 38, Finance F-C) · target `v2/main` · one push.

## What failed

CI run #1622, job "every end-to-end spec fails under its sabotage (5/5)": 98 of 99 plants turned their spec red; one
could not be planted.

- `new-invoice-saves-a-duplicate-number` — "the text to replace occurs 0 times (must be exactly once)".

Landing 38 rewrote the line in `src/modules/finance/screens/NewInvoice.tsx` that refuses a number already in use
(it now calls `numberIsUsed`), so the plant's old text was gone. The refusal itself is intact and its test passes;
only the proof that the test can fail had gone stale.

## The fix

`tests/sabotage/finance.mjs`: the plant is re-pointed at the line as it reads now and switches off the same refusal.
No product code. No database change. No test loosened.

## Verification

On the builder's machine, local stack, made-up data only:

- types, lint, formatting: clean; the 19 house checks: green
- every edit-plant in `tests/sabotage` finds its text exactly once in the current code (1,376 checked, 0 stale)
- the repaired plant: `finance-new-invoice.spec.ts` red, as it must be
- `finance-new-invoice.spec.ts` on the clean code: 5 passed
