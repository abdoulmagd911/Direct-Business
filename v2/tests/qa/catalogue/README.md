# The scenario catalogue's Covered rows, checked (QA, 29 Sep 20:40 Riyadh)

`covered.csv` has one line per row that the oversight's catalogue (`scenarios.csv`) marks **Covered**: 128 rows. The
Architect folds it into the catalogue; this folder only holds the evidence.

| Column                 | Meaning                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| ID                     | the catalogue row                                                                              |
| Test today             | the real test IDs: `SQL <ID>`, a unit test by path, or `v2/tests/e2e/<file>.spec.ts › <title>` |
| Fails without its rule | `yes` when a sabotage or a mutant that deletes only that rule turns the named test red         |
| Proof                  | the sabotage or mutant, and what went red (or `SURVIVED`)                                      |
| Proposed status        | Covered (108) or Partly (20)                                                                   |
| Reason                 | why a row drops to Partly, or a note on a kept row                                             |

**How it was checked**, on v2/main 35ec99c (same `v2/` as c09d36a):

- all 118 SQL sabotages were re-run;
- 80 targeted SQL mutants in `mutants/` (`index.json` names each one's rule and tests);
- six role-matrix mutants, each run as a database-only drift and as a source change plus sync;
- the check and unit-test sabotages (`plant-vat-column`, `plant-physical-css`, the blind-check pair) were re-run.

Declared E2E sabotages were taken on trust, not re-run. A row proved only by an E2E spec with no sabotage is Partly.

Re-run one mutant:
`v2/supabase/tests/qa/run.sh after origin/v2/main v2/tests/qa/catalogue/mutants/m17-retire-without-reason.sql SETS-01`
(SETS-01 stays green: archiving a list value with no reason is never refused, ACC-083).
