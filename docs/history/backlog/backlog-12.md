## Routine fire #104 (2026-09-19 ~17:30 UTC) — the Airlines filters showed the wrong airlines, or none

Airlines is a real page with **136 carriers in it** and no probe had ever opened it. Driven against
the live database, in both languages, with nothing written.

**The alliance buttons did not work.** Clicking them:

| button | what you got | what the data holds |
|---|---|---|
| Star Alliance | **34 carriers, mostly not Star members** — Aer Lingus, Aeroflot, Air Arabia Egypt, Air Mauritius, Akasa Air | 20 |
| oneworld | **a completely blank table, with no message at all** | 12 |
| SkyTeam | blank | 11 |
| Unaligned | blank | 93 |

Confirmed on screen, not just in a count. The cause: the buttons were applied by a shared handler
that hides any table row whose **visible text** does not contain the button's word — and the
Airlines table has no alliance column, it sits behind Insights. So three buttons matched nothing,
and "Star" matched whatever happened to contain those four letters.

**And the line under the table kept saying "Showing 1–20 of 136" through all of it** — including
when the table was empty. Clicking "All" made all 136 rows appear at once under that same line.
The counter is attached to a table once and then describes whatever list it saw at that moment, so
anything that rebuilds the rows without a full page redraw — these buttons, and **the search box on
this page and Providers** — left it talking about a list that no longer existed.

**Fixed.** The buttons now filter the data itself, where the search box and the column sorting
already live, so the table, the counter and the Export all describe one list. "Unaligned" means
"not in one of the three alliances", so **the four buttons add up to All**: an airline with no
alliance recorded is not in an alliance as far as this app knows. A button with nothing behind it
now says so — *"Nothing here with this filter — try 'All'."* / «لا شيء هنا بهذا التصفية» — instead of
showing an empty table. And the counter recomputes whenever the rows are rebuilt, so it can never
describe a list that has been replaced.

Measured after the fix on the real 136: **Star Alliance 20 · oneworld 12 · SkyTeam 11 · Unaligned
93 = 136**, each properly paged, SkyTeam reading Air France, China Eastern, China Southern, Delta,
Garuda, ITA, Kenya Airways, KLM. Providers keeps working: Hotels 6 · GDS 5 · Aggregators 8 · Other
5 — those overlap on purpose, since a "Hotel aggregator" is honestly both, and "Other" is whatever
is in none of them.

**Guarded.** `probe-reference-chips-filter-the-list` (port 9081, 10 checks) seeds its own carriers —
one bucket bigger than a page, one bucket deliberately empty, because neither case exists in the
harness — and requires each button's count to match the data, its list to be exactly one page of
that count, the four to sum to All, the empty one to say so in the reader's language, and searching
to narrow the counter too. Sabotage-verified in two halves, 5 checks failing each. 3 gates green.

### Also measured on this page, and left alone deliberately

- **Two stores hold airlines and they disagree.** The app reads its 136 from the workspace blob; the
  `airlines` table in the database holds **139**, and three exist only there — two real carriers and
  one legacy grouping row. Nothing in the app reads that table. Which store is authoritative is the
  owner's call, not a QA round's, so nothing was written to either. This is the known "one JSON row
  holds most entities" issue showing up as drift.
- **The read-only banner on Bookings / Invoices / Tickets shows both languages at once.** That is
  deliberate — a 2026-08-22 owner correction put the language being read in bold and left the other
  as a small grey gloss. Recorded here so a later round does not "fix" it.

## Routine fire #103 (2026-09-19 ~16:00 UTC) — a date on an imported invoice has to be a real day

#102 ended by finding, measured but unfixed, that an Excel export whose dates read `3/14/26` or
`14-Mar-2026` imported nothing. Driving every way a date can be written through the live parser found
something worse sitting beside it.

**What the date reader did.** It took exactly two spellings, `dd/mm/yyyy` and `yyyy-mm-dd`, and never
checked that the day it read exists. Every line below is something a real export can carry:

| written in the file | read as | what that means |
|---|---|---|
| `03/14/2026` | **`2026-14-03`** | **month 14.** Not refused — a date-shaped string handed to a real date column. The database rejects it, and one batch is one statement, so that single row loses the **whole file**. On the way past, the app's own maths reads it as no month and quarter **"Q5"**. |
| `31/02/2026` | `2026-02-31` | February has no 31st — same outcome. |
| `29/02/2026` | `2026-02-29` | 2026 is not a leap year — same outcome. |
| `3/14/2026` · `14-03-2026` · `2026/03/14` · `14-Mar-2026` · `14 Mar 2026` · `١٤/٠٣/٢٠٢٦` | nothing | every row held back for "no readable invoice date", so a perfectly good file imports nothing. |

That last row is not hypothetical. An Excel file holds a real date *cell*, and what it reads as
depends on the number format saved inside it — which changes when the file is re-saved, or opened on
a machine set to another region.

**Fixed.** js/65 hardened its own reader for exactly this on 2026-09-03 and publishes it; js/41 now
defers to it, the same way its money reader already did, so the two import paths can never read one
cell two ways. Month-name spellings are handled first, since that is what a spreadsheet produces and
js/65's reader does not take them. **`dd/mm` stays the preferred reading** — it is what Direct
Payments writes — and only a month above 12 flips it. Driven after the fix, all seven spellings of
14 March 2026 now read as 14 March 2026, and the impossible dates read as nothing.

**What that is worth.** An impossible date is now held back **on its own**, with the reason on
screen in both languages, and the rest of the file still imports. Before, it took the file down with
it: the sabotage run stores *nothing at all* — not even the rows whose dates the old reader could
read. That is the failure this project has already lived through twice.

**Guarded.** `probe-an-import-date-is-a-real-day` (port 9080, 9 checks) drops one file holding the
same day written seven ways plus one day that does not exist, commits it, and reads the stored rows
back from the database: every spelling must store 14 March 2026, the impossible day must not be
stored while the other seven are, nothing may reach the database with a month that is not a month or
a quarter that is not a quarter, and Arabic must read the same days as English. Sabotage-verified: 6
checks fail, with nothing stored at all. 3 gates green.

## Routine fire #102 (2026-09-19 ~12:30 UTC) — two importers were reading every file you drop

#101 finished the Leads interactions, so this round went to the one screen that writes money:
dropping a Direct Payments export onto Finance. It took three passes to get the story right, and the
wrong turns are written down because they are the lesson.

**Pass 1 — a real defect, in js/41.** The app's older import path built its "already imported" list
from *every* invoice in memory, including the ones you had deleted. `finLoad()` reads the ledger with
no deleted filter **on purpose**, because the Ledger offers Restore, and the live database holds **45
deleted invoices, none of which also has a live copy**. Fed one of those numbers, that path answered
*"↩ Skipped (already in the ledger): 1"* — which is not true of an invoice you deleted. js/65 fixed
exactly this on 2026-09-02, in the owner's own words: *"I deleted it, dropped the file again, it said
updated, and the invoice never came back."* This path kept the unfixed twin.

**Pass 2 — I called it unreachable. It was not.** One dropped file produced js/65's answer, so I
wrote it up as a landmine. Four dropped files told the truth: **js/16 attaches its drop listener from
a `setTimeout(…,0)` that runs after js/65 has replaced the drop-zone, so the zone ends up carrying
both handlers and every file is read twice.** `finParse` was called on all four drops. Which answer
you read is simply whichever finished last — js/65 on the first Excel file (the older path has to
fetch its Excel reader from the internet first) and **the older path on every file after it**.

**Why that matters.** The two do not agree. js/65 refuses an invoice you deleted and says why, holds
back a row whose date it cannot read so the rest of the file still lands, and catches a number that
appears twice in one file. The older path does none of that, and the Confirm button under its preview
is a different write path. So **the protections on your ledger came and went depending on how many
files you had already dropped in that sitting.**

**Fixed, both parts.** The older path now stands down when the router owns the Import panel, and
stays only as a fallback for the day the router does not wire. Its deleted-invoice list is corrected
too, so the fallback is safe if it is ever the one answering: deleted numbers are reported in plain
words, in both languages — *"Left alone — you deleted these invoice numbers before … Bringing one
back is your decision — restore it from the Ledger tab."* Never counted as ordinary duplicates, never
silently resurrected. A number with both a live and a deleted copy still matches the live one. The
money maths is untouched.

**Guarded.** `probe-import-does-not-call-a-deleted-invoice-present` (port 9079, 14 checks): really
drops a file on the Import tab and requires the refusal on screen, drops a **second** file and
requires the same importer to answer it with the older path standing down, and drives the fallback in
both languages. Sabotage-verified on each part separately — 3 fail on the real drop (the sabotaged
app reads "New 1 · Confirm import", the owner's original complaint reproduced on demand), 1 fail on
the stand-down, 4 fail on the fallback. js/65 was run sabotaged and restored byte-for-byte; the
oversight lane is read and tested, never edited. 3 gates green.

### What the fix exposed in the QA harness itself — and a hazard it closed

Making the older path stand down turned one battery probe red, and that red was worth more than the
probe was. `probe-landmines` reached the retired importer by calling its function directly, and six
of its checks were written against that importer's wording. Two things came out of fixing it.

**A hazard, now closed and guarded.** With the stand-down disabled, dropping the app's **own Finance
ledger export** back onto the Import tab was refused the first time and offered as *"Confirm import
of 3 rows"* the second — which would have fed the app's own derived revenue, cost and profit back in
as though they had come from Direct Payments. Refusing that file is exactly what js/65 was built to
do, and it was being overridden by a second importer on every drop after the first. The probe now
drops that file twice and requires it to be refused both times, with no Confirm button either time.

**The harness was more permissive than the database.** `mock-seed-live.mjs` stored every row it was
handed, so hammering the commit three times "landed" 3,000 invoices. The live database cannot do
that: `finance_invoices` carries `UNIQUE (invoice_no, line_no)` and `fn_commit_finance_import`
inserts with a plain INSERT inside one call, so a clash lands nothing (both read from the live
database, not assumed). The mock now answers `23505` the way Postgres does — otherwise a probe can
prove a duplication that cannot happen, and can never see the failure that does: one duplicate row
costing the whole batch.

**And no double-submit defect after all.** Driven by hand: once an import succeeds the Confirm button
is replaced by *"Done. Imported N new"*, so there is nothing left to press. Three commits in one tick
is not something a person can do — the same lesson as the rest of this round, arriving a third time.

### Found on the way, measured, not yet fixed — Excel exports whose dates are not dd/mm/yyyy

With both importers no longer fighting, the router's own answer became readable, and it says this
about an Excel export whose date cells *display* as `3/14/26` or `14-Mar-2026`:

> Excluded by rule 1 — no readable invoice date — the invoice date is required, so this row was held
> back; the rest of the file still imports

Every row, held back; the file imports nothing. The date reader accepts only `dd/mm/yyyy` and
`yyyy-mm-dd`, and an Excel file carries a real date cell whose displayed form depends on the number
format saved in it — which changes if the file is opened and re-saved, or opened on a machine set to
another region. The behaviour is honest (it says so, and writes nothing), but it is a dead end for a
file that is perfectly good. It also does not check the calendar, so `31/02/2026` would pass through
as a date-shaped string the database will refuse — and one refused row loses the whole batch, a shape
this project has already lived through twice. **Next round**, with the same live drive that found it.

## Routine fire #101 (2026-09-19 ~10:30 UTC) — a filter, a chip and a list, and whether they agree
Fire #100 verified the Leads chips. The obvious next question was what happens to a filter when you
leave the page and come back — `js/03` is literally named "clean URL routing, **filter memory** each
section" and keeps each section's filters in `history.state`, and nothing had driven it.

**Measured against the real database, in both languages:**

| what you do | the filter | the highlighted chip | the rows |
|---|---|---|---|
| click a stage chip | Prospect | Prospect 53 | 53 |
| switch page inside the app, press Back | Prospect | Prospect 53 | 53 |
| **leave for real and press Back** | **all** | All 78 | 78 |
| **full reload** | **all** | All 78 | 78 |

So **the memory only holds within one page lifetime** — the case where nothing needed restoring,
because the filter object never left memory. A real navigation or a reload reboots the app and the
filter resets. The first version of the guard "proved" the memory worked; neutering `restoreFilters()`
changed nothing, which is what exposed that it had never been doing the work.

**Recorded as behaviour, not fixed.** Nothing on screen ever disagrees with itself; a fresh load
starting clean is defensible and is what the reload already does; and making the restore real would
touch routing for a payoff of one re-click. Whether the filter *should* come back is the owner's
call, not a QA round's — it is written into the probe's header so the next session does not re-derive
it or quietly "fix" it.

**What is guarded instead is the part that would be a real failure: a screen that lies about itself.**
`probe-a-filter-survives-going-back` (port 9078, 9 checks) requires, in all four states above, that
the highlighted chip's own number equals the rows underneath it — in both languages, with an explicit
check that every state actually rendered a list so none of it can pass on an empty page.

**Sabotage-verified** by leaving the `active` class on the wrong chip: the filtered state reads
**"All 33" above 12 rows** and the probe fails. Only one check flips, because a later re-render puts
the highlight back — so the moment that matters is the one right after the click, which is exactly
when a person looks.

## Routine fire #100 (2026-09-19 ~08:30 UTC) — the Leads chips, checked and found right
Fire #99 found a defect in a sort nobody had driven. The obvious next question was the other untested
interaction on the same page: the **stage chips and the three toggles**. They were fixed on 2026-08-09
— the vocabulary was wrong *and* clicking one filtered nothing — and nothing has guarded them since,
while dozens of layers have been added over that page. Fire #98 found one of those layers rewriting
the table's own headers on every redraw, so the question was fair.

**Nothing was wrong.** Driven against the real database in both languages, every chip's number equals
the rows it then shows: All 78, Prospect 53, Contacted 25, Qualified 0, Proposal 0, Won 0, Lost 2 —
identical counts in Arabic. Each toggle returns the list to 78 when switched back, and Hide closed
showing 80 with it OFF is 78 open plus the 2 lost, which is right. **Recorded as verified so the next
round does not spend itself here.**

**Two instrument faults of my own, again caught before they were believed.** Counting `tbody tr`
treats the "nothing here" line as a lead, so every zero chip read as off-by-one; and the chips' own
container repeats every label, so a naive sweep sees an eighth "chip" holding all of them at once.
Both are written into the probe so the next person reading a chip count by hand does not repeat them.

**A guard, with an honest limit.** `probe-lead-chips-count-what-they-show` (port 9077, 8 checks) fixes
the invariant that matters — **a badge equals the list beneath it, in both languages, and the two
languages count the same leads.** Sabotage-verified against core-09's `v26_3LeadCount`: 2 FAIL, with
the printed line showing every badge detached (All 99/33, Prospect 99/12…).

The toggles are **driven and printed but deliberately not asserted on**: in the harness all three
leave the count unchanged, so a check on them could not fail, and this session's own rule from fire
#98 is that an unfalsifiable check is worse than none. Live they do move the list (80/78, 71/78,
0/78); the printed line is there so a person re-running it can see whether that is still true.

**And the full battery caught one of my own probes being too strict.**
`probe-dates-and-money-name-their-language` (fire #94) went red twice — under load and on the serial
re-run — on a healthy app. Its lead-page check required the page's whole text to be **identical**
between the two browsers. Both runs held the same 1,556 characters in a different order: the lead
detail page is assembled by a stack of injection layers (service-fit map, Direct-link banner,
suggested-next-step nudge, managed-in-Direct note) and which lands first is not deterministic. Nothing
to do with the browser's language, which is what that probe is about.

Narrowed to what it always meant — no Arabic-Indic digit and no Hijri date on the English page — and
re-sabotaged by reverting core-01 and core-04 to before the fix: **5 FAIL**, both printers, the Hijri
date, the quotation and the copy-out text. The strict equality stays on the quotation, which renders
in one pass and is where the defect was actually found. Run twice more since: green both times.

**Two earlier sabotage attempts failed to break anything** before the real source was found: the chip
counts do not come from core-02's `_all`, which is what a reading of the Leads page would suggest.
They come from `v26_3LeadCount` in core-09. Written down because the next person will look in the
same wrong place.

## Routine fire #99 (2026-09-19 ~06:30 UTC) — the Clients table sorted by something you cannot see
Fire #98's rule — the language sweep only sees each page at rest — kept giving. The Clients table has
clickable column sorts (Client, Account manager, Tier, Next review, Health) and **nothing had ever
driven them.** Two defects, both measured on the real 28 clients.

**1. Sorting by Health splits a health in two.** The rank map read
`{"At risk":0, Watch:1, New:2, Good:3}` — and `clientHealth()` has also returned **'Lost'** since
2026-09-09, when a lost account showing "Good" was fixed. An unknown label yields `undefined`, and
`undefined` compares equal to everything, so it lands wherever the previous order left it. The live
order was **At risk ×4, Watch ×3, Lost, Watch ×2, New…** — the Watch block cut in half by the one Lost
client, under a column whose own tooltip promises "click to surface at-risk clients". Not a language
bug: it did the same in English.

Fixed: Lost ranks **last** — it is the one reading nobody needs to chase — and a label the map has
never heard of now sorts after everything rather than nowhere.

**2. Sorting by Client name ordered by a name the reader cannot see.** The rows show the Arabic name
when there is one (js/54's `nmMain`), but the sort key was always `b.name`, the stored English one. In
Arabic the list read *Amber Holding… / Al Waha… / مؤسسة الواحة… / نادي النخبة… / albustan…* — Arabic names
sitting in the middle of a Latin alphabetical run. Nothing on screen explained the order, because the
order was of something else entirely.

Fixed: it sorts by the name actually on the row, with `localeCompare` in the language being read.
Verified live: Arabic now opens الإدارة المركزية… / الغرفة الذهبية… / الهيئة الوطنية… / باب الشرق… /
بوابة النخبة…, and English is unchanged. Numbers now count as numbers too, so "company 4" precedes
"company 12".

**Probe:** `probe-client-table-sorts-by-what-you-see` (port 9076, 10 checks). The harness seed has no
Lost client and no Arabic client name, so the probe **makes both** — a check that never meets its own
case is not a check, which is the same lesson the last two rounds produced from the other direction.
Sabotage-verified: **5 FAIL**, the health order coming back as Watch / New / Lost / New / Lost / Watch
/ New and the Arabic names out of Arabic order.

## Routine fire #98 (2026-09-19 ~04:30 UTC) — the Arabic that does not survive a search
Fire #97 found two English-only cards that `sweep-language` could never reach, because they only
appear when a read fails. This round went at the same blind spot from the other side: the sweep drives
every nav page in Arabic — and reports exactly one piece of Latin-only text, a person's name — but it
only ever sees each page in its **ordinary, full state**. It never types anything, never filters, and
never sees a list with nothing in it.

Driven in Arabic against the real database, typing a term that cannot match into every list the app
has. **Two defects, both measured before and after.**

**1. Searching on Leads turns every column header back to English, permanently.** js/21's translation
pass is hung on `render()`. A list redrawn *without* a render — which is what every search box in the
app does — writes fresh English headers over the Arabic ones, and nothing puts them back. On the
busiest page in the app: المنشأة / المرحلة / المسار / آخر نشاط / الإجراء التالي / المسؤول / الأولوية
before typing, **BUSINESS / STAGE / FUNNEL / LAST ACTIVITY / NEXT ACTION / OWNER / PRIORITY** one
keystroke later — still English six seconds on, and for the rest of the session.

Fire #86 fixed exactly this shape for the contact rows by wrapping their redraw. Rather than catch the
next one by hand, **every drawer the app publishes is now wrapped** — drawLeads, drawOffers,
drawSupTable, drawTable and six more — so a list added later is covered without anyone remembering to.
Debounced, because a search fires one redraw per keystroke and the pass walks the view.

**2. Clients said "No clients match." in English** under an otherwise fully Arabic page.

**Checked and left alone, with the reason:** supplier names (Travelfusion, Kiwi, Dnata…) are data, and
IATA / BSP / NDC are the industry vocabulary this project has a standing decision to keep.

**Probe:** `probe-arabic-survives-a-search` (port 9075, 11 checks) drives both pages in Arabic, types
into the page's own search box and asserts it found one, and requires the headers to be Arabic before,
immediately after, and seconds later.

**Two instrument faults of my own, both caught by sabotage rather than by luck.** The first version
typed into "the first visible input", which on these pages is not the list's search at all — so no
redraw happened and the header checks could not fail even with the fix reverted (1 FAIL instead of 3).
The second version found the right box, and the checks still could not fail: typing reaches the filter
(`leadFilter.q` really changes) but in the harness the handler's own no-argument redraw does not always
rewrite the table head, while against the real database it does. The probe now also calls the page's
redraw the way the live path calls it, with the term — the call measured to rewrite the head — so the
check can fail. **Sabotage-verified: 3 FAIL**, with the headers visibly back to BUSINESS / STAGE /
FUNNEL. A check that cannot fail is not a check, and only the sabotage run says which it is.

## Routine fire #97 (2026-09-19 ~02:30 UTC) — what the app says when a read simply fails
The team works on mobile data and behind a company proxy; a request can just not arrive. What the app
does **when a read fails outright** had never been driven. One table at a time was made to answer 503
while everything else loaded normally from the real database.

**Three of the four are honest, and that is worth recording so nobody re-tests them:**
* **leads** — the app does not let anyone in. It stays on the sign-in card and says
  *"Could not load leads: service unavailable."* No demo data, no zeros.
* **contacts** — no visible effect; Leads and Today read exactly as the control run.
* **app_settings** — no visible effect. (And it is the wrong table to worry about: the exclusion
  list comes from `app_state`, whose failure is caught by the leads path above.)

**Finance reports the failure too, but two things were wrong with how.**

1. **Both its cards were English only.** The sentence directly above them was made bilingual in fire
   #78 and these two were left behind, so an Arabic reader got "Loading the finance ledger…" and
   "Could not load: …" in English.
2. **Its advice was a guess.** *"Make sure you are signed in"* was written in fire #56 for the one
   cause that really was a missing session. Every other cause — the server refusing, the connection
   dropping, a proxy in the way — is likelier, and the person **is** signed in: it sent them off to
   sign out and back in for nothing, while the real reason went unsaid. Guessing at a cause and
   printing it as advice is the same failure this project treats as unforgivable in a number.

**Fixed.** Both cards are bilingual. The sign-in line is offered only when there genuinely is no
session; otherwise the card says *"Nothing was loaded — do not read any figure from this page until
it loads"* and offers a **Try again** button that reloads for real.

**An instrument fault of my own, and the third round running.** The first sweep recorded "Finance sits
on Loading… forever" — it does not. The error takes **five to eight seconds** because supabase-js
retries a 503 several times, and the sweep read the page at three. The same sweep also reported the
app showing its 65-record demo seed as real company data when the leads read failed; the screenshot
showed the sign-in card with a plain error, and what I had measured was `#view` hidden behind it.
**Last round's rule — a measurement that disagrees with a screenshot loses — paid for itself twice in
one round.** Both are written into the probe's header so the next person does not repeat them.

**Probe:** `probe-finance-says-it-could-not-load` (port 9074, 13 checks) drives both languages with the
ledger read answering 503, waits for the failure to actually reach the screen, and checks it does not
blame sign-in while a session is alive, that it says plainly nothing loaded, that each language is in
its own language, that Try again fails again while the read is still down rather than going quiet, and
that once the read recovers the button really loads the ledger (17 rows, "16 invoices" on screen).
Sabotage-verified: **7 FAIL**.

## Routine fire #96 (2026-09-19 ~00:30 UTC) — the window size nobody had ever changed
Fires #94 and #95 found the browser's language and the browser's clock deciding what the app said and
did. This round varied the other two environment knobs: the **colour scheme** and the **window size**.

**Dark mode: verified clean, nothing to fix.** The app declares no `color-scheme` and has no
`prefers-color-scheme` rule anywhere, so what a dark laptop shows was genuinely unknown. Driven in
dark mode across eight pages: byte-identical to light, body background still cream, computed
`color-scheme: normal`. Recorded so the next round does not spend time on it again.

**Window size: a real defect, on a very ordinary machine.** Every QA round until now used a big screen
at 100% zoom. A 1366×768 laptop at Chrome's **150% zoom is 911 CSS pixels wide**; at 125% it is 1093.
So is a half-screen window, and so is anyone who has made their text bigger for their eyes.

In that band the top bar is one non-wrapping row holding the page title, the global search and about
500px of tool buttons. The title and the search have no floor, so the tools win. Measured across the
whole range: at 1050px the title is already clipped, and **from 1020px down to the phone breakpoint it
is ZERO PIXELS WIDE** — the word "Leads" painting over a search box that has itself collapsed to a
52px circle with no usable input. You cannot see which page you are on, and the search everyone uses
is gone, with nothing to say why. Below 641px the phone rules take over and it is fine again.

**Fixed** in a new `v85-midwidth` block in index.html: above the phone breakpoint the bar may wrap,
nothing in it may be squeezed out of existence, and the search keeps a 170px floor. Only a *floor* —
its flex-basis and its existing 480px cap are untouched, so a full-size desktop is pixel-identical and
there is no jump at the join.

**The first version of that fix was wrong, and the way it was wrong is worth keeping.** `core-09`
injects `.top{height:56px; padding:0 20px!important}` at **runtime**, and a runtime-injected rule comes
after index.html in the cascade — so an ordinary `.top{...}` here loses. The bar kept its fixed 56px,
the wrapped row fell straight through the orange divider and landed on top of the page. Caught by
looking at a screenshot, not by a measurement. The rule is now written `.top.top` and marked important,
winning on specificity instead of on order.

**Three instrument faults this round, all caught before anything was changed on their word**, and all
the same shape as the two probe faults found yesterday:
* the overflow sweep reported Today's hero as "cut off by 60px" at every width — the screenshot showed
  nothing cut. A `scrollWidth`/`clientWidth` gap on a padded box is not a visible defect;
* it reported the Leads/Clients/Vendors tables as running past the right edge at 150% — they do, and
  `.tbl-wrap` scrolls, so every column is reachable. Not a defect;
* it reported the sidebar's Finance and Settings as "unreachable" below 560px tall — the nav scrolls
  (index.html already handles this) and both come into view. The click that "failed" was hitting a
  sidebar that had correctly become an off-canvas drawer at ≤860px.
  **A measurement that disagrees with a screenshot loses.**

**Probe:** `probe-topbar-survives-browser-zoom` (port 9073, 11 checks) drives five widths in both
languages, requires the title to have a real on-screen width and to stay inside the bar, the search to
stay wide enough to type in, the wrapped tools row to be **inside** the bar and the bar to have grown
to hold it, Arabic to be no worse off, and a 1366 desktop to be exactly as it was. Every check is
gated on the element existing. Sabotage-verified: **5 FAIL**, including the one at 700px — which is
how the broken band turned out to reach all the way down to the phone breakpoint.

**No static gate for this one.** Unlike Escape (#92), named locales (#94) and today-from-UTC (#95),
"an element in a flex row may be squeezed to zero" has no single statically-visible shape — the same
reason the M1 rule was measured and rejected in #93. Said here so nobody adds one later for symmetry.

## Routine fire #95 (2026-09-18 ~23:00 UTC) — the app asked UTC what day it is, on a team in Riyadh
Fire #94 found the browser's **language** deciding what the app printed. The same question asked of
the browser's **clock** found something worse, because this one writes.

Every "due today / overdue" comparison, every date box that opens pre-filled, and every "recorded on"
stamp went through `new Date().toISOString().slice(0,10)` — **the date in UTC**. Riyadh is UTC+3, so
from midnight to 3am local the app is a day behind the people using it. The Today header, meanwhile,
prints `toLocaleDateString` — the real local date — so the same page contradicted itself.

**Driven live at 01:13 Riyadh on Saturday 19 September** (no clock mocking: the gap was simply open,
and the run only told the browser which city it was in): the app called today **"2026-09-18"** under
a header reading **"19 Sept 2026"**.

**The reading half was mild today** — 0 leads have a next action on either date, and the overdue count
is 1 against both — and that is said plainly rather than dressed up. **The writing half is not mild.**
The expense form, the payment-proof form and the B2C booking form all open with the Date box already
filled in, and at 1am they filled it with **yesterday**. Somebody recording a real expense after
midnight saves a wrong date and is given nothing to notice. The expense tables are in real use.

Nobody had seen it because the sandbox — and every QA round before this one — ran in UTC.

**Fixed.** core-01 gained one helper, `todayISO()`, which reads the browser's own calendar, and all
**70** "today" sites across 18 files now go through it. Verified on screen afterwards: in a Riyadh
browser the expense form's Date box pre-fills **2026-09-19**.

**Not changed, on purpose:** anything converting a **stored** instant keeps `toISOString()` — that is a
real moment in time and shifting it would move existing data. A whole `new Date().toISOString()` with
no date cut out of it is likewise correct and is left alone (39 such lines); only the no-argument form
that slices a calendar date out was touched.

**js/65's three remaining UTC dates are exempt by standing rule, not because they are right** — it is
the oversight lane, which this session reads and tests but never edits. All three build a batch *label*
(`dp-import-2026-09-18`), not a business date, so the exemption costs nothing; it is written into the
gate rather than left looking like an oversight.

**Open for the owner — a policy question this session should not decide alone:** the fix uses the
*browser's* local date. For a Saudi company whose books, VAT periods and quarters are Saudi dates, the
alternative is to pin every business date to Asia/Riyadh regardless of where the laptop is, which
would also protect against a laptop whose timezone is simply set wrong. Browser-local is strictly
better than UTC and matches what the Today header already showed, so it ships; pinning to Riyadh is a
behaviour change for anyone outside KSA and is his call.

**Gate added** to `check-structure` — the third of these, after Escape (#92) and named locales (#94):
no `js/` file may cut today's date out of a UTC timestamp. Tightened after a first version flagged 39
correct lines: a whole ISO timestamp is an instant, not a calendar date. Sabotage-checked by putting
one back.

**Probe:** `probe-today-is-the-users-today` (port 9072, 12 checks). It mocks no clock and does not
depend on the hour: it loads the app under Asia/Riyadh plus the two extremes (UTC+14, UTC−11), between
which at least one always disagrees with UTC, and asserts that one did — so a run where the gap
happened to be shut cannot read as a pass. **Its first version was thrown away**: it waited for the new
helper to exist, so reverting the fix made it time out rather than measure anything, and reverting only
the call sites would have left it passing. It now reads what a person sees — a real pre-filled Date box
and a follow-up dated the person's own today, which under UTC is still tomorrow and never appears on
the Your-day card — each gated on the thing existing. Sabotage-verified: **6 FAIL**.

Full battery at −j 8, twice the machine's cores, as a deliberate stress of the fixed-sleep probes
recorded last round: green.

