## Routine fire #241 (2026-09-24 ~17:00 UTC) — I hid a third of your audit log, and the test suite caught me

This one is a correction of my own work, so I want to be plain about it.

Two rounds ago I fixed a real problem on Activity & Audit: the tiles were counting "somebody was
refused a page" as "a record was changed", so a green 39 for the week actually meant nought records
changed. That fix was right and it stands.

But I also made the feed **hide** those refused visits until you press Show. On your real log that
is **131 of 378 rows off the page the moment you open it** — a third of an audit trail behind a line
most people would never click. An audit log that is quietly short is the exact fault this project
keeps paying for.

I did not spot it. The full test run did: two *older* tests went red, both of which check that a
refused visit appears on the feed and is named properly. They were written before my change, for a
problem already paid for once. That disagreement was the finding.

The feed now opens showing everything. The toggle stays, so anyone who wants only record changes can
press Hide — and if they do, and the log happens to hold nothing else, the page still says why
instead of looking empty.

I rewrote my own test to hold the corrected behaviour and wrote down the reasoning in it, rather
than just flipping it to agree with the new code — otherwise the next person reads a test that
looks confident and has no idea it was once wrong.

**Three things I measured in the same round and am deliberately NOT acting on**, recorded so the
next session doesn't spend a round rediscovering them:

- **The Finance → Transactions tab is empty.** `finance_transactions` holds 33 rows and every one
  of them was soft-deleted on 2026-08-22 — they came from the old demo world and a one-off
  promotion. Its search box has a real inconsistency (it doesn't fold Arabic spellings or
  Arabic-Indic digits the way every other box in the app does), but it is filtering an empty list,
  so today it costs nobody anything. Worth fixing when that tab carries data, not before.
- **The SOPs, Service Levels and Providers tables in the database are never read by the app.** Those
  pages draw from a separate store, so the row counts in the database (12, 14, 23) describe
  something nobody on the team sees — the SOP page, for instance, shows 22 procedures. Same shape as
  the Airlines page, which already says "showing 136 of 139" on screen. Nothing is broken; it is a
  trap for anyone who reads those counts and believes them.
- **The SOP procedures have no Arabic at all** — not a missing translation in the app, but no Arabic
  text in the data. The page furniture and the editor are fully translated; the twelve procedures
  themselves are English only. That is a content decision for you, not a bug.

---

## Routine fire #240 (2026-09-24 ~15:00 UTC) — what your team typed into a funnel form could not be searched for

When a colleague opens a company in the app, they answer that funnel's own questions: the MoT
licence and IATA numbers for a travel agency, the tender value and deadline for a tender, the
Direct Payments customer number and last invoice number for a company you have billed before,
where an outreach lead was met.

I counted those answers in your real database. **88 of your 108 companies carry at least one.** Then
I checked how many could be found by typing them into a search box: **136 of the 142 could not.**

Two of the 136 matter more than the rest — a Direct Payments customer number and an invoice
number. Somebody holding one of your invoices could not get from it to the company that was billed.

The cause was one function, and that is the good news. All four search boxes — the one at the top
of the screen, the Leads box, the Clients box and the keyboard palette — ask the same piece of code
what a company's searchable text is. That code was built from the company's own details and its
contacts, and nobody had added the funnel answers. One line reaches all four.

Re-counted against your real data after the fix: **0 of 142 unfindable.** I also tested it on the
live app, not just a stand-in — typing a real invoice number now brings back exactly one company,
correctly marked as a client.

**The company's own phone had the same problem.** The website-form funnel asks for the company's
official phone number, which is not any one person's contact record, so the "a number is the same
number however it's written" rule never looked at it. It does now.

**One thing I deliberately left out:** a yes/no answer, and any answer that is a nested block of
data rather than words. Including those would have put the word "true" into every record that ever
answered a yes/no question — a search box that matches everything is worse than one that matches
nothing. That limit is tested, not just intended.

---

## Routine fire #239 (2026-09-24 ~13:00 UTC) — checking that the broken shapes aren't actually in your data

The last two rounds hardened the app against records it cannot read — a damaged activity entry that
could empty your whole company list, a date nothing can parse, an invoice whose profit doesn't equal
revenue minus cost. Hardening answers *what happens if*. It does not answer *is any of it actually
there*, and no amount of testing against a stand-in can.

So I wrote a check that asks your real database directly, and ran it: **108 companies, 46 invoices,
80 events, and every one of the thirteen broken shapes came back zero.** Your data is clean. Those
two fixes are precautions, not repairs — and now that can be confirmed with one command instead of
an argument.

Three details worth knowing, because they are what makes the answer trustworthy:

- It prints **every** count, including the zeros. A report that lists only problems cannot be told
  apart from a report that failed to look.
- If it cannot reach the database it says so and returns a **different** answer from "clean" — no
  silent green because the network was down.
- I proved it can fail before trusting it: fed six deliberately broken records alongside the real
  read, it found all six and named them.

It reads and never writes. It joins the two other checks that have to be run by hand rather than in
the bulk suite, because they touch the live system.

---

## Routine fire #238 (2026-09-24 ~11:00 UTC) — the money page explained a real contradiction away as rounding

I fed the Finance page deliberately broken invoice rows — empty money columns, the word "abc" where
a cost goes, a negative pair, an unreadable date, and one row whose stored profit simply doesn't
equal its revenue minus its cost.

The page said:

> **"Each figure above is rounded on its own, so -2,100 minus -7,700 reads as 5,600 where Profit
> reads 5,799."**

That is a **199-riyal contradiction** being explained as a rounding quirk — on the one screen where
your rule is that cost, profit and revenue must always be clean. The sentence itself was written for
a real and useful purpose: rounding genuinely can make three correct figures look a riyal apart. But
it was being used for any mismatch at all, however large.

Now the page tells the two apart. A gap under a riyal still gets the rounding explanation. Anything
bigger reads: **"The profit shown does not equal revenue minus cost — a gap of 199 SAR, from 1 row
whose stored figures disagree. This is not rounding; the stored numbers themselves do not
reconcile."**

**Second fault from the same test:** the header read **"data through 32/13/2026"** — it was taking
whichever date sorted highest as your data cutoff, so one nonsense date won. It now only considers
dates it can actually read.

**Neither is happening to you today** — your database refuses to store an invoice whose figures
don't reconcile, and I re-checked all 46 — so this is the money page refusing to mislead you on the
day something slips through, not a fire being put out.

**Three things the page already did right**, confirmed in the same run: a row with text where a
number belongs is counted as zero *and says so* ("Check the import"); nothing anywhere prints NaN or
a broken date; and no VAT figure appears on the money screen at all.

---

## Routine fire #237 (2026-09-24 ~09:00 UTC) — one bad record could wipe your whole company list

I handed the app five deliberately broken records — the shapes a spreadsheet import or a
hand-written database edit really produces: a company with no name, a stage that isn't a stage, the
word "abc" where a credit limit goes, "32/13/2026" as a date, and one record whose history had an
empty slot in it.

**The app ended up with no companies at all.** Not five, not four — zero. Nothing on screen said
why; the only trace was a note in the browser's developer console that nobody ever sees. The single
empty slot in one record's history was enough. **Had that record been one of your 108, you would
have lost the lot from the screen.**

Fixed three ways:

- The converter no longer trips over an empty slot in a record's history — the specific fault.
- **A record the app genuinely cannot read now costs that record and nothing else.** The rest load
  normally.
- **And the list says so**: "1 record could not be read and is missing from this list. Everything
  else loaded normally." A quietly shorter list is exactly the kind of thing this app has been
  bitten by before.

**A second, separate fault fell out of the same test, and it was on screen in both languages.** A
record with a nonsensical last-contact value made the Leads list print «قبل NaN ي» in Arabic and
"NaNd ago" in English — literally the letters N-a-N where a number of days should be. It now shows
the same dash it uses for "we don't know".

I nearly missed the English half: my own check was looking for "NaN" as a separate word, and
"NaNd ago" runs it together. Widened.

**Four things measured in the same sweep and found already correct**, so you know where the app is
solid: Finance prints no figure at all when its data fails; documents print "the company details
come from the registry" rather than an invented CR number; Events says it couldn't *refresh* and
shows what it already had; and if the app can't read your role it lets you in and retries rather
than locking you out.

---

## Routine fire #236 (2026-09-24 ~07:00 UTC) — "Today is calm" while the app knew its own data hadn't loaded

Following the same method as last round — break one thing and see what the app claims — I failed the
request that loads your **workspace** (airlines, procedures, service levels, settings) rather than
your companies.

The Today screen came up and told you, twice:

> **"Nothing urgent. Today is calm."** … **"Nothing urgent right now — all clear."**

Neither is a judgement about your day. Both were worked out from records that never arrived. The app
knew — it had already marked internally that the real records were not loaded, and it printed a red
"Could not load workspace" line at the top — and then reassured you anyway.

An earlier round had already fixed *what* those two lines count. What neither of them asked is
whether the things being counted are real. Now they do: when your records have not loaded, Today
says **"Today cannot be judged — your records have not loaded"**, with the same banner and the app's
own explanation, in both languages. On a normal load nothing changes — both verdicts read exactly as
before.

**One thing I got wrong and caught:** my first version of the check would have accepted a fix that
blanked *every* short line on the page, not just those two verdicts. I deliberately built that
broken version to test my own check, it passed, and I added the missing check. An ordinary sentence
sitting beside a verdict now has to survive.

**And one page that is already exactly right, so you know it is safe:** the **Finance** page. Fail
its data and it prints no figure at all — just *"Nothing was loaded — do not read any figure from
this page until it loads."* That is the standard I am holding the rest of the app to.

---

## Routine fire #235 (2026-09-24 ~05:00 UTC) — when your companies fail to load, the app was showing you 65 invented ones

This is the most serious thing I have found in this stretch, and it is fixed.

I made the database refuse one request — the one that fetches your companies — and signed in. The
Leads page came up looking completely normal:

> **0** New this month · **57** In pipeline · **12%** · Became clients · **8 of 65**

Sixty-five companies, a full pipeline, stage counts, rows you can open. **Not one of them is real.**
They are the demo records the app ships with — "Falcon Conferences Group", "Crestline Minerals" —
sample data meant for a first look at an empty app. Your database has 108 real companies and not one
of them was on the screen.

The app did print a red line saying "Could not load leads". But it sat above a page that looked
entirely ordinary, and everything below it was invented. Miss that one line — and it is one line
above a screenful — and you are reading a fictional pipeline. Worse, those rows behave like real
records: you can open one and start editing it.

I checked that this is genuinely visible and not hidden behind the login box: it is. The login
overlay is gone, the page is full height, and what is painted in the middle of your screen is that
fake pipeline.

**What happens now:** if your companies have not loaded, the list shows **nothing** and says so —
"Your companies are not loaded — this list is empty for that reason, not because you have none" —
and it repeats the app's own explanation, so a permissions problem reads differently from a server
fault. The demo records are kept aside and put straight back the moment the real ones arrive, so a
slow connection costs you nothing.

**Two things I was careful about, because a false alarm would be its own problem:** on a normal load
this does nothing at all — no message, all 108 companies present — and a workspace that genuinely
has no companies yet is *not* told its data failed to load.

**Worth knowing:** the app already had a flag marking "these are the real records", added in
September with a note warning about exactly this — but it had only ever been used on one card on the
Today screen. Every list in the app was still drawing the samples.

---

## Routine fire #234 (2026-09-24 ~03:00 UTC) — a full cross-check of every number on screen, and one quiet fault fixed before it bites

**I checked every count the app puts on screen against the database itself.** Eleven pages, and
**every single number agrees**: 28 clients, 78 leads shown of 80 (two closed ones hidden, and the
page says so), 43 of 80 events, 136 of 139 airlines (the page says that too), 23 providers, 14
service levels, 378 log entries, 4 deleted companies, and Finance's "19 of 46 invoices". Nothing on
any screen is inventing or mis-stating a figure.

**Also checked and correct, so you need not wonder:**

- **The Clients table** is filled in on every column except "Next review", which 21 of your 28
  clients have never had set. Everything else — account manager, tier, client since, health —
  reads on all 28.
- **The Events page in Arabic.** Nineteen of your 80 events have no Arabic name on file, and not one
  row comes out blank or English-only — each shows both names. The event editor is fully Arabic:
  21 field labels, 25 dropdown choices, both buttons. Event rows are not clickable by design; they
  carry their own Edit and Delete buttons.
- **"Next action" being empty on every lead is correct** — exactly one record in the whole database
  has a next action set, and it is a client, so the Leads list is right to show nothing.

**The one fault, and I want to be straight about its size: it is not hurting you today.** When the
app reads a company back from the database, the "next action" note and date were written in a way
that would **wipe a value a colleague had typed** if it had not also been copied to a second place.
Measured before touching it: only one record has a next action at all, and it has both copies, so
nothing has been lost. Fixed now while it costs nothing to fix.

The same line had a second flaw that would have been wrong with any data: if no date was set, it
put the **note text into the date field** — so "Call the finance team" could end up where a date
belongs, on a screen that then works out whether that date is overdue. That is gone.

---

## Routine fire #233 (2026-09-24 ~01:00 UTC) — the Leads list said nobody had been contacted, and 25 of them had

I counted, column by column, how much of your Leads list is actually filled in. Of the seven
columns, three said nothing at all:

- **Last activity** — a dash on **all 78 rows**.
- **Next action** — a dash on all 78.
- **Priority** — the word "Cool" on all 78 (it is partly worked out from how recently someone was
  contacted, and that was missing).

And the row highlight that marks a lead nobody has touched for a fortnight had **never once
appeared**, because it reads the same missing field.

**Twenty-five of those leads do have a logged call or note.** The app was holding the history and
the list was saying there was none. The reason: those activities live in a separate table that gets
attached to each company a moment after the page loads, and the rule that works out "last contact"
had already run, before they arrived.

Fixed. **Last activity now shows a real date on 25 of the 78 rows**, and the "gone quiet" highlight
marks those same 25 for the first time. Nothing is guessed: a lead with no history still shows a
dash, and a lead that already has a last-contact date on file keeps it.

**Nothing is written to your database for this.** The date is worked out for display only and is
deliberately removed again before saving, so no record is touched just because the app showed
something. That mattered more than it sounds — an earlier version of this same idea once caused 29
untouched companies to be rewritten.

**And one mistake of mine, caught by your own test suite within minutes.** My first version removed
the date too eagerly: if you deleted an activity, the app correctly works out a new last-contact
date from what remains, and my change was throwing that real date away before it could save. A
check that already existed went red and named it. Fixed and re-verified.

**Still open, and yours to decide:** "Next action" is genuinely empty on every lead — nobody has set
one — and Priority will stay flat until more leads have contact history behind them.

---

## Routine fire #232 (2026-09-23 ~23:00 UTC) — five English headings on the Arabic side, hiding behind a green check

A check written in an earlier round makes sure no page heading is left in English when the app is in
Arabic. It has been passing. It was passing because it only ever looked at **19 of your 25 screens**.

I widened it to all 25, and it went red at once — all five on the **Dashboard**:

- The **"Agency profile — KSA settings"** card, where every single word underneath is in Arabic and
  the title above it was in English.
- **"Top relationships by lifetime value"**, **"Pipeline by category"**, **"Conversion funnel"** and
  **"Standard of service"** — four more headings, all English on the Arabic page.

All five are fixed, and the check now sweeps every address the app answers, so a screen cannot be
missed simply by not being on somebody's list.

**Two things I checked and found correct, so you don't need to wonder about them:**

- **Every page that has something on it can be reached by clicking.** The sidebar carries 20 entries
  including Activity & Audit and Archive. One diagnostic claims the **Sync** page has no way in —
  that is wrong: **Settings → Connections** opens it. (Worth knowing what that page is: it lists
  where each kind of real work lives — corporate clients, invoices, expenses, refunds, receipts,
  pricing — with a link straight into Direct Payments for each, plus the Amadeus office, the shared
  mailboxes and Drive. It is the best orientation page in the app for somebody new.)
- **The Agency profile card is now exactly right** — it shows the registered details, says plainly
  that they are shown and not edited there, names the three fields the registry has no place for
  yet (IATA Wakeel number, Zakat/Tax ID, bank name), and offers one button to the real registry.

---

## Routine fire #231 (2026-09-23 ~21:00 UTC) — two people, one company, and one of them loses their work silently

I re-ran a test this project wrote back on 10 September and parked. It still does exactly what it
did then, and it is the most serious thing I have found today.

**Two people have the same company open.** One logs a call note and sets a next action, and saves.
The other — who opened the record earlier and has an older copy on screen — changes only the
segment, and saves two seconds later. Afterwards the database holds the segment, and **the call note
and the next action are gone.** Both people saw a green "Saved". Nothing anywhere said anything was
lost.

The note about it in our own landmines file says "revisit only if it actually bites." It bites.

**What I have done, and what I deliberately have not.** The app now asks the database, at the moment
you save, whether anybody else has written that company since you last looked. If somebody has, it
says so, by name: *"Somebody else changed 'X' while you had it open. Your save has just gone out,
and it may have replaced part of what they did. Open Activity & Audit to see both changes — an undo
is there for 24 hours."* That is true, it points at where the record really can be recovered, and it
never blocks or slows a save.

**It does not stop the overwrite, and I would not do that without asking you.** The reason is worth
knowing: nearly everything a person edits about a company is stored in one single field, so two
people editing different things still land on the same field. Genuinely merging them means changing
the one piece of code where a mistake stops the whole team saving. That is your decision to make,
not something to slip into a testing round — **it is the biggest open item on this list now.**

Two things I made sure of, because a warning that fires wrongly is worse than none: when nobody else
has touched the record there is no message at all, and if the database answers too slowly to be
trusted the app says nothing rather than guess.

**And one mistake of my own, caught before it shipped.** The first version asked the database using
the wrong kind of identifier, and was watching **21 of your 108 companies** while looking perfectly
healthy in testing — the test data all has one shape, the real data has two. Found by running it
against the real database. It now watches all 108, and there is a check that fails if that ever
slips again.

---

## Routine fire #230 (2026-09-23 ~19:00 UTC) — all 322 checks green, and the Activity page was mostly reporting my own testing

**First: the full battery. 322 checks that can fail, every one passed, no failures at any point.**
That is the fourth clean run in a row, and it covers the nine rounds of changes made since the last
one.

**Then the Activity & Audit page, which turned out to be counting the wrong thing.** Its tiles read
**378 events loaded · 0 today · 39 this week**, and the green 39 looks like a week's work. All
thirty-nine were **refused page visits** — somebody opening a page they are not allowed to open —
and not one record changed in those seven days. Of the whole log, **131 of 378 events are
refusals**, and the feed opened with twelve of them in a row, so the page whose job is to tell you
what changed was mostly telling you what didn't.

**Those refusals are mine.** They are the test account, on the days these sweeps ran: when a session
drives the app as a restricted role to check that blocking works, the database records each refusal.
Nobody on your team is being turned away. I have not deleted them, and I would not — the log is
written by the database precisely so that nothing can edit it, and that is worth more than a tidy
screen.

What changed instead: **every tile now says how much of its number is refusals** ("all 39 were
refused page visits — no record changed"), and **the feed hides them by default behind a line that
names the count** — "131 refused page visits hidden · Show" — the same pattern your Leads list uses
for closed leads. One click brings them back. The counts never hide anything: if a real person ever
does start getting refused, the number is on screen whether the rows are shown or not.

**One more thing, found while reading the page in Arabic.** The line under "Today" said «قبل 2
أيام». Arabic counts two of anything with a dual form — «قبل يومين» — and past ten it changes again.
All four cases now read properly.

---

## Routine fire #229 (2026-09-23 ~17:00 UTC) — the same fault on the Airlines page, in Arabic only

Having fixed it on Leads and (earlier) on Clients, I went through every remaining clickable column
in the app. Airlines and Providers are the rest of them — nine columns — and I clicked all nine in
both languages against your real register of 136 carriers.

**Seven are correct.** One is wrong, in Arabic only: **Authority**. It sorted by the wording stored
underneath ("Authorized — BSP KSA", "No authority — target" and so on) while the column shows just
two words. In English that came out right by accident. In Arabic it read **مصرّح (80) then مستهدف
(56)**, which is the wrong way round — س comes before ص in the alphabet. The grouping was right and
the order was back to front.

**KSA BSP** had the same fault and got away with it: it sorted by "No"/"Yes" while showing لا/نعم,
and those two happen to fall in the same order in both languages. It is now keyed off the words on
screen as well, so it will stay right if either wording ever changes.

Both columns now take their Arabic from the app's own dictionary rather than a second copy kept
next to the table — a copy that drifts is one of the recurring faults here.

Two more things came out of doing it:

- **A dash is not a value.** Four low-cost carriers have an em dash stored where the BSP stock
  number goes. My first version of the fix sorted that dash as if it were text, which put those
  four at the **top** of the column instead of the bottom. Caught by re-measuring before committing;
  a dash now sorts with the blanks, and there is a check that fails if that ever changes.
- **Rows that tie now fall into name order.** With 80 carriers all reading "Authorized", they used
  to come back in whatever order the previous click happened to leave them in.

While measuring I also confirmed the **Providers "Type" column holds 15 different wordings**, not
the 12 recorded further down this file — worth knowing if you decide to translate them, which is
still on your list below.

---

## Routine fire #228 (2026-09-23 ~16:00 UTC) — the Leads table's "Funnel" column sorted by something that isn't on the screen

I clicked every column header on the Leads list against your real 80 leads, in English and in
Arabic. Four of the six sort correctly. Two did not.

**Funnel.** Clicking it did nothing to the funnel. Your 78 visible leads sit in exactly two funnels
— Website Form — Entities and Website Form — B2B — and after clicking "Funnel" they came out in
**thirteen separate blocks**, the seven B2B rows scattered all through the others. The reason: it
was ordering by the raw import tag each record came in with, and every one of your leads carries the
same tag, so the column had nothing to order by and fell back to the company name. Same in both
languages, both directions.

**Owner, in Arabic.** It ordered by the person's stored full name while the cell shows the nickname.
In Arabic the column read عبدالرحمن / أبو ناصر / أبو سليمان — back to front, since ع comes after أ
in the alphabet.

Both now sort by the words actually in the cell, in the language you are reading, so Arabic sorts as
Arabic. A lead with no funnel at all now goes to the bottom of a funnel sort instead of being filed
under its import tag. This is the same fix made on the **Clients** table in fire #99; it is now a
written rule (M75) so the next table gets it right the first time.

**Two things I noticed while measuring, both facts rather than faults — you may want to act on
them:**

- **The "Priority" column says "Cool" on all 78 leads.** The sort works, but there is nothing to
  sort — every lead scores the same, so the column that is meant to tell you what to work first is
  currently telling you nothing. It is driven by things like recent contact and deal value, and the
  leads have neither on file yet.
- **"Last activity" is "—" on all 78.** No lead has a contact date recorded. That is also why the
  "no touch in 14 days" highlight never appears on this list.

Nothing was written to the database at any point, and the page threw no errors in either language.

---

## Routine fire #227 (2026-09-23 ~15:00 UTC) — the Archive page said three zeros, and 45 deleted invoices were sitting somewhere else

The Archive page opens with four counts: **archived invoices 0 · archived bookings 0 · archived
offers 0 · deleted companies 4**. The four is right. The three zeros are true of what they count and
misleading to the person reading them.

Those three count **this app's own drafts** — the invoice, booking and offer drafts the workspace
keeps for itself. There are none, so they read zero. But the finance ledger, the one you actually
work in, holds **45 deleted invoices** right now. They are not erased; Finance deletes softly and
restores from its own screen. Somebody who deleted a row on the Finance page, went looking for it in
the Archive, and read "archived invoices: 0" would reasonably conclude it was gone for good — and
might re-key it.

Fixed: the page now says, in both languages, that those three counts cover this app's own drafts
only, and that invoices deleted on the Finance page are soft-deleted and restored from that same
page. It deliberately **does not quote the number 45**: the ledger is not loaded on that screen, so
a figure there could only be a second copy drifting out of step with the real one. It names the
place, and the place shows the real count.

This is the third page in this sweep where a zero needed to say what it counts (#210's board, #223's
silent count). It is now a written rule, M74.

**Three things I checked while I was in there and found correct, so you don't need to worry about
them:**

- **The renewals radar is exact** — four lapsed, three inside 90 days, and the rows with no expiry
  date on file are shown saying so rather than quietly left out. Correct order, correct in Arabic.
- **The one-pager refuses to print a lapsed credential.** It drops PCI-DSS and DUNS from the
  document and tells whoever is printing why, in a box the client does not see.
- **Restore works and asks first.** It names the company, and pressing Cancel sends nothing. It only
  offers itself for an ordinary deletion — a company removed as a duplicate keeps its "merged into…"
  line and no Restore button, so nobody can resurrect a duplicate you already cleaned up. None of
  your four archived companies is an ordinary deletion (three merges and one you ruled on), so I had
  to construct that case to test it.

---

## Routine fire #226 (2026-09-23 ~14:00 UTC) — all 313 checks re-run: every one green, and a date you should know about

Five rounds of changes had gone in since the last full run, touching nine files. I re-ran the whole
battery — **313 checks that can fail, and every one passed, with no failures at any point.** That is
the third full run in a row with nothing red.

**While it ran I looked at your company registry, and there is one date worth putting in your
calendar.** Of the 29 entries, seven carry an expiry date:

- **Four have already lapsed** — ISO 9001, DUNS, the Saudization certificate and PCI-DSS. None of
  them is set to appear on documents, so nothing expired is being printed at a client. They are the
  same four already on the list below.
- **Three expire soon** — Monshaat in about seven weeks, and **your commercial registration and the
  Chamber membership on 14 December**.

The CR is the one that matters, because it is the *only* expiring entry marked to appear on
documents — and since last round it is the number printed at the top of every client PDF. If it is
not renewed (or the registry not updated) those documents would start carrying an expired
registration number in December.

The other 22 entries have no expiry recorded at all, including the VAT number, the IATA and MoT
licences and the bank guarantee. So the renewals picture is only as complete as those seven dates —
if you want it to be a real radar, those are the gaps to fill.

---

## Routine fire #225 (2026-09-23 ~13:00 UTC) — the Arabic button said "new job" where it meant "new company"

On the Leads page in Arabic, the main button — the one everyone presses to add a company — read
**«+ عمل جديد»**, which means "new work" or "new job". The dialog it opens is called **«جهة جديدة»**
and the first thing it asks for is **«اسم الجهة»**. Three words for one thing, on your busiest page,
and the one on the button was the wrong one: what you are adding is a company, not a job. It now
says «+ جهة جديدة», matching the dialog.

I then checked the whole Arabic word list the same way — 777 translated labels — and found one more:
"Chain of command" was written two different ways, neither of them matching the button people
actually press on a client card («التسلسل الإداري»). All three now agree.

**Everything else it flagged is correct Arabic and I left it alone**, which is worth saying because
a naive "no word appears twice" rule would have broken it: Arabic adjectives change with the noun
(متأخر / متأخرة), a heading takes "the" where a small badge does not (العميل / عميل), and a verb on
a button is not the same as a noun in a column (فتح / مفتوحة). Nine of these are now written down,
each with its reason, and the check will complain if a *new* inconsistency appears — or if one of
those nine reasons stops applying.

**Also checked this round and found correct:** the Operations board (empty, and it says so in both
languages, with the explanation that the zeros mean nothing was created rather than something
failing), and the three "create new" forms — a request, a company, an SOP. All three refuse an empty
save, name the field that is missing, and put the cursor in it, in both languages.

---

## Routine fire #224 (2026-09-23 ~12:00 UTC) — changing someone's access now asks you first

On the Team & Access panel, switching a colleague's account off — or changing what they can do —
happened on the **first click, with nothing asked**. No "are you sure", no undo. This app already
asks before you delete something as small as a service level, and an account that has been switched
off cannot sign in.

Both now ask, and the question names the person and what is about to happen: *"Switch [name]'s
account off? They will not be able to sign in."* Cancel leaves everything exactly as it was,
including the level box, which used to be left showing a change nobody agreed to.

**And something I got wrong, which is worth telling you about.** I also noticed that the panel lets
you switch off *your own* account, and lets the last admin switch off the last admin — which looked
like one click from locking yourself, or the company, out. So I removed those buttons from your own
row. Then one of the existing automated checks went from 73 out of 73 to 69.

The reason: **your system already refuses this.** If you try to switch yourself off, the server says
no and tells you why — and one of the checks deliberately does exactly that, through those buttons,
to prove the screen handles a refusal honestly. By hiding the buttons I had made a real protection
untestable while adding nothing. I put them back and wrote down why, so nobody removes them again in
six months. Your accounts were never at risk.

---

## Routine fire #223 (2026-09-23 ~11:00 UTC) — when the contacts don't load, the Leads page now says so

I spent this round breaking things on purpose: I cut off each part of your data in turn, one at a
time, and looked at what the app told me. Most of it behaved well — Finance, Events and Activity all
say "Could not load…" and offer to try again, rather than showing zeros.

**One case was quietly misleading.** If the contact people fail to load, the Leads page's "Needs
attention" button drops from **71 to 1** — and said nothing about why. The number itself is correct:
the app deliberately stops counting "this company has nobody on it" when it can't tell, because not
knowing is not the same as nobody. But if you know that number is usually 71 and you see 1, the
natural conclusion is that the team had a very good week.

There was already an explanation, but only on an individual company's card — which you'd see after
you went looking. Now the Leads and Clients lists say it at the top, with a "Try again" link, and it
disappears the moment the contacts load properly. The check that holds this fails if the warning ever
shows when nothing is wrong, because a warning that is always on screen is not a warning.

---

