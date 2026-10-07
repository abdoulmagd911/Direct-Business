# Start here — Direct's Commercial app (v2)

**Read this first.** Updated **7 Oct 2026, 21:20 Riyadh** (18:20 UTC). This page replaces every older start page and
is written whole each time — nothing below is a patch on older text. Where it disagrees with any other Drive file, this
page wins; where it disagrees with `DECISIONS.md`, `DECISIONS.md` wins and this page is fixed.

**Where the files are.** The repository is public: <https://github.com/abdoulmagd911/Direct-Business>, branch
`v2/main`, folder `docs/v2/`. Any file opens as plain text at
`https://raw.githubusercontent.com/abdoulmagd911/Direct-Business/refs/heads/v2/main/<path>` — for example
<https://raw.githubusercontent.com/abdoulmagd911/Direct-Business/refs/heads/v2/main/docs/v2/DECISIONS.md>. If a session
cannot open web addresses, a Claude Code session can read them and answer for it.

## What this is

- **v2** is Direct's internal Commercial app, rebuilt from scratch in the `v2/` folder of this repository: clients and
  suppliers & partners, My day, Tasks, Past work and achievements now; KPIs, Pipeline, Finance, Reports and Appraisal
  later. Only Direct staff use it.
- **The old app** — everything else in this repository (`index.html`, `js/`, the root `CLAUDE.md`, `docs/DECISIONS.md`
  with its D- and M-numbers) — is retired. Its rules do not apply to v2, except the shell rules and guards in the root
  `CLAUDE.md`, which every session follows.
- **Live**: www.directksab2b.com, built from `v2/main`. Hosting and database are both named `direct-commercial`.

## Where things stand

- **Go-live is postponed (V609).** Day one is the date the owner sets after one combined test round (QA 1 on desktop,
  QA 2 at phone width, 7–8 Oct) and his go. Until then the team sees a preview the owner shows from his own account
  (`PREVIEW.md`, his checklist).
  Day one opens Clients (Suppliers as its tab), My day, Tasks, the Past work grid and achievements to the pilot group —
  a manager and three to five Commercial members, in English (V517, V605 (6)).
- **On production now** (`v2/main`): those screens, with Tasks as List, Board and Calendar, Escalate and the team's
  load (#181, #182), an owner picker for someone in no team (#179, #180), a My day note turned into an achievement
  (#175), and the fixes from the 7 Oct test round — Task out of the + for someone in no team, every browser tab named,
  the phone header (#188).
- **Production's database is behind by one change** (#183's, merged 7 Oct). A change made in production outside the
  repository on 6 Oct (another project's storage folder) stops the job that applies merged database changes. The fix
  is a small PR from builder A and waits for the owner's yes; until then no PR with a database change merges (#157 is
  next). Screens and docs keep merging.
- **Finance is being specified, not built into production yet**: the owner's money rules of 5 Oct are V610–V618 and
  spec §3.6 (read its first table); builder A builds the tables, the "what counts" view and the Payments export import
  on a branch; the owner answered Q46–Q48 on 7 Oct (V619–V621); Q49–Q51 stay open in `OPEN-QUESTIONS.md`.
- **Deferred, not dropped**: Finance and Payments, KPIs beyond achievements, Pipeline, Projects, Overview, Reports,
  Appraisal, Arabic (V517).
- **Next after day one**: Stage L — linked records, one file library, one comments feature (V534) — and the
  organisation as the home of its work (V606). The order and owners: `BUILD-PLAN.md`, "Pilot cut" and "Stage L".
- **Data in production is test data** until the go-live wipe, which runs only on the owner's word (V533,
  `GO-LIVE-RUNBOOK.md`).
- **What is in flight**: the open pull requests into `v2/main` on GitHub; the latest comments on each say who is on it
  and what it waits for.

## The ten rules that matter most

1. **No real data in this repository.** No real company, client or person data and no secrets, ever — it is public.
   Real data lives in the Drive knowledge base.
2. **Nobody pushes to `v2/main`.** A PR merges only when QA posts "cleared at `<sha>`" on a head that contains the
   latest `v2/main` and CI is green; the architect merges it (V600, V532). A docs-only PR skips the re-level (V604).
3. **One lane per session**, with its own branches and V-number range (V519; the table below).
4. **A screen change names its gate card** or is not merged (V508); a module opens only after its three-job phone test
   (V509) and sits behind its switch until then (V513).
5. **Nothing is deleted.** Records are archived and restorable; every change is logged and can be undone (V97, V128).
6. **Words, lists, stages and thresholds live in Settings**, not in code; new data gets real tables with row-level
   security and the change log (V97, V513).
7. **Sessions never touch the hosted databases.** The production job on `v2/main` applies each merge's migrations
   (V181); the repository's guards refuse the rest, and a refusal is never routed around.
8. **The owner does not wait.** Finished, tested work goes ahead on the recommendation; the oversight signs gate cards
   under his standing instruction; he keeps only passwords, the go-live word and his own account settings (V532).
9. **A feature earns its place**: it replaces manual work, goes live only once tested, and is reviewed after about four
   weeks — keep, move to Details, or archive (V607).
10. **To the owner: plain words, one clear next step, Riyadh time.** No tool call ever prompts him; anything needing his
    word goes to the oversight.

## Where the truth lives

| Subject | The one place (paths under the repository above) |
|---|---|
| Every rule, with its reason (newest wins; overruled text is struck and names what replaced it) | `docs/v2/DECISIONS.md` |
| How the app is built | `docs/v2/TECH-SPEC.md` |
| What is built next, by whom, tested how | `docs/v2/BUILD-PLAN.md` |
| The go-live steps | `docs/v2/GO-LIVE-RUNBOOK.md` |
| Screen briefs and their gate cards | `docs/v2/briefs/` |
| Questions still open for the owner | `docs/v2/OPEN-QUESTIONS.md` |
| Real names, figures, the team list, call findings | the Drive knowledge base — never this repository |
| The owner's original blueprint (history, not rules) | `docs/v2/BLUEPRINT.md` |
| The Drive's other numbered files (06, 08, 11, 20 …) | background; each carries a banner, and this page wins over them |

## Who does what

| Session | Lane | Branches | V-numbers |
|---|---|---|---|
| Oversight (Cowork) | Relays the owner, signs gate cards (V532), keeps the Drive | — | V400–V599 |
| Architect | Decisions, spec, plan; runs the merge train | `v2/architecture` | V600–V649 |
| Builder A | Database, server, CI | `v2/a-…` | V100–V199, V650–V699 |
| Builder B | Screens, the shell, the organisation pages | `v2/b-…` | V200–V269 |
| Builder C | Arabic, exports, the Past work grid | `v2/c-…` | V300–V369 |
| Builder D | The Tasks screens | `v2/d-…` | V270–V299 |
| Builder E | The achievements screens | `v2/e-…` | V370–V399 |
| QA 1, QA 2 | Review and clear PRs; never change app code | `v2/q-…` | — |

## How to continue

1. Read this page; then, for your subject, search `DECISIONS.md` for its words or V-numbers and read the plan's row
   for your step.
2. Open GitHub: the pull requests into `v2/main` and their latest comments show the queue and who holds what.
3. A new rule is the next V-number in your range, recorded in the same PR as the change.
4. Anything that needs the owner goes to the oversight, in plain words.

## Decisions since V519 (the newest are V609–V623)

V520 A contact's sides sort it, never hide it · V521 An MoU sets the side chosen on the achievement · V522 A banned
word for the consumer segment · V523 The Partnerships and improvements reports are monthly · V524 A note on a record
says who can see it · V525 Undo on money is parked with Finance's redesign (deferred) · V526 The Vision board joins the
later modules · V527 The Vision board is a read-only view over what is already recorded · V528 Ideas on My day · V529
The weekly nudge: the week's closed tasks become achievements in one tap · V530 Later: an e-mail forwarded into a note ·
V531 Every task and achievement carries an automatic number · V532 The owner does not wait · V533 Test data may be
entered in production until the wipe · V534 Linked records, one file library and one comments feature (Stage L) · V600
The merge train · V601 An MoU still sets Prospect, as a system act · V602 While production could not be rebuilt, a
merged migration only added (ended with the build of 3 Oct) · V603 A tender moved to Signed logs its Contract signed
achievement · V604 A docs-only PR merges without a re-level · V605 Task and Log achievement in the +; day one opens
Tasks, Past work and achievements · V606 The organisation is the home of its work · V607 A feature earns its place ·
V608 A docs-only merge does not make a code PR stale; the architect brings a cleared PR level on GitHub · V609
Go-live postponed, day one set by the owner · V610 A sale belongs to its created month and counts once fully paid ·
V611 Every paid transaction counts; cost 0 and Provisional until expenses are approved · V612 Commissions only through
Payments invoice lines · V613 A channel tag; individuals credited only when Commercial · V614 A tender at its signed
value, consumed by its transactions · V615 SAR as recorded; VAT never stored or shown · V616 A monthly tax invoice is a
link, except what it adds · V617 No wallet balance shown as money; two numbers, never one · V618 The Payments export
import is built first · V619 A tender's signed value is sales credit, revenue comes from its bookings · V620 A closed
month never changes · V621 Products with no supplier cost are a setting, Final at cost 0 · V622 The 2026 money is
imported, every row editable in the app, after a hand-entry round · V623 The fee on a monthly invoice is revenue.

## Coming next

This page becomes the entry to about ten subject files, each rule stated once in its current form; `DECISIONS.md`
becomes the dated history; the builders' build records move to a build log. V-numbers never change.
