# Landing 34b — the follow-up after the owner's live check (20–21 Nov 2026)

Base `b505561` (Landing 34) · target `v2/main` · one push.

## In plain words — what changed

1. **Finance is for everyone; only view-only roles cannot edit (the owner, 21 Nov).** This overrules Landing 34's
   item 5. The Team member role is now at **Full** on Finance and on a partner's Finance tab — the same as Heads,
   Managers and Admins. The **Viewer** role stays at View: it sees Finance and cannot add or edit. It is still a
   setting (Settings › People & access › Access), so an admin can lower or raise one role or one person. The
   earlier database file that set members to None is not edited (files only go forward); a new one moves the level.
2. **Today's three is stable and follows its definition.** The database now picks it, from **all** of the person's
   own open tasks (never one they only help on): Important = starred; Short = not starred, due today or within the
   next two days; Maintenance = the rest (overdue, due later, or with no due day). Nothing whose status means done
   or cancelled shows as current — in Today's three or in the Today block. Each group is in one fixed order (due
   day, undated last, then task number), holds at most three, and says "N more in Tasks" when there are more. The
   same person loading My day twice gets the same answer.
   What was wrong: the screen picked from the short Today list (tasks due within a week, plus starred), so an
   undated task was nowhere; "Short" swept in tasks overdue since 2025; a cancelled task with no closed stamp
   counted as open.
3. **Finance "What needs attention" always settles.** Cause: coming back to the window restarted every Finance
   read (a marker was cleared before the shell's own re-read ran 0.4 s later), so the strip kept returning to
   "Loading". Now a window return is recognised for 2 s and restarts nothing; a refusal hides the strip instead of
   saying "could not be loaded"; Try again always asks again.
4. **People & access search** matches any part of a person — names in both languages, nicknames, job titles,
   e-mail, department, team — several words in any order, ignoring case and accents. Note: on live, no staff
   member has "Sara", "Ahmad" or "Alotaibi" in any field (18 people checked); those names belong to partners'
   contacts, so "No people match" was the right answer for the staff list.
5. **The organisation's Arabic setting switches the app.** Arabic On = Arabic for every signed-in person who has
   not chosen a language themselves; a person's own saved choice wins; Arabic Off = English for everyone. (On live
   four people have English saved; they stay in English until they change "Your language".)
6. **The eight sabotage checks that did not bite in CI run 1615** (end-to-end parts 2/3 and 3/3) are repaired and
   each proven red: `finance-read-is-never-asked-again`, `arabic-never-switched-on`,
   `header-add-follows-the-spent-address`, `e2e-tasks-my-work-shows-the-whole-team`,
   `finance-new-button-for-everyone`, `arabic-cookie-wins-while-off`, `clients-none-reads-as-a-list`,
   `a-row-link-centres-its-words`.

## Database — forward-only

- `20261121090000_my_day_todays_three` — `my.my_three(person)`; `my.my_tasks` and `my.my_day` copied forward
  (status rule; the key `three`). No grant change.
- `20261121090100_core_registry_sync` — starting levels for a database built from zero (member Full on Finance).
- `20261121090200_member_finance_levels_full` — the Team member role's row on `finance` and `partner_finance`
  goes to Full where it reads None or View. Person and team overrides are left alone.

## Seen, not changed

- **A question for the owner.** Three Finance switches are separate from the page level and were NOT changed: importing
  a Payments file (`finance.import`), changing a credit limit (`finance.credit`) and credit control
  (`finance.credit_control`). Team members do not hold them, so a member at Full adds and edits invoices and closes a
  month but cannot import a file or change a credit limit. Say the word and they are switched on for members too.
- The Team list reads at most 200 tasks; a department with more than 200 open tasks would not see them all.
- `finance.health` is the heaviest Finance read and can still come close to the 8-second limit on live; the
  lasting fix is the money-view restructuring already recommended, plus a larger database size.
- `effectiveLocale` (src/core/prefs/effective.ts) is no longer used by any screen.

## Live check that could not be done from here

The build session cannot open the live site or sign in. "Load My day twice as TEST Admin" was done against the
live database, read-only, with the new rule: both readings gave Important 0, Short 0, Maintenance 7 — showing
TSK-2025-0001, TSK-2025-0013, TSK-2025-0007 and "4 more in Tasks" — identical both times.

## Verified before the push (final code, 21 Nov)

- Typecheck, lint, format, the 19 structure checks, registry in step, database types in step: all green.
- Unit tests: 234 files, 1,669 passed. Database tests on a fresh database: 365 passed. Grants unchanged.
- Browser tests, whole suite once on a fresh database: 579 passed, 0 failed, 10 skipped.
- Planted faults, every one caught: database 540, unit 686, checks 33, lint 2, and the 83 browser plants that name
  a changed spec (7 of them new, for "member Full, viewer View"). No stale plant.
- One note: the 3-second Finance speed gate missed once (5.2 s) on a loaded machine and passed on the re-run and
  in the whole-suite run.
