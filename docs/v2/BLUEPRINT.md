> **About this file (not part of the blueprint).** The owner-approved blueprint for the v2 Commercial app, v0.7 of
> 28 Sep 2026, copied word for word as the oversight sent it to the architect. The fuller wording lives in the Drive
> knowledge base as "11 Blueprint — new Commercial app (v0.7, 28 Sep 2026)"; where the two differ, the Drive file is the
> owner's and wins. How it will be built: `TECH-SPEC.md`; in what order: `BUILD-PLAN.md`; what is still unclear:
> `OPEN-QUESTIONS.md`. One change to the copy (oversight, 28 Sep): the evaluator's name in §5 is replaced by "the
> evaluator" — no staff names in this public repository.

---

## 0. Decisions (owner, 28 Sep)
- Rebuild from scratch. Old app frozen. Port proven parts: Payments file readers and column maps, money rules, test methods.
- Users v1: Commercial department only; built so other departments can be added later without rebuilding.
- One system: everything linked; each thing lives in one place; a change anywhere shows everywhere it is used, at once (1a).
- Configurable, not hard-coded: anything that may change is a setting an admin changes in the browser, with history, never code. Code holds only structure (records, links, calculations). Above all the department's objectives, KPIs and achievement categories are YEARLY PLANS set in the browser (5a) - new structure/KPIs/vision expected at year end.
- Sign-in simple but safe: no passwords. Work email + "Continue with Google" (Google Workspace) or a one-time code emailed; stay signed in on device; only admin-allowed emails. Email alone without verification is NOT used.
- Built for growth, kept simple: departments, teams, access levels, features added later without rebuild; modules share one data layer; one page list drives navigation, access matrix and database.
- Ready from day one, built later: Arabic (RTL layout + wording list from start; English only until tested), export (every list to Excel/CSV in v1), import (one framework; Payments all-invoices file first, others later).
- Design: professional, calm, 3 themes Light / Dark / Colorful from one token set. Fonts: Readex Pro (headings, figures), IBM Plex Sans + IBM Plex Sans Arabic (text), IBM Plex Mono (IDs, money). Tinted greys; colour for status and data. Dense tables (32px rows), side drawer 232px pinned / 56px collapsed, list+detail panel 480px, max one tab row, chips for filters, each dialog owns its own form state, toasts with Undo. Token hexes - Light: bg #F2F3EF surface #F9FAF7 raised #FFFFFF border #DADDD5 strong #858F88 text #1A1F1C muted #566059 accent #0B6B66 hover #08524E focus #2B63D9 success #1D7543 warning #8F5500 danger #B42318 info #1F5FAD. Dark: bg #161B1B surface #1C2322 raised #242C2B border #33403E strong #6B7A76 text #E4EAE7 muted #9AA7A3 accent #3FC1B4 hover #66D3C8 focus #7FA8FF success #4CC38A warning #E6A94B danger #F27A6F info #6FAAF2. Colorful: bg #EDF4F6 surface #F7FBFC raised #FFFFFF border #C9DDE3 strong #718F99 text #0F2A33 muted #46636D accent #C4314A hover #A3243A focus #6A4FD8 success #17794A warning #935200 danger #B3261E info #1D5FB8, drawer #0F4C5C.
- Scope v1, the closed circuit: Companies, Finance (invoices from Payments), Projects, Tasks, Achievements, KPIs, Reports, Appraisal - linked both ways. Leads, proposals, generators, events, suppliers later.
- Dates: Gregorian only, never Hijri; Riyadh time. Monthly figures always kept; quarters/years built from months.
- No data loss: nothing entered is lost by a release or import; every change logged and undoable.
- Testing: trial values entered in the browser to prove every figure flows everywhere; real values + reset before go-live.

## 1. Closed circuit - every link two-way
Task = basic unit (free-text title/notes) linked to company, project, contacts, invoices, KPIs.
- Company card: official details, identifiers, files, finance (invoices, revenue, cost, profit, collections), projects, tasks, achievements, KPI contributions by quarter.
- KPI page: target/result by month and quarter -> achievements (and invoices for money KPIs) -> company -> evidence file.
- Achievement: who, participants, when, source task, company, invoices, project, KPI(s), evidence.
- Invoice: company and client ID, credited person, project, achievements and report lines citing it.
- Reports and appraisals built from the above; nothing typed twice.

## 1a. How one change travels (tests must prove)
Nothing stores a copy of a figure.
- Invoice imported -> matched to company by any identifier -> credited to account manager -> company card revenue -> money KPI for month/quarter -> pace on My day -> monthly report revenue section -> account manager's appraisal line "sales vs plan".
- Task closed -> achievement "new deal" with company and evidence -> company card -> KPI "B2B contracts" +1 in evidence month -> report line -> owner's appraisal line "new B2B clients".
- Account manager changes -> credit moves from the admin's effective date -> both people's KPIs, My day, appraisal update.
- Identifier added/removed -> past invoices re-link -> every total updates.
- Achievement corrected/removed -> KPI, company card, draft reports, appraisal update; issued report stays frozen with a superseding correction.
- KPI target/definition changes -> pace, reports, appraisal recalculate; change logged with effective date.

## 2. Records (draft)
Company, Company identifier, Contact, File, Invoice (lines, payments), Expense line, Project, Task, Action item, Task update/meeting note, Achievement, Achievement category, Participant, Challenge, Next-month target, Report, Report line, Plan (year), Objective, KPI, KPI target (month/quarter), KPI lead/contributor, Appraisal cycle, Appraisal template, Template section, Template item, Grade scale, Appraisal (per person), Appraisal line score, Department, Person, Team, Role, Access level, Setting, Change log.

## 3. Rules
Companies: one record with all identifiers (Payments client IDs prepaid/postpaid/tender, discount codes with optional dates, EN/AR names, emails, phones, VAT, CR); each identifier belongs to one company only. Import match order: client ID > VAT/CR > discount code within dates > email > phone > normalized name (case, spaces, Arabic diacritics/tatweel, alef/ya/ta-marbuta forms, drop words like sharika/company/co/ltd/llc). None or two matches -> "Needs a decision"; a decision adds the identifier; matching is live (identifier change re-links past rows); staff emails and test rows never become identifiers. No parent/branch tree; sister companies/JVs handled by adding identifiers or merging, each with a reason, logged, undoable. One account manager per company gets paid-revenue credit; a manager can split/reassign one invoice's credit with a note. Sales under a company's commercial discount code are its revenue; a promo-code-only partnership is not a technical-integration KPI.
Visibility: tasks, achievements, companies, projects, KPIs, reports open to the whole Commercial team; every change logged, owner notified. Anyone creates own tasks; managers/admins assign; colleagues help. Appraisal private (own; manager and admins see their team). KPI leads (one or more, follow up and keep evidence) and contributors (whole department, teams, or named people); neither makes it a personal target.
Tasks (daily use by everyone): title, notes, owner, team, priority, due date, status, links, and reference numbers from Direct's own systems (booking, invoice, ticket) so nothing is retyped. Helpers optional on a task or on a single action item. Action items: text, owner, due date, done; grow while task runs; a meeting note on the task adds assigned action items. "My work" = everything I own + action items assigned to me + things I help on. Views: list, board by status, calendar. Quick add. Comments with @mentions; in-app notifications (assignment, mention, due). Timeline of dated updates; in-progress with no update for N days flagged. Recurring templates. Closing a task offers to log its achievement.
Achievements: order task -> achievement -> live KPIs and monthly report. KPIs measured continuously, read by quarter; no monthly KPI targets, but the monthly report shows each month's addition to each KPI's quarter. Stored as fields (category, company, service, amount from linked invoices, count, before/after, date, participants, evidence) and rendered as one clear line. Categories + sub-categories set in the yearly plan; starting list: new deals/new B2B clients; revenue and bookings (links invoices, amount read from Finance, never typed); commissions and collections; tenders; new supplier/provider contracts; contract improvements (before->after); renewals; technical integrations/activations; product and service additions; airline/IATA/GDS relations; study-abroad partners; meetings, visits, events; awards; problem solving; payments/fintech; cost savings; internal tools and initiatives; quotes and proposals sent. Evidence = source file; evidence date decides month/quarter. No approval step; a manager can correct/move/remove with a logged reason. Challenges are records open until resolved (company/supplier, age) - they carry over automatically. Next-month targets become next month's tasks and show as done or carried over at the next report.
Reports: compiled by named report editors; a line can combine and reword achievements and sum linked invoices; originals never change. Monthly: cover, this month vs same month last year tiles, achievements by category, challenges, next-month targets. Quarterly: quarter vs same quarter last year, achievements, challenges, next-quarter targets, operational-plan indicators (done/carried). Sections are a setting. PDF + PPTX. Issued month frozen; superseding corrections. Export of the KPI sheet in the strategy team's format.
Revenue/KPIs: money KPIs read Finance; invoice links never double count. Non-money KPIs count linked achievements or are computed from app data. Cumulative across quarters. Types: number, money, percentage/score (latest), pass/fail checklist, tracked-only. Not measured != 0.
Finance: only Fully Paid invoices count; wallet top-ups never revenue; billing invoices that re-bill transactions are zero-revenue links; collections sit on billing invoices; cost = approved expenses, else Revenue Report expense amount, else the invoice's pass-through lines as a flagged estimate; VAT never shown; income by main service via editable product->service and item->service maps; exclusions by rule; "Commercial revenue" definition is a setting.
Years: KPIs, months, quarters, reports = calendar year. Appraisal = April-March.

## 4. Home, navigation, settings
My day: my open/overdue tasks and action items (owned, assigned, helping), my companies' new invoices and unpaid balances, my KPIs (lead or contributor) and pace, and privately my appraisal progress.
Navigation: side drawer (My day, Companies, Projects, Tasks, Finance, KPIs, Reports, Appraisal, Settings), pinnable/collapsible; top bar with search (Ctrl K), Create, notifications. Each area = one page with list + detail panel (full page on phone); every record has its own URL; at most one tab row in a detail; filters as chips.
Settings = one area, groups gated by access level: Organization & access (departments, teams, people, managers, roles, page access, allowed sign-in emails); Companies (categories, tiers, identifier matching order, credit rules); Plan & performance (yearly plan, KPIs, targets, KPI leads/contributors, achievement categories and fields, appraisal cycles and templates); Finance (services, product->service map, item names cost/fee, exclusions, revenue definition); Work (task statuses, priorities, templates, recurrence, no-update days, reminders); App (themes, language and wording, notifications, import/export).

## 5. Appraisal - configurable engine mirroring the official form ("Annual Appraisal - Commercial (Professional) - Business", Apr 2025-Mar 2026, the evaluator) and the old appraisal tool
Cycle (name, start/end default Apr-Mar, evaluation date, evaluator per person, lock date). Template per role with weighted sections: Corporate objectives, Personal KPIs, Competencies (current rule 70/20/10; signed form 60/35/5; admin sets it). Corporate objectives: target, weight, 80/90/100/110% threshold columns, points table (101-110% = 3.00 ... <75% = 0), actuals entered once. Personal KPIs grouped (Sales & revenue, Client acquisition, Internal coordination, Reporting) with name, definition, formula, unit, target, weight, direction, and source = computed from app (GMV vs plan from credited revenue; revenue from new clients; new B2B clients; upsell/cross-sell achievements; follow-up on time from action items; weekly updates; meeting notes on time; task execution on time; initiatives and escalations; reports on time) or manual (manager assessment 1-5). Competencies with weights and manager score + comment. Self and manager evaluation per line; comments; sign-off. Grade scale and cap are settings. Old tool imported once as legacy.

## 5a. Yearly plans
Objectives, KPIs, targets (month/quarter), KPI leads and contributors, achievement categories (each with its own fields and KPI mappings) live in a Plan per year. Next year: copy and edit or start blank - add/remove/rename/renumber/regroup, change units, types, sources, formulas, targets, thresholds. History keeps its structure (2026 achievements stay on 2026 KPIs; 2026 reports show the 2026 plan). Re-mapping to a new plan's KPIs is a logged person action. Mid-year changes take an effective date.

## 7-9. Screens, Imports, Access - to be specified (your TECH-SPEC should propose them).

## 10. Checks
Email-only sign-in rejected (impersonation); Google or one-time code instead (email sender for codes still to be set up by the company; Google avoids that). Revenue achievements link invoices and never carry typed amounts. No approval but managers can correct with a logged reason. KPI sheet exported in the strategy team's format. Challenges carry over as records.

---

## Addendum — owner decisions after v0.7 (28 Sep 2026, relayed by the oversight)

*Not part of the verbatim v0.7 text above; recorded here so the blueprint file holds every owner decision. Where they
touch a v0.7 line, these win.*

1. **Sign-in.** Staff have two email domains: `directksa.com` = Google Workspace, `directksa.net` = Zoom (Zoom Workplace
   mail). "Continue with Google" for directksa.com, "Continue with Zoom" for directksa.net, plus an emailed one-time code
   as fallback for anyone (needs a custom SMTP sender). No passwords. Every sign-in identity resolves to ONE person
   record: a person holds one or more allowed emails (admin allow-list); the provider-verified email must match an
   allowed email of an active person, else access is denied; identities link to that person and never create new
   people. Every sign-in is logged.
2. **Appraisal.** The online appraisal tool (directksa.vercel.app) is the latest source; the Excel form must match it,
   and where they differ the tool wins. The template is seeded from the tool — section weights 70/25/5 as in the tool,
   its grade scale, points tables and items — with only gaps filled from the Excel form. Still all settings.
3. **"Commercial total revenue"** does not block anything: the structure is built (its definition is a Finance
   setting); the value is decided at go-live.
4. **Go-live = code and structure proven working.** The 2026 invoices are then entered manually in the browser by the
   users (as in the old app), so every user and flow gets tested while adding; import stays a later phase. Manual
   invoice entry (with lines, expenses, DPIN reference, status Provisional/Final) is a first-class, fast screen in v1.
5. **Environments.** The owner will approve creating the new Supabase and Vercel projects; free tier preferred, any cost
   flagged (`TECH-SPEC.md` §10).

**Design additions (owner, 28 Sep, relayed by the oversight).**

6. **A fourth theme, "Direct"** (the other three unchanged): drawer/top bar #23221F, nav text #ECE8E1, nav muted
   #A8A298, nav active #F08A45; bg #F6F4F0, surface #FBFAF7, raised #FFFFFF, border #E4DFD6, strong #857E73, text
   #1F1E1C, muted #5E5A53; accent fill #E4702A (fills only, never text; the label on accent is #1F1E1C, not white),
   accent hover #F07E36, link/orange text #A64B12, selected-row tint #FBE6D6; success #2E7540, warning #7A5E00,
   danger #B3203A, info #2D5FA8. All AA-checked. Source of truth: the design system page
   (https://claude.ai/artifact/LhgpWwKiMxQtQiQmXjco64) and the screens canvas
   (https://claude.ai/artifact/QRysGjaefjvGbDxNvfYbLW, 12 artboards incl. QuarterlyReport and MyDay in Direct).
7. **Density:** Comfortable by default (14 px body, 40 px controls, 44–52 px table rows, 24–32 px section gaps);
   Compact optional per user. Nothing cramped, especially My day. (This replaces v0.7's "dense tables (32px rows)" as
   the default; 32 px rows remain as Compact.)
8. **Personalisation — "My profile"**, first in Settings, each user edits their own: photo upload or an initials avatar
   with a chosen colour, full name and display name/nickname, an optional badge (none / an icon from a set / zodiac
   sign), preferred theme (of four), density, language (English now, Arabic later), start page, drawer pinned or
   collapsed, notification choices (in-app, email). Avatar, nickname and badge show in the top bar, the drawer foot and
   owner/helper chips. Company logo uploaded on the company record.
9. **Reports** = one tab row, Monthly · Quarterly. The quarterly report: cover; quarter vs the same quarter last year
   (tiles); achievements by category (lines linking to achievement, company, invoices); KPI results (target, M1, M2, M3,
   quarter, YTD, status); challenges (open carries over / resolved); next-quarter targets; operational-plan indicators
   (Done / Carried over); actions Issue (freeze), PDF, PPTX, KPI sheet export.
10. **UI rule:** no hint text, explanatory notes, banners, callouts or demo annotations inside screens (the old app's
    biggest complaint). Every entity (company, invoice, task, achievement, KPI, report line, person) is a link.

**Owner answers later on 28 Sep.**

11. **Room for the new database:** the free way — the old app's database (`direct-business`) is paused on 1 Oct, after
    the Q3 close of 30 Sep; the old app is unavailable from then (data kept, restorable); the appraisal tool stays live;
    the new project is created on the free plan.
12. **Domain:** the new app uses the same domain, `directksab2b.com`; staging on the new Vercel project's address; at
    go-live the domain moves to the new project and the sign-in settings list it.
13. **Google and Zoom sign-in keys:** later; building proceeds with the emailed code.

**Owner changes, round 3 (28 Sep, relayed by the oversight)** — decisions V52–V61 in `DECISIONS.md`:

14. **Companies become Partners**, one record with roles Client / Supplier / Strategic partner, and one tab row by role:
    Overview · Finance · Contracts & files · Work · Achievements (the code is renamed too — V52).
15. **Logos and avatars** in rows, chips, headers and hover cards (V53).
16. **The partner card's period view** MTD · QTD · YTD · Custom, **Open in Finance** with the filters in the address,
    and saved views (V54).
17. **Files named automatically** from a pattern per kind, computed when shown and used by the download (V55).
18. **Contracts** with start and end dates, a computed status and renewal reminders (V56).
19. **Reports archive**, including the 2024–2026 PDFs, and **compare two periods** (V57).
20. **Live names everywhere**: an issued report freezes its figures but shows people's and partners' current names (V58).
21. **Sign-in**: the emailed code is the door; keep signed in 30 days; the page shows only the logo, "Commercial
    Workspace", EN | ع and © Direct; never "Direct KSA", "DirectKSA", "Direct Corporate", "B2B" or "MICE"; the
    department is "Commercial"; a real mail sender before real users (V59).
22. **The Direct theme uses the official palette**; every theme has a primary colour for buttons; logo rules (V60).
23. **Patterns**: notification centre, alerts as notifications, hover cards, follow, activity timeline with Undo, saved
    views, bulk actions, "Since your last visit" (V61).

**Oversight rulings, round 4 (28 Sep, from the manager's recorded calls; no names from them enter this repository)** —
V62–V72 in `DECISIONS.md`:

24. **Partner roles are multi-select**, each with its own fields; **status** Prospect / Active / At risk / Lost with
    history, reason and last feedback date; a report section on partners at risk or lost (V62).
25. **Light prospecting**: bulk assign owner and priority in one action; one-click **Log call** with an outcome; weekly
    counts feed the appraisal (V63).
26. **Segment** on the partner, overridable on a project and an invoice; revenue and KPIs split by it (V64).
27. **Discount codes carry terms**; one code per partner by default; **campaign codes** credited to no partner; sales by
    code by month (V65).
28. **Achievement categories**: Problem solving and Cost savings with typed amounts (never Finance money); MoU /
    strategic signing (not a new client; the partner becomes Prospect); Awards with an entry cost (V66).
29. **Reports**: a quarterly "Cases" section; non-money amounts labelled "not revenue"; search across issued reports
    (V67).
30. **Appraisal self-registration** before the manager's review; undated or evidence-less items never count (V68).
31. **Challenges** record escalation (V69).
32. **Partner finance**: credit limit with history, prepaid (wallet) balance, "sent to legal"; guarantees, supplier
    payables and referral terms later (V70).
33. **Go-live as a staged pilot** (V71).
34. **Recurring "Partner feedback" task** per key partner (V72).

**Owner decisions, round 5 (29 Sep, relayed by the oversight)** — V74–V83 in `DECISIONS.md`:

35. **Sessions**: a device stays signed in until sign-out; 30 unused days → a new code; admins sign anyone out; My
    profile lists devices (V74).
36. **Sign-in page**: split layout with a brand panel and the brand line "The commercial arm of the all-in-one travel
    app" / «الذراع التجاري لتطبيق السفر الشامل» (V75).
37. **Arabic reports**: Arabic labels required on every list; Arabic sentence templates per category; an on-device
    "Translate to Arabic" helper, no paid service (V76).
38. **Partner names**: official English and Arabic names and a trade name; the trade name shows everywhere (V77).
39. **Partners page**: saved views across the top; Role · Segment · Owner · Status and a KPI chip; More filters (V78).
40. **Report lines**: achievement lines (create or cite the achievement) and note lines (never count) (V79).
41. **Tenders and the Pipeline** in v1, their KPIs, and one Commercial overview with a segment switch (V80).
42. **Less crowded detail pages**: two columns, empty fields behind "+ Add", Show all (V81).
43. **Design moves to Figma** through a dedicated design session (V82).
44. **Exports unchanged** for now (V83).

**Oversight update, 28 Sep** — the owner does not need the old app: its database is paused and `direct-commercial`
exists in Supabase and Vercel; the domain moves as soon as v2's sign-in page renders; only the owner pastes keys into
Vercel (V13, V21, V84).

**Finance finding (the oversight's read-only sample of Payments, 28 Sep)** — the unit of revenue is the transaction
invoice (a standalone invoice with no consolidation link counts as itself); billing invoices re-bill transactions and
are excluded from revenue, and collections are settled on them; cost is the sum of approved expenses on the
transaction, and invoice line names are not a reliable cost (kept only as a flagged fallback estimate); the DPIN tax
invoice (child of the billing or direct invoice) equals the total minus approved expenses and is used as the check —
cost Provisional while an expense is pending or none is registered (commission-only excepted), Final once the DPIN
exists, "expenses missing" when the DPIN is 100 % of a non-commission total, and a billing total must equal the sum of
its transactions. VAT is never shown; profit = revenue − cost as recorded. Details: `TECH-SPEC.md` §3.6.
