# Phase 3 — task-manager design v1.2.4 checked against the live database (2026-09-25)

For the oversight chat. The design (29a migration, 29b attack tests, 29e test copy of the live access
functions) was checked against the live `direct-business` database **before anything was applied**.
Method: read-only queries on the live schema; the grid update run inside a transaction that always
rolls back; and the design's own 87 tests re-run on a local Postgres 16 twice — once on the design's
own test copy (29e), once on a copy corrected to what the live database says today.

## Results in one line each

| Check | Result |
|---|---|
| Name clashes (42 new tables/views, 38 new functions) | **None.** No new name exists live. |
| Columns the design reads (businesses, contacts, ksa_events, client_profiles, finance_*, generated_documents, promo_codes, app_users, record_history, document_counters) | **All present, types match** (ids uuid, record_history.id bigint). `promo_codes.purpose` / `services` are added by the design, as intended. |
| Existing promo codes vs the new `promo_codes_guard` | **All 200 pass** (195 percent, 5 fixed; none out of range; no reversed dates). |
| `record_history_write` (live) vs the test copy | **Same behaviour.** |
| `page_level` (live) vs the test copy | **Same.** |
| The design's 87 tests on its own test copy | **87 / 87** (reproduced here, after mirroring two Supabase defaults the local server lacks — see below). |
| The same 87 tests on a copy corrected to the live truth | **84 / 87 — D01, D03, R06 fail.** Cause: difference 1. |
| Grid update in step 01 (before/after, every live person × 21 pages) | **231 checks, 16 changes, nothing else moves.** The 8 active non-admins each gain `tasks: none→full` and `reports: none→own` (the one manager: `→full`). Admins and inactive people unchanged. |

## Differences that matter

1. **Numbering is Generator-only on live.** Since Phase 1b, `next_document_number()` refuses anyone
   without Full control of the Generator (`documents`). The design takes `PRJ`/`TSK` codes (and later
   `MRP`/`QRP`/`YRP`) from it as column defaults, so **an employee could not create a task or a
   project**. The test copy (29e) predates that rule. *Fix used in release 1:* a separate
   `next_work_number(family)` for `PRJ`/`TSK` that asks `can_work('tasks')`, same counters table,
   same format; `next_document_number` unchanged.
2. **Manager's default grid.** Live `default_page_levels('manager')` includes `documents: full`
   (Phase 1b, owner-approved). The design's copy drops it — a new manager would lose the Generator.
   *Fix:* keep `documents`, add `tasks`.
3. **Anonymous access to new functions.** Live default privileges grant EXECUTE on every new function
   to `anon` directly (measured in `pg_default_acl`), so `revoke … from public` alone leaves
   `changes_to_my_tasks` callable without signing in (it returns nothing, but it is not the pattern).
   *Fix:* `revoke all … from public, anon; grant execute … to authenticated` on the functions the
   screens call.
4. **History of tasks is readable by every signed-in person.** Live `record_history_read` is
   `true` for every table except the three finance ones. With open visibility ON that matches the
   design; the day an admin turns it OFF, the before/after rows of every task and achievement would
   still be readable by all. *Fix:* the policy asks `can_see_page('tasks')` for the task and project
   tables and `can_see_page('reports')` for achievements / reports / proofs.
5. **Undo does not know the new tables.** Live `undo_change()` maps only companies, contacts,
   activities, client profiles and finance; anything else answers "This kind of change cannot be
   undone here." D7's "every change can be undone" would not hold for tasks. *Fix:* tasks, projects
   and the task child tables map to the Tasks page (same 24 h window, same own-change / manager
   rule).
6. **Company owner by name.** `company_owner_member()` and the `finance_credit` view match the
   account manager's name against full name and nickname only, with `limit 1`. Live ownership
   (`resolve_owner`, Phase 1b-E) also reads the Arabic name, Arabic nickname and e-mail prefix,
   refuses ambiguous names, and has the owner's own preference for the one name two admin accounts
   share. *Fix:* both go through `resolve_owner()`.
7. **Reports levels change today's Reports page.** Step 01 gives 8 people `reports` for the first
   time. Today's Reports page keeps its data in each browser (M32), and on `own` the app now shows it
   read-only (js/107). Giving it in release 1 would change a page nobody asked to change yet.
   *Proposal:* release 1 adds **Tasks only**; the `reports` levels land with the report-registration
   release, together with the export and the move of the browser-held data (the owner's Phase 3
   ruling).

## Differences that do not matter (recorded so nobody re-checks them)

- The local test server needed two Supabase defaults the live database already has: new tables /
  functions granted to `anon` and `authenticated`, and `usage` on schema `auth`. With those mirrored,
  29b runs 87 / 87 unchanged.
- 29b's N10 reads the app's service list from a file path on the other session's machine; pointed at
  this repository it passes.
- Two "projects": the app's existing **Projects** page (`app_projects`, page key `projects`) and the
  design's work **projects** table, which answers to the **Tasks** page. They do not collide in the
  database; on screen the new ones live inside Tasks.

## Release 1 (this repository, by pull request)

Tasks + projects with their screens, the Tasks page in Team & Access, "changes to your tasks" on
Today, fixes 1–6 above, and the grid change for `tasks` only. The rest of the design's tables are
created with it (tasks reference them), inert until their pages are built. Re-tested: the 87 on the
corrected copy, plus live dry runs in a transaction that always rolls back.
