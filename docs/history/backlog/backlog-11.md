## Routine fire #119 (2026-09-20 ~12:00 UTC) — nineteen companies were one edit away from becoming ministries

The audit begun in #116 and #118, run to its end: every dropdown in the app that is built from a
fixed list **and** shows a value out of a record, checked against what the database actually holds.
45 of them exist. Most sit on bookings, invoices and proposals, of which the workspace holds no rows
at all. Two hold real records, and both were wrong.

**The Corporate profile editor.** Nineteen live companies carry an entity type — "Small Company" on
eleven of them, plus "Government", "Semi Government", "Travel Partner", "Big Company" and "Medium
Company" — and **not one of those is in `ENTITY_TYPES`**, which offers Ministry, Government entity,
Semi-government, Multinational, Corporate, SME and Charity/NGO. "Semi Government" and
"Semi-government" are a hyphen apart; "Government" and "Government entity" a word. The editor writes
the box straight back, so, measured live in both languages: open a client's Corporate profile, press
Save without touching anything, and **it is filed as a Ministry**. The editor is one click from the
Corporate account card, which is on every client.

**The client-onboarding form** (collapsed by v36, still reachable through its own link) has three
boxes of the same shape — classification, pricing scheme, payment configuration. The live payment
terms are spelled "Post-paid · Monthly · 30 days", which is not one of that box's three options
either.

All four fixed the way the lead, funnel and airline boxes were: an empty option meaning nothing is
recorded, plus the stored value as its own option marked *on file* / *المسجَّل* where the list has
no match. Re-driven live — "Semi Government" now survives the round trip, and a company with no
entity type stays that way.

`probe-a-company-keeps-what-kind-it-is` (port 9092, 11 checks) holds all of it in both languages,
including that a type the list *does* contain is still selected normally. Sabotage-verified twice
against a copy of the app: 5 checks fail without the entity-type fix, 1 without the onboarding fix.

### The same defect, five times, and the first was not ours

Round 30 found it in js/56: the access matrix called unknown roles "Admin", because a `<select>`
with nothing selected shows its first option — and there it showed it in the most dangerous
direction. That fix was local to one screen. #115, #116 and now #119 found it in four more places on
real data. It is recorded in the playbook as a pattern to look for, not an incident.

### Checked and parked

The other 41 dropdowns of this shape render bookings, invoices, proposals, expenses, payment proofs,
requests and report filters. The workspace holds **zero** rows for every one of those record types,
so no stored value can currently be outside its list. They carry the same latent defect and should
be fixed when those features are first used — flagged here rather than churned through now, since
that is a large edit across core files for a risk nothing can reach today.

## Routine fire #118 (2026-09-20 ~10:30 UTC) — the line that stops somebody quoting a client off the top of their head

Continuing #117: which of the app's own on-screen guarantees has nothing watching it? A scan of
every ⚠ line in the code found 21, and judged each one by whether today's real data can reach it.
One is reachable on **every client in the app**.

**All 28 live clients have an empty pricing scheme.** So the Corporate account card's own line —
"⚠ No pricing scheme set — add before quoting this client." / «⚠ لم يُحدَّد نظام تسعير — أضِفه قبل
تقديم عرض لهذا العميل.» — is on all 28 client cards right now. It is not decoration; it is what
stops a corporate quote being made up on the spot.

Nothing asserted it, and nothing asserted the card reads in Arabic. The card's labels are hardcoded
English in core-05 and translated after render by js/21's dictionary — the arrangement that leaks
the day a label is added and the dictionary is not — and the card only exists once you click into a
client, so the nav-walking language sweep never sees it.

**Driven live, both languages: the card is correct.** It is present and visible, all eight labels
read in Arabic, and the warning appears in the right language. This round is a guard around
something already right, not a fix.

`probe-a-client-says-it-has-no-price-list` (port 9091, 9 checks) holds it: the warning appears for a
client with no price list and **stays away** from one that has a price list, whose rows are shown
instead; every label reads in Arabic; and — because this card is one of the places it could break —
**no money figure reaches it** although eight live clients carry a credit limit, which is the
owner's ruling of 21 August that money lives on Finance and nowhere else. Sabotage-verified twice:
2 checks fail with the warning gone, 1 with the credit-limit condition flipped.

Both sabotages ran against a **copy** of the app through the mock's `APP_DIR`, so the repository was
never edited and the battery running at the same time was unaffected — the habit adopted in #117.

## Routine fire #117 (2026-09-20 ~09:00 UTC) — the sentence that keeps the profit figure honest had no guard

The money screen, read against the real database with one question: **where the app shows a profit
or a margin, does it say what it does not know?**

It matters more than it sounds. The database holds 46 live invoices — revenue 2,030,764.29, cost
1,538,141.70, profit 492,622.59 — and **nineteen of them carry `cost_sar = 0`**. The trigger derives
profit as revenue minus cost, so each of those nineteen stores its whole sale as profit: 214,550 SAR,
**43.6% of the profit figure on that screen**, from invoices whose cost nobody has recorded. Each one
reads as a 100% margin.

**The app is honest about it.** js/16 prints, under the KPIs: *"N of M invoices in this period carry
no recorded cost — margin may read higher than reality until their expenses arrive."* That sentence
is the reason the figure may be shown at all — DECISIONS M8 permits `cost_sar = 0` to stay an honest
gap precisely *because* the screen says so.

**Nothing asserted it.** The Report Builder's version of the caveat is guarded by
`probe-client-profit-honest`; the Finance overview's is one `if` inside a render function several
hundred lines long. A probe elsewhere even refers to it in a comment as the headline that "already
warns honestly" — a comment is not a check. One refactor of that function and 43.6% of the profit
number goes back to standing there unqualified, with nothing going red.

`probe-the-profit-says-what-it-does-not-know` (port 9090, 8 checks) now holds it, in both languages:
the sentence appears where costs are missing, carries the right count **and** the right total, reads
in Arabic on the Arabic page with no English left in, and — the half that makes it a real check —
**stays away** from a period where every cost is recorded, which still shows its profit. Sabotage-
verified by removing the block.

### Checked and clean — every other surface that prints a profit

Driven live, both languages: the Finance overview, Performance, Clients & collections, Link finance
to clients and the Report Builder all carry the caveat. Reports, Today and Clients print no profit
figure at all. Two that looked bare on a first pass were not, and the difference was only visible by
reading the page rather than the match: the **Ledger** tab is the *transaction* ledger, empty today,
so its zeros are true and its own line explains what "confirmed" means; **Individual bookings**
already says, in its own words, that a blank cost leaves the profit blank and that 0 should be typed
only for a genuinely free booking. Recorded so a later round does not re-check them.

## Routine fire #116 (2026-09-20 ~07:30 UTC) — every company was one edit away from losing where it came from

Fire #115 found a form that deleted an answer it could not display. This round went looking for the
same shape everywhere else, starting with the form people use most — and found it worse.

**The lead form's "Funnel / source" box.** It is built from a fixed list — sixteen entries — and had
no empty option. The sources the records actually hold are "Contact Submission" (81 companies), an
import tag (19), "Past Invoices" (3) and five one-offs. **Not one of the 108 live companies holds a
source that list contains.** A dropdown with no match selects its first entry, and Save reads the box
and writes it back. Measured against the real database in both languages: open any lead, press Save
without touching anything, and its source becomes "Old Customers". That field is what the two August
re-verification rounds were built on.

**The Category box, the same hole from the other side.** 98 of the 108 companies have no category at
all, and with no empty option the box opened on "Anchor" and Save recorded it.

**The airline form's Type box.** Five of the 136 real carriers hold a type the box never heard of —
two blank, three plating or GSSA platforms. Editing one would have recorded it as a full-service
carrier.

All three are fixed the same way as the funnel form: an empty option that says nothing is recorded,
and, where the record holds something the list does not, that value as its own option, selected and
marked *on file* / *المسجَّل*. Every standard option is still offered, so changing one stays a
deliberate choice. Re-driven against the real database — a lead is now byte-for-byte unchanged by
opening its form and pressing Save.

`probe-a-lead-keeps-where-it-came-from` (port 9089, 13 checks) covers all three boxes in both
languages, and also checks the ordinary case — a source the list *does* contain is still selected
normally, with no extra entry. Sabotage-verified three times, one box at a time: 3 checks fail
without the source fix, 3 without the category fix, 2 without the airline fix.

### Checked and clean

The same question asked of every other fixed list in the app: the Events form (80 real events — every
stored vertical, status and priority is in its box), the airline Alliance / ADM-risk / KSA-IATA /
SAF / NDC boxes and the provider Settlement and API-status boxes (all of them already map a blank to
their own "—" entry), and the lead Stage and Assigned-to boxes (both already have an empty option,
and every live stage maps to one the box offers). Recorded so a later round does not re-check them.

### One stale expectation, corrected

The full battery after fire #113 went red on `probe-search-phone`: it took the first row of a
"Test Company 3" search and required it to say *Lead*. The fixture makes every fourth company a
client, so that row is a client — and since #113 the search says so instead of calling everything a
lead. The expectation was the stale half, confirmed against the fixture rather than against the
change. It now asks for the lead row **and** the client row, which is the stronger check.

## Routine fire #115 (2026-09-20 ~06:00 UTC) — opening the funnel form and pressing Save deleted answers nobody touched

The funnel-details card and its Edit form (js/09) had not been driven this session. Driving them
against the real database found the most damaging defect of this sweep so far: **a person could
lose a lead's recorded answers by opening the form and pressing Save without typing anything.**

**How it happened.** Every funnel carries a field template. Five of its fields are dropdowns with a
fixed list of options and three are yes/no. The answers were written by the importer, from the
source files; the option lists were written separately, and nobody ever compared the two. Seven live
answers do not match their own list — a "Partner" where the list reads `partner_target`, a "Won"
where it reads `won`, a "Government tender", a "Verified", and three yes/no fields holding the words
"No" and "Yes — same day".

A dropdown with no matching option opens on "—". Save reads an empty control as *cleared on
purpose* and removes the answer. So the sequence is ordinary and the loss is invisible: the card
shows the answers correctly, you open **Edit** to change the tender deadline, you press **Save**,
and three of that lead's six answers are gone. Measured on a real lead, in English and in Arabic:
`has_app`, `partner_type` and `tender_status` all disappeared, with nothing on screen to say so.

**Fixed, in three places, because the same trap is in three kinds of control.** A dropdown now
carries the stored answer as its own option, selected and marked *on file* / *المسجَّل*, so Save
writes it back unchanged — and the standard options are all still there, so changing it stays a
choice made on purpose. A yes/no control turns only the two words it writes itself into true/false,
so "Yes — same day" keeps its detail instead of collapsing into a bare *no*. And a number or date
box falls back to a plain text box when the stored answer is not something it would accept: a
strict box refuses the value, comes up empty, and lands in exactly the same deletion. Re-driven
against the real database afterwards: nothing lost, nothing changed.

Today's live numbers and dates are all well-formed, so that third part is the same defect in a
field type where the data happens to be clean — fed by the same importer as the dropdowns, where it
is not.

`probe-an-answer-on-file-survives-save` (port 9088, 16 checks) puts all of those shapes on one lead
and presses Save with nothing touched, in both languages. It also keeps round 42's rule — an answer
whose field has since left the template survives too — because both are one Save. Sabotage-verified
three times, one part at a time: 5 checks fail without the on-file option (and the lead loses the
same three answers the live one did), 2 without the boolean guard, 3 without the number/date
fallback.

### For the owner — a wording decision, not a bug

The dropdown options are the raw keys from the template: an Arabic reader picking a partner type
sees `bnpl`, `fintech`, `esim`, `insurance`, `integration`, `tender`, `other` — English code words,
in an otherwise Arabic form. Writing the Arabic (and the proper English) for those options is a
content decision and not something a QA round should invent, the same call as the KPI titles in
fire #112. Five fields are affected: partner type, tender status, competitor-or-partner, planned
approach, research status.

## Routine fire #114 (2026-09-20 ~05:00 UTC) — the developer scaffolding on Settings had nothing holding it back

Settings and Archive had not been driven this session. Both are correct — and the round turned into
putting a guard around something that was quietly doing important work with nothing watching it.

**Settings and Archive are clean.** Both are fully translated; Archive shows the 4 deleted companies
with the reason each was removed and explains that an archived company is kept, not erased; the
Team & Access table lists the eleven accounts with their level and per-page permissions, in Arabic.

**What has no guard is the removal of ten developer cards.** js/31 hides, by heading, the leftovers
from earlier versions of this app: a ZATCA/XSS/PII audit read-out, a generator-token dump, a
performance overlay, a WCAG audit, translation-coverage stats, the **"Run a day" / "Wipe test
records" test harness**, developer print notes, a one-off import note pointing at a `Q:\`
spreadsheet, a "Workflow + go-live" suite carrying **"reset for go-live"**, and a scenario-sweep
runner. It is one loop setting `display:none` after each render. If that layer stops running, a
heading is reworded, or the render wrapper changes, all ten reappear on the page the whole team
uses — two of them with buttons that destroy data.

Nothing anywhere asserted they stay hidden. Now something does:
`probe-settings-has-no-developer-tools` (port 9087, 6 checks) requires, in both languages, that not
one of the ten is on screen, that no wipe-or-reset button can be reached, and — so the check cannot
pass on an empty page — that the cards the team *does* use are present. Sabotage-verified: disable
the hiding and the audit read-out and the token dump appear.

### An instrument fault, the same one as fire #108

A first pass through this page reported three English headings left untranslated on the Arabic
Settings page. There were none. The hidden cards are still in the DOM, and reading an element that
is not rendered gives its raw text back, so all ten headings read as if they were on screen. A
screenshot settled it in seconds. The probe asks each card for its box and its computed style, never
for text alone, and says so in its own header.

## Routine fire #113 (2026-09-20 ~04:00 UTC) — the search called every client a lead

The Today page and the search box had not been driven this session.

**Today is honest.** Everything on it reads zero — no tickets due, no overdue invoices, nobody being
chased, nothing in the queue — and that is true: all 46 live invoices have nothing outstanding, so
"All caught up" is the right thing to say. The date reads correctly in both languages.

**The search box called every company a lead.** The label was hardcoded, so all **28 clients** came
back as "Lead" — on the one distinction this whole app is built around, and the one you spent two
rounds of re-verification getting right in August. The command palette had been saying
"Client / عميل" correctly all along, which is what made the difference visible when both were
driven on the same day. Fixed: the row says which it is, and Arabic needed the word too (its list of
result types had no entry for Client, so an Arabic search would have fallen back to English).

Clicking was **not** changed — the Clients page opens its own rows exactly the same way, the two
share one detail page — so only the label moved.

**And a phone number only found its company if you typed the spacing right.** "+966 50 777 6543" was
not found by `7776543`, and the person looking it up has no way to know which spelling is stored.
Same lesson as the people bridge two rounds ago: a number written differently is the same number.
When the query is mostly digits, the digits are now compared — five digits minimum, so a short
number inside a name or a licence code does not drag in half the list.

**Guarded.** `probe-search-says-lead-or-client` (port 9086, 10 checks): a client must be announced
as a client and a lead as a lead, in both languages, with the Arabic words actually different
("عميل" is a prefix of "عميل محتمل", so they are compared exactly); a company must be findable by
the name **and** the phone number of a person on its card; and clicking the row must open that
company. Sabotage-verified in two halves — 3 checks fail with the label hardcoded, 1 with the digits
comparison removed.

### One instrument fault worth recording

A first pass reported "the app only holds 8 clients" and "a client's name finds nothing". Both were
wrong, and for the same reason: the companies arrive a page at a time, and that measurement ran the
moment the first rows landed. With the load finished it is 28 clients, all findable. The probe now
waits, and says why in a comment — a count taken too early is indistinguishable from a real loss.

## Routine fire #112 (2026-09-20 ~02:30 UTC) — the Arabic report was half English, and only half of it was mine to fix

The Reports page had not been driven this session. Two things came out of it, and they need separating.

**The report itself is honest.** It prints each KPI's target and leaves every actual as "—" rather
than inventing a zero — 70 dashes, no fabricated numbers — and it carries no VAT anywhere, in either
language. (Checked on the *word*: an earlier measurement this session counted "VAT" twice on this
page and both were "pri**vat**e" and "inno**vat**ion". A word boundary settled it.) There is no KPI
data recorded at all, and the page says so plainly: "0 / 30 KPIs with data".

**The Arabic report is half English.** Your own pre-launch pass on 2026-08-21 gave every objective
an Arabic title, and the page uses it. The **30 KPIs underneath them never got one — and nothing in
the code looked for one either.** So an Arabic reader gets Arabic objective headings with 30 English
KPI lines beneath, and the generated document they would send out reads the same way.

**What I fixed, and what I did not.** The Arabic wording of a KPI is yours to write — it is your
performance framework, and inventing Arabic for it here is exactly the kind of guess this project
does not make. What was fixed is the half that is code: **every place a KPI title is printed now
asks for the Arabic first**, the same way objectives already do — the report table, the KPI list on
the Objectives tab, the picker, the shortfall list and the copy-out text. Adding the Arabic text is
now a content edit and nothing else.

**Finding all of them took the probe.** The first pass switched four places and looked done: the
shortfall list read Arabic. The check that compares *both* directions — the Arabic title present
**and** that KPI's English title gone — caught that the table above it was still printing English.
Two more sites turned up that way, including the KPI list on the Objectives tab.

**Guarded.** `probe-the-arabic-report-is-arabic` (port 9085, 11 checks) puts an Arabic title on one
KPI and requires it to reach the generated report *and* the Objectives tab, requires that KPI's
English title to be gone from the Arabic side, requires the English report to be untouched, and
holds the two honesty properties: no VAT, and no actual invented where none is recorded.
Sabotage-verified: with the titles ignoring Arabic again, 3 checks fail. 3 gates green.

### What is waiting on you

The 30 KPI titles need Arabic wording. The objectives already have theirs. Once you give me the
Arabic for the KPIs, it drops straight in — the code is ready and the probe proves it lands.

## Routine fire #111 (2026-09-20 ~01:00 UTC) — the battery caught my own fix, and it was half right

The full battery run after #109 went red on `probe-crm-attacks`. My contacts fix caused it, so the
first question was which of the two was wrong.

**What the check asserted.** Its fixture gave one company an embedded contact and two table rows
whose **names were different** — "Dup By Email" and "Dup By Phone" — and required them to merge into
the embedded one. After #109 they no longer merge, because the names differ.

**The check's expectation was the part that was wrong**, and the live data is why: two colleagues
who share a switchboard number or an `info@` mailbox are two people, and merging them hid one of
them completely. The master brief says a mismatch is flagged, never silently merged. So the fixture
now carries the **same name** where it means "the same person spelled differently", which is what
those checks are actually about — the spelling of the email and of the phone — and two new checks
cover the live case: a different person on the same number, and a different person on the same
mailbox, must both be kept.

**And the check had been telling us about a second defect for weeks.** Sitting in that probe as a
report, not a failure: *the same person is shown twice when the embedded phone is local
(0500000001) and the table phone is international (+966 50 000 0001) — dig() compares raw digit
strings.* It even named the remedy: reduce both to the nine significant digits, as core-10's
`pdPhoneId()` already does for the Direct Payments link. **Done** — js/72 now normalises the same
way, so the two agree, and the report is a real check that fails when reverted.

**Re-verified against the live database afterwards**, because normalising numbers makes matching
stricter and could have re-hidden someone: still all **45** contacts, all **36** companies matching
row for row, nothing missing.

`probe-crm-attacks` is 66 checks, all passing; sabotage-verified by reverting the phone
normalisation — 7b and 7c both fail and the same person appears twice. 3 gates green.

## Routine fire #110 (2026-09-20 ~00:15 UTC) — counting every store against the database

Two rounds in a row started the same way: the database holds N, the app holds fewer, so which ones
and why. That found the airlines gap (#104) and the two hidden people (#109). This round did it
deliberately, for every store the app mirrors, against the live database.

| store | database | in the app | verdict |
|---|---|---|---|
| businesses | 108 live (112 − 4 archived) | 108 | ✅ agree |
| contacts | 45 | 45 | ✅ agree, and all 36 companies match row for row (fixed in #109) |
| activities | 65 across 38 companies | 68, nothing missing | ✅ the 3 extra are entries kept in the company record rather than the table |
| providers → Providers & GDS | 23 | 23 | ✅ agree |
| SOPs · Service Levels | 12 · 14 | 12 · 14 | ✅ agree |
| events | 80 | 80 (43 ahead + 37 past) | ✅ agree (verified in #107) |
| airlines | 139 in the table | 136 | ⚠️ known: the app reads the workspace record, not that table — recorded in #104, your call |
| master_db_companies | 200 | read by nothing | ✅ intended: the travel-agencies database is built away from the app by your decision of 2026-08-13 |
| promo codes · funnels | 200 · 7 | read on Finance · loaded at start | ✅ reachable |

**Activities were the obvious next place to look**, since they come through the same bridge that
hid the two contacts. Their rule is stricter — it needs the note *and* the day to match — and on the
live data there is no pair that shares both, so nothing is being collapsed. Checked rather than
assumed, and recorded so it is not re-checked.

**One case from the real data is now written into the guard.** Two companies each record one *name*
twice with a different email and a different phone on each row. That may be one person whose details
changed, or two namesakes — the app cannot tell, so it keeps both and the person decides. The
alternative, quietly picking one, is exactly what threw a working phone number away. The probe now
asserts it, so it stays a decision rather than an accident. Sabotage-verified at 5 failing checks.

3 gates green. No app code changed this round.

## Routine fire #109 (2026-09-19 ~23:30 UTC) — two people who share a phone number, and one of them disappeared

Contacts (45 in the database) had not been driven this session. Counting them against the app found
**43**, so two people were missing. Tracked down company by company: **one company has four people
recorded and its card showed two.**

**Why.** People reach a company card from two places — the company's own record and the `contacts`
table — so the app has to decide whether a row it is about to add is already there. It decided by
matching the **email or the phone, on their own**. Of the two people it swallowed:

- one **shares a mailbox** with a colleague, and
- one **shares the switchboard number** with a colleague.

Different names in both cases. Neither is bad data — a shared `info@` address and a main office
number are exactly what a company's contact list looks like. Their name, role, email and phone were
simply absent from the app, so anyone going to call that person had no way to know they existed.
The master brief's own rule says a mismatch is **flagged, never silently merged**.

**Fixed.** A shared line now counts as the same person only when the **name agrees too** — or when
one side has no name to compare, which is the case the de-duplication was written for (the same
person stored once in the company record and once in the contacts table). Nothing else changed.

**Verified against the live database after the fix:** the app holds all **45** contacts, and every
one of the **36** companies with contacts matches the database exactly — nothing missing, nothing
duplicated.

**Guarded.** `probe-two-people-one-phone-number` (port 9084, 9 checks) builds the exact situation —
a shared mailbox, a shared switchboard, the same person stored in both places, and a nameless row on
that same line — and requires four people on the card, the repeated one shown once, and all four
readable in both languages. Sabotage-verified: with the name guard removed the card drops to two
people, exactly as the live one did. 3 gates green.

## Routine fire #108 (2026-09-19 ~22:30 UTC) — SOPs & Service Levels, driven live; the page is right, the test was blind

SOPs (12) and Service Levels (14) are real data and had not been driven this session.

**The pages are correct.** Service Levels shows all 14 rows, each carrying its event, our target, the
common practice and the stretch goal, every cell editable in place; the headers translate; the
counter reads an honest "Showing 1–14 of 14"; Arabic leaves no English behind. SOPs lists its 12
procedures. Nothing to fix.

**I nearly reported a serious defect that was not there.** Read the ordinary way, every Service Level
row came back as a marker and a Delete button with four empty cells — on a page that was plainly
full. The screenshot said otherwise, and the screenshot wins. The cause: every cell on that table is
a form control (an `<input>` for the event, `<textarea>`s for the three targets), and a form's value
is not a text node — so `innerText` **and** `textContent` both read blank. Any test that reads this
table as text sees an empty page.

**Which is exactly what the test was doing.** `probe-sop-sla-tidy` checked the table's *shape* —
no stray ✕, nothing resizable, a Delete button per row, no sideways scroll — and **all of it would
still pass if all 14 rows rendered empty**. Nothing anywhere asserted that a service level shows its
own wording. It now reads the values properly and requires every row's event and Direct target to be
present and to match its record. Sabotage-verified by blanking the event field: the structural checks
sail through, the new one fails.

### For the owner — a content gap, not a bug

**The 12 SOPs have no Arabic text at all.** Their stored fields are body, cmd, code, edge, id,
market, purpose and title — there is no Arabic title or body anywhere in the data. So on the Arabic
page the SOP list reads in English, and that is the data being English, not the page failing to
translate. Writing Arabic SOP text is a content decision and is not something a QA round should
invent — flagged here for you.

No app code changed this round, so nothing needed deploying. 3 gates green.

## Routine fire #107 (2026-09-19 ~21:30 UTC) — the Events page, checked against the real calendar and found right

Events holds **80 real entries** and had not been driven this session. After three rounds of
filter buttons that lied, this one went looking for the same shape and **did not find it**. That is
the result, and it is written down so a later round does not spend itself here.

**Measured against the live database, in English and Arabic:**

| tile | says | shows when you click it |
|---|---|---|
| Still ahead | 43 | 20 of 43, with an honest "Showing 1–20 of 43" |
| Have a stand | 7 | 7 |
| Go & meet | 10 | 10 |
| Mine the website | 8 | 8 |
| Not decided | 16 | 16 |

Every tile shows exactly what it promises. The dropdown's fifth move, **Skip, holds the other 2**,
so 7 + 10 + 8 + 16 + 2 = 43 — every upcoming event accounted for. Skip deliberately has no tile,
which is why the four visible numbers add to 41 rather than 43; that is a choice, not a gap, and it
is recorded here so nobody "corrects" it. Arabic shows the same counts with translated labels, and
the filters survive the re-render (the #106 fix at work).

**What was weak was the check, not the page.** `probe-events-scale` asserted only that a tile
filtered to *something* — "more than none and fewer than all" — which passes even when a tile's
number has nothing to do with the list beneath it. That is precisely how the Airlines buttons went
wrong in #104 without anything noticing. It now clicks **every** tile, compares its number with the
rows it produces, and requires the four moves plus the skipped ones to account for every event still
ahead. Sabotage-verified by making one tile claim 13 while showing 10: both new checks fail.

No app code changed this round, so nothing needed deploying. 3 gates green.

## Routine fire #106 (2026-09-19 ~20:30 UTC) — you could not get past page 1 of the airlines list

I had just changed the row counter in #104, so I drove the paging controls on real data to check I
had not broken them. I had not — but something else was broken, and had been all along.

**On Airlines, with 136 real carriers, "Next ›" did not work.** Watched over time rather than read
once:

| moment | what the screen said |
|---|---|
| before the click | page 1 — "Showing 1–20 of 136" |
| right after the click | page 2 — "Showing 21–40 of 136" |
| ~0.8s later | **a new table, page 1, "Showing 1–20 of 136"** |

So carriers 21 to 136 could not be reached at all. The only way to see them was to change the page
size to 50, 100 or Show-all.

**The pager was not at fault.** The layer that looks up your name and role for the sidebar re-rendered
the *whole page* when it finished — and it runs on load, again at 3 seconds, again at 8 seconds, and
**every time you switch back to the browser tab**. A full re-render rebuilds the list from scratch,
taking your place in it with it. This is the same re-render that was wiping the filter buttons in
#105; that round fixed the symptom for the buttons, this one found the cause.

**Fixed at both levels, on purpose.**

- The identity lookup re-renders only when the name or role actually **changed**. It almost always
  returns what it returned before, and the sidebar is written directly anyway, so those repeat
  re-renders were pure loss. Measured after: the page sits idle for six seconds without redrawing
  itself once.
- The pager **remembers which page each list was left on**, for the page's lifetime, so a re-render
  that does have a reason doesn't cost you your place. Rebuilding the list itself still starts at
  page one, because a changed list is a different list — the #104 rule.

**Guarded.** `probe-the-page-you-are-on-stays` (port 9083, 9 checks) seeds a 44-row list, then
requires: nothing redraws while the app is left alone, Next really reaches the second page, the
second page is still there seconds later, a deliberate re-render keeps you there, and searching
starts again at page one with an honest count — in both languages. Sabotage-verified one fix at a
time: exactly one check flips each, because with either fix gone the other still protects the
reader. Only with both removed does the original defect come back. 3 gates green.

## Routine fire #105 (2026-09-19 ~19:00 UTC) — nine filter buttons that named things the data has never held

My own rule from #102 says that when a fix lands in one place, go and look for its twin. #104 fixed
the Airlines filters; the same shared handler still served Bookings, Invoices and Tickets. Of the
eleven buttons on those three pages, **nine could not work in any data at all**:

- **Bookings — Today · This week · This month.** These are date ranges, applied by searching each
  row's text for the word "Today". No date cell contains that word, so all three showed an empty
  table, always, for every possible dataset.
- **Invoices — "Unpaid".** Not one of the statuses. They are Draft · Issued · Paid · Overdue ·
  Refunded. Nothing could ever match it.
- **Tickets — Issued · Voided · Refunded.** A ticket here takes its status from its booking, and
  the booking words are Confirmed · Pending · Ticketed · Delivered · Cancelled. Not one of those
  three is in that list — and the Tickets table shows no status column either, so the row text
  could not have carried it.

And a fourth thing, found only by watching the screen over time: **the filter was undone about a
second after it was applied**, by a background re-render, while the button stayed lit. Filtered to
"Today", you got 2 bookings and then silently got all 5 back, under a button still reading "Today".

**Honest about what this cost.** Nothing, on the day it was found — all four of these pages are
read-only mirrors of Direct Payments and hold zero rows today. It is worth fixing anyway because it
is not a risk, it is a certainty: the buttons are incapable of matching, so they are wrong on the
first day the pages fill.

**Fixed.** The buttons filter the record now. "Unpaid" means Issued + Overdue — which is exactly how
the Invoices page computes the Outstanding figure printed at its own top, read from the code rather
than invented. The Tickets buttons name the statuses that exist. Non-matching rows are removed
rather than hidden, so the counter under the table recounts (the #104 lesson). An empty result says
so in the reader's language. And the choice is remembered per page and re-applied after a
re-render, with the lit button drawn from that memory, so the highlight and the rows cannot
disagree.

**Left for the owner, not guessed at:** real ticket-level *issued / voided / refunded* is a Direct
Payments fact this app has never been given. If those are wanted on the Tickets page, they have to
arrive as a field on the ticket — the fix names the statuses we actually hold instead of inventing a
mapping.

**Guarded.** `probe-chips-name-things-that-exist` (port 9082, 12 checks) seeds bookings dated today,
earlier this week, earlier this month and last year — a date filter only ever shown an empty result
proves nothing — leaves one button's bucket deliberately empty, and checks the counts, the survival
of the filter after the re-render, and that **no button names a word outside the app's own status
vocabulary**. That last check is the one that would have caught this years earlier. Sabotage-verified
in two halves: 5 checks fail with the record branch removed, 1 with the memory removed — and its
detail is the defect itself, "Today: 2 → 5" under a button still reading "Today". 3 gates green.

