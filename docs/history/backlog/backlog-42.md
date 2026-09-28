## 2026-09-09 — live hands-on test of www.directksab2b.com (owner's browser, signed in as admin)

**What was done.** Every page opened and used as an employee would, with the database checked
after each action rather than the screen believed: a real activity note written and removed, a
real lead created → quick-edited → deleted, every export captured inside the page (nothing
downloaded), the Share button pressed once, and the permission gates tried at the database door as
a team member (inside a rolled-back transaction — nothing changed). The full findings list is in
the project note "LIVE TEST — the whole system used by hand (Sep 9)"; this entry records what
landed in the repo and what is parked.

**Fixed here, in lane (js/16 `rReports` + `finCSV`, probe `probe-report-unrecorded-cost-rows`,
port 8748).** F2: the Report Builder grouped by client printed cost 0 and profit = revenue for
clients whose invoices carry no recorded cost (four real client groups, measured live — names and
amounts stay in the database, rule 7), while the Clients tab printed
"not recorded" / "unknown" for the same invoices. Round 36 had chosen one footnote under the table
over per-row words; the row was still the lie. Now: a row whose invoices ALL lack a cost prints
the words (group rows and sub-rows alike, marked `data-rb-unrec`); a row with some gaps keeps its
figure and wears the Clients tab's ⚠; the TOTAL keeps the raw arithmetic under the existing
upper-bound note; the rounding note skips a column that carries words. **The CSV is unchanged** — it still writes
0.00 and the whole revenue on such a row, because `probe-report-builder-attacks` pins every CSV
cell to the report's internals and went red the moment those two cells were left empty; that
probe is out of this lane. The honest file leaves the two cells empty: a decision for whoever
owns that probe, recorded here so the next change to the file is a choice. Sabotage (`_rbAllUnrec` → false) turned
checks 1 and 3 red; restored, marker count 0.

**Also fixed, in lane.** F1 (js/16 `rLedger`, probe `probe-ledger-empty-speaks`, port 8749): the
Ledger read "No transactions match." while it held nothing at all (all 33 rows soft-deleted on
21 Aug — verified). Three situations, three sentences now: the ledger is empty and not filtered;
every recorded row belongs to a standing-excluded partner; the filters hide the N that are
recorded — clear one to see them. The filtered sentence keeps "No transactions match." as its
first words because `probe-ledger-attacks` (out of lane) reads that exact string for its
stale-company case and it is still true there. Sabotage (override `_msg` after the chain — a
first attempt that broke the if/else syntax proved nothing, the page never loaded) turned five
lines red; restored. F3 (js/65 `renderCombinedPreview`, probe `probe-import-files-count`, port
8750): one file dropped read "Files dropped: 2 · recognized: 2" because the cost-join summary
(sigKey `expense_join`), a result the code builds itself, was counted as a file. The headline now
counts the person's files and names the join ("plus the cost join built from them"); the join
card is unchanged. Note learned writing the probe: each drop previews its own files — the earlier
file's capture lives on in the join, but its card does not; whether the headline should also say
"and 1 file from an earlier drop" is a fair question, not answered here. Sabotage (`_fileResults
= results`) turned two checks red; restored.

**Cycle-74 leftover, measured and closed without a change.** The four remaining `#finImpOut`
writes in js/16 (`finParse` ×2, `finCommit` ×2) sit on the legacy single-file path. Its only
callers: the "Check file" button's `onclick="finParse()"` (rewritten to `v65CheckFiles()` by
`v65WireImportPanel`, which runs on every `render()` and every `finGo()`), js/16's own
`#finFile.onchange` (replaced by js/65's), and js/41's wrapper of `finParse` (out of lane). None
survive the first paint of the Import tab, and `probe-import-tab-wiring` already holds the race.
Unreachable in practice; a guard there would protect a path nobody can take. Left as is.

**Out of lane, recorded for the owner's other sessions (Today / Leads / Clients / Ops / core).**
T1 "Open my queue" does nothing · T2 "1 quote to send" beside "My queue: all clear" · T3 empty
"Today · 9 Sept" card and the split "Recently visited" layout · T5 "never contacted" painted
before activity loads · L1 Lost 0 / 2 / 3 on one screen · L2 26 % conversion and 26-day
time-to-win with Won 0 · L5 "New this month" never counts a lead created in the app (no
created-date written) · L6 `stage` / `assigned_to` columns disagree with the record's own values
(new vs Prospect; empty vs Abdulrahman) · L7 the FUNNEL column shows the SOURCE when no funnel is
set · C1 two empty panels on the client card · C3 Assigned-to vs Account-manager disagree · O1
saved proposal's client shows "— pick a client —" · O4 business proposal rendered in the
flight-quote template · N1 deep links to /reports and /settings bounce to Today · N2 a page visit
triggers a cloud save · D1 create/delete forms still use native alert()/confirm() (freezes the
tab; the later chapters already use in-page confirms) · A2 no way to correct or remove a logged
activity · A4/AU2/AU3 audit rows name no record and speak in column names ("raw", "business_id")
· AU1 245 audit events, nearly all by "unknown" · AR1 Archive page lists 0 while 4 companies are
archived · SOP1 giant star icon on SOP 1 · EX1 "summary" and "full details" exports identical for
Leads/Clients · SH1 Share creates a permanent whole-workspace link on one click, no confirmation,
no list, no revoke.

**Money outside Finance (owner rulings of 21 Aug / M-rules), measured live.** C2 a tender value in SAR on a client card · OPS1 pipeline / margin / per-card SAR on the Operations board ·
EX2 the Clients CSV export carries a totalSAR column with seven amounts. All out of lane; recorded.

**Owner decisions, answered the same day.** S1 the QA admin account stays as it is, password in
`CLAUDE.md` included — owner ruling, do not re-raise. ACC1 anyone on the team may edit money —
owner ruling, every team member keeps finance = "editor". Share links: all four switched off and
the `share_links` policies replaced (`security_share_links_own_rows_only`: read own rows or
admin; insert only as a listed team member and as oneself; update/delete admin) — proven by
impersonation, the Share button keeps working; SH1 (one click, no confirm, no revoke screen)
stays open, js/10, out of lane. Practice data: the practice expense and the probe's payment
proof soft-deleted; the seven 13 Aug practice requests removed from `app_requests` (Operations
board now 0 / 0 / 0 SAR); the "live-check.pdf" attachment cleared from all five proposals (the
scheduled task's live checks had attached it to every one) — full copies of all 14 items in
`public.practice_cleanup_backup_20260909`. BR1 (Brand Hub public) — not answered, not pressed.

## Phase 3 release 1 — tasks and projects (2026-09-25)

**What:** the task manager's first release inside this app (D1, rule 8): the Tasks page (tasks, work
projects, a task's status / checklist / updates), "changes to your tasks" on Today (D7), and the Tasks
page in Team & Access with Own work choosable there. Database: `scripts/sql/phase3-r1-task-manager.sql`
(the design v1.2.4 + six corrections from the live check), rollback beside it.
**How it lands:** by pull request; the database script is applied at merge, after a live dry run in a
transaction that always rolls back. Nobody's grid changes except `tasks: full` for the 8 active
non-admins (measured before/after).
**Next releases (not built):** report registration + the Reports export and the move of the
browser-held achievements (the owner's Phase 3 ruling); KPI actuals and targets; the appraisal cycle;
the company card (client IDs, discount codes, files). The go-live people step (who is in which
department, the Commercial head) is run once at merge from the oversight chat's 29d — it names real
staff, so it is never committed here.

~~**Open question — "the clear doesn't take" (kept open until explained).**~~ **Explained and fixed 2026-09-26
(release 4, before building the company card).** Two layers — core-06 `v21TrapFocus` and core-08's `openModal`
wrapper — each moved the keyboard to the form's first control 30 ms after any form opened, **unconditionally**. On a
busy machine that timer lands after the person is already in a field: the keyboard jumped to the form's × button, and
the Delete they pressed went there, so the old value stayed (Enter or Space would even have closed the form). Measured:
in "Payment terms", 100 ms after opening, the keyboard was on `iconbtn`; select + Delete left "Net 30". Fix: both only
place the keyboard when it is not already inside the form; core-08 also stopped adding one more Tab-trap listener per
opening (7 openings had left 11). Guard: `probe-the-form-keeps-your-keyboard` (sabotage: the old code → 10 red). The
retype loop in `probe-the-card-shows-what-the-database-holds` is gone — it types once, as a person does.

## Phase 3 release 4 — the company card (2026-09-26, #46 — approved under P6 as restated 2026-09-26)

**What:** one card on a client's page (`js/113-company-card.js`) with the company's Direct Payments client IDs, its
discount codes and its files; database `scripts/sql/phase3-r4-company-card.sql` (+ rollback). Rules in DECISIONS D10.
**Tested:** Postgres harness 116/116 (8 new R4 attack tests: 3 open IDs, unique IDs, View changes nothing, money files
for managers in the table AND the store, the store takes a file once at its row's path, removed stays removed, codes
linked not written, everything in history, Direct's own assets keep their rule) — sabotage: 3 protections removed →
3 red; screen `probe-company-card` EN+AR (sabotage → red); a rolled-back LIVE run with a real team member and the
real manager (every rule held; rolled back and checked). **Found first and fixed:** "the clear doesn't take" (below).
**At merge:** apply the SQL from the merged commit (checksum-checked); live check with the QA account.
**Not in this release (say so if asked):** Own work on Clients is honoured by the database (the owner may change their
own company's card) but the Clients screen still treats Own as View, as it does everywhere today; the Generator's
company-assets page keeps its own rules; nothing on the Finance side reads the discount-code links (B2C, by rule).

## Go-live reset — its own release, run only on the owner's explicit go (owner's word, 2026-09-26; DECISIONS D9)

Everything in the app today is test data. After the build is finalised it is reset to zero and the correct data is
loaded fresh. Built and tested like any other release (a PR, a script + its checks, reviewed), and **run only when the
owner says go, on the day** — never on a schedule, never by a session deciding it is time.

1. **A written list, table by table, before any code:**
   - **wiped:** business records (companies/leads/clients, contacts, client profiles, requests, offers, bookings, the
     finance mirror and its links, discount-code rows), tasks and projects with their checklists/comments/files,
     achievements and report lines, proofs and company files (the storage objects too), history/logs
     (record_history, activity, access logs), and numbering back to 001 (document_counters, the TSK/PRJ and report
     counters);
   - **stays:** logins (auth + app_users), page levels, the team list and departments, KPI definitions (and the
     objectives they hang on), the service list and other lookups (statuses, priorities, work types, report
     categories, periods), settings.
2. **A full backup/export first, kept outside the database** (rule 7: never in this repo — Drive or local only), and
   checked restorable before anything is wiped.
3. **A dry run that rolls back** and reports, per table, how many rows would go and how many stay — reviewed before
   the real run.
4. **After the reset, data enters only through the importer and the Direct Payments sync** (the provenance rule) —
   no hand-loaded SQL rows, no snapshot restores over the fresh tables.

## Phase 3 release 3 — KPIs + the danger light (2026-09-26)

**What:** the Objectives & KPIs tab and a Today card draw the database's KPI figures and danger light (`js/112`); targets are
set by an admin or a manager with Full control on Reports (`scripts/sql/phase3-r3-kpis.sql`). Details: DECISIONS D1.
**Left for later:** targets for departments and people exist only once someone sets them (today there are 30 company/year
targets); 5 of the 30 KPIs are still drafts; KPI definitions are edited by SQL, not yet on screen; the appraisal cycle.

## Phase 3 release 2 — achievements + proofs (2026-09-26)

**What:** achievements move from each browser into the company database (`js/111`, `scripts/sql/phase3-r2-achievements.sql`),
with proofs, drafts from tasks, and a one-press move of what a browser still holds. Details: `docs/DECISIONS.md` D1.
**Left for later, on purpose:** the monthly/quarterly report *registration* (issuing a numbered report and locking the month —
the `reports` table exists, no screen issues one yet); removing a proof from the screen (the database supports it by
`deleted_at`); the KPI "actual" numbers typed by hand still live in the browser (they belong with the KPI actuals release);
KPI targets and the appraisal cycle. **Owner's word (2026-09-26, D9):** the old browser achievements and hand-typed KPI numbers are test data — nobody needs
to press "Move them", and release 3 does not move browser KPI numbers. The button stays, harmless.

**Explained and fixed — probe-two-people-one-record-are-told failed only under load (2026-09-25).** Not the
probe and not js/104: js/102 (the "a change never reached the server" notice) read its note only once the
person was signed in, so on a slow machine a save that failed in the page's first seconds was reported as
"the page was loaded again before it could be sent" — false, and a real person on a slow laptop could have
seen it too. That notice then sat where the probe's "no message" checks look. js/102 now reads the note
the moment the page starts and leaves this page's own failures for the next load.
`probe-a-refused-save-is-not-forgotten` check F holds it deterministically (red on the old file).
