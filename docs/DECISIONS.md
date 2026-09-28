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

**P1 — Between working options, take the one that endures** ACTIVE · 2026-08-23. The owner: "So please make it a standard rule to go with the best option on the long run because I'm building something that lasts and endures, not just something to view or to brag about." Prefer the automatic, repeatable path; never skip a check for it.

**P4 — Two writing sessions: ownership by file** ACTIVE · 2026-08-23. Each session owns its given files and names the owner of the rest. Since 2026-09-27 a second builder has the docs restructure and C-lite; the main one keeps live changes and the Finance import. Whoever merges second rebases.

**P6 — Once approved, always approved** ACTIVE · 2026-09-25. The owner: "Always allow anything you asked me for in this session or any other session so don't get back to me for them again as long as I'm allowed it once then you can have it all the time." Restated 2026-09-26: "Always approve all the previous requests". Sessions merge their own green PRs; new or irreversible actions still go to the owner.

**P5 — A correct rule that nothing consults is not a rule** ACTIVE · 2026-08-23. Whoever writes a standard also wires something to READ it and proves it is read.

## Owner decisions — the task manager, access levels, design, people, money rules (from 2026-09-25)

**D1 — Tasks, reports, KPIs and appraisals live in this app** ACTIVE · 2026-09-25. Money comes from Finance, never typed. Only admins, managers and the Commercial head assign work; only admins, or managers with Full control on Reports, change targets, KPIs, objectives and initiatives. Issued months take no proofs.

**D2 — Access is a level per person per page, not a role** ACTIVE · 2026-09-25. No access, View, Own work or Full control; roles only set defaults. The database decides writes (`page_level(page)`); screens fail closed while loading. Airlines, Suppliers, SOP & SLA: View or Full only; Finance keeps role floors. Proven by live attacks.

**D3 — Quality, Strategy, Integrity: View only on tasks, achievements, proofs** ACTIVE · 2026-09-25. Proofs are optional; the task's owner, or whoever manages the task, finalizes it and manages its proofs. Strategy and Integrity retired as teams 2026-09-27.

**D4 — Corporate-portal design; orange marks the main action** ACTIVE · 2026-09-25. One design file, `css/design.css`, loaded last. DirectFont loads from assets.directksa.com, never copied here ("All rights reserved"); Inter/Cairo behind it. Portal internals: the owner's Drive snapshots.

**D5 — This app replaces the Executive CRM Dashboard** ACTIVE · 2026-09-25. Once the new pages are done; fix what went wrong there.

**D6 — Rule 0: fill gaps in Direct's systems, never duplicate them** ACTIVE · 2026-09-25. See `docs/DIRECT_SYSTEMS_MAP.md`. D5 is no exception: the Executive CRM is retired, not copied.

**D7 — Helpers, not locks: every change is undoable** ACTIVE · 2026-09-25. The owner ruled against "only the owner can edit": all keep Full control of Leads and Clients. Changes go to `record_history`; a record's owner is told on Today and may undo them within 24 hours.

**D8 — The owner's admin and team-list account is aboelmagd@** ACTIVE · 2026-09-25. The owner: "`aboelmagd@directksa.com` is his admin account". a.hassan@directksa.net is the owner's Team-Member view; ahmed.aboelmagd@directksa.net is another employee; business@ is QA (D13).

**D9 — "Everything in the app today is test data"; reset at go-live** ACTIVE · 2026-09-26. The owner's word; no safety work is skipped because of it. After go-live, data enters only via the importer and the Direct Payments sync. "Reset now (approved)" ran 2026-09-27; the final reset waits for the owner's go.

**D10 — The company card: IDs, discount codes, files** ACTIVE · 2026-09-26. Full control of Clients edits it; nothing copies Direct Payments. Client IDs are unique across companies (D16). Links and files are removed, kept on record, never re-pointed. IBAN letters and agreements: managers and admins only (database).

**D11 — Commercial is the department; teams sit inside it** ACTIVE · 2026-09-27. People change only via `person_save`, by an admin or manager; a user can only sign in and out. Teams are never deleted: `team_retire(team, move_to)` moves open work and people first. A task's team must be chosen and active.

**D12 — A counted finished task becomes its achievement** ACTIVE · 2026-09-27. `tasks_register_achievement` adds or withdraws it as 'count it' is ticked, copying edits while the month is open; a task whose achievement has proofs cannot be reopened or unticked. Drafts don't count. Guard `probe-tasks-to-achievements`.

**D13 — All records change-logged; managers edit people; business@ is QA** ACTIVE · 2026-09-27. `record_history_write` logs who, when, before and after on every record table; only admins and managers read it. SQL, import, seed and bulk-edit changes log as business@directksa.com. Only an admin makes an admin. Guard `probe-change-log`.

**D14 — Speed: shared reads, one paint per redraw, inlined scripts** ACTIVE · 2026-09-27. js/01 shares identical reads for 0.8 s (not failures, sign-in or 'who am I'); a write clears them; js/116 paints once. `scripts/build/build-site.mjs` inlines js at deploy; index.html keeps one line per file. Guard `probe-the-built-site-runs-the-same`.

**D15 — Sign-in says what happened; the reset screen stays in the link's tab; 10 characters everywhere** ACTIVE · 2026-09-27. C-lite, approved by the owner (finding C). The reset screen opens only in the tab the link opened; admin-users refuses passwords under 10 characters and invents 10+; every sign-in failure is red, the email limit is named, "Forgot password?" never claims a link was sent; new-password screens count as you type. Per-person reset/invite and branded emails wait on an email sender (branch login-c). Function deployed at merge. Tested: probe-sign-in-says-what-happened.

**D16 — Exclusions and merges are typed by a person, applied by one view** ACTIVE · 2026-09-27. On Finance → Rules. An exclusion drops ONLY what is typed, with a reason; merges use only typed client IDs, codes and customer names; exclusion wins. `money_rows` feeds Finance, reports and KPIs; unreadable means no money shown. Outstanding is never revenue. Guard `probe-money-rules`.

**D17 — Only a person creates records in the live database** ACTIVE · 2026-09-27. No business record, merge or exclusion is created live by code (seed, backfill, SQL insert, background pass). Test databases may seed made-up data; approved cleanups and wipes are allowed, backed up first.

**D19 — Every delete or remove asks first, in the app's own box, naming the item; Cancel is the default** ACTIVE · 2026-09-28. The owner, as relayed: "every delete/remove of any item shows the app's own confirm dialog (Arabic/English) naming exactly what will be removed, with 'Delete' and 'Cancel', Cancel focused by default, and the action logged and undoable where possible." One shared box, `pfConfirm` (js/57); a box that cannot be drawn counts as No; no native `confirm()`. A row with nothing typed yet goes without a question. Guard `probe-d19-delete-asks`.

**D20 — Dates are Riyadh's calendar, everywhere** ACTIVE · 2026-09-28. A stored time is UTC; show its day with `dayRiyadh(time)` and today with `todayISO()` (js/core/core-01), whatever the PC's clock says; check-structure refuses a new UTC date cut. A plain calendar date is shown as stored.

**D21 — The money model and the invoice import** ACTIVE · 2026-09-28. Revenue = the invoice total as Payments records it, less only a wallet TOP-UP part; a top-up-only invoice never counts. Cost = approved expenses only; a missing cost is EMPTY, never 0, and the row stays out of cost and profit, said on screen. Fully Paid counts (Audit Required too, flagged); Pending, Void, Cancelled, Draft never; an unnamed status is held for a person. The paid date sets the month. Imports fill, never wipe; a hand-entered row is never touched; no VAT figure is worked out or stored. Guard `probe-d1-invoice-import`.

**D23 — With no approved expense, the pass-through lines are a flagged cost estimate** ACTIVE · 2026-09-28. Owner ruling. `money_rows.est_cost_sar`, shown apart from the approved cost; an approved expense replaces it. Names on Finance → Rules. Guard `probe-d1-invoice-import`.

## Money & finance display

**M1 — VAT never enters cost, profit or revenue** ACTIVE · 2026-08-08. The owner: "I dont care weither vat shows or not, what i want is a clean cost, profit, and revenue." Shown only where legally expected on a client document, never in an internal figure, export or total; since D21 the import works out and stores no VAT figure. Guard `probe-no-vat-display`.

**MF1 — Cost = approved expenses only, never computed** ACTIVE · 2026-08-16. Per-invoice cost comes only from Direct Payments (M9–M17); `finance_expenses` never changes it or profit. A missing cost is NULL, named on screen; stored zeros are the owner's call.

**M9 — Cost is final only when all its transactions are done** ACTIVE · 2026-08-23. Expense lines → transaction (the line's INVOICE # is its reference) → tax invoice; a blank EXPENSE STATUS means issued. One dirty transaction holds back the WHOLE invoice. Join: `resolveExpenseJoin()`. Guard `probe-expense-report-capture`.

**M10 — A tax code alone never makes an invoice trusted** ACTIVE · 2026-08-24. `tax_invoice_capture` checks `finExclusionCheck()` on the row's client (not a prefix) and never inserts. Trust code and total only with a real tax code AND a status other than Waiting for Issuing; else manual review.

**M11 — Durable cost import: `window.v65IngestText(fileName, csvText)`** ACTIVE · 2026-08-24. CSV text takes the file-drop path minus file reading, so every guard and the preview-then-commit flow apply.

**M12 — A tab-switch is not a render(); a guard hooks both** ACTIVE · 2026-08-24. `window.finGo()` repaints Finance sub-tabs without `window.render()`. A legacy checker's rejection is no verdict on the data. Guard `probe-import-tab-wiring`.

**M13 — A write report says only what the database confirmed** ACTIVE · 2026-08-25. Payloads come from `pickWritable()`, never a spread full row; `v65Commit()` counts what came back and on error says FAILED with the confirmed count. Guard `probe-false-success-commit`.

**M14 — Name-collapsing rules consulted live by every reader** SUPERSEDED-BY D16 · 2026-08-25. Names merge only when a person types them on Finance → Rules.

**M15 — Captured cost facts persist; updates resolve against them** ACTIVE · 2026-08-25. The owner: "so I do not have to import all the files, I just need to import the updates and it would spread it automatically." Kept in `finance_expense_lines_capture` / `_gate_capture`, written only on Confirm; a re-export replaces a transaction's lines.

**M16 — A commit is durable once it reaches the server** ACTIVE · 2026-08-25. One call to `fn_commit_finance_import` (SECURITY INVOKER, RLS applies) writes all or nothing. Guard `probe-commit-survives-context-death`.

**M17 — Prove the importer on the input people actually use** ACTIVE · 2026-08-26. Importer and Finance-admin probes assert at least once through the real `#finFile` multi-select or tab-switch. Guard `probe-multi-file-single-drop`.

**M18 — Duplicates merge by one audited, undoable call, never by deleting** ACTIVE · 2026-09-02. The owner: "find the fix for the future". `dupCandidates()` suggests pairs and why; `fn_merge_businesses` (admin/manager) moves children, fills only empty fields, archives, logs. Archiving alone is no merge; aliases: D16.

**M19 — Screens read people and history from both places** ACTIVE · 2026-09-02. `js/72-people-bridge.js` adds the contacts and activities tables to loaded companies; new writers write the TABLE, never raw. Guard `probe-people-bridge`.

**MF2 — Name comparisons fold Arabic letter variants alike** ACTIVE · 2026-09-02. Reuse `norm()` (js/41) or `norm62()` (js/62): NFKC, أإآ→ا, ى→ي, ة→ه, no diacritics or tatweel; never bare lower-casing.

**MF3 — A probe broken on purpose is fixed, not deleted or left red** ACTIVE · 2026-09-02. Re-point it at the new rule. Probes needing staff logins or the live database are environmental, never counted green.

**MF4 — Service Fee / 3rd Party Fee is a VAT split, not cost** SUPERSEDED-BY MF1 · 2026-08-22. Never resurrect 3rd Party Fee as cost.

**MF5 — Takamol and Techtic Support never appear anywhere** ACTIVE · 2026-08-23. The owner: "No takamol what so ever." Verification revenue from another system; an import bringing it back is a BUG. Totals read through js/16's `live()`; the exclusion is a typed rule (D16).

**MF6 — Labelling excluded data is not excluding it** SUPERSEDED-BY D16 · 2026-08-23. Caught rows are left out of every total by `money_rows`.

**MF7 — Wallet top-ups are never revenue** ACTIVE · undated. The importer skips them, as it skips verification services.

**MF8 — Never sum `finance_invoices` and `finance_transactions` in one total** ACTIVE · undated. Their money overlaps, so it double counts.

**MF9 — VOID is excluded from every total, everywhere, always** ACTIVE · 2026-08-22.

**MF10 — Only confirmed, fully paid tax invoices count as revenue** ACTIVE · 2026-08-22. Done-but-uninvoiced work shows as its own Ready-vs-Pending split, never folded in early or hidden.

**MF11 — Never fabricate a number: leave it null, say why** ACTIVE · 2026-08-22.

## User-facing text

**UT1 — Help text: rules users could break, not architecture** ACTIVE · 2026-08-23. Cut spec words; a sentence whose removal would allow a money mistake is shortened, not deleted.

## Data provenance — how data enters this app

**DP1 — Data comes from Direct Payments' export registry, not owner hand-exports** ACTIVE · 2026-08-21. Captured in-page from `/en/admin/excel-exports`. A session without that access says so and hands the job on.

**DP2 — Never fire Direct Payments' sync export or fetch big pages** ACTIVE · 2026-08-23. The `?export=1` job and 100-row pages lock the whole browser session. Page 10–25 rows.

**DP3 — Business data enters via the app's importer, never direct SQL** ACTIVE · 2026-08-23. The importer applies exclusions, dedup and the preview; SQL skips them. If truly unavoidable, apply exclusions by hand and say why in the commit (see D17).

**DP4 — Real company, client or invoice data is never committed here** ACTIVE · 2026-08-08. The repo is public and stays so (owner, 2026-08-29). Docs describe an example's shape and point to the value; real data goes to Google Drive or stays local.

**MF12 — One period state (`FIN.p`) drives every Overview/Clients number** ACTIVE · 2026-08-11. Nothing is stored per period: year, part and sector (derived at render) all pass `finInPeriod(r)`, so tabs and exports scope together; new part words or sectors need `finCompPeriodOf()`.

**M20 — Hand-made tables and backups get RLS at creation** ACTIVE · 2026-09-20. Without RLS it answers the publishable key with no login. Read `get_advisors(security)` every sweep.

**M21 — Money documents: private buckets, expiring links** ACTIVE · 2026-09-20. payment-proofs, expenses and company-docs use `createSignedUrl(path, 600)`; check-structure refuses `getPublicUrl` on them. The proposals bucket is the owner's call.

**M22 — A no-sign-in function with a bypass key needs bounded writes** ACTIVE · 2026-09-20. Before trusting `verify_jwt = false`, bound its WRITES (manual-confirm: `trg_guard_manual_confirm`). Its no-login read half stays open until the owner decides.

**M23 — Each sweep runs the live checks the battery cannot** ACTIVE · 2026-09-20. `scripts/qa/run-live-checks.sh` (M87): is what is served what was edited, what a no-login caller gets, whether real data holds broken shapes. Could not ask is not clean.

**M24 — A third party's personal contact never goes in the code** ACTIVE · 2026-09-20. A named person belongs on the supplier's `providers` record; each Saudi number in js/ is judged in `scripts/qa/phone-numbers-judged.txt`. Git history is the owner's call.

**M25 — The audit log obeys its records' access rules** ACTIVE · 2026-09-20. Money rows of `record_history` need `can_see_page('finance')`; only admins and managers read it (D13). RLS refuses crafted inserts, keeping undo_change safe.

**M26 — A column the app reads back is one the app can clear** ACTIVE · 2026-09-21. When `rowToApp` falls back to a column, `appToRow` writes null for an emptied field, or a deleted value returns. Guard `probe-the-card-shows-what-the-database-holds`.

**M27 — A FAILED read is never drawn as an empty result** ACTIVE · 2026-09-21. Never `rows = (r && r.data) || []`: say which read failed where the answer would be, with a retry. Money draws nothing, not zeros; no invented identifiers; none and unknown differ.

**M28 — Our notes about a third party never reach a share link** ACTIVE · 2026-09-21. Ask who else can open a card before adding to it. For link holders, notes, logs, comments and exports stop at js/79 (`window.__isShareView`). Guard `probe-a-share-link-sees-no-internal-notes`.

**M29 — Share links get only what they promise** ACTIVE · 2026-09-21. `share_view` and js/10 both keep only meta, schemaVersion and trimmed settings; either alone is a regression. Guard `probe-a-share-link-is-not-handed-the-settings`.

**M30 — A moved value's old form closes the same day** ACTIVE · 2026-09-21. A form that writes nowhere is worse than a gap; a migration ends when the old writer is shut or repointed.

**M31 — A page in the list gets no sidebar button by itself** ACTIVE · 2026-09-21. Inject a `VIEWS` page's button after core-08's rebuild and every render (js/18's pattern), hidden from those who may not open it. Search inside pages before calling one unreachable.

**M32 — Numbers held only in one browser say so** ACTIVE · 2026-09-21. js/91 names above Reports the figures kept only in this browser (`directReportsData_v1`); only a hand-typed KPI actual is left there. Guard `probe-reports-say-they-are-local`.

**M33 — A screen drawing from a copy says how far behind it is** ACTIVE · 2026-09-20. Airlines show app_state's 136 of the register's 139; js/92 names the gap, quiet when they agree. `bak_20260725` / `bak_20260805` are closed by missing grants, not RLS: check both.

**M34 — 'No date on file' is its own answer everywhere** ACTIVE · 2026-09-20. A null date is a third state, neither coming nor past; undated records keep their place and their own filter tile. Before changing what a number counts, find what must add up to it.

**M35 — A money figure names the store it was counted from** ACTIVE · 2026-09-20. Today's Credit Pool counts `DB.invoices`, not the ledger; js/93 names the source and shows the ledger figure (none without Finance). Empty or failed loads are never cached; retry, bounded.

**M36 — Never report in another system's name; 'live' must be true** ACTIVE · 2026-09-20. Mirror pages say Direct is the system of record; an empty mirror says so before any total (js/94). If two screens disagree about a connection, one lies.

**M37 — A probe recording a hole fails once it is fixed** ACTIVE · 2026-09-20. Record an accepted hole as a note or a check holding the fix, never a passing assertion. Reached-the-browser checks seek a value only the sender could supply, not seeded keys or counts.

**M38 — Every search over the same records shares ONE haystack** ACTIVE · 2026-09-20. The top-bar, Leads, Clients and palette searches all call `recordHay` (core-01): add fields there. 'Visible' is not offsetParent: a fixed overlay has `offsetParent === null` open or shut.

**M39 — Averages, and cards that drop rows, say how many** ACTIVE · 2026-09-20. Count used in the label, dropped count explained once, silence when none; a dash, not 0, when nothing is measurable. Guard `probe-the-average-says-what-it-averaged`.

**M40 — Retire a choice by marking it, never deleting it** ACTIVE · 2026-09-20. Keep the option disabled and labelled as phasing out (enabled where a record holds it), never hidden; one list, `window.DT_PROVIDERS_PHASING_OUT`.

**M41 — If nothing measured a score or a match, do not print it** ACTIVE · 2026-09-20. Say what was derived, from where, and what was not read. A half-fixed fabrication is still one.

**M42 — The screen applies the permission the owner sets** ACTIVE · 2026-09-20. Controls ask `mayEditPage`, never the role alone, and fail closed while loading (D2); a withheld control says so. Withhold the write, never the read (Print / PDF, Copy stay).

**M43 — Documents take registry values, in both languages** ACTIVE · 2026-09-20. Footers read `company_identity` in the document's language (`S.cur.lang`), not the app's; if the registry is silent the line goes, label and all.

**M44 — Client documents show every row, no browsing controls** ACTIVE · 2026-09-21. js/04's pager skips document pages; their text uses `S.cur.lang`, never `fl()`. Test the guard with a table big enough to page.

**M45 — 'Today' counts from local midnight, never a rolling window** ACTIVE · 2026-09-21. Direct works at UTC+3. Nothing yet today in a non-empty log is said, not a bare 0; build fixtures from `Date.now()` at run time.

**M46 — Probes own offset-bound ports; gates claim only what they saw** ACTIVE · 2026-09-21. The port gate expands offsets and reserves a block for computed ones, saying so; a probe may declare `PORTS_RESERVED: <lo>-<hi>`. New probes use 9200+.

**M47 — A setting a page does not honour says so in words** ACTIVE · 2026-09-21. Team & Access marks it in visible text, never a tooltip (one list in `js/52`). Since D2 every page honours View, so none is marked.

**M48 — Finance says what it holds back, by reason (M39)** ACTIVE · 2026-09-21. js/99 says atop Finance how many rows are left out, by whether a reason was recorded, and that they stay stored; silent when none. Check a total and its parts separately.

**M49 — A cell that absorbs a tap must do something with it** ACTIVE · 2026-09-21. `js/100` makes the tick-box cell on Leads and Suppliers toggle its box (not a cell holding more). Measure the effective target, not the control.

**M50 — A probe fighting an app safeguard is broken, not flaky** ACTIVE · 2026-09-21. Read the mechanism before out-waiting it; empty in place and assert the precondition at action time. Guard `probe-export-menu-honest`.

**M51 — One workspace copy; a layer ships only if measured to help** ACTIVE · 2026-09-21. Only `directBusinessData_v29` holds it. Measure with the new file removed before crediting it; say if a probe's numbers are mock or live. Guard `probe-one-workspace-copy-not-three`.

**M52 — A missing-data warning names the riyals at stake** ACTIVE · 2026-09-21. Not only the row count: compute the share from the figures on screen. Guard `probe-the-cost-gap-says-how-much`.

**M53 — An RLS refusal arrives as HTTP 200 and an empty list** ACTIVE · 2026-09-21. If a reader cannot tell 'none' from 'not yours to read', say both (Finance: `FIN.rows` empty after load); an empty period stays a true zero. Guard `probe-an-empty-answer-is-not-a-zero`.

**M54 — Translation maps fit real data; no database IDs on screen** ACTIVE · 2026-09-21. Count the stored values first (case, coverage, separators). One helper, `actTypeLabel`, serves list and timeline.

**M55 — Offer only keepable choices; still show the current one** ACTIVE · 2026-09-21. Stage pickers offer only words passing `stageKeepable()`; a record's known current word still shows. The stage list stays untouched. Guard `probe-a-stage-you-pick-is-the-stage-you-get`.

**M56 — A capped list saves a place for the actionable** ACTIVE · 2026-09-21. Today's renewals card (js/88) keeps its top three, but the nearest unlapsed item takes the last place; nothing invented, nothing past sixty days.

**M57 — A guard asks the app, never keeps its own copy** ACTIVE · 2026-09-21. Ask the app (`pickableStages`, `finLive`); prefer inclusion to equality for words; a literal only as the assertion. When a rule changes, invert a wrong assertion, never delete it.

**M58 — Translate only the app's own vocabulary; labels always** ACTIVE · 2026-09-22. A person's text shows verbatim, even in a boolean field; only exact yes/no tokens translate; a closed list with no Arabic in the data stays as stored.

**M59 — Sanitising is escaping, never deleting** ACTIVE · 2026-09-22. Escape (`&amp;`), never strip: a removed character renames a string and un-translates it.

**M60 — An average covers only what was measured and says how much** ACTIVE · 2026-09-22. Unmeasured is never zero: '—' when none is measured; say what it covers ('1 of 6 KPIs measured'). `rptPct()`'s 0 only draws a bar. Guard `probe-a-kpi-nobody-measured-is-not-a-zero`.

**M61 — A refused save is kept past reload and told, never replayed** ACTIVE · 2026-09-22. The badge says 'Not synced — in this tab only'; js/02 keeps the refusal in `db_unsent_v1` until a confirmed save; js/102 names the lost records once. Guard `probe-a-refused-save-is-not-forgotten`.

**M62 — Text cached for a redraw keeps both languages or the key** ACTIVE · 2026-09-22. The funnel tabs carry `data-label-en` / `data-label-ar` and choose at redraw, so a count refresh cannot restore English.

**M63 — A verdict may not ignore what its own screen shows** ACTIVE · 2026-09-22. A summary line asks the layer that decides what counts (js/14's `v57YourDay`). A genuinely calm day is still called calm.

**M64 — Search folds Arabic and phone spellings on both sides** ACTIVE · 2026-09-22. `searchFold` (core-01) folds alef forms, ة/ه, ى/ي, ؤ/ئ, harakat and digits in record and query; `phoneKey` strips 00, 966 and a leading zero on both.

**M65 — Two controls, one question: same rule, pool, count and state** ACTIVE · 2026-09-22. Leads' 'Needs attention' chip and button both ask js/09 (`leadAttnPool`); a count equals the rows its filter leaves.

**M66 — An exported date is recognised by value, not column name** ACTIVE · 2026-09-22. `exportFlat` (core-05) converts epochs anywhere, flattened cells too, but outside date-named columns only exactly 13 digits, so IDs and phones stay numbers.

**M67 — Arabic lookups are exact: add each spelling** ACTIVE · 2026-09-22. Never make js/21 case-insensitive. Translate app chrome only, never a record's own name; acronyms stay.

**M68 — A control offering a choice makes one, or is taken away** ACTIVE · 2026-09-22. If the choice is owned elsewhere, hide it reversibly rather than build a second owner. A scroll-and-flash counts as nothing.

**M69 — A filter named for a fact computes it, not a status code** ACTIVE · 2026-09-22. Events' 'No date' tile, option and count share `isUndated()`, not `status`; ask the same of `needs_manual_confirmation` and any 'missing X' status. Guard `probe-no-date-means-no-date`.

**M70 — Client documents: facts from `company_identity`, colour from `brand/tokens.css`** ACTIVE · 2026-09-23. Never a literal; a missing fact is left out, an unloaded registry said. Documents use #F06820, the app #F47A1F, marks #FF6C00: never unify them. Guard `probe-a-document-carries-no-invented-facts`.

**M71 — A failed load is said where the number it spoiled is read** ACTIVE · 2026-09-23. With contacts refused, Leads and Clients show one line with 'Try again', gone once loaded. Check what the app requests before claiming a refusal tested.

**M72 — Access changes ask first; check the server before hardening** ACTIVE · 2026-09-23. Switching off or re-levelling an account asks via `pfConfirm`. Own-row controls stay: the server refuses self-changes. Guard `probe-an-access-change-asks-first`.

**M73 — One Arabic word per English label, or a written reason** ACTIVE · 2026-09-23. The word you click is the word you read. Legitimate pairs (gender, article, verb vs noun) are listed with reasons in the guard `probe-one-arabic-word-per-thing`, which checks them for rot.

**M74 — A counter that could be misread says what it counts** ACTIVE · 2026-09-23. Archive's zeros count workspace drafts, so it points to Finance for deleted invoices, never a figure. Check no later layer overwrites your edit.

**M75 — Columns sort by shown text in the reading language** ACTIVE · 2026-09-23. Blank and dash-only cells last; ties broken. A renderer needing its cell's words asks `window.v27Word(en)`.

**M87 — A `public` read policy admits people not signed in** ACTIVE · 2026-09-24. 'RLS enabled' is not closed: read the policy's roles. Each sweep runs `scripts/qa/run-live-checks.sh` and logs the result, or says it did not.

**M86 — Translate number sentences where built; editors keep stored text** ACTIVE · 2026-09-24. The Credit Pool texts choose their words in core-08. Registry `source` phrases get Arabic in js/66 for display only.

**M85 — An empty mirror page points to the ledger's invoices** ACTIVE · 2026-09-24. Invoices asks `finLive()`: a count and a Finance button when rows exist, not 'nothing from Direct'; the old line when truly empty; nothing while loading. Guard `probe-an-empty-mirror-points-at-the-ledger`.

**M103 — Activity decides a refusal by its action (`denied`), not its table** ACTIVE · 2026-09-25. js/63's `isRefusal` decides; admin-sent reset-link rows are account events with their own words and address. The field dictionary covers every field the live log records.

**M102 — A filter chip keeps or drops rows in the table body, never hides them by style** ACTIVE · 2026-09-25. Or js/04's pager miscounts. Chips go through core-09 `v26_3KeepRows`, which keeps the original rows.

**M101 — A probe crashing before boot is revived, not excluded** ACTIVE · 2026-09-25. Name the crash, fix it, update expectations. Tests carry no real registered identifier: assert absence without quoting real numbers. Runner `scripts/generator-qa/run-all.sh`.

**M100 — Links from stored values go through core-01's one builder** ACTIVE · 2026-09-25. webHref, phoneE164, waHref, telHref; never a copied expression. Saudi default: leading 0 or bare 9 digits → +966, 00 → +; an existing + or 966 and scheme are kept.

**M99 — Confirm questions read Arabic via js/21's pfConfirm wrapper** ACTIVE · 2026-09-25. js/21 now owns every class of words a person meets (M38, M91, M96–M99).

**M98 — Reports and prompts read Arabic via js/21; failures look like failures** ACTIVE · 2026-09-25. js/21 holds the fixed heads and wraps v18Ask, pfPrompt and (late) alert; a head goes in the dictionary its path uses.

**M97 — Notices read Arabic via one js/21 toast wrapper** ACTIVE · 2026-09-24. TOAST_AR, TOAST_HEAD_AR and patterns apply at display; callers never write their own English. An unknown toast text fails `probe-a-notice-speaks-arabic`.

**M96 — Hover and screen-reader words follow the page language** ACTIVE · 2026-09-24. js/21's TITLE_AR owns `title` and `aria-label`; no layer sets them in English. A control whose words change on click sets aria-pressed.

**M95 — Never rewrite a share address; read `window.__bootPath`** ACTIVE · 2026-09-24. Never `location.pathname`, which js/03 rewrites (never a share view's, so a slow boot or refresh keeps the token).

**M94 — One name per person, from `displayName` / `shortName` (js/54)** ACTIVE · 2026-09-24. Nickname in the page language, else the Arabic name in Arabic, else the full name. The chip shows a nickname whole; its menu keeps the official name.

**M93 — Pop-ups take focus; Escape closes, returns focus, presses nothing** ACTIVE · 2026-09-24. js/44's profile menu, holding Sign out, closes only via `closeMenu`; pop-ups under 300 px slip past the general Escape probe.

**M92 — A failed people list retries, then says so; absent stays quiet** ACTIVE · 2026-09-25. js/33 retries a failed roster read ten times, then people lists get a disabled warning first option (`teamRosterWarnOption()`), cleared by a later load.

**M91 — Check every form in Arabic; add unknown words once to js/21** ACTIVE · 2026-09-25. Labels into `V27_AR`, hints into `PLACEHOLDER_AR`; brand names, codes and format names stay. Only the live count is a finding, not a source grep. Guard `probe-every-form-speaks-arabic`.

**M90 — People lists use the live roster; a saved name outlives it** ACTIVE · 2026-09-25. Lists come from `teamList()` (js/33), never a literal; 'Other' keeps its stored value. Forms reuse js/21's Arabic where it exists.

**M89 — A pressed chip says beside it what it scoped and how** ACTIVE · 2026-09-24. On Finance it counts the tiles' own rows and names each row's basis (`finSectorBasis()`), default included; the header keeps the ledger's count.

**M88 — Fixed-pixel grid rows need a phone rule, in a class** ACTIVE · 2026-09-24. An inline style cannot carry a media query: use a class with a `max-width:640px` rule; measure at 400px and 1500px (`probe-audit-rows-read-on-a-phone`).

**M84 — A funnel-form answer can be found from any search box** ACTIVE · 2026-09-24. `recordHay` (core-01) reads the funnel answers and the company's own phone, skipping booleans and objects.

**M83 — Name money gaps truly; never quote an unreadable date** ACTIVE · 2026-09-24. A gap of a riyal or more is named as the stored numbers disagreeing; only a true rounding gap gets the rounding sentence. Guard `probe-a-money-gap-is-named-for-what-it-is`.

**M82 — An unreadable record costs only itself, and the list says so** ACTIVE · 2026-09-24. The loader maps each row alone; an unreadable one is skipped, counted and said. A non-time value shows nothing, never NaN (`fmtAgo`). Guard `probe-one-bad-record-costs-one-record`.

**M81 — Never show demo records or judge records that did not arrive** ACTIVE · 2026-09-24. Until `window.__bizTableLoaded` is set, company lists show nothing and say why, and Today says "Today cannot be judged — your records have not loaded"; a truly empty workspace is not told it failed. Guard `probe-not-loaded-is-not-your-data`.

**M80 — A typed field follows blob-wins, and a note is never a date** ACTIVE · 2026-09-23. In `rowToApp` the next-action date and note keep the blob's value when the column is empty (M26); the date never falls back to the note. Guard `probe-a-typed-next-action-survives-a-reload`.

**M79 — Display-derived values are marked, stripped only while unchanged** ACTIVE · 2026-09-23. The js/72 bridge derives lastContact; `stripBridged` removes it at save unless a person edited it, so untouched rows are never rewritten. Guard `probe-a-logged-call-reaches-the-list`.

**M78 — A sweep's route list is every route the app answers** ACTIVE · 2026-09-23. Take the routes from the reachability diagnostic's source, never from memory. A word used in several places lives in js/21's shared dictionary.

**M77 — Two people on one company: the second is told** ACTIVE · 2026-09-23. At save, `js/104-two-people-one-record.js` checks if the company changed since this tab looked, then names it and points to Undo; it never blocks or writes. A real merge is the owner's call. Guard `probe-two-people-one-record-are-told`.

**M76 — A refused page visit is not a record change** ACTIVE · 2026-09-23. Activity & Audit's tiles say how much of each count is refusals; none are deleted or hidden by default. Live drives as a restricted role write refusal rows: say so. Guard `probe-a-refused-visit-is-not-a-change`.

## Session & GitHub-push access — read before assuming a session can push

**S1 — Fetching this repo does not mean a session can push** ACTIVE · 2026-08-27. A push needs a credential the proxy adds only for the session's authorized repos. A refused session stops retrying and hands its commits to one that can push (S4).

**S2 — Hand local commits to a reachable push-capable session unasked** ACTIVE · 2026-08-27. CLAUDE.md rule 9 and step 1 of rule 10.

**S3 — Pushing via GitHub's website upload as a fallback** SUPERSEDED-BY CLAUDE.md rule 10 · 2026-08-27. Never without being asked.

**S4 — Stuck commits: Claude Code, else say so, then ask the owner** ACTIVE · 2026-08-29. CLAUDE.md rule 10. If Claude Code is unreachable, say "saved here, not live yet" and leave them local; never self-serve a push unasked.

**S5 — The owner's "Go live with whats ready" once allowed a browser-upload push** SUPERSEDED-BY CLAUDE.md brief §4 · 2026-09-03. Changes now land by reviewed PR from Claude Code.

**S6 — "don't push" is not "don't talk": hand-offs never wait for the owner** ACTIVE · 2026-08-29. The owner, verbatim: "you have been doing so since the beginning!! what changed!!" Acting ON the repo (push, merge, history) needs push authority; talking TO a session is done at once.

## Code patterns that keep re-biting

**CP1 — Without `.select()`, a refused Supabase write looks successful** ACTIVE · 2026-08-22. Chain `.select()` and check `r.data.length` before saying anything was saved, deleted or restored.

**CP2 — A layer's menu button names its page on the button itself** ACTIVE · 2026-09-27. The access pass in `js/52-v76-access-model.js` reads that name before any label. Test the menu for several seconds, through a redraw. Guard `probe-the-menu-keeps-its-pages`.

**CP3 — Playwright's `waitForFunction` takes the timeout third** ACTIVE · 2026-09-27. Write `waitForFunction(fn, null, { timeout })`; passed second, the options become the page argument and the 30-second default stays.

**CP4 — is_client is two flags, not one** ACTIVE · undated. The `businesses.is_client` column and `raw->>'isClient'` must change together; the app reads both.

**CP5 — CSV and spreadsheet exports pass values through `csvGuard()`** ACTIVE · 2026-08-22. Quoting does not stop formula injection: Excel still evaluates a cell starting with =, +, @, tab, CR or a non-numeric leading minus.

**CP6 — Password minimum = Supabase Auth's, via one constant (`MIN_PW`)** ACTIVE · 2026-08-23. Never a literal per screen.

**CP7 — Interaction checks click during load; content checks wait to settle** ACTIVE · 2026-08-22. A settle-only probe never catches a mid-load freeze; an unsettled content check reports false empty tabs.

**CP8 — Signed-in calls wait for `window.__roleKnown===true`, not a timer** ACTIVE · 2026-09-09. Retry on error; sign-in probes pause at typing speed (`scripts/qa/probe-employee-signin-shape.mjs`).

**CP9 — A layer that inserts into `#view` removes it; "no longer re-added" is not "removed"** ACTIVE · 2026-09-09. Insert with an id and remove it by id on every render where it does not belong: in-place redraws keep what an earlier render left.

**CP10 — Test as team_member, not only as the QA admin** ACTIVE · 2026-09-09. The QA account may be switched to team_member in `app_users` for a drive and back.
