# Landing 42 — the test-data enrichment script (tools only)

23 Nov 2026 · base `5a35f7f8` (Landing 41, CI #1625 all green) · target `v2/main` · one push.

The list approved on 23 Nov (`egm-fix/test-data-enrichment-draft-2026-11-23.md` on the notes branch), Finance option A.
No product code, no migration: two scripts under `v2/scripts/fixtures/`.

## What it is

`enrich-test-data.mjs` — run once by the person who holds the TEST Admin login, against the workspace:

- It signs in as one person and stops unless that person is an **admin marked TEST**.
- It writes only through the app's own doors, so every rule, log entry and notification is the real one. No direct
  database write, no file import, no setting, role or access change. It creates no people.
- Every record is made up and its title or name starts with **"TEST · "**. It never touches a record it did not make.
- Three modes: plain (says what it would add and the exact Finance change, writes nothing), `--write`, `--clean`.

`enrich-prove-local.mjs` — the proof, on the builder's machine only (it refuses any address that is not local).

## What it adds

| Page                            | Added                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks, My day, Team view, Board | 9 open tasks each for TEST Member, TEST Viewer and TEST Head, all assigned by TEST Admin: due from two days ago to five weeks out; priorities from the workspace's own list; 2 in progress and 1 blocked with its reason per person. Plus 2 done tasks each (33 in all) |
| Task record                     | On two tasks per person: two steps (one ticked), a comment, and a comment marked as the decision. One task per person is linked to a TEST client                                                                                                                        |
| Projects                        | 1 project owned by TEST Head, with 4 of the Head's tasks and a health note                                                                                                                                                                                              |
| Clients                         | 4 organisations: a postpaid corporate with a client ID, a prepaid one with a client ID, a prospect, one archived — each with a contact, a logged call and a note                                                                                                        |
| Suppliers & partners            | 2 organisations, each with a contact, a logged call and a note                                                                                                                                                                                                          |
| Pipeline                        | 2 opportunities (two stages) and 1 tender, on the TEST clients                                                                                                                                                                                                          |
| Achievements                    | 6, owned by TEST Member and TEST Head: 3 this month, 3 last month; 2 on a TEST client; 1 logged from a done task                                                                                                                                                        |
| Codes                           | 1 discount code on the first TEST client                                                                                                                                                                                                                                |
| Finance                         | 6 typed invoices on the two TEST clients over the last three months: 4 fully paid (4,000 · 6,000 · 2,500 · 3,500), 1 pending (5,000), 1 draft (1,500); one approved cost of 2,400                                                                                       |

**The exact Finance change, year to date:** revenue **+16,000**, cost **+2,400**, profit **+3,600** (profit counts only
the invoice whose cost is known: 6,000 − 2,400). The script prints the before and after of each figure **before it
writes**, checks them again after, and stops with an error if they differ by a riyal.

## Not in it

- **Files.** The approved list has two small test files on a TEST client. An upload goes to file storage, which the
  local stack does not run, so it could not be proven here and was left out: add the two files by hand in the browser.
- **A link inside a comment** to an organisation: the task itself carries the link to the TEST client instead.

## How to run it against the workspace (Rocky, after Landing 41 is confirmed live)

From `v2/` of a checkout of `v2/main`, with the workspace's address and its publishable key (both are in the app's
public settings) and the TEST Admin's e-mail and password, set in the shell and never written to a file:

1. `node scripts/fixtures/enrich-test-data.mjs` — read what it would add and the Finance change. Nothing is written.
2. `node scripts/fixtures/enrich-test-data.mjs --write`
3. To take it all back: `node scripts/fixtures/enrich-test-data.mjs --clean`

The four settings are `ENRICH_API_URL`, `ENRICH_PUBLISHABLE_KEY`, `ENRICH_EMAIL`, `ENRICH_PASSWORD`.

If this year's achievement plan is not open in the workspace, the script stops at the achievements and says so.

## Verification

On the builder's machine on 23 Nov, local stack, made-up data only (`node scripts/fixtures/enrich-prove-local.mjs`),
starting from figures that are not zero (revenue 1,234 · cost 234 · profit 1,000):

- plan: writes nothing, prints revenue 1,234 → 17,234, cost 234 → 2,634, profit 1,000 → 4,600
- `--write`: 144 writes through the app's doors; the figures moved by exactly +16,000 / +2,400 / +3,600
- read from the database after the write: 9 open tasks each for TEST Head, TEST Member and TEST Viewer; 3 blocked;
  all 6 test invoices linked to their TEST client; 1 achievement logged from a task
- a second `--write`: nothing to add, 0 writes, figures unchanged
- `--clean`: removed 33 tasks, 1 project, 6 organisations, 6 achievements, 3 pipeline cards, 6 invoices; nothing left
  under the script's names; the figures back at **1,234 / 234 / 1,000 exactly**
- types, lint, formatting: clean; the 19 house checks: green; unit tests: 1,814 passed; check and lint sabotage: 35,
  each red as it must be

Not proven locally, and to watch on the first live run: the workspace's own lists (priorities, statuses, organisation
types, pipeline sources and stages) are read at run time, so a list the owner has changed is followed — but only the
local lists were exercised here. The plain run before `--write` reads all of them and stops if one is missing.
