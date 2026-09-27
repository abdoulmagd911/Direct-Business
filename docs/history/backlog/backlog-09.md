## Routine fire #146 (2026-09-21 ~02:00 UTC) — a chip on the Clients page just said "—: 28"

Asked fire #145's question of the other pages: **does every number on screen describe the records
that page actually lists?**

**Leads: yes.** "All 78" against 78 rows listed, with 80 leads in the data — the missing two are the
Lost ones, excluded by the documented Hide-closed rule (2026-09-09). The chip, the rows and the rule
agree. Recorded so it is not re-investigated.

**Clients: one chip was meaningless.** The page groups clients by city and fell back to the **em
dash** when a client has none. No client in the live data has a city recorded, so the whole strip
rendered exactly one tag:

> **—: 28**

That tells a person nothing and reads like a broken label rather than a fact. `area` is a **real
writable field** — the lead form's "Area (city)" dropdown — so the breakdown is worth keeping; the
unknown bucket simply had to say what it means. It now reads **"No city recorded: 28"** /
«**بلا مدينة مسجّلة: 28**». Driven live before and after.

**Guard:** `probe-a-chip-says-what-it-counts` (9101, **6 checks**, both languages), including the
quiet one — *the buckets must add up to the number of clients* — because the cheap way to pass the
rest is to relabel the dash and stop thinking. Sabotage-verified against a copy with the dash
restored: two checks fail and print the dash they found.

**Worth knowing, and it is really a data point for you:** none of your 28 clients has a city
recorded. The field exists on the lead form; nothing has filled it. The chip now says that plainly
instead of hiding it behind a dash.

3 gates green. Commit 1b13009, confirmed live.

---

## Routine fire #145 (2026-09-21 ~00:30 UTC) — the Leads page warned about 20 leads that were all clients

The warning strip at the top of **Leads** read:

> ⚠️ **20 worked leads with no owner** · 25 with no movement for 14+ days

Measured against the real database: **all twenty of the first number were CLIENTS.** Not one of them
appeared in the 78-row list underneath it. Somebody acting on that line had nothing to click and no
way to find out why.

`attention()` skipped vendors and never skipped clients, while the strip renders **only** on the
Leads page and speaks of "worked **leads**". It is the same shape as the stage chips that counted
one population and filtered another (found and fixed 2026-08-09): **a count that names a population
the page does not show.** It counts leads now.

**The other half was right and stays right.** 25 leads whose newest activity is older than 14 days —
which matches the database exactly: every one of the 25 in-play leads has an activity row, and every
one is past the line. Re-driven after the change, the strip reads *"25 with no movement for 14+
days"* and the companies it names are in the list below it.

**Guard:** `probe-the-leads-strip-counts-leads` (9100, **7 checks**, both languages), including the
one that would have caught the original on its own — *every company the strip names must be one the
page actually lists*. Sabotage-verified against a copy with the client guard removed: **four checks
fail** and the report shows the client's name back in the strip.

**A worthwhile detail about how the stale half works**, since it looked broken at first glance and
is not: a lead with no contact date can never be "stale", because the rule is `if(last && last <
cut)`. That is deliberate — it stops the strip nagging about leads created yesterday. **Not one of
the 27 worked leads has a `lastContact` value at all**; their "last touched" comes entirely from the
`activities` table, merged onto the record by js/72 as a millisecond timestamp, which is exactly
what the rule compares. Checked before concluding anything.

### Recorded, not invented — for the owner

**20 of your clients have no owner recorded**, and there is no clients-side equivalent of this
strip. That is a real thing worth knowing; it was simply being said on the wrong page, about the
wrong kind of record. It is written here rather than answered by mislabelling it on Leads. Say the
word if you want the same warning built for Clients.

**An instrument fault, caught:** `probe-lifecycle5` went red while I was checking this fix and it
was **not** the fix — `EADDRINUSE` on port 8913, because the background battery held that port. Run
alone, 67/67 pass. Running probes by hand alongside a battery is my own trap, not a defect.

3 gates green. Commit 308cd75, confirmed live (first check read a stale CDN copy again).

---

## Routine fire #144 (2026-09-20 ~23:30 UTC) — "show me only my leads" works, and CLAUDE.md said it couldn't

CLAUDE.md's "Known structural issues" said ownership is free text **"so 'show me only my leads'
can't be built until that's fixed."** That is out of date, and stale guidance in the file every
session reads first is worth more than most defects. **Measured, then corrected in place.**

**The data first.** All 7 ownership values in the live companies match an **active account's full
name exactly** — checked row by row, not sampled. 20 of the 108 records carry no owner at all, and
every one of those is a client.

**Then the app**, driven against the real database by answering only *"what is this person called"*
differently — no writes:

| told the account is… | Leads → Mine shows |
|---|---|
| the person who owns the most | **70** — exactly their lead count (their 71st record is a client, and the Leads list shows leads only) |
| the QA account, which owns nothing | **none**, and it says so: *"No results with the current filters — 108 record(s) hidden. Show all"* |

**It is also sturdier than a string match, which matters before anyone "fixes" it.** `ownerCanon` /
`sameOwner` (js/43) map a person's full name, Arabic name, nickname, e-mail prefix and — when it is
unique in the team — their first name onto one canonical identity, so a record assigned to any of
those still counts as theirs. `probe-crm-attacks` already guards that, which is why this round added
no probe: the behaviour was covered, only the documentation was wrong.

**What is still fragile, and is now written down:** a spelling that is none of those. Assignments
made in the app come from a dropdown fed by the real roster, so drift cannot start there — but an
**import** writing an unfamiliar variant would silently drop that record out of its owner's "Mine"
with nothing on screen to say so.

**An instrument fault of mine, caught before it was written up:** the first run reported "Mine shows
1 lead" for an account that owns nothing. That row was the **empty-state row** — the app was
behaving correctly and saying so honestly; my driver was counting `<tr>` elements. And my first
draft of the CLAUDE.md correction claimed Mine "works because the strings happen to agree", which
was too pessimistic — I found `ownerCanon` afterwards and rewrote it rather than ship a note that
would mislead the next session in the opposite direction.

3 gates green. CLAUDE.md corrected in place; no code changed.

---

## Routine fire #143 (2026-09-20 ~22:30 UTC) — the money reaches the right company, checked

A short verification round on the layer everything in Finance rests on, and it is **clean**:

- **18 invoice groups, all 18 linked to a company.** Nothing is unattributed — `0.00 SAR` of revenue
  sits in a group with no client behind it.
- **26 links, none broken:** no link points at a company that no longer exists, none has an empty
  company, and none points at a company that is not marked a client.
- **3 companies are reached by more than one group** — which matches the three client-name alias
  groups the owner set himself. Aliasing working, not duplication.
- **28 clients; 15 have at least one invoice**, the rest have none yet, which is what a new client
  looks like.

Recorded so the next session does not re-derive it. Nothing changed.

---

## Routine fire #142 (2026-09-20 ~22:00 UTC) — two client records share one person, and nothing in the app said so

Checked rule **M18 — one company, one record** against today's data. No two live companies share a
name or a website domain. But **one e-mail and one phone each appear on two companies, and it is
the same two companies**:

- both are **clients**, both stage **won**;
- one arrived from the **corporate client list import**, the other from **Inbound**;
- three contact rows between them, sharing a person's e-mail *and* phone;
- they map to **two different finance client groups**, so their money is counted apart;
- **no merge recorded, nothing flagged**, and no screen in the app said a word.

**Why the app was silent, which is the actual defect.** js/13's duplicate check is a good one — it
compares contact e-mails as well as names. It never ran on this pair for two structural reasons:
it only fires **after an in-app save**, and neither record was ever typed into the app; and it
speaks in a **toast**, gone a moment later and findable by nobody afterwards. Both are fine for
somebody typing a new lead, and useless for how records actually arrive here — **by import**.

**js/85 adds the missing half, and only that half:** a quiet, persistent line on the company's own
card — *"The same person is on another company"* — naming the other company and the detail that
matched, so the claim is checkable rather than asserted. It **never merges, writes or changes
anything**: deciding two records are one company is the owner's call, and a wrong merge is
expensive to undo. Driven against the real database: **exactly 2 of 108 companies flagged**, one
line each, inside the Contacts card, both languages, zero writes, no JS errors.

**Guard:** `probe-one-company-or-two` (9099, **9 checks**) — including the one that matters most
over time: *a company that shares nobody is NOT flagged*, because the cheap way to pass every other
check is to flag everything, and a warning on every card is a warning on none. Sabotage-verified
twice against a copy: removing the phone comparison fails the phone check; removing the skip-myself
guard fails the not-flagged check.

**Two instrument faults of mine, both written into the probe so they are not repeated:**
1. My first duplicate-name query had a **six-character floor**, so it skipped exactly this pair —
   their names are short. The contact-based check is what found them.
2. The probe's first version picked *the first six companies by position* and got L0, L9, L18, L27,
   L36, L45 — **the app's id is the legacy_id and its list is not in seed order** — so half the
   fixture was never looked at and the pair's other half counted as unflagged. Same family as the
   #120 lesson. It now picks companies by the contact seeded on them.

### For the owner — one question

Those two client records may be one company entered twice, or two real companies in a group sharing
one contact. **I have not merged anything.** If they are one company, their invoices are currently
counted as two separate clients; if they are two, the new line is simply a note you can ignore. The
app has an alias mechanism you have already used three times for exactly this.

3 gates green. Commit f34805c, confirmed live (js/85 served and loaded by index.html).

---

## Routine fire #141 (2026-09-20 ~21:00 UTC) — the audit log handed out money to people who cannot open Finance

**Fixed on the live database, proved in both directions.** `record_history` — the audit log behind
Activity & Audit and the undo button — had a read policy of `using (true)`. Any signed-in account
could read every entry, and **137 of them carry a full row snapshot** of a finance record in
`before_row`/`after_row`. The app has a page-access model precisely so somebody can be given Leads
without Finance; the audit screen walked straight around it.

Money rows now require `can_see_page('finance')` — the same function the app's own gate uses.
Non-money rows are untouched.

**Proved, not assumed.** The QA account (`test@directksa.com`, created for QA on 2026-08-08, not a
staff login) was moved onto a finance-less team_member map and restored exactly afterwards:

| | with Finance | without Finance |
|---|---|---|
| `can_see_page('finance')` | true | false |
| money rows readable | **2** | **0** |
| the rest of the audit log | readable | **still readable** |

Then the Activity & Audit screen itself was driven in both languages: **353 events, bilingual, no
JS errors**. It changes nothing for anyone today — all eleven live accounts carry finance access —
which is exactly why it was safe to do now rather than after the first hire who should not see money.

### Checked in the same pass and found already sound — recorded so nobody re-opens it

- **`undo_change()` cannot be pointed at a table of your choosing.** It is SECURITY DEFINER and
  builds its SQL from the `table_name` and `before_row` it reads out of `record_history`, so a
  craftable audit entry would be an arbitrary write into any table. **Measured:** a crafted insert
  from a signed-in session is **refused by RLS**, 0 rows written.
- **The function's own gates are right:** signed-in with an active account (with an explicit note in
  its source about the null-role trap that used to let a caller with no account through), a 24-hour
  window, never an "undo" of a create, money restricted to admin/manager, a full restore admin-only,
  and generated columns excluded so the database recomputes them.
- **The log saying "unknown" for most entries is honest, not broken.** 56 invoice creations, 38
  deletions and 39 transaction edits carry no actor — they were service-role imports and clean-ups
  from 22–25 August, where nobody was signed in. The 27 entries made by a person in the app do carry
  their name.
- **No undo buttons appear on today's screen** — every entry is older than the 24-hour window. That
  is the rule working, not a missing feature.

**An instrument fault of mine, caught before it was written up:** my first before/after check read
`before_row` from an unordered `limit(1)`, and many finance entries are *create* rows where
`before_row` is legitimately null — so the "after" reading was luck, not the policy. Re-measured by
asking the database directly what it thought of the signed-in account.

Recorded as **DECISIONS M25**. 3 gates green. No app code changed — one policy, reversible with one
statement.

---

## Routine fire #140 (2026-09-20 ~20:00 UTC) — a supplier's analyst had their personal mobile in a public repository

Audited what this repository actually contains against **standing rule 7** — the rule this session
has leaned on all day without once verifying it.

**Most of it is clean, and that is worth stating:** every IBAN in the tree is synthetic
(`SA0000…`, `SA9999…`), every VAT number is a test value, and the Saudi company e-mail addresses
that *look* real — `admin@alyusrclinics.sa`, `gm@nadeemtravel.sa` and the rest — are all inside
`mock-seed.mjs` / `mock-seed-live.mjs` / `probe-lifecycle5.mjs`, which is exactly where CLAUDE.md
requires QA fixtures to live. Checked each one's file before concluding anything.

**One thing was not clean.** `js/core/core-09-v26.js` carried, as Gulf Air's escalation contact, a
**named analyst with their job title and personal mobile number**, and `core-10` repeated the number
in its ADM-risk line. A real person's direct line, in a **public** repository, and not the owner's
to publish — the same class as the customer PII found here on 2026-08-27.

**What made it findable is that it was the only one.** Every other escalation contact in that file
is a corporate desk or mailbox — Saudia RUH Sales, flynas, the KU-RUH desk, Turkish Riyadh
marketing. Both entries now escalate through **the airline's own Riyadh sales mailbox**, which was
already sitting beside the mobile, so nothing operational is lost.

**Gated, because that small honest set makes it affordable:** check-structure now requires every
Saudi number in `js/` to be judged in `scripts/qa/phone-numbers-judged.txt` with what it is — read
both ways like the other judged lists — with the obvious placeholders (`+9665000000NN`,
`05000000NN`) exempt without being listed. Three entries survive: the company's own published
number, **Amadeus Saudi's agency-support desk** and an example in help text. Sabotage-verified both
directions: a personal mobile added back to a layer fails and names the file; a judged number that
has left the code fails too. Recorded as **DECISIONS M24**.

### ⚠ One thing I did not do, because it is yours to decide

**Removing the number from the code does not remove it from git history** — it still sits in one
earlier commit, and this repository is public. Rewriting history is not something to do unasked:
it is irreversible and it breaks every other session's clone. Say the word if you want it done, and
whether to tell Gulf Air. The 2026-08-22 clean-up of the real-data branch is the precedent.

Also worth your eye while we are here: the client-facing one-pager names **seven real client
organisations** in a hardcoded list (`core-10`). If those are reference clients you already publish,
it is fine; if not, they are real client data in a public repo. Left alone pending your word,
because deleting them would gut a legitimate marketing document.

3 gates green. Commit 67409d3, confirmed live — the served files no longer contain the number.

---

## Routine fire #139 (2026-09-20 ~18:00 UTC) — a tender document claimed a certification the registry says lapsed

**The app contradicted itself, and the version a client reads was the wrong one.**

The Generator's **Renewals radar** — driven live — correctly lists four of the company's credentials
as **EXPIRED**: ISO 9001:2015 (2025-02-14), DUNS (2025-09-10), Saudization certificate (2026-01-06)
and **PCI DSS (2026-07-14)**. It names them, dates them, counts days left for the ones still valid,
and honestly says "date not on file" for two others. That screen is excellent.

Meanwhile `core-10`'s one-pager — the document **sent to clients and attached to tenders** —
printed a **hard-coded** badge list still advertising **"PCI-DSS"**, and a hard-coded line reading
**"Compliance: PCI-DSS · Bank Guarantee 750K SAR · DUNS registered"**. And the registry does not
merely record an expiry: every one of those rows carries the owner's own **`show_on_documents =
false`**. A hard-coded list was overriding an explicit instruction in the database, on a tender.

**Fixed.** Every credential named on that document is now checked against the registry and dropped
if the registry says it has expired **or** must not appear on documents. Driven live before and
after: the document a client reads now carries neither claim.

Three deliberate choices, each recorded because they will look like omissions later:

1. **The person generating it is told.** A box the print stylesheet hides lists what was left off
   and why — "PCI-DSS — expired 2026-07-14" — and says to update the registry and print again if it
   has been renewed. The client never sees it. Silently obeying a registry row that is merely out of
   date would trade one wrong document for another.
2. **Nothing is ever ADDED to the document from the registry.** Leaving a true claim off is a small
   loss; putting a false one on a tender is not.
3. **Bilingual.** An English-only notice above an Arabic document is fire #125's defect again, so
   the box speaks the page's language.

If the registry has not loaded, **nothing is filtered on a guess** and the box says the list could
not be checked — the same refusal to pretend `v21AgencyHeader` has made since round 41.

**check-structure caught my own first attempt** taking today's date from UTC — exactly the
comparison that flips in Riyadh between midnight and 3am, and "expired" is the worst place for it.
With no way to know the date, it now reports "not loaded" rather than filtering on a wrong one.

**Guard:** `probe-a-document-obeys-the-registry` (9098, **9 checks**, both languages), including
that a credential the registry does *not* object to is still printed — the fix must not quietly
strip real accreditations. Sabotage-verified against a copy with the filter disabled: **five checks
fail and quote the document claiming PCI-DSS and DUNS back**.

### For the owner — two things

- **Four credentials are recorded as expired**, the oldest since February 2025. If any has been
  renewed, updating it in **Generator → Company assets & registry** puts it back on your documents
  automatically. If they really have lapsed, they are now correctly off them.
- **A judgement call I did not make for you:** the at-a-glance table still prints the **DUNS number**
  as an identifier. Dropping identifier rows on the same flag would also drop the **VAT and Zakat
  numbers**, which a tender needs — so that one is yours to decide, not a silent change.

3 gates green. Commit d9f89cb, confirmed live (the first check read a stale CDN copy; cache-busted
it is there).

---

## Routine fire #138 (2026-09-20 ~17:00 UTC) — how long the team actually waits, measured

Every driver written this session sleeps 20–24 seconds after sign-in before reading anything, and
nobody had ever checked whether that was the app or the driver being careful. **It was the driver.**

Measured against the real database, fresh browser, nothing cached, twice:

| | |
|---|---|
| page markup ready | **~0.5 s** |
| sign-in box on screen | **~0.5 s** |
| companies on screen after pressing Sign in | **~0.1 s** |
| Finance numbers on the Finance page | **1.7 s** |
| everything loaded | ~27 calls, **0.71 MB** |

The app is fast. The "30 seconds" an earlier run of the timing driver reported was itself an
instrument fault: that run landed on **Today**, where the finance rows fill in later because nobody
is looking at them. Opening **Finance** — which is what a person does when they want the numbers —
has them in 1.7 seconds. Recorded so the next session does not "fix" a slowness that is not there,
and so nobody copies the 20-second sleeps out of this session's drivers.

**One real observation from the call list, recorded not fixed.** In the first three seconds after
sign-in the app asks the database for the same thing twice about ten times over: `team_directory`
(at 567 ms and 669 ms), `finance_invoices` (725 / 1401), `finance_client_links` (1016 / 1701),
`client_profiles` (1194 / 1860), `finance_targets` (1194 / 1861), `my_page_access` (1679 / 1879),
`promo_codes` (1406 / 2014), `app_users` (1401 / 2853) and `app_settings` **three times** (182 /
1068 / 2005). Nothing is wrong on screen and it costs about a second of a fast connection — but
this project's history is largely two layers quietly doing the same job, and a doubled
`finance_invoices` load is the shape that produces a stale tab. Measured and written down so the
next person starts from evidence rather than suspicion; not touched, because nothing is broken
today and unpicking which layer should own each read is a change with real risk.

Also noted: `app_state` is a **472 KB single row** — 66% of everything downloaded at sign-in. That
is the known structural issue (one JSON row holding bookings, invoices, offers, requests, projects
and settings), not a new finding.

3 gates green. No change — a measurement round.

---

## Routine fire #137 (2026-09-20 ~16:00 UTC) — the search that found four open doors, turned into one command

Fires #131, #133, #134 and #136 each found a door standing open to somebody who had **not signed
in** — two backup tables with row-level security off, the two storage buckets holding documents for
real money, an unauthenticated service-role write path, and a 1 MB sign-in-capable copy of the app
served out of Storage. Every one was found **by hand, with curl, one at a time**. And **250 green
probes said nothing about any of them**, because every probe in the battery drives the app against
a mock and cannot see the live project's own settings.

**`scripts/qa/check-public-surface.mjs`** is that search as one command. It reads the publishable
key **out of the app's own page** — no secret of any kind, which is exactly an outsider's position —
then asks, as a caller with no sign-in:

- every one of the **95 tables** the public schema holds → each must return nothing (**it does: 0 of
  95 answer**);
- the three money-document buckets (`payment-proofs`, `expenses`, `company-docs`) → none may list;
- the `app` function → it must redirect, never serve a copy of the application again (#136).

**Doors that are open by decision are judged in writing** in `scripts/qa/public-surface-judged.txt`,
gated both ways like `reports.txt`: an unjudged open door fails, and a judged one that has since
closed fails too. Two entries today — manual-confirm's `/data` (the owner's call, #134) and the
`proposals` bucket (its address is stored in the offer record, #133).

**Proven able to fail, not assumed.** A check that has never been seen to fail is not a check, so a
throwaway table with row-level security off was created and dropped the same minute: it made the
check **exit 1 and name the table**. A deliberately stale judged entry fails it too.

**Its blind spot is written inside it**, because a check that hides what it cannot see is worse than
none: the API refuses to list its own tables to that key (401 — itself correct), so the table list
is a **snapshot**, and a table created later is not covered. `get_advisors(security)` is the check
for that. The two together cover what neither does alone — that is recorded as **DECISIONS M23**.

It is in `battery-excluded.txt` **on purpose**, with the reason written there: it touches production
and needs network, so it is run by hand during a sweep, not 250-at-a-time.

3 gates green (41 ACTIVE rules, 143 citations), and the new check green.

---

## Routine fire #136 (2026-09-20 ~15:00 UTC) — an old copy of the app was still live, and it could overwrite everyone's work

**Fixed.** The `app` edge function was still serving `site/app.html` out of Storage: a **working,
sign-in-capable copy of the app, 1,042,705 bytes**, reachable by anyone with no login. CLAUDE.md has
called that Storage path dead since 2026-08-08 — but the door was open, and what was behind it was
not merely stale, it was **dangerous**.

Measured before changing anything. That copy carries **none** of the current layers — no `v44a`
(the single shared Supabase client, the fix for five clients fighting over token refresh and
silently signing people out), no `v45`, no finance money gate, no promo codes — and, decisively:

> it calls **`save_state`** and never `save_state_patch`.

`save_state` writes the **whole shared workspace blob**. So any colleague who still had that address
bookmarked could sign in, change one thing, and **overwrite everything every other person had
changed since** — the exact bug v45 exists to prevent, from a page nobody thought was still
running. That is not exposure; it is a live path to destroying real work.

It is now a **302 to the real app**, which asks for the team login — kept redirecting rather than
deleted, so an old bookmark still lands somewhere useful, the same thing `ksa-events-hub` already
does for the retired events page. Verified: the old address returns 302 → the current app (76,495
bytes, the split `/js/` build), and `directksab2b.com` itself is untouched.

**The deployed source is now in this repo** at `supabase/functions/app/index.ts`, with a README
explaining why. Edge functions deploy straight to the project, so a change to one is invisible to
anyone reading the repo — and an invisible change that later behaves oddly is the exact pattern
that cost this project months. From now on: change a function, commit its source in the same commit.

### The rest of the edge-function sweep — all seven, judged

- **`admin-users`** — the only one that requires a token (`verify_jwt = true`). Correct.
- **`ksa-events-hub`** — a clean 302 to the in-app Events tab. Correct.
- **`hi`** — a three-line "hello html" test page. Harmless; already on the backlog to delete.
- **`gs`** — the owner's personal habit tracker. Touches only its own `gs_*` tables, **none of this
  app's**, and those tables no longer exist, so it cannot write anything at all.
- **`gstest`** — holds the **service-role key** and writes one fixed file into the `app` storage
  bucket on **every unauthenticated request**. The blast radius is that single placeholder file, so
  it is small — but it is precisely the shape DECISIONS M22 warns about, and it is already on the
  backlog to delete. Deliberately not called during this sweep, because calling it *is* the write.
- **`manual-confirm`** — handled in #134; its write path is bounded by a database trigger.
- **The five one-shot deploy/import scripts CLAUDE.md warns about** — `promote-v41`,
  `promote-v42-finance`, `patch-v42-attention-fix`, `verify-v42`, `v30-import-businesses` — **are
  no longer deployed.** That warning can be read as history. Seven functions remain, all judged
  above.

3 gates green.

---

## Routine fire #135 (2026-09-20 ~13:00 UTC) — what each role actually sees, measured against the real maps

The mandate says "every role", and this session could not sign in as anybody but the QA admin —
`scripts/qa/emp-rig.mjs` needs the staff's real passwords, which are not in this repository and
never will be. So the roles were driven a different way: **hold the real database for everything
else, and answer only the access questions the way the database would for each real account.**

**What the database actually holds** (the source of truth, no passwords needed): page access is a
per-user JSON map on `app_users`, and `page_access(p)` short-circuits to `editor` for an admin.
- **3 admins** — no map at all, so editor everywhere. By design.
- **1 manager** — 10 pages: today, leads, clients, offers, finance, events, airlines, activity,
  archive, settings.
- **7 team members** — exactly **4** pages: today, leads, clients, **finance**.
- **Every single entry is `editor`. Nobody, anywhere, is a viewer.** (js/16 already said "verified
  0 non-editors"; still true.)

**Driven, and the gate is honest.** Admin opens everything. The manager is **refused** Reports and
Operations. A **team member is refused** Settings, Events, Airlines, Reports and Operations — so no
team member can open Team & Access. A viewer-level map loses money completely: `finMaySeeMoney()`
false, `canFinEdit()` false, no revenue or profit total anywhere on the Finance page, and a
read-only banner saying nothing they do is saved. Already guarded by `probe-access-truth` since
round 30; this confirms it still holds on today's real maps.

**A design choice worth recording rather than "fixing":** the sidebar offers all 18 entries to
everyone and refuses on open, instead of hiding what you cannot use. That is the more honest of the
two — a page that silently vanishes is how the Finance ledger sat "live but unreachable" for two
days — so it is left alone.

**For the owner, plainly:** all 7 team members have **finance = editor**. That means seven people
can see every number and can delete an invoice. It is recoverable (deletes are soft, and
`finance_invoices` carries a history trigger), and it is your configuration rather than a defect —
but it is worth knowing it is seven, not one.

### Two instrument faults of mine, caught before either was written up

1. The first run rewrote only the `app_role()` RPC — and **the app does not read its role from
   there**; it reads it from a `SELECT` on `app_users`. Every role came back "admin". Had that been
   reported it would have read as "every role sees everything".
2. The second run fixed that, and still showed all 18 pages and `canFinEdit = true` for a viewer —
   because the page gate is **per user**, through `my_page_access` / `page_access` /
   `can_see_page` / `can_edit_page`, which were still answering for the real admin account. Only
   after those four answered from each role's real map did the true picture appear.

Same family as #124's Escape measurement and #122's truncated payload: the tool was wrong, not the
app. Both are in the loop log so the next session does not repeat them.

3 gates green. No code change — a verification round.

---

## Routine fire #134 (2026-09-20 ~12:00 UTC) — anyone could have overwritten any company or contact, with no sign-in

**The most serious finding of this sweep, and the destroying half is now closed.**

The `manual-confirm` edge function runs with `verify_jwt = false` — no sign-in of any kind, which
is deliberate; it is a page the owner opens in a browser — **and it holds the service-role key,
which bypasses every access rule in the database.** Its `/save` endpoint PATCHed `businesses` or
`contacts` **by id** with whatever fields the caller sent, so it was never limited to the records
the page exists to fix.

**Measured, with no key at all** (not reasoned from the code): the page answered (9,364 bytes),
`/counts` answered, `/data` returned **3 real records including two contacts with a real e-mail and
phone**, and a POST to `/save` returned **HTTP 200**. It changed nothing only because the test
deliberately aimed at an id that matches no row — verified straight afterwards that no row carried
the marker and the flags were untouched. With a real id, **which `/data` itself hands out**, any
column of any of the 112 companies or 45 contacts could have been overwritten.

A 2026-08 note in §12 of this file already said "runs with no login and can edit any lead or
contact — fine while it is unknown". That is security by obscurity, and **the project reference is
printed inside the app's own public page**, so the address is not really unknown.

**What was done — and why it is a trigger, not a policy.** No RLS policy can stop this: the service
role bypasses policies. A trigger does not. `trg_guard_manual_confirm` on `businesses` and
`contacts` now refuses any update that stamps `confirmed_by`/`confirmed_at` on a row that is **not
still flagged** for manual confirmation. That is exactly this function's fingerprint: it always
stamps both, and it is the **only** writer of those two columns on these two tables — verified by
reading every writer in `js/` (the app sets them on `finance_client_links` only, in js/31 and
js/41) and by checking that not one row in either table carries a value in them today.

**Verified both ways, inside a block that always aborts so nothing could be written either way:**
an unflagged row is **blocked** with a plain message naming the table and id; a flagged row is
**allowed**, so the page still does its job; and an ordinary company edit and an ordinary contact
edit — the exact updates the app sends — are both **ALLOWED**, untouched.

### ⚠ One decision for Abdulrahman — the reading half is still open

I closed what could destroy data. I did **not** close what can be read: `/data` still hands three
real records, two of them with an e-mail and phone, to anyone who opens that address with no login.
Closing that means either deleting the function or redeploying it behind a sign-in, and **I did not
do it blind**: redeploying means reproducing 9 KB of that page's HTML exactly, and if I mistyped it
the page would break — and my rollback would carry the same risk.

**The trade-off you need to know:** the app **shows** a "⚠ needs confirmation" badge on a flagged
contact but has **no way to clear it**. That page is the only thing that can. There are 3 flagged
records left (1 company, 2 contacts).

**Recommended: delete `manual-confirm`.** Its whole job is those 3 records, and once they are
reviewed the flag can be cleared directly — say the word and I will do that part. If you would
rather keep the page, the alternative is a redeploy behind a sign-in, which I can prepare with the
source in the repository so the change is reviewable instead of invisible.

3 gates green. No app code changed; the change is on the database and reverses by dropping one
trigger.

---

