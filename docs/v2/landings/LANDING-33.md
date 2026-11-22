# Landing 33 — the task features (the re-skin brief, part 2 of 2: B1 to B5)

22 Nov 2026 · base `4f724f8a` (Landing 29, live, CI #1618 all green) · target `v2/main` · one push.

Part A (the new look) landed as Landing 31. This is Part B — the task features — built on top of it.

**Two things to know first.**

1. **The brief file and the canvas were not available to this session.** `egm-fix/reskin-task-enhancement-brief-2026-11-15.md`
   is not on any branch of the repository, not on the build machine and not in Drive by its name; the Design chat's
   canvas (Version 26, the "15 Nov · task screens" page) cannot be opened from here. This landing was built from the
   scope and the DECIDED answers written out in the owner's message of 22 Nov, and in the look Landing 31 built from
   those boards. Anything the brief or the boards say beyond that message is not built — see "Not covered".
2. **Much of B1–B5 already existed** (comments, hand-over as "Delegate", checklist, board, Today's three, the streak).
   Each was checked on the code first, then extended to the decided rules. Nothing was built twice.

## In plain words — what is new

### B1 · Comments on tasks

- **One comment can be THE DECISION.** Any comment can be marked; it is then pinned in a card above the thread, with
  who marked it and when. Marking another comment moves the mark (there is never more than one); the mark can be taken
  off. Whoever may comment may mark; every mark is logged and has Undo.
- **A comment can link to the record it is about** — a partner, a project, an invoice or a discount code — as a chip
  under the words. One tap opens the record. A reader who may not see a linked record is told only "A linked record
  you cannot open": no name, no address.
- Comment, edit, delete and Undo were already there and are unchanged. The thread shows who wrote each comment and when.

The decision mark and the links work on every record that has comments (tasks, partners, achievements, notes) — they
are the same shared thread.

### B2 · @mentions

- Type **@** in the comment box and a list offers people — matched in English or Arabic — then partners, the task's
  projects, discount codes and invoices. Pick with a tap or with the arrow keys and Enter.
- A person picked is **mentioned**: their name in the comment is a link to them, and they are told.
- **A mention on a task is a handoff to help (decided):** the person becomes a **helper** — the task is under their
  **Helping** tab on Tasks and under Helping on My day. The Responsible does **not** change; only Hand over does that.
  A line under the box says so.
- A partner, project, code or invoice picked the same way becomes a link (B1).
- Someone who cannot see the task cannot be mentioned on it; the refusal names them.

### B3 · Hand over, and the deputy

- "Delegate" is now **Hand over**, and the task page's Details say **Responsible** (as the list's column already did).
- **A reason is required on every hand-over, 120 characters at most (decided).** With no reason the field turns red and
  says **"Give a reason. Every hand-over needs one."**; the button stays live; nothing is handed over. The box stops
  at 120 characters and counts them.
- **Only your own tasks (decided, rule O-3).** Hand over is offered to the task's Responsible and to nobody else. A
  manager, a head or an admin can no longer hand over — or take — a team member's task; the database refuses it
  whatever the screen shows. This is a change: before this landing a manager could.
- **The deputy (decided).** A task can name one deputy. The deputy has the task under Helping **and can act**: move
  its status, mark it done, tick its steps. The deputy cannot hand the task over and cannot edit it. The Responsible
  still owns the outcome.
- **Access.** A task can only go to someone who can see the task **and** the partner it belongs to.
- **History.** The task page lists every hand-over: who had it, who has it, when, by whom, and the reason.
- Giving several of your own tasks to one person (the list's bulk assign) asks the same reason.

### B4 · To-do lists

- **Steps** (the checklist): each step has its own done state and can carry a date — as before. New: **a step done is
  a dated record** — the row now says "Done 22 Nov 2026 · name". **Progress** shows on the task, on its list row and
  on its board card ("3 of 4 steps" with a small bar).
- **It feeds the achievement evidence:** an achievement logged from a task now shows, on its Evidence tab, the steps
  done on that task — what, which day, who. Nothing is copied; it follows the task.
- **Today's three** stays as Landing 35 left it (3 important + 3 short + 3 maintenance, from the person's own task
  lists, the rest below). Checked here, on a PC and on a phone, in English and Arabic: "From your own task lists",
  the **three source lines on the phone in the same words as the PC (decided)**, and the streak line.
- **The streak** is unchanged — see "Flagged" below for the one point to confirm.

### B5 · Views — board and list

- **Drag a card to another column and its status changes.** It is the same move the status pill makes, through the same
  door: Blocked and Cancelled ask their reason first, Done asks about open steps, every move has Undo. A mouse drags a
  card from anywhere on it; a finger drags it by the small grip on the card (44 px). While a card is carried the
  column under it is marked, the board scrolls sideways at its edges, and Escape puts the card back.
- The status pill's menu stays on every card: it is the way by keyboard.
- Only someone who may move a task's status can drag its card — its editor or its deputy.
- The columns are the team's real statuses from Settings, plus Blocked, with the count on each (Landing 35). The same
  five pill tabs and the same filters feed list and board; switching keeps tab, filters and place.
- **The calendar view was not touched.** It is still offered, exactly as it was. Reworking it is the next step.

### Wording

- "Partner", not "Client", on the task screens: one English line and one Arabic line still said client; both changed.
  ("Client ID" is untouched.)

## Database — forward-only, three migrations after `20261122120000`

| Migration                                               | What it does                                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261122130000_comment_decision_links_mentions`        | Comments can be the decision (one per record), carry links (typed columns: kind and id) and mentions; `api.comment_add` takes two more optional arguments; `api.comment_decide` marks and unmarks; the read serves all of it. A mention on a task adds the helper. |
| `20261122140000_task_hand_over_deputy_history`          | O-3, the required reason of 120 characters, the partner access check, the deputy (`api.task_deputy_set`), who may act, the hand-over history read, and the step total on the task row.                                                                             |
| `20261122150000_achievement_shows_its_tasks_done_steps` | The achievement read lists its task's done steps.                                                                                                                                                                                                                  |

No data is changed. No pushed migration was edited. `supabase/grants.expected` gains the four new grants
(api and inner function for each of `comment_decide` and `task_deputy_set`) and the two `comment_add` lines carry the
new arguments; `database.types.ts` is the generator's output (Supabase CLI 2.118.0).

**One real fault found and fixed on the way:** a team member handing over a task they had not created themselves was
refused at the last step (the note was written after the task had already left their hands). The reason is now
written first.

## Decisions taken while building (please confirm or overrule)

1. **Who may mark the decision:** whoever may comment on the record. (Not narrowed to the Responsible.)
2. **Live work always has a Responsible** (the database refuses a live task with none), so every change of hands on
   live work is a hand-over under O-3. Two things are not hand-overs and work as before: placing a **past-work** row
   that has no owner yet (manager, head, admin), and an admin moving a leaver's tasks when the person is switched off.
3. **O-3 applies to everyone, admins included,** and also stops "taking" someone's task for yourself.
4. **The deputy is one of the task's helpers,** marked as the deputy. The helpers list cannot remove them; changing
   or clearing the deputy is its own control.
5. **An invoice link opens the Finance page.** Finance has no address for one invoice today, so the chip names the
   invoice and opens Finance. A page per invoice would be Finance work — not built here.
6. **A project link opens the Tasks page filtered to that project** (projects have no page of their own).
7. **"Owner" is still the word in three older places** — the quick-add form, the list's Owner filter and the past-work
   paste (where "Owner" is also a column name people paste). Renaming those to "Responsible" is a wording pass of its
   own; say if you want it.
8. **Arabic written for this landing (not drawn — please review):** «اذكر السبب. كل تسليم يحتاج إلى سبب.», «تسليم»,
   «المسؤول», «النائب», «سجل التسليم», «القرار», «تحديده كقرار», «اجعل هذا هو القرار», «إزالة علامة القرار»,
   «ربط سجل», «سجل مرتبط لا يمكنك فتحه», «{n} من {n} خطوات», «أُنجزت …», «شريك محتمل».

## Flagged — not decided here (nothing was invented)

- **The streak's rule.** The decided rule reads "working days in a row with Today's three done; Friday and Saturday
  do not break it; a manager sees team streaks". What is live (Landing 34): a day counts when **three or more of the
  person's own tasks were finished that day** — any three, not specifically the ones shown in Today's three; Friday
  and Saturday are skipped; a manager sees their direct reports' streaks. Left as it is. Say if "done" must mean the
  very tasks shown.
- **Deal ID format.** No deal ID is drawn, and the app has projects, not deals; a project shows its own number
  (as today). No deal ID was invented.
- **"Away" date** — set by hand or taken from leave: not built either way.
- **Whole riyals or two decimals (M1):** untouched; the app shows what it showed before.
- **Received or Revenue:** untouched.
- **The Viewer role has no level on Tasks** in the roles as they stand, so a viewer sees no task and no thread. "Anyone
  with access can comment" therefore means admin, head, manager and team member today.

## Not covered by the message this was built from

- Anything in the brief file's benchmark tables beyond the points the message lists.
- Board details that only the canvas holds (exact card spacing, drag animation). The cards keep Landing 31/35's look.
- A reminder at a time of day (Q17), time blocks, calendar rework, mail / chat / files / meetings / notes: out of
  scope by the brief, not built.

## Tests

- **Database:** new `CMT-03` (decision, links, mention to helper), `DLG-02` (deputy, access, O-3), `STP-01` (steps and
  the achievement). `DLG-01`, `TSK-01` and `TSK-06` were **changed because the rule changed** (they had a head or a
  manager hand over a member's task, and hand-overs with no reason); each now asserts the decided rule, including the
  refusal. No test was loosened.
- **Unit:** two new files, 36 cases (the pinned decision, links, mentions, the "@" rule; hand-over, deputy, steps, the
  drop, the card). One older case moved from "note" to "reason".
- **Browser:** `landing-33-task-features.spec.ts` — six walks: B1+B2, B3, B4, B5, Arabic (PC and phone), and the roles.
- **Proofs that the tests can fail:** 19 new database plants, 16 unit plants, 7 browser plants
  (`tests/sabotage/landing-33.mjs`); nine older plants re-aimed at the same promise where their line moved.

## Verification — this landing's head

Run on the final tree, on this machine, before the push:

| Check                                   | Result                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Types (`tsc`)                           | clean                                                                         |
| Lint (`eslint`, no warnings allowed)    | clean                                                                         |
| Formatting (`prettier`)                 | clean                                                                         |
| House checks (`scripts/checks/run.mjs`) | 19 of 19 green                                                                |
| Registry and generated database types   | in step                                                                       |
| Unit tests                              | 241 files, 1,757 tests, all pass (was 239 / 1,721)                            |
| Database tests, fresh database          | 373 of 373 (was 370)                                                          |
| Production build                        | exit 0 (built for the browser run)                                            |
| Browser suite, whole, fresh database    | 591 passed, 10 skipped by design, 0 failed                                    |
| Sabotage — database                     | 574 plants, 0 failures (every one red as it must be)                          |
| Sabotage — unit                         | 754 plants, 0 failures                                                        |
| Sabotage — checks / lint                | 33 / 2 plants, 0 failures                                                     |
| Sabotage — browser                      | the 49 plants on the test files this landing touched: all red as they must be |

Two of this landing's own browser plants were wrong on the first sabotage run (one did not compile, one named the
wrong message); both were corrected and re-run red. The other 157 browser plants the change selects were not run on
this machine (hours of work); CI runs every one of them in its five shards.

**Task-features bar.** B1–B5 acceptance is walked in the browser by `landing-33-task-features.spec.ts`: on a PC
(1440) and a phone (390), in English and Arabic, as admin, head, manager, team member, viewer and no-role, through a
task's life (create, comment, decide, link, mention, hand over, deputy acts, steps, drag to another status). That an
achievement shows its task's done steps is proved by the database test `STP-01` and the unit tests, not by a browser
walk. **Look bar**, asserted in the same walks: no text under 12 px (thread, task page, board, My day; PC and phone;
Arabic too), no sideways scroll, the 44 px drag grip, right-to-left in Arabic (the first board column on the right).
Colours are the existing tokens only — the house checks refuse any other; contrast was not measured again here.

**Live:** the three migrations apply at the push. After CI: a read-only check that the new functions exist and the
Finance figures are unchanged, reported to the owner with this note.

## Next step

The **calendar view** as its own landing (it exists and was left exactly as it is).
