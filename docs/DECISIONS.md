# Decisions in force — the one file to check before acting

The rules binding on this project, one short paragraph each. Before any action that touches money display,
permissions, data provenance or how sessions work, read the rules for it here, and cite them by ID.

- **Full text.** Every rule's original wording — how it was found, the evidence, the tests — is kept word for word in
  `docs/history/decisions/`; its README says which piece holds which rule. Read it when a short entry is not enough.
- **Status** follows each title: `ACTIVE`, `SUSPENDED`, `OPEN — CONTESTED`, or `SUPERSEDED-BY <rule>` (kept as one
  line, so an old reference still lands somewhere). A rule that is unlearned is edited in place, never left standing.
- **Adding or changing a rule:** whoever learns it writes it here, in the same commit as the change that taught it —
  one short paragraph in the same shape, `**ID — title** STATUS · date. body`, the owner's words in double quotes,
  exactly as given; the long story goes in the commit, not here. Keep this file under 40,000 characters.
- **Checked on every battery run:** `check-decisions-wired` (every code citation of an ACTIVE rule exists and is
  called — P5) and `check-docs-moved` (every rule ID survived the 2026-09-27 cut, sizes, quotes word for word).

## Principles

**P1 — Between two working options, take the one that endures** ACTIVE · 2026-08-23. The owner: "So please make it a standard rule to go with the best option on the long run because I'm building something that lasts and endures, not just something to view or to brag about." Take the automatic, repeatable path; it breaks ties, never excuses skipping a check.

**P4 — Two writing sessions, one repo: ownership by file, not by judgement** ACTIVE · 2026-08-23. Each writing session owns the files it was given and names the owner of the rest. Back in force 2026-09-27 with a second builder, which has the docs restructure and C-lite; the main builder keeps everything that changes live and the Finance import. Both may add entries here; whoever merges second rebases.

**P6 — Once approved, always approved** ACTIVE · 2026-09-25. The owner: "Always allow anything you asked me for in this session or any other session so don't get back to me for them again as long as I'm allowed it once then you can have it all the time." Restated 2026-09-26: "Always approve all the previous requests". A session merges its own green PR; a new kind of action, or anything irreversible or deleting real data, still goes to the owner.

**P5 — A correct rule that nothing consults is not a rule** ACTIVE · 2026-08-23. The change that writes a standard also wires something to READ it and proves the reading happens.

## Owner decisions — the task manager, access levels, design, people, money rules (from 2026-09-25)

**D1 — Tasks, report registration, KPIs and appraisals are built inside this app** ACTIVE · 2026-09-25. Money there is read from Finance, never typed. Only admins, managers and the Commercial head assign work. Only an admin, or a manager with Full control on Reports, changes targets, KPI definitions, objectives and initiatives; no proof is stored for an issued month.

**D2 — Access is a level per person per page (No access, View, Own work, Full control), not a role** ACTIVE · 2026-09-25. The role only sets defaults. The database decides every write (`page_level(page)`); the screen draws its answer and fails closed while loading. Airlines, Suppliers, SOP & SLA are View or Full only; Finance keeps its role floors. Prove it by live attack tests, not by reading rules.

**D3 — Quality, Strategy and Integrity get View only on tasks, achievements and proofs** ACTIVE · 2026-09-25. A proof is optional. The task's owner or manager finalizes it and edits, adds or removes its proofs. Strategy and Integrity were retired as teams 2026-09-27.

**D4 — Screens follow Direct's corporate portal design, orange for the one main action** ACTIVE · 2026-09-25. One design file, `css/design.css`, loaded last by every page. DirectFont loads from assets.directksa.com, never copied here ("All rights reserved"), with Inter/Cairo behind it. The portal's inside is seen only in the owner's Drive snapshots.

**D5 — This app replaces the Executive CRM Dashboard once the new pages are done** ACTIVE · 2026-09-25. Learn from it and fix what went wrong there; there is no overlap to protect.

**D6 — Rule 0: this app fills gaps in Direct's official systems and never duplicates them** ACTIVE · 2026-09-25. See `docs/DIRECT_SYSTEMS_MAP.md`. D5 is no exception: the Executive CRM is retired, not copied beside a live original.

**D7 — Helpers, not locks: the owner is responsible, anyone can help, every change is undoable** ACTIVE · 2026-09-25. The owner ruled that "only the owner can edit" would make the work harder: everyone keeps Full control of Leads and Clients. Every change is in `record_history`; a record's owner is told on Today and may undo others' changes to it within 24 hours.

**D8 — The owner's logins: aboelmagd@ is the admin account and the one on the team list** ACTIVE · 2026-09-25. The owner: "`aboelmagd@directksa.com` is his admin account". a.hassan@directksa.net is the owner's Team-Member test view; ahmed.aboelmagd@directksa.net is another employee; business@ is the QA account (D13).

**D9 — "Everything in the app today is test data"; at go-live it is reset to zero and loaded fresh** ACTIVE · 2026-09-26. The owner's word. Data then enters only through the importer and the Direct Payments sync; no safety work is skipped because of it. The owner's "Reset now (approved)" ran 2026-09-27; the final reset runs only on the owner's go (`scripts/sql/golive-reset.sql`).

**D10 — The company card: client IDs, discount codes and company files** ACTIVE · 2026-09-26. Full control of Clients changes it; nothing copies Direct Payments (D6). A client ID is unique across companies (D16 lifted the cap of 3). Links and files are removed (kept on record), never re-pointed or deleted. Only managers and admins read IBAN letters and agreements, enforced in the database.

**D11 — People & teams: Commercial is the department and the teams sit inside it** ACTIVE · 2026-09-27. People change only through `person_save`, by an admin or a manager (D13); a user can only sign in and out. Nobody deletes a team; `team_retire(team, move_to)` first moves its open work and people. A task's team is chosen and must be active.

**D12 — A counted finished task becomes its achievement and follows the task** ACTIVE · 2026-09-27. `tasks_register_achievement` adds or withdraws it as 'count it' is ticked and copies later edits while the month is open; it refuses to reopen or untick a task whose achievement has proofs. Drafts are not counted. Guard `probe-tasks-to-achievements`.

**D13 — Every record is in the change log; managers edit people, logged; business@ is the QA account** ACTIVE · 2026-09-27. `record_history_write` logs who, when, before and after on every record table; only admins and managers read the log. A database-session change (SQL, import, seed, bulk edit) is logged as business@directksa.com. Only an admin makes an admin. Guard `probe-change-log`.

**D14 — Speed: one question one answer, one paint per redraw, scripts inlined at deploy** ACTIVE · 2026-09-27. js/01 shares an identical read for 0.8 s (never a failure, sign-in or 'who am I' read); any write forgets them. js/116 paints a redraw once. At deploy `scripts/build/build-site.mjs` inlines each js file as its own script; index.html keeps one line per file. Guard `probe-the-built-site-runs-the-same`.

**D16 — Money exclusions and company merges are typed by a person and applied by one view** ACTIVE · 2026-09-27. Owner-approved, on Finance → Rules; supersedes M14. An exclusion leaves out ONLY what is typed, with a reason; merges go only by typed client IDs, codes and customer names, never automatically; exclusion beats merge. `money_rows` feeds Finance, reports and KPIs; if unreadable, Finance shows no money. Outstanding is never revenue. Guard `probe-money-rules`.

**D17 — Only a person creates records in the live database** ACTIVE · 2026-09-27. The owner's standing rule: no business record, merge or exclusion is created live by code (no seeding, backfill, SQL insert or background pass). Test databases may seed made-up data; an approved cleanup or wipe is allowed, backed up first.

## Money & finance display

**M1 — Cost, profit and revenue stay clean: VAT never enters any of them** ACTIVE · 2026-08-08. The owner: "I dont care weither vat shows or not, what i want is a clean cost, profit, and revenue." VAT is stored (`vat_sar`) and may show where legally expected on a client document; no internal figure, export or total includes it. Guard `probe-no-vat-display`.

**MF1 — Cost = approved expenses only, never computed** ACTIVE · 2026-08-16. Per-invoice cost comes only from Direct Payments (M9–M17); `finance_expenses` rows never change an invoice's cost or profit. A missing cost is NULL and named on screen; zero-cost rows already stored are the owner's call.

**M9 — Real cost is final only when every contributing transaction is done** ACTIVE · 2026-08-23. Expense lines → transaction (a line's INVOICE # is the transaction's reference) → tax invoice; a blank EXPENSE STATUS means issued. One dirty transaction holds back the WHOLE invoice, never a partial sum. The join is `resolveExpenseJoin()`. Guard `probe-expense-report-capture`.

**M10 — A tax code alone never makes an invoice trusted; exclusion is by client, never by prefix** ACTIVE · 2026-08-24. `tax_invoice_capture` checks `finExclusionCheck()` on the existing row's client and never inserts. Code and total are trusted only with a real tax code AND a status other than Waiting for Issuing; else manual review.

**M11 — `window.v65IngestText(fileName, csvText)` is the durable way cost data gets in** ACTIVE · 2026-08-24. CSV text takes the file-drop path minus file reading, so every guard and the preview-then-commit flow apply.

**M12 — A tab-switch is not a global render(); a guard must hook both** ACTIVE · 2026-08-24. `window.finGo()` repaints Finance sub-tabs without `window.render()`. A legacy checker's rejection never reads as a verdict on the data. Guard `probe-import-tab-wiring`.

**M13 — A write report says only what the database confirmed; payloads come from an allowlist** ACTIVE · 2026-08-25. Build writes with `pickWritable()`, never a spread full row; `v65Commit()` counts what came back and on error says FAILED with the confirmed count. Guard `probe-false-success-commit`.

**M14 — A name-collapsing rule must be consulted live by every reader** SUPERSEDED-BY D16 · 2026-08-25. Names merge only when a person types them on Finance → Rules.

**M15 — Captured cost facts persist, so an updated file resolves against all that is known** ACTIVE · 2026-08-25. The owner: "so I do not have to import all the files, I just need to import the updates and it would spread it automatically." Facts live in `finance_expense_lines_capture` / `finance_expense_gate_capture`, loaded before a drop and written only on Confirm; a re-export replaces a transaction's lines.

**M16 — A commit is durable once it reaches the server** ACTIVE · 2026-08-25. One call to `fn_commit_finance_import` (SECURITY INVOKER, RLS applies) writes it all or nothing. Guard `probe-commit-survives-context-death`.

**M17 — The importer is proven only on the input people actually use** ACTIVE · 2026-08-26. Each importer or Finance-admin probe asserts at least once through the real `#finFile` multi-select or tab-switch, not only the text shortcut. Guard `probe-multi-file-single-drop`.

**M18 — One company, one record: duplicates merge by one audited, undoable call, never by deleting** ACTIVE · 2026-09-02. The owner: "find the fix for the future". `dupCandidates()` suggests pairs with the reason; `fn_merge_businesses` (admin/manager) moves all children, fills only empty fields, archives and logs. Archiving a duplicate is not a merge; the js/41 alias part is retired (D16).

**M19 — A company's people and history live in two places; every screen reads both** ACTIVE · 2026-09-02. `js/72-people-bridge.js` adds the contacts and activities tables to loaded companies; new writers write the TABLE, never raw. Guard `probe-people-bridge`.

**MF2 — Every name comparison folds Arabic letter variants the same way** ACTIVE · 2026-09-02. Reuse `norm()` (js/41) or `norm62()` (js/62): NFKC, أإآ→ا, ى→ي, ة→ه, no diacritics or tatweel; never bare lower-casing.

**MF3 — A probe that fails because the app changed on purpose is corrected, never deleted or left red** ACTIVE · 2026-09-02. Re-point it at the new rule. Probes needing staff logins or the live database are environmental, never counted green.

**MF4 — The invoice item split (Service Fee / 3rd Party Fee) is a VAT split, never real cost** SUPERSEDED-BY MF1 · 2026-08-22. Never resurrect 3rd Party Fee as cost.

**MF5 — Takamol and Techtic Support never appear anywhere** ACTIVE · 2026-08-23. The owner: "No takamol what so ever." It is verification revenue from another system; an import bringing it back is a BUG. Totals read through js/16's `live()`; the exclusion is a typed rule (D16).

**MF6 — A standing exclusion is not satisfied by loading the data and labelling it** SUPERSEDED-BY D16 · 2026-08-23. Caught rows are left out of every total by `money_rows`.

**MF7 — Wallet top-ups are never revenue** ACTIVE · undated. The importer skips them, as it skips verification services.

**MF8 — Never sum `finance_invoices` and `finance_transactions` in one total** ACTIVE · undated. Their money overlaps, so it double counts.

**MF9 — VOID is excluded from every total, everywhere, always** ACTIVE · 2026-08-22.

**MF10 — Only confirmed, fully paid tax invoices count as revenue** ACTIVE · 2026-08-22. Work done but not yet invoiced shows as its own Ready-vs-Pending split, never folded in early, never hidden.

**MF11 — Never fabricate a number to fill a data gap — leave it null and say why** ACTIVE · 2026-08-22.

## User-facing text

**UT1 — Help text may state a rule the user could break, never explain our architecture** ACTIVE · 2026-08-23. Cut spec words from screens; a sentence whose removal would let someone make a money mistake is rewritten shorter, not deleted.

## Data provenance — how data enters this app

**DP1 — Data comes from Direct Payments' export registry in-page, never hand-exported by the owner** ACTIVE · 2026-08-21. From `/en/admin/excel-exports`. A session without that browser access says so and routes the job to one that has it.

**DP2 — Never fire Direct Payments' sync export or request a large page from it** ACTIVE · 2026-08-23. The `?export=1` job and 100-row pages lock the whole browser session and every other request hangs. Page small (10–25 rows).

**DP3 — Business data enters through the app's own import path, never by direct SQL** ACTIVE · 2026-08-23. The importer applies exclusions, dedup and the preview; direct SQL skips them. If truly unavoidable, apply exclusions by hand and say why in the commit. D17 now bars code from creating business records live.

**DP4 — Real company, client or invoice data is never committed to this repo** ACTIVE · 2026-08-08. The repo is public and stays so (owner, 2026-08-29). In docs, describe an example's shape and point to where the value lives; real data goes to Google Drive or stays local.

**MF12 — One period state (`FIN.p`) drives every Overview/Clients number; nothing is stored per period** ACTIVE · 2026-08-11. Year, part and sector (derived at render) all pass `finInPeriod(r)`, so every tab and export scopes together; changing part words or sectors means updating `finCompPeriodOf()`.

**M20 — A hand-made table gets row-level security in the statement that creates it, backups too** ACTIVE · 2026-09-20. Without RLS it answers the publishable key with no login. Read `get_advisors(security)` in every sweep.

**M21 — Money documents live in private buckets behind expiring links** ACTIVE · 2026-09-20. payment-proofs, expenses and company-docs are read through `createSignedUrl(path, 600)`; check-structure refuses `getPublicUrl` on them. The proposals bucket is the owner's call.

**M22 — A no-sign-in function holds a bypass key only if what it can write is bounded** ACTIVE · 2026-09-20. Before trusting `verify_jwt = false`, bound its WRITES (manual-confirm: `trg_guard_manual_confirm`). Its no-login read half stays open until the owner decides.

**M23 — The battery cannot see the live project, so it gets its own by-hand checks** ACTIVE · 2026-09-20. Each sweep runs `scripts/qa/run-live-checks.sh` (M87): is what is served what was edited, what a no-login caller gets, and whether broken shapes exist in real data. Could not ask is not clean.

**M24 — A third party's personal contact detail never goes in the code** ACTIVE · 2026-09-20. A named person belongs on the supplier's `providers` record; every Saudi number in js/ is judged in `scripts/qa/phone-numbers-judged.txt`. Git history still holds it: the owner's call.

**M25 — The audit log is a copy of the records, so it obeys the same access rules** ACTIVE · 2026-09-20. Money rows of `record_history` need `can_see_page('finance')`; the log is for admins and managers only (D13). RLS refuses crafted inserts, keeping undo_change safe.

**M26 — A column the app reads back must also be a column the app can clear** ACTIVE · 2026-09-21. When `rowToApp` falls back to a column, `appToRow` writes null for an emptied field, or a deleted value returns. Guard `probe-the-card-shows-what-the-database-holds`.

**M27 — A read that FAILED is never drawn as a result that came back empty** ACTIVE · 2026-09-21. Never `rows = (r && r.data) || []`: say which read failed where the answer would be, and offer a retry. Money draws nothing, not zeros; no identifier is invented; none and unknown look different.

**M28 — A note we write about a third party never reaches a share link** ACTIVE · 2026-09-21. Ask who else can open a card before adding to it. For link holders, internal notes, logs, comments and exports stop at js/79 (`window.__isShareView`). Guard `probe-a-share-link-sees-no-internal-notes`.

**M29 — A share link gets only what it promises; the allow-list is written twice** ACTIVE · 2026-09-21. `share_view` and js/10 both keep only meta, schemaVersion and trimmed settings, so a new block is absent by default; either alone is a regression. Guard `probe-a-share-link-is-not-handed-the-settings`.

**M30 — When a value moves home, the old form that edits it is closed the same day** ACTIVE · 2026-09-21. A form that writes nowhere is worse than a gap; a migration ends when the old writer is shut or repointed.

**M31 — The sidebar is not built from the page list; 'no button' is a claim about every control** ACTIVE · 2026-09-21. A page in `VIEWS` gets no button: inject after core-08's rebuild and every render (js/18's pattern), hidden from those who may not open it. Search inside pages before calling one unreachable.

**M32 — A screen showing company numbers says when they are one person's private copy** ACTIVE · 2026-09-21. js/91 says above Reports which figures live only in this browser (`directReportsData_v1`); only a hand-typed KPI actual is left there. Guard `probe-reports-say-they-are-local`.

**M33 — A screen drawing from a copy says how far behind it is** ACTIVE · 2026-09-20. Airlines show app_state's 136 of the register's 139; js/92 names the gap and goes quiet when they agree. `bak_20260725` / `bak_20260805` are closed by missing grants, not RLS: check both.

**M34 — 'No date on file' is its own answer everywhere** ACTIVE · 2026-09-20. A null date is a third state, never coming or past; undated records keep their place and get their own filter tile. Before changing what a number counts, find what must add up to it.

**M35 — A money figure names the store it was counted from; a loader never caches an empty answer** ACTIVE · 2026-09-20. Today's Commercial Credit Pool counts `DB.invoices`, not the ledger; js/93 names the source and shows the ledger figure (no amount without Finance). Never cache an empty or failed result; retry, bounded.

**M36 — A page never reports a number in another system's name, and 'live' must be true** ACTIVE · 2026-09-20. Mirror pages say Direct is the system of record, and an empty mirror says so before any total (js/94). When two screens disagree about a connection, one is lying.

**M37 — A probe recording a hole must fail once it is fixed; reached-the-browser checks measure values** ACTIVE · 2026-09-20. Record an accepted hole as a note or a check holding the fix, never a passing assertion. Look for a value only the sender could supply, not key names or counts the app seeds.

**M38 — Every search over the same records shares ONE haystack; 'visible' is not offsetParent** ACTIVE · 2026-09-20. The top-bar box, Leads filter, Clients box and palette all call `recordHay` (core-01): add fields there, counting the surfaces first. A fixed overlay has `offsetParent === null` open or shut.

**M39 — An average says how many records it averaged; a card that drops rows says how many** ACTIVE · 2026-09-20. Count used in the label, dropped count explained once, silence when none dropped; a dash, not 0, when nothing is measurable. Guard `probe-the-average-says-what-it-averaged`.

**M40 — Retire a choice by marking it, never by deleting its word; a record holding it keeps it** ACTIVE · 2026-09-20. Keep the option, disabled and labelled as phasing out (enabled where a record holds it), never hidden; one list, `window.DT_PROVIDERS_PHASING_OUT`.

**M41 — A confidence score, a match, a risk score: if nothing measured it, do not print it** ACTIVE · 2026-09-20. Say what was derived, from where, and what was not read. A half-fixed fabrication is still one.

**M42 — The permission the owner sets is the one the screen applies; a withheld control says so** ACTIVE · 2026-09-20. Controls ask `mayEditPage`, never the role alone; withhold the write, never the read (Print / PDF, Copy stay). The database enforces levels on every page (D2); `mayEditPage` fails closed while loading.

**M43 — A registry value is never typed into a document; bilingual documents take both languages from it** ACTIVE · 2026-09-20. Footers read `company_identity` in the document's language (`S.cur.lang`), never the app's; if the registry is silent the line is left out, label and all.

**M44 — A client-facing document is not a data table: no browsing controls, every row shown** ACTIVE · 2026-09-21. js/04's pager skips document pages; document text uses `S.cur.lang`, never `fl()`. A guard must be able to fire: test with a table big enough for the pager.

**M45 — 'Today' counts from local midnight, never a rolling window** ACTIVE · 2026-09-21. Direct works at UTC+3. With nothing yet today in a non-empty log, say so rather than a bare 0; build fixtures from `Date.now()` at run time.

**M46 — A port a probe binds by offset is its own; a gate's success line says only what it examined** ACTIVE · 2026-09-21. The port gate expands offsets and reserves a block for computed ones, saying so; a probe may declare `PORTS_RESERVED: <lo>-<hi>`. New probes use the 9200+ band.

**M47 — A control offering a setting promises it works; where it does not, it says so in words** ACTIVE · 2026-09-21. Team & Access marks in visible text, never a tooltip, a View a page does not honour, from the one list in `js/52`. Since D2 every page honours View, so it marks none.

**M48 — M39 on the money page: what is held back is said out loud, split by reason** ACTIVE · 2026-09-21. js/99 says at the top of Finance how many rows are left out, split by whether a reason was recorded, and that they are still stored; silent when none. A total and its parts need separate checks.

**M49 — A cell that absorbs a tap must do something with it** ACTIVE · 2026-09-21. `js/100` makes the tick-box cell on Leads and Suppliers toggle its box (a cell holding more than the box is left alone). Measure the effective target, not the control. Guard `probe-a-tap-beside-the-tick-box-counts`.

**M50 — A probe that fights one of the app's own safety features is broken, not flaky** ACTIVE · 2026-09-21. Read the mechanism before out-waiting it. Empty in place and assert the precondition at action time. Guard `probe-export-menu-honest`.

**M51 — One browser workspace copy; a layer ships only once measured doing something new** ACTIVE · 2026-09-21. Only `directBusinessData_v29` holds the workspace. Measure the app with the new file removed before believing it fixed anything, and say whether a probe's numbers are mock or live. Guard `probe-one-workspace-copy-not-three`.

**M52 — A warning about missing data names the amount at stake, not only the row count** ACTIVE · 2026-09-21. Name the riyals and compute the share from the figures on screen. Guard `probe-the-cost-gap-says-how-much`.

**M53 — An RLS refusal arrives as HTTP 200 and an empty list, so 'no rows' alone is never a fact** ACTIVE · 2026-09-21. If a reader cannot tell 'none' from 'not yours to read', say both (Finance: `FIN.rows` empty after load); an empty period stays a true zero. Guard `probe-an-empty-answer-is-not-a-zero`.

**M54 — A translation map is keyed against the real data; a database identifier never reaches a screen** ACTIVE · 2026-09-21. Count the stored values first (case, coverage, separators). One helper, `actTypeLabel`, serves list and timeline: never two copies of a word list. Guard `probe-the-activity-words-match-the-data`.

**M55 — Never offer a choice the save cannot keep; restricting choices never changes what is shown** ACTIVE · 2026-09-21. Stage pickers offer only words passing `stageKeepable()`, yet a record's current word is always shown when the maps know it (`stageIsKnown()`). The stage list stays untouched. Guard `probe-a-stage-you-pick-is-the-stage-you-get`.

**M56 — When a short list stands in for a long one, sort by what the reader can still act on** ACTIVE · 2026-09-21. Today's renewals card (js/88) keeps its top-three cap, but the nearest item not yet lapsed takes the last place; nothing invented, nothing past the sixty-day window. Guard `probe-the-renewal-you-can-still-make`.

**M57 — A guard asks the app for the answer; it never keeps its own copy** ACTIVE · 2026-09-21. Ask the app (`pickableStages`, `finLive`), prefer inclusion to equality for words, and use a literal only when it is the assertion. When a rule changes, invert a wrong assertion explicitly, never delete it.

**M58 — A value is translated only when the app owns its vocabulary; a label always is** ACTIVE · 2026-09-22. A person's text is shown verbatim, even in a boolean-declared field; only exact yes/no tokens translate; a closed list with no Arabic in the data stays as stored. Guard `probe-the-lead-hover-card-speaks-arabic`.

**M59 — Sanitising is escaping, never deleting: a removed character renames a string and un-translates it** ACTIVE · 2026-09-22. Escape (`&amp;`), never strip. When one item of many stays English, look for what edits the string. Guard `probe-a-page-heading-is-never-english-in-arabic`.

**M60 — An average covers only what was measured and says how much; unmeasured is never zero or a gap** ACTIVE · 2026-09-22. Null ('—') when none is measured; say what it covers ('1 of 6 KPIs measured'). `rptPct()`'s 0 draws a bar; it is not a measurement. Guard `probe-a-kpi-nobody-measured-is-not-a-zero`.

**M61 — The local copy is not a recovery path; a refused save is remembered past a reload and told** ACTIVE · 2026-09-22. The badge says 'Not synced — in this tab only'; js/02 keeps the refusal in `db_unsent_v1` until a confirmed save and js/102 names the lost records once. Never replay it: it may overwrite a colleague's work. Guard `probe-a-refused-save-is-not-forgotten`.

**M62 — Text cached in the DOM for a redraw caches both languages or the key** ACTIVE · 2026-09-22. The funnel tabs carry `data-label-en` / `data-label-ar` and choose at redraw, so a count refresh cannot restore English. Guard `probe-the-funnel-chips-keep-their-language`.

**M63 — A verdict may not ignore what its own screen is showing** ACTIVE · 2026-09-22. A summary line answers for its page; where another layer decides what counts, ask that layer (js/14's `v57YourDay`). A genuinely calm day is still called calm. Guard `probe-today-does-not-say-calm-while-it-lists-work`.

**M64 — Arabic search folds both sides; a phone is the same number however written** ACTIVE · 2026-09-22. `searchFold` (core-01) folds alef forms, ة/ه, ى/ي, ؤ/ئ, harakat and digits in record and typed text alike; `phoneKey` strips 00, 966 and a leading zero on both sides. Guard `probe-arabic-spelling-finds-the-company`.

**M65 — Two controls asking the same question share the rule, the pool, the count and the state** ACTIVE · 2026-09-22. Leads' 'Needs attention' chip and button both ask js/09 (`leadAttnPool`); a control's count equals the rows its filter leaves. Guard `probe-one-needs-attention-not-two`.

**M66 — An exported date is recognised by its value, not its column name** ACTIVE · 2026-09-22. `exportFlat` (core-05) converts epochs anywhere, flattened cells included, but outside date-named columns only exactly 13 digits, so a phone or registration number never becomes a date. Guard `probe-a-date-in-the-file-is-a-date`.

**M67 — The Arabic dictionary matches whole strings exactly: each on-screen spelling needs its own entry** ACTIVE · 2026-09-22. Add the variant (e.g. KEY); never make js/21 case-insensitive. Translate app chrome only, never a record's own name; acronyms stay. Guard `probe-a-key-client-reads-arabic-too`.

**M68 — A control offering a choice must make one; if the choice is owned elsewhere, remove the control** ACTIVE · 2026-09-22. Hide it reversibly rather than build a second owner (page access belongs to Team & Access). A scroll-and-flash counts as nothing. Guard `probe-a-settings-button-does-what-it-says`.

**M69 — A stored status code is not the fact it is named after; a filter named for a fact computes it** ACTIVE · 2026-09-22. Events' 'No date' tile, option and count share `isUndated()` instead of reading `status`; ask the same of `needs_manual_confirmation` and any 'missing X' status. Guard `probe-no-date-means-no-date`.

**M70 — Client documents: facts from `company_identity`, colour from `brand/tokens.css`, never a literal** ACTIVE · 2026-09-23. A missing fact is left out, and an unloaded registry is said. Documents use #F06820, the app #F47A1F, marks #FF6C00; the three oranges are never unified. Guard `probe-a-document-carries-no-invented-facts`.

**M71 — A failed load is said where the number it spoiled is read, not only where its data would show** ACTIVE · 2026-09-23. With contacts refused, Leads and Clients show one line with 'Try again', gone once it loads. Check what the app actually requests before claiming a refusal was tested. Guard `probe-a-broken-contacts-load-says-so-on-the-list`.

**M72 — An access change asks first; before hardening a control, check whether the server already refuses it** ACTIVE · 2026-09-23. Switching off or re-levelling an account asks via `pfConfirm`. Own-row controls stay: the server refuses self-changes. Guard `probe-an-access-change-asks-first`.

**M73 — One Arabic word per thing: two answers to one English label match, or the reason is written down** ACTIVE · 2026-09-23. The word you click is the word you read. Legitimate pairs (gender, article, verb vs noun) are listed with reasons in the guard, which checks that list for rot. Guard `probe-one-arabic-word-per-thing`.

**M74 — A counter says what it counts when a reader could think it counts something else** ACTIVE · 2026-09-23. Archive's zeros count workspace drafts, so it points to Finance for deleted invoices, never a figure. Check that no later layer overwrites what you edit. Guard `probe-the-archive-says-what-its-zeros-count`.

**M75 — A column sorts by the text in its cells, collated in the language being read** ACTIVE · 2026-09-23. Rank text by its on-screen value; blank and dash-only cells last; ties broken. A renderer needing its cell's words asks `window.v27Word(en)`. Guard `probe-a-column-sorts-by-what-is-in-it`.

**M87 — A read policy granted to `public` admits people not signed in; the live checks run every sweep** ACTIVE · 2026-09-24. 'RLS enabled' is not closed: read the policy's roles (`record_history_read` is now `to authenticated`). Each sweep runs `scripts/qa/run-live-checks.sh` and logs the result, or says it did not.

**M86 — A sentence carrying a number is translated where built; a display translation never reaches an editor** ACTIVE · 2026-09-24. The Credit Pool texts choose their words in core-08. Registry `source` phrases get Arabic in js/66 for display only; the editor keeps the stored English. Guard `probe-settings-speaks-arabic-all-the-way-down`.

**M85 — An empty mirror page never says 'nothing from Direct' while the ledger holds invoices; it points there** ACTIVE · 2026-09-24. Invoices asks `finLive()`: a count and a button to Finance when rows exist, the old line when truly empty, nothing while loading. Bookings and Tickets keep their line. Guard `probe-an-empty-mirror-points-at-the-ledger`.

**M103 — On Activity a refused visit is decided by its action (`denied`), not its table; reset links are account events** ACTIVE · 2026-09-25. js/63's `isRefusal` decides; admin-sent reset-link rows show their own words and address. The field dictionary covers every field the live log records. Guard `probe-a-reset-link-is-not-a-refusal`.

**M102 — A filter chip keeps or drops rows from the table body, never hides them by style** ACTIVE · 2026-09-25. Otherwise js/04's pager miscounts. Chips go through core-09 `v26_3KeepRows`, which keeps the original rows. Guard `probe-a-chip-and-the-pager-agree`.

**M101 — A probe that crashes before it boots is revived, not excluded; tests carry no real registered identifier** ACTIVE · 2026-09-25. Name the crash, fix it and bring expectations up to today's app. Assert an absence without quoting the real numbers. Runner `scripts/generator-qa/run-all.sh`.

**M100 — A link built from a stored value goes through core-01's one builder (webHref, phoneE164, waHref, telHref)** ACTIVE · 2026-09-25. Never a copied expression. Saudi by default: leading 0 or bare 9 digits → +966, 00 → +; an existing + or 966 and an existing scheme are kept. Guard `probe-a-link-built-from-a-stored-value-works`.

**M99 — The question before a consequential act reads Arabic in Arabic, via js/21 and one wrapper on pfConfirm** ACTIVE · 2026-09-25. With it js/21 owns every class of words a person meets (M38, M91, M96–M99). Guard `probe-a-question-before-the-act-speaks-arabic`.

**M98 — Reports of what happened and the app's own prompts read Arabic via js/21; a failure shows as a failure** ACTIVE · 2026-09-25. js/21 holds the fixed heads and wraps v18Ask, pfPrompt and (late) alert; a head goes in the dictionary its path uses. A failure never wears a success tick. Guard `probe-a-report-speaks-arabic`.

**M97 — The notice after an action reads Arabic in Arabic, through one js/21 wrapper on the one toast function** ACTIVE · 2026-09-24. TOAST_AR, TOAST_HEAD_AR and patterns apply at display; callers never write their own English. An unknown toast text fails `probe-a-notice-speaks-arabic`.

**M96 — Hover (`title`) and screen-reader (`aria-label`) words follow the page language, owned by js/21's TITLE_AR** ACTIVE · 2026-09-24. No layer sets them in English itself. A control whose words change on a click speaks for itself and sets aria-pressed. Guard `probe-every-hover-word-speaks-arabic`.

**M95 — A share address is never rewritten; a layer needing the opening address reads `window.__bootPath`** ACTIVE · 2026-09-24. Never `location.pathname`, which js/03 rewrites; js/03 leaves a share view's address alone, so a slow boot or refresh keeps the token. Guard `probe-a-share-link-survives-a-slow-boot`.

**M94 — The signed-in person has one name on screen: every writer asks `displayName` / `shortName` (js/54)** ACTIVE · 2026-09-24. Nickname in the page language, else the Arabic name in Arabic, else the full name. The chip shows a nickname whole; its menu keeps the official name. Guard `probe-one-person-one-name`.

**M93 — Every app pop-up takes the keyboard: focus moves in, Escape closes and returns focus, and presses nothing** ACTIVE · 2026-09-24. js/44's profile menu, holding Sign out, closes only via `closeMenu`; small pop-ups slip past the Escape probe (over 300 px only). Guard `probe-the-profile-menu-takes-the-keyboard`.

**M92 — A people list that failed to load says so; one simply absent stays quiet; a failure is retried first** ACTIVE · 2026-09-25. js/33 retries a failed roster read ten times; if it stays failed, every people list gets a disabled warning first option (`teamRosterWarnOption()`), cleared by a later load. `teamRosterState()` tells the states apart. Guard `probe-a-failed-roster-says-so`.

**M91 — Every form is checked in Arabic; an unknown word goes once into js/21's list** ACTIVE · 2026-09-25. Labels into `V27_AR`, hints into `PLACEHOLDER_AR`; brand names, codes and format names stay as they are. Only the live count is a finding, not a source grep. Guard `probe-every-form-speaks-arabic`.

**M90 — People lists are the live roster, never a literal; a saved name outlives it; forms pick words where built** ACTIVE · 2026-09-25. Lists come from `teamList()` (js/33); 'Other' keeps its stored value. Where js/21 already has an Arabic for a word, that is the Arabic. Guard `probe-an-achievement-names-a-real-colleague`.

**M89 — A pressed filter chip gets a line beside it saying what it scoped and how each row was decided** ACTIVE · 2026-09-24. On Finance it counts the tiles' own rows and names each row's basis (`finSectorBasis()`), default included; the header keeps the ledger's count. Guard `probe-a-sector-chip-says-what-it-scoped`.

**M88 — A row laid out as a grid of fixed pixel columns needs a phone rule, in a class, never inline** ACTIVE · 2026-09-24. An inline style cannot carry a media query: use a class with a `max-width:640px` rule and measure at 400px and 1500px (`probe-audit-rows-read-on-a-phone`).

**M84 — What someone typed into a funnel form can be found by typing it into a search box** ACTIVE · 2026-09-24. `recordHay` (core-01) reads the funnel answers and the company's own phone, skipping booleans and objects. Guard `probe-a-funnel-answer-can-be-found`.

**M83 — A gap between money figures is named for what it is; the page never quotes a date it cannot read** ACTIVE · 2026-09-24. A gap of a riyal or more is named as the stored numbers disagreeing; only a true rounding gap gets the rounding sentence. Guard `probe-a-money-gap-is-named-for-what-it-is`.

**M82 — A record the app cannot read costs that record, not the list, and a shorter list says so** ACTIVE · 2026-09-24. The loader maps each row on its own; an unreadable one is skipped, counted and said. A value that is not a time shows nothing, never NaN (`fmtAgo`). Guard `probe-one-bad-record-costs-one-record`.

**M81 — Demo records are never shown as company data, and no verdict is given over records that did not arrive** ACTIVE · 2026-09-24. Until `window.__bizTableLoaded` is set, company lists show nothing and say why, and Today says "Today cannot be judged — your records have not loaded". A truly empty workspace is not told its data failed. Guard `probe-not-loaded-is-not-your-data`.

**M80 — A typed field follows the blob-wins rule, and a note is never allowed to be a date** ACTIVE · 2026-09-23. In `rowToApp` the next-action date and note keep the blob's value when the column is empty (M26); the date never falls back to the note text. Guard `probe-a-typed-next-action-survives-a-reload`.

**M79 — A value derived for display is marked with the value and stripped only while it still equals it** ACTIVE · 2026-09-23. The js/72 bridge derives lastContact; `stripBridged` removes it at save unless a person's edit changed it, so untouched rows are never rewritten. Guard `probe-a-logged-call-reaches-the-list`.

**M78 — A sweep is only as wide as its list, so the list is every route the app answers** ACTIVE · 2026-09-23. Take the routes from where the reachability diagnostic gets them, never from memory. A word used in several places lives in js/21's shared dictionary. Guard `probe-a-page-heading-is-never-english-in-arabic`.

**M77 — When two people had the same company open, the second one is told** ACTIVE · 2026-09-23. At save, `js/104-two-people-one-record.js` checks whether the company was written since this tab looked and, if so, names it and points to Undo; it never blocks or writes and is silent when nothing changed. Ids are `legacy_id || id`. A real merge is the owner's call. Guard `probe-two-people-one-record-are-told`.

**M76 — A refused page visit is not a change to a record; a page counting both says which is which** ACTIVE · 2026-09-23. Activity & Audit's tiles say how much of each count is refusals; nothing is deleted or hidden by default. Live drives as a restricted role write refusal rows: say so. Guard `probe-a-refused-visit-is-not-a-change`.

## Session & GitHub-push access — read before assuming a session can push

**S1 — Being able to fetch this repo does not mean a session can push to it** ACTIVE · 2026-08-27. A push needs a credential the proxy adds only for repos in the session's authorized set. A refused session stops retrying and hands its committed work to one that can push (S4).

**S2 — Once a push-capable session is reachable, hand it the local commits without waiting to be told** ACTIVE · 2026-08-27. The committed plan under CLAUDE.md rule 9 and step 1 of rule 10; not re-confirmed each time.

**S3 — Pushing by uploading files through GitHub's website, as a session's own fallback** SUPERSEDED-BY CLAUDE.md rule 10 · 2026-08-27. Never used without being asked.

**S4 — Commits stuck local: hand them to Claude Code; if unreachable, say so plainly; if still stuck, ask the owner** ACTIVE · 2026-08-29. CLAUDE.md rule 10. If Claude Code is unreachable, say "saved here, not live yet" and leave the commits local; never use a self-serve push without being asked.

**S5 — The owner asking ("Go live with whats ready") lets a non-pushing session use the browser-upload route** SUPERSEDED-BY CLAUDE.md brief §4 · 2026-09-03. Changes now land by reviewed PR from Claude Code.

**S6 — "don't push" is not "don't talk": hand-offs to another session never wait for the owner** ACTIVE · 2026-08-29. The owner, verbatim: "you have been doing so since the beginning!! what changed!!" Acting ON the repo (push, merge, rewriting history) needs that session's own push authority; talking TO another session is done the moment there is something to hand off.

## Code patterns that keep re-biting

**CP1 — A Supabase write without `.select()` reports success even when row-level security refused it** ACTIVE · 2026-08-22. Always chain `.select()` and check `r.data.length` before telling the user something was saved, deleted or restored.

**CP2 — A layer that adds a menu button names that button's page on the button itself** ACTIVE · 2026-09-27. The access pass in `js/52-v76-access-model.js` reads that name before any label. Test the menu over several seconds, through a redraw. Guard `probe-the-menu-keeps-its-pages`.

**CP3 — In a probe, Playwright's `waitForFunction` takes the timeout third** ACTIVE · 2026-09-27. Write `waitForFunction(fn, null, { timeout })`; passed second, the options become the page argument and the wait silently keeps the 30-second default.

**CP4 — is_client is two flags, not one** ACTIVE · undated. The `businesses.is_client` column and `raw->>'isClient'` must change together; the app reads both.

**CP5 — Every CSV or spreadsheet export passes its values through `csvGuard()` before writing** ACTIVE · 2026-08-22. Quoting does not stop formula injection: Excel still evaluates a cell starting with =, +, @, tab, CR or a non-numeric leading minus.

**CP6 — A password-length minimum equals the Supabase Auth policy's, via one shared constant (`MIN_PW`)** ACTIVE · 2026-08-23. Never a literal per screen: a screen checking 8 against a policy of 10 locked the owner out.

**CP7 — In QA probes, interaction checks click during load; content checks wait for the page to settle** ACTIVE · 2026-08-22. A settle-only probe never catches a mid-load freeze; an unsettled content check reports false empty tabs.

**CP8 — A call that needs a signed-in person waits for `window.__roleKnown===true`, never a stopwatch** ACTIVE · 2026-09-09. Retry on error; sign-in probes pause at typing speed (`scripts/qa/probe-employee-signin-shape.mjs`).

**CP9 — A layer that inserts into `#view` removes it itself; "no longer re-added" is not "removed"** ACTIVE · 2026-09-09. Pages that redraw in place keep what an earlier render left: insert with an id and remove it by id on every render where it does not belong.

**CP10 — Test as the role most people have (team_member), not only as the QA admin** ACTIVE · 2026-09-09. The QA account may be switched to team_member in `app_users` for a drive and switched back.
