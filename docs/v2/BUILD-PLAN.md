# v2 build plan — phases P3 to P7

Status: **draft for the oversight's review**, 28 Sep 2026. P1 was the blueprint (`BLUEPRINT.md`), P2 is this
architecture (`TECH-SPEC.md`, "the spec" below). This file cuts P3–P7 into PR-sized steps for two builders (P7, the imports, comes after go-live):

- **Builder A — data, server, tests:** migrations, `api.*` functions and views, the SQL suite, imports, CI, cloud setup.
- **Builder B — screens:** the design system, the shell, every page, the E2E suite, wording catalogs.

English first; every step is Arabic-ready (every string in `messages/en.json`, the same key present in
`messages/ar.json`, logical CSS only — spec §2.5). Arabic is switched on only in P6-7, after it is tested.

## How the two builders work together

- **Branches.** `v2/main` is v2's integration branch (P3-0 creates it). Each step is a branch `v2/a-<step>` or
  `v2/b-<step>` and one draft PR into `v2/main` (a step marked "2 PRs" is split where it says). The oversight reviews
  every PR before merge; once a kind of change is approved, a green run of the same kind merges without asking again
  (P6).
- **Folders** (spec §2.1): A owns `v2/supabase/**`, `v2/src/server/**`, `v2/src/modules/*/data.ts`,
  `v2/src/modules/*/module.ts`, `v2/tests/db/**`, `.github/workflows/v2.yml`; B owns `v2/src/app/**`, `v2/src/ui/**`,
  `v2/src/modules/*/screens/**`, `v2/messages/**`, `v2/tests/e2e/**`. A shared file (`v2/src/core/**`,
  `v2/package.json`) changes only in a PR titled `[shared]`, reviewed by the other builder.
- **Handing over.** A's step lands first with its `api.*` functions, generated types and SQL tests; B builds the screen
  against it (a B step lists the A step it needs). Where B must start earlier, B works against A's open branch and
  rebases when it merges.
- **Numbers that must not collide:** migrations are timestamped; v2 decision IDs V100–V199 (A), V200–V299 (B),
  V1–V99 (architect/oversight) in `docs/v2/DECISIONS.md`; local test ports 9300–9399 (A), 9400–9499 (B).
- **Every PR** meets the spec's definition of done (§9.4): its tests pass and were each seen to fail under a named
  sabotage; the SQL and unit suites pass on a database built from zero; E2E passes for the areas touched; the checks
  pass; nothing real is in the diff (rule 7).
- **Links to tables built later** (for example `audit.request.batch_id → io.batch`, `work.task_kpi → perf.kpi`,
  `perf.period_target.written_in_report_id → report.report`) are added by the later step's migration with
  `alter table … add constraint` (spec §3.0), so every step's migrations apply on a database built from zero.
- **Nothing costs money** and nothing touches the old app, its database or its Vercel project.

## Design tokens

The three themes (Light, Dark, Colorful), fonts and density are in `BLUEPRINT.md` §0 — the one home for their values.
The token **names** are fixed in the spec (§2.5: `--bg`, `--surface`, `--raised`, `--border`, `--border-strong`,
`--text`, `--muted`, `--accent`, `--accent-hover`, `--focus`, `--success`, `--warning`, `--danger`, `--info`,
`--drawer`).

> **Token table — to be added here by the oversight** (the full table per theme, including chart colours, status
> tints, focus ring and shadows). P3-3 implements whatever this section holds on the day it starts; until then it
> uses the blueprint's hexes.

The blueprint gives a `--drawer` colour only for Colorful; in Light and Dark the drawer uses `--surface` until the
token table says otherwise.

---

## P3 — Foundation

**Goal:** a person on the allow-list signs in (Google on the cloud project, a code locally), sees the shell with the
drawer built from the registry, and an admin manages people, access and settings; companies exist with their
identifiers; every change is logged and can be undone.

| Step | Who | Needs | Scope | Acceptance (all must pass) |
|---|---|---|---|---|
| **P3-0** Skeleton and CI | A | this spec merged | Create `v2/main` from the default branch; `v2/` Next.js + TypeScript (strict) + pnpm; ESLint/Prettier; Vitest; Playwright config; `.github/workflows/v2.yml` (path-filtered to `v2/**`); the checks of spec §9.1 as stubs that already fail on a planted violation; `docs/v2/DECISIONS.md` with the ID ranges | CI green on the empty app; each check goes red on its planted violation (one-client, no-table-writes, no-physical-CSS, no-hex, rule-7 scanner, forward-only migrations) |
| **P3-1** Database foundation (2 PRs) | A | P3-0 | Schemas; default privileges revoked; `core.level`, Riyadh date helpers, numbering; `audit.request/change`, `audit.capture/begin/end`; `core.department/team/role/person/page/capability`, levels, overrides; `core.setting_def/setting/wording`; the System and Import persons; `api.me()`; the SQL test runner (ported from `scripts/qa/phase3`: Supabase stubs, `as_user`, `raises`, per-test rollback) running on plain Postgres in the container **and** on the Supabase stack in CI; `supabase/grants.expected` | `GRANTS-*` (sabotage: grant execute to anon → red) · every table refuses direct writes with `permission denied` · `AUD-*`: only changed fields logged, no-op updates skipped, a write without a request is attributed to System, never a login · database builds from zero in CI |
| **P3-2** Cloud and sign-in | A | P3-1; for the cloud half only: Q1 answered, projects approved, Google client and Zoom app (Q3) | Sign-in first against the CI stack (needs nothing from the owner), then the cloud half: create Supabase `direct-commercial` and Vercel `direct-commercial` (spec §10); Auth: sign-ups off, **Google** (`.com`) and **Zoom** (`.net`) providers, email OTP (CI mail catcher; cloud once SMTP exists); `core.person_email`, `core.person_auth`, `core.sign_in_log` (spec §4); `@supabase/ssr` middleware; `(app)` layout gate calling `api.me()` before paint; server route that creates/bans auth users for the allow-list (service key server-side only); a plain sign-in page (B styles it in P3-3) | E2E (CI stack): an allowed email signs in with the code from the mail catcher; a listed-but-switched-off person is refused at once with the message; an unlisted email is refused; a signed-out deep link returns to the same address after sign-in; no content flashes before `me` is known · check: one Supabase client · on the cloud project a real `.com` account signs in with Google and a real `.net` account with Zoom (manual, recorded by the oversight): each lands on its one person, the Zoom email arrives verified and links to the pre-created user · a person with a `.com` and a `.net` email is one person whichever door they use · every attempt, allowed or refused, is in `core.sign_in_log` |
| **P3-3** Design system and shell (2 PRs) | B | P3-0 | `tokens.css` for Light/Dark/Colorful; self-hosted fonts; Tailwind v4 mapped to tokens; base components (Button, Input, Select, Dialog with its own form state, Confirm per D19, Toast with Undo, Chips with counts, DataTable 32 px virtualized, DetailPanel 480 px, DataState with its five states); drawer 232/56 with pin preference; top bar (Ctrl K, Create, bell, profile with theme switch); `dir="rtl"` switch in development; i18n with next-intl; styled sign-in page | `UI-*`: every component in 3 themes at 400 px and 1,500 px (screenshots reviewed); axe finds no serious issue; pseudo-Arabic RTL page has no physical-direction leak; Escape closes and returns focus (M93); Confirm has Cancel focused and names the item; lint refuses a hex colour and `ml-2` (sabotage) |
| **P3-4** Registry and access | A | P3-1 | `defineModule`, registry index, `pnpm registry:sync` (writes the page/capability/setting/role-default migration); `registry-in-sync` test; `authz.level/can/require/in_my_departments/reports_to`; rules: only an admin makes an admin, nobody changes their own access, a manager grants at most their own level; `api.access_*` | `ACC-base`: every rule above as allowed/refused pairs · a page added to a `module.ts` without syncing fails CI (sabotage) · levels of a switched-off person read as none |
| **P3-5** Settings framework and Organization & access | B | P3-2, P3-3, P3-4 | Generic setting forms from `setting_def` schemas (with reason and effective date); list-setting editor; People (add, their allowed emails, allow sign-in, switch off, manager, team, role; the sign-in log), Teams (retire with move-to), Roles, the access matrix (roles × pages/capabilities) and per-person overrides; Settings → Activity (change log, filters, Undo) | E2E: admin adds a person → that person signs in; switching them off signs them out on next request; a manager trying to make an admin sees the refusal in words; a changed default level shows in the person's drawer after reload; every change appears in Activity and undoes |
| **P3-6** Undo, concurrency, notifications | A | P3-1 | `api.undo` (per field, all-or-nothing, redo, names who/when); `version` checks with field-level merge; `notify.notification`, `api.notifications_*`, `audit.end` fan-out to owners | `UNDO-*`, `CONC-*`, `NTF-*`; sabotage "undo writes the whole row" → `UNDO-02` red |
| **P3-7** Commands, toasts, conflicts, bell | B | P3-3, P3-6 | `command()` wiring: toast with Undo, global refetch, typed errors in words; the conflict dialog (theirs / mine per field); the bell with Realtime on own notifications | E2E: two tabs edit different fields → both kept; same field → the second sees who changed it and chooses (FLOW-08) · Undo from the toast restores the screen · a refused command shows the level it needs |
| **P3-8** Companies data | A | P3-4, P3-6 | `company.*` (company, category, tier, contact, identifier with blocks and individual names, account-manager history, merge); `core.file`, `file_link`, storage bucket and policies, `api.file_*`; `core.note`, mentions; `norm.*` with `rebuild()` and `drift()`; `api.search` for companies and people | `NORM-*` (the folding table), `NORM-DRIFT` (sabotage: change `norm.fold` without `rebuild()` → CI check red) · `IDN-01…05` (one company per value, block list refuses a staff email and the test VAT shape, put back only while free, a value never moved in place, discount-code date overlap refused) · `MRG-*` merge moves everything and undoes as one request · files: another person's pending path refused; a restricted file refused to a team member |
| **P3-9** Companies screens | B | P3-5, P3-7, P3-8 | Companies list (chips, export); detail tabs Overview, Identifiers (add/remove/history), Files & contacts, notes with mentions; create company; merge dialog; account manager (Settings → Companies); Ctrl K finds companies by any identifier, Arabic spellings folded | E2E: create a company; add an Arabic name and find it by another spelling; a staff email refused with the reason; merge then Undo; export row count = list count (2,500 made-up rows, proving paging past 1,000) |

**P3 exit:** sign-in works on the cloud project; people, access, settings and companies are managed in the browser;
Undo works on every change; CI runs the full suite from zero with its sabotages.

---

## P4 — The money circuit (typed invoices)

**Goal:** the team can type every kind of Payments invoice quickly (owner decision 4); every invoice finds its company
or asks for a decision; every money figure (company card, Finance) comes from the ported rules and the finance finding
of 28 Sep (spec §3.6). Flows **FLOW-01** (up to the company card and the finance measures), **FLOW-03**, **FLOW-04**
and **FLOW-09** pass in SQL and in the browser.

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P4-1** Finance facts and `api.invoice_save` | A | P3-6, P3-8 | `finance.invoice` (kinds transaction, standalone, billing, credit note, wallet top-up), `invoice_line`, `billing_link`, `expense_line` (never on a billing invoice), `tax_invoice` (DPIN), `receipt`; `status_map`, `product`, `wallet_rule`, `commission_word`; match keys; `api.invoice_save` writing header, lines, expenses, links, DPIN and receipts in one request (`source 'manual'`), with version checks | `FIN-*`: every status word; Audit Required flagged; top-up detected from wallet lines; an expense on a billing invoice refused; a transaction linked to two billing invoices refused; one request = one undo restoring every part; no VAT column exists (check) |
| **P4-2** Money views, checks, Finance settings data | A | P4-1 | `finance.invoice_fact`, `invoice_cost` (approved, estimate ranking, **cost status Provisional/Final**), `money_row` (revenue units only), `money_service_row`, `credit_row`, `receivable`, `check`, `company_month`, `health`; services, item maps, item classes, exclusion rules (exclude/hide); `finance.revenue_definition`; measures `finance.revenue`, `commercial_revenue`, `margin`, `collected` | `D24-*` (income by service equals the revenue tile); `E-*` (exclusions win, apply to past rows at once, `hide` hides everywhere but Rules); `EST-*` (estimate only without approved cost, never for a commission); `CHK-*` (billing total = sum of its transactions; DPIN = total − approved expenses within 1 SAR; DPIN = 100 % on non-commission → "expenses missing"; Provisional → Final when the DPIN arrives); `COL-*` (collections on billing and standalone invoices; ageing; Voided never outstanding) · FLOW-09 (SQL) |
| **P4-3** Matching engine and credit | A | P4-2 | `finance.invoice_keys`, `company.match` (order from the setting, first level decides, conflict lists all), pins, `api.match_queue` and the decision functions; the "add this clue to the company" path used by the entry form; stress fixture generator; `PERF-MATCH` | `IDN-06…14` re-pointed at the live view · FLOW-01 (SQL, to the company card and the finance measures), FLOW-03, FLOW-04 (SQL) · performance budget of spec §3.13 met on the stress fixture (or the cache pattern with its drift test, in its own PR) |
| **P4-4** New invoice — the fast entry screen (2 PRs) | B | P4-1, P4-2, P4-3 | Finance → New invoice (spec §7): kind, header, customer with the live match, lines grid with paste from Payments, expenses grid, billing: pick transactions, DPIN, receipts; the live side panel (revenue, cost, cost status, checks, credited person); Save and new, Duplicate, keyboard-first | E2E: FLOW-01 and FLOW-09 typed entirely in the browser; a 10-line invoice pasted from a made-up Payments block in one go; a typed invoice for an unknown customer adds the clue to the chosen company and the next one matches by itself; timing: a practised person enters a 3-line transaction in under a minute (measured with the oversight) |
| **P4-5** Finance screens (2 PRs) | B | P4-2, P4-3 | Overview (tiles, months, income by service, "what is held back", failing checks); Invoices (every kind; chips Provisional, checks failing, no company) and the invoice detail; Collections; credit split dialog; Settings → Finance (services, products, item maps, item classes, exclusions, status words, revenue definition); company card Finance tab; Companies → Needs a decision | E2E: FLOW-03 and FLOW-04 in the browser; a failed read is never drawn as 0 (M27/M53); every Finance list exports its exact count |

**P4 exit:** flows 01 (money part), 03, 04 and 09 green in SQL and in the browser; performance budget met; the
team can type a month of made-up invoices on the staging project and the figures match a hand count.

---

## P5 — Work and performance

**Goal:** tasks are used daily; plans, KPIs and achievements make the circuit close. Flows **FLOW-02**, **FLOW-06**,
**FLOW-07** pass, and FLOW-01's My day step.

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P5-1** Projects and tasks data | A | P3-8 | `work.*`; `api` for create, update, assign (capability), helpers, action items, meeting notes with assigned items, Direct references, links, close (open action items asked about); `work.task_view` (stale, overdue), `work.my_work`; recurring templates and the `pg_cron` job; notifications (assigned, helper, mention); measures `work.tasks_on_time`, `action_items_on_time`, `weekly_updates`, `meeting_notes_on_time` | `TSK-*`: a team member cannot assign to someone else; a helper can tick only their own items; my work = owned ∪ assigned ∪ helping; stale after N days using a test clock; recurring generation runs twice and creates one task; measures return "not measured" when nothing was due |
| **P5-2** Tasks screens (2 PRs) | B | P5-1, P3-7 | List / Board / Calendar; quick add; detail (action items, timeline with mentions, links, references with their URLs, files, helpers); close flow offering "Log the achievement"; Settings → Work (statuses, priorities, templates, recurrence, no-update days) | E2E: a task's whole life; @mention reaches the bell; stale flag appears after the setting's days (test clock); the board and the list count the same tasks |
| **P5-3** Projects screens | B | P5-1 | Projects list and detail (linked invoices and their money, tasks, achievements, files, timeline); company card Work tab | E2E: link two invoices → project revenue equals their revenue; removing a link updates it |
| **P5-4** Plans, KPIs, achievements data (2 PRs) | A | P4-2, P5-1 | `perf.*`; `api.plan_copy`; KPI revisions and targets "as of"; categories, fields, mappings with conditions and dates; achievement API (fields validated against the category), `perf.achievement_line`; challenges; period targets with their tasks; measures `perf.achievements`, `perf.kpi_attainment`, `company.new_clients`, `finance.new_client_revenue`; `perf.kpi_*` views, `kpi_trace`, `kpi_sheet` | `KPI-*`: each source; sum/latest/average; cumulative pace and each status threshold; not measured ≠ 0; a target changed "effective 15 Sep" read as of 14 Sep returns the old one; a mapping condition keeps a promo-only partnership out of the integration KPI; money categories cannot feed money KPIs · FLOW-02, FLOW-06, FLOW-07 (SQL) |
| **P5-5** Plan & performance settings | B | P5-4, P3-5 | Plan editor: objectives, KPIs (revisions with effective dates), targets grid by month/quarter, leads and contributors, categories and their fields, mappings; copy a plan to next year | E2E: copy 2026 → 2027, rename and remove KPIs; 2026 screens unchanged |
| **P5-6** KPIs area (2 PRs) | B | P5-4, P5-5 | KPIs scorecard; KPI detail (by month and quarter, drill-down to achievements/invoices → company → evidence, readings, status notes, history); Achievements (list, detail, create: category first, then its fields); Challenges; KPI sheet export (template — Q15); company card Achievements tab and KPI contributions | E2E: FLOW-02, FLOW-06, FLOW-07 in the browser; the exported KPI sheet's figures equal the scorecard's |
| **P5-7** My day | A + B | P4-3, P5-1, P5-4 | `api.my_day()` (my work, my companies' new invoices and balances, my KPIs and pace); the page — the private "my appraisal" block is added in P6-4, once appraisals exist | E2E: FLOW-01's My day step for AM1; FLOW-03 moves the new invoice from AM1's My day to AM2's |

**P5 exit:** flows 01–04, 06, 07 and 08 green in the browser except their report and appraisal steps.

---

## P6 — Reports, appraisal, readiness

**Goal:** reports and appraisals close the circuit; every flow passes end to end, including Undo; the app is ready for
real data on the owner's word.

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P6-1** Reports data | A | P5-4 | `report.*`; templates and sections as settings; editors; lines citing achievements/invoices with the distinct-invoice amount; suggestions; issue (snapshot, hash, number); drift; correction and superseding; measure `report.on_time` | `RPT-*`: a snapshot never changes after issue (hash); drift lists exactly the changed figures; a correction gets `-C1` and supersedes; a line citing one invoice twice counts it once · FLOW-05 (SQL); report steps of FLOW-01/02 (SQL) |
| **P6-2** Reports screens (2 PRs) | B | P6-1 | Reports list; editor (sections in order, live content, lines editor, suggestions), preview, issue; issued view with drift and Correct; PDF and PPTX rendered from the snapshot (department templates — Q14); Settings → report sections and editors | E2E: FLOW-05; the monthly report shows challenges carried over with their age and next-month targets done/carried; two renderings of the same snapshot are identical |
| **P6-3** Appraisal data (2 PRs) | A | P5-4, P6-1 | `appraisal.*`; scales, points tables, templates tree; cycle opening freezes the tree; per-person targets; scores; `appraisal.item_score` roll-up; lock; visibility policy; `appraisal.legacy`; the one-time import — by a person, through the importer — of the online appraisal tool's export **handed over by the owner** (rule 8; kept in Drive or the scratchpad, never committed — rule 7), which **seeds the templates** (weights 70/25/5, grade scale, points tables, items — the tool wins over the Excel form, gaps filled from the form; owner decision 2) and loads past appraisals as legacy | `APR-*`: the official form's maths reproduced from a hand-computed made-up example (both weight conventions, points table, rating, lower-is-better, cap); only the person, evaluator, reporting line and admins can read; lock freezes every value · the seeded templates equal the tool's weights, bands and items, checked item by item · appraisal steps of FLOW-01/02/03 (SQL) |
| **P6-4** Appraisal screens | B | P6-3 | Settings: templates, scales, points tables, cycles; the appraisal form (as the official sheet), team view, sign-off, summary and grade; My day's private "my appraisal" block | E2E: appraisal steps of FLOW-01, 02, 03; a team member cannot open a colleague's appraisal by its address |
| **P6-5** Readiness | A | all above | Full sabotage run; performance budget; Supabase security advisor clean; grants snapshot; v2 `golive_reset` (backup first, owner's word only — D9); nightly consistency job (`norm.drift`, any cache drift); the importer source for the owner-provided appraisal-tool export (spec §3.10, §11) | every sabotage caught; every flow FLOW-01…09 green end to end including its Undo; reset rehearsed on staging and reversed from its backup |
| **P6-6** Every page, every theme | B | all above | A walk of every page in Light/Dark/Colorful at 400/1,500 px; empty/failed/no-access/not-measured states on each; keyboard only; export on every list | `UI-*` complete; `export-count` on every list |
| **P6-7** Arabic, when approved | B | P6-6; owner's Arabic wording (08 A1) | `ar.json` complete; RTL walk of every page; Gregorian dates and Western digits in Arabic (Q20); Arabic PDF/PPTX check; switch `app.arabic_enabled` on only after the owner approves | every page in Arabic has no English leftovers and no direction leak |
| **P6-8** Go-live | A + B + owner | P6-5; owner's go | Go-live = the code and structure proven working (owner decision 4): reset staging to production state (backup first, owner's word — D9), people and plan typed in, appraisal templates seeded; then the team **types the 2026 invoices** in the browser, which tests every person and flow as it goes; old app read-only | the owner's sign-off |

---

## P7 — Imports (after go-live)

**Goal:** the Payments files and pages fill the same tables the team types into, in any order, never touching a
hand-entered row (D21). Started only when the owner says so (decision 4: "import stays a later phase").

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P7-1** Import framework | A | P3-6 | `io.batch/chunk/held/held_ref`, `io.merge` (per-field export time, blank never wipes, older fills blanks, same file twice), batch undo; browser `core/import`: CSV 1 MB slices, Excel in a Web Worker (5,000-row posts), header recognition (BOM, spaces, `_ - . : ( ) /`, case), export time from the file name, dry-run preview, chunks ≤ 1,500 never splitting a group, resume | `IMP-*` on a made-up test source: any order gives the same result; newer wins per field; a blank never wipes; same SHA-256 → "already imported", nothing written; a chunk killed midway → re-drop finishes; undo refused while a later batch touched the rows · heartbeat test: a 250,000-row made-up CSV never blocks the page > 1.5 s |
| **P7-2** All-invoices import | A | P7-1 | `api.import_payments_invoices` with the exact column map (spec §3.11) into the same fact tables (`source 'import'`); billing links from `consolidated_proforma_id` where given, else the old subset-sum proposal for a person to tick; never touches a hand-entered row (D21) — differences listed, and a person may **adopt** a typed row so later imports keep it current (spec §3.6, Q30) | ported phase3 D1/D21/D26 tests; the same file twice writes nothing; a newer file wins per field; a hand-entered invoice with the same reference is listed, not changed |
| **P7-3** Cost imports | A | P7-2 | into the existing `finance.expense_line` and the new `finance.payments_fact`; the three cost sources (Transaction Expense, Expense Invoice, Revenue Report — expense total only); held references; `invoice_cost` switches to approved lines | `COST-01…11` ported · approved-only, empty never 0, a cancelled line removes its cost, the same file twice writes nothing, a 258,000-row made-up export imports within the heartbeat budget |
| **P7-4** Corporate clients and promo codes | A | P7-1, P4-3 | `finance.payments_client` (29 columns), `finance.promo_code` (13); derived client ID from a unique contact email; clients → identifiers (one import request: added / taken / refused / unmatched / conflicts), promo codes as suggestions | `CP-01…07` ported · running the clients import twice adds nothing · a staff email in the clients file never becomes an identifier |
| **P7-5** Payments page reader | A + B | P7-2 | Reads the invoice view's JSON (`history.state.page`: expenses, child DPIN, `consolidated_proforma_id`, `b2b_transaction_status`; expense report filtered by `invoice_id`) captured in-page by a person, 10–25 rows a page, never the sync export (DP1, DP2) | a captured page fills the same facts as typing them; nothing is fetched in bulk |
| **P7-6** Imports screens | B | P7-1…P7-5 | Finance → Imports: drop zone, recognised files, preview, progress, batches, held rows, Undo import; the clients → identifiers result screen; promo-code linking on the company card | E2E: drop the three cost files and the clients file in reverse order → the same totals as in order |

---

## Order at a glance

```
A: P3-0 → P3-1 → P3-4 → P3-6 → P3-8 → P4-1 → P4-2 → P4-3 → P5-1 → P5-4 → P6-1 → P6-3 → P6-5 → (go-live) → P7-1 → P7-2 → P7-3 → P7-4
          └─ P3-2 (local half at once; cloud half when the owner's approvals arrive) ─┘
B:        P3-3 ───────────→ P3-5 → P3-7 → P3-9 → P4-4 → P4-5 → P5-2 → P5-3 → P5-5 → P5-6 → P5-7 → P6-2 → P6-4 → P6-6 → P6-7 → (go-live) → P7-6
```

B starts with the design system while A lays the database; from P3-5 on, each B step follows the A step it needs.
