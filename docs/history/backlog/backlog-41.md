## Watch cycle 74 — the importer told people their correct file was wrong

**2026-09-09.** Cycle 73's battery threw `TypeError: Cannot set properties of null (setting
'innerHTML')` inside `probe-import-preview-phone`, at `js/65-universal-importer.js:1311`. The brief
said measure before fixing: can a person reach that, or only a probe under load?

**A person can, and what they get is worse than a console error.**

### Measured through the real file input, no probe-only entry point

A 3.17 MB / 40,000-row export dropped on the Import tab, then a click on another tab:

| switch after | result |
|---|---|
| 20 ms | `Cannot set properties of null (setting 'innerHTML')` |
| 60 ms | same |
| 400 ms | same |
| 1,500 ms | no error — the preview has painted by then |

So the window is about the first second after a drop — exactly when someone looks away from a file
they have just handed over. A *small* file finishes parsing before a person could switch at all,
which is how this survived every previous import probe.

**And the throw is caught in the wrong place.** It lands in the streaming parser's `onError`, which
records it as *this file's* error. Returning to the tab reads:

> `c74-import.csv — not recognized — Cannot set properties of null (setting 'innerHTML')`

on a perfectly valid export — and it stays there. The import never happens and the person is told
their data is bad. js/65 already names this exact failure, for a different cause, a few hundred
lines further down: *"it never says 'not ready', it says 'your file is wrong', in red, and teaches
the next person to distrust correct data."* Same lie, different cause, same tab.

### The fix

`paintPersisted()` and `paintDone()` both look `#finImpOut` up and check it, and both explain why
in their own comments — the app re-runs the full `render()` chain from a dozen unrelated pollers,
and `rImport()` regenerates the tab with a blank `#finImpOut`. `renderCombinedPreview()` looked it
up again and did not check. It does now: **nowhere to paint is an ordinary state, not an error.**
`RESULTS` stays set, and `paintPersisted()` redraws from it on the next render — which is what
happens when the person comes back. `processFileList` got the same guard; for a person it is
reached synchronously from a gesture, but `window.v65IngestText()` calls straight into it, which is
how the probe hit it.

Measured after: the file is recognized, 20,000 rows previewed, no errors.

New **`probe-import-preview-tab-switch.mjs` (port 8741)**, five things, including that the importer
says nothing about the file being wrong — no "not recognized", no JavaScript error text where a
sentence about a file should be. The 60 ms switch is not a guess at a tight race: it is one of the
three delays measured to throw, against 1,500 ms which did not. **Sabotage** (drop the element
check): **4 red, exactly the predicted checks** — control green.

## The port check was vouching for a field it had only half looked at

Cycle 73 also recorded `probe-role-nav` dying on `EADDRINUSE` at port 8974: it picked
`8700 + Math.floor(Math.random()*500)`. `check-probe-integrity`'s port block — written in cycle 34,
whose own comment says the symptom *"was written off as 'environmental, red in a batch and green
alone' for six cycles across three probes; it was never the environment"* — matched `PORT = <digits>`
and nothing else. **Seven of the files it was certifying were outside the fence entirely:**

- `probe-role-nav` and `probe-page-access-enforce` — both picking a **random** port from a range
  that covers the whole battery. Two files, not one.
- three probes writing `const PORT = REFUSE ? 8304 : 8303` — honest literals in a ternary, never
  compared against anyone else's.
- three probes passing the port at the call site, `run(8471, …)`, never named `PORT` at all.

The check now collects every port a file could bind — ternaries, call-site arguments, and named
constants — and separates the two failures that matter: a port it cannot see, and a port
**computed at run time**, which no static check can ever vouch for. It went from watching 156 ports
to **184 across 163 probes**, and found three real collisions the old shape could not:
`probe-audit-undo`↔`probe-modals-ar` on 8389, and `probe-crm-attacks`↔`probe-m13-remaining` on both
8303 and 8304. All reassigned to declared literals; the two random ports replaced.

**And the new check was itself the broken thing first — the sixth cycle running (60, 62, 69, 71,
72, 73).** Its first version reported *seven* clashes, every one of them a number sitting in a
comment on the same line: three probes carry `PORT = 8991 /* … was 8301, the port probe-crm-attacks
also binds … */` from an earlier meta-audit, and the year **2026** inside those notes was collected
as a port shared by three probes. It strips comments before reading digits now. Each of the three
surviving findings was verified by opening the file before being believed.

### The run afterwards

Battery **107/107 at `-j 4` with no reds at all**, after a run with four non-reproducers. Two of
those four were the port collisions closed above, so some of the quiet is earned — but cycle 72's
note stands: one quiet run is one quiet run, and the other two (`probe-crm-attacks`,
`probe-expense-report-capture`) were starvation, which a fixed port does nothing about.

## Open for cycle 75

**js/16 has four more unguarded `#finImpOut` writes** (lines ~2005, 2055, 2082, 2086 — the legacy
single-file checker and its import loop), the same shape as the one measured above. Read, not
measured: `v65WireImportPanel` redirects the Check-file button to `v65CheckFiles()` **only when
`inp && !inp.multiple`**, so whether the legacy path is still reachable at all is the first
question, and `probe-import-tab-wiring` already covers that wiring race. Establish reachability
before writing anything.

**The mis-attribution itself, unfixed on purpose.** `repaint()` throwing lands in the streaming
parser's `onError`, which records *any* exception as the file's error. Cycle 74 removed the one
cause it had measured rather than wrapping `repaint()` in a bare catch, which would hide real
render bugs behind the same silence. Whether the parser should distinguish "this file's columns do
not match" from "something went wrong while drawing" is a real question with a real cost, and it
wants its own cycle.

**Also open, unchanged:** whether the Overview should say *which* figures moved once the exclusion
list lands (needs a pre-exclusion total, which the storage doctrine forbids — establish the person
can notice before building). The two voices (js/49's modal vs js/16's alert). js/31-v48 line 388's
ungated `finExclusionCheck()` rollup — out of lane, read but not measured. Cycle 68's
wire-versus-page wording in `settingsLoaded()`, still untested in the wild.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; js/49's refusal wording; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**A question for the owner, not for code:** if invoices ever do start carrying a month or quarter
that contradicts their date, which field should win? Do not raise it until there is at least one
real row — today there are none.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.


---

## 2026-09-09 (evening) — the live-test sweep, lane widened by the owner

The owner said "fix them here" for the pages other sessions own, and "continue unstop". Another
session (Round 69, 14:26 UTC) had pushed to js/35, js/54, js/56, js/64 and the mock the same
afternoon; those files were left alone and everything below was rebased on top of them. Every
fix has its own probe, sabotage-tested (the count of reds is in each commit message), and the
whole battery was run on the batch before it went live.

**Today.** T1 "Open my queue" ran `current='today';render()` — a redraw of the page you are on;
it now scrolls to and lights up the My-queue group (core-09). T2 the greeting's "N quotes to send"
is a link to Proposals; invoices to Invoices (core-09). T3 the split "Today · 9 Sept" card and the
split "Recently visited" were core-09's KPI heuristic tiling the hero and the groups — see the
heuristic note below. Probes 8751, 8758.

**Deep links (N1).** /reports, /settings, /ops bounced an ADMIN to Today: js/52's gate moved the
person while the role was still unknown (employee floor) and nothing moved them back; js/03 had
rewritten the address by then. A refused page is now remembered and restored the moment the role
allows it; a refusal that stands is told once, by address or by click. Probe 8752/8753 drives it
as admin and as an employee (who is still held on Today, and now told). Finance never needed
this because js/16 re-applies its own deep link.

**Leads.** L1 the Lost chip read 0 while clicking it listed 2: core-09's badge applied Hide-closed
to every chip while core-10's table applies it only when no stage is picked. The badge now says
what the click shows; probe-leads-counts' 22 Aug invariant ("All = sum of six chips under
Hide-closed") was revised with the reason. L3 funnel tabs (js/09) counted closed leads the table
hid, and never refreshed on a redraw — same pool, refreshed in place. L1-dash / L4 the Dashboard
view counted a client whose stage reads Lost as a lost lead and drew its tiles in the dark-hero
.chip style on a white board — one leads-only pool and light styling (core-02). L2 the "26 %"
tile names its numerator and denominator (js/13). L5 a lead saved through the form now carries
createdAt at once, so "New this month" moves without a reload (core-02). Probes 8139 (revised),
8754.

**Money outside Finance (owner ruling 21 Aug, measured live).** OPS1 the Operations board's
"Pipeline value" / "Booked margin" tiles and the per-card "25k SAR · △3k" line are gone; a
"Needs a cost recorded" count and a "no cost yet" mark replace them; sell and cost stay in the
request form where they are entered (core-03). C2 a funnel answer whose key ends in _sar or whose
label says SAR prints "recorded — read on Finance" on the card, the hover pop and the funnel CSV;
the edit form keeps the value (js/09). EX2 totalSAR removed from the Leads and Clients export
columns; EX1 "full details" is now every non-money, non-internal field, so it differs from
"summary" (core-05). Probe 8755, three sabotages.

**Native dialogs (D1).** The New-business empty-name refusal and the lead Delete, and the
request form's pair, used alert()/confirm() — which froze two of the owner's tabs. They use the
app's toast (error style, cursor on the field) and js/57's box now; the box wraps multi-line
text. Probe 8756 treats any native dialog as a failure. probe-crm-attacks 4a/4e/4f and
probe-recovery-attacks A1/A2/D1 were driven through the old dialogs and now drive the box; the
mock writes a record_history row on an archive (the live trigger does), which is what A12 was
really relying on.

**Activity & Audit.** AU2/AU3 every row names its record (company, invoice number, transaction
reference, contact) and says what changed in words — a change inside `raw` is opened up to the
fields that moved; the column names stay as a tooltip (js/63). AU4 Undo is offered only inside
the 24-hour window `undo_change` enforces (read from the live function); past it the row says
so. probe-audit-undo's "offer it and warn" invariant revised with the reason. AU5 the
four-boxes-per-row look was the KPI heuristic again. Probe 8757.

**The KPI heuristic (core-09 v26FixKpiLayouts).** "A div with four numbers in it is a KPI strip"
tiled the Today hero, the lead/client detail grid (C1's two empty panels) and every audit row (a
date and a time are two numbers already). Named structures are excluded and a real strip must
have three or more short children. Probe 8758 proves the hero, the cards and the log stay whole
while the counters row stays a strip.

**Proposals.** O1 the Client box showed "— pick a client —" on a proposal that had one: the
linked company was a practice record no longer in the workspace (all five live proposals were —
the proposal the morning's report called real was practice data too; corrected there). The box
now shows the stored name with "company no longer in the list", or the lead's name with "lead,
not yet a client" (core-04). O4 a non-travel proposal previewed as a flight quote; the preview
now says the client's document is the branded proposal and offers the button; travel quotes keep
the flight preview (core-04). O3 "push to source" retired for "Draft booking — confirmed later in
Direct Payments" / "Issue in Direct Payments", Arabic too (core-06, js/21). Probe 8759.

**Data, with the owner's "do what's best".** The five practice proposals and the one practice
project were removed from `app_offers` / `app_projects` (full copies in
`practice_cleanup_backup_20260909`, now 20 rows) — they linked to companies that no longer exist
and drove Today's "1 quote to send".

**Archive (AR1, open item 16).** The Archive page read "Archived leads 0" over four archived
companies and its footnote admitted no screen could restore one. New layer js/76 reads the rows
the loader deliberately never fetches (`archived_at` set), lists them with who deleted them and
when, and offers Restore — clears `archived_at`, the database trigger logs a `restore`, the page
reloads so the loader brings the row back. A company removed by a MERGE (`archived_by =
merged-into:<id>`, three of the four live) is listed without Restore and names its survivor:
bringing it back alone would resurrect the duplicate; the merge is undone from Activity & Audit.
Probe 8760, two sabotages.

**Looking is not changing (N2).** Measured on the wire in the harness: js/53 appended a "sign in"
line to `DB.audit` — an array nothing has read since js/63 moved Activity & Audit to
`record_history` — and called save() on every page load, so each open sent a save_state_patch
carrying seven sections with nothing changed. Retired. core-06's "Recently visited" pushed every
render of a detail page into the shared `DB.recents` (one list for the whole team) and saved; it
is per person in the browser now and a visit writes nothing. probe-cowork-fixes' "records the
sign-in" invariant reversed with the reason. Probe 8761 counts save_state and businesses writes
during a start-up window and a six-page tour (both zero) and proves a real change still saves.

**Later the same evening.** T5 — with a remembered session the page is on screen before the
businesses table arrives and js/14 built the Your-day card from the start-up copy ("never
contacted" for four seconds); js/02 now sets `__bizTableLoaded` when the rows land and the card
waits for it (probe 8762 holds the table back on the wire and samples the page). A2/A5 — every
timeline entry on the lead/client card carries edit and remove controls for someone who may
edit the page; remove asks in the page, both recompute "Last contact" from what remains and
write an audit line (probe 8763). EX3 — a client whose stage is Lost read Health "Good" beside
its old "Won: converted" activity line; `clientHealth` returns Lost first (probe 8754 extended).
The delete warning and js/02's deleted-record notice now name the Archive page as the way back
(probe-recovery-attacks A8 revised). Data: the two `demo_world30` payment receipts (their
transactions were soft-deleted on 21 Aug) removed with full copies in the backup table (22 rows).

**Second landing, later the same night.** AR1 follow-up — seen live minutes after js/76 went
up: the company the owner ruled out (`archived_by = owner-ruling-2026-08-23`) was offered a
Restore button, and two merged rows carry `merged-into:<id> (was: cleanup-…)`; a ruling is not a
deletion anyone may reverse from a button (probe 8760 extended). C5 — a client's card reads
`/clients/client/<id>`; and, found on the way, **a card deep link never survived a boot on any
machine**: js/03 applied the route while `DB.businesses` still held the start-up copy, the card
render could not find the record and cleared `openLead`, and nothing re-applied the route when
the rows arrived — it now opens the card when the record is present (probe 8764, five boots).
SH1 — the Share button opens a panel (js/77): one sentence on what a link does, this person's
links with Copy / Switch off (every link for an admin), and "Create a new link" behind js/57's
box; database policy `share_links_update` lets a person switch off a link they made (migration
`share_links_switch_off_own`); probe-share-and-settings-attacks mints through the panel now and
its "no revoke control exists" invariant is reversed (probe 8765, writes counted on the wire).
Arabic — "Contacted" on the Going-cold row and "Expired 9d ago" spoke English; js/14 reads js/21's
shared stage words and core-04's `offerExpiry` labels in both languages ("Package" and "14-pax"
were the practice proposals' own text). Events — the row button read "Del" and a real row delete
went through a native confirm(); full word, js/57's box with "cannot be undone", refusals through
the toast (probe 8756 extended; probe-events revised for the box). SOP1/SOP2 — an unsized SVG
drew a 382 px star; the Service Levels table gets a Delete button per row instead of a red ✕
behind confirm(), non-resizable cells and an Event input that stays inside its cell (probe 8766,
measured on screen).

L7/C3 — the FUNNEL column (and the card's Funnel line) dressed the SOURCE as a green funnel tag
when no funnel was set; it prints "— source: X" in small muted text now. A client card read
"Assigned to: X" beside "Account manager: Y" with nothing saying why two names; it prints "Won by"
(the lead's owner) and "Account manager" side by side (probe 8754 extended). L9 — after Save the
table re-rendered under a cursor that had not moved, the new row under it received mouseenter and
the hover card popped with nobody hovering; js/09 shows the card on real pointer movement only,
and click / key / scroll put it away (probe 8754, real mouse moves; sabotage red).

Airlines — the Void and Refund cells were cut at 24 characters with an ellipsis; they wrap and
read in full (probe 8766 extended). D1 family, the last two: js/63's Undo asked through
window.confirm and answered every result through alert(); the question is js/57's box and the
answer js/63's own in-page notice (stays until dismissed — a toast is gone in two seconds and
"Too old to undo" matters); js/02's "saved onto a deleted record" warning uses the same notice.
probe-audit-undo, probe-audit-events-search-attacks A7 and probe-recovery-attacks D3/D4 read the
page now and count a native dialog as the failure.

**Third landing, the same night — the D1 family across the app.** The Won question
(`convertToClient`, the busiest path there is) asked through window.confirm; it asks through js/57's
box now and announces `lead-converted`, which js/14 listens for to open the client handover (it
used to check synchronously after the call). core-01 gains `askInPage(msg, yes)` and ten more
sites use it: promote proposal → project, delete proposal, remove its file (core-04); delete
bundle template, credit note, the `n` shortcut's blank proposal, restore from backup, delete
tagged backup (core-06); archive project (core-08); resume an on-hold lead (js/14).
probe-backup-supabase and probe-recovery-attacks answer the box (C1x counts a native dialog as
the failure); probe-no-native-dialogs gains the Won and proposal-delete blocks. L8 was looked for
on the live Leads page (78 rows) — no empty pill anywhere; the row that showed it was the test
lead, since deleted; closed as not reproducible.

**Fourth landing.** The two "send a password reset link" questions (js/02, js/31) and the
superseded v38 copy of evDelete/evOpenModal in js/10 moved off window.confirm/alert
(probe-no-native-dialogs gains the reset-link block; diag-password-recovery answers the box).
A3 — "Recent changes" on a company card said "No logged changes yet" straight after a save: the
card is drawn by the render() that follows the save, but the row is written by the database
trigger when the cloud save lands ~1 s later; js/63 chains js/02's status pill and re-reads the
card on "Saved" (probe 8767; the mock lets a probe plant a history row the way the trigger
would). Seen on the way and traced: opening a company card renders a second time when js/38's finance
card has loaded the finance tables (first open of a session only) — by design, not a defect;
the probe waits for those reads to land before it measures.

**Fifth landing.** The last user-flow questions still asked through window.confirm moved into
the page: the five finance-guardrail questions in js/62 (exclusion remove, undo grouping, merge
values, merge businesses, unmerge — probe-guardrails-both-halves-attacks stubs askInPage in
arm(); js/62's result alerts go through v63Notice); the Airlines / Suppliers editor (core-03
editSupplier: empty name → toast, Delete → box — flagged by the other session);
quick-edit's "this company is currently a client — move it back to the pipeline?" (core-10:
the form stays open until the answer because the save callback returns false; Cancel saves
nothing; probe-crm-attacks 4c/4d read js/57's box); the Reports achievement delete
(rptDelAch) and the achievement form's empty-title alert (probe-no-native-dialogs block 11).
Every conversion was sabotage-tested: the native dialog put back turns the matching check red.
The other probes that drive leadQuickEdit / editSupplier (attack-day, attack-wave3, lifecycle5,
landmines, mega, modals-ar, newfeatures, roles, sweep-buttons) never take the demote path or
pin the old dialog, so none needed a change.

**Sixth landing (10 Sep, after midnight).** The browser's alert() box is gone app-wide: js/63
replaces `window.alert` with its notice card (the ~120 call sites keep their wording; two
messages in a row stack in one card; Escape closes it; every notice is announced as a
`v63-notice` document event; the native function is kept as `window.__nativeAlert` for the
fallback). The questions had to move one by one because each needs a callback — a report needs
none, so one shim covers them all. New `probe-alerts-in-page` (8768; shim removed → red) and
`scripts/qa/notice-tap.mjs` for probes that used to read the browser's dialog event — battery
b12 found exactly three (probe-notes, probe-crm-attacks 6e, probe-concurrency-attacks), all
green after the tap; the probes that stub `window.alert` in the page still win over the shim
because they assign it later. Then the prompt() boxes on the everyday paths: js/57 gains
`pfPrompt(msg, default, onDone)`; the Lost reason (core-01 `captureLostReason`) and quick edit's
"add a team member / add a funnel" names ask through it (probe-lifecycle5 answers the box;
probe-no-native-dialogs block 12; sabotage-tested).

**Seventh landing (10 Sep, ~02:00 UTC).** The last of D1. Every prompt() box asks in the page:
js/16 `finSetTargets` asks its two questions one after the other through pfPrompt
(`finSetTargetsWith(y,e,cf)` is the unchanged remainder; the five probes that stub
`window.prompt` for it now stub `pfPrompt` beside it); core-06's bundle-template name, backup
tag name (`tagCurrentState` returns a Promise that resolves after the answer), lock passphrase
and invoice dunning stage; core-04's copy-by-hand fallback. And the legacy Bookings / Invoices
editors' confirm() questions (delete, archive, bulk-archive, the two ingest "duplicate — add
anyway?" — the form stays open until answered). probe-no-native-dialogs blocks 13–15; every
conversion sabotage-tested.

**What still uses a browser box:** `resetData` and `v21WipeLocalData` (developer tools; the wipe
deliberately types WIPE) and the js/57-absent fallbacks — nothing a person meets in daily use.
BR1 the public Brand Hub is the owner's decision.

**L6 — the table's columns say what the record says (same batch).** Measured live first: the
`stage` half of L6 is not a defect — the column holds the canonical key (`new`) and the blob the
app's word (`Prospect`), mapped both ways by js/02. The `assigned_to` half was real: appToRow
never wrote `assigned_to`, `account_manager`, `tier` or `segment`, so a lead assigned in the app
kept an empty column (88 of 108 live rows carry the owner in both places only because SQL set
them). And the other way: 3 live rows carry a tier and segment in the column only, and the app
showed them blank (rowToApp read neither). Now written on save and read as a fallback; both
loaded into the object so nothing phantom is written. `probe-columns-follow-record` (8769).

## 2026-09-10 (03:00–04:00 UTC) — second hands-on pass of the live site, and 48 dormant probes

**Live pass (owner's browser, read-only; English restored afterwards).** Today said "You have
1 quote to send": the only proposal in the table was a blank draft (no client, no title, no
options) made by the QA account on 9 Sep — removed, copy in `practice_cleanup_backup_20260909`
(23 rows now). **L3, second look:** with Hide-closed on, the Leads "In view" strip still read
"80 · Lost 2" over 78 rows — `renderLeadSummary` never applied Hide-closed (the tiles and chips
did); probe-leads-counts now asserts the strip equals the rows drawn. **Card timeline:** a row
bridged from the activities TABLE (the trigger's `stage_change: new → contacted` by `system`)
read "systemedit · remove / stage_change: new → contacted" — no separator before the tools,
tools that would not persist on a bridged row, and column names. Now "Stage changed: Prospect
→ Contacted · automatic", no tools on bridged rows, " · edit · remove" on the record's own
(probe-activity-edit-remove block 6). **Arabic:** the strip's stage badges, "← Back to
pipeline", the stage picker's seven words (value attributes added so js/21 translates the label
and keeps the English key), "★ Convert to client", "Last contact", "Services", "Website",
"Legal name / CR·VAT", the pricing sub-head and empty state, the airline-deals empty state and
the Direct Payments chip (probe-client-card-ar). Seen and left as data: 20 clients with no
account manager; one company listed as a client while its stage says Lost (a decision, not a bug).

**48 dormant probes.** `battery-excluded.txt` listed 49 probes as "live-system — talks to the
production database"; 48 of them route every Supabase call to the mock (only verify-literal
does not). They had never run in a battery. Run alone: 40 green, 8 red. Four re-labelled with
honest reasons (audit-ui-golive's chip rule predates the Hide-closed rule and it flags the
mock's seed names; probe-ops-board and probe-ops-margin-honest want the margin tiles the 21 Aug
ruling removed; probe-newfeatures clicks a "Proposals" sidebar entry that no longer exists).
Four fixed — and one of them found a real defect: **js/52's gate refused a page a person had
been given.** The role arrives from js/02 before the per-person matrix arrives from js/56; in
between allowedPages() fell back to the floor lists, so a team member or manager granted
Operations / Projects / Events, opening one by address or reloading on it, was told "Not part
of your access — ask an admin", moved to Today, and never brought back. gate() and
restorePending() now wait for the matrix (`settled()`, 20 s cap if the RPC never answers);
`probe-granted-page-survives-load` (8770/8771). Also: six bare keys on the Arabic Leads
full-details export (js/73 labels); probe-access-truth and probe-modals-ar had stale
native-dialog / untranslated-option expectations. The 44 are in battery.txt (180 entries).

**Ninth landing (10 Sep, ~05:30 UTC) — the rest of the live pass.** Finance's eight tabs,
Operations, Reports, Settings, Events, Airlines, Providers, SOPs, Archive, Activity and the
Generator page, English then Arabic: no NaN/undefined, no sideways scroll. Found and fixed:
**Activity & Audit** in Arabic read "createdAt, funnelDetails, nextActionDate" for a record edit,
"access · denied" for js/64's page-refusal rows and the literal "unknown" actor — a second word
list for the record's camelCase fields (with a camelCase fallback), "Page access · Refused ·
Operations" with the page named through PAGES, and "غير معروف" / "تلقائي" for the actors the
trigger could not name (probe-audit-names-and-words block 6). **Providers** in Arabic carried an
English "Open ›" chip on every row (js/21 scans .chiplink; probe-reference-pages). **Today** greeted
the owner a second time with "You have 1 quote to send" over a blank draft — the record
"+ New offer" makes on the click itself, made by the QA account during the other session's live
checks; a quote to send now names a client or has a subject or a priced option (core-09;
probe-today-queue-card 3b). Data, with backups in `practice_cleanup_backup_20260909` (53 rows
now): the 29 audit rows of the 9 Sep QA live probes (QA-LIVE-PROBE-*) that sat at the top of the
log, and the second blank draft. Left as it is: the Providers rows' source-type cells ("Direct
supplier / API", "Benchmark only") are table values js/21 does not touch by design; Settings and
SOP titles are data.

**Tenth landing (10 Sep, ~06:30 UTC).** Reports' four tabs, the Events edit form, an Airlines
detail, Settings → Team & Access and the Generator page, English then Arabic — clean, except one
real defect found by an accident of the walk itself: **the Events edit form, opened while one was
already up, drew a second form whose Cancel and Save did nothing.** Every handler was wired
through `document.getElementById`, which answers the FIRST form's buttons — a double-click on
Edit, or a form left open, was enough. evOpenModal removes any open form before drawing and
scopes every lookup to its own form (probe-events; sabotage-tested). The other overlays wired the
same way (js/02 team modal, js/09 funnel details, js/31 Team & Access) already remove their
predecessor. **And the other session's fire-#7 observation, actioned:** js/64's bounce gated on
`__accessKnown()`, which js/52 exported as `known()` — true the instant the role arrives — so a
render inside the load window (an in-app click, a re-render) could still bounce a granted page,
show the banner and log a false "page refused" row, with js/52 only restoring the page afterwards.
`__accessKnown` now exports `settled()` (`__accessRoleKnown` keeps the role-only answer);
probe-granted-page-survives-load forces a render inside the window and asserts no banner and no
`log_page_denied` call — red with the old export, green with the new. Harness: the 47 "credential-gated" exclusions really do sign in as staff through
emp-rig — correctly excluded; reports.txt entries are honest.

**For the owner (E1, not changed):** the Events form stores the event-site sign-up e-mail AND
PASSWORD in plain text (`ksa_event_signups.login_password`), readable by the whole team (policy
`true`); the form itself says so ("team can see it"). The table is empty today. That is a
deliberate shared-credentials design for the "mine the website" move; it should be a decision
he has made knowingly, not one he inherits.

**For the owner (LANDMINES B.1, measured — not changed):** "two people editing the same record at
the same moment → last save wins … the real fix (row versioning) is deliberately parked — revisit
only if it actually bites." Measured today with two tabs on one company in the harness: tab A
logs a note and a next action and saves; tab B, opened earlier, changes only the segment and
saves 2.5 s later — B's whole-row upsert carries its stale copy and **A's note and next action
are gone from the table**, with nothing on either screen saying so (record_history keeps the
before-image, so an admin can Undo — but nobody is told). It bites. `diag-two-tabs-one-record`
(8773, a report) reproduces it in one command. The fix is a stale check on the row upsert
(compare `updated_at` with the copy this tab loaded; on conflict re-read the row, re-apply only
the fields this tab changed — js/02's SNAP already knows them — and merge the activity log by
union), which is a change to the riskiest path in the app and is the owner's call to schedule.

**Eleventh batch (10 Sep, ~08:30 UTC) — Settings' "Import JSON" was a one-click data-destroyer.**
Found by reading the Backup & restore card after the 2 Sep snapshot-restore hardening: the "⬆
Import JSON" button beside "Browse snapshots" had none of it. `importFullState()` did `DB = file`
with no question, and kept the live companies only when the FILE had none — and every "⬇ Export
JSON" file carries all of them. Measured in the harness before touching the code: import a file
with 3 renamed companies, then any save → **57 of 60 companies archived** and the file's names
written over the live ones, nobody asked, nobody told (the auto-tag before import is the only
recovery, and it does not restore companies). The import now asks in the page with the same words
as the restore ("Leads and clients are NOT imported — they live in their own table and are left
exactly as they are"), tags first, always keeps the live company list, tells the person in a
toast, and clears the file input so the same file can be picked twice; an invalid file is an
in-page notice. The console-only legacy `importData()`/`resetData()` (no button) keep the table
and ask the same way. And "🗑 Wipe local data" — the last browser confirm()/prompt() pair on a
button — said "This cannot be undone" about a browser cache: it now asks its two questions in the
page and says what happens (the browser copy is cleared, the page reloads the workspace from the
cloud, nothing in the cloud is touched). probe-import-json-safe (8774) holds all of it on the
wire: zero archive PATCHes after the import, all 60 rows live, no write to businesses/app_state
and no DELETE across the wipe, no native dialog. Sabotage-tested both ways.

**Same batch — the v22 card on Settings: "🔄 Reset for go-live" and "🚀 Run workflow test suite",
retired.** Visible to every admin and manager. The reset (a browser confirm() plus a typed
"GO LIVE") dropped every company that was not a client from DB.businesses, cleared the kept
ones' activities / deal value / wallet, emptied offers, bookings, invoices, expenses, refunds and
the audit, and saved — the next push archived every lead and prospect in the table. Its safety
net was empty: the "Pre-go-live snapshot" it wrote first was localStorage's copy of the
workspace, which js/02 removes on every load, so the snapshot's data was ''. The suite pushed a
test company, offers, bookings and invoices into DB and saved them — practice data written into
the live workspace by one click, the kind the owner had removed the day before. The workspace
went live on 22 Aug; both tools now explain in the page and change nothing, the buttons are gone
from the card (the card says why, EN/AR; "Wipe v22 test data" stays — it only filters _v22test
rows), the v24 wrapper that logged a "backup-scheduled" audit line before the reset is gone with
it, and the suite's report screen is kept as `v22OpenWorkflowSuite_harness` for the harness. The
originals are in git history before this commit. probe-golive-reset-retired (8775): the card,
both functions called directly (zero writes to businesses / app_state / save_state, no browser
box, DB unchanged), Arabic. Sabotage-tested both ways. **Decision recorded:** no path in the app
may replace or filter `DB.businesses` wholesale; the company table is restored row by row only.
The two other one-click practice-data writers on Settings — "🧪 Run a day" (core-06: a test lead,
offer, booking, draft invoice and sync events, saved) and "🟢 Run v23 scenario suite" (core-07:
test companies, bookings, invoices, refunds, expenses, saved) — retired the same way (buttons
gone, cards say why EN/AR, functions explain and stop, `_harness` variants keep the report
screens; the Wipe buttons stay). Held by the same probe.

**Twelfth batch (10 Sep, ~10:00 UTC) — a proposal option was one click from gone.** In the
proposal editor every option (a whole priced package: items, tiers, freebies, base fare,
provider) carries a red "Remove" that took it at once with no question and no way back (options
live in the app_state blob; only a whole-workspace snapshot restore could bring one back).
o_delOption now asks in the page (EN/AR), naming the option and its line count, when the option
carries anything; a blank option (just added) still goes at once. probe-proposal-option-remove
(8776); sabotage-tested. Line-level removals (an item, a freebie, a tier, an upsell) stay
instant — one row each, re-typed in seconds.

**Thirteenth batch (10 Sep, ~11:00 UTC, the owner's "finalise now") — the contract clause
buttons.** In the Generator's contract tab (js/70), once a clause is reworded for one contract,
"Reset to template" threw the typed wording away on one click, and "Save to shared template"
(admin/manager) overwrote on one click the clause every future contract for the whole team
starts from — `contract_clauses` keeps no history (record_history covers six tables; not this
one), so the company's own wording from the 2 Sep CONTRACT CLAUSES note had no way back. Both
now ask in the page (EN/AR) and say what they do. probe-clause-template-asks (8777);
sabotage-tested. Landed on the owner's instruction with the structure/integrity checks, the new
probe and probe-generator-attacks green alone; the full battery (b23) runs after the landing and
its result is reported in the LIVE TEST note.

---

