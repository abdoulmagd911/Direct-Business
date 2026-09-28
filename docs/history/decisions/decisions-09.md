**D14 — Speed: one question one answer, one paint per redraw, the scripts inside the page (oversight's finding B,
2026-09-27).** Measured live on Today as the QA account before the change: 108 script files requested one by one, 62
database calls (17 of them the exact same read asked again by another layer), a layout-shift score of about 1.0 (the page
jumped 24-33 times while loading; under 0.1 counts as good). Three changes, none of which changes what the app does:
- **One question, one answer** (js/01, the one shared database client): an identical READ — same address and filters, same
  person, same paging — shares one answer while the first is on its way and for 0.8 s after. Any write (a table, any other
  function, storage, an edge function) forgets every shared answer, so a read after a save always goes to the database; a
  failed answer is never shared; sign-in calls are never shared; and "who am I / what may I see" (app_role,
  my_page_levels) is never shared, because it is how js/55 notices a session that lapsed mid-use. `window.__sharedReads.hits`
  says how many were shared. **Why 0.8 s and not 2.5 s** (the full battery, 2026-09-27): at 2.5 s four real behaviours broke
  — a layer that re-asks on purpose because it knows the data just changed (activities arriving after a logged call, a
  person just invited, a card re-reading its contacts, the lapsed-session check) got the answer from before the change.
  With the change: those four pass, and a Today load still shares 1-11 of about 50 reads (it depends on how the reads bunch).
  The layout-shift score with js/116: 0.04-0.39 over 13 runs on the stand-in, against about 2.0 with it switched off — the
  probe's line is 0.5.
  js/20 no longer re-asks for the signed-in person at 3 s and 8 s when the first answer landed.
- **One paint per redraw** (js/116): the short timers (≤ 250 ms) the layers set while a redraw runs — the way they add
  their pieces after render() — are run in their order and spacing at the end of that task, before the browser paints; so
  a redraw is painted once, finished, instead of bare and then pushed about. A long timer stays a real timer; a cancelled
  one does not run; each also stays a real timer until run; an error still reaches the page. It collects until the end
  of the TASK, not until render() returns, because the layers that attach after js/116 (js/84 at 200 ms, others later)
  sit outside it — and the global render cannot be taken over (a top-level function is non-configurable).
- **The scripts inside the page, at deploy only** (`scripts/build/build-site.mjs`, vercel.json `buildCommand` →
  `outputDirectory: dist`): each `<script src="/js/…">` line becomes an inline script holding that file — one inline
  script PER FILE, in order, so strict mode, hoisting and a file's own load errors stay exactly as they were (core-01
  starts with "use strict"; one merged file would have made every file strict and let a later file's functions hoist
  over an earlier file's code). One request instead of 108, and "unchanged" when nothing changed since the last visit.
  The repository is untouched — index.html keeps its one line per file and every test runs the files as they are; the
  build refuses (and Vercel keeps the previous deploy) on a file that does not compile or one holding both "<!--" and
  "<script". Only css/, brand/ and js/ are published beside the page; docs/, scripts/ and supabase/ no longer are.
- **Not changed, on purpose:** the five `app_*` tables (requests, offers, projects, bookings, invoices) that Today loads.
  They are not retired — js/35 keeps those five sections of the app in them (read at sign-in, written on every save), and
  Today's own note (js/84), Offers, Clients, Reports and the Archive read them. All five are empty since the reset. Whether
  those sections ARE retired is the owner's call; until then they load.
After, same conditions: 46 calls; layout shift 0.17-0.31 live and 0.07-0.17 on the stand-in — what is left is the top
bar and the menu settling in the first second after sign-in. Guarded by `probe-one-question-one-paint` and
`probe-the-built-site-runs-the-same` (both sabotage-tested).
*Date: 2026-09-27. Status: ACTIVE (merges on the oversight's review, P6).*

**D8 — Abdulrahman's logins, in his own word (2026-09-25): `aboelmagd@directksa.com` is his admin account
and the one that belongs on the team list.** `business@directksa.com` is a login he keeps (untouched), not
the person on the team list; `a.hassan@directksa.net` is his Team-Member test view. One human, one team-list
entry — and it is aboelmagd@. `ahmed.aboelmagd@directksa.net` is a **separate employee** with his own entry;
the shared surname is not a second login of the owner.
**Why this is written down:** CLAUDE.md said business@ was his "primary account", and on 2026-09-25 the team
list was built on that line (business@ added, aboelmagd@ removed) — then corrected the same day on the owner's
word. Applied live the same day: aboelmagd@ added to the team list (Commercial), business@ taken off (nothing
pointed at its entry — no tasks, projects, comments or heads), and the one owner-name preference that sent
his name to business@ now sends it to aboelmagd@, so the 3 companies assigned to him are owned by aboelmagd@.
Before changing anything about his accounts again, check here.
**27 Sep (owner decision 3, D13):** business@ is now the **QA test account** — admin, on the team list, renamed "QA Account";
the rest of D8 (aboelmagd@ is him, one human one team-list entry) stands.
*Date: 2026-09-25. Status: ACTIVE (business@'s part superseded by D13, 2026-09-27).*

**D9 — Everything in the app today is test data; at go-live it is reset to zero and the correct data is loaded
fresh (the owner's word, 2026-09-26).** Some of today's rows came from Direct Payments and Direct website
reports, but nothing is in real use yet. After the build is finalised, all business data and logs are wiped and
the correct data enters fresh — only through the importer and the Direct Payments sync (the provenance rule).
**What this changes:** nothing old needs carrying over. The achievements still held in a browser and the KPI
"actual" numbers typed by hand are test data — the owner does not press "Move them" (js/111 keeps the button
for anyone who wants it, harmless), and release 3 does not move browser KPI numbers.
**What it does NOT change:** no safety work is skipped because the data is test data — every rule (levels, row
rules, guards, history, provenance, M1 money doctrine, rule 7) must hold the day real data arrives, and each
release is still tested as if the data were real. The reset itself is a release of its own (docs/BACKLOG.md
"Go-live reset"), built and tested like the others and run only on the owner's explicit go, on the day.
**Owner's order of 26 Sep, carried out 2026-09-27:** "Reset now (approved)" — a full backup first (every public table,
12,299 rows, in the private storage bucket `golive-backups`, stamp `20260927T070142Z`, each file read back and proved
restorable row for row; a second copy was kept on the working machine), a dry run with counts per table (1,511 rows
would go, 10,788 stay, no kept table changed), then the wipe (`scripts/sql/golive-reset.sql`, `golive_reset(true)`):
business records, the finance mirror, tasks/achievements/reports, and the logs; logins, levels, the team list, KPI
definitions and targets, lookups, settings, reference registers and every old backup table kept. **The FINAL go-live
reset still needs the owner's go on the day** — the same function runs it.
*Date: 2026-09-26. Status: ACTIVE.*

**M84 — what someone typed into a funnel form can be found by typing it into a search box.**
Found 2026-09-24 (fire #240) by counting the live database rather than reading the code. The app
asks each company its funnel's own questions — MoT licence and IATA numbers for a travel-trade
lead, tender value and deadline for a tender, the Direct Payments customer number and last invoice
number for a past-invoices lead, where an outreach lead was met. **88 of the 108 live companies
carry at least one answer, and 136 of the 142 answers in the fields worth searching could not be
found by typing them into any box in the app.** Two of the 136 are the link keys to the money
system — a Direct Payments customer number and an invoice number — so a colleague holding an
invoice could not get from it to the company that was billed. Re-counted after the fix: **0 of 142**.
The cause was one function, and that is the point of M38: `recordHay` (core-01) is the single
haystack the top-bar search, the Leads box, the Clients box and the command palette all share, so
one omission blinded all four and one line fixed all four. It was built from the company's own
fields and its contacts; funnel answers live in their own store (`funnelDetails`) and were simply
never added — the same shape as fires #113 and #214, which added notes, website and the contacts'
phones. The company's OWN phone has the same story: the Website-Form funnel asks for
`official_phone`, which is nobody's contact record, so the digits rule in `phoneHay` never saw it
either. Both read the funnel store now.
**Only things a person could type are taken.** A yes/no answer would otherwise put the word "true"
into every record that answered one, and a nested blob would put "[object Object]" there — a box
that matches everything is worse than one that matches nothing, so booleans and objects are skipped
and that brake is guarded, not assumed.
Guard: `scripts/qa/probe-a-funnel-answer-can-be-found.mjs` — sabotage-verified twice: the answers
taken back out (five boxes blind again) and booleans let in ("true" matching every record).
*Date: 2026-09-24, js/core/core-01-foundation.js. Status: ACTIVE.*

**M83 — a gap between the money figures is named for what it is, and the page never quotes a date
it cannot read.** Found 2026-09-24 (fire #238) by handing Finance malformed rows with a 200.
The money screen read: *"Each figure above is rounded on its own, so -2,100 minus -7,700 reads as
5,600 where Profit reads 5,799."* A **199-riyal** contradiction explained as a display artifact, on
the one page where M1 says cost, profit and revenue must always be clean. The note was written for
rounding — which can move each figure by less than half a riyal and no more — but fired on any
mismatch. A gap of a riyal or more is now named as what it is: the stored numbers disagreeing, with
its size and the count of rows it comes from. **A genuine rounding gap still gets the rounding
sentence**, which is true and useful, and that brake is checked — a reworded warning that swallowed
the real case would be no better than the original.
The same run had the header claim **"data through 32/13/2026"**: the cutoff was the last value after
a plain string sort, so one unreadable date won and the page announced a cutoff the data never had.
Only dates the app can actually parse are considered now.
**Neither fault is biting today** — the database trigger keeps every live row honest and all 46 were
re-counted — and that is said plainly rather than dressed up. This is the money page refusing to
mislabel the day that changes.
Measured in the same sweep and already right, so nobody re-tests them: a row carrying text where a
number belongs is counted as zero **and said** ("an unreadable amount (not a number) — counted as 0
here. Check the import."); nothing prints NaN, undefined or Invalid Date in either language; and no
VAT figure appears anywhere on the screen.
Guard: `scripts/qa/probe-a-money-gap-is-named-for-what-it-is.mjs`.
*Date: 2026-09-24, js/16-finance-ledger.js. Status: ACTIVE.*

**M82 — a record the app cannot read costs that record, not the list; and a shorter list says so.**
Found 2026-09-24 (fire #237) by handing the app five malformed rows with a 200 — the shapes an
import or a hand-written SQL update really produces: a null name, a stage that is not a stage, text
where a number belongs, "32/13/2026" in a date, and **a null inside an activities array**.
The app ended with **zero companies**. Not five, not four — none. `__bizTableLoaded` was never set
and nothing on screen said why; the only trace was a console warning nobody reads: *"v32 load merge
issue TypeError: Cannot read properties of null (reading 'date')"*. `rowToApp` assumed every entry
in an activities array is an object, the throw escaped `rows.map(rowToApp)`, and the outer try/catch
swallowed it. **One unreadable row would have taken all 108 real companies with it.**
Three things were wrong and all three are fixed: the converter no longer assumes an activity is an
object; the loader maps each row on its own, so a row it cannot read is skipped rather than fatal;
and a skipped row is **counted and said**, because a quietly shorter list is the fault this codebase
keeps paying for (M27, M74). The same null also killed a render wrapper in core-02 — two null-unsafe
copies of the same sort, both guarded now.
**A second defect fell out of the same run, and it was in both languages**: `fmtAgo` assumed it was
given a number, so a record carrying "soon" as its last contact made every branch fall through to
`Math.round(NaN)` and the Leads list read «قبل NaN ي» in Arabic and "NaNd ago" in English. A value
that is not a usable instant is not a time ago, so it renders as nothing and the column shows its
own dash. **The English half was nearly missed** because the check looked for NaN with a word
boundary and "NaNd" has none — the regex is widened, and that is worth remembering for any check
that hunts for a bad token.
Recorded from the same sweep, all measured and all honest, so nobody re-tests them: **Finance**
prints no figure at all when its read fails; **documents** print "the company details come from the
registry" rather than a CR number when the registry read fails; **Events** says it could not
*refresh* and shows what it has; and a failed **role** read reveals the app rather than locking
anyone out, retrying every five seconds — deliberate, and it stays.
Guard: `scripts/qa/probe-one-bad-record-costs-one-record.mjs`.
*Date: 2026-09-24, js/02 + js/core/core-01-foundation.js + js/core/core-02-leads.js + js/105. Status: ACTIVE.*

**M81 — the examples this app ships with are never shown as the company's data, and no verdict is
given over records that did not arrive.** Found
2026-09-24 (fire #235) by failing one request against the real database. With the `businesses` read
answering 500 — or 403, which is what a permission refusal looks like — the Leads page came up
reading **"0 New this month · 57 In pipeline · 12% · Became clients · 8 of 65"**: sixty-five
companies, a full pipeline, stage chips with counts, rows that open. **Not one of them real.** They
are the demo records hardcoded in core-01 ("Falcon Conferences Group", ids `b_demo01`, `b_demo02`)
while the database holds 108 companies, none of them on the screen. The app did print
"Could not load leads: …" above it, and everything under that line was fiction.
**That a person can actually see it was measured, not assumed**: on the failing page the sign-in
overlay is `display:none`, the working area is 2424px tall, and `elementFromPoint` at the centre of
the screen returns app content. Nothing covers it.
**The flag for this already existed and its own comment named the hazard.** js/02 sets
`window.__bizTableLoaded` only once the real rows arrive — *"the one flag that says 'these are the
real rows' … a card computed from it is a not-loaded-yet state shown as a fact"* — and it had been
applied to a single card on Today. Every list still drew the demo set.
Now, while that flag is not set and the app is on screen, the company lists show **nothing** and say
why, quoting the app's own reason when there is one. The demo records are held aside and restored
the instant the real rows arrive, so a slow load costs nothing, and emptying the list cannot cause a
write — js/02 only archives rows that were in its SNAP, which a failed load never fills.
Two brakes carry as much weight as the fix: **a normal load is untouched** (no banner, all 108
records), and **a workspace that genuinely has no companies is not told its data failed** — the
difference M27 is about, in the other direction.
On gates and what not to use for one: `__roleKnown` is the wrong test, because the failure this
guards stops js/02 ever fetching the role; and `#cl_email` is the wrong test too — measured on the
failing page it is still in the document, 43px tall, while the overlay holding it is `display:none`,
because the app emits that form in two places. What is actually being asked is "is the app on screen
in front of somebody", so that is what is measured.
**Extended 2026-09-24 (fire #236), by failing a different read.** With the WORKSPACE read
(`app_state`) refused instead of the company one, Today came up saying **"Nothing urgent. Today is
calm."** and, six lines later, **"Nothing urgent right now — all clear."** — while
`__bizTableLoaded` was false. Fire #211 had already made those two verdicts count the right things
(js/14's `yourDayLists`, M51); what neither of them asks is whether those things are real. That is
this flag's whole job, and the two are joined now: on Today the banner appears and both verdicts
read "Today cannot be judged — your records have not loaded", in both languages.
The banner does not depend on any wording. **Silencing the two sentences does** — they are found by
the words they say — so the guard names them: if the app ever rephrases one, the check goes red
rather than the reassurance quietly coming back.
And a brake that was missing until a sabotage walked through the gap: **it silences the verdict and
nothing else.** Widening the match to every short line on the page passed every check that existed
at the time, which is the shape of a fix that quietly empties the screen it was meant to correct.
There is a check for it now.
Measured the same way and found exemplary — recorded so nobody re-tests it: **Finance**. With its
read refused it prints no figure at all, only *"Could not load: … Nothing was loaded — do not read
any figure from this page until it loads."* That is the standard the rest of this rule is aiming at.
Guard: `scripts/qa/probe-not-loaded-is-not-your-data.mjs`.
*Date: 2026-09-24, js/105-not-loaded-is-not-your-data.js. Status: ACTIVE.*

**M80 — a field a person types follows the blob-wins rule, and a note is never allowed to be a
date.** Found 2026-09-23 (fire #234) while cross-checking the Leads table's empty columns.
`rowToApp` mapped the two next-action fields as `o.nextActionDate = r.next_action_date ||
o.nextAction || null` and `o.nextActionNote = r.next_action_note || null`. Both end in `|| null`,
so a value sitting in the blob was **overwritten with nothing** whenever the column was empty —
exactly the ordering this project already wrote down (the blob wins for what a person edits, the
column wins only for what a pipeline writes; M26 and the reader note in CLAUDE.md). And the date
fell back to the note TEXT, so "Call the finance team" could land in a field the Leads table renders
as a date and compares against today to decide whether it is overdue.
**Stakes, measured before changing anything: nothing is losing anything today.** Exactly one record
in the database carries a next action, it has both the column and the blob, and it is a client. This
is a latent fault fixed while it is cheap, and it is recorded as latent rather than dressed up as a
live one — the distinction rule 4 asks for.
Guard: `scripts/qa/probe-a-typed-next-action-survives-a-reload.mjs`, which drives four rows through
the real load path rather than calling the conversion directly: exposing it on `window` just to test
it would be changing the app to suit the probe.
*Date: 2026-09-23, js/02-direct-business-cloud-layer-login-shared-c.js. Status: ACTIVE.*

**M79 — a value derived for display is marked with the value, and stripped only while it still
equals it.** Found 2026-09-23 (fire #233). The Leads list read "—" under LAST ACTIVITY on **all 78
rows**, and the "no touch in 14 days" highlight fired on **0 of 78** — while **25 of those leads
have a logged activity**. js/02's rowToApp already carries the rule ("if the raw blob never stored
lastContact, take the newest logged activity") but runs at load against the blob alone; those
activities arrive afterwards, from the activities TABLE, through the js/72 bridge. The derivation is
now applied there too. Live, the column went from 78/78 empty to **53/78**, and the gone-quiet
highlight now marks 25 rows.
**The hazard this created, and the shape of the cure.** js/72's own header records what happened the
last time it created a key on a record: js/02 saw 29 untouched companies as CHANGED and rewrote them
with that tab's copy. A derived `lastContact` is exactly that, so it is marked and `stripBridged`
takes it back out at save time — the row still compares equal to what was loaded, and the derived
value never reaches the database.
**The mark carries the VALUE, not a flag, and that distinction was not theoretical**: the flag
version shipped for ten minutes and `probe-activity-edit-remove` went red. Remove an activity and
the app recomputes lastContact from what is left — a real, person-made value — and a plain flag made
the save drop it. A value cannot be wrong that way: the moment anything else sets the field, the two
differ and the real one is saved. Evidence settled which side was wrong, as #111 set down; the probe
was right and the change was corrected, not the probe.
Guards: `scripts/qa/probe-a-logged-call-reaches-the-list.mjs` (the display half and the no-write
brake), `probe-activity-edit-remove` and `probe-no-phantom-writes` (the two that must not break).
*Date: 2026-09-23, js/72-people-bridge.js + js/02-direct-business-cloud-layer-login-shared-c.js. Status: ACTIVE.*

**M78 — a sweep is only as wide as its list, so the list is every route the app answers.**
Found 2026-09-23 (fire #232). `probe-a-page-heading-is-never-english-in-arabic` has guarded the
headings since #204 and was green — over **19 routes, while the app answers 25**. Widening it to all
25 turned it red immediately on the six it had never visited: **/dashboard**'s "Agency profile — KSA
settings" card, whose every other word js/89 writes in both languages, carried an **English heading
above Arabic text**, and four more headings on the same page ("Top relationships by lifetime value",
"Pipeline by category", "Conversion funnel", "Standard of service") were English in Arabic too. Five
defects sitting behind a green check, on a page reachable by address and from Settings.
The list now comes from the same place the reachability diagnostic gets it, so a page cannot be
outside the sweep merely by being outside somebody's memory.
On where each fix went, because the two halves went to different owners on purpose: the card's
heading is written in **js/89**, which already writes every other word in that card and where the
phrase appears nowhere else; the four generic headings went into **js/21's shared dictionary**,
which is what M38 is for. Splitting one card's wording across two owners is how the halves drift
apart; keeping a word used in several places in two dictionaries is the same mistake from the other
side.
Two things checked on the way and worth not re-testing: **every page that draws real content can be
reached by clicking** — the sidebar carries 20 entries including Activity & Audit and Archive, and
the Sync page, which the reachability diagnostic lists as having no way in, is opened by
**Settings → Connections** (M31's lesson again: a sweep of the chrome cannot see a link that lives
inside a page). And the Agency card itself is now exactly right — read-only, sourced, naming the
three fields the registry has no key for, with one button.
Guard: `scripts/qa/probe-a-page-heading-is-never-english-in-arabic.mjs` (now 25 routes).
*Date: 2026-09-23, js/89 + js/21-v27-arabic-column-header-stat-label-transl.js. Status: ACTIVE.*

**M77 — when two people had the same company open, the second one is told.** Found by re-running
`scripts/qa/diag-two-tabs-one-record.mjs` on 2026-09-23 (fire #231): it has reported this since
2026-09-10 and still reproduces. Tab A logs a call note and sets a next action and saves; tab B,
holding a stale copy, changes only the segment and saves 2.5 s later. Afterwards the table holds B's
segment and **A's note and next action are gone** — a green "Saved" on both screens and nothing
anywhere saying a thing was lost. `docs/LANDMINES.md` B.1 parked this as "revisit only if it
actually bites"; it bites, so the silence is closed even though the collision itself is not.
**Why this is a message and not a merge, which matters before anyone calls it half a job.** js/02
already sends only the rows this tab changed. But each is sent as a whole row, carrying this tab's
stale copy of every other field — and the obvious cure, sending only the changed fields, does not
cure it: nearly everything a person edits lives inside the single `raw` blob, which is ONE column,
so two people editing different things about the same company still collide inside it. A real cure
is a three-way merge of that blob inside the save path — the one piece of code where a mistake stops
the whole team saving. That is the owner's call and it is written up in `docs/BACKLOG.md`, not
something to slip into a QA sweep.
js/104 therefore asks the database at save time whether that company has been written since it last
looked, and if so names the company and points at Activity & Audit, where `record_history` holds the
before-image and Undo can put it back for 24 hours. **It never blocks a save and never writes.**
Two things the fix had to get right, both of them checked:
**A false alarm is worse than a missed one**, because the next real one gets ignored — so when
nothing changed underneath there is no message, and an answer that arrives later than 800 ms is
discarded rather than guessed at (past that, this tab's own write may already have landed and would
read back as somebody else's).
**And a record's id inside the app is `legacy_id || id`.** Measured live, only **21 of the 108**
companies carry a legacy_id; the other 87 go by their uuid. The first cut of this layer asked only
by legacy_id and so watched a fifth of the data in silence — caught by driving it against the real
database rather than the harness, where every id has the same shape.
Guard: `scripts/qa/probe-two-people-one-record-are-told.mjs`.
*Date: 2026-09-23, js/104-two-people-one-record.js. Status: ACTIVE.*

**M76 — a refused page visit is not a change to a record, and a page that counts both must say
which is which.** Found 2026-09-23 (fire #230), driven against the real log. `record_history` holds
378 events, **131 of them refused page visits** written by the access trigger. Activity & Audit
counted the two kinds together under labels that promise the second: the **7-day tile read a green
39, and all thirty-nine were refusals** — the honest figure for the week was nought records changed
— and the feed opened with twelve consecutive "Page access · Refused" rows, 129 of the 250 most
recent entries. The page whose whole job is to say what changed was mostly saying what did not.
This is M74 again (a number true of what it counts and false to its reader) on the one page where
it matters most, so it gets its own rule rather than a line in that one.
Each tile now says how much of itself is refusals — "all N were refused page visits — no record
changed" when a window is entirely them. **Nothing is deleted and nothing is
dropped from the counts: this is a view.** That matters twice over. The log belongs to the database
and is not ours to edit — that is the point of an audit trail — and a real person being refused a
page repeatedly is something the owner must still be able to see, so the count stays on screen
whether the rows are shown or not, and a log holding nothing but refusals says so instead of
reading as empty.
**Worth knowing about where these come from:** they are this QA account's own sweeps. Driving the
live app as a restricted role — which is how several of these fires were found — makes the database
write a refusal row. A session that does it is adding to the owner's audit log, and should say so
rather than leave him wondering who was being turned away.
Fixed in the same commit, found while reading the page in Arabic: the quiet note under Today said
«قبل 2 أيام». Arabic counts two of anything with a **dual** form — «قبل يومين» — and past ten takes
the singular accusative; all four cases are now handled.
**CORRECTED 2026-09-24 (fire #241) — the feed opens showing everything.** #230 also gave the feed a
toggle and left it defaulting to HIDDEN, so a third of the audit log (131 of 378 rows) was off the
page on arrival, behind a line most people would never press. The next full battery caught it: two
OLDER guards went red — `probe-audit-names-and-words` and `probe-history-actor-and-sync-words`, both
of which plant a refused visit and check it is named properly ON the feed, and both of which predate
#230 and encode a defect already paid for (fire #53). Three things settled it against the newer
probe: those guards are older and specific; hiding a third of an audit trail by default is the
quietly-shorter-list fault M27 and M74 exist to stop; and **#230's actual finding was the TILES
miscounting**, which labelling fixes and which is untouched. Hiding the rows was scope added on top
of the real fix, and it was wrong. `showDenied` now starts true; the toggle stays for anyone who
wants record changes only, and the one state that would otherwise look empty — every row hidden —
still says why instead of showing nothing.
**The general lesson, which is why this is written up rather than quietly amended:** when a new
probe and an older one disagree, the older one is not automatically right, but it is evidence that
has already been paid for, and a change that turns it red is a finding about the change. Rewriting
the newer probe to match the new code would have buried that.
Guard: `scripts/qa/probe-a-refused-visit-is-not-a-change.mjs` — checks 1-3 and 7 rewritten to hold
the corrected behaviour, sabotage-verified by reinstating the exact regression (`showDenied` left
undefined), which puts four of them red.
*Date: 2026-09-23, corrected 2026-09-24, js/63-undo-and-real-audit.js. Status: ACTIVE.*

**M75 addendum — the sweep, 2026-09-23 (fire #229).** With the rule written, every remaining
clickable column in the app was driven the same way: the **Airlines** and **Providers** tables are
the rest of them, and two of their columns break the rule. **AUTHORITY** collapses whatever
`ticketingAuthority` holds into one of two words — "Authorized" or "Target" — and both are
translated on screen; **KSA BSP** shows a translated Yes / No tag. Ordering the raw value therefore
ordered the Arabic page by the English word underneath, and live it came out backwards: the column
read مصرّح (80) then مستهدف (56), where Arabic puts مستهدف first, س before ص. Yes / No survived only
by luck — لا / نعم happen to fall in the same order as No / Yes. Both now key off the cell text.
Three things this half added to the rule.
**A renderer that needs to know what its own cell will say must ASK the dictionary, never keep a
copy** — js/21 translates a cell after it is drawn, so it now exposes `window.v27Word(en)`
(alongside the older `__STAGE_AR` / `__OPS_STAGE_AR` exports) and the sorter calls it. A second copy
of those two words inside the renderer is the M38 family of bugs waiting to happen.
**A cell holding nothing but a dash belongs with the blanks, not among the values.** Four carriers
store the em dash itself in `stock` rather than leaving it empty, and collation files punctuation
BEFORE digits — so the first version of this fix threw them from the bottom of the column to the
top. Caught by re-measuring, and now a check of its own.
**And equal keys get a tie-break**, so a column with two values does not leave 80 rows in whatever
order the previous sort happened to produce; the Leads table has had one since 2026-08-16 and this
table now does too.
Measured clean in the same sweep and worth not re-testing: Airline, IATA, Stock, Provider, Type and
Availability source all show exactly the value they sort by, in both languages.
Guard: `scripts/qa/probe-the-reference-tables-sort-in-arabic-too.mjs`.
*Date: 2026-09-23, js/core/core-03-reference-ops.js + js/21-v27-arabic-column-header-stat-label-transl.js. Status: ACTIVE.*

