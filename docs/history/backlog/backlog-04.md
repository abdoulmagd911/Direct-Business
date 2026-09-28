## Routine fire #222 (2026-09-23 ~10:00 UTC) — your client PDFs were printing a made-up CR number

**This is the one to read.** Every PDF the app generates for a client — the service-fee proposal,
the project proposal, the statement — carried this line across the top:

> IATA Wakeel · ZATCA Phase 2 · CR 7000000000

**That commercial registration number is invented.** It is not yours. I checked it against the
company registry inside the app, which holds your real ten-digit CR, and the number in the code
matches nothing there. It was a placeholder somebody typed years ago and it has been going out on
documents ever since. The footer had the same problem: it said *direct.com.sa*, which is not your
domain.

Both now come from the registry — the same place the one-pagers already read from. If a detail
isn't on file, it simply doesn't appear rather than being made up. And if the registry hasn't
loaded, the document says so in words instead of printing anything.

**Two more things on the same documents.**

- **The orange was the wrong one.** Your brand notes say it plainly: documents are `#F06820`, tiny
  marks and favicons are `#FF6C00`, the app itself is `#F47A1F` — three siblings, not a mistake to
  be tidied up. The on-screen preview of a proposal already gets this right. The printed PDF did
  not: it was coming out in the app's orange. So the same proposal looked like two different
  documents depending on whether the client opened the preview or the file. The colour now comes
  from your brand file at the moment of printing, and the PowerPoint decks are corrected the same
  way, including the service-fee table header, which has its own shade.
- **"Refresh proposal templates" on the Settings page does not read anything.** Despite the name it
  just re-writes a few colours that were typed into the code. I have not removed it — it does now
  write your brand's real colour — but it is worth knowing it is not learning from your actual
  proposal files. If you want it to, that is a real piece of work and I would need your template
  folder.

**And four dead buttons.** The "Open in Direct ↗" button on the empty Bookings, Invoices and Tickets
pages, plus the Direct Payments link on the Connections page, all pointed at *payments.direct.com.sa*
— which is dead; I tested it and it returns an error. Your live hub is *payments.directksa.com*,
which every other link in the app already uses. Fixed.

---

## Routine fire #221 (2026-09-23 ~09:00 UTC) — "No date" on Events was missing three of them

On the Events page there are two ways to ask for the events that have no date yet: the tile at the
top that reads **"21 No date yet"**, and the "No date" choice in the status dropdown. They gave
different answers — the tile 21, the dropdown 18. Three events with no date were missing from the
dropdown's answer.

The reason is worth knowing because it will come up again. That status field is being asked to hold
two unrelated things at once: how sure we are the event is real (confirmed, needs check, stale,
outside KSA) *and* whether it has a date. An event can easily be both "needs check" and undated —
but the field only has room for one, so those three were filed under "needs check" and vanished from
the list of undated ones. Which is exactly the list you would open to go and find their dates.

Now both ways of asking give 21, in English and Arabic. The three events show up under "No date"
*and* under their own status, because they genuinely are both.

**Everything else on that page I checked and it is right:** all five "our move" filters, all four
verticals, the other five statuses, the past/upcoming split (37 past, correct to the day), and the
page-size control. The totals add up exactly.

**Also verified and left alone this round:** the lead and client cards (twenty of them opened in
Arabic — the only English left is the word "WhatsApp" and the free-text industry descriptions you
typed yourself), and the SOPs and Service Levels pages.

---

## Routine fire #220 (2026-09-23 ~08:00 UTC) — all 308 checks re-run from scratch: every one green

Four rounds of changes had gone in since the last full run, touching six files including the Leads
list, the shared exporter, the Arabic wording layer and the Settings page. I re-ran the entire
battery — 308 checks that can fail, three at a time — and **every single one passed, with no
failures at any point.** The previous two full runs each had one or two checks go red under load and
pass when re-run alone; this one had none.

**One correction to my own earlier note.** In the Arabic round I wrote "`Yes` on all 136 airlines".
That number came from the project notes, not from counting. Your airlines register actually holds
**139**, and the page shows the 136-row copy it already tells you about on screen. The wording is
fixed everywhere it appeared.

**And a false alarm I chased and dropped.** I read the Service Levels page as fourteen rows of empty
cells. It isn't — all 56 cells are filled. The cells are editable boxes, and the way I was reading
the page cannot see what is typed inside a box. That is the third time in this stretch the *test*
was wrong rather than the app (the other two: a panel that opens outside the page area, and two
buttons that open a new tab). I have written the lesson into the rules so it does not cost a fourth.

---

## Routine fire #219 (2026-09-23 ~07:00 UTC) — seven buttons on your Settings page did nothing at all

**I pressed every control on the Settings page, one at a time, each from a freshly loaded page.**
Seven of them did nothing when clicked:

- **"👤 View preset"** — the five buttons Commercial, Finance, CFO, Everything and B2B snapshot,
  under a line that told you "Each preset shapes the sidebar and Today KPIs."
- **"👤 View as — Change preset"** — the card next to Language.

The sentence was not true. I switched between all five and measured the screen each time: the same
twenty entries in the sidebar, the same cards, the same Today, down to the character. The lists that
were supposed to shape the sidebar are read by nothing in the app, and the one thing a preset still
controls is a credit-pool widget that the calm-Today redesign already hides. The "View as" card
clicked a dropdown that was deleted a long time ago.

**I took both away rather than making them work, and I want to be clear about why.** Who can see
which page is already decided in one place — Team & Access → "Who can open what", which is a card
on that same page. A second control that also hides sidebar entries could take a page away from
someone your access settings say may open it. Nothing is deleted: the machinery is still in the
code and putting the card back is a one-line change if you want it.

**A third one was pointing at the wrong place.** The card that says "Company profile — CR, VAT,
IBAN, Wakeel" was looking for a company record of *ours* among your companies. There isn't one —
there are 108 companies and none of them is Direct — so it fell back to scrolling down the page and
flashing an orange outline round the one-pager buttons. It now opens the Generator's "Company assets
& registry", which is where your CR, VAT and IBAN actually live.

**Two it turned out I was wrong about.** The two one-pager buttons looked dead and are not — they
open in a new tab, which my first test could not see. I corrected the test rather than the app.

After the change every control on that page goes somewhere, and there is a check that will fail if
one ever stops.

---

## Routine fire #218 (2026-09-23 ~06:00 UTC) — I read all twenty pages in Arabic; two words were still English

**I went through every page of the app in Arabic against your real data, looking only at the app's
own wording** — the buttons, the column headings, the little coloured badges — and deliberately
ignoring anything that is a company's own name or a note someone typed, because those stay as they
were written. Twenty pages, and only two things were wrong:

- **On Clients, the tier column.** An ordinary client read «قياسي» and an important one read `KEY`,
  in Latin letters, in the same column. The Arabic word was already in the app; the badge is written
  in capitals and the translation only matched the ordinary spelling. So your key accounts were the
  one row on the page that read in English.
- **On Airlines, the "on Saudi BSP" column.** `Yes`, in Latin, on every row of the list. That word had simply never been
  translated.

Both now read «رئيسي» and «نعم»/«لا», and the English page is unchanged. The check that holds this
also proves the app can still tell a badge from a company name: there is a real airline called
"Yes", and it must keep its name on the Arabic page.

**Left in English on purpose:** ZATCA, IATA, NDC, EMD, API, GDS. Those are the words your team uses
in Arabic too.

**One thing I did not change, and need a word from you on.** On the Providers page, the "type" column
shows the supplier's category in English — twelve different phrases across your 23 suppliers:
Aggregator, Hotels, Payments, GDS/agency, NDC aggregator, Hotels (bedbank), Hotel aggregator,
Hotels + Transfers, Benchmark / OTA, Aggregator (LCC/NDC), Aggregator / LCC API, and
Aggregator / virtual interlining. These are values in your data, not
labels in the app, and several are trade jargon where a wrong Arabic word would be worse than the
English one. Tell me the Arabic you want for them and I will put them in; this is the same open
question as the four tender-status words below.

---

## Routine fire #217 (2026-09-23 ~05:00 UTC) — a date in your exported spreadsheet read as a 13-digit number

**I took your real Clients export apart column by column.** Two cells in it were unreadable: the
"last contact" column showed `1758000000000` instead of a date, on 11 of your 28 clients, and the
activity history cell on those same 11 began every line with the same kind of number. The rest of
the file was clean — the row count matches what is on screen, the filters are respected, the Arabic
file has Arabic column titles, and there is no money or VAT anywhere in the Leads or Clients
exports, which is how it should be.

The cause was small and worth knowing because it will come back otherwise: the app decided whether
something was a date by looking at the **name** of the column. "createdAt" was recognised; "last
contact" was not; and a date buried inside a combined cell was never looked at. It now judges by the
value itself. Carefully: a company registration number (10 digits) and a phone number written as
bare digits (12) are deliberately left alone — the check that guards this deliberately tries to
break it both ways.

**Two facts about the exports, while I was in there, that are about your data rather than the
software.** In the Leads export, 17 of the 24 columns are blank for every one of the 78 leads —
Arabic name, region, sub-source, category, segment, the six social links, licence number and status,
verification status, outreach score, decision makers. They are not broken columns; nobody has filled
them. If those fields are not ones the team will ever fill, say so and I will take them out of the
file so the export is the seven columns you actually use. On the Clients side it is 6 of 17.

---

## Routine fire #216 (2026-09-23 ~04:00 UTC) — one "Needs attention" button, not two, and it now says why

**Your Leads page had two buttons with the same words a few centimetres apart** — `⚠ Needs
attention · 71` in the chip strip and `⚠ Needs attention` in the toolbar above the table. They were
not the same button and they did not mean the same thing. One counted companies with nobody to call,
an overdue next step, or a record flagged for checking; the other counted companies with nobody to
call or no recorded source. Worse, each remembered its own on/off: clicking the first one filtered
the list to 71 while the second stayed unlit, so nothing on screen told you which of the two was
doing the filtering — and switching that one off left the other still holding it.

They happened to give the same answer on today's data, by luck rather than design: no lead is
missing a source right now, and the one record flagged for checking also has nobody on it. The first
lead recorded without a source would have made one page show two different answers to one question.

Now there is one rule, one count and one switch: press either control and both light up and the list
filters; press either again and both clear. **And both now tell you what the warning means** —
hovering either one says "71 with no contact person · 1 flagged to confirm", in Arabic on the Arabic
page. A warning on nine tenths of your list that gives no reason is furniture; a warning that names
the reason is a to-do list.

Checked on your real data in both languages: 71 over a pool of 78, filters to 71 rows, restores to
78, nothing written to the database, no errors. Held by a new automated check that also catches the
subtler version of this — the two controls counting the same rule over *different lists*, which is
exactly what happened once the rule was unified and is why the check compares the number on the
button against the rows the filter actually leaves.

---

## Routine fire #215 (2026-09-23 ~02:00 UTC) — full battery after nine files changed, and what your lead list actually contains

**All 310 checks re-run from scratch: 304 of 304 green.** One went red while three ran at once and
passed when given the machine to itself — the view-only share link. That is a race, not a broken
feature: after a redraw there is a fraction of a second before the guest view is tidied, and on a
busy device a guest could glimpse the sidebar's Finance entry and the footer showing *your* name and
job title instead of "View-only guest". I narrowed that window rather than leaving it to luck.

**A false alarm I chased and dropped, worth recording.** I thought the client list in Arabic was
sorting by the English name nobody can see. It isn't — an earlier round already fixed exactly that,
and my "evidence" was that I had clicked the column header myself and was reading a *descending*
list. Checked again properly: ascending and descending are both correct, in both languages, and the
Arabic names collate as Arabic. Also confirmed: **no lead has an Arabic name at all** (all 18 are on
clients), so the Leads list is English in both languages and sorts correctly.

**What the data says about your pipeline, plainly.** While the checks ran I counted what is actually
in the records:

- **71 of your 80 leads have no contact person on them at all.** No name, no phone, no email —
  nothing to act on. That is the same fact Today reports as "71 going cold": they are not neglected
  follow-ups, they are companies nobody has a way into yet.
- Every lead does have a source recorded, so nothing is unattributed.
- Contacts themselves are clean: 45 of them, every one has a name, every one has at least a phone or
  an email, and none is attached to a company that no longer exists.
- 27 of your 28 clients have no website recorded — small, but it is the thing you have when a
  stranger emails you.

Nothing there is a software fault. It is the honest shape of the list, and the single most useful
thing in it: **nine of your eighty leads are actually contactable today.**

## Routine fire #214 (2026-09-23 ~00:00 UTC) — an Arabic name typed the normal way found nothing

**This one only shows up if you search in Arabic.** I searched for every company in your data by
its own Arabic name. Typed letter-for-letter as stored: found, 18 times out of 18. Typed the way
people actually type Arabic:

| What you type | What happens |
|---|---|
| «الهيئه العامه» instead of «الهيئة العامة» (ه for ة) | **nothing found** — 0 of 14 |
| «الادارة» instead of «الإدارة» (no hamza) | **nothing found** |
| «مستشفي» instead of «مستشفى» | **nothing found** |

Those aren't mistakes — that's ordinary typing. But the app was comparing letters exactly, so it
treated them as different words and told you the company doesn't exist, while it sat in the list.

The English side never had this problem, which is why nobody caught it: **the app was being tested
in the language that doesn't need it.**

**Fixed.** Both what's in the record and what you type are now flattened to the same spelling before
they're compared — the alef forms, ة and ه, ى and ي, the marks nobody types, and Arabic numerals
(٠٥٥ finds a number stored as 055). One rule, used by all four search boxes: Leads, Clients, the
Ctrl+K palette and the top-bar box.

**And a second one, found while fixing the first:** a mobile typed the local way (٠٥٠…) never
matched a number stored the international way (+966 50…). The top-bar box had half of this rule
since September; the other boxes had none of it. Now every box strips the country code and the
leading zero from both sides, so the two spellings are the same number.

**Measured after the change, across all 108 records:** Arabic exact 18/18, ه-for-ة 14/14, hamza 3/3,
ى-for-ي 2/2, English 96/96, email domain 36/36, contact name 36/36, phone by its tail 34/34, phone
typed locally 34/34 — and a nonsense Arabic word still finds nothing, which is the check I guard
hardest: a search that matches everything is as useless as one that matches nothing.

## Routine fire #213 (2026-09-22 ~22:00 UTC) — the phone check, and two claims I re-measured

**A checking round.** Most of the team opens this on a phone, and six of the things I changed today
are new furniture on pages they use — so I put the app on an iPhone-sized screen (390 points wide)
and walked all twenty pages, in Arabic and in English.

**Everything fits.** No page slides sideways. Nothing hangs off the edge except wide tables, and
those sit inside their own side-scrollers, which is the correct shape: the table moves, the page
stays still. The message card the app now uses to explain a dead link fits the screen with both its
buttons a comfortable size. Zero errors.

That was true but unguarded in a way the battery could check: the existing phone pass signs in as
each real employee, so it needs the staff passwords and can't run automatically. There is now a
phone check that can — all twenty pages, both languages, every run.

**Two things I re-measured rather than trusted.**

1. **The audit log's counters are honest.** It says "Events loaded 378" — and the database holds
   exactly 378. The wording is deliberate ("loaded", not "total"), and if it ever hits its 500-entry
   ceiling it says so. I confirmed the ceiling logic is there rather than assuming it.
2. **The 216 entries with no name attached are labelled, every one.** The database has 216 changes
   made directly in the database rather than through the app (the bulk cleanup work in August and
   September). The page prints *"unknown — changed directly in the database, not via the app"* on
   exactly 216 entries. The number on screen and the number in the data match.

**One thing worth knowing about the audit page, not a defect:** it lists all 378 entries with no
filter and no search — on a phone that's a very long scroll. Adding a filter is a feature, not a
fix, so I've left it. Say the word if you want one.

## Routine fire #212 (2026-09-22 ~20:00 UTC) — a link to a company that was merged away went nowhere, silently

**Why this one matters practically.** Three of the four companies in your Archive were removed by a
**merge** — two on 22 August, one on 2 September. Their records now live on another company's card.
That means every link to one of them is dead: a bookmark, a line in an old email, a message to a
colleague, a note in another system.

**What happened when you opened one.** You landed on the Leads list. The address quietly changed to
`/leads`. Two thousand characters of page, and not one word about the company you asked for. The
same for a client link, and the same for a mistyped or made-up address — deleted, merged, renamed
and typo all looked identical.

**Fixed.** Opening a link to a company that is no longer in the list now tells you which of the
three things happened:

- **Merged** — *"'X' was merged into 'Y'. Its records are on that company's card now — the link you
  followed points at the old one."* with a button that opens Y.
- **Removed by your own ruling** (the one company you took out of the app in August) — it says so,
  and says plainly that it is **not** brought back from the Archive page. The app already refuses to
  offer a Restore button for that one; the message now agrees with it instead of promising
  something it won't do.
- **Never existed** — *"There is no record at that address. It may have been deleted long ago, or
  the link may be wrong."*

Both languages. A link to a company that is still there opens the card and says nothing at all —
that's the check I guard hardest, because a message on every normal link would be worse than the
silence I started with.

**One thing I got wrong and the guard caught.** The archive stores a merge as
`merged-into:<id> (was: …)` — with a trailing note. My first version read the whole tail as the id,
so it couldn't find the surviving company and said "merged into another company". The Archive page
had always handled that correctly; my new message did not. There is now one piece of code that
reads it, used by both.

## Routine fire #211 (2026-09-22 ~18:00 UTC) — Today told you the day was calm while listing 71 things to do

**What was wrong.** I opened Today as the person who owns the most records in your data. The top of
the page said, in two separate places:

> **Nothing urgent right now — all clear.**
> **Nothing urgent. Today is calm.**

Six lines below, on the same screen, was his own card: **"☀️ Your day — 71"**, six companies listed
as never contacted, and a client review two days overdue. Above all of it, the banner about two
expired company certificates.

**Why.** Both of those sentences were counting only invoices, bookings, offers and the queue — and
in this app those four are permanently empty, because real invoices and bookings are created in
Direct Payments, not here. So the page could never say anything but "all clear", no matter how much
work was on it. A previous round had noticed this and written it down, but left it alone because
re-pointing Today at the real invoices is a money decision that's yours to make.

That reasoning was right about the money and wrong about the sentence. The leads going cold are
**this app's own data**, sitting on the same screen. No money decision is needed to count them.

**Fixed.** Both lines now ask the card that's already doing the counting. As that person, Today now
reads *"71 items need your attention."* and *"Your day below has 71 items to act on."* — in Arabic
too. Nothing about invoices or Direct Payments changed.

**What did not change:** when there genuinely is nothing — no drafts, nothing going cold, no review
due — you still get "all clear", "Today is calm", and "All caught up 🎉" on the card. That's the
guard's brake, because the lazy version of this fix is one that shouts at everyone every day.

I also had to correct an older check that had encoded the old behaviour: it emptied the drafts and
then demanded the page call the day calm — while 33 leads sat on the card. Same lesson as last
round: when a rule changes, the tests that enforced the old rule are part of the change.

## Routine fire #210 (2026-09-22 ~17:00 UTC) — the Operations board was five zeros and five dashes, and no words

**What was wrong.** Open Operations today and this is the entire page:

> Open requests **0** · SLA overdue **0** · Awaiting client **0** · Needs a cost recorded **0** ·
> Delivered / closed **0**
> — — — — —

Two hundred and ten characters, and not one of them a word. You cannot tell from that whether
nothing has been created yet, whether the page failed to load, or whether you are not allowed to
see what is there — and this app has been bitten by exactly that confusion before, on Finance.

Every other empty list already answers it: Projects says *"No active projects."*, Tickets *"No
tickets yet."*, Bookings and Invoices say theirs, and the three Finance capture tabs were checked
saying theirs last round. Operations was the last board that said nothing.

**Fixed.** It now says, in both languages: *"No requests yet — create the first with '+ New
request' above. The zeros are because nothing has been created, not because anything failed."*

**And the trap that goes with it.** A board emptied by a *search* is a different thing from an
empty board, so it gets a different sentence: *"No request matches your search. There are 2
requests on the board."* Without that, searching for something that isn't there would make the app
look empty. That case is one of the two brakes in the guard; the other is that the message must
disappear entirely the moment a real request exists, so it never becomes furniture.

## Routine fire #209 (2026-09-22 ~16:00 UTC) — in Arabic, the funnel tabs went back to English on every click

**What was wrong, and it is the kind you only find by using the app.** Open Leads in Arabic and the
eight funnel tabs across the top read Arabic. Click **any** filter — Hide closed, Needs attention,
Mine, one of the stage chips, or just type in the search box — and all eight snap back to English:

> All · 80   Inbound · 0   Outreach & Network · 0   Travel Trade · 0   Partners & Tenders · 0 …

and stay that way. I checked at a third of a second, one second, two and a half, and five seconds
after the click — still English every time. The page stays half-Arabic until you leave it and come
back.

**Nobody wrote a bug — two correct fixes cancelled each other.** The tabs are built with the English
funnel names and translated a moment later. Separately, on 9 September, a fix made the tab numbers
refresh when you filter, so they stop going stale. That refresh rebuilt each tab's text from a
stored copy of its label — and the stored copy was the English one. So every filter click restored
English over the Arabic, perfectly correctly by its own logic.

**Fixed** by storing both languages on the tab and picking the right one when the numbers refresh.
The Arabic comes from the funnel's own Arabic name in your database — the same source the funnel
card and the hover card already use, not a new list of translations. The numbers still refresh; the
refresh just no longer decides the language. "⚠ Needs attention" is now bilingual at the source too.

**And a second, smaller thing on the same page.** The Leads table was drawing 78 rows over 80 leads.
Nothing was wrong — "Hide closed" is on by default and two of your leads are Lost — but Leads was
the only list in the app that did not say so. Airlines says *"Showing 136 of 139 airlines"* and then
names the three; Events says *"43 of 80 shown"*; Leads showed a tick and left you to work it out.
The strip now reads **"2 closed hidden · Show"**, and Show is one click.

Both are guarded, and both guards have a brake: one proves English stays English, the other proves
the tab numbers still move when you filter — because the lazy way to "fix" the language would be to
stop refreshing them, which would quietly bring back the stale-number bug from September.

## Routine fire #208 (2026-09-22 ~14:00 UTC) — full battery: 295 of 297, and both reds were mine

**All 303 checks re-run from scratch.** 295 of the 297 that can fail passed. The two that did not
were both caused by my own changes earlier today, and neither was a fault in the app:

- A check on the **Reports** page demanded the Arabic line under each objective contain an exact run
  of characters. Yesterday's fix inserted the measured count into the middle of that line, so a
  perfectly Arabic line was reported as English. The check now asks the real question — *does any
  Latin letter survive in any of those fourteen lines?* — which is both stricter and unbreakable by
  rewording.
- A check on the **sync badge** demanded it say the work was "saved on this device". That is the
  exact sentence I removed this morning, because one reload later the change is gone from the
  device. This one is worth separating from the first: the check wasn't just brittle, it was
  **holding a false statement in place**. It now fails if the old promise ever comes back.

Both were re-verified by deliberately breaking the app again to confirm they still catch a real
fault.

**Also confirmed today, read straight from the live database** (no browser, no guessing): 112
companies / 108 live / 28 clients · 45 contacts · 65 activities · 91 invoices / 46 live · 19 of
those with cost 0 · **no VAT figure on a single invoice row** · 139 airlines · 80 events · 23
providers · 12 SOPs · 14 SLAs · 200 registry companies · 46 reconciliation gaps · 11 accounts. Two
numbers in `CLAUDE.md` had drifted (history rows and promo codes) and are corrected.

**And one more thing checked because the app claims it:** the duplicate-company finder says "no
likely duplicates found". I verified that independently — normalising all 108 names and all their
web domains produces **zero** collisions. It is telling the truth.

## Routine fire #207 (2026-09-22 ~12:00 UTC) — the three capture tabs are correct, and completely unused

**A checking round, and the check passed.** Finance has three tabs that exist to record what
Direct Payments cannot tell us: **Expenses** (what a service actually cost us), **Payment proofs**,
and **Individual bookings**. I drove all three against your real data, in both languages. They are
correct: each one says, in words, that nothing has been recorded yet — "No service costs recorded
yet." and «لا تكاليف خدمات مسجلة بعد.» — rather than showing a bare 0 and letting you guess. That
is the standard, and it was already met. I have now put a guard on it, because it was unguarded: a
future change to those tables would have looked like a working page with a shorter list.

**What the check turned up is worth your attention, though, and it is not a bug.**

All three are **completely empty**. The expenses table holds one row and it was deleted. The proofs
table, the same. Individual bookings, none at all.

Put that next to something you already know: **19 of your 46 invoices record their cost as 0**, and
those 19 carry **214,550 SAR of the 492,622.59 SAR profit total — 44%**. Every one of those is a
sale where the profit shown equals the whole amount, because nothing was ever entered on the cost
side.

The tool for fixing exactly that is built, bilingual, keeps the receipt attached to each entry, and
has never been used once. That is not something I should decide for you — entering historical costs
is real work and you may want it done in Direct Payments instead. **Decision for you (added to the
list at the top): do you want the Expenses tab used going forward, or should the cost side stay in
Direct Payments and this app stop offering it?** Either answer is fine; what is not fine is the
current middle, where the app invites a figure that nobody supplies and 44% of your profit line
rests on a blank.

I also corrected `CLAUDE.md`, which claimed these tables were "in real use" — they are not, and the
next session would have believed it.

## Routine fire #206 (2026-09-22 ~10:00 UTC) — a change the server refused was quietly thrown away on the next reload

**What I did.** I made the database refuse every single save, then used the app normally and
watched what it told me. This is the failure that costs real work, so it is worth knowing exactly
what happens.

**The good half — and it is genuinely good.** The moment a save is refused, the app tells you: a red
"Save issue" marker, the badge in the top bar turns red, it keeps retrying by itself, and if you try
to close the tab the browser stops you and says your last change is still saving. Your change really
is on your computer at that moment. Nothing there needed fixing.

**The bad half.** One reload later, the change was gone — out of the app *and* off the computer —
with **nothing on screen to say a change had been lost**. The badge was green again ("Synced 9h
ago"), because as far as it knows the last successful save was hours ago and still is.

And the badge had been saying, in red: **"Not synced — saved on this device"**. That sentence is
true at the moment it appears and is a promise the app cannot keep. It invites exactly the thing
that loses the work — closing or reloading the tab, confident it is safe somewhere.

**Fixed, in three pieces that only work together.**

1. The badge now says where the change actually is: **"Not synced — in this tab only"** (and the
   Arabic to match). Keep the tab open; it is still trying.
2. When a save is refused, the app now writes down — where a reload cannot wipe it — how many
   changes, which companies, and the database's own words for why.
3. The next time you open the app, it tells you plainly: *"A change you made on <date> at <time>
   never reached the server, and it is not in the app now… It was this company: <name>. Please make
   the change again."* Said once, not on every load.

**What I deliberately did not build.** It does not re-apply the change for you. Direct Payments and
this app are not the system of record for each other, and a change the database refused may since
have been overwritten by a colleague — replaying it automatically could wipe out their work to
rescue yours. It names the record so you can redo it in seconds, and leaves the decision to a
person.

**The check that matters most** is the opposite case: when the app's own retry succeeds a few
seconds later, the change *did* get through, and you must not be told anything at all. My sabotage
run proves both directions.

## Routine fire #205 (2026-09-22 ~08:00 UTC) — Reports counted every KPI you haven't filled in as a zero

**What was wrong.** The Reports page tracks 14 objectives and 30 KPIs, and the figures are typed in
by hand. It was treating "nobody has recorded a number yet" as "the number is zero". I proved it by
recording **one** KPI at exactly its target — 20,000,000 SAR on "value of commercial agreements and
direct sales closed" — and touching nothing else. The page then said:

> Avg progress to 2026 targets — **3%**
> #1 Increase revenue from commercial contracts and direct sales — **17%**

Both of those are the one real measurement divided by every KPI in the list, including the 29 that
have never been filled in. The honest reading of that moment is "100% of the one thing we have
measured", not 3%.

**The printed report was worse.** Section 3 is titled *Gaps & focus areas (under 50% of target)*.
With that single measurement recorded, it listed **29 gaps** — and every one of the 29 said
"no data". A report you could hand to management naming 29 shortfalls when there was not a single
measured shortfall.

**Fixed.** Averages are now taken over the KPIs that actually have a figure, and — this is the
other half — the screen says what it is speaking for, so a good number can't be read as covering
more than it does:

- the headline now reads **100%** with the label *"of the 1 measured, not all 30"*;
- objective #1 reads **100%**, with *"1 of 6 KPIs measured"* beside its name;
- an objective with nothing recorded reads **—**, not 0%, and says *"none of its 3 KPIs measured"*;
- the report's section 3 now lists only genuinely measured shortfalls, and underneath it states
  *"29 of 30 KPIs have no figure recorded for this period and are not counted as gaps"* — so a
  short list can never be mistaken for good news.

Both languages, checked on screen.

**What did not change, deliberately.** A KPI that *is* recorded and *is* below half its target is
still called a gap and still pulls its objective's average down — that is the trap in a fix like
this, and it is the check I guard hardest. My sabotage run proves it both ways.

**Still true and unchanged:** everything on this page lives in your browser only, which the page
already says in a banner at the top. Nothing here is in the company database.

