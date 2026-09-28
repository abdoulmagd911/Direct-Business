**M63 — a verdict may not ignore what its own screen is showing.** Found 2026-09-22 (fire #211) by
opening Today, live, as the person who owns the most records. At the top of the page, twice:

    hero      "Nothing urgent right now — all clear."
    greeting  "Nothing urgent. Today is calm."

Six lines below, on the same screen: **"☀️ Your day — <name>  71"**, six never-contacted prospects
under GOING COLD, and a CLIENT REVIEW two days overdue — and at the very top, a banner naming two
expired company certificates.
Both verdicts counted only the workspace-blob collections (offers, invoices, bookings, the queue),
and **all four are structurally empty in this app** because invoices and bookings are minted in
Direct Payments. js/84 had already measured that (0, 0, 0, 0) and even wrote down that the line
above its own note would keep saying "all clear" — it was left as an owner-facing note because
rewiring Today to `finance_invoices` is a money decision. That reasoning was right about the money
and wrong about the verdict: the leads going cold are **this app's own data**, on the same screen,
and needed no money decision at all.
The rule: a summary line answers for the page it sits on. If the page can show work the summary
does not count, the summary is not a summary — it is a second opinion, and it will be the one
people read first. Where another layer already decides what counts, the summary asks it (js/14's
`v57YourDay` here) rather than keeping its own idea (M51).
Kept deliberately: the day is still called calm when it genuinely is, which is what stops this
becoming "shout at everyone always" — the guard's brake.
Guard: `scripts/qa/probe-today-does-not-say-calm-while-it-lists-work.mjs`. `probe-today-queue-card`
was updated in the same commit: its "no work" fixture emptied the drafts only, so after this change
it was asking the app to call a day calm while 33 items sat on the card (M57's lesson again — when
a rule changes, the guards that encoded the old one are part of the change).
*Date: 2026-09-22, js/14-lead-lifecycle.js + js/core/core-06-v18-v21.js + js/core/core-09-v26.js.
Status: ACTIVE.*

**M64 — Arabic search compares FOLDED text on both sides, and a phone number is the same number
however it is written.** Found 2026-09-22 (fire #214) by searching for every live record by its own
Arabic name. Exact spelling: 18 found out of 18. Typed the way people actually type:

    ة written as ه     «الهيئه العامه» for «الهيئة العامة»     0 found out of 14
    أ إ آ written as ا  «الادارة» for «الإدارة»                  0 found out of 3
    ى written as ي     «مستشفي» for «مستشفى»                    0 found out of 2

Those are not typos; they are ordinary Saudi typing, and a substring match treats them as different
words — so an Arabic-speaking colleague searching for a company that is sitting right there is told
it does not exist. The English side never had this problem, which is exactly why it went unnoticed:
**the app was tested in the language that happens not to need folding.**
The rule has two halves and half of it is worthless:
  1. one fold (`searchFold`, core-01) covering the alef forms, ة/ه, ى/ي, ؤ/ئ, the harakat and
     tatweel nobody types, and the Arabic-Indic digits;
  2. applied to **both sides** — the record and what was typed. Folding only the record is worse
     than not folding at all: the sabotage run shows it breaks even the exact spelling, because the
     record no longer reads the way it is stored.
Carried with it, because it is the same shape of mistake: **a phone typed locally never met a phone
stored internationally.** Fire #113 had built the digits rule for the top-bar box alone; the local
(٠٥…) versus international (+966 5…) half was missing everywhere. `phoneKey` strips `00`, `966` and
a leading zero from both sides, so the two spellings are the same nine digits, and `hayHas` is now
the single rule every box uses — the top-bar box included, where the old inline copy has been
deleted.
Measured after the change, against all 108 live records: Arabic exact 18/18, ة→ه 14/14, hamza 3/3,
ى→ي 2/2, English mid-word 96/96, e-mail domain 36/36, contact name 36/36, phone tail 34/34, phone
typed locally 34/34, and a nonsense Arabic word still returns nothing — the fold did not turn the
search into a machine that matches anything.
Guard: `scripts/qa/probe-arabic-spelling-finds-the-company.mjs`, whose brake is that last line.
*Date: 2026-09-22, js/core/core-01-foundation.js + core-02 + core-06. Status: ACTIVE.*

**M65 — two controls that ask the same question share the rule, the POOL, the count and the
on/off state — or they are two questions wearing one word.** Found 2026-09-22 (fire #216) by
driving the live Leads page: it carried two controls reading `⚠ Needs attention` a few centimetres
apart — js/09's chip (with a count) and core-10's toolbar button (without one). They used different
rules (chip: no contact person, or an overdue next action, or flagged for confirmation; button: no
contact person, or no source) and kept **separate flags** (`window.__needsAttn`,
`leadFilter.attention`), so clicking the chip filtered 78 rows to 71 and left the button dark, and
switching that one off left the other still holding the filter. The two rules agreed on the live
data by luck: no lead lacks a source today, and the one record flagged for confirmation also has no
contact person. Either fact changing would have put two different answers to one question on one
screen.
Unifying the rule was **not enough**, and that is the half worth remembering: with one rule and one
flag in place, the harness immediately showed the chip reading 33 and the button reading 45. They
were counting different **pools** — the chip counts the leads the table is showing (live,
un-archived, minus Won/Lost while "Hide closed" is on), the button counted every non-client row in
memory, and the tooltip had a third pool of its own. A shared rule over three lists is still three
answers. js/09 now exports all six pieces — `leadAttention`, `leadAttentionWhy`,
`leadAttentionTitle`, `leadAttnPool`, `leadAttnCount`, `leadAttnSet` — and core-10 asks rather than
keeps a copy.
Carried with it (M51's wording rule, applied): a warning that flags **71 of 80 leads** and gives no
reason is furniture. Both controls now carry the same breakdown — "71 with no contact person · 1
flagged to confirm" / «71 بلا جهة اتصال · 1 بحاجة إلى تأكيد».
Measured live after the change, EN and AR: both read 71 over a pool of 78, either click filters to
71 rows and lights the other, either click again restores 78, no writes, no JS errors.
Guard: `scripts/qa/probe-one-needs-attention-not-two.mjs`. Its first check is the one that catches a
second pool rather than a second rule — **the count on the control must equal the rows the filter
leaves** — and its brake is that a lead needing nothing is filtered out, because a filter that
matches every row is the same as no filter.
*Date: 2026-09-22, js/09-funnels.js + js/core/core-10-v29-reports.js. Status: ACTIVE.*

**M66 — an exported date is recognised by its VALUE, not by the name of its column, and the same
rule applies inside a flattened cell.** Found 2026-09-22 (fire #217) by taking the Clients "full
details" export off the live database and reading it column by column. `exportFlat` (core-05) only
converted a millisecond timestamp when its key ended `At` / `_at` / `Date` / `date` / `Ts` / `ts`,
and the nested path — a list of activities joined into one cell — never looked at dates at all. So:

    lastContact   1758…                        bare, on 11 of the 28 clients
    activities    "1758… Call Completed …"     the same 11, once per logged activity

Nobody can read that, and a spreadsheet cannot sort it as a date either. The narrow reading of the
2026-09-02 fire (which fixed `createdAt` on Operations and Projects) was "convert the columns named
like dates"; the rule is "an epoch is an epoch".
The window matters and is deliberately **exactly 13 digits (1e12 … 1e13)** for a column that is not
named like a date: a Saudi mobile written as bare digits with its country code is 12 digits and a
company registration number is 10, so neither can be mistaken for a date. A column that *is* named
like a date keeps the older, wider window. The sabotage run that widens it to 1e9 rewrites a
registration number as a date in 1970 — the careless version of this fix is worse than the defect.
Measured after the change against the live Clients export: 0 cells holding a machine number, 47
columns, 28 rows, both languages.
Guard: `scripts/qa/probe-a-date-in-the-file-is-a-date.mjs`, whose two brakes are the 10- and
12-digit numbers. `probe-export-records` continues to hold the named columns.
*Date: 2026-09-22, js/core/core-05-records.js. Status: ACTIVE.*

**M67 — the Arabic dictionary matches whole strings EXACTLY, so a word the screen shouts is a word
the screen keeps in English.** Found 2026-09-22 (fire #218) by reading every page in Arabic against
the live database and looking only at the app's own furniture — buttons, headings, table headings,
badges — while ignoring anything that is a record's data. Twenty pages came back clean except two
badges:

    Clients → tier      «قياسي» for a standard client, and  KEY  for a key one
    Airlines → BSP السعودية      Yes, in Latin, on every row the page drew

js/21 already held `'Key':'رئيسي'`. The Clients table writes the badge as `<span class="tag">KEY</span>`,
so the standard clients read Arabic and the important ones read English **in the same column** —
the worst of the three possible states, because a half-translated column reads as a mistake rather
than as a language. `Yes` and `No` were never in the dictionary at all.
Fixed by adding the shouted spelling and the two words. **Not** by making the dictionary
case-insensitive: that layer deliberately keeps words like `New` and `Closed` out of the shared
dictionary (they mean different things on the Operations board and on a lead), and a looser match
would start catching exactly those.
The other half of the rule, and the reason the fix is safe: **the pass is scoped to chrome, never
to a record's own name.** A `<td><b>` is a company name and is not touched on any page but Sync.
The guard's brake is an airline actually called "Yes", which must still read "Yes" on the Arabic
page; the sabotage that translates every `<td>` renames it to «نعم» and fails.
Left in English on purpose and re-checked: ZATCA, EMD, IATA, NDC, API, GDS — acronyms that are the
same word in Arabic usage.
Guard: `scripts/qa/probe-a-key-client-reads-arabic-too.mjs`.
*Date: 2026-09-22, js/21-v27-arabic-column-header-stat-label-transl.js. Status: ACTIVE.*

**M68 — a control that offers a choice must make one; when the thing it chose is owned elsewhere,
take the control away rather than build a second owner.** Found 2026-09-22 (fire #219) by pressing
every control on the Settings page, each from a clean page. Seven did nothing:

    👤 View preset → 🎯 Commercial · 💰 Finance · 📊 CFO · 🌐 Everything · 📈 B2B snapshot
    👤 View as · "Change preset"

under the sentence **"Each preset shapes the sidebar and Today KPIs."** Measured live, all five
presets gave the identical screen: the same 20 sidebar entries, the same two visible cards, the same
1,084 characters of Today. Every preset's `nav` and `todoKpis` list is read by nothing at all, and
the one flag still consumed (`sections.showPool`) drives the Commercial Credit Pool widget on Today
— which v26.3's calm-Today redesign demotes out of sight (`demoteSelectors` in core-09). The "View
as" card clicked `#v25PresetBtn`, a dropdown `v25RenderPresetDropdown` deletes and returns early
from; `if(b)` then did nothing, quietly, for months.
**Hidden, not rebuilt, and that is the rule.** Who sees which page already belongs to Team & Access
→ "Who can open what" (js/52 + js/64) — a card on the same page. A preset that also shaped the
sidebar would be a second owner of one decision (the trap v36 was written about) and could hide a
page from somebody the access matrix says may open it. What Today shows already belongs to the
calm-Today redesign. Reversible: `V25_PRESETS`, `v25GetPreset` and `v25SetPreset` are untouched.
Carried with it, a third control that was mislabelled rather than dead: **"Company profile · CR,
VAT, IBAN, Wakeel"** looked for a company record of our own (`b_directbusiness` / `isSelf`) that has
never existed in the live data — 108 companies, none of them us — and fell back to scrolling to the
PRINTABLES card and flashing an outline round it. A scroll-and-flash is indistinguishable from doing
nothing (the sabotage run proves it: the probe reports the control inert). It opens the Generator's
"Company assets & registry" now, which is where those values live.
**And a method note, because this round got it wrong first:** a control is not inert because the
page did not change. Two Settings controls open a new tab through `window.open`, and the Team &
Access panel is a fixed overlay outside `#view` that changes neither the url nor `#view` — and once
open it masked every later click. Measure the whole document, watch for popups and dialogs, and put
the page back between clicks.
Guard: `scripts/qa/probe-a-settings-button-does-what-it-says.mjs`.
*Date: 2026-09-22, js/core/core-08-v25.js + js/core/core-09-v26.js. Status: ACTIVE.*

**M69 — M65 again, on a second page, with the twist that matters: a stored CODE is not the fact it
is named after.** Found 2026-09-22 (fire #221) by driving the Events page in both languages. Two
controls that both mean "events with no date on file", a few centimetres apart:

    tile   «21 No date yet»        → filtered to 21
    status dropdown "No date"      → filtered to 18

The tile asks the event (fire #172's computed `UNDATED`); the dropdown asked the stored `status`
code. `status` **conflates two independent facts** — how verified an event is (confirmed / needs
check / stale / outside KSA / outside window) and whether it has a date — and one column can hold
only one of them. Three undated events carrying "Needs check" (2) and "Stale" (1) were therefore
missing from the answer to the very question the option is named after: 14% of the events a person
opens that filter to fix.
Fixed with one predicate, `isUndated(e)`, used by the tile, the dropdown and the count. The other
five options still read the stored code, so those three events now appear under **both** "No date"
and their own status — which is what they are. The option is named after a fact about the event, so
it answers about the event.
**The generalisation, and the reason this is its own rule rather than a second copy of M65:** where
one column doubles as two facts, a filter named after one of them must compute that fact, not read
the column. Look for the same shape wherever a status enum contains a value that is really a *data
condition* — `no_date` here; the same question is worth asking of `needs_manual_confirmation` and
of any future "missing X" status.
Guard: `scripts/qa/probe-no-date-means-no-date.mjs`. Two things in its design are the point:
it compares the two answers' **events, not their totals** (the sabotage that reverts the dropdown
produces two different sets of the same size, which a count check would pass), and it keeps two
brakes separate from the agreement check, because the sabotage that makes both controls share the
same *wrong* rule makes them agree perfectly.
*Date: 2026-09-22, js/10-events.js. Status: ACTIVE.*

**M70 — a client-facing document states no fact and uses no colour that is written as a literal in
this repository. Both come from a source: identifiers from the `company_identity` registry, colour
from `brand/tokens.css`.** Found 2026-09-23 (fire #222) by driving the Generator's Price Offer and
Service-Fee editors. The shared print/PDF builder `v25OpenPrintPdf` — which the Service-Fee
Proposal, the Project Proposal and the statement all go out through — printed in the header of
every document:

    IATA Wakeel · ZATCA Phase 2 · CR 7000000000

**That CR number is invented.** Checked against the live registry, which holds a real ten-digit
`cr_number`: the repository's literal is not it and appears nowhere in the registry. A made-up
commercial registration number on a document going out under Direct's name is fire #160/#161's
mistake — a literal drifting from the registry — except this one was never right to begin with. The
footer carried `direct.com.sa`, a domain the registry does not contain. Both now come from the
registry through `dgIdentityValue`, a fact with no value simply does not appear (#161's rule), and
when the registry has not loaded the document says so rather than inventing.
**The colour, same shape.** `brand/index.html` states the rule in one line — *"Documents use
#F06820 · tiny marks & favicons use #FF6C00 · the app uses #F47A1F. They are siblings — don't fix
one to match another"* — and `brand/tokens.css` encodes it as `--accent` under
`data-identity="classic"`, with `--accent-strong` `#F87020` labelled, in that file, "service-fee
table header". js/67's on-screen preview obeys it. The PDF did not: its accent came from
`DB.templateLibrary`, written by `v25TemplateLearn`, which **despite its name reads nothing** and
types `#FF6B00` (the logo-mark sibling); the copy in the live workspace was older still and held
`#F47A1F`, so a client's PDF printed in the app's dashboard orange. Measured on the real workspace:
`rgb(244,122,31)` before, `rgb(240,104,32)` after. The two PPTX decks in core-08 and the report deck
in core-10 had the same literal and are corrected too, the service-fee table header to `#F87020`.
The accent is now resolved from the brand at print time; a template's font, header style, footer and
signature block are still its own.
**Note the three oranges are NOT to be unified** — that is the brand's explicit instruction, and
CLAUDE.md's older line about "the #F47A1F mismatch is fixed" must not be read as licence to. The app
keeps `#F47A1F`; only documents were wrong.
Carried with it: **four "Open in Direct" buttons pointed at `payments.direct.com.sa`, which answers
503.** The live host is `payments.directksa.com` (200) — measured, both — and every other link in
the app already used it. Three of the four are the button a person presses from an empty Bookings,
Invoices or Tickets page, which is exactly when they want the real system.
Guard: `scripts/qa/probe-a-document-carries-no-invented-facts.mjs`. It seeds the stale palette the
live workspace was actually carrying, and its brake is that with no brand stylesheet at all the
fallback is still the document orange.
*Date: 2026-09-23, js/core/core-08-v25.js + core-09 + core-10. Status: ACTIVE.*

**M71 — a load that failed must be said where the number it spoiled is READ, not only where the
missing data would have been shown.** Found 2026-09-23 (fire #223) by refusing each major table's
fetch in turn against the real database and reading every dependent page. One case was silent in the
way that costs something. With `contacts` refused, the Leads page read:

    ⚠ Needs attention · 1        (it normally reads 71)

The count is *right*: fire #155 made the rule drop "this company has nobody on it" while the load is
broken, because unknown is not none. But #155 put the explanation only on a **record's card** — and
the list is where the team spends its day. Somebody who knows that number is usually 71 sees 1 and
concludes the pipeline was tidied up overnight. **Making a number honest is only half the job; the
other half is saying why it moved, on the screen where it is read.**
Fixed with one line at the top of Leads and Clients, only while that load is broken, carrying the
same "Try again" the card offers, removed by the next render once it works.
The brake matters as much as the notice, and it is in the guard: **when the contacts load fine there
is no notice.** A warning permanently on screen is not a warning, and this one would sit on the
busiest page in the app.
Measured across the sweep, and worth not re-testing: Finance, Events and Activity already say
"Could not …" when their own load fails (#196's work); a failing `app_users` leaves Today whole and
greets the signed-in person normally; `ksa_events`, `airlines`, `providers` and `record_history` are
not fetched by those paths at all, so refusing them proves nothing — check what the app actually
requests before concluding a refusal was tested.
Guard: `scripts/qa/probe-a-broken-contacts-load-says-so-on-the-list.mjs`.
*Date: 2026-09-23, js/72-people-bridge.js. Status: ACTIVE.*

**M72 — an access change asks first; and before "hardening" a control, find out whether the server
already refuses it and whether a guard is driving through it.** Found 2026-09-23 (fire #224) on the
Team & Access panel. Switching a colleague's account off, or changing their level, fired on the
FIRST click with nothing asked — while this app already asks before deleting something as small as a
service level. Both now ask, naming the person and the change. `pfConfirm` takes a Yes callback and
no No, so the select is **put back before the question is asked** and moved again only on Yes; a
Cancel, an Escape or a click outside then needs no callback and the box never sits showing a level
nobody chose.
**The second half of this rule cost a round and is the more useful half.** The panel also offered
"Switch off" and an editable level on the signed-in person's OWN row and on every admin's row, which
reads as one click from locking yourself — or the company — out. It is not: **the server already
refuses both, by name** ("You cannot change your own role." / "You cannot switch off your own
access."), and because it does, at least one admin always survives, so a "last admin" rule would be
redundant as well. A first version of this fire hid those controls; `probe-share-and-settings-attacks`
went from 73/73 to 69/73, because **that guard drives the server's refusal THROUGH those very
controls** to prove the screen handles a refusal honestly. Hiding them made the panel marginally
tidier and cost a real protection its only test. It was reverted, and the reasoning left in js/31 so
it is not built a third time. If it is ever revisited: move the guard's assertions onto the admin API
first, then change the screen.
Rule 5 keeps this session out of security alarms, with a carve-out for anything that would break the
app or lock the team out. This looked like that carve-out and was not — **check whether the server
already says no before claiming a lock-out.**
Guard: `scripts/qa/probe-an-access-change-asks-first.mjs`, whose check 5 is the one that matters
most: confirming must actually send it, or a "fix" that merely swallows the action would pass.
*Date: 2026-09-23, js/31-v48-team-access-one-simple-page-to-manage-.js. Status: ACTIVE.*

**M73 — one Arabic word per thing. Where the dictionary answers the same English label twice, the
two answers are identical or somebody has written down why.** Found 2026-09-23 (fire #225) on the
Leads page in Arabic: the page's primary action button read **«+ عمل جديد»** — "new work", "new
job" — while the dialog it opens is titled **«جهة جديدة»** and that dialog's first field is
**«اسم الجهة»**. Three words for one object on the busiest page, and the one on the button was the
odd one out: a record here is a company, not a job. Scanning the whole dictionary the same way found
one more — "Chain of command" was «سلسلة القرار» in one place and «تسلسل المسؤولية» in another,
while the BUTTON a person presses on a client card says «التسلسل الإداري». Both now match the
button: **the word you click should be the word you read.**
The rule is deliberately not "no duplicates", which would be wrong — Arabic adjectives agree in
gender (متأخر / متأخرة), a heading takes the article where a badge does not (العميل / عميل), and a
verb on a button is not the noun in a column (فتح / مفتوحة). Nine such pairs are legitimate and each
is listed in the guard with its reason. The rule is **no duplicate that nobody has accounted for**,
and adding one costs a sentence somebody has to write.
Guard: `scripts/qa/probe-one-arabic-word-per-thing.mjs` — a source check, not a browser one, so it
is fast and exact. Its two useful properties: the ALLOWED list is checked for rot (an entry that
stops matching anything is reported, so it cannot grow into a blanket exemption), and the sabotage
that proves it holds the whole class introduces a divergence on "Notes" — a word this fire never
touched — and is caught.
*Date: 2026-09-23, js/21-v27-arabic-column-header-stat-label-transl.js. Status: ACTIVE.*

**M74 — a counter says what it counts when a reader could reasonably think it counts something
else.** Found 2026-09-23 (fire #227). The Archive page reads `ARCHIVED INVOICES 0 · ARCHIVED
BOOKINGS 0 · ARCHIVED OFFERS 0 · DELETED COMPANIES 4`. Those three zeros count **this workspace's
own drafts** (`DB.invoices` / `DB.bookings` / `DB.offers`), which are empty. Measured the same day,
the finance ledger holds **45 soft-deleted invoices**. Somebody who deleted rows on the Finance page
and came to the Archive to find them reads that zero as "they are gone". They are not — Finance
soft-deletes with `deleted_at` and restores from its own screen. **The zero is true of what it
counts and false to the person reading it**, which is #210's board of zeros and #223's silent count
again, on a third page. The page now says what those counts cover and names Finance as the place.
Two constraints on the wording, both in the guard: it names **the place, never a figure** — the
ledger is not loaded on this page, so a number here could only be a second copy drifting out of step
— and it was added **beside** the older sentence about deleted companies, not over it.
**And a note about where a fix belongs, which cost a wrong edit first:** core-06's `renderArchive`
still contains the original page, but **js/76 replaces the last card's contents after it draws**, so
a sentence added in core-06 never reaches the screen. Before editing a page, check whether a later
layer overwrites the part you are editing — the live page here is js/76's, not core-06's.
Verified alongside, and worth not re-testing: the renewals radar is exact (4 expired, 3 within 90
days, undated rows shown as "date not on file" rather than hidden, sorted expired → soonest → no
date, both languages); the one-pager drops a lapsed credential from the document and tells the
person printing why; and the Restore path works, asks first and sends nothing on Cancel — a path no
live row can exercise, since all four archived companies are merges or an owner ruling.
Guard: `scripts/qa/probe-the-archive-says-what-its-zeros-count.mjs`.
*Date: 2026-09-23, js/76-archive-companies.js. Status: ACTIVE.*

**M75 — a column sorts by the text that is in it, collated in the language being read.** Set for the
Clients table on 2026-09-19 (fire #99); found again on the Leads table 2026-09-23 (fire #227's
successor, #228), so it is written down as a rule rather than a fix. Two of that table's six
clickable headers sorted by something that is not on the screen. **FUNNEL** sorted by `b.source`,
the raw import tag — and all 80 live leads carry the same tag, so every row's key was identical and
the tie-break (the company name) decided the order. The 78 rows drawn hold exactly **two** funnels
and came out in **thirteen blocks**, the seven "Website Form — B2B" rows scattered through the
"Website Form — Entities" ones, ascending and descending, in English and in Arabic alike: the column
headed FUNNEL did nothing to the funnel. **OWNER** sorted by the stored full name while the cell
shows the nickname js/54 paints in; live in Arabic it read عبدالرحمن / أبو ناصر / أبو سليمان, which
is back to front — ع sorts after أ. Both now key off the text in the cell.
Two things this rule carries with it. **A text column whose comparator is a string comparison gets a
RANK, not the raw text**: the three sorters here compare the zero-padded strings `leadSortNum` makes,
so each text column is ranked among its own distinct on-screen values with `localeCompare` (base
sensitivity, numeric) and the rank is padded like any other number — no numeric column changes, and
Arabic collates as Arabic. **And an empty cell sorts last, not as whatever the data happens to hold
underneath it**: a lead with no funnel shows "— source: x" and must not be filed under a funnel
called by its import tag.
Grouping alone does not prove it: a hidden key that maps one-to-one onto the visible one still
groups correctly and still orders wrongly, which is why the guard checks the order of the blocks and
not just their number.
Guard: `scripts/qa/probe-a-column-sorts-by-what-is-in-it.mjs`; the Clients half is
`scripts/qa/probe-client-table-sorts-by-what-you-see.mjs`.
*Date: 2026-09-23, js/core/core-10-v29-reports.js. Status: ACTIVE.*

**M87 — a read policy granted to `public` is a door open to nobody-signed-in, whether or not row-level
security is "on"; and the by-hand surface check is run every sweep, not when someone remembers.**
Found 2026-09-24 (fire #244) by running `check-public-surface` — the first time this session,
and the first time since 2026-09-20 — which is itself the finding behind the finding. `record_history`,
the audit log, had row-level security enabled and looked closed; its one read policy,
`record_history_read`, was `SELECT for public`, and `public` includes `anon`. So every non-finance
history row — before/after snapshots of real company records, contacts, client profiles, and the
names of who changed them — answered to anyone holding the app's publishable key, which is printed
in the page. Supabase's own advisor did **not** flag it: its lint looks for RLS off or RLS on with no
policy, and this was RLS on with a policy that admitted everyone. Only the surface check, which asks
the question as an outsider would, saw it. That is the point of M23, and the reason this rule adds
the word *every*.
The fix was one reversible statement: the same policy `to authenticated`. It could not break a
thing, and that was verified before it ran rather than hoped: every writer to the table — the
`record_history_write` trigger, `log_page_denied`, `undo_change` — is `SECURITY DEFINER`, so a read
policy cannot touch a write; every reader in the app is a signed-in user; the share view reads
through a definer function that RLS does not bind. After it ran: the surface check is green, and
the signed-in Activity page loaded its full log live — 394 events, tiles intact.
**Two lessons, one per half of the title.** First: "RLS enabled" is not "closed"; read the policy's
roles. `to public` on a table the app only ever reads signed-in is a mistake in the role, not the
predicate. Second: the by-hand checks in M23 have no battery to carry them, so a sweep that skips
them has not swept — `check-live-matches-repo`, `check-public-surface` and `check-live-data-shapes`
are run and their result logged, each sweep, or the sweep says it did not. They are one command
now, `scripts/qa/run-live-checks.sh`, which prints each verdict and fails if any of the three does
— so "I ran the live checks" means all three, and a forgotten one cannot look like a pass.
Undo, if ever needed: `alter policy record_history_read on public.record_history to public;`
Guard: `scripts/qa/check-public-surface.mjs` (by hand), which named the table and now passes.
*Date: 2026-09-24, database policy `record_history_read`. Status: ACTIVE.*

**M86 — a sentence that carries a number cannot be translated by a word list; choose the words where
the sentence is built. And a display translation never reaches an editor.** Found 2026-09-24 (fire
#243), driven live through every Settings sub-page in Arabic. Two surfaces were half done. The
Commercial Credit Pool dialog read **"POOL CAP (SAR)"**, an English placeholder and an English help
sentence under an Arabic title: js/21 translates by exact text and knew the title and one label,
nothing else. Its card on Settings had the same fault one level up — the sub-line carries the cap
figure ("Cap currently 1,250,000 SAR. Calendar (Gregorian) month…"), so no exact-text list could
ever have matched it. Both now choose their words in core-08 with the same inline language check
the file already uses, and the English side is checked to read exactly as before.
The company registry (Generator → Company assets & registry) printed an English provenance line
under every one of its 29 rows — "Official records", "Bank accounts sheet", "Company letterhead"…
— the `source` column, which has no Arabic twin. Every row's LABEL was Arabic, which made the
English stand out more. The live registry uses **sixteen distinct source phrases, all written by
the loader**, so they are chrome in practice and js/66 gives them their Arabic — **display only**:
the row's editor keeps the raw stored value, so a save can never write the Arabic word back over
the English source (M26's family — a translation that becomes a data change is a corruption with a
friendly face), and a phrase the list does not know still shows, in English, rather than vanishing.
A `source_ar` column would be the schema-first answer and would need the owner to fill 29 values;
this is the reversible one until then.
Verified live: Settings in Arabic went from twelve English lines to none, and the registry page to
none. The pool card's sub-line is translated in the page but hidden there by an existing style rule
on `.ch-sub`, so it is claimed as translated, not as visible.
Guard: `scripts/qa/probe-settings-speaks-arabic-all-the-way-down.mjs` — three sabotages, each
tripping exactly one check: the source map disabled (check 4), the dialog forced to English (check
2), and the display word leaked into the editor (check 7, the brake that matters most).
*Date: 2026-09-24, js/core/core-08-v25.js and js/66-document-generator.js. Status: ACTIVE.*

**M85 — an empty mirror page does not say "nothing from Direct" while the ledger holds Direct's
invoices; it says where they are.** Found 2026-09-24 (fire #242), driven live. The sidebar's
"Invoices" entry — the obvious name for anyone looking for an invoice — opened on **"Nothing has
been brought in from Direct yet"** and **"BILLED 0 SAR"**, while two clicks away Finance held the
**46 invoices captured from the Direct Payments export registry**, over 2 M SAR of revenue. The layer
printing that line (js/94, from fire #175) even says in its own header that the ledger holds 46
invoices — and then printed a sentence contradicting it. This is #175's own fault one level up: an
empty page speaking for a system that is not empty.
The page now asks the ledger through `finLive()` — the same gate Finance reads through, so the
number is Finance's own and a soft-deleted invoice is not counted — and answers one of three honest
ways: the count and a button to Finance when the ledger holds rows; the original line when it is
empty, because it is then true; and neither claim while the rows are still on their way. The ledger
is loaded on demand the way the client card (js/38) does it, with a short watch as the fallback for
the case where a load is already in flight (`finLoad` returns silently then). **Bookings and
Tickets have no ledger behind them and keep their line** — the change is scoped to the one page
that has a truer answer available, not sprayed over all three.
Verified against the live database: the line reads 46, Finance's live count exactly (91 rows,
45 soft-deleted), in both languages, and the button lands on Finance.
Guard: `scripts/qa/probe-an-empty-mirror-points-at-the-ledger.mjs` — sabotage-verified twice: the
ledger not consulted (old sentence back), and the count read from raw rows instead of the live gate
(five claimed where Finance shows three). `scripts/qa/probe-empty-mirrors-do-not-speak-for-direct.mjs`
(#175) still holds the rest and stayed green through this change.
*Date: 2026-09-24, js/94-empty-mirrors-say-they-are-empty.js. Status: ACTIVE.*

**M103 — on the Activity page a refused page visit is decided by its ACTION (`denied`), never by
its table (js/63 `isRefusal`); the same access table carries the password-reset links admins send,
and those are account events with their own words and the address they went to.** Found 2026-09-25
(fire #265) on the live log: 147 "refused page visits" claimed where 145 were, the two reset-link
rows hidden with them and printed as their raw key in both languages. In the same pass the field
dictionary was checked against every field the live log has ever recorded and the one missing word
(`mergedInto` → «دُمجت في») added — the Arabic page had read "merged into" in English. Guard:
`scripts/qa/probe-a-reset-link-is-not-a-refusal.mjs` (EN+AR, sabotage-verified against the tree
before the fix: four of five checks red). Status: ACTIVE.

**M102 — a chip that filters rows already on the page keeps or drops them from the table body
(core-09 `v26_3KeepRows`, the original nodes, never hidden by style), so the pager in js/04 — which
also shows and hides rows by style, by position — sees the list change and recounts.** Found
2026-09-25 (fire #264) on the live Clients page: "At risk" hid 22 of 28 rows by style, the pager
under the table still read "Showing 1–20 of 28" with Next enabled, and Next re-showed rows by index
— eight rows of every health under a glowing "At risk" chip and a box saying 6; "All" showed all 28
at once over "Showing 1–20 of 28". The record chips of #105 had already solved this by rebuilding the
body; the Clients chip and the generic text chip (Offers) now go through one helper that does the
same with the original rows (inline handlers and listeners survive; the "nothing here" placeholder
is filtered out of the kept set). Guard: `scripts/qa/probe-a-chip-and-the-pager-agree.mjs` — 25
synthetic clients, 12 at risk, page size 10, EN+AR; sabotage-verified against the tree before the
fix (four checks red). Status: ACTIVE.

