# Build brief · Builder E · Achievements and the Past work link

From the Architect, 1 Oct 2026, on the owner's order relayed by the oversight (V519). Lane E: branches `v2/e-*`,
decisions numbered **370–399** in `docs/v2/DECISIONS.md` (its own section, "Builder E"). Read `docs/v2/BUILD-PLAN.md`
("How the sessions work together", "Pilot cut") and `TECH-SPEC.md` §3.8, §3.11 and §9 before the first line of code.

## The goal

Achievements become real records the owner and the team can load, including 2025 and 2026 past work (V491, V506).

1. **The data PR — the achievements part of P5-4**, as spec §3.8 names it: `perf.plan` (only the yearly rows the
   categories need — objectives, KPIs and readings stay builder A's), `perf.achievement_category` (sub-categories;
   admins edit in Settings), `perf.achievement`, `perf.achievement_ref` (evidence = a file or a Direct reference with
   its link — V99), `perf.achievement_participant`; RLS and audit triggers like every table; the doors to log, edit,
   remove (with reason) and list; **`api.backfill_achievements`** in the shape the grid sends (#105), with `source`,
   `date_from_report` (V504), owner Unknown (V491) and one Undo; the **deal value** on Contract signed and MoU (V505)
   and the MoU's **side**, chosen on it (V521), a newer report's value replacing an older one's with the history kept
   (V502, V500); the **number** `ACH-<Happened on year>-0042` from `core.next_number`, and `repeat_of` (V531).
2. **The screens PR — the achievements part of P5-6**: the list (category, person, month, Backfilled), the record page
   (V95 template), **Log achievement** from the + and from the record pages that offer it (V503's tender Signed comes
   later, with Pipeline); the **repeat check** on Log achievement (V531: same organisation and category in the last 12
   months, a similar title — This is a new one / Same as the earlier one, one tap, never blocking); the number beside
   Happened on and the organisation everywhere.
3. **The grid's achievements mode** — builder C's component (#105) wired to `api.backfill_achievements`, with the
   Value column (V502). C owns the component; E passes the props.

**Behind its module switch** (the KPIs module): until P3-17 lands, the registry's `built` flag and the page level;
then `moduleOn('kpis')` (V513).

## Decisions to read first

V68 (self-registration) · V99 (evidence) · V400 (dates) · V491, V502, V504, V506 (past work, newest report wins) ·
V500 (history) · V503, V505 (Contract signed, deal value) · V521 (the MoU's side) · V523 (monthly reports) · V531
(numbers and repeats) · V507–V509 · V513 · V515 (the appraisal reads these) · V517 · V519 · builder A's V189–V196
(#140) for the request, Undo and import-key patterns to copy.

## The gate card — GC-4 (to be signed before the screens PR merges)

1. **Screen and spot:** Achievements under KPIs (`/kpis/achievements`, `/kpis/achievements/<id>`) and Log achievement
   in the +; no new menu item.
2. **Role, used weekly:** every Member and up; asked by the owner (V506, V517).
3. **What it replaces:** the achievements tables in the monthly and quarterly reports, kept in sheets.
4. **Default state:** on for every role with KPIs; a Member logs their own.
5. **Phone:** Log achievement in three taps at 390 px.
6. **Words:** the categories' own names; labels of at most two plain words.

## Tests (TECH-SPEC §9.4)

- SQL tests for every door and rule (RLS per role, Backfilled marks, owner Unknown only on past work, one row per
  import key, the newer report's value with history, nothing dated before 1 Jan 2025); a sabotage for each, seen red.
- Browser: log an achievement with a reference; paste 20 made-up rows in the grid's achievements mode as one
  request with one Undo; a member sees only their own and their team's as V96 allows. Made-up data only (rule 7).

## Files it may touch

`v2/supabase/migrations/` (new files only, timestamped after the newest on `v2/main`) · `v2/supabase/tests/perf/**`
and its sabotages · `grants.expected` and `database.types.ts` (regenerated, on purpose) · `v2/src/modules/perf/**` ·
`v2/src/app/(app)/kpis/achievements/**` · `v2/messages/en.json` (`pages.achievements.*` only) ·
`v2/tests/unit/achievements/**` · `v2/tests/e2e/achievements*.spec.ts` · `docs/v2/DECISIONS.md` (its own section).
**Never:** builder A's other `perf.*` tables, an existing migration, the shell (builder B), `src/ui/grid` (builder
C), `ar.json`, `.claude/**`, the old app.

## How it works with the others

- **Never push to a branch whose PR awaits QA or merge**; new work goes on a new `v2/e-*` branch. Fixes QA asks for
  go on the same branch.
- Migrations merge in timestamp order: if builder A lands a newer migration first, re-stamp yours before merge.
- Each PR lists its V-numbers, the gate card (GC-4 for screens), and "checked against DECISIONS.md at <commit>"; the
  architect merges when QA clears it.
