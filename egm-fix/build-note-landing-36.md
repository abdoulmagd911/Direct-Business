# Landing 36 — "Responsible", not "Owner", in the quick-add form and the list filter

22 Nov 2026 · base `038d7ba6` (Landing 33, live, CI #1619 all green) · target `v2/main` · one push.

The owner's ruling of 22 Nov, applied as written.

## What changed

- **Quick-add form:** the field that names who the task belongs to is labelled **Responsible** («المسؤول»).
- **List filter:** the filter chip on the Tasks list says **Responsible** («المسؤول»), and so does the chip of an
  applied filter.
- **Past-work paste: unchanged.** "Owner" stays there everywhere — it is a column name people paste, and renaming
  it would break existing pastes.

One thing beyond the ruling's words, in the same form: the quick-add field's prompt and its error read "Pick an
owner". Under a "Responsible" label that read oddly, so they now read **"Pick who is responsible"** («اختر المسؤول»).
Say if the old words should come back.

## Not changed (not in the ruling)

- The list's bulk-assign box still says "Owner" and "Assign owner and priority".
- Error sentences that mention "owner" (for example "Live work needs an owner") and "Change owner" on the task page's
  picker for screen readers.

No database change. No migration.

## Tests

- The quick-add browser test now finds the field by the name "Responsible" and reads the new prompt and error.
- New assertion: the list's filter chip says "Responsible" and no chip says "Owner".
- Two new browser sabotage proofs (`e2e-tasks-the-list-filter-says-owner`, `e2e-tasks-quick-add-says-owner`); one unit
  proof re-worded to the new sentence.

## Verification

Run on the final tree, on this machine, before the push:

| Check                                | Result                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| Types, lint, formatting              | clean                                                         |
| House checks                         | 19 of 19 green                                                |
| Unit tests                           | 241 files, 1,757 tests, all pass                              |
| Database tests, fresh database       | 373 of 373                                                    |
| Production build                     | exit 0 (built for the browser run)                            |
| Browser suite, whole, fresh database | 591 passed, 10 skipped by design, 0 failed                    |
| Sabotage — unit / checks / lint      | 754 / 33 / 2 plants, 0 failures                               |
| Sabotage — browser                   | the 14 plants on the tasks test file: all red as they must be |

Not run on this machine: the database sabotage proofs (nothing in the database changed) and the other browser
sabotage proofs; CI runs every one.
