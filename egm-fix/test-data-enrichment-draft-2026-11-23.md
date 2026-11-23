# Test-data enrichment — draft list for approval (23 Nov 2026)

Status: DRAFT for Rocky's approval. Nothing is built yet and nothing has been written to live.

## How it will work

- One script, run once by Rocky against live with the TEST Admin login. The builder does not write to live.
- It writes through the app's own doors, acting as the TEST users, so every rule, log entry and notification is the
  real one. Nothing goes into a migration.
- It creates no people. It uses the TEST users that exist (TEST Admin, TEST Head, TEST Member, TEST Viewer, and
  TEST Manager if there is one). If one is missing it stops and says which.
- Every record is made up. Every title or name starts with "TEST · " so it can be found and told apart.
- It touches only records it made, and only TEST organisations — never a real organisation, person or record.
- Safe to run twice: a second run adds only what is missing.
- It comes with a matching clean-up that removes exactly what it made (through the app's own remove doors).
- It is proven first on the builder's machine against the local database.

## Page by page

| Page | What is added | Why |
| --- | --- | --- |
| Tasks, My day, Team view, Board | 9 open tasks each for TEST Member, TEST Viewer and TEST Head (27). Per person: 3 due today or overdue, 3 due this week, 3 later; mixed priorities; most not started, 2 in progress, 1 blocked with its reason. Plus 2 done tasks each. The Viewer's are assigned by TEST Admin (a Viewer cannot create). | Today's three shows 3 + 3 + 3; the list, filters, board columns and the bulk box have something to show |
| Task record | On two tasks per person: steps (some ticked), a comment, one comment marked as the decision, one link to a TEST organisation | The Landing 33 features are visible |
| Projects | 1 TEST project holding 4 of the tasks above, with a health note | The Projects page and a project's task list are not empty |
| Clients | 4 TEST organisations: a postpaid corporate with a client ID, a prepaid one, a prospect, and one archived. Each with a contact, a logged activity and a note | The list, its filters and a record's tabs have content |
| Suppliers & partners | 2 TEST organisations, each with a contact and a note | Same, for the other side |
| Pipeline | 2 opportunities and 1 tender on the TEST clients, at different stages | The board has cards in more than one column |
| Achievements (KPIs) | 6 achievements by TEST Member and TEST Head (a Viewer cannot log): 3 this month, 3 last month; 2 linked to a TEST client; 1 logged from a done task | Achievements page, a client's Related tab, and the new Finance card |
| Finance, a client's Finance tab | NEEDS A YES — see below | — |
| Codes | 1 TEST discount code on a TEST client | The Codes page and the client's Codes tab |
| Files | 2 small made-up text files on a TEST client, one of them restricted | The Files page and the restricted-file rule |
| Overview, Reports, Weekly review, Appraisal, Activity | Nothing written directly: these pages read what the rows above create | They fill from the data above |
| Settings (all) | Nothing changed. No setting, role, access level or per-person extra is touched | Settings are not test data |

## Finance — needs a yes before it is included

Typed test invoices would move the live Finance figures (revenue, cost, profit, the year-to-date total the owner
checks). Two choices:

- **A (recommended): include a small, exact set.** 6 typed invoices on 2 TEST clients across the last 3 months —
  4 fully paid, 1 pending, 1 draft; one with a cost line. Round amounts, stated in the script's output, so the
  change to each figure is known to the riyal before it is run, and the clean-up takes it back exactly.
- **B: leave Finance out.** No figure moves; the Finance page and a client's Finance tab keep only what is there now.

No file is imported either way.

## Not included

- No real names, amounts, invoice numbers or client IDs: every value is made up.
- No change to existing records.
- Calendar: not built yet.
