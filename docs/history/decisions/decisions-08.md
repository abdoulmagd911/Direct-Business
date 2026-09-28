## Owner decisions of 2026-09-25 — the task manager, access levels, and design

Handed over by the owner's oversight chat ("All In" project) in the brief that opened the Claude
Code build session of 2026-09-25. D1 restates rule 8; D2–D6 are new. Every one is **ACTIVE**. Where
the brief stated a fact about today's app, the fact was measured before it was written here — the
measured figure is what stands, with the brief's wording noted where they differ.

**D1 — The task manager, report registration, KPIs and the appraisal cycle are built inside this
app** (rule 8, amended 24 Sep — unchanged). The shape agreed so far: **projects → tasks →
achievements → monthly report → KPI actuals**. Money on any of these pages is **read from Finance,
never typed** (M1, M35). A **company card** gathers a company's Direct client IDs, discount codes and
company files. One **Commercial head** (Othman Al Sharafi / Abu Yazan) sits over six departments —
Business, Partnership, Quality, Complaints, Strategy, Integrity. Only admins, managers and the head
assign work. An "open visibility" switch is ON for now (everyone signed in can see everyone's work).
The tested database design (v1.2.3, 85 attack tests) is held by the oversight chat and is handed
over at Phase 3 — it is not in this repo yet and nothing may be built from memory of it.
**Handed over 2026-09-25 as v1.2.4** (tasks follow D7: Full by default, the owner told; achievements
stricter; a colleague closing someone's task drafts the owner's achievement; Quality / Strategy /
Integrity View). **Checked against the live database before use** — `docs/PHASE3_SCHEMA_CHECK_2026-09-25.md`:
no name clashes, every column present; six differences found and corrected in release 1, each marked
`R1 CHANGE` in `scripts/sql/phase3-r1-task-manager.sql` (work numbers need Tasks, not the Generator;
the manager keeps the Generator; Tasks only in the grid — Reports waits for its own release; anon
cannot call the new functions; task history follows the Tasks page; Undo knows the task tables;
company owner through the live resolver; and — from the oversight's review — the discount-code guard checks
only this app's `services` column, so a Direct Payments import is never refused). Proven by the design's 87 tests plus 7 release-1 tests on a
local copy corrected to the live truth (`scripts/qa/phase3/run.sh`, 94/94; the 7 go red on the design
as written). **Release 1 screens:** `js/108-tasks.js` (the Tasks page) and
`js/109-changes-to-your-tasks.js` (Today), guarded by `scripts/qa/probe-tasks-page.mjs`.
**Owner's ruling (2026-09-25): Tasks only for release 1 — Reports comes with its own release.** Nobody's
Reports access changes until then; today's browser-held Reports page stays as it is.
**Release 2 (2026-09-26) — achievements + proofs, as built.** `scripts/sql/phase3-r2-achievements.sql`
(+ rollback): the Reports page levels land as the design wrote them — employees Own work, managers Full
control (measured live before/after: 8 people gain `reports`, 7 own + 1 full, no other page and no admin
moves; new people get it through `default_page_levels`); `report_entries.import_key` so moving a browser's
achievements in is safe to press twice; the private `proofs` store (proofs/<achievement>/<file>: seen by
anyone who can see Reports, added only by someone who may edit that achievement, never overwritten or
deleted). Screens: `js/111-achievements-in-the-database.js` fills core-10's list from the database (Overview,
Objectives and the exported report now count the company's achievements), logs/edits/deletes/finalizes
there, attaches and shows proofs, marks drafts from tasks with Finalize, and offers a one-press move of the
achievements a browser still holds (credited to the named person when the team list knows them, otherwise
"Logged for: <name>" kept in the text; the browser keeps its copy). The Tasks page gains "count it in the
monthly report" + its kind, which release 1's trigger turns into the achievement when the task closes. On
Reports, Own work now opens the controls (js/107: a page that knows whose work is whose); the database
decides which lines. What stays in the browser: only a KPI "actual" typed by hand on Objectives & KPIs (js/91
says so). Tests: `scripts/qa/phase3` R2-01..R2-04 (105/105; red without the file), `probe-achievements-in-
the-database` (10 checks, EN+AR; sabotage-tested), and the five older Reports probes moved onto the new form.
Live dry run (rolled back): a real employee added a proof to their own achievement; a colleague was refused.
**Release 3 (2026-09-26) — KPIs + the danger light, as built.** The calculation was already in the database since
release 1 (`kpi_actuals` — tasks, Finance money never typed, final achievements; `kpi_scorecard` — "not measured"
is NULL, never 0; `kpi_pace` — the light: achieved · on track · at risk · behind · missed · not measured · not
started, against how much of the period has passed on Riyadh's calendar). `js/112-kpis-and-the-danger-light.js`
draws it: the Objectives & KPIs tab by period (year / quarter / month) and scope (company / department / person),
with target, actual, share of target, the light, where the figure comes from, and a note when a Finance figure
includes invoices with no cost recorded; Today carries "Company KPIs off pace" for the current periods (drawn only
from a successful read). The Overview, the objective bars and the exported report take the same actuals and
targets (core-10 doors `__rptActualHook`, `__rptTabs`), so the page tells one story; the hand-typed "actual" box is
gone (the owner's word, D9: those numbers were test data, nothing is moved). `scripts/sql/phase3-r3-kpis.sql`
(+ rollback): targets and KPI definitions are changed only by an admin or a manager **with Full control on Reports**
(D2 — before, any manager could, even one on View). Tests: phase3 R3-01 (106/106; red without the file; the light
itself is the design's C08), `probe-kpis-and-the-danger-light` (sabotage-tested), and the two Reports probes that
set figures by hand moved onto the database's figures.
From the oversight's review of #41: the same rule now covers the plan the KPIs hang on — **objectives and
initiatives** are changed only by an admin or a manager with Full control on Reports (phase3 R3-02) — and release
2's condition is closed: **a proof file cannot be stored for an achievement whose month is issued**, refused by the
store itself (`scripts/sql/proofs-month-lock.sql` + rollback; the same test evidence_month_guard uses; phase3 R2-05).
*Date: 2026-09-25; release 2 2026-09-26; release 3 2026-09-26. Status: ACTIVE.*

**D2 — Access is a level per person per page, not a role.** Four levels:
- **No access** — the page does not appear, and a typed address bounces.
- **View** — sees everything on the page; may sort, filter, export and pull any report; changes
  nothing.
- **Own work** — full control over their own work on that page, and only their own.
- **Full control** — may change everyone's work on that page.

The role (admin / manager / employee — still three, no more) only sets the **starting defaults**;
an admin or manager adjusts per person. **Seeded from what each person can do today**, so nobody's
day changes until the owner changes it. This extends the Team & Access matrix of 2026-08-17
(Viewer/Editor → four levels) and replaces the earlier "viewer role" idea. Tasks and Reports join
the same matrix. **It is enforced by the database on every page, not by the screen alone** — M42
already records that on most pages today the screen IS the enforcement.
**Measured 2026-09-25, before this entry was written** (read-only: code + live policies + counts).
The brief said "View is enforced on 6 of 15 pages (`PAGES_VIEWER_ENFORCED` in js/52)". That list
(js/52:96) does name six — today, finance, settings, activity, archive, documents — but it
overstates both walls. **On screen**, View is honoured on four (today, finance, documents,
archive); settings and activity ignore it (Activity's Undo, js/63, never asks). **In the
database**, no page honours View fully: Finance comes closest (page-checked on six tables and on
reads; `finance_targets`, `finance_transactions`, `finance_cogs_expenses`, `payment_receipts`,
`promo_codes` check role only), Settings protects one row (`app_settings`) while the same settings
can still go through `save_state_patch`, which checks role only. The other nine pages ignore View
in both places. Hiding a page is screen-only: `ksa_events` accepts any signed-in writer, and the
shared `app_state` blob is written section by section on role alone. Also measured: the screen's
`mayEditPage` answers **yes while the grid is still loading** (js/52:71) — D2 must fail closed for
writes; an older second gate (`app_users.allowed_pages`, js/15) still runs beside `page_access`;
today only three levels exist (none / viewer / editor), **every one of the live grid entries is
editor**, the 3 admins sit outside the grid, the 1 manager has 10 pages and the 7 employees 4 each.
So "seed from today" means: editor → Full control, missing → No access, nobody on View or Own work.
**What D2 cannot do without moving data first:** Own work on Airlines, Suppliers and SOP & SLA
(whole-section saves in `app_state` — rule 8's "never new keys in `app_state`" points the same
way), and Own work anywhere while owners are stored as names (`assigned_to`, `account_manager`,
`created_by` are text) rather than account ids.
**The owner's rulings on the review (2026-09-25, same day):**
- **Airlines, Suppliers, SOP & SLA are View / Full control only** — shared reference lists, not
  anyone's own work. They stay in the shared block for now; no move to their tables in this build.
- **Projects, Bookings, Invoices, Tickets and Sync join the grid in the same pass** as the other
  pages (build once), rather than staying admin-only by omission.
- **Storage buckets, edge functions and triggers are in scope of D2** — the new pages keep their
  proofs in storage, so a file must obey the same level as the page it belongs to.
- **"Enforced by the database" is proven by live attack tests** — as an employee and as the
  manager, each sabotage-verified — never by reading the rules alone.
- **Order:** 1a one access check (four levels; seeded editor → Full; the screen fails closed while
  loading; the old js/15 gate retired; Team & Access shows four levels) → 1b the database learns the
  levels page by page, including owner **accounts** instead of names on Leads and Clients → 1c the
  design file → Phase 3 the new pages. **The Reports export is not a separate first step**: it is
  built with the new Reports pages in Phase 3, where exporting and moving the old browser data are
  one job.
- **Every phase lands by pull request, reviewed before it goes live.**
**Phase 1a as built (2026-09-25).** The one check is the database function **`page_level(page)`**
(`scripts/sql/phase1a-access-levels.sql`) — none / view / own / full, admins always full, a
switched-off account none, an unknown page none, Today never below view. The three older checks
(`page_access`, `can_see_page`, `can_edit_page`) keep their names and now answer through it, so every
existing row rule uses it unchanged; `can_edit_page` means **full only** — "own" writes nothing until a
page learns whose records are whose. The screen draws the database's own answer (`my_page_levels`,
loaded by js/56, applied by js/52's `pageLevel` / `mayEditPage`) and keeps no level rule of its own;
**`mayEditPage` fails closed while the answer is in flight** (it used to say yes), and the Generator's
six editors ask it rather than deciding for themselves. Grids change only through
**`set_page_levels`**, which refuses a manager raising anyone above the manager's own level, anyone
changing their own access or an admin's, and any page or level word it does not know, and logs every
change. A guard trigger refuses an unknown page or word even from the owner, and gives a NEW person —
or someone moving down from admin — their role's starting grid (before this, a new person had no
grid: the database gave them nothing while the screen showed them the employee pages). js/15's second
gate (`allowed_pages`, re-checked every 2 s) is retired. **The stored words are renamed**
(editor → full, viewer → view) **only after the 1a pull request is merged**
(`scripts/sql/phase1a-rename-levels.sql`), because the live screen reads the old words until then.
**Done 2026-09-25**, after PR #32 merged and the live site was confirmed serving it: 220 person × page
checks before and after, 0 differences; no old word left in any grid (39 stored levels, all new words).
Guards: `scripts/qa/access-levels-attacks.sql` (31 attacks as employee and manager in a transaction that
is always thrown away; sabotaged — `page_level` forced to full — it fails the ones that depend on it),
`scripts/qa/live-access-levels-drive.mjs` (the working copy against the live database, as admin,
manager and employee), and the battery probes updated for the four levels.
**Phase 1b as built (2026-09-25, database, all applied live).** **Every change the app can make now
answers to the level of the page it belongs to; reading stays open to every signed-in employee**
("reading is shared, writing is not", ROLES_AND_ACCESS 2026-08-13). Five migrations, each dry-run in
a discarded transaction, compared old-vs-new for every live person before applying, attacked live
as an employee and as the manager, and sabotaged (the check forced open) to prove the attacks can
fail — `scripts/sql/phase1b-{a..e}-*.sql`, each with a rollback, guarded by
`scripts/qa/access-levels-attacks-1b*.sql`:
- **A — tables and files by page:** Projects, Bookings, Invoices, Proposals, Operations, the
  Generator (tables, company-docs files, document numbers), Events (was open to any signed-in
  account, including an unapproved sign-up), the register tables, backups (adding and reading stay
  open — the one-time local-backup upload reads back what it wrote), Finance's leftovers.
- **B — the shared workspace (`app_state`):** `blob_section_pages` maps each section to its page; a
  section is written only with full control of its page. A save is never refused whole — held-back
  sections stay as stored and are logged ("Save held back"); the whole-blob fallback cannot delete a
  section. Before this any team member's browser could overwrite Airlines, Suppliers, SOPs, Settings
  or the company's bank details.
- **C — Undo** asks the record's page as well as the role.
- **D — a person added through Team → Add** gets their role's starting grid (admin-users creates
  the login before the role; a new employee would have opened Today only — reproduced live first).
- **E — Leads and Clients:** `businesses.owner_id` is the account behind the owner name, worked out
  by the database on every write (never taken from the caller), with `owner_name_preference` for the
  one shared name (the owner's primary address). Full control writes any company; Own work only the
  caller's, and cannot hand one away, claim one by id, or create one for somebody else; contacts,
  activities and client profiles follow their company. 91 companies got an owner; 20 clients stay
  unowned (owner's ruling).
**Role floors kept on purpose** (the old role rule was stricter than the grid, so lifting it would
GIVE powers): finance transactions, payment receipts and cost lines stay admin / manager /
operations; changing or deleting an expense or payment-proof file stays admin / manager; merging
companies stays admin / manager. Lifting any of these is the owner's call, one line each.
**Not done in 1b, on purpose:** the screens of Leads, Clients and eight other pages still show their
editing buttons to someone on View (Team & Access marks them "buttons still show"; the database
refuses the change); "Own work" is not yet choosable, because a company save goes in batches and one
refused company fails the batch — it opens on Leads and Clients once those pages stop offering
changes on other people's companies. The manual-confirm function (no sign-in, one flagged record)
and the gstest leftover (can only rewrite one fixed test page) were read and left alone.
**Screens done (2026-09-25, `js/107-view-means-view.js`):** on all fourteen pages that said "buttons
still show", someone on View is offered no change: the changing buttons are hidden, fields that write
are locked, a record opens read-only in the shared editor (no Save, no Delete, says why), and the
changing functions themselves refuse — all from mayEditPage, i.e. the database's answer. Where the
ROLE itself may not (a 'viewer' account, a share link) the refusal is js/49's box, so one refusal
never has two wordings. js/52's `PAGES_VIEWER_ENFORCED` names every page; Team & Access marks none.
Guarded by `scripts/qa/probe-view-means-view.mjs` (two sabotages). "Own work" is still not choosable.
*Date: 2026-09-25. Status: ACTIVE.*

**D7 — Helpers, not locks: the owner is responsible, anyone on the team can help, every change is
recorded, the owner is told, and it can be undone.** The owner's question and ruling, 2026-09-25:
the team each own their companies and clients but help each other, and "only the owner can edit"
would make the work harder. So on Leads and Clients everyone stays on **Full control** (as seeded);
ownership (`assigned_to` / `owner_id`) is **accountability** — whose job it is, "Mine", reminders,
later tasks, KPIs and appraisals — **not a lock**. What makes that safe is not a wall but a record:
every change to a company, its contacts and client profiles is in `record_history` with who, when,
before and after (activity notes live inside the company row, so they are recorded with it), the
owner is **told** on Today when someone else changed one of theirs, and Undo puts a change back
within 24 hours. "Own work" stays available as a tool (a new starter, a trainee, someone outside the
core team), not the default. Money stays stricter (D2's role floors on Finance).
**As built (2026-09-25).** "The owner is told" = the database function changes_to_my_companies
(`scripts/sql/d7-changes-to-my-companies.sql`, runs as the caller, so it shows nothing the caller
could not already read) drawn on Today by `js/106-changes-to-your-companies.js`: changes someone
else made in the last 7 days to a company whose owner account is you — the company, its contacts,
its client profile — naming who, which fields in words, how long ago, one click to open it (where
"Recent changes" offers Undo). No changes, or a failed read, draws nothing: the card never claims
"nothing changed". Guarded by `scripts/qa/probe-owner-is-told-of-changes.mjs` (sabotage: break the
row-id → app-id translation and the open-the-company check goes red). **What "recorded" covers,
measured:** the history trigger sits on businesses, contacts, client_profiles, finance_invoices and
finance_transactions. The separate `activities` table has none — but the app no longer writes it
(no code refers to it; its newest row is 2026-08-16; activity notes are saved inside the company
record and so are recorded with it). If anything ever writes `activities` again, give it the same
trigger in the same change.
**Owner's ruling, 2026-09-25 — the owner can undo others' changes to what they own.** Undo within
24 hours used to be open only to whoever made the change (or an admin/manager); the owner of a
company or a task was told but could not put it back. Now the owner can: `undo_change` treats the
caller as owner when the company's `owner_id` is them (and for its contacts, activities and client
profiles, the parent company's), or the task's / work project's owner is their team-list row (and
for a task's checklist, comments and links, the parent task's). The undo is recorded
(`undone_by`), same 24-hour window, and a third colleague who neither made the change nor owns the
record is still refused. An owner on View on that page still cannot undo (they need Own work or
Full control). `scripts/sql/d7-owner-can-undo.sql` (+ rollback), applied live 2026-09-25 after a
rolled-back live run with real ordinary employees: third colleague refused on company and task,
owner undid both, values back, `undone_by` = owner. Local harness U-01..U-03 (red without the rule).
*Date: 2026-09-25. Status: ACTIVE.*

**D3 — Quality, Strategy and Integrity have no control over tasks, achievements or proofs** — they
get View. A proof is optional. The task's owner, or whoever manages the task, finalizes it and
edits, adds or removes its proofs.
*Date: 2026-09-25. Status: ACTIVE.*

**D4 — The app's screens follow Direct's own web design**, taken from **both** directksa.com **and**
corporate.directksa.com — not only fonts and colours but buttons, clicks, filters, lists/tables and
views. Printed documents (proposals, profiles) keep their own print identity (Identity A in
`brand/IDENTITY.md`). **One design file, loaded by every page, with a probe proving it is loaded**
(P5). This supersedes `docs/DIRECT_SYSTEMS_MAP.md`'s "system fonts only" design cue and its "keep our
orange" line: the app follows the websites now. The corporate portal's inside is seen only through
the owner's Drive snapshots — never by signing in. The right to use Direct's own font is the owner's
to confirm.
**Measured 2026-09-25** (live sites, public pages only; the portal's inside from the owner's Drive
snapshots of its admin side). The two websites do **not** share one design: directksa.com's primary
is orange `#F86D0A` on warm greys (text `#524B45`); corporate.directksa.com's primary is a warm
**taupe** scale (`#FFFCFA → #5C4D42`, primary `#AB9A8E`) with orange `#FF6B00` only on its main
call-to-action — so "follow both" needs one written choice of which wins where. Both use
**DirectFont** (weights 100–800, full Arabic, served from `assets.directksa.com` with open
cross-site access); its own file says "All rights reserved" and marks embedding as restricted, so
the owner's confirmation of the right to use it is a real gate, not a formality. **Direct's
component library cannot be loaded by this app**: directksa.com/vendor/direct-web-components.es.js
refuses other sites (no cross-site header — tested in a browser), holds only the consumer header,
footer and services widgets (no buttons, inputs or tables), carries no licence or version and is
cached for two minutes. The durable route is to copy the measured values into our own design file.
The brief's "`brand/tokens.css` is loaded by nothing" is out of date: js/66 injects it on every page
since the F1 fix, but its values only apply inside `[data-identity=…]`, which the app shell never
sets — so it styles the document previews only. The app itself uses Google **Cairo** and
`--orange:#FF6B00` / `--ink:#303848` (a cool slate both sites avoid), with about 2,500 colour
literals and 2,300 inline styles across the layers.
**The owner's choice (2026-09-25):** the **corporate portal is the base** (its taupe surfaces,
warm-brown text, tables, filters and pagination); **orange is for the one main action on a
screen**; **DirectFont for both languages**. DirectFont **does not go live** until the owner brings
written OK from Direct's web/marketing team; until then the fallback is **Inter plus a licensed
Arabic face**. directksa.com is consulted only where the portal has no example.
**Phase 1c as built (2026-09-25), step 1.** The one design file is `css/design.css`, loaded by
index.html LAST (after every inline style block), so it wins without touching the older layers;
deleting that one line puts the old look back exactly. Step 1 carries: the portal's warm-brown text
(`#5C4D42`, muted `#827164`) in place of the old slate, its borders and cream table header with a
warm row hover, quiet warm outline buttons, **orange only on the main action** (`.btn.pri`) and on a
focused field, and the fonts — **Inter** for English and **Cairo** for Arabic (open licence, already
the app's font) until DirectFont's written OK arrives; then DirectFont goes first in the two font
lists in that file and nowhere else. Guarded by `scripts/qa/probe-design-file-on-every-page.mjs`
(every one of the 20 pages, both languages, reads what the browser computed; sabotage: delete the
link line → red on every page). Not yet in the file: filter pills, pagination, corner radii,
and the ~2,500 colour literals inside the layers — each moves into it in later steps, page by page.
**The owner's OK on DirectFont (2026-09-26)** replaces the gate above ("written OK from Direct's web/marketing team").
DirectFont goes live in its own small PR after #41: loaded from `assets.directksa.com` — **never copied into this
repo** (its file says "All rights reserved") — in the weights actually used, and put FIRST in the two font lists in
`css/design.css` and nowhere else; Inter (English) and Cairo (Arabic) stay behind it as the fallback, and a run with
that host blocked must still read Inter/Cairo with no broken text. **Live 2026-09-26 (#42).**
**Extended the same day (the oversight, after #43): the Generator's headings too, through `brand/tokens.css`.**
`--font-head` (DirectFont, then Cairo) on Identity A heads every generated document's h1–h4 in both languages, and
Identity C (the Generator's own screen) starts with DirectFont — the Arabic Generator was the one page still drawn in
Cairo. The PowerPoint exports name the same heading font, read from that file (`window.dgHeadFont`, js/66); body
text stays Cairo. **A .pptx names ONE font and cannot carry a fallback list**: on a computer without DirectFont,
PowerPoint picks its own stand-in (as it already did for Cairo, which standard Windows does not have either); the
Arabic stays joined because PowerPoint shapes it. The printed PDF has no such limit — Chrome embeds the font it drew,
DirectFont or Cairo. Guard: `probe-generator-fonts-in-exports`. Body text of the documents is unchanged (Identity A's
Proxima/Zarid lists, which the app does not load — so body text prints in the computer's own fonts; a separate
question for the owner, not decided here).
**Body text too (the owner's pick, 2026-09-26, after #44):** a document is DirectFont throughout, Cairo behind it —
Identity A's two lists in `brand/tokens.css`, and every document the app opens in a window of its own (the client
proposal, the service-fee and project PDFs, the report print, the invoice / booking / statement prints, the brand
offer page) loads `brand/doc-fonts.css` and waits for its fonts before printing. The Proxima Nova / Zarid Slab /
Inter / Tajawal requests that nothing ever loaded are gone from the documents (the brand guide pages keep their
specimens). The decks name DirectFont for body text as well. Guards: `probe-generator-fonts-in-exports`,
`probe-real-downloads`.
*Date: 2026-09-25; DirectFont OK 2026-09-26; Generator headings 2026-09-26; body text 2026-09-26. Status: ACTIVE.*

**D5 — The Executive CRM Dashboard will be replaced by this app** once the new pages are done. Learn
from it and fix what went wrong there; there is no overlap to protect.
*Date: 2026-09-25. Status: ACTIVE.*

**D6 — Rule 0 stands: this app fills gaps in Direct's official systems and never duplicates them**
(`docs/DIRECT_SYSTEMS_MAP.md`). D5 is not an exception: the Executive CRM is being retired, not
copied beside a live original.
*Date: 2026-09-25. Status: ACTIVE.*
Full measurements: `docs/PHASE0_REVIEW_2026-09-25.md`.

**D10 — The company card (Phase 3 release 4, 2026-09-26).** One card per client company, built on the existing
Clients page, with three parts; everyone with Full control of Clients changes it (D7), View only looks, every change is
in `record_history`, and nothing on it copies Direct Payments (D6):
- **Client IDs** are `client_profiles` rows (live since Phase 1): 1–3 **open** per company (a closed one is history and
  does not count — one company holds 2 open + 2 closed today), each Tender / Prepaid / Postpaid, **unique across
  companies** with spaces trimmed (" 95" is "95"), each a link OUT to Direct Payments. The limit is a database
  trigger with a per-company lock, so two people adding at once cannot both be the 3rd.
- **Discount codes** are optional B2C website codes, **linked** in `company_discount_codes` — the 200 `promo_codes`
  rows and `promo_codes_guard` are never written. One company per code at a time; a link is removed (kept on record),
  never re-pointed, never deleted. Nothing on the Finance side reads the links: a code is never B2B money.
- **Company files** (CR, VAT certificate, agreement, IBAN letter, business cards, other) live in the private bucket
  `company-docs` under `clients/<company>/<file id>/<name>`. The row is written first and names the path; the store
  then takes the file **once**, at exactly that path, from whoever wrote the row — no overwrite, no rename, no delete.
  A file is removed (kept on record), never re-pointed, and a removal is final (Undo does not bring it back).
- **The money rule (approved 2026-09-25): IBAN letters and agreements are readable by managers and admins only —
  enforced in the database** (the table's read rule AND the store's read rule), not only on screen. Anyone with Full
  control of Clients may add one; they then see it as "🔒 on file", counted by `company_documents_presence`, and cannot
  open it. Other files follow the Clients page level. The bucket's old rule ("any signed-in person reads everything in
  company-docs") no longer reaches `clients/…`; Direct's own assets there keep it.
*Date: 2026-09-26. Status: ACTIVE (approved under P6 as restated 2026-09-26).*

**D11 — People & teams (the owner's order of 26 Sep, part 2; built 2026-09-27).** The words are the Drive home page's
(§3): the DEPARTMENT is Commercial; a TEAM is a unit inside it — Business Development, Business Solutions, Partnerships,
Tenders, Quality, Complaints, Strategy, Integrity, in that order. In the tables a team is a `departments` row under the
Commercial row; a person's HOME team is `team_members.department_id`; the teams they ASSIST are `team_member_assists`;
"reports to" is `team_members.reports_to` (everyone → the head of Commercial for now). Rules, all in the database
(`scripts/sql/people-and-teams.sql`, attacked by `scripts/qa/phase3` PT-01..PT-08, A09, A32, T-02):
- **Teams are a setting**: an admin or a manager adds, renames or retires one; **nobody deletes a team** (no delete rule,
  and a trigger refuses even the database owner). A team with open work or people cannot be switched off directly —
  `team_retire(team, move_to)` moves its open tasks and projects and its people to the chosen team, ends assisting it,
  and leaves closed work where it was; a retired team can be brought back. The department itself is never retired.
- **People are changed only through `person_save`** (names in English and Arabic — first names required in both —
  home team, assisted teams, reports-to, job titles), by an admin or a manager; ~~a manager never changes an admin~~
  (SUPERSEDED-BY D13, 27 Sep: a manager may — it is logged, not refused). Role
  and page levels keep their own guarded paths (admin-users `set_role`, `set_page_levels`). **A user can only sign in and
  out**: no login row, team-list row, team or assist is theirs to write.
- **A task's / an achievement's team is CHOSEN** (the team the work is done for) and must be active; none given → the
  owner's home team. Reassigning a task keeps its team. (Before this, the team was always copied from the owner.) The
  pickers offer the person's home team first, then the teams they assist, then the rest (`teamOptionsHtml`, js/114).
- **The roster (`team_directory`) is readable by every active signed-in person** — found in the audit: switched to
  security_invoker, the view had shown non-admins only THEMSELVES in every people list. It is now a security_invoker view
  over the definer function `team_roster` (SQL), which answers only an active signed-in person and cannot be written through.
- The People & teams page (js/114) is a ROLE page (admins and managers), not a grid page: `mayOpenPage` in js/52 is the
  one answer for it: js/52 publishes its role pages (`__rolePages`) and js/64 answers a role page by `mayOpenPage`, every
  grid page by the grid list as before (js/64 had bounced a manager off People & teams). js/49 guards grid pages only and
  is unchanged — a first version routed it through `mayOpenPage` too, which bypassed the grid list the Finance probes set,
  and six of them went red on the full run; reverted the same day.
*Date: 2026-09-27. Status: ACTIVE (built on the owner's order; merges on the oversight's review, P6).*

**D12 — A task becomes its achievement the way the day goes (the owner's order of 26 Sep, part 3; 2026-09-27).**
The database turns a finished task that "counts in the monthly report" into its achievement
(`tasks_register_achievement`, now in `scripts/sql/tasks-to-achievements.sql`). Walked as an employee on 2026-09-27, it now
also: registers the achievement when "count it" is ticked on a task that is **already** done (it used to count only the
moment a task became done); withdraws it when "count it" is unticked; carries a later change of the task's title, kind,
KPI, company or team to its achievement **while the month is open** (an issued month's line stays as issued, and the task
can still be edited); refuses, in plain words, to reopen or untick a task whose achievement carries **proof files** (it
used to fail with a raw database error) — it stays counted, and a correction is recorded instead; and refuses to finish a
task on a date **no reporting month covers** (it used to finish with its achievement silently missing). On screen: the
Tasks page refreshes the Reports page's achievements and KPI figures as soon as a task is saved (they used to load once
per page load); a refused task save keeps the form open with what was typed; a task's owner, kind of work and company can
be changed after it is created; the list shows each task's team and filters by it; the database's refusals are said in
Arabic on an Arabic page. **What counts:** a DRAFT (a task closed by a helper, waiting for its owner or their manager, D7)
is listed with its Draft tag but left out of the Overview totals, the objectives, the KPI figures and the generated report
— `rptCounted()` in core-10; the database's own KPI figures already counted final lines only. Guarded by
`probe-tasks-to-achievements` (sabotage-tested) and the harness's TA-01..TA-04.
*Date: 2026-09-27. Status: ACTIVE (merges on the oversight's review, P6).*

**D13 — The change log on every record; managers edit people, logged; business@ is the QA account (owner decisions
(1)–(3) of 27 Sep, relayed by the oversight chat).** In the database (`scripts/sql/change-log-and-qa-account.sql`, attacked
by `scripts/qa/phase3` CL-01..CL-04, R1-03, PT-04; rollback beside it):
- **Every record table is logged** by the one trigger `record_history_write` — who, when, the whole row before and after.
  The log keeps each record's key as text (`record_key`): its `id`, else its primary key. (The old trigger cast `id` to a
  uuid; attached to the settings table, keyed by text, or to one of the sixteen tables with no `id`, it would have refused
  their saves — that is why the table list was short.) Not logged, on purpose: the logs themselves, the old whole-app blob
  (`app_state`, which has its own history), the document number counter, `share_links` (its secret token; last-used
  changes on every visit), the retired `app_*` tables and every backup/snapshot copy.
- **Field by field:** the view `record_changes` gives one row per changed field — who, when, field, before, after; a
  company's `raw` record is opened one level, so a change inside it reads `raw.stage`, not a blob.
- **Visible to admins and managers only, for now** — the log's read rule. The two "changes to your …" notices on Today (D7)
  still work for everyone: `changes_to_my_tasks` / `changes_to_my_companies` now run with their own rights and answer only
  about the caller's own tasks and companies; Undo was already its own function. (R1-03 used to assert that a task's owner
  and a View login read its history; rewritten to this rule.)
- **Who:** the signed-in person; a change from a database session (SQL, a migration, an import, seed or bulk edit run from
  outside the app) is the **QA account, business@directksa.com** (the database function `qa_user_id`); a service call with no person behind it
  (a sign-up, an edge function's own write) is "system". Every older log line that named nobody was backfilled to the QA
  account, so old data reads as QA-entered.
- **Managers may edit people and teams, an admin included** — `person_save` no longer refuses a manager on an admin; the
  login table's own history line records it. Unchanged on purpose: nobody changes their own page levels, and only an
  admin makes someone an admin (who holds power, not record editing).
- **business@ is the QA account**: renamed "QA Account" / «حساب ضمان الجودة», no nickname (it carried the owner's names and
  nickname, the same as aboelmagd@ — two accounts answering to one name); on the team list in Commercial. test@ stays the
  harness's sign-in ("QA Test Account").
- On screen (js/115, js/63): a **Change log** window — every change, newest first, each with its fields before → after (a
  creation folded) — from the company page's "Recent changes" card ("Full change log"), every Activity & Audit line
  ("Log"), a task's window, a person's Edit window and a team's Rename window; it opens on top, so nothing being typed is
  lost. For anyone else Activity & Audit says the log is for admins and managers, and the company page draws no "Recent
  changes" card (it would have read "No logged changes yet", which is false). Guarded by `probe-change-log` (sabotage-tested).
*Date: 2026-09-27. Status: ACTIVE (built on the owner's decisions; merges on the oversight's review, P6).*

