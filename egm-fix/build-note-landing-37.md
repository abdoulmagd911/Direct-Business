# Landing 37 — the bulk-assign box says "Responsible" too

22 Nov 2026 · base `cc77a037` (Landing 36) · target `v2/main` · one push.

The owner's ruling of 22 Nov, following Landing 36: the bulk-assign box on the Tasks list and its title say
Responsible, the same as the quick-add form and the list filter.

## What changed

- The bulk action on the Tasks list reads **"Assign Responsible and priority"** («إسناد المسؤول والأولوية»).
- The field in the box is labelled **Responsible** («المسؤول»).
- The box's explanation reads "Give the selected tasks to one Responsible, set their priority, or both…"
  («أعطِ المهام المحددة لمسؤول واحد…»).

Unchanged: the past-work paste keeps "Owner" (a column name people paste). No database change. No migration.

## Tests

- A new browser test opens the bulk-assign box and reads the action's name, the field's label and the explanation
  (there was no browser test on this box before).
- Two new browser sabotage proofs: `e2e-tasks-bulk-assign-says-owner`, `e2e-tasks-bulk-action-is-unnamed`.

## Verification

Checked on the builder's machine on 22 Nov, on the local stack (made-up data only):

- types, lint, formatting: clean; the 19 house checks: green
- unit tests: 1,757 passed; database tests: 373 passed
- the tasks browser specs: 70 passed (tasks.spec.ts 18 of 18, with the new bulk-assign test)
- sabotage: unit 754, check 33, lint 2 — every one turned its target red
- browser sabotage for tasks.spec.ts: 16 of 16 red, including the two new plants
  (`e2e-tasks-bulk-assign-says-owner`, `e2e-tasks-bulk-action-is-unnamed`)

No database change, so nothing to check in the live database. The live browser check is the owner's.
