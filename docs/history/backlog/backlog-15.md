## Routine fire #77 (2026-09-17 12:12 UTC) — EVERY client-facing document printed BLANK from a desktop browser — FIXED (js/66). The worst defect of this sweep
Fire #76 fixed the app's own lists on paper; this round put the same honest method — lay the page out at
PAPER width, render a real A4 PDF — on the five documents that go to clients: price offer, service fees,
company profile, contract, technical+financial pack. All five came out as empty pages.
THE CAUSE, one missing word. js/66 styles the Generator's phone layout with `@media(max-width:900px)`, a
width query with no media TYPE — so it applies to paper as well as to screens. Printing lays the page out
at the width of the PAPER, and A4 portrait is 794px, under 900. So every print run took the phone branch
and set the document column (`[id$="PreviewCol"]`) to display:none. Each editor's own print rules then hid
the rest of the app with `visibility:hidden` and marked the document pages visible — but visibility cannot
bring back a display:none parent. The person sees the document on screen, presses the editor's print
button, and gets blank paper; the "Save as PDF" file is a 7 KB shell.
PROOF (scratchpad/diag-docs2.mjs, live): on screen at 1440 the column is `block`; in print at paper width
it is `none` and the first page box measures 0×0, PDF 7 KB; forcing the column visible in that same print
state gives a 794×993 page with its text and a 337 KB PDF. Nothing else was changed to get that.
FIXED in js/66: the phone block is scoped to `@media screen and (max-width:900px)`, plus an explicit
`@media print` rule that shows the document column and hides the floating phone toggle whatever the
toggle's state. Re-printed live afterwards, all five: price offer 3 pages / 337 KB, service fees 5 / 394 KB,
company profile 8 / 680 KB, contract 3 / 516 KB, tender 4 / 665 KB — full paper width, nothing clipped,
none of the app's own furniture on the page. The phone behaviour on a narrow SCREEN is unchanged.
WHY IT SURVIVED SO LONG: fire #52 measured the preview's fit on screen and fire #66 counted the editors'
fields, both at desktop width, where the bug does not exist. It only appears at paper width, which is why
fire #76's method — lay out at paper width, render a real PDF — is now the standard for anything printable.
Guard: scripts/qa/probe-generator-print-not-blank.mjs (7 checks — the column shown on paper, the page a real
size rather than 0×0, the toggle not printed, a narrow screen still behaving like a phone, the PDF not an
empty shell, 0 JS errors; SABOTAGE-VERIFIED: 4 FAIL / exit 1 with the js/66 edit stashed; port 9058; in
battery.txt). Gates: structure OK, probe-integrity OK, decisions-wired OK.

## Routine fire #76 (2026-09-17 10:11 UTC) — what the app actually PRINTS: the lists came out with their right-hand side silently missing — FIXED (new js/83); three tabs at once and browser Back/Forward: clean; full battery at ac8df02: ALL 209 probes green
THREE TABS AND HISTORY (scratchpad/live-tabs-history.mjs, real database, read-only, 0 writes): three tabs of
the app open at once in ONE browser — the old five-clients bug silently signed people out — signed in on the
first, the other two restored the session with no form, all three still had a session and could still read
after four minutes idle, none showed a notice, and the token was not refreshed once. Browser Back ×3 and
Forward ×2 across Leads → Clients → Finance → Operations put the right page, the right address and the app's
own state together at every step, in English and in Arabic.
PRINT — THE DEFECT. The lists live in a box that scrolls sideways on screen (.tbl-wrap, overflow-x:auto).
Paper has no scrollbar. Laid out at A4 text width (680px) with print media on, the browser drew the first
678px of the Leads table and threw away the remaining 597px of its 1275px — very nearly half, right-hand
columns gone — and 456px of the Clients table; Finance lost 16px and 72px off two tile rows the same way.
Nothing on the page or in the PDF says a column is missing: the printout reads as a complete table that
happens to end early. Someone printing a lead list for a meeting carries an incomplete list and cannot tell.
FIXED in a new file, js/83-print-tables-fit-the-paper.js (print-only rules, screen untouched): the scrolling
box stops scrolling on paper, the table fits the paper instead of keeping its natural width, cell text wraps,
type and padding come down a little, headers repeat at the top of each page and a row is never split across
two. No column is hidden and nothing is dropped. Re-measured after the fix: 0 clipped, 0 past the edge, on
Leads, Clients, Finance, Operations and Reports, and the PDFs still build (Leads 3 pages).
METHOD NOTE, worth keeping: the first measurement pass, taken at a 1440px viewport with print media on,
reported "14 findings — everything is wider than A4". That was an artifact of the measurement, not the app:
print emulation does not reflow to paper width, so every full-width element looked oversized. The honest
check is to lay the page out AT paper width and to render a real A4 PDF, which is what found the true
defect and cleared the false ones. A first attempt at the fix also pushed Finance's page 55px PAST the
paper (trading a clipped box for a clipped page); it was narrowed until measured clean.
Guard: scripts/qa/probe-print-tables-fit.mjs (8 checks — nothing cut off on paper, the last column inside
the paper, the page no wider than the paper, every column still present, headers repeating, Clients the
same, the screen unchanged, 0 JS errors; SABOTAGE-VERIFIED: 3 FAIL / exit 1 with the layer and its script
line removed; port 9057; in battery.txt). Gates: structure OK (76 files), probe-integrity OK,
decisions-wired OK. BATTERY: 209 named, 209 logged, 0 failures.

## Routine fire #75 (2026-09-17 08:11 UTC) — the money doctrine checked row by row on the live ledger: clean; full battery at 67682f9: ALL 209 probes green; the three owner-level tidy-ups gathered into one recommendation
DATA (M1, read-only SQL on the 46 live finance_invoices): revenue = total − wallet on every row (0 off);
profit = revenue − cost on every row (0 off); no row carries a profit without a cost, and no cost is null
any more (the 19 honest gaps noted in CLAUDE.md on 2026-08-29 have since been filled by the owner);
VAT never equals revenue and never exceeds 15 % of the total (0 rows either way); no negative cost or
revenue; the stored month ("March" … "August"), quarter ("Q1"–"Q3") and year agree with the invoice date
on every row; every row has a revenue_way; amount received never exceeds the total and the remaining
amount is always total − received. Totals: revenue 2,030,764 · cost 1,538,142 · profit 492,623 SAR — the
same three figures the Finance page showed live in fire #58. Nothing to fix.
BATTERY: 209 named, 209 logged, four slices, 0 failures, 0 timeouts.
ONE RECOMMENDATION FOR THE OWNER (nothing here is broken today; each is a small amount of waste this
sweep measured, and each is a decision, not a fix I should make alone):
1. The browser-side audit array (DB.audit in the workspace blob, ~800 lines, ~142 KB) is dead — js/63
   replaced Activity & Audit with the database's own record_history on 2026-08-21, and nothing reads the
   array any more except two developer self-tests — yet js/53 still appends to it on every lead change
   and that whole section is re-uploaded each time. Recommended: stop appending (js/53 §3–5) and drop
   the section from the blob in one clean-up; keep record_history as the only log. Saves ~142 KB per
   save and ~140 KB of every sign-in download.
2. During the 20 s after sign-in, app_users is asked 5 times and app_settings 4 times by different layers
   (js/02, js/15 ×2, js/17, js/20, js/50, js/56, core-06; js/35 and js/62 ×2 for settings). Recommended:
   one shared read each, the others taking from it. Saves seven small requests per sign-in.
3. The app keeps 28 permanent timers, six of them at one second or faster (js/15 ×3 and js/46 ×3 are
   the largest owners). Nothing accumulates (fire #74), but on a phone that is steady CPU churn.
   Recommended: fold the sub-second timers into a single 2 s tick.
   Any of the three can be done in one session, each guarded by a probe; none changes what a person sees.

## Routine fire #74 (2026-09-17 06:12 UTC) — a long session measured live: timers, pending work, page size, memory and request rate over 60 page switches — nothing accumulates; full battery at e342db6: ALL 209 probes green
scratchpad/live-longsession.mjs against the REAL database, read-only: setInterval / setTimeout wrapped before
the app loads so live intervals and pending timeouts can be counted; sign in; 60 page switches across 12
pages (Today, Leads, Clients, Finance, Operations, Reports, Suppliers, Airlines, SOP & SLA, Activity, Events,
Generator), snapshots after boot, after 20 and after 60 switches, then 60 s idle. Result: live intervals
29 → 28 → 28 → 28 (nothing re-arms a timer on render); pending timeouts 1 throughout; page nodes 430 →
761 mid-tour → 431 back at Today (the tree is rebuilt, not accumulated); JS heap 13 MB flat; no overlay or
notice left behind; 0 write requests; about 5 requests a minute while switching, the role check once a
minute when idle; 0 page errors. Nothing to fix. Worth knowing: the app keeps 28 permanent timers, six of
them at one second or faster (js/15 ×3, js/46 ×3 among the owners); that is CPU churn on a phone, not a
defect, and consolidating them is a later, owner-level tidy-up. Database checked afterwards: QA account
admin, no drafts, no probe rows, no company row touched in six hours.

## Routine fire #73 (2026-09-17 04:11 UTC) — an idle signed-in session and the boot window measured live against the real database: 0 writes, one role check a minute; full battery at 1ee7d1a: ALL 209 probes green
IDLE (scratchpad/live-idle.mjs, real database, the QA admin, nothing touched after landing): Leads 180 s,
Finance 150 s, Today 150 s. Each: 0 write requests, 0 save calls, 0 page errors; the only traffic is the
session watch's app_role() check once a minute (2 bytes back). Fire #58's read-only-visit-rewrites-links
bug has no sibling on these pages. BOOT (sign-in + the next 20 s on Today): 29 requests, 0 writes, 742 KB
down — leads, the workspace blob, the four app_* record tables, funnels, contacts/activities (each asked
twice: once anonymously at boot, once with the session), team_directory, company_identity once WITH the
session (the fire #71 fix holding live). Chatter worth knowing but not a defect: app_users is asked 5
times and app_settings 4 times by different layers during those 20 s; a shared one-shot would save four
small requests per sign-in. No code change this fire.
BATTERY: everything in scripts/qa/battery.txt (209 named, 209 logged), four foreground slices, 0 failures,
0 timeouts, 0 missing files; covers js/02 as changed in fire #72; probe-live2's kept line is its own
summary again ("PAGEERRORS: 0"), so fire #69's odd trailer was a one-off.

## Routine fire #72 (2026-09-17 02:11 UTC) — full battery at 54edd3d: ALL 208 probes green; the sign-in form and sign-out driven live: honest, except that the form ignored the person's chosen language — FIXED (js/02)
BATTERY: everything in scripts/qa/battery.txt (208 named, 208 logged), four foreground slices, 0 failures,
0 timeouts, 0 missing files; covers js/49, js/63, js/66 and core-06 as changed in fires #68–#71.
SIGN-IN, live against the real auth (scratchpad/live-signin.mjs; one deliberately wrong password, the
reset endpoint intercepted so no email could go out; 0 writes): an empty submit says "Enter your email and
password."; "Forgot password?" with no email typed explains, on the page and without any network call,
what to do; a wrong password says "Wrong email or password…" in plain words (never the raw API wording)
and leaves the button usable; a correct sign-in honours the /leads address; "Sign out" reads «تسجيل
الخروج» on the Arabic page, returns the form, leaves no workspace on screen and no session behind, and
signing back in works. The 65 company records in memory before any sign-in are the app's built-in demo
seed (ids like b_demo01), not real rows — the real 108 arrive only with a session.
THE DEFECT: the person had chosen Arabic (the app keeps that in localStorage 'dbLang' and was still in
Arabic after the reload), yet the sign-in form was English apart from the two brand lines — labels, hint,
button, "Forgot password?", "Working…", and every message. js/02 builds the form before any layer runs,
but that key is readable then, so the form, the boot splash, the first-login ("Choose your own
password"), recovery ("Set a new password") and switched-off ("Access not active yet") screens now follow
it; English stays the default and is unchanged; the email and password boxes stay left-to-right. Live
re-run after the change: Arabic form after sign-out.
Guard: scripts/qa/probe-signin-form-arabic.mjs (6 checks — Arabic labels/button/link, RTL card with LTR
inputs, Arabic messages, default English unchanged, nothing sent to the auth endpoint, 0 JS errors;
SABOTAGE-VERIFIED: 3 FAIL / exit 1 with the js/02 edit stashed; port 9056; in battery.txt). Gates:
structure OK, probe-integrity OK, decisions-wired OK.

## Routine fire #71 (2026-09-17 00:11 UTC) — every page opened by its address BEFORE sign-in, live: two more loaders cached an empty anonymous answer — the Settings backup list (deep link only) and the company identity registry (EVERY session) — both FIXED (core-06, js/66)
Fires #56 and #70 were the same bug on two pages, so this round asked the question of all of them:
scratchpad/live-deeplink-sweep.mjs opened the REAL app at each of 16 addresses (events, archive, documents,
offers, settings, ops, reports, vendors, sopsla, airlines, projects, today, leads, clients, finance,
activity) before signing in, logged every database read that went out with the anonymous key and how many
bytes came back, signed in, landed on the page, and logged which of those tables were asked again with the
session. Read-only: 0 writes. Every page asks for contacts, activities and app_settings anonymously at boot
(2 bytes back) and asks again after sign-in — fine. Three tables were asked anonymously and never again:
company_identity (on every page), app_state_bak (Settings) and ksa_events / ksa_event_signups (Events).
Measured on screen, deep link vs the normal path (scratchpad/live-deeplink-three.mjs):
- EVENTS: fine both ways (80 in the table, the same 47 "still ahead" rows on screen) — the tab reloads.
- SETTINGS (deep link only): "Backup & restore" showed 0 tagged backups and 0 history rows and treated the
  admin as not-admin for the whole session; from the home page the same account saw 95 tagged, 20 history,
  admin. core-06's bkFetchAll drew the card during boot with no session — [] and "no user → not admin",
  both cached. FIXED: with no session nothing is cached (loaded stays false), so the render after sign-in
  fetches for real; the signed-in half is unchanged (bkFetchAllSigned).
- COMPANY IDENTITY REGISTRY (every session, however opened): the Generator's "Company assets & registry"
  read "The registry is empty or could not be read." — 29 rows live — and the AGENCY hydration that puts
  the VAT number and IBAN on invoice previews (and seeds the ZATCA QR) ran with nothing: VAT 0 chars, IBAN
  0 chars. js/66's eager timer ticks every 1.5 s from page load, so its first tick came at the sign-in
  form; the anonymous [] was stored as DG.rows (truthy), the timer stopped, and every later
  loadRegistry() returned early on "rows already loaded". FIXED: with no session the loader stores nothing
  and the timer keeps ticking; its 40-tick give-up counts only ticks made with a session. Live re-run:
  29 rows on the assets page, VAT 15 chars, IBAN 24 chars, on both paths. Fire #66's Generator pass
  counted editor fields, not registry rows, which is how this was missed then.
Guards: scripts/qa/probe-settings-backups-signin.mjs (5 checks; port 9055; SABOTAGE-VERIFIED 4 FAIL with the
core-06 edit stashed) and scripts/qa/probe-identity-registry-signin.mjs (5 checks on the NORMAL sign-in
path, since that is where it bit; port 9054; SABOTAGE-VERIFIED 4 FAIL with the js/66 edit stashed). Both
answer an anonymous-key read of their tables with [] the way the real database does, because the mock
knows no sessions. Both in battery.txt. Gates: structure OK, probe-integrity OK, decisions-wired OK.
LESSON for the playbook: any loader that can run before sign-in must check the session before caching —
the database's honest [] for an anonymous caller looks exactly like "no data". Four loaders have now had
this (js/16, js/63, core-06, js/66); the sweep script above is the way to find the next one.

## Routine fire #70 (2026-09-16 22:11 UTC) — Activity & Audit and the lead card's "Recent changes" driven live EN+AR+phone, read-only: the undo path is honest; the /activity deep link cached an EMPTY log for the whole session — FIXED (js/63)
scratchpad/live-activity.mjs against the REAL database, read-only by construction: 0 save() calls, 0 write
requests, and the undo_change RPC intercepted (never reached the database — 0 calls). EN then AR, 1440 px
and 400 px.
CLEAN: every one of the 339 history rows names its kind and action (Arabic on the Arabic page), a record
name where the record has one, and the changed fields in words — no raw column keys, no camelCase, no
NaN/undefined, no bare "unknown" (the direct-database-change explanation from fire #49 holds); Undo is
offered exactly on rows younger than 24 h of an undoable kind that are not "create" and not already
undone (0 mismatches against the raw table, both languages); older undoable rows say "past the 24-hour
undo window"; the Undo click (exercised directly on the oldest undoable row, since nothing undoable
happened in the last 24 h) opens js/57's confirm box — «التراجع عن هذا التغيير؟» / Cancel «إلغاء» /
Confirm «تأكيد» — and Cancel closes it and sends nothing; nothing scrolls sideways at 400 px (rows fit
their card); the lead card's "Recent changes" / «التغييرات الأخيرة» fills with ≤5 rows under the same rules.
THE DEFECT: opening the app at the /activity ADDRESS before signing in rendered the page during boot, so
its history query went out with the anonymous key, the database answered [] with no error, that [] was
cached, and the page read "No activity yet." with 0 / 0 / 0 tiles for the whole session — 339 rows live —
until somebody pressed Refresh. Started from the home page the same session loaded all 339 (diagnosed
with scratchpad/live-activity-diag.mjs: the first record_history request left 797 ms after boot with the
publishable key and came back 2 bytes; the post-sign-in one came back 643 KB). Same shape as the Finance
deep-link bug of fire #56, same cure: js/63 histLoad now leaves the rows null while there is no session,
waits for it, then loads once and re-renders. Live re-run after the fix: 0 findings.
CORRECTION to fire #68's open item (1): the "stage change" line the refused save left was written to
DB.audit, the browser-side array in the app_state blob — and js/53's own header says that array is dead:
js/63 replaced Activity & Audit with the database's record_history, which a trigger writes only when a
write actually lands. So the visible log never recorded the refused change; the worry was misplaced.
What remains true, for a later round: js/53 still grows DB.audit (capped at 800, ~142 KB) on every lead
change and that whole section is re-uploaded each time — dead weight, not a screen defect. Also seen in
the data: the 43 rows written today are all "Page access · Refused" lines from this session's role
drives (the QA account bouncing off ungranted pages) — real events, honestly logged, QA noise.
Guard: scripts/qa/probe-activity-deeplink-signin.mjs (5 checks — signed out at /activity nothing is
cached as empty; after sign-in from that address the rows appear and the tile counts them; the normal
path is the control; 0 JS errors; the probe answers an anonymous-key record_history GET with [] the way
the real database does, since the mock knows no sessions; SABOTAGE-VERIFIED: 3 FAIL / exit 1 with the
js/63 edit stashed; port 9053; in battery.txt). Gates: structure OK, probe-integrity OK, decisions-wired OK.

## Routine fire #69, second half (2026-09-16 ~20:50 UTC) — full battery re-run at 039829e after fire #68: ALL 205 probes green
Everything in scripts/qa/battery.txt (the 204 of fire #67 plus probe-operations-role — 205 named, 205 logged),
four foreground slices three at a time, ~32 minutes, 0 failures, 0 timeouts, 0 missing files. Covers the
code touched since #67: js/49 (the Operations row, the activity-log guards, the badge wording). probe-live2
(the real-backend probe) ran inside the battery with exit 0, but the one output line the slice runner keeps
was a bare Node version trailer instead of its usual summary; re-run alone straight afterwards it printed
22/22 PASS, 0 page errors, and both cleanup steps (the upload and the blank draft) confirmed against the
database — app_offers 0, no live-check file in storage, QA account admin. The scratchpad runner now keeps
each probe's full output as well as its last line, so a trailer like that can be read next time instead of
re-run. Nothing to re-run.

## Routine fire #69 (2026-09-16 20:11 UTC) — the Business-development (bd) role driven live EN+AR, screen + database: 0 defects; every role the database knows has now been driven
scratchpad/live-bd.mjs: the QA account set to role=bd with an 8-page matrix (today/leads/clients/offers/
documents/ops/finance editor, reports viewer), driven against the REAL database EN then AR, restored to admin
afterwards (re-checked). The database rule for bd (pg_policies): may write businesses, contacts, client
profiles, offers, requests, activities, projects, bookings, funnels, promo codes, generated documents; finance
tables per the page matrix; may NOT write airlines / providers / sops / slas / expenses / transactions /
receipts — which never bites, because the app keeps those four reference sets in the app_state blob, and
save_state_patch admits bd. On screen: chip "Business Development" / «تطوير الأعمال»; canDo says yes to leads,
proposals, requests, activities, finance and promo (matches the database); the company editor, quick-edit,
Log activity, New request and the request editor all OPEN (closed without saving; the two entry points that
write on click, setLeadStage and newOffer, were deliberately not called); Proposals offers "New offer";
Finance loads 91 rows with the Import tab; all 8 granted pages land in both languages with no NaN/undefined
and no stray read-only badge; the 7 ungranted pages bounce to Today; 0 write requests left the browser.
Database from the browser: activities insert accepted (removed again), app_role() = bd, can_edit_page
(finance) = true. NOT a defect: Proposals is granted in the matrix but absent from the sidebar — that is the
2026-08-25 owner ruling in core-08 (V25_PRIMARY: Proposals left the main menu once the Generator existed; the
page stays reachable at /offers, and it landed fine here). The one real account that has Proposals granted
(the manager) is in the same position by the same ruling. No code change this fire. With viewer (#61),
team_member (#56), operations (#68) and bd (#69) driven live, every role the database understands has now
been checked screen-against-policy.

## Routine fire #68 (2026-09-16 18:11 UTC) — the Operations role driven live EN+AR, screen + database: the screen's own permission table disagreed with the database for this role — FIXED (js/49); the Operations badge now says what the role really covers
Nobody holds this role today, so it had never been driven. scratchpad/live-operations.mjs: the QA account set to
role=operations with an 8-page matrix (today/leads/clients/ops/finance/vendors/sopsla editor, activity viewer),
driven against the REAL database EN then AR, restored to admin afterwards (re-checked: role admin, page_access
null). What the database says about this role (pg_policies, read the same day): may write requests, activities,
projects, bookings, SOPs/SLAs, suppliers, airlines, expenses/transactions/receipts; may NOT write businesses,
contacts, client_profiles, offers, promo codes. Confirmed live from the browser: a companies update matched 0
rows, a contacts insert and an app_offers insert were refused (403 RLS), an activities insert was accepted (and
removed again), app_role() = operations.
THE DEFECT: js/49's CAN table — the one that decides which buttons work — said operations may write leads AND
proposals. So the company editor and the quick-edit form opened, a stage change moved the lead on screen and
fired a save, the database refused it, and the person got "That change was not saved" plus a reload: the exact
screen-lies / database-refuses pattern that layer was written to stop. Worse, the app had already appended a
"stage change" line to the audit log (which lives in app_state, and app_state IS writable by this role), so the
Activity & Audit page recorded a change that never happened. Activity logging has the same problem in a
quieter form: the app logs activity by pushing onto the company row and saving THAT row, so it is refused for
operations even though the separate `activities` table is open to them (the app only ever reads that table).
FIXED in js/49: operations = {leads:0, proposals:0, requests:1, activities:0, finance:1 (the per-person matrix
and can_edit_page decide), promo:0}; the activity log's own three entry points (logActivity / editActivity /
removeActivity) added to the companies guard (they were never in it — any role restricted on companies could
reach them); the badge and the "you can still…" sentence now say requests, suppliers, SOPs and service levels
instead of promising activity logging. Live re-run after the fix: every company / proposal entry point refused
in words in both languages, the request editor still opens, 0 write requests left the browser, 3 findings that
were only the script's own stale expectations. The false audit line my drive left ("QA Test Account · stage ·
<a real company>: Prospect → Contacted", the newest entry) was removed from app_state.audit by its id (799
entries now; app_state_history rows 2287/2288 hold before/after). NOT a defect: the three granted reference
pages "missing" from the sidebar were under the collapsed "More (n)" toggle (core-08 buildNav) — the live
script now opens it first.
OPEN (owner-level, not changed): (1) the audit log records a change at the moment it is attempted, not when the
database confirms it — a refused save still leaves an audit line for any role the matrix restricts; the fix
belongs in the audit layer (write the line after the save succeeds, or mark refused ones), a bigger change
than this round. (2) `activities` is a table the database opens to operations but the app never writes to; if
the owner ever wants operations people logging activity, the app's activity log must write to that table
instead of the company row.
Guard: scripts/qa/probe-operations-role.mjs (7 checks — canDo agrees with the database; EN and AR refusals in
words with no editor and no stage move; 0 writes to the companies table; the request editor opens; the badge
wording; 0 JS errors; SABOTAGE-VERIFIED: 5 FAIL / exit 1 with the js/49 edit stashed; port 9052; in
battery.txt). Gates: structure OK, probe-integrity OK, decisions-wired OK.

## Routine fire #67 (2026-09-16 16:11 UTC) — full battery re-run at edda6aa after fires #64–#66: ALL 204 probes green
Everything in scripts/qa/battery.txt (the 201 of day 4 plus the three guards added since: provider-caps-arabic,
sla-head-arabic, ingest-title-arabic — 204 named, 204 logged), four foreground slices three at a time, 31 minutes,
0 failures, 0 timeouts, 0 missing files. probe-live2 (the real-backend probe) ran inside this battery with its
new self-cleanup step and left nothing behind. Covers the code touched since day 4: core-03 (capability chips,
SLA head), core-06 (ingest titles), probe-live2. Nothing to re-run. No code change this fire.

## Routine fire #66 (2026-09-16 14:11 UTC) — the Events add/edit form, the three ingest forms and the Generator's six tabs driven live EN+AR+phone: all honest; the ingest forms' title was English on the Arabic page — FIXED (core-06, the definition that actually runs)
scratchpad/live-forms-generator.mjs, real database, read-only (0 save() calls, 0 write requests), EN then AR,
1440 px and 400 px — forms opened, read and closed, never saved.
CLEAN: EVENTS "Add event" / "Edit event" (20 fields, 21 labels) fully Arabic on the Arabic page («إضافة فعالية»
/ «تعديل فعالية»), Cancel closes; INGEST invoice (9 fields) / booking (14) / offer (4): every label Arabic on the
Arabic page; GENERATOR: all six tabs (assets, price offer, service fees, company profile, contract, tender)
render with 14–54 fields, no NaN/undefined, the price-offer preview draws its page, Home returns home; the
Latin left on the Arabic Generator is client names in the pickers, the document's own English-language
column heads (the document language is a separate choice from the page language) and the "English" toggle;
nothing scrolls sideways at 400 px; 0 JS errors.
THE DEFECT (AR): the ingest form's TITLE — "Ingest invoice / Ingest booking / Ingest offer" — and its file note
were English on the Arabic page while every label inside was Arabic. Bilingual now («إدخال فاتورة / إدخال حجز /
إدخال عرض»). Lesson kept: core-05 defines ingestModal and core-06 (v18) REPLACES it — a first edit to core-05
changed nothing on screen (the mock probe caught it before commit); the fix lives in core-06 and core-05 was
left untouched.
Guard: scripts/qa/probe-ingest-title-arabic.mjs (4 checks — EN titles intact, AR titles Arabic, the fields
unchanged in both languages, 0 JS errors; SABOTAGE-VERIFIED: 1 FAIL / exit 1 with the core-06 edit stashed;
port 9051; in battery.txt). Gates: structure OK, probe-integrity OK, decisions-wired OK. Live re-run after the
fix: 0 findings, Arabic titles on all three forms.

## Routine fire #65 (2026-09-16 12:12 UTC) — Today's quick-create tiles, the SOP & SLA page and Team & Access driven live EN+AR+phone: all honest; one Arabic head fixed (core-03); and the REAL cause of the blank proposal drafts found — a battery probe that writes to the live workspace — FIXED (probe-live2 now removes what it creates)
scratchpad/live-today-sop-team.mjs, real database, EN then AR, 1440 px and 400 px.
CLEAN: the four Today tiles do what their labels say — "Import invoices" lands on Finance → Import, "New
booking" opens the ingest form, "New offer" opens a proposal editor, "Search / commands" opens the palette — in
both languages; SOP & SLA: both tabs render (22 SOPs, 14 service levels = DB), the SOP editor opens with its
7 fields for an existing and a new SOP and closes without saving, the tab labels and SOP editor are Arabic on
the Arabic page; TEAM & ACCESS (admin): the overlay lists all 11 active accounts with their roles (my first
count said 10 — one address is on a different domain; corrected), Arabic role words on the Arabic page, 11
per-page selects and the toggles present, nothing touched; nothing scrolls sideways at 400 px; 0 JS errors.
1. **AR: the Service Levels table's brand column read "DIRECT BUSINESS"** while every other head was Arabic.
   It now reads «دايركت أعمال», the sidebar's own words. EN unchanged.
2. **The blank proposal drafts came from the battery, not from a person.** "New offer" saves a draft the moment
   it is clicked (by design — the owner's 2026-09-02 ruling: a click on that button IS the intent; only the
   stray "N" key asks first), so my two tile clicks left two blank drafts — and a THIRD blank draft was there
   already, stamped 08:21 today, exactly when battery slice 2 started. scripts/qa/probe-live2.mjs is the one
   real-backend probe in the battery: when the live workspace has no proposal it creates one to test the
   storage upload, removes the uploaded file (since round 55), but never removed the DRAFT. Every battery run on
   an empty proposals list left a blank "DB-xxxxxx" in the owner's real list — the DB-334490 removed in fire
   #55 was the same. FIXED: the probe now removes the draft it created the way the app's own Delete does and
   checks against the database that it is gone (22/22 on a real run, "left: 0"). The three blank drafts
   (DB-554850, DB-907233, DB-933676, all by the QA account, all empty) were removed through the app's delete
   body; app_offers is 0 again and no live-check file was left in storage today.
Guard: scripts/qa/probe-sla-head-arabic.mjs (4 checks; SABOTAGE-VERIFIED: 2 FAIL / exit 1 with the core-03
edit stashed; port 9050; in battery.txt). probe-live2's new step is itself the guard for #2 (it fails if the
draft is still in the database after removal). Gates: structure OK, probe-integrity OK, decisions-wired OK.

## Routine fire #64 (2026-09-16 10:11 UTC) — Airlines and Providers INTERACTIONS (search, sort, detail, record dashboard, editor, select-all export) and the top-bar global search driven live EN+AR+phone: all honest; one Arabic gap — the seven provider capability chips were English — FIXED (core-03)
scratchpad/live-reference-detail.mjs, real database, read-only (0 save() calls, 0 write requests), EN then AR,
1440 px and 400 px.
CLEAN: Airlines 136 rows = DB, Providers 23 = DB; the in-page search narrows a real name to exactly the DB's
match and keeps its text; every sortable head (5 / 3) flips the order and the name sort is alphabetical; a row
click opens the record (6 / 8 cards), its "Dashboard" view renders, the editor opens with 32 / 30 fields and
closes without saving; select-all + Export gives "…-summary-selected.csv" with exactly the selected rows (136 /
23) in both languages; GLOBAL SEARCH: a real fragment lists typed results (Airline + SOP), the type words are
Arabic on the Arabic page, picking the first result opens that airline's card and clears the box, a nonsense
query says "No matches" / «لا نتائج»; nothing scrolls sideways at 400 px; 0 JS errors; 0 dirty text.
THE DEFECT (AR): the provider card's servicing-capability chips and the editor's checkbox labels — Book /
Reissue / Refund / EMD / Seats / Bags / Split PNR — were English on the Arabic page. The stored key stays
English (caps[c], nothing about the data changes); the word on screen now follows the page language, the two
codes (EMD, PNR) stay as codes. EN unchanged (the editor upper-cases its labels by CSS, as before).
Guard: scripts/qa/probe-provider-caps-arabic.mjs (5 checks — EN chips and labels intact with English checkbox
values, AR chips and labels Arabic with the English values kept, 0 JS errors; SABOTAGE-VERIFIED: 2 FAIL /
exit 1 with the core-03 edit stashed; port 9049; in battery.txt). Gates: structure OK, probe-integrity OK,
decisions-wired OK. Live re-run after the fix: 0 findings.

## Routine fire #63 (2026-09-16 08:11 UTC) — full battery re-run at bda50f7 after seven fires of changes: ALL 201 probes green
Everything in scripts/qa/battery.txt (196 from the day-3 run plus the five guards added since: finance-deeplink-
signin, export-menu-honest, finance-links-race, reports-arabic-chrome, leads-funnel-dropdown, card-invoice-count —
201 named, 201 logged), run in four foreground slices three at a time, 32 minutes, 0 failures, 0 timeouts,
0 missing files. This covers the code touched since day 3: js/16 (sign-in wait), js/41 (links race), js/60 and
js/73 and core-05 (exports), core-10 (Reports Arabic), core-02 (dashboard, funnel dropdown, empty-activity
line, invoice count). Nothing to re-run. No code change this fire.

