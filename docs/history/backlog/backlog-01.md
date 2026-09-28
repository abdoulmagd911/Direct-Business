# ⬆ Waiting on you — twenty decisions, most urgent first

*Written 2026-09-21. These built up one at a time across the sweep, each buried at the bottom of the
round that found it, which means none of them ever arrived anywhere you'd see. This is the whole
list in one place. Nothing here is broken software — every one is a judgement only you can make.
Answer them in any order; each is independent. When one is settled, it moves out of this list and
into the round that closes it.*

**0 · Should team members see Finance at all?** Seven of your eleven accounts are team members;
Finance sits in their menu, and the database will not let them read a single invoice. Until today
that combination told them the company had earned 0 SAR and achieved 0% of its target — now it tells
them plainly that nothing reached their browser and to ask an admin. Two clean answers: **take
Finance out of their menu**, or **let them read the ledger**. The middle is the only bad option, and
it is where you are. Either takes me minutes. *Raised #196.*

**0b · A team member can set the revenue target, but cannot see a single invoice.** The database
carries two separate permissions for the targets table and they add up rather than narrowing: one
says admin and manager, the other says admin, manager and team member. No screen offers it — the
button is admin-and-manager — so nothing is wrong today. But it is the opposite of the Finance
question above, on the same role, and the two should probably be settled together. Tell me which
way and I'll set it. *Raised #201.*

**0c · Four dropdown words have no Arabic, and I won't invent them.** The tender-status field
offers exactly four choices — preparing, applied, won, lost — and unlike every other funnel word,
those four have no Arabic saved anywhere. So in Arabic the field label now reads «حالة المناقصة»
correctly and the value beside it still reads "Won". Give me the four Arabic words and it's done in
a minute; I'm not guessing at wording you'd have to live with on screen. *Raised #203.*

**0d · 44% of your profit line rests on a blank, and the tool for filling it has never been used.**
19 of the 46 invoices record cost as 0, carrying 214,550 of 492,622.59 SAR of profit. The Expenses
tab exists for exactly this — it is built, bilingual, and keeps the receipt with each entry — and
has **zero** entries (counted in the live database today; the one row there was deleted). Two clean
answers: **use it going forward**, or **decide the cost side lives only in Direct Payments and I
take the tab out of this app**. The middle is where you are: the app asks for a figure nobody
supplies, and the profit it prints is the full sale price on 19 sales. Entering the history is real
work and I am not going to invent the numbers. *Raised #207.*

**1 · Four company certificates have lapsed, and the commercial registration expires 2026-12-14.**
ISO 9001 (Feb 2025), DUNS (Sep 2025), Saudization (Jan 2026), PCI DSS (Jul 2026). The CR is 85 days
out. Nothing in the app can renew a certificate — this is a real-world deadline, and the only
software part is done: since #163 the morning screen tells admins and managers when something is
lapsed or due inside sixty days, so nobody finds out by accident. *Raised #163.*

**2 · One page on the internet still serves three real records with no sign-in.** The
`manual-confirm` page's `/data` address. It is also the only thing that can clear a "needs
confirmation" flag, and there are exactly 3 records left flagged (1 company, 2 contacts).
**Recommended: review those 3, then delete the page** — I can clear the flags directly afterwards.
Say the word and I do both. If you'd rather keep it, the alternative is putting it behind a sign-in.
*Raised #134, still open.*

**3 · A view-only share link still shows OWNER, NEXT ACTION, PRIORITY, TIER and HEALTH.** Since #165
and #166 a link holder can no longer read our call notes, comments or free notes, and can no longer
download the pipeline. Those five columns are the remaining question: they are internal judgements,
but they are arguably part of "the pipeline" the link promises. It depends entirely on who you send
these links to. One line each to take them off. *Raised #166.*

**4 · Where the team's event-website logins will be stored is readable by everyone.** The table is
**empty today**, so nothing is at risk. But its access rule is "any signed-in user, all operations",
so the first login saved there is readable — and deletable — by every account including a read-only
viewer. Worth deciding before the first one is saved, not after. I have not touched it because
changing a live access rule is how people get locked out. *Raised #120-era, still open.*

**5 · Two client records share one person — are they one company or two?** The app now says so on
both cards instead of staying quiet. I cannot answer it: merging two real companies that are
actually one, or keeping two that are actually one, are both wrong in ways only you can see. *Raised
#142.*

**6 · 58 contact-form submissions are sitting in a table no screen reads.** 55 never reviewed; 38 of
those are marked *vendor*, 13 *review*, 4 *suspicious*. Only 3 carry an outcome. Either they are
worth a screen — and I will build one — or they are dead and the table should be archived so it
stops looking like pending work. *Raised #152.*

**7 · A 200-row registry of travel agencies is in the database, linked to nothing.** 182 carry an
official licence number, plus VAT, IATA, IBAN, phones and cities. Every row's link to a lead is
empty, and no code reads the table. This is the travel-agencies project already parked here — the
question is whether to start it. *Raised #152.*

**8 · Is the Zakat / Tax ID the app already holds still current?** Since #161 every document prints
only what the company registry holds, and the registry has no Zakat / Tax ID — so the one-pager
correctly stays silent. But #167 found the number **is** in the app, in an older store nothing reads
any more, along with an IATA Wakeel / agent number and a bank name. Confirm those three are current
and I move them into the registry, where the documents will pick them up. *Raised #161, answered
halfway by #167.*

**9 · Arabic wording is needed for 30 KPI titles and five funnel dropdown lists.** An Arabic reader
currently picks a partner type from raw English keys. This is a content decision about how Direct
speaks, not something a QA round should invent. Send the wording and it goes in the same day.
*Raised #121 and earlier.*

**16 · Nine pages ignore the "Viewer" setting in Team & Access — which of them matter?** Nobody is
set to Viewer today, so nothing is wrong on anyone's screen. **Since #189 the app tells you this
itself**: choose Viewer on one of the nine and the row says "not enforced yet", with a line naming all
nine. The Generator was fixed in #184; Leads (83 typeable fields), Clients, Proposals, Operations,
Reports, Events (it still offers Delete), Airlines (139 fields), Suppliers and SOP & SLA still let a
"Viewer" change things. Name the ones you care about and I will do each the same careful way. Not done
unasked: a blunt fix across nine pages is how a working screen gets broken. *Raised #184, made visible
in the app #189.*

**15 · Three of your 23 suppliers look like the same supplier twice.** *Travelfusion* and *Travel
Fusion*, *RateHawk* and *Rate Hawk*, *Travelport* and *Galileo / Travelport* — six records, probably
three suppliers. Each pair holds different details, so merging means deciding which side is right;
that is your call, not a session's. Say which of each pair to keep and I will fold the other in and
leave the old record recoverable. *Raised #182.*

**14 · Should all seven employees be able to *edit* Finance, or only read it?** They are meant to
reach Finance — it is in the built-in floor every account gets — but all seven are set to **Editor**,
so they can change and delete money records (#174). That may be right for a team this size; if not,
it is four clicks each in Team & Access. Not urgent: deletions are soft and Activity & Audit can undo
them. *Raised #174.*

**13 · What counts as "extended credit"?** The Commercial Credit Pool card on the morning screen
shows how much of a 1.25M cap is in use — counted from invoices held inside the app, of which there
are none, not from the finance ledger's 46 (#173). Its zeros are right today only by coincidence. To
compute it for real I need your rule: which invoices count as credit extended, what a wallet
deduction does to the figure, and whether the cap really is per calendar month. *Raised #173.*

**12 · Should the Airlines page read the real airline register?** It currently reads a copy inside
the settings record that is three airlines behind — including one the register says operates in
Saudi Arabia — and four contact lists behind (#171). Moving it across also means its Edit button
starts writing to the register. One round, a probe either side. The page now admits the gap
meanwhile. *Raised #171.*

**11 · Where should the company's KPIs and achievements actually live?** The Reports page shows
"N / 30 KPIs with data" and a percentage against each 2026 objective — and every bit of it is saved
in whichever browser typed it, not in the database and not in the backup (#170). Three honest
options: leave it per-person, if these are personal working notes; move it into this app's database
so the team shares one set; or accept that it belongs in your separate appraisal/KPI system and take
the tab out of this app. Until you say, the page now warns people rather than misleading them.
*Raised #170.*

**10 · A supplier analyst's personal mobile is still in this repository's history.** The live files
were cleaned in #140. Removing it from the *history* means rewriting the repository's past, which
breaks any other session's work in flight and cannot be undone. I will not do that without you
saying so explicitly. The number belongs to someone outside Direct, which is the only reason it is
on this list at all. *Raised #140.*

---

## Owner's decisions of 27 Sep (relayed by the oversight chat) — the change log, managers edit people, the QA account, the wipe (2026-09-27, Claude Code)

**Done on live:** the wipe — `world30_finance_invoices` (28 rows), `world30_finance_client_links` (10), `master_db_companies`
(200) and `company_achievements` (34) emptied after a backup (stamp `20260927T113348Z`, private bucket `golive-backups`,
every table read back and proved restorable); the teams Strategy and Integrity retired (not deleted — nobody deletes a team,
D11; neither had people or work). Recorded in the log as the QA account.
**Built, in review (D13):** the change log on every record (who, when, field, before, after), admins and managers only;
managers may edit people including admins, logged; business@ as the QA account, and every change from a database session
logged as it. **Still open from the same list, one PR each:** A) the Finance freeze — not reproduced as the QA account
(every tab, both languages, no stall over 12 ms on the empty live database): needs the time and tab, a browser recording, or
a test login for business@; B) speed (105 script files, repeated database calls, retired tables still loaded on Today,
the page jumping while it loads); C) the login/reset loop — the custom mail sender needs the owner's directksa.com mail
settings; D) the Direct Payments Excel files (View All Invoices non-simplified, corporate Transactions, corporate Expenses) in
the EXISTING Finance import, with duplicate checks on the Payments invoice id/uuid and the ZATCA number — waits for the
oversight's column mapping; E) the simplify list — not in this session's notes, asked for again; and decision (5), the
money model (revenue / cost / profit per company + client ID + account manager, flagged prepaid / postpaid / tender /
promo code). Note for D and (5): the importer stores revenue as the Invoice Total minus wallet, which includes VAT — against
the owner's rule (service fee after discount, before VAT); every VAT figure is 0 today, so no stored number is wrong yet.

## Owner's order of 26 Sep — reset, People & teams, Tasks → Achievements (2026-09-27, Claude Code)

**1 · Reset — done.** Full backup first, outside the database: all 124 tables (12,299 rows) as JSON in the private storage
bucket `golive-backups`, stamp **20260927T070142Z** (`scripts/ops/golive-backup.mjs` + the admin-only function
`golive-backup`); every piece was read back from storage and proved to go back into its table row for row. Three earlier
stamps in the same bucket are incomplete first attempts (a JavaScript round trip changed `123.4500` into `123.45`, and a
9 MB table timed out) — use 20260927T070142Z. Dry run (`golive_reset(false)`): 1,511 rows would go, 10,788 stay, nothing
kept would change. Then the wipe. Kept: 11 logins, levels, the team list (8), 7 departments, 30 KPIs and their 30 targets,
lookups, settings, the 200 discount codes, airlines, suppliers, events, SOPs/SLAs, Direct's own content, the travel-agencies
register, and every old backup table. The live site was walked after it: all 23 pages and 4 Reports tabs, both languages,
no errors. **Not wiped, on purpose — say if they should go:** the old `*_snapshot_*`/`world30_*` backup tables (real
older data, used only for recovery), and 19 empty placeholder files in the expenses/payment-proofs/proposals stores.
**The final go-live reset still needs your go on the day.**

**2 · People & teams — built, not yet live (merges on review; the database change is applied at merge).** One admin page
(DECISIONS D11). Teams in the agreed order (Business → Business Development, Partnership → Partnerships, Business Solutions
and Tenders added); add / rename / retire (open work moves) / bring back; people with first and last names in both
languages, e-mail, role, page levels, home team, teams they assist, reports-to (everyone → Othman), job title; Invite
creates the login and saves the rest. The Team list section on Settings now points to the page.
**Found on the way, fixed in the same change:** every non-admin — the manager included — saw only THEMSELVES in every
people list (Tasks, achievements, KPIs, "Assigned to"), because the roster view reads with the reader's rights and a
non-admin may read only their own login row. The roster is readable by every signed-in person again (D11).
**For you:** names were split into first/last automatically from the full names on file — a compound first name (e.g.
"Abdul Aziz") comes out as first "Abdul", last "Aziz …"; correct any such person on the page. Nobody has a team yet
(everyone's home is still "Commercial") — setting each person's home team is yours or Othman's, on the page.

**3 · Tasks → Achievements — made ready for real use (DECISIONS D12).** Walked page by page as an employee. Fixed: a
finished task now shows on Reports → Achievements at once (it needed a page reload); "count it" ticked on an already-done
task now registers it, and unticking withdraws it; renaming a task renames its achievement while the month is open; a
refused task save keeps the form and what was typed; a task's owner, kind of work and company can be changed after it is
made (so someone leaving can have their open tasks handed on — the database insists on that first); the task list shows
and filters by team; reopening a task whose achievement has proofs says so in words; drafts no longer inflate the report's
totals; the Tasks page's refusals are in Arabic on an Arabic page. **Still missing on screen, next in line:** a project's
own page (projects are listed but cannot be opened), subtasks, helpers and task files, archiving a task, and a per-team
view of the monthly report.

## Bulletproof audit of everything since Phase 1 (2026-09-27, Claude Code) — the Tasks button vanished for every team member

**Asked:** test every step built so far for real — use every feature, assume nothing works until it has been used.
**How:** four layers. (1) the full test run and the database harness; (2) the live database compared object by
object with the harness's copy of it; (3) every write rule of the four Phase 3 releases exercised ON THE LIVE
DATABASE as real people — a team member, the manager, a View colleague — inside blocks that undo themselves
(`scripts/qa/live/phase3-rollback-tests.sql`, 48 checks); (4) the real site in a browser against the live database,
every page and every Reports tab in English and Arabic, writes held back (`scripts/qa/probe-live-walk.mjs`), and
every download (`LIVE=1 probe-real-downloads`).

**Found and fixed:**
- **The Tasks button disappeared from the menu for all seven team members and the manager**, a moment after it
  appeared, and the manager also lost Activity & Audit and Archive. The access layer (js/52) names each menu button by
  its first word — for these three buttons that was the icon (✓, ·), which is on nobody's list, so it hid them. Admins
  skip that list, which is why nobody signed in as an admin could see it. The old Tasks test read the menu once, in
  the second before the button was hidden. js/52 now takes a button's own page name when the layer gives one.
- **In the same pass:** a menu group the access layer found empty was shut and never opened again, and it checked the
  menu the instant a redraw rebuilt it — before Activity and Archive had been put back. Now it checks again 150 ms
  after each redraw and reopens a group it had emptied. New test `probe-the-menu-keeps-its-pages` reads the menu every
  second for ten seconds, for a team member, a team member without Tasks, the manager, and in Arabic; sabotaged, it goes
  red on each fix separately.
- **The database harness let anyone signed in write any company**; the live database only lets someone write a company
  they may work on (`can_write_company`). The harness now carries the live rule; still 116/116.

**Checked and found sound (not assumed):** every one of the 51 functions, the policies and the triggers of the four
releases is identical on the live database and in the harness. On the live database, as real people, all undone
afterwards: a task is numbered, client work without a company is refused, the status change is logged, a checklist step
and an update are added, View sees but cannot change or create, a task cannot be deleted, the manager's change reaches
the owner's Today and the owner can undo it (D7), finishing a task registers its achievement; an achievement is your own
and not a colleague's, a proof goes in on an open month, finalizing stamps who, a View colleague cannot finalize, an
issued month freezes its proofs (row and file) and its lines; the manager sets a KPI target and a team member cannot; the
company card's rules — trimmed, unique, at most three open client IDs, a code on one company only, an unlink that stays,
files only at their own path, an IBAN letter unreadable to a team member and readable to the manager, removal final even
for an admin, files never overwritten. The fingerprint before and after (history, tasks, IDs, files, codes, achievements,
proofs, targets, stored files, locks, number counters, everyone's access) was identical.

**Why the live test was undone rather than kept:** the live Tasks table is still empty, so a real test task would have
taken the number **TSK-2026-001** and the team's first real task would start at 002. Numbers are the company's; the
test does not spend them.

**Of the six tests that went red under a crowded full run and passed alone:** five were the machine being slow (page
loads timing out); the sixth, the Tasks-menu check, was the real defect above.

**For you to know, nothing broken:**
- Your Team-Member test view (a.hassan@) is not on the team list, so from that login the Tasks page says "not on the
  team list yet" and offers no New. That is correct (it is not a person on the team). If you want to try Tasks from
  it, add it to the team list in Team & Access.
- The **Brand** link at the bottom of the menu shows for admins only. The access layer hides anything that is not a
  page in the access grid, and Brand opens a separate page, so it has always been admin-only. Say if the team
  should have it.

---

## Routine fire #265 (2026-09-25 ~08:15 UTC) — the Activity page called a password-reset link a "refused page visit", printed its raw key, and said "merged into" in English on the Arabic page

Read on the live Activity & Audit page against the real log (394 events) and checked against the
database row by row. Three things were wrong, all small, all real:

- **Two events were the wrong kind.** When an admin sends someone a password-reset link from the
  Team page, the database logs it in the same table as a refused page visit. The page counted by
  table, so it said "147 refused page visits hidden" when 145 were refusals and two were reset links
  the QA account sent on 22 August. Those two were hidden behind that badge, and when shown they read
  "Page access · reset_link_sent" — the raw key, in both languages — and named nobody.
- **One field the dictionary did not know.** A company merged into another has its change described
  from the fields that moved; the merge writes a field the page had no word for, so the Arabic row
  read "merged into" in English. Checked against every field the live log has ever recorded: it was
  the only one missing.

Fixed in js/63: a refusal is decided by what happened, not by which table it sits in; the reset row
now reads "Account · Password reset link sent · <address>" / «الحساب · أُرسل رابط إعادة تعيين كلمة
المرور»; the badge and the tiles say 145; and «دُمجت في» is in the dictionary. Measured live after the
fix in both languages, no writes. Guard: `probe-a-reset-link-is-not-a-refusal` (seven synthetic
events fed to the page: three refusals, two reset links, one merge, one creation; EN+AR) — the tree
before the fix turns four of its five checks red. Rule M103 in DECISIONS. Battery after the change: 347 of 347
green (one document-generator probe red under three-at-once load, green alone). Live confirmed on the
second poll; the three live checks pass.

Also read clean this fire: the three tiles agree with the database (394 loaded, 0 today, 55 in the
week and all 55 refusals, last record change 16 days ago); no Undo button on any row (the newest
record change is past the 24-hour window and every row says so); no actor printed as a bare
"unknown"; the Archive page lists the 4 deleted companies (3 merged, 1 removed by owner ruling) with
their keepers named, no restore button on any of them, in both languages.

## Routine fire #264 (2026-09-25 ~06:40 UTC) — the Clients "At risk" button and the page-turner under the table were fighting, and Next quietly dropped the filter

Found by pressing the buttons on the live Clients page against the real 28 clients. Press "At risk"
and the table shows the 6 at-risk accounts and the box above says 6 — right so far. But the line
under the table still read "Showing 1–20 of 28" with Next lit. Press Next and eight rows of every
kind appeared (five New, two At risk, one Watch) while the "At risk" button still glowed and the box
still said 6. Press Prev and all twenty came back, filter gone, button still on. Press "All" and all
28 rows showed at once while the line still read "Showing 1–20 of 28". Two pieces of code were
hiding and showing the same rows: the button by health, the page-turner by position, and whichever
ran last won. Anyone using "At risk" to work a call list could turn the page and phone healthy
accounts without knowing.

Fixed in core-09: the button now takes the non-matching rows OUT of the table (and puts them back on
"All") instead of hiding them in place — the same thing the Bookings, Invoices and Tickets buttons
have done since #105 — so the page-turner sees the list change and recounts. Measured live after the
fix: "At risk" gives 6 rows, "Showing 1–6 of 6", Next greyed out; "All" gives "Showing 1–20 of 28"
and Next turns the page. The Offers buttons went through the same old path and are fixed by the same
change. Guard: `probe-a-chip-and-the-pager-agree` (25 synthetic clients, 12 at risk, page size 10,
so the filtered list itself needs two pages; EN+AR) — the tree before this fix turns all four
checks red. Rule M102 in DECISIONS. Battery after the change: 346 of 346 green (two probes red
only under three-at-once load, green alone, as the runner re-checks). Live confirmed: the site served
the new file on the first poll and the three live checks pass.

*Earlier in this fire: a scout had read the "At risk" button as doing nothing because its count
included the hidden rows. It was the scout that was wrong, not the button — recorded so the next
session does not "fix" a working button; the real defect above was found by reading only what is
on screen and then pressing Next.*

## Routine fire #260 (2026-09-25 ~04:30 UTC) — the six document-generator tests are alive again (316 checks), and the app was clean under them

The tests for the document generator (price offer, service-fee proposal, company profile, contract,
tender, brand) had been switched off since yesterday: they crashed before the app even loaded, for a
one-character reason in how they intercept requests. That left the whole generator unwatched through
a day of changes. They now run again: 316 checks, all green, and one deliberate break (the legal
line taken out of the price-offer footer in a copy) turns the right test red, so they can still catch
something.

Thirteen checks were out of date rather than the app being wrong: they expected the footer as it was
typed by hand months ago, with the company's real registered numbers written into the tests. The
app has drawn that footer from the company registry since 20 September, and those numbers were
removed from the app for the same reason on 21 September — they are now out of the tests as well.
The IATA line's test used a registry key that never existed on the live registry, and the contract
"reset to template" now asks before it acts, so the test answers.

**Also driven this round, live, as every role** (the role answered at the wire, nothing written): a
manager, business development, operations, a team member and a read-only viewer each get the
navigation and the menu their role allows; a page reached by address outside the role lands on
Today with a plain sentence in the page language ("You do not have access to that page — ask an
admin if you need it"); the read-only and operations accounts carry their own banner; no errors.
Clean.

**And a last sweep of the language series, on the real data:** every page and both cards in Arabic,
read for English sentences composed by the app rather than typed by a person. None left in the
app; what remains English is content — event notes, airline rule texts, provider descriptions, SOP
titles and the notes staff typed on cards — which is the content list from 25 September and is
yours to translate when you choose. The read-only banner on the mirror pages shows both languages
on purpose, Arabic first in Arabic.

The full battery over the previous round's tree was green, 339 of 339 with no red at all.

---

## Routine fire #259 (2026-09-25 ~03:00 UTC) — a company's website link and a contact's WhatsApp link now go where they should

Counting the real data showed two shapes the app did not expect. 78 of your 108 live companies have
their website saved as "example.com" without the "https://" in front; the "Website" tag on the row
and the card used that text as the link, so clicking it opened this app's own address with the
domain stuck on the end — never the company's site. And 8 contacts have a phone saved as nine digits
with no leading 0 or "+"; the WhatsApp link was built from those digits alone, without Saudi
Arabia's country code, so it pointed at the wrong number, and the "call" link had nothing a phone
could dial. Both were confirmed on the live app.

Now one piece of code builds every such link: a website without a scheme gets "https://"; a phone
gets "+966" when it is a Saudi number written locally (a leading 0, or nine digits), "00" becomes
"+", and a number already carrying "+" or "966" is kept as it is. The three contact lists, the two
Leads rows, the Reports row and the send-for-review WhatsApp button all use it. Verified on the
live app against the real database: the same company now links to its site and the same contact
to the right WhatsApp number, nothing written. The data itself was not changed — the stored values
are fine as they are, the app just reads them properly now.

Also checked this round and clean on the live data, both languages: every page and both cards
throw no error and make no failed request; at phone width nothing pushes wider than the screen;
every column header is Arabic except acronyms (IATA, NDC, API, ZATCA, EMD), which stay by design.

The full battery over the previous round's tree was green, 338 of 338 with no red at all.

---

## Routine fire #258 (2026-09-25 ~01:30 UTC) — the question before a delete or a reset speaks Arabic

Before the app deletes, archives or resets something it asks "are you sure?" in its own box. Twelve
of those questions were English only: "Delete this invoice?", "Delete this booking?", "Archive this
invoice?", "Delete this tagged backup?", "Reset all data to the seeded version? …", "Import this
file? …" and the rest. On the live app in Arabic, the Settings reset asked its question in English
above a Confirm button — the one place a wrong reading costs the most.

Now every one of them reads Arabic in Arabic and English in English, with the count or the name it
carries kept. Verified on the live app against the real database in both languages, cancelled each
time, nothing written; the test also checks that cancelling really cancels.

This closes the series that began at fire #254: the app's dictionary now owns every kind of word a
person meets — table text, labels, hints, hover words, notices, failure reports, prompts and
questions — each kind counted across the whole app and guarded by its own test, so a new English-
only word of any of those kinds cannot arrive unnoticed.

The full battery over the previous round's tree was green, 337 of 337 with no red at all.

---

## Routine fire #257 (2026-09-25 ~00:40 UTC) — failure reports and the app's own questions speak Arabic, and a failure no longer wears a tick

Two kinds of message were still English in an Arabic session: the reports of what went wrong
("Could not delete: …", "Backup: …", "Export failed: …", "Invalid file: …", "PPTX generation failed:
…") and the questions the app asks in its own box ("Set a passphrase …", "Move to dunning stage?",
"Tag name?", "Copy the offer:"). Twenty sentences, missed earlier because they carry a detail after a
fixed head rather than standing alone. On the live app in Arabic, the idle-lock switch asked its
question in English.

Now they read Arabic in Arabic and English in English, detail included — the backup screen's four
follow-on sentences too, so a report is never half translated. Found and fixed on the way: a backup
failure was shown with a green tick in front of its warning sign, because the message carried its
own sign instead of telling the notice box it was an error; it now shows as a red error. Verified on
the live app against the real database, nothing written.

The full battery over the previous round's tree was green, 336 of 336 with no red at all.

---

## Routine fire #256 (2026-09-24 ~23:40 UTC) — the little notices after a button press speak Arabic

After many actions the app shows a small notice at the bottom for a couple of seconds — "done",
"could not", "please fill this in". A count found 31 of those texts written in English only. On the
live app in Arabic, saving an achievement with no title showed "Please write what was achieved." in
English; the idle-lock switch, the backup destination, "offer created from …", "invoice marked
paid" and the rest were the same.

Now the one place that shows these notices asks the dictionary first, so every one of them reads
Arabic in Arabic and English in English, with the value it carries (a folder name, a client) kept.
Nothing else in the app changed. Verified on the live app against the real database in both
languages, nothing written; and every notice text in the code is checked against the dictionary by
the test, so a new English-only notice cannot slip in unnoticed.

The full battery over the previous round's tree was green, 335 of 335 with no red at all.

---

## Routine fire #255 (2026-09-24 ~22:50 UTC) — the example hints inside the boxes speak Arabic on the editors the form sweep missed

The grey example text inside an empty box (a "hint") is translated by the same dictionary as the
labels, but only for the words it knows. A count of every hint in the app found 50 set in English
with no entry. Read on the live app in Arabic: the airline editor showed 19 of them ("Same-day
before cut-off", "Fare diff + penalty", "Per fare rules; penalty", "BSP / card / credit / wallet"
…), the provider editor 8 ("Role", "Duffel → short-haul EU LCCs" …), the booking editor its source
hint, and the offer editor its passenger example. About half of the 50 are codes, brand names,
percentages and dates that read the same in both languages and are left exactly as they are.

The 30 real words are now in the dictionary, so they read Arabic in Arabic and English in English on
every redraw, with nothing new built. Verified on the live app against the real database, nothing
written. The onboarding form and team dialog were checked too and show only codes.

The full battery over the previous round's tree was green, 334 of 334 with no red at all.

---

## Routine fire #254 (2026-09-24 ~22:00 UTC) — the words on hover and for screen readers speak Arabic too

The app translates what you can see, but not the small words that appear when you hover over
something or that a screen reader speaks aloud. Read on the live app in Arabic: every row of the
Leads table said "Open the lead to change stage" and "Lead score 25/100" in English on hover, 82
fields were announced as "Input", the little eye on the password box said "Show password" — and
kept saying it even while the password was showing — and the menu button said "Open menu". Twenty-
five such words across the app.

Now they follow the language like everything else: the same dictionary that translates the field
hints has a section for hover and screen-reader words, it is applied on every redraw, and a word
another part of the app rewrites afterwards (the menu button gets its English label re-stamped a
moment after each redraw) is translated again. The password eye now says what it will do in the
page language and tells a screen reader whether the password is showing. Switching back to English
restores every one of them exactly. Verified on the live app against the real database, in both
languages, nothing written.

The full battery over the previous round's tree was green, 333 of 333 with no red at all.

---

## Routine fire #253 (2026-09-24 ~21:00 UTC) — a view-only share link now survives a slow connection and a refresh

The shared-view test had gone red three times in three days whenever the machine was busy, and
green every time it ran alone. That pattern is a race, and the app's own routing notes already
described it for another kind of link: about a fifth of a second into loading, the address bar is
rewritten to a plain address like /leads. Anything that loads after that moment and reads the
address bar reads the wrong thing. Two parts of the share-link feature did exactly that. On a slow
connection — a phone, which is where a shared link is opened — one of them stops making the page
a guest view at all (the visitor gets the sign-in form), and the other stops tidying it (Finance
back in the sidebar, a colleague's name in the footer, the banner over the top bar). And because
the token was wiped from the address bar, **refreshing a working share link landed on the sign-in
form** even on a fast connection.

Now the address of a shared view is never rewritten, so the token stays and a refresh works, and
both parts read the address the page actually opened with. Proven by forcing the slow order on
purpose rather than waiting for a busy machine, in English and Arabic, with a refresh, and with a
check that a signed-in colleague's addresses still update as before. On the live app against the
real database a share address now holds even when the part that decides "this is a share view" is
delayed, and nothing was written.

The full battery over the previous round's tree was green, 332 of 332 with no red at all.

---

