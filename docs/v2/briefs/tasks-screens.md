# Build brief · Builder D · The Tasks screens

From the Architect, 1 Oct 2026, on the owner's order relayed by the oversight (V519). Lane D: branches `v2/d-*`,
decisions numbered **270–299** in `docs/v2/DECISIONS.md` (its own section, "Builder D"). Read `docs/v2/BUILD-PLAN.md`
("How the sessions work together", "Pilot cut") and `TECH-SPEC.md` §3.7 and §9 before the first line of code.

## The goal

The pilot's stage 1 (V517, Sunday 18 Oct): a person sees and works their tasks on a phone and at a desk.

1. **The first PR — P5-2's first half, on P5-1's tables** (#140, builder A): the **Tasks list** (My work, owned,
   helping, team; chips status · due · partner · project), the **task record page** (V95 template: header, Overview ·
   Activity · Related · Action items, the rail), **quick add** (title, owner, due, partner or project — V464's default
   owner), **status** changes (the four locked meanings, V401; Blocked with its reason, V401), action items as the
   task's checklist (V438). Boards, the calendar and the Team load view are the second PR, after the pilot.
2. **The Past work grid on Tasks** — builder C's component (#105, `src/ui/grid`), tasks mode only, wired to
   `api.backfill_tasks` (#140). C owns the component; D mounts it and passes the props.
3. **The star and the due** (V514) where P5-1's tables carry them; the Today sort is P5-7's (A + B). The task's
**number** (V531) shows beside Happened on and the organisation in the list and the header — written by the app, never
typed.

**Behind its module switch**: until P3-17 lands, the page follows the registry's `built` flag and the person's page
level; when P3-17 lands, it reads `moduleOn('tasks')` (V513).

## Decisions to read first

V400 (the dates rule) · V401 (statuses, Blocked) · V438 (no subtasks; action items are the checklist) · V464 (default
owner) · V465 (person columns refuse a switched-off person) · V466 (client or internal work) · V491, V504, V506 (past
work) · V507 (the member's menu) · V508 (gate card) · V509 (the phone test) · V513 (switches) · V514 (star, due) ·
V517 (the pilot cut) · V519 (this lane) · V531 (the number) · builder A's V189–V196 (#140) for the doors' names and
refusals.

## The gate card — GC-3 (to be signed before the PR merges)

1. **Screen and spot:** Tasks (`/tasks`, `/tasks/[number]`), already in the member's menu (V507); no new menu item.
2. **Role, used weekly:** every Member and up, daily; asked by the owner (V517).
3. **What it replaces:** the BD Daily Tasks sheet and tasks kept in chat.
4. **Default state:** on for every role with Tasks; Boards and Calendar are not in this PR.
5. **Phone:** 390 px first; the three-job test's "see what is due today and tick one off" (V509) is its e2e.
6. **Words:** labels of at most two plain words; no new term.

## Tests (TECH-SPEC §9.4)

- Unit tests for every rule the screen applies; each with a sabotage in `tests/sabotage/tasks.mjs`, seen red.
- Browser (`tests/e2e/tasks*.spec.ts`) at 390 and 1,440 px: quick add → the list → the record → status to Done;
  Blocked needs its reason; a member sees only what V96 allows; no sideways scroll; the grid pastes 20 made-up rows
  as one request with one Undo. Made-up data only (rule 7).

## Files it may touch

`v2/src/app/(app)/tasks/**` · `v2/src/modules/tasks/**` (screen code; `module.ts` only for `built` and labels) ·
new components under `v2/src/ui/tasks/**` (a change to a shared kit piece goes to builder B) · `v2/messages/en.json`
(`pages.tasks.*` only; builder C writes the Arabic) · `v2/tests/unit/tasks/**` · `v2/tests/e2e/tasks*.spec.ts` ·
`v2/tests/sabotage/tasks.mjs` · `docs/v2/DECISIONS.md` (its own section). **Never:** migrations or SQL (builder A),
the shell and the drawer (builder B), `ar.json` (builder C), `.claude/**`, the old app.

## How it works with the others

- **Never push to a branch whose PR awaits QA or merge**; new work goes on a new `v2/d-*` branch. Fixes QA asks for
  go on the same branch.
- Build against #140 before it merges (stack on `v2/a-p5-1`, merge it in, never rebase); adjust when it lands.
- Each PR lists its V-numbers, "Gate card: GC-3", and "checked against DECISIONS.md at <commit>"; the architect merges
  when QA clears it (V517's merge train).
