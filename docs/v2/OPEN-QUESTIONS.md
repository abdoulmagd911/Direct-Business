# v2 — open questions

What the blueprint leaves unclear, in plain words. Each has **one recommended answer**; the spec (`TECH-SPEC.md`)
already assumes it, so building can go on until the owner says otherwise. Answering "yes" to a recommendation is
enough. When one is answered, the answer is written where the fact lives (the spec, or `docs/v2/DECISIONS.md`) and the
question is deleted here.

**Answered by the owner on 28 Sep** (through the oversight) and now in the spec: sign-in doors — Google for
`@directksa.com`, Zoom for `@directksa.net`, an emailed code as fallback, one person per several emails (spec §4);
appraisal templates seeded from the online tool, which wins over the Excel form (spec §3.10); "Commercial total
revenue" does not block anything — its definition is a setting decided at go-live (spec §3.6); go-live = code and
structure proven, then the team types the 2026 invoices, imports later (spec §7, plan P4 and P7); environments listed
with their cost (spec §10).

The first four below are needed before building can start on the cloud; the rest can be answered along the way.

## A. Needed before building starts

**Q1 — Room for the new database.** The free Supabase plan allows two active free projects per owner, counted across
all the owner's organisations; the owner already runs two (the old app and the old performance tool). Paused projects
do not count. Measured read-only on 28 Sep; nothing was changed. Two ways:
- **Free:** pause the old performance database (`directksa-performance`) — **after** we take a full read-only copy of
  it, which is needed anyway to seed the appraisal templates and load past appraisals. Pausing is reversible, but the
  old appraisal tool stops working while paused.
- **About 25 USD a month:** a separate paid organisation holding only the new project (which also brings daily
  backups — Q2), and nothing else changes.

*Recommended:* the free way if nobody needs the old appraisal tool online from now on; otherwise the paid
organisation. *Blocks:* P3-2 (the cloud project).

**Q2 — Backups for real data.** The free plan keeps no backups. *Recommended:* the paid plan (daily backups, no pausing
after a quiet week, 8 GB instead of 500 MB) **at go-live, not before** — until then only trial values are in it.
*Blocks:* P6-8 (go-live).

**Q3 — The two sign-in keys.** "Continue with Google" needs an OAuth client made by whoever manages Direct's Google
Workspace (type *Internal*); "Continue with Zoom" needs an OAuth app made by whoever manages Direct's Zoom account
(not published, so only Direct's Zoom users can use it). Both are free; the exact clicks are in the spec §4. The
client IDs and secrets are handed over privately, never in the repository. *Blocks:* signing in on the cloud project
(building continues in CI meanwhile).

**Q4 — The sender for emailed codes.** Supabase's own sender only reaches the Supabase account's team and is not for
production. *Recommended:* **Resend**, free tier (3,000 mails a month), sending from a sub-domain such as
`auth.directksa.com` — it needs three or four DNS records added by whoever manages the domain. Alternatives and their
costs are in the spec §4. Until it exists, Google and Zoom are the only doors. *Blocks:* nothing now.

## B. Money and matching

**Q5 — The words for money.** The old app calls the invoice total (less wallet top-ups) "Revenue" (D21). The
department's reports call that figure GMV and use "revenue" for the margin. *Recommended:* screens say **Sales (GMV)**
for that figure and **Margin** for it minus approved cost. No money rule changes, only the words. (What counts as
"Commercial revenue" is already settled: a setting, decided at go-live.)

**Q6 — Who may edit a company.** The owner ruled in D7 "helpers, not locks": everyone keeps full control of companies,
every change logged, the account manager told and able to undo. *Recommended:* keep that for details, contacts, notes
and files; but changing a company's **identifiers**, **merging** companies and **changing the account manager** move
money between people, so they need a manager (or admin). The access grid (spec §8) is drawn that way.

**Q7 — Whose credit when the account manager changes** (08 C3). *Recommended:* credit goes to the company's account
manager, as designed, and the invoice's paid date decides: invoices paid
before the effective date stay with the old manager, invoices paid on or after it go to the new one. A manager can
still split or reassign one invoice with a note.

**Q8 — A discount code's dates.** A code belongs to a company "within its dates". An invoice has a creation date and a
paid date that can be weeks apart. *Recommended:* the invoice's **creation (booking) date** decides, because the code is
used when booking. (The old app used the paid date.)

**Q9 — When the rules cannot decide.** If an invoice points at two companies equally (for example its email belongs to
one and its tax number to another), a person decides by moving the wrong clue to the right company, or by merging the
two. *Recommended:* also allow, as a last resort, "these rows belong to company A" with a written reason — logged and
undoable, shown with a pin mark.

**Q10 — Individuals (not a company).** *Recommended:* their paid invoices count in the department's figures (as today,
D25) but are credited to nobody, and are listed apart.

**Q11 — Last year's figures.** "This month vs the same month last year" needs last year's figures,
and telling a new client from an old one needs to know who bought before. Since the 2026 invoices are typed and imports
come later: *Recommended:* last year's monthly figures are typed once per KPI as readings (a few numbers, from the
department's own reports), and a company can be marked "client before 2026" on its card; when the import phase comes,
Payments history from 1 January 2025 replaces both.

**Q12 — Staff and test values that must never become identifiers.** *Recommended:* block every address at
`directksa.com` and `directksa.net` (and their sub-domains), the dummy VAT number Payments uses for tests, and any
customer name the owner lists as a test. The list is a setting the owner can add to.

**Q29 — Who types the invoices.** From go-live the team types the 2026 invoices (owner, 28 Sep). *Recommended:*
everyone in Commercial types invoices for any company and edits their own entries; managers correct anyone's (with the
change log and Undo as always); a person who typed an invoice for a customer with no company picks the company, and
that clue is kept so the next invoice matches by itself.

## C. Work, KPIs and reports

**Q13 — Achievements without a proof file.** D3 said proofs are optional; the KPI plan of 27 Sep said only achievements
with evidence count. *Recommended:* they count, but show as **"no evidence yet"** on the KPI page and in the KPI sheet,
so the strategy team's audit sees them at once.

**Q14 — The report templates.** Reports come out as PDF and PowerPoint "cloned from existing templates" (decided in
June). *Needed:* the department's current monthly and quarterly templates (PowerPoint), put in Drive. *Blocks:* P6-2.

**Q15 — The strategy team's KPI sheet.** The app must export the KPI sheet in their exact format so nobody types twice.
*Needed:* the Departmental KPIs sheet itself (it is in a chat, not yet in Drive). *Blocks:* P5-6 (the export only).

**Q16 — Correcting after a report is issued.** An issued report never changes. *Recommended:* the achievements behind it
can still be corrected by a manager **with a reason**; the issued report then says "1 figure changed since issue", and
the editor issues a correction that replaces it (both stay readable). The old app locked the month instead.

**Q17 — Where achievements sit in the menu.** The approved menu has no "Achievements" entry. *Recommended:* achievements
and challenges are two views inside **KPIs** (KPIs · Achievements · Challenges), logged also from a closed task; look
again after the team has used it for a month.

**Q18 — Next-month targets.** *Recommended:* when a target is written in the monthly report it becomes a task at once,
owned by the person named, due at the end of next month; the next report shows it done or carried over.

**Q19 — The operational-plan indicators** in the quarterly report (done / carried over). *Recommended:* they are KPIs of
the "pass/fail checklist" type in the yearly plan, grouped under their own objective.

**Q20 — Arabic dates and digits.** *Recommended:* Gregorian dates only (as decided) and Western digits (0–9) in both
languages, since figures are compared with Payments and Excel.

**Q21 — Company categories and tiers.** *Needed:* the starting lists, typed by the owner in Settings (for example:
corporate B2B, government and tenders, travel agency, study-abroad partner, supplier). Nothing blocks on it.

## D. Appraisal

**Q22 — The appraisal details** (08 C1–C4). The online appraisal tool now decides the section weights (70 / 25 / 5),
the grade scale, the points tables and the items; the Excel form only fills gaps (owner, 28 Sep). What the tool may
not settle — *recommended, one line each, each overridden by the tool where it does say:*
- the **manager's** evaluation is the one that counts; the self-evaluation sits beside it for discussion;
- the attainment cap is **120 %**;
- "documenting and escalating critical client feedback": **more is better**;
- "on-time reports" = months where the person had logged their achievements and updates before the report's cut-off
  day (setting, default the 5th);
- "weekly updates" = weeks (Sunday to Thursday) in which the person posted at least one update on each of their tasks
  in progress;
- who sees an appraisal: the person, their evaluator, anyone above them in the reporting line, and admins;
- each person's own targets (for example their sales plan) are entered by their manager when the cycle opens;
- Takamol stays out of personal appraisal figures too, because the Finance exclusion applies everywhere (08 C2), until
  the owner rules otherwise.

**Q23 — Past appraisals and ClickUp.** *Recommended:* take one read-only copy of the online tool's database; it seeds
the templates (Q22) and brings the last two cycles in as read-only history labelled "legacy" (08 A14). Import ClickUp's
KPI records once and stop using ClickUp for them (08 C5). Nothing from the old app's tasks and achievements is moved —
it is test data (D9).

## E. Everything else

**Q24 — Who is named for imports.** The old app logs imports and scripted changes as the QA account (D13), which mixes
a real login with the machine. *Recommended:* v2 names them "Import" and "System" — two named entries that cannot sign
in.

**Q25 — Notifications.** *Recommended:* in the app only (the bell and My day) for version 1; email or phone reminders
later, when the mail sender of Q4 exists.

**Q26 — The hosting plan's terms.** The free Vercel plan is meant for non-commercial use; the old app already runs on
it. *Recommended:* same as today for now; the paid plan (about 20 USD a month) only if Vercel ever asks.

**Q27 — Where the new code lives.** *Recommended:* in this same repository, in its own folder `v2/`, with its own
branch `v2/main`, so the old app is never touched and every session already reaches it. The repository stays public
(owner's ruling), so rule 7 applies to v2 exactly as today.

**Q28 — The main builder's handover note.** `docs/REBUILD-HANDOVER.md` had not been pushed to any branch when this was
written; the spec used the production branch's code for the main builder's work instead. *Needed from the oversight:*
the note, if it exists; anything in it that changes the spec will be folded in with a short follow-up PR.
