## Routine fire #204 (2026-09-22 ~06:00 UTC) — one page's title was English in Arabic, and the reason was a missing "&"

**What was wrong.** I checked the *title* at the top of all nineteen pages, in Arabic, against your
real data. Eighteen were Arabic. One was not — the Providers page read:

> **Providers  GDS**

English on an otherwise fully Arabic screen. And look at the gap between the two words: there are
**two spaces** there. That is where the "&" should be.

**Why it happened, and it is more interesting than a missing translation.** The code that draws that
title runs the words through a safety step that strips out a few characters that could break the
page — and it *deleted* the "&" instead of writing it safely. So the title stopped being
"Providers & GDS" and became "Providers  GDS".

The Arabic translation is looked up by the exact words. "Providers & GDS" has an Arabic translation
saved, and always had. "Providers  GDS" has none, because no such title was ever supposed to exist.
So the lookup found nothing and left the English standing.

Nobody forgot to translate this page. **The title was renamed after it was translated.** That is the
lesson worth keeping, and it is now a written rule: anything that edits a word *after* the Arabic
was matched to it will quietly un-translate it, and it fails silently — you get English on screen,
not an error.

**Fixed.** The safety step now writes the character safely instead of deleting it. Two things
changed on screen, not one:
- in **Arabic** the page title now reads «الموردون و GDS»;
- in **English** it reads "Providers & GDS" again, with the ampersand — it had been wrong there too,
  in plain sight, and nobody had cause to look twice at a heading.

**Guarded.** Seven checks, the main one being a rule rather than a single page: *on all nineteen
pages, in Arabic, no title on screen may be in English.* Titles are the one place that test is safe
to run — a title is always the app's own words, never a company name or something a person typed. My
sabotage run (putting the deletion back) failed four of the seven, and printed the double space
rather than describing it.

**Two false leads this round, worth recording so the next session doesn't re-walk them.** I first
tried to find English text by reading *every* word on every page. That approach flagged the Settings
page — wrongly: those sections are developer cards the app deliberately keeps hidden, and a person
never sees them. It also flagged supplier and company names, which are data, not translation gaps. A
second attempt looked for unused entries in the Arabic dictionary; that cannot tell a genuinely dead
entry from one whose text is built on the fly or comes from your database. Both dead ends; the
titles-only sweep is the one that gives a trustworthy answer.

## Routine fire #203 (2026-09-22 ~04:00 UTC) — the card that pops up on a lead row was still in English

**What was wrong.** Rest your mouse on a lead in the list and a small card appears with that lead's
funnel answers. In Arabic, it looked like this:

> **PARTNERS & TENDERS** · <company>
> Partner type: Government tender
> Has mobile app: No
> API / partner program: No
> Tender value (SAR): مسجّلة — تُقرأ في المالية
> Tender deadline: 2026-02-01
> Tender status: Won

Six of six field names, and the funnel's own name, in English — on the Arabic card. The money line
gives the game away: that one *did* translate. Somebody localised the money wording and the warnings
underneath and stopped before the labels.

**The Arabic was never missing.** All seven funnels have an Arabic name saved, and all fifty-one
field names have an Arabic label saved. The card just never asked for them. Worse, the two helpers
that pick the right language already existed in the same file — written months ago when the *full*
funnel card was made bilingual. This popup was simply a second place that never used them.

**Fixed.** It now reads the Arabic name and labels, and reuses those same two helpers rather than
adding a third copy of the same decision. English is untouched.

**Where I stopped, deliberately.** Three things on that card are still English in Arabic, and each
is a value somebody typed rather than a word the app owns:

- "Government tender" and "No" in the free-text fields — those are answers a person wrote. Changing
  them would be rewriting your data.
- **"Won" on tender status** — that field offers exactly four choices, and those four are the only
  funnel words with **no Arabic saved anywhere**. That's decision **0c** on your list: give me the
  four words and it's a minute's work. I'm not inventing wording you'd have to live with.

One field *was* the app's own vocabulary and is now Arabic: a yes/no field showing "No" reads «لا».
But only when it says exactly that — one of your records answers the same kind of field with
**"Yes — same day"**, and that sentence is left exactly as typed. My sabotage run proved the point
by matching loosely and turning it into «نعم»: the person's own words gone.

**Guarded.** Eight checks. The two that matter most are the traps: a yes/no field holding a sentence
must survive untouched, and a free-text value must never be translated.

## Routine fire #202 (2026-09-22 ~02:00 UTC) — two more stages showed the wrong word, and my fix three rounds ago should have caught them

**First, two pages checked and clean.** Airlines is genuinely well built: 139 airlines in the
register, 136 on the page, and it says so out loud — *"This list is a copy, and the airline register
has more · Showing 136 of 139 airlines"* — and then **names the three it isn't showing**, plus notes
that the register holds contact people for 4 airlines this list doesn't carry. That is exactly the
standard the rest of the app is held to. Providers is clean too, with the Keep / Upgrade / Phasing
out verdicts reading correctly. No sideways scroll, no errors, nothing to fix on either.

**Then the real finding, and it is a correction to my own work.** Three rounds ago I fixed a lead's
stage picker so it stops offering "Negotiation" — a word the app cannot keep, because it saves as
the same thing as "Qualified" and comes back as "Qualified". Part of that fix was making sure a lead
*already* on Negotiation still shows Negotiation, since hiding a record's own stage would be worse
than the original problem.

I scoped that exception too narrowly. I keyed it to the pipeline list I happened to be editing —
so it covered Negotiation and missed the two stage words that aren't on that list at all:

| A lead whose stage is… | showed itself as… |
|---|---|
| **New** | **Prospect** |
| **On hold** | **Prospect** |

Same fault, same lie: the control on the page misreporting the record it belongs to. To be clear,
this was **not caused by that fix** — neither word has ever been in the pipeline list, so the picker
never held them before either. My fix simply should have caught them and didn't.

**Fixed.** A lead's own stage is now always shown whenever the app recognises the word at all, and
it's placed sensibly — "New" sits next to "Prospect" (they're the same thing underneath), "On hold"
goes last. I drove all nine stage words against your real data: every one now shows its own record
correctly, and ordinary leads still get exactly the six choices that stick.

**Guarded** in the same test as before rather than a new one — it's the same property. Two new
checks, both sabotage-proved: one fails if a record's own word is hidden again, the other fails if
the borrowed word leaks onto leads that don't carry it. One of my sabotage attempts in between
turned out to change nothing at all, which proves nothing about the check — so I wrote a real one
and recorded the dud, because a sabotage that doesn't break anything is a test of my attention, not
of the guard.

---

## Routine fire #199 (2026-09-21 ~20:00 UTC) — the morning card was hiding the only certificate you can still save

**Two things I checked and found clean, then one worth changing.**

**Clean: your contacts.** I opened all 36 companies that have people on file, against your real
data, and checked every address on every card against the database. No person shows on a company
they don't belong to, and no company is hiding contacts it holds. That was worth checking properly
because it's one of your standing rules.

Along the way I twice thought I'd found something and hadn't — once because the contacts are filed
under a different kind of ID than the one the app uses on screen, once because a company's general
address legitimately appears in its own form details. Both would have been false alarms; I've
written down what they look like so the next round doesn't chase them again.

**Clean: Events.** 80 events, of which 43 are unfinished — 22 still to come and 21 with no date
yet, and the page says exactly that, in both languages.

**Changed: the "Company papers needing attention" card on your morning screen.** It shows three
items, most urgent first, then "and 2 more". Read against your real registry this morning, the three
it showed were certificates that lapsed **584, 376 and 258 days ago** — and the two it hid were
PCI DSS (lapsed 69 days ago) and **Monsha'at, which expires in 49 days.**

Monsha'at is the only one of the five you can still renew before it lapses. It was the one the card
didn't show you.

That's what sorting purely by "how overdue" does: the longer something has been dead, the more of
the card it takes. After nineteen months a lapsed certificate is a standing fact, not news. A
deadline 49 days out is news.

So the card still shows three, still most urgent first, still says how many more — but when
something hasn't lapsed yet, the nearest one of those now always gets the third place. This morning
it reads:

> • ISO 9001:2015 — expired 2025-02-14
> • DUNS — expired 2025-09-10
> • **Monsha'at certificate — 49 days left (2026-11-09)**
> and 2 more

**This is a judgement call, not a bug fix** — the card was doing exactly what it was built to do.
If you'd rather it stayed strictly by how overdue things are, say so and I'll put it back; it's one
block of code.

**Guarded.** Eight checks over five different shapes of registry, including three traps: nothing may
be invented when everything has lapsed, nothing beyond the sixty-day window may be pulled in to fill
space, and the card must stay admin-and-manager only. Both sabotage runs failed checks I hadn't
predicted, which is the argument for running them rather than reasoning about them.

**Still on your list:** four lapsed certificates and the CR. The software side is now as loud as it
can honestly be; the renewals themselves are in the world.

---

## Routine fire #198 (2026-09-21 ~19:00 UTC) — one of the seven stages didn't stick, and a fix of mine last round had a hole in it

**What was wrong.** A lead's page offers seven stages to move it to. Six of them save properly.
**"Negotiation" does not.** Pick it, and the next time anyone opens that lead it says **"Qualified"**
instead — silently, with nothing to say the word was changed.

The reason is simple once seen: the database only knows seven stage names of its own, and it has no
separate one for Negotiation — both Negotiation and Qualified are stored as the same thing. When the
record is read back, the app has to pick one word for that stored value, and it picks Qualified. So
Negotiation can be chosen but never kept.

I checked this by driving the real app and reading exactly what it tried to send to the database,
with every save intercepted so nothing was actually written to your data.

**Fixed.** The question "will this word survive being saved?" now lives next to the translation
between screen words and database words, and the three places you can set a stage only offer words
that pass. You still get Prospect, Contacted, Qualified, Proposal, Won, Lost — the six that work.

**Worth knowing:** "On hold" has the same problem (it comes back as "Prospect", and a later save
would lose the hold entirely). No lead is on hold today, so nothing is affected right now — but it
is the same fault, and the fix covers it.

**A decision for you if you want it:** if "Negotiation" should be a real step in your pipeline
rather than another word for Qualified, that means giving the database a stage of its own. It's a
small change and I can do it — say the word. Right now the app simply stops pretending it can.

**The part about my own work.** The first version of this fix was wrong in a way the test caught
before it reached you. By removing Negotiation from the dropdown, a lead that was *already* on
Negotiation lost its own stage from the list — so its page showed **"Prospect"**, which is a
different lie than the one I was fixing, and a worse one. A record's current stage is now always
shown even when it's a word you can no longer choose. Limiting what can be picked must never change
what is displayed.

**And a hole in last round's fix.** Last round I made the activity words (Note, Call, Task…) read
properly in Arabic, keyed against the words in your database. The app writes its *own* stage-change
entries with a slightly different spelling — a space where the database uses an underscore — so
those particular entries were still going to come out in English, the first time anyone moved a lead.
Nobody had moved one since the data was rebuilt, which is exactly why it wasn't visible. Fixed, and
both spellings now count as the same word.

**Guarded.** Eight checks, including three traps: a record already carrying an awkward stage must
still show it, the picker must still offer the real stages, and if the new check ever fails to load
the list must fall back to everything rather than to nothing. Both sabotage runs failed exactly the
right checks.

---

## Routine fire #197 (2026-09-21 ~18:00 UTC) — in Arabic, every record's history was written in English

**What was wrong.** When someone logs a call, a note or a task against a company, the app shows that
word on two screens: the one-line summary on the Clients list, and the full history on the company's
own page. In Arabic, both were showing the English word.

Not some of them. **All 68 activities on all 38 companies that have any**, because of a detail
worth explaining once: the app held a list saying `note` means «ملاحظة», `call` means «مكالمة», and
so on — all in small letters. Every activity your team has ever logged is stored with a capital
letter: `Note`, `Call`, `Task`, `Won`. To a computer those are different words, so the list never
matched a single one and the English fell straight through.

On top of that, four of the words people actually use — Won, Task, Proposal, and the one the app
writes itself when a lead changes stage — were not in the list at all, in any spelling.

So the Arabic Clients list read "↪ Note: …" on **11 of 11** rows, and a client's history page ran
Call / Task / Note / Won down its whole length in English.

**One more thing hiding behind it.** When a lead moves stage the app records that as
`stage_change` — a word meant for the database, not for a person. It was one step away from being
printed on screen exactly like that, in both languages. It now reads "Stage changed" / «تغيّرت
المرحلة».

**Fixed.** There is now one list of these words instead of two, it ignores capital letters, and it
takes the stage words (Won, Lost, Proposal) from the same place the rest of the app takes them, so
the same thing can't end up worded two different ways on two screens. Re-measured against your real
data straight after: 11 of 11 lines Arabic on the list, and the only Latin word left on the history
page is the company's own name — which is data, and correct.

English is untouched: Note still reads Note.

**Guarded.** The new test plants one activity of each kind your data actually contains, plus one
invented type nobody logs, and reads both screens in both languages. Its two traps: a word the app
doesn't know must be shown as stored rather than guessed at, and the two screens must word the same
activity identically — which is the fault itself, since what went wrong was having two lists. Both
sabotage runs failed exactly the right checks; one of them put the raw `stage_change` straight back
on screen, which is a good demonstration of what the test is holding.

---

## Routine fire #196 (2026-09-21 ~17:00 UTC) — most of your team opens Finance and is told the company earned nothing

**This is the one to read today.** Seven of your eleven accounts are team members. I signed in as
one against your real data and opened Finance — which their menu offers them — and this is what the
page said:

> 0 invoices · data through —
> **Revenue 0 SAR · Cost 0 SAR · Profit 0 SAR · Received 0 SAR**
> Of expected achieved · **0%**
> and a twelve-month revenue chart of zeros

At that same moment your book held **46 invoices and 2,030,764 SAR**.

**Why it happened, in plain terms.** The database is set up so a team member cannot read the finance
records — which is presumably what you want. But the way a database refuses is not by saying "no".
It answers *"here you are"* and hands back an empty list. From the app's side that looks exactly like
a company that has not invoiced anyone. So the page did its arithmetic on nothing and reported
nothing, confidently, including working out that 0% of the year's target had been achieved — because
the target itself loaded perfectly well.

Nothing was broken. Every existing safeguard was satisfied, because nothing failed.

**Fixed.** The Finance page now tells the difference it can tell — that nothing arrived — and refuses
to turn that into a claim about the business:

> **No finance rows reached this browser** · Every figure below therefore reads zero because nothing
> arrived, not because nothing was earned. If you expect figures here, your account may not be
> permitted to read the finance ledger — ask an admin. Do not quote a number from this screen.

And "Of expected achieved" now reads "—" with "Cannot be worked out — no invoices reached this
browser" instead of a fabricated 0%.

**What did not change:** your own view. I re-checked as an admin straight after — 46 invoices, all
the real figures, and no notice anywhere. The notice only appears when the browser genuinely
received nothing at all.

**A decision for you, and it is a real one.** Should team members see Finance in their menu at all?
Right now they can open it and the honest answer they get is "ask an admin". Two clean options:
take Finance out of their menu, or let them read the ledger. Either is fine; the current middle is
the only bad one, and it is now at least honest. Say which and I will do it.

**Guarded.** The new test checks the notice appears when the load brings nothing, in both languages,
and that the percentage stands down. Its two traps are the ones that matter: the notice must *not*
appear while the page is still loading, and it must *not* appear when you pick a quarter nobody
invoiced in — a quiet quarter of yours must never be dressed up as a permissions problem. Both
sabotage runs failed exactly the checks they should.

---

## Routine fire #195 (2026-09-21 ~16:00 UTC) — "19 of 46 invoices have no cost recorded" was true, and still understated it badly

**What I checked, and what held.** I went looking for money going wrong and found the opposite:
the Finance page is careful. Revenue is total minus wallet on every one of your 46 live invoices,
profit is revenue minus cost on every one, and VAT appears in none of the three — the rule you set.
A client with no cost recorded anywhere shows the words "not recorded" and "unknown" rather than a
zero and a profit equal to their whole bill. Three separate places warn you about missing cost.
None of that needed fixing.

**What was missing was the size.** The warning read:

> ⚠ 19 of 46 invoices in this period carry no recorded cost — margin may read higher than reality
> until their expenses arrive.

True, and it reads like a minority worth noting later. Here is what those 19 invoices actually are:

| | |
|---|---|
| Profit the page shows for the period | **492,623 SAR** |
| Of which rests on invoices with no cost recorded | **214,550 SAR** |
| Share of the headline profit figure | **44%** |

Nearly half your profit figure is waiting on expenses nobody has entered yet. Your invoices are very
unequal in size, so "19 of 46" could equally have meant 2% — the sentence would have been identical.
The count was never the number you needed.

**Fixed.** All three warnings now name the riyals and the share:

> ⚠ 19 of 46 invoices in this period carry no recorded cost. 214,550 SAR of them counts as pure
> profit here — 44% of the profit shown above, so margin may read higher than reality until their
> expenses arrive.

Same on the Clients & collections table and in Report Builder, and in Arabic. The share is worked
out from the figures actually on screen, so it stays right as expenses arrive — it is not a number
I typed in.

**Nothing was invented.** The missing costs are still missing and still shown as missing; no figure
moved. This only tells you how much is riding on them.

**Guarded.** The new test adds up the same thing independently and compares, in both languages, on
all three screens. Its traps: give every one of those invoices a cost and all three warnings must
disappear — *having been on screen first*, which I only added after a sabotage run passed that check
against a build where the warnings never appeared at all — and the amount named must be the part,
not the whole profit total. Both sabotage runs failed exactly the checks they should.

**Still for you:** the 19 invoices themselves. They are an honest gap, not a bug — but 214,550 SAR
of margin is worth someone's afternoon.

---

## Routine fire #194 (2026-09-21 ~15:00 UTC) — four search boxes, four different ideas of what a company is called

**What was wrong.** The app has four places you can type a company's name: the Leads page, the
Clients page, the box in the top bar, and the quick-jump window (Ctrl+K). Three of them were made to
agree back in September. The fourth — the Leads page, the one your team uses most — was never
included, and had quietly kept its own idea of which details count as "the company".

Measured against your real records, here is what that cost, and how many records each one touches:

| If you typed… | Where it found the company | Records affected |
|---|---|---|
| a word from the company's own **notes** | Leads page only — nowhere else | **100 of 108** |
| **who the record belongs to** | Leads page only — nowhere else | **88 of 108** |
| its **CR / VAT number** | everywhere **except** the Leads page | **20 of 108** |
| its own **website address** | nowhere at all, in any box | **25 of 108** |

That last row is the one I'd feel daily. Someone writes to you from `name@theircompany.com` and the
only thing you have is the domain. Typing it found nothing — on a book where 78 of your 108 records
have a website saved. (The count is 25 rather than 78 because for the other 53 the domain word
already appears in the company's name, so those were findable by accident.)

**Fixed.** All four boxes now read one shared list of details, and that list has gained the notes,
the owner, where the record came from, and the website. Re-measured on your real data straight after:
a word from a client's note now finds that client on the Clients page (it found nothing before), and
so does their owner's name. Nothing that worked before stopped working — I check that explicitly.

While doing it, the Leads box also stopped running a contact's name, e-mail and phone together into
one unbroken word — a small bug the other three boxes had already had fixed in September.

**Guarded.** The new test plants one made-up company carrying a different unique word in each detail
— notes, owner, website, CR number, Arabic name, contact e-mail — and asks all four boxes for each
word. It has two deliberate traps: a word that is in none of those details must find nothing
anywhere (otherwise a search that simply matched everything would look like a pass), and the
familiar searches must still work. I broke the fix three different ways to be sure the test notices:
each break failed exactly the checks it should, including both traps.

Structure, test-integrity and decisions checks green; full battery running.

---

## Routine fire #193 (2026-09-21 ~14:00 UTC) — the app was keeping three copies of your workspace in every browser, and a fix of mine that turned out to do nothing

**What was wrong.** Your browser keeps a working copy of the workspace on the computer, so the app
can draw a page before the database answers. It should keep **one**. Driving the app against your
real data, I measured a browser that had used it before, sitting on the sign-in screen, and it was
holding **three**: the real one (about 750 KB) and two leftovers from old versions of the app (about
750 KB each) — **2.3 MB where 750 KB was needed**.

The two leftovers are dead weight in the plainest sense: one of them is never read by any part of
the app at all, and the other only ever gets read by a browser opening a version of the app it has
never seen before. They were being rewritten from scratch **on every single page load**, by nine
leftover instructions from the migrations the app went through in June.

**Why it matters, in your terms.** A browser typically gives a website about **5 MB** of room. The
app already has a message it shows when that room runs out — *"Storage full — changes kept in memory
only"* — and when that message appears, someone can carry on working for an hour while none of it is
actually being written down. Your app was sitting at **roughly half that allowance**, two thirds of
it holding copies nothing reads, and it grows every time you add companies and invoices. This wasn't
tidying; it was the app's own worst failure, moved a lot closer.

**Fixed.** The nine leftover instructions are gone. Same browser, same real data, now: **750 KB, one
copy.** About **1.5 MB handed back** on every computer that uses the app. Nothing you see changed.

**The part I want to be straight about.** I also wrote a new cleanup routine to scrub the two
leftovers out of browsers that already had them, wired it in, and measured it reporting 528 KB
reclaimed. Then the test I wrote to protect it failed in a way that made no sense — so I measured
again, properly, with the new routine taken back out. **The storage came out byte-for-byte
identical.** The app has done this cleanup by itself since June: every time anyone signs in, it
already clears out old copies. My new routine was doing a job that was already being done.

I deleted it rather than ship it. A second thing doing the first thing's job is not free — it is one
more place to read, one more place to break, and a claim in the notes that isn't true. What actually
fixed this was removing the nine writes; the check now says so, and the rule written from it
(**M51**) says to measure with a new file removed before believing the new file is what fixed it.

**A second thing I got wrong, and fixed in the same round.** The first version of that test said it
was driving your real database. It wasn't — it was running against the practice copy, which is a
quarter the size, and I had written the numbers up from it. That is the exact trap your own notes
warn about, and it cost this round its first set of figures: the practice copy said 700 KB, your
real data says 2.3 MB. I re-measured through the real connection, and every number above is from
that. The test itself stays on the practice copy on purpose — it has to run 300 times in a row
without touching your data — but it now says so plainly instead of claiming otherwise.

**Guarded.** A new test drives two browsers — one at the sign-in screen, one signed in — and fails
if the store grows past one copy. Deliberately, it also fails on the lazy
version of this fix: I wrote that version too (just wipe the browser's storage) and ran it against
the test, and it fails on three counts, because it destroys the working copy and signs the person
out. Putting the old writes back fails the test on three counts as well, at 711,508 characters
against a 500,000 ceiling.

Structure check, probe-integrity check and decisions check all green; 93 app files, 301 probes.

---

## Routine fire #192 (2026-09-21 ~13:00 UTC) — a clean verification round, one real thing for you, and a test that was fighting the app

Two jobs this round. Neither found a fault in the app itself, which is worth saying plainly rather
than dressing something up.

**1. I re-checked the thing your notes call the richest source of bugs here.** Every company field
is stored twice — in a proper database column and in a copy inside the record. Rules were written in
September because the client card used to show a dash over values that were sitting in the column
all along.

Re-measured on your 28 clients, the split is exactly as recorded: payment terms in the column with
nothing in the copy on 20 clients, both contract dates on 19, credit limit on 8, CR/VAT, legal name
and entity type on 1 each — and **no cases at all** of the reverse, or of the two disagreeing. Then I
opened a real client card: the app now carries all seven values and **six of the seven print on
screen**. The fix holds.

The seventh is the credit limit, and not showing it is **deliberate** — the credit line is one of the
things Direct's own client master owns. I left it alone rather than pre-empt your open question about
what counts as extended credit.

**2. The one real finding, and it is about your data, not the software: 20 of your 28 clients have
nobody assigned to them.** Nineteen of those twenty arrived in a single import on 21 August; the
twentieth came from the Direct Payments import. **Every client that came in through a funnel or a
person has an owner.** So this is an import that never set ownership, not people forgetting.

It matters because "Mine" works by matching a person's name against the owner field — so roughly
seven in ten of your clients sit in nobody's list. **The app is not hiding it**: the owner filter on
the Clients page already reads "Unassigned (20)". Tell me who should own which and I will set them in
one go.

**3. A full test run, and a test that was wrong about the app.** 291 checks, 285 of them able to
fail, **all 285 green** — including everything touched by the eleven pieces added this session.

One test went red under load and green alone. Normally that means a busy machine. This time it
didn't: the detail showed it had **downloaded a real file**, so the page it claimed was empty wasn't.
The test emptied a page by replacing its list — and the app has a deliberate safeguard that spots a
list being replaced from outside and puts the rows back, built after a real bug where deleted rows
reappeared. **The app was right every time; the test was fighting a safety feature.** It now empties
the list in place, which the safeguard is designed to allow, and it checks the page really is empty
before judging. Re-run alongside five others at once: 6 of 6 green.

My own first attempt at that fix made it worse — I added a redraw that triggered the very refill I
was trying to avoid, which then failed on a quiet machine too. Recorded as rule **M50**: read the
safeguard before trying to out-wait it.

---

## Routine fire #191 (2026-09-21 ~11:00 UTC) — on a phone, tapping beside a tick box did nothing at all

Eleven new pieces have gone into the app this session and none of them had been looked at on a
phone. So I drove every page they touch at phone size (390 px, touch), in English and Arabic.

**Most of it is fine.** No page scrolls sideways. The wide tables — Leads, Clients, Suppliers,
Finance — scroll inside their own boxes exactly as they are meant to. No errors in either language.

**One thing was not fine, on the two pages with tick boxes.**

The tick box for selecting a row on Leads and Suppliers is **13 × 13 pixels** — the browser's
default, never made bigger. The app's own standard, written into the paging controls, is 26 px,
"because these are the controls the team hits most on a long list from a phone."

Worse than the size: the **cell** around it is a comfortable 52 × 59 px and was built to swallow your
tap so you don't accidentally open the record. Good instinct — but swallowing was all it did. Miss
that 13 px square on a moving bus and **nothing happens at all**. No tick, no record opening, no
message. You can't tell a miss from a slow app, so you tap again. And again.

**Fixed, and the fix changes nothing you can see.** The cell that was already swallowing the tap now
ticks the box. Nothing moved, nothing was restyled, no new styling at all — the target you were
already aiming at is now four times the size it needed to be. It works the same on Suppliers, and it
deliberately keeps its hands off any cell that holds something else, so a tap meant for a link is
never turned into a tick.

Guarded by `scripts/qa/probe-a-tap-beside-the-tick-box-counts.mjs` (8 checks). Brakes: it must still
not open the record, a tap on the box itself must tick once rather than twice, and a cell with a link
in it must be left alone. Sabotage-verified both ways. New rule **M49**.

**Two things I got wrong first, worth recording:** my first reading was "the checkbox is too small",
which would have led me to restyle it — measuring the *cell* instead found the real problem and a far
smaller fix. And my first test reported a failure that wasn't one: ticking a box redraws the row, so
the test was reading a piece of the page that no longer existed.

---

## Routine fire #190 (2026-09-21 ~09:00 UTC) — Finance was leaving 45 records out of every figure without saying so

The Finance page header reads **"46 invoices · data through 2026-08-20"**. Driven against your live
data, the page actually **had 91 records loaded and was dropping 45 of them** — out of revenue, out
of cost, out of profit, out of the client tables, out of the report builder. The words "excluded",
"held back" and "deleted" appeared nowhere on the page.

Those 45 split into two very different groups:

- **10 have a reason recorded** — the Takamol / Techtic verification revenue that is accounted for in
  another system and must never appear here. Correctly held back.
- **35 have no reason recorded at all.** They were soft-deleted during the data work on 20, 22 and 23
  August. They are still in the database, but a month past the 24-hour undo window, and the Archive
  page only covers companies — so nothing in the app mentioned they existed.

Finance now says it, once, at the top: **"45 finance records are held back from this page and are in
none of the figures above — 10 with a reason recorded and 35 with none. They are still in the
database; nothing has been erased."**

Three things I deliberately did **not** do:

- **no restore button.** These are money records. Bringing one back is your decision, not a session's.
- **no change to a single figure.** Your revenue, cost and profit read exactly as before — the point
  is that the page now tells you what it left out, not that it counts differently.
- **no sentence when there is nothing to report.** A clean ledger gets no apology.

**Something for you, and it is the reason this is worth your attention:** those 35 without a reason.
If they were meant to go, nothing needs doing and the sentence just keeps you informed. If any of
them should be counted, tell me and I will show you what they are — I can list them without changing
anything.

Guarded by `scripts/qa/probe-finance-says-what-it-held-back.mjs` (9 checks). Brakes: nothing said when
nothing is held back, the page's own figures unchanged, and the sentence must not follow you to
another page. Sabotage-verified both ways. New rule **M48**, which also records a trap I walked into:
the version that lumped all 45 into "no reason recorded" **still passed the adds-up check**, because
0 + 3 sums to 3 just as 2 + 1 does. Arithmetic that adds up is not arithmetic that is right.

---

