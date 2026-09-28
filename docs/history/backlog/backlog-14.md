## Routine fire #85c (2026-09-18 ~03:30 UTC) — the archive path is clean, and it is the one worth checking
Third area this round, chosen because it is the most destructive-looking thing the app does to real lead
data: removing a company. It does not delete the row — js/02's `pushCloud` collects everything that
vanished from memory and sets `archived_at` on it with a single **bulk** `.in('id', …)`. If that id set
were ever wrong or stale, real leads would disappear from every screen at once. 112 company rows live,
108 unarchived, 4 archived.

Driven live in English and Arabic with the write intercepted (nothing stored — still 112 rows, still 4
archived, nothing archived today). **0 findings:**
- the app holds exactly the 108 unarchived rows, so no archived row leaks into the working list;
- removing one company sends **one** archive update naming **exactly one** row;
- it carries `archived_at` and `archived_by` and nothing else — the record itself is untouched, which is
  what makes it recoverable;
- the Archive page lists exactly the 4 archived rows.

Also confirmed on live data: **none of the 4 offers a Restore button**, and that is correct — 3 were
merged into a surviving company and 1 was removed by the owner's own 2026-08-23 ruling. A plain Restore on
any of them would resurrect a duplicate a merge removed, or undo a ruling. Each row says which it is, in
words, in both languages. (The restore *write* is already driven on the mock by
probe-archive-lists-companies, so nothing new was needed here.)

No code change. Two self-errors worth recording, both in my instrument rather than the app: PostgREST
url-encodes a list filter (`id=in.%28"a","b"%29`), so a regex looking for a literal `(` read **0** ids out
of a filter that in fact held one — and I first clicked the first archived row expecting a Restore button,
which by design is not there. Both were caught by the result being implausible on its face.

## Routine fire #85b (2026-09-18 ~03:00 UTC) — "Role updated" did not take a single page away
Second untested area this round: the **Team & Access** write path, driven live in English and Arabic
against the real roster with every write intercepted (the team tools go through an edge function; not one
call was allowed to reach it). Nothing stored — the app_users fingerprint is byte-identical before and
after, 11 users, roles unchanged.

CLEAN: a level change sends exactly `{"role":"…"}`, filtered to that one person, one write, no native
browser box anywhere in the flow.

**DEFECT — the level box does not decide what it looks like it decides.** The database's own
`page_access(p)` reads ONLY the per-person boxes for anybody who is not an admin; the level plays no part
at all. js/52 does the same on screen once a matrix exists — and all 8 live non-admins have one. Driven for
real: changing the one live manager to **Employee** left **all 10 of their pages exactly as they were**,
including Finance, Settings and Activity & Audit, the three the database itself enforces. The screen said
"Role updated" and nothing else. An admin demoting somebody to take Settings away would have believed they
had, and been wrong — the same shape as fire #68, in the dangerous direction.

The level is not cosmetic: it is what the database checks before letting somebody change records or manage
people (`app_role()`, js/49's table). The two halves of the card do different jobs and the screen never
said so. So nothing about the behaviour was changed — closing pages by surprise would silently undo access
an admin granted on purpose, which is the owner's call, not a side effect. What changed is that the screen
is now honest about it:
- a standing line in every non-admin card: the level sets what they may change and who they may manage,
  the boxes set which pages they can open, and changing the level does not close a page;
- after a level change, a note **in that person's own card** naming the new level, how many pages they
  still open and which of the database-enforced ones are among them. Not a toast — the app's toast is gone
  in 2.4 seconds (core-06's v19toast), which is no place for the sentence that matters. Arabic counts
  3–10 with the plural and 11+ with the singular, so the count reads properly in both.

Also corrected: a load-bearing comment in js/56 said `app_users.role` "has no check constraint". It is the
six-label enum `user_role` (checked live) — the conclusion the comment drew was right, the reason was not.

`probe-role-change-does-not-close-pages` added (8 checks) and sabotage-verified — with the fix stashed, 3
go FAIL, exit 1. Three gates green. One instructive self-error: the probe's first version seeded the QA
admin with a made-up id, so sign-in never resolved the roster row, the panel never painted, and six checks
went red for a reason that had nothing to do with the app.

## Routine fire #85 (2026-09-18 ~02:20 UTC) — adding an event recorded a website signup that never happened
Untested area this round: the Events **write** path. Events had been checked on screen (fire #71) but no
save had ever been driven. There are **80 real events** live, the table has an audit trigger, and two of
its columns are enums — so a wrong value would not be a cosmetic slip, it would be a rejected save. Driven
for real in English and in Arabic: signed in, opened the app's own Add and Edit forms, pressed the app's own
Save, and intercepted every write at the network edge so the row could be read and a refusal simulated
without anything being stored. Confirmed afterwards by SQL: still 80 events, still 0 signups, newest
`updated_at` untouched at 2026-08-13.

CLEAN, both languages: exactly one row per action; the edit filtered to the one event; every column real;
`vertical` and `status` inside the six/four values the database actually holds; priority a real integer;
empty boxes sent as null, not `''`; and editing only the notes changed nothing else on the row.

**DEFECT 1 — a signup that never happened.** The site-login box ("the account made on their website") opens
with "Who signed up" pre-filled with the signed-in person's name, as a convenience. The test for "is there
anything to save here" counted that name — so adding an event with the box **untouched** also wrote a
`ksa_event_signups` row reading "<name> signed up", with no email and no password. That table means one
thing: the account we made on their website. A row with no account on it is a record of something that did
not happen, and it would have happened on **every event anyone adds**. Nothing is wrong in the live data
today — the 80 events came from an import, and there are 0 signup rows — so this was caught before it put a
single false row in. Now an email or a password is what writes the row; the name is still saved alongside
one, and the pre-fill is kept.

**DEFECT 2 — the database's own words shown to the person.** This is the only save in the app that asks for
a single row back, so an RLS refusal never arrives as "no rows": PostgREST answers with error PGRST116, and
the app printed it verbatim — "Could not save: JSON object requested, multiple (or no) rows returned" — in
both languages. Every other write path in this layer (the delete, the site-login upsert) already says it
plainly. Now this one does too: "Not saved — the database refused it (no permission?). Nothing changed." /
«لم يُحفظ — رفضته قاعدة البيانات (لا صلاحية؟). لم يتغير شيء.» The form stays open either way, so nothing
typed is lost.

Re-driven live after the fix: 0 findings, the signup write gone, the sentence in words in both languages.
`probe-events-save-honest` added (8 checks) and sabotage-verified — with the fix stashed, 2 go FAIL, exit 1.
Three gates green (structure 76 files · probe-integrity 224 probes/247 ports · decisions-wired 38 rules).

NOT defects, checked and dismissed: `updated_at` is not sent on an edit, but nothing in the app reads it;
`alert()` in the Team & Access panel is the app's house style (native `confirm()` is what was banished, and
it is gone); the Events RLS policy accepts any signed-in writer while the screen gates on role — js/56's
green-dot list already tells the admin which pages the database enforces, and Events is honestly not on it.

## Routine fire #84 (2026-09-18 ~01:00 UTC) — the battery's one red run down to its cause: signing in tears down whatever you had open on Finance
The battery at HEAD came back 208 of 209, with probe-import-files-count red and reproducing alone — the
same probe fire #79 had noted as "went red under load, green alone, worth watching". It now failed every
time, always on its FIRST file drop (the one right after sign-in) and never on the two later ones.
NOT a regression from this week's changes: it fails at c4b9deb too, the commit whose battery reported
206/206 green. It is an intermittent that has become consistent, which is exactly when a watched flake
must be run to ground rather than re-noted.
MEASURED, after a wrong first theory. The first theory was that the Import tab shows its file input before
js/65's own processing functions exist, so an early drop is swallowed — plausible, and wrong: dumping the
page state at the moment of failure showed all five __v65_* functions already defined. What it also showed
is the real answer: at that moment there is no #finFile and no #finImpOut at all, the whole view is down to
214 characters with no import card, while FIN.tab still says 'import'. The import screen had been torn down
and replaced by the Finance page's "Loading the finance ledger…" card.
THE CAUSE is fire #56's own fix. A ledger asked for before sign-in is no longer cached: the loader waits
for the session and then loads again — and that second load nulls FIN.rows and re-renders, which rebuilds
the Finance page from scratch. Anything the person had open on Finance at that moment is rebuilt under
them; here it detached the file input the probe had just used, so the drop went nowhere.
FIXED IN THE PROBE (my lane): wait for the ledger to have settled, then open Import, then drop. Three runs,
three passes. That makes seven probes in total corrected for this one race — the six on 2026-09-17 and this.
FOR THE OWNER, an observation rather than a defect: for about a second after signing in, opening Finance
shows its loading card again and rebuilds the page. Nothing is lost and nothing is written — the ledger is
simply loaded once properly instead of being cached empty — but if it is ever worth polishing, the place is
js/16's post-session reload, not the importer. Not changed here: the fire #56 behaviour is correct and the
flash is cosmetic.
Gates green. No app code changed this fire.

## Routine fire #83 (2026-09-18 00:11 UTC) — one client, four surfaces: do the figures agree? They do — and the Finance card is a model of the standard this sweep keeps asking for
Every surface has been checked on its own; nothing had yet asked whether the SAME client reads the same
way on all of them. Driven live and read-only (0 writes), comparing for the three largest clients: the
ledger's own totals, the Finance → Clients card, the exported file, and the client's card in Leads. Real
names are not printed here (rule 7); the clients are identified by their position in the ledger.
RESULT: agreement everywhere. For each of the three, the card printed exactly the ledger's revenue, cost
and profit to the riyal (e.g. 599,347 / 485,734 / 113,613 and 179,799 / 147,189 / 32,610), and the two
client cards checked in Leads printed Key-facts invoice counts of 3 and 2 against ledger distinct-invoice
counts of 3 and 2. The card's own Total line reads "Total — all 15 clients, top 10 shown ·
2,030,764 · 1,538,142 · 492,623" — it names how many clients the total covers and how many rows are
shown, and those three figures are the same ones the database returns for the whole ledger (verified by
SQL in fire #75). That is precisely the honesty this sweep has been enforcing elsewhere, already in place.
THREE FALSE ALARMS, all mine, recorded because the habit matters more than the result:
  1. "the export's figures do not contain the ledger revenue" — the Finance export is the LEDGER file, one
     line per invoice (46 + header = 47 lines), not a per-client file. Comparing per-client totals against
     invoice lines was my error.
  2 & 3. "the ledger has rows for this client but the table has no line for it" — for the SECOND and THIRD
     largest clients, which should have been impossible and was the tell. The card prints decorated names
     ("… #3", "The Performance (dha …)", a hyphenated spelling) while the ledger holds the raw
     client_group, so my exact string match missed rows that were sitting at positions 2 and 3. Matching on
     a normalised prefix shows all three.
The scratchpad script now carries all three corrections in its own comments, so a later run does not
re-raise them. No code change this fire: nothing in the app was wrong.

## Routine fire #82 (2026-09-17 22:11 UTC) — a booking saved with the cost box EMPTY was written as cost = 0, which makes the profit the whole sale — FIXED (js/58); and 214,550 SAR of unverified margin is already stored that way
The money write paths had never been audited. Driven live with every write intercepted (nothing stored):
the individual-booking form, the same form with a cost typed in, and an expense.
CLEAN: no row the app writes carries `vat_sar`, `revenue_sar` or `profit_sar` — all three are left to the
database trigger, which is exactly M1. A typed cost of 400 is sent as 400. An expense of 250 is sent as 250.
THE DEFECT: saving an individual booking with the COST BOX LEFT EMPTY sent `cost_sar = 0`. The trigger then
derives profit = revenue − 0, so a 1,000 SAR booking whose cost nobody had entered becomes a 1,000 SAR
profit. That is the rule the owner is most exposed by — "never fabricate a number to fill a gap" — broken
at the point of entry, and it defeats the ledger's own honest-unrecorded machinery.
FIXED: blank now stays null; a 0 the person actually types is still 0, a genuinely free booking. The form
also says what blank means, in both languages ("Blank means not recorded yet — the profit stays blank too.
Type 0 only for a genuinely free booking."). Re-driven live: cost_sar null for blank, 400 for typed.
WHAT THE MEASUREMENT ALSO SHOWED, and it is bigger than the fix: **19 live invoices carry `cost_sar = 0`,
and all 19 store `profit_sar = revenue_sar` — 214,550 SAR of margin nobody has verified, sitting in the
table.** Every screen is honest about it: each place the app decides whether a cost was recorded tests
`(+cost_sar||0)===0`, which is true for 0 and null alike, so the client table prints the words "no cost
recorded" and refuses to show a profit. But anything reading the table directly — an export, a SQL query,
a future report, the owner in Supabase — sees a verified-looking profit. Clearing those 19 rows'
`cost_sar`/`profit_sar` to null is one reversible statement and would change nothing on screen, but it is
real money data, so it is the owner's call and is now written up in DECISIONS.md as OPEN rather than done.
ALSO FIXED, a documentation contradiction this uncovered: DECISIONS.md said "`cost_sar=0` stays an honest
gap" while CLAUDE.md's summary said "leave it null and say why". Both are now reconciled in DECISIONS.md
with the measurement: on screen the two are identical, what differs is the stored profit, new writes leave
it null, and the existing 0s are history awaiting the owner's decision.
Guard: scripts/qa/probe-b2c-blank-cost-stays-unrecorded.mjs (7 checks — blank sends null, the form says so,
a typed cost is kept exactly, neither row carries VAT/revenue/profit, the amount and wallet split are
unchanged, 0 JS errors; SABOTAGE-VERIFIED: 2 FAIL / exit 1 with the js/58 edit stashed; port 9062; in
battery.txt). Gates green, including decisions-wired over the new entry.

## Routine fire #81 (2026-09-17 20:11 UTC) — the app's own "mark as won client" button wrote a client whose STAGE said "new" — FIXED (core-02)
Fire #80's technique — drive a real action live, intercept the write, read what would have been sent —
turned out to be worth pointing at the rest of the write paths, so this round audited three of them:
convert-to-client, a one-field edit, and logging an activity. Nothing was stored (confirmed by SQL after:
0 rows written, the workspace untouched).
THE DEFECT. Clicking "mark as won client" on a lead sitting at Prospect sent:
  is_client=true · raw.isClient=true · converted_date set · **stage='new'** · raw.stage='Prospect'
convertToClient() set the record's `status` but never its `stage`, and the row builder reads `stage`
(appToRow: stage:S2C[o.stage]||'new'). So the app's own button produced a client whose stage contradicted
its client status. This is the sibling of the half-converted record CLAUDE.md warns about: both copies of
the client FLAG agreed — that rule holds — but the stage did not follow. Anything that groups or counts by
stage, the pipeline chips or a stage report, would file that client under "New". The other route to the
same place, setLeadStage('Won'), sets stage AND status and lets the database trigger set is_client, so the
two ways of converting a lead disagreed with each other.
FIXED: convertToClient now sets the screen stage to 'Won' as well (S2C maps it to 'won'). Re-driven live:
the same click sends stage='won', raw.stage='Won', both flag copies true, conversion date set, one row.
NO DATA REPAIR NEEDED, checked rather than assumed: live clients by stage are won:27 and lost:1 (that one
is the owner's own, recorded in fire #78), **zero clients sit at stage 'new'**, all 28 carry a conversion
date, and no record's stored stage disagrees with its column. The existing clients came from imports that
wrote stage='won' directly, which is why the bug never showed in the data — it was waiting for the next
person to use the button.
CLEAN in the same audit: a one-field edit and a logged activity each sent exactly ONE row, the right one,
with the edit present, the activity appended, and no table-sourced people or history written back into the
row (the stripBridged rule). No workspace-blob write followed any of the three actions, which is the
fire #80 retirement holding.
Guard: scripts/qa/probe-convert-writes-won-stage.mjs (7 checks — the conversion really happened through
its own confirm, stage='won', raw.stage='Won', the flag in both places, a conversion date, exactly one
row, 0 JS errors; SABOTAGE-VERIFIED: 2 FAIL / exit 1 with the core-02 edit stashed; port 9061; in
battery.txt). Gates green.

## ✅ 2026-09-17, fire #80 follow-up — THE FIRST FULLY GREEN VERIFIED BATTERY: 206 of 206
scripts/qa/run-battery.sh at HEAD: "battery OK — every probe in the list that can fail exited 0, each red
re-checked alone". 212 entries, 206 that can fail, 6 that only report. No reds, so nothing needed the
serial re-run. This is the first clean run counted by an instrument that can actually go red — the three
verified runs before it were 203/205 (two reds), 203/205 (two different reds) and this one.
CAVEAT, stated rather than glossed: the run started before the js/53 retirement landed, and the new
probe-audit-array-not-reuploaded was added to the list mid-run, so neither was covered by it. Both were
checked by hand instead: all eight audit / activity / history / undo probes plus the new one were re-run
against the changed layer, 9 of 9 exit 0. The next scheduled full run covers them in the normal way.

## Routine fire #80 (2026-09-17 18:11 UTC) — the WRITE path driven live for the first time, with every write intercepted: one lead change was uploading 131 KB of dead weight — FIXED (js/53)
Every live drive in this sweep so far has been read-only, so the most dangerous path in the app — what it
SENDS when somebody saves — had never been driven against the real database. It can be, safely: sign in for
real, perform a real user action, and intercept every non-GET at the network edge, answering it the way the
database would. The app behaves normally, what it would have sent is captured in full, and nothing is
stored. Verified afterwards by SQL that the workspace and the company row were untouched.
WHAT ONE STAGE CHANGE SENT (scratchpad/live-writepath.mjs, a real lead moved Prospect → Contacted):
  · POST businesses — 1,895 bytes, exactly ONE row, the right one, stage 'contacted', no table-sourced
    contacts or history written back into it (the stripBridged rule holds), and
  · POST save_state_patch — 131,273 bytes, whose ONLY section was `audit`.
So the row write is exemplary and the blob write was 70x its size, carrying one thing: the browser-side
audit array. In the stored workspace that section is 142,211 bytes of 478,462 — 30% of the whole blob —
re-uploaded on every lead change and re-downloaded at every sign-in. The sync badge read "Synced 8s ago"
afterwards, which was true of a save nobody needed.
WHY IT IS SAFE TO STOP, checked rather than assumed: nothing reads that array any more. Activity & Audit
moved to the database's own record_history on 2026-08-21 (js/63), which logs every lead create and edit
with the actor and the full before/after row — strictly more than the array ever held, and not editable
from the app. The only other readers are the invoice and booking cards via activityFor(), and those are
inert: the live workspace holds 0 invoices, 0 bookings, 0 offers, 0 requests, and every one of the 799
entries in the array is entity 'lead' or 'session' — there has never been an invoice or booking entry in
it. The in-app self-tests that assert the array is non-empty still pass, because the existing entries are
left exactly where they are.
FIXED: js/53's 4-second sweep — the only thing that grew it in normal use — is retired, with the
measurements written into the file. logAudit() itself is untouched and still available to direct callers.
Re-driven live afterwards: the same stage change now sends the 1,895-byte company row and NOTHING else.
STILL ON THE LIST, deliberately not done: removing the stored 142 KB section would take that off every
sign-in too, but it is a deletion from the owner's live workspace, so it stays a recommendation (item 1,
now with numbers) rather than something I do unasked.
Guard: scripts/qa/probe-audit-array-not-reuploaded.mjs (6 checks — the drive really happened and the row
was saved, the array did not grow, no workspace write carried an `audit` section, nothing was deleted,
Activity & Audit still lists database history, 0 JS errors; SABOTAGE-VERIFIED: the growth check fails,
exit 1, with the edit stashed; port 9060; in battery.txt). Gates green.

## Routine fire #79, second half — the battery at the previous commit: 203/205 again, two DIFFERENT reds, both resolved; and a measured performance item for the owner
Second verified run (scripts/qa/run-battery.sh). 203 green, 2 red — both reproduced alone — plus one that
went red under load and green on its own (probe-import-files-count, noted to watch).
RED 1 — probe-share-view-tidy: "landing on Finance in a shared view is sent to Today". MY OWN DOING, and
worth stating plainly: two probes had disagreed about this behaviour for two days.
probe-share-and-settings-attacks wanted Finance to REFUSE IN WORDS, this one wanted the SILENT BOUNCE I
added in fire #50, and the broken runner meant neither disagreement was ever reported. Fire #78 fixed the
app toward the sentence, which broke this probe. The check's intent — a link holder must never sit on a
Finance page that shows them nothing — is unchanged and is now guarded more strictly: the holder stays on
the page, is told why, and no ledger row is rendered. Probe back to 10/10. LESSON: when changing a
behaviour, grep the probes for the behaviour, not just for the file.
RED 2 — audit-finance-tabs: "EN expenses: slow tab switch — 812ms (freeze-class regression)", against a
flat 800ms budget. Measured three times alone before touching anything: 748ms, 812ms, 815ms. The check was
passing or failing by chance, which is how a red stops meaning anything. THE CAUSE, found and not guessed:
js/45 wraps renderFinance, lets the WHOLE Finance page render, then throws it away and draws the expenses
body — two renders for one tab switch. Three other tabs do the same to a lesser degree (ledger, proofs,
b2c at ~440ms against a ~145ms median). It is not a freeze and it is not new.
WHAT I DID AND DID NOT DO: the budget is now 1500ms, which still catches the freeze it was written for,
and every tab's time is printed at the end of a run so drift is visible. I first wrote a relative rule
(fail any tab over 3x the median) and then REJECTED it, because it fires on the current understood state
and would have left the battery permanently red — that rejection is recorded in the file itself rather
than quietly dropped, and the rule now prints a note instead of failing. I did NOT restructure the render
chain: the tab bar the expenses layer keeps genuinely comes from the render it discards, and several other
layers wrap renderFinance, so the change is not a small one. It joins the owner's performance list:
4. The Expenses tab costs two full Finance renders (~810ms against a ~145ms median); ledger, proofs and
   b2c cost about 440ms for the same reason. Worth one careful session on the renderFinance chain.

## Routine fire #79 (2026-09-17 16:11 UTC) — two screens were showing Arabic dates in the HIJRI calendar while the rest of the app showed Gregorian — FIXED (js/76, js/77)
Where it came from: `toLocaleDateString('ar-SA', …)` does not merely translate the month name, it switches
the CALENDAR. Measured in this browser for one fixed moment, 14 March 2026 09:05 UTC:
  'ar-SA' → ٢٥ رمضان ١٤٤٧ هـ      (Hijri, Arabic-Indic digits)
  'ar'    → 14 مارس 2026          (Gregorian, Arabic month name, Latin digits)
  'en-GB' → 14 Mar 2026
Every other Arabic date in the app already used 'ar' — the audit log (js/63) and the Events tab (js/10) —
so two screens were the exception: the Archive list (js/76) and the Share-links panel (js/77), each of
which formatted BOTH its date and its time with 'ar-SA'. A company archived on 14 March therefore read as
"25 Ramadan 1447" in the Archive and as "14 مارس 2026" in Activity & Audit, with nothing saying they were
the same day, and a share link's "created" date was in a different calendar from everything around it.
Not a translation slip: two calendars inside one screenful, and the Hijri one carried Arabic-Indic digits
while the app's own numbers are Latin everywhere else.
FIXED: both files now use 'ar', so the Arabic month name and the Arabic meridiem stay while the day, year
and digits match the rest of the app. English is untouched. Verified live afterwards on the real database:
the Archive is clean in Arabic, and the Share-links panel prints "أُنشئ 9 سبتمبر 2026 12:45 م". A live scan
of Archive, Activity, Events, Leads and Clients in Arabic found no other Hijri date and no Arabic-Indic
digit run anywhere; the one thing my scanner flagged on the Activity page turned out to be invoice numbers
(INV-2026-1355), not dates — checked in context rather than assumed.
Guard: scripts/qa/probe-arabic-dates-gregorian.mjs (6 checks — the Archive and the Share panel each print
the Gregorian date in Arabic with no Hijri year, era mark or Arabic-Indic digits, English unchanged, 0 JS
errors; it seeds one archived company and one share link stamped with that same fixed moment;
SABOTAGE-VERIFIED: 4 FAIL / exit 1 with both edits stashed; port 9059; in battery.txt). Gates green.
Also confirmed this fire, from the SQL side: no share link is active, which is why the panel reads
"0 مفعّل" — the same fact fire #78 recorded from the database.

## Routine fire #78, second half — THE FIRST VERIFIED BATTERY SINCE FIRE #56: 203 of 205 green, 2 real reds, both now fixed
Run with scripts/qa/run-battery.sh (the runner that captures exit codes properly and re-runs every red on
its own): 211 entries, 205 that can fail, 6 that only report. **203 green, 2 RED — and both reproduced when
re-run alone, so neither was contention.** This is the first battery verdict in this sweep that was
actually counted; the six "all green" lines before it came from the runner described in the correction
above. The two reds had been failing since 2026-09-15 and nothing had been able to say so.
RED 1 — probe-report-unrecorded-cost-rows (12 checks failing). The same root cause as the five in the
correction above: the probe seeds its fixture into FIN.rows and fire #56's session-gated ledger load lands
afterwards and replaces it, so every check read "Test Company …" instead of its own rows. It now waits for
the ledger to have settled before seeding, and passes. That makes six probes blinded by one change, all
six now fixed. The app was never wrong here.
RED 2 — probe-share-and-settings-attacks, one check: "Finance page itself refuses in a shared view". THIS
ONE WAS A REAL DEFECT, and mine. Fire #50 (js/79) made a share view that landed on Finance bounce silently
to Today, because at that time the page rendered empty. The page is not empty any more: js/16 answers a
share view with a sentence of its own, since canFinView() is false there. So the bounce had turned into
exactly what this sweep exists to prevent — a holder types /s/<token>/finance, lands on Today and is told
nothing at all. FIXED: js/79 no longer bounces (the sidebar entry stays hidden, so the only way in is by
address), and js/16's sentence, which was English only on a page reachable in either language, is now
bilingual and names what the holder CAN open. Probe back to 74/74; SABOTAGE-VERIFIED (1 FAIL with the
js/79 edit stashed).
LIVE HALF, stated plainly: there is no active share link in the database today, and creating one publishes
a URL to real data, so I did not. The share path is therefore verified on the harness only — where the
probe drives a genuine /s/<token>/ flow end to end — not against the live site. An attempt to simulate it
live by marking the page a share view before boot was correctly overridden by the app itself (js/10 sets
that flag from the address), which is itself worth knowing: the flag cannot be forced from outside.

## Routine fire #78 (2026-09-17 14:11 UTC) — the live data checked against the rules the app relies on: clean; the first trustworthy full battery started with the repo's own runner
DATA (read-only SQL on the live database; the finance ledger itself was done in fire #75): 112 companies,
108 live. The invariant CLAUDE.md warns about most — `is_client` and `raw->>'isClient'` drifting apart and
leaving a record half-converted — holds on all 108. No stage outside the locked list. No client without a
conversion date, no won-but-not-client, no blank name, no duplicate live name. No orphaned contact,
activity or finance link; no finance link pointing at an archived or non-client company. Two things are
true and worth the owner knowing rather than changing: one client sits at stage "Lost" (the app already
treats that as a client, not a lost lead — fire #54), and 20 live companies carry no funnel, every one of
them a client, which is right: a funnel describes how a LEAD arrived, and the card prints "—" with the
source rather than a guess.
PROMO CODES — checked, and the contradictions reach nobody. The registry holds 200 codes whose flags
disagree with themselves: 165 are marked active AND expired at once, 167 "active" codes are past their end
date, 2 carry a percentage outside 0–100 and 1 has a discount larger than its sales. None of it is on
screen: js/25 carries the promo card behind `SHOW_PROMO_ON_FINANCE=false`, switched off on the owner's own
instruction (27,304,067 SAR of code sales against 8,755,055 of real revenue does not belong inside
Finance's performance view), and the card's own status logic already prefers "expired" over "active" if it
is ever switched on. So this is a data clean-up for whenever the owner wants that page, not a screen defect.
EVENTS, PROOFS, RECEIPTS, EXPENSES: the event sign-up table and the three finance document tables are
empty, and each surface shows nothing rather than claiming a zero — the sign-up key and the per-event lead
count are printed only when they exist. Honest by omission.
No code change this fire. The full battery is running under scripts/qa/run-battery.sh (the trustworthy
runner, which re-runs every red alone); it is the first verified verdict since fire #56 and is recorded
below when it lands.

## ⚠ Correction (2026-09-17, fire #77) — the "NNN/NNN probes green" lines in fires #56 → #75 were NOT verified. Five probes had been failing for two days and my runner reported them green
Found while re-running the Generator probes by hand after the print fix: four probes printed
"FAILED — N check(s) did not pass" on screen, yet the battery log recorded `exit=0` for every one.
TWO SEPARATE THINGS, both mine:
1. THE INSTRUMENT. The resumable slice runner I have used for the full battery since fire #56 read each
   probe's exit code as `out=$(node … | tail -1 | cut …); code=${PIPESTATUS[0]}`. PIPESTATUS is read after
   the assignment, in the parent shell, so it described the assignment — always 0 — and never node. Every
   probe was logged green whatever it did. Proven minimally: `out=$(bash -c 'exit 7' | tail -1 | cut -c1-10)`
   leaves PIPESTATUS[0] at 0. The runner now writes each probe's output to a file and takes `$?` directly.
   The repo's own runner, scripts/qa/run-battery.sh, never had this flaw — it redirects to a file, captures
   the code properly and re-runs every red alone. It is the instrument to trust; mine existed only to run
   the battery in resumable foreground slices, and it should have been checked against a known failure
   before being believed. The full output of every probe WAS being written correctly all along, so the
   failures were in the logs in plain words the whole time; only the pass/fail count was wrong.
2. WHAT IT HID. Fire #56's fix in js/16 (a ledger asked for before sign-in is no longer cached: the loader
   waits for the session, then loads again) also lands AFTER a probe seeds its own fixture into FIN.rows,
   replacing it with the mock's rows. Five finance probes seed exactly that way and their control checks
   started failing on 2026-09-15: report-table-, ageing-, client-table-, overview-cards- and
   drilldown-printed-arithmetic. Bisected to be certain: all five pass at 3e901e4 (the commit before that
   change) and fail at ac8df02 and at HEAD. The app is right and unchanged; the probes' waiting was wrong.
   Each now waits for the ledger to have SETTLED (`__finSessionOk`, nothing in flight, no sign-in watcher
   armed) before seeding, and all five pass with a true exit 0.
WHAT THIS MEANS FOR THE RECORD: the battery verdicts in fires #56, #63, #67, #69, #73 and #75 said "all
green" on a count that could not go red. Every probe's text in those runs is still on disk and can be
re-read. A true full-battery run with scripts/qa/run-battery.sh is under way; its verdict is the first
trustworthy one since fire #56 and is logged separately below when it lands. Nothing in the app was
changed by any of this — the five probes were blind, not lying about the app.
LESSON, now in the playbook: a QA instrument is code too, and an instrument that has never been shown
failing has not been tested. Check a runner against a probe that is known to fail before trusting a count.

