> **About this file (not part of the blueprint).** The owner-approved blueprint for the v2 Commercial app, v0.7 of
> 28 Sep 2026, copied word for word as the oversight sent it to the architect, **as amended by the owner's decisions
> V1 to the current one in `DECISIONS.md`** (V402 at the time of writing; the addendum below lists each round). The fuller wording lives in the Drive
> knowledge base as "11 Blueprint — new Commercial app (v0.7, 28 Sep 2026)"; where the two differ, the Drive file is the
> owner's and wins. How it will be built: `TECH-SPEC.md`; in what order: `BUILD-PLAN.md`; what is still unclear:
>
> `OPEN-QUESTIONS.md`. One change to the copy (oversight, 28 Sep): the evaluator's name in §5 is replaced by "the
> evaluator" — no staff names in this public repository.
>
> **Superseded lines are marked, never silently changed** (audit of 29 Sep): the stale words are struck through
> (~~like this~~) and followed by **[SUPERSEDED — Vnn: what holds now]**, citing `DECISIONS.md`. Read the marks first:
> a struck line is history, the note is the rule. Where this file and `DECISIONS.md` differ, `DECISIONS.md` wins.
> Superseded addendum items are marked the same way.

---

## 0. Decisions (owner, 28 Sep)
- Rebuild from scratch. Old app frozen. Port proven parts: Payments file readers and column maps, money rules, test methods.
- Users v1: Commercial department only; built so other departments can be added later without rebuilding. **[SUPERSEDED in part — V71: Finance colleagues also get read access to Finance, from the staged pilot on]**
- One system: everything linked; each thing lives in one place; a change anywhere shows everywhere it is used, at once (1a).
- Configurable, not hard-coded: anything that may change is a setting an admin changes in the browser, with history, never code. Code holds only structure (records, links, calculations). Above all the department's objectives, KPIs and achievement categories are YEARLY PLANS set in the browser (5a) - new structure/KPIs/vision expected at year end.
- Sign-in simple but safe: no passwords. Work email + ~~"Continue with Google" (Google Workspace) or~~ a one-time code emailed; stay signed in on device; only admin-allowed emails. Email alone without verification is NOT used. **[SUPERSEDED — V59: the emailed code is the only door (Google and Zoom only as later shortcuts, V23); V74: a device stays signed in until sign-out, 30 unused days → a new code; no "keep me signed in" tick; V431 (29 Sep 13:50): for now the door is email + password, set and reset by an admin — nothing sends email; the code door stays in the code, switched off]**
- Built for growth, kept simple: departments, teams, access levels, features added later without rebuild; modules share one data layer; one page list drives navigation, access matrix and database.
- Ready from day one, built later: Arabic (RTL layout + wording list from start; English only until tested), export (every list to Excel/CSV in v1), import (one framework; Payments all-invoices file first, others later). **[SUPERSEDED — V5: at go-live the 2026 invoices are typed in the browser; every import, the all-invoices file included, is the later phase P7]**
- Design: professional, calm, ~~3 themes Light / Dark / Colorful~~ **[SUPERSEDED — V7, V60: four themes — Light, Dark, Colorful and Direct (the official palette)]** from one token set. Fonts: Readex Pro (headings, figures), IBM Plex Sans + IBM Plex Sans Arabic (text), IBM Plex Mono (IDs, money). Tinted greys; colour for status and data. ~~Dense tables (32px rows)~~ **[SUPERSEDED — V8: Comfortable by default, 44–52 px table rows; 32 px rows only in the per-person Compact density]**, side drawer 232px pinned / 56px collapsed (still in force — V85), list+detail panel 480px, max one tab row, chips for filters, each dialog owns its own form state, toasts with Undo. Token hexes - Light: bg #F2F3EF surface #F9FAF7 raised #FFFFFF border #DADDD5 strong #858F88 text #1A1F1C muted #566059 accent #0B6B66 hover #08524E focus #2B63D9 success #1D7543 warning #8F5500 danger #B42318 info #1F5FAD. Dark: bg #161B1B surface #1C2322 raised #242C2B border #33403E strong #6B7A76 text #E4EAE7 muted #9AA7A3 accent #3FC1B4 hover #66D3C8 focus #7FA8FF success #4CC38A warning #E6A94B danger #F27A6F info #6FAAF2. Colorful: bg #EDF4F6 surface #F7FBFC raised #FFFFFF border #C9DDE3 strong #718F99 text #0F2A33 muted #46636D accent #C4314A hover #A3243A focus #6A4FD8 success #17794A warning #935200 danger #B3261E info #1D5FB8, drawer #0F4C5C.
- Scope v1, the closed circuit: ~~Companies~~ Partners, Finance (invoices from Payments), Projects, Tasks, Achievements, KPIs, Reports, Appraisal - linked both ways. Leads, proposals, generators, events, ~~suppliers~~ later. **[SUPERSEDED — V98: one organisation with two sides, Client and Supplier & partner, so suppliers are in v1; V80: tenders, the Pipeline and the Commercial overview are in v1; V63, V99: light prospecting and pipeline stages, no Leads module]**
- Dates: Gregorian only, never Hijri; Riyadh time. Monthly figures always kept; quarters/years built from months.
- No data loss: nothing entered is lost by a release or import; every change logged and undoable.
- Testing: trial values entered in the browser to prove every figure flows everywhere; real values + reset before go-live.

## 1. Closed circuit - every link two-way
**[SUPERSEDED — V98: in §1–§4 below, every "company / companies / Company card" naming the record reads "organisation" — a Client, a Supplier & partner, or both (the stop word "company" in name folding stays a word); the rules are unchanged]**
Task = basic unit (free-text title/notes) linked to company, project, contacts, invoices, KPIs.
- Company card: official details, identifiers, files, finance (invoices, revenue, cost, profit, collections), projects, tasks, achievements, KPI contributions by quarter.
- KPI page: target/result by month and quarter -> achievements (and invoices for money KPIs) -> company -> evidence file.
- Achievement: who, participants, when, source task, company, invoices, project, KPI(s), evidence.
- Invoice: company and client ID, credited person, project, achievements and report lines citing it.
- Reports and appraisals built from the above; nothing typed twice.

## 1a. How one change travels (tests must prove)
Nothing stores a copy of a figure.
- Invoice ~~imported~~ **[SUPERSEDED — V5: typed in v1; imported from P7]** -> matched to company by any identifier -> credited to account manager -> company card revenue -> money KPI for month/quarter -> pace on My day -> monthly report revenue section -> account manager's appraisal line "sales vs plan".
- Task closed -> achievement "new deal" with company and evidence -> company card -> KPI "B2B contracts" +1 in evidence month -> report line -> owner's appraisal line "new B2B clients".
- Account manager changes -> credit moves from the admin's effective date -> both people's KPIs, My day, appraisal update.
- Identifier added/removed -> past invoices re-link -> every total updates.
- Achievement corrected/removed -> KPI, company card, draft reports, appraisal update; issued report stays frozen with a superseding correction.
- KPI target/definition changes -> pace, reports, appraisal recalculate; change logged with effective date.

## 2. Records (draft)
~~Company, Company identifier~~ **[SUPERSEDED — V98: Organisation with its Client and Supplier & partner sides, Organisation identifier — plus Contract, Tender and Partnership opportunity (V56, V80, V99)]**, Contact, File, Invoice (lines, payments), Expense line, Project, Task, Action item, Task update/meeting note, Achievement, Achievement category, Participant, Challenge, Next-month target, Report, Report line, Plan (year), Objective, KPI, KPI target (month/quarter), KPI lead/contributor, Appraisal cycle, Appraisal template, Template section, Template item, Grade scale, Appraisal (per person), Appraisal line score, Department, Person, Team, Role, Access level, Setting, Change log.

## 3. Rules
~~Companies~~ Organisations **[SUPERSEDED — V98]**: one record with all identifiers (Payments client IDs prepaid/postpaid/tender, discount codes with optional dates **[SUPERSEDED — V65: codes also carry terms; one live code per partner by default; campaign codes belong to no partner]**, EN/AR names **[SUPERSEDED — V77: official English and Arabic names plus a trade name in both; the trade name is displayed]**, emails, phones, VAT, CR); each identifier belongs to one company only. Import match order: client ID > VAT/CR > discount code within dates > email > phone > normalized name (case, spaces, Arabic diacritics/tatweel, alef/ya/ta-marbuta forms, drop words like sharika/company/co/ltd/llc). None or two matches -> "Needs a decision"; a decision adds the identifier; matching is live (identifier change re-links past rows); staff emails and test rows never become identifiers. No parent/branch tree; sister companies/JVs handled by adding identifiers or merging, each with a reason, logged, undoable. One account manager per company gets paid-revenue credit; a manager can split/reassign one invoice's credit with a note. Sales under a company's commercial discount code are its revenue; a promo-code-only partnership is not a technical-integration KPI.
Visibility: tasks, achievements, companies, projects, KPIs, reports open to the whole Commercial team; every change logged, owner notified. **[V96 confirms this; an appraisal is visible only to the person, their direct manager and admins]** Anyone creates own tasks; managers/admins assign; colleagues help. Appraisal private (own; manager and admins see their team). **[SUPERSEDED — V96: the person, their direct manager and admins — not a whole reporting line]** KPI leads (one or more, follow up and keep evidence) and contributors (whole department, teams, or named people); neither makes it a personal target.
Tasks (daily use by everyone): title, notes, owner, team, priority, due date, status **[V401: meanings fixed — Not started · In progress · Done · Cancelled — with editable names; Blocked inside In progress with a reason]**, links, and reference numbers from Direct's own systems (booking, invoice, ticket) so nothing is retyped. Helpers optional on a task or on a single action item. Action items: text, owner, due date, done; grow while task runs; a meeting note on the task adds assigned action items. "My work" = everything I own + action items assigned to me + things I help on. Views: list, board by status, calendar. Quick add. Comments with @mentions; in-app notifications (assignment, mention, due). Timeline of dated updates; in-progress with no update for N days flagged. Recurring templates. Closing a task offers to log its achievement.
Achievements: order task -> achievement -> live KPIs and monthly report. KPIs measured continuously, read by quarter; ~~no monthly KPI targets~~ **[SUPERSEDED — §5a and V401: targets are set by month or quarter in the plan (P5-5)]**, but the monthly report shows each month's addition to each KPI's quarter. Stored as fields (category, company, service, amount from linked invoices, count, before/after, date, participants, evidence) and rendered as one clear line. Categories + sub-categories set in the yearly plan; starting list: new deals/new B2B clients; revenue and bookings (links invoices, amount read from Finance, never typed); commissions and collections; tenders; new supplier/provider contracts; contract improvements (before->after); renewals; technical integrations/activations; product and service additions; airline/IATA/GDS relations; study-abroad partners; meetings, visits, events; awards; problem solving; payments/fintech; cost savings; internal tools and initiatives; quotes and proposals sent. Evidence = source file **[V99: or a Direct ticket or booking reference with its link]**; evidence date decides month/quarter. **[V400: the achievement's `happened_on` is the date on its evidence; `happened_on` decides every period, never the day it was logged]** No approval step; a manager can correct/move/remove with a logged reason. Challenges are records open until resolved (company/supplier, age) - they carry over automatically. Next-month targets become next month's tasks and show as done or carried over at the next report.
Reports: compiled by named report editors; a line can combine and reword achievements and sum linked invoices; originals never change. Monthly: cover, this month vs same month last year tiles, achievements by category, challenges, next-month targets. Quarterly: quarter vs same quarter last year, achievements, challenges, next-quarter targets, operational-plan indicators (done/carried). Sections are a setting. PDF + PPTX. Issued month frozen; superseding corrections. Export of the KPI sheet in the strategy team's format.
Revenue/KPIs: money KPIs read Finance; invoice links never double count. Non-money KPIs count linked achievements or are computed from app data. Cumulative across quarters. Types: number, money, percentage/score (latest), pass/fail checklist, tracked-only. Not measured != 0.
Finance: only Fully Paid invoices count; wallet top-ups never revenue; billing invoices that re-bill transactions are zero-revenue links; collections sit on billing invoices; cost = approved expenses, ~~else Revenue Report expense amount, else the invoice's pass-through lines as a flagged estimate~~ **[SUPERSEDED — V1, D21, D23: cost is approved expenses only; the Revenue Report amount and the pass-through lines are flagged estimates shown apart, never counted as cost or in profit]**; VAT never shown; income by main service via editable product->service and item->service maps; exclusions by rule; "Commercial revenue" definition is a setting.
Years: KPIs, months, quarters, reports = calendar year. Appraisal = April-March.

## 4. Home, navigation, settings
My day: my open/overdue tasks and action items (owned, assigned, helping), my ~~companies'~~ organisations' **[SUPERSEDED — V98]** new invoices and unpaid balances, my KPIs (lead or contributor) and pace, and privately my appraisal progress.
Navigation: side drawer (~~My day, Companies, Projects, Tasks, Finance, KPIs, Reports, Appraisal, Settings~~ **[SUPERSEDED — V98, V80, V97: My day, Overview, Clients, Suppliers & partners, Pipeline, Projects, Tasks, Finance, KPIs, Reports, Appraisal, Activity; Settings for admins only]**), pinnable/collapsible; top bar with search (Ctrl K), Create, notifications. Each area = one page with list + detail panel (full page on phone); every record has its own URL; at most one tab row in a detail **[V95: one record-page template — a header with up to five key figures and the main actions, tabs Overview · Activity · Related · one type tab, a details rail with every custom field]**; filters as chips. **[SUPERSEDED — V85, V98: on phones a bottom bar (My day · Tasks · Clients · KPIs · More) replaces the drawer; details open full screen; tables become two-line cards]**
Settings = one area, ~~groups gated by access level~~ **[SUPERSEDED — V97: Settings is admins-only (levels none / full); everyone has My profile; managers act inside records — targets on the KPI page, appraisals on the person's page]**: Organization & access (departments, teams, people, managers, roles, page access, allowed sign-in emails); ~~Companies~~ Clients, and Suppliers & partners **[SUPERSEDED — V98]** (categories **[V98: the types per side]**, tiers, identifier matching order, credit rules); Plan & performance (yearly plan, KPIs, targets, KPI leads/contributors, achievement categories and fields, appraisal cycles and templates); Finance (services, product->service map, item names cost/fee, exclusions, revenue definition); Work (task statuses, priorities, templates, recurrence, no-update days, reminders); App (themes, language and wording, notifications, import/export).

## 5. Appraisal - configurable engine mirroring the official form ("Annual Appraisal - Commercial (Professional) - Business", Apr 2025-Mar 2026, the evaluator) and the old appraisal tool
Cycle (name, start/end default Apr-Mar, evaluation date, evaluator per person, lock date). Template per role with weighted sections: Corporate objectives, Personal KPIs, Competencies (~~current rule 70/20/10; signed form 60/35/5~~ **[SUPERSEDED — V3: 70/25/5 — personal KPIs / competencies / corporate — seeded from the online appraisal tool]**; admin sets it). Corporate objectives: target, weight, 80/90/100/110% threshold columns, points table (101-110% = 3.00 ... <75% = 0), actuals entered once. Personal KPIs grouped (Sales & revenue, Client acquisition, Internal coordination, Reporting) with name, definition, formula, unit, target, weight, direction, and source = computed from app (GMV vs plan from credited revenue; revenue from new clients; new B2B clients; upsell/cross-sell achievements; follow-up on time from action items; weekly updates; meeting notes on time; task execution on time; initiatives and escalations; reports on time) or manual (manager assessment 1-5). Competencies with weights and manager score + comment. Self and manager evaluation per line; comments; sign-off. Grade scale and cap are settings. Old tool imported once as legacy.

## 5a. Yearly plans
Objectives, KPIs, targets (month/quarter), KPI leads and contributors, achievement categories (each with its own fields and KPI mappings) live in a Plan per year. Next year: copy and edit or start blank - add/remove/rename/renumber/regroup, change units, types, sources, formulas, targets, thresholds. History keeps its structure (2026 achievements stay on 2026 KPIs; 2026 reports show the 2026 plan). Re-mapping to a new plan's KPIs is a logged person action. Mid-year changes take an effective date.

## 7-9. Screens, Imports, Access - to be specified (your TECH-SPEC should propose them).

## 10. Checks
Email-only sign-in rejected (impersonation); ~~Google or~~ one-time code instead (email sender for codes still to be set up by the company; ~~Google avoids that~~). **[SUPERSEDED — V59: the emailed code is the only door; V24: the mail sender is needed before real users; V431: for now the door is email + password and no mail is sent]** Revenue achievements link invoices and never carry typed amounts. No approval but managers can correct with a logged reason. KPI sheet exported in the strategy team's format. Challenges carry over as records.

---

## Addendum — owner decisions after v0.7 (28 Sep 2026, relayed by the oversight)

*Not part of the verbatim v0.7 text above; recorded here so the blueprint file holds every owner decision. Where they
touch a v0.7 line, these win.*

1. **Sign-in.** Staff have two email domains: `directksa.com` = Google Workspace, `directksa.net` = Zoom (Zoom Workplace
   mail). ~~"Continue with Google" for directksa.com, "Continue with Zoom" for directksa.net, plus an emailed one-time code
   as fallback for anyone~~ **[SUPERSEDED — V59: the emailed one-time code is the only door, for everyone; Google and Zoom only as later optional shortcuts (V23)]** (needs a custom SMTP sender). No passwords. Every sign-in identity resolves to ONE person
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
5. **Environments.** ~~The owner will approve creating the new Supabase and Vercel projects;~~ **[SUPERSEDED — V84: both projects were created by the oversight on 28 Sep]** free tier preferred, any cost
   flagged (`TECH-SPEC.md` §10).

**Design additions (owner, 28 Sep, relayed by the oversight).**

6. **A fourth theme, "Direct"** (the other three unchanged) **[SUPERSEDED — V60: the Direct theme uses the official palette (slate #323E48, orange accent #F06820, primary #C94C14) — the values in BUILD-PLAN "Design tokens"; the charcoal values below are void. V82: the design source is the screens canvas (now 18 artboards) and the design system page, owned by the Design lead session]**: ~~drawer/top bar #23221F, nav text #ECE8E1, nav muted
   #A8A298, nav active #F08A45; bg #F6F4F0, surface #FBFAF7, raised #FFFFFF, border #E4DFD6, strong #857E73, text
   #1F1E1C, muted #5E5A53; accent fill #E4702A (fills only, never text; the label on accent is #1F1E1C, not white),
   accent hover #F07E36, link/orange text #A64B12, selected-row tint #FBE6D6; success #2E7540, warning #7A5E00,
   danger #B3203A, info #2D5FA8.~~ All AA-checked. Source of truth: the design system page
   (https://claude.ai/artifact/LhgpWwKiMxQtQiQmXjco64) and the screens canvas
   (https://claude.ai/artifact/QRysGjaefjvGbDxNvfYbLW, ~~12 artboards~~ 18 artboards incl. QuarterlyReport and MyDay in Direct).
7. **Density:** Comfortable by default (14 px body, 40 px controls, 44–52 px table rows, 24–32 px section gaps);
   Compact optional per user. Nothing cramped, especially My day. (This replaces v0.7's "dense tables (32px rows)" as
   the default; 32 px rows remain as Compact.)
8. **Personalisation — "My profile"**, first in Settings, each user edits their own: photo upload or an initials avatar
   with a chosen colour, full name and display name/nickname, an optional badge (none / an icon from a set / zodiac
   sign), preferred theme (of four), density, language (English now, Arabic later), start page, drawer pinned or
   collapsed, notification choices (in-app, ~~email~~ **[SUPERSEDED — V45: in-app only in v1; email later]**). Avatar, nickname and badge show in the top bar, the drawer foot and
   owner/helper chips. ~~Company logo uploaded on the company record.~~ **[SUPERSEDED — V53: the partner logo is uploaded on the partner record]**
9. **Reports** = one tab row, Monthly · Quarterly. The quarterly report: cover; quarter vs the same quarter last year
   (tiles); achievements by category (lines linking to achievement, ~~company~~ partner **[SUPERSEDED — V52]**, invoices); KPI results (target, M1, M2, M3,
   quarter, YTD, status); challenges (open carries over / resolved); next-quarter targets; operational-plan indicators
   (Done / Carried over); actions Issue (freeze), PDF, PPTX, KPI sheet export.
10. **UI rule:** no hint text, explanatory notes, banners, callouts or demo annotations inside screens (the old app's
    biggest complaint). Every entity (~~company~~ partner **[SUPERSEDED — V52]**, invoice, task, achievement, KPI, report line, person) is a link.

**Owner answers later on 28 Sep.**

11. **Room for the new database:** the free way — the old app's database (`direct-business`) is paused ~~on 1 Oct, after
    the Q3 close of 30 Sep~~ **[SUPERSEDED — V21, V84: it was paused on 28 Sep — the owner does not need the old app; `direct-commercial` was created the same day]**; the old app is unavailable from then (data kept, restorable); the appraisal tool stays live;
    the new project is created on the free plan.
12. **Domain:** the new app uses the same domain, `directksab2b.com`; staging on the new Vercel project's address; ~~at
    go-live~~ **[SUPERSEDED — V13 amended, V84: as soon as the first v2 deployment renders the sign-in page]** the domain moves to the new project and the sign-in settings list it.
13. **Google and Zoom sign-in keys:** later; building proceeds with ~~the emailed code~~ **[SUPERSEDED — V431: email + password]**.

**Owner changes, round 3 (28 Sep, relayed by the oversight)** — decisions V52–V61 in `DECISIONS.md`:

14. ~~**Companies become Partners**, one record with roles Client / Supplier / Strategic partner, and one tab row by role:
    Overview · Finance · Contracts & files · Work · Achievements (the code is renamed too — V52).~~ **[SUPERSEDED — V98: one organisation with two sides, Client and Supplier & partner; V95: one record-page template]**
15. **Logos and avatars** in rows, chips, headers and hover cards (V53).
16. **The partner card's period view** MTD · QTD · YTD · Custom, **Open in Finance** with the filters in the address,
    and saved views (V54).
17. **Files named automatically** from a pattern per kind, computed when shown and used by the download (V55).
18. **Contracts** with start and end dates, a computed status and renewal reminders (V56).
19. **Reports archive**, including the 2024–2026 PDFs, and **compare two periods** (V57).
20. **Live names everywhere**: an issued report freezes its figures but shows people's and partners' current names (V58).
21. **Sign-in**: ~~the emailed code is the door~~ **[SUPERSEDED — V431: email + password for now; the code door switched off]**; ~~keep signed in 30 days~~ **[SUPERSEDED — V74: no "keep me signed in" tick — a device stays signed in until sign-out, and 30 unused days ask for a new code]**; the page shows only the logo **[SUPERSEDED — V75: plus the brand panel and brand line]**, "Commercial
    Workspace", EN | ع and © Direct; never "Direct KSA", "DirectKSA", "Direct Corporate", "B2B" or "MICE"; the
    department is "Commercial"; a real mail sender before real users (V59).
22. **The Direct theme uses the official palette**; every theme has a primary colour for buttons; logo rules (V60).
23. **Patterns**: notification centre, alerts as notifications, hover cards, follow, activity timeline with Undo, saved
    views, bulk actions, "Since your last visit" (V61).

**Oversight rulings, round 4 (28 Sep, from the manager's recorded calls; no names from them enter this repository)** —
V62–V72 in `DECISIONS.md`:

24. ~~**Partner roles are multi-select**, each with its own fields;~~ **[SUPERSEDED — V98: the two sides, each with its own type, tier, fields and owner]** **status** Prospect / Active / At risk / Lost with
    history, reason and last feedback date (per side — V98); a report section on organisations at risk or lost (V62).
25. **Light prospecting**: bulk assign owner and priority in one action; one-click ~~**Log call**~~ **[SUPERSEDED — V401: Log activity, with types and outcomes]** with an outcome; weekly
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
34. **Recurring "Partner feedback" task** per key partner (V72; named "Client feedback" since V98).

**Owner decisions, round 5 (29 Sep, relayed by the oversight)** — V74–V83 in `DECISIONS.md`:

35. **Sessions**: a device stays signed in until sign-out; 30 unused days → a new code; admins sign anyone out; My
    profile lists devices (V74).
36. **Sign-in page**: split layout with a brand panel and the brand line "The commercial arm of the all-in-one travel
    app" / «الذراع التجاري لتطبيق السفر الشامل» (V75).
37. **Arabic reports**: Arabic labels required on every list; Arabic sentence templates per category; an on-device
    "Translate to Arabic" helper, no paid service (V76).
38. **Partner names**: official English and Arabic names and a trade name; the trade name shows everywhere (V77).
39. ~~**Partners page**~~ **[SUPERSEDED — V98: two list pages, Clients and Suppliers & partners]**: saved views across the top; ~~Role ·~~ Type · Owner · Status and a KPI chip; More filters (V78).
40. **Report lines**: achievement lines (create or cite the achievement) and note lines (never count) (V79).
41. **Tenders and the Pipeline** in v1, their KPIs, and one Commercial overview with a segment switch (V80). **[Stages superseded — V99: Contacted → Demo → Proposal (optional) → Signed → Onboarded; Active at Onboarded; a Source on every card]**
42. **Less crowded detail pages**: two columns, empty fields behind "+ Add", Show all (V81). **[Reshaped — V95: the record-page template]**
43. ~~**Design moves to Figma** through a dedicated design session (V82).~~ **[SUPERSEDED — V82 amended 29 Sep: Figma is not used (a view-only seat); the design source is the screens canvas and the design system page, owned by the Design lead session]**
44. **Exports unchanged** for now (V83).

**Oversight update, 28 Sep** — the owner does not need the old app: its database is paused and `direct-commercial`
exists in Supabase and Vercel; the domain moves as soon as v2's sign-in page renders; only the owner pastes keys into
Vercel (V13, V21, V84).

**Oversight audit, 29 Sep** — agreed details the owner found missing; V82 amended and V85–V94 in `DECISIONS.md`:

45. **Phones**: a bottom bar (My day · Tasks · Partners · KPIs · More), details full screen, tables as two-line cards, a
    floating + for quick add; layout rules per breakpoint; the drawer is 232 px pinned / 56 px collapsed everywhere (V85).
46. **Arabic early**: an Arabic PDF/PPTX rendering spike and a check of the browser's built-in translator, in P3/P4 (V86).
47. **Payment type** chip — prepaid · postpaid · code · tender — on Finance lists and the Commercial overview (V87).
48. **From the manager's calls**: call outcomes "demo set" and "demo held" (V88); a "Corporate onboarding" checklist
    (V89); supplier cashback as a typed amount (V90); a "team load" view when assigning (V91); a refused credit is limit
    0, "prepaid only" (V92); KPI leads update their KPI's figures, check-in on the 15th (V93).
49. **Every PR description** lists the V-numbers it implements and states "checked against DECISIONS.md at <commit>"
    (V94).
50. **Figma is not used** (V82 amended): the screens canvas and the design system page, owned by the Design lead
    session, are the design source.

**Owner decisions, round 6 (29 Sep, copied from the oversight)** — V95–V99 and V400–V402 in `DECISIONS.md`:

51. **Record pages**: one template — a header with up to five key figures and the main actions, tabs Overview ·
    Activity · Related · one type tab, a details rail with every custom field; list pages stay lean (V95).
52. **Visibility**: the whole team sees all work; an appraisal only its person, their direct manager and admins (V96).
53. **Settings and access**: the structure in code, everything else a setting; Settings admins-only; Activity out of
    Settings; My profile for everyone with admin defaults; managers act inside records; only admins change access or
    emails; the safety rules (V97).
54. **Clients, and Suppliers & partners**: the two sides of one organisation, replacing roles; the menus and the phone
    bar change with them (V98).
55. **Pipeline stages** Contacted → Demo → Proposal (optional) → Signed → Onboarded; a Source on every card; no Leads
    module; a Direct reference is evidence; an integration counts at handover (V99; closes Q34–Q36).
56. **The dates rule**: `happened_on` on everything that happens, `logged_at` by the system; "logged late" after 14
    days once live; "moved" achievements; issued reports show "N added since issue"; the Past work grid (V400).
57. **The industry-benchmark v1 package**, each item placed in the plan (V401).
58. **Working rules**: the database guard, the bulletproof and landmine checks around every merge, the oversight's
    read-only QA audit (V402).
59. **Reports print in Arabic by default**, with an English copy on request; staff write in either language (V403).
60. **Banned words cover data labels too**: the segment is "Government" (V404).
61. **"Responsible" / «المسؤول»** is the KPI lead's name on screen, a wording setting (V405).
62. **From the manager's calls, round 7**: "demo set" creates the demo task on its date with the manager as helper
    (V406); an integration achievement carries the Direct ticket number as its evidence (V407); pilot training is one
    live session, then a short video every three or four updates (V408).
63. **The Supplier & partner side keeps the portal link and the username**, never passwords (V409).
64. **Two more lanes**: builder C (Arabic, exports, the Past work grid; V300–V399) and the QA session (no V range)
    (V410). No Leads module in v1; a Leads inbox may come later if volume needs it (V99).
65. **The Scout's old-app review** (oversight rulings V411–V425; the owner may reverse any): a closed client ID keeps its
    past rows; name exclusions and aliases only where there is no client ID; a VAT/CR exclusion catches the whole
    organisation; Loss flagged and counted; the invoice's own due date first; split receipts; DPIN uniqueness checked
    on real data; MF10 read as "only paid units count"; no "profit with estimates"; and, pending the owner: an unknown
    client ID stops in Needs a decision, names only suggest, one open prepaid and one open postpaid ID, credit notes
    never count, the "Not yet invoiced: Ready / Pending" line, the at-risk band at 0.85.
66. **The old app's lessons as house rules** (V426–V430): forms show the stored value and send only changes; a network
    failure never says "saved"; nothing on screen is invented; every period slot drawn; one bad record costs one row;
    exports never drop a column; reads write nothing; every deployed function's source in its PR; nothing in the cloud
    but by migration; an outsider check in every audit; the build ID confirms every merge; a backup is never restored
    over live tables; every read pages to the end; imports never revive a deleted row; a check that could not run says
    so; a missing cost is empty; printed parts reconcile; every old door closed and one restore drill before go-live;
    a test reads its setup back.
67. **Sign-in is email + password for now** (V431): admins set and reset passwords in Settings → People, no mail is
    sent, "Forgot your password? Ask your admin.", a first sign-in changes the password, 10 characters at least; the code
    door stays in the code, switched off.
68. **The domain moved** on 29 Sep; production builds only from `v2/main`, no PR previews (V432).
69. **My day: Capture, then Convert** — one Note item (sticky, meeting, checklist), private by default; Turn into a
    task, action item, achievement, logged meeting or call, or reminder, linked both ways; Finish meeting; Wrap up
    today; tabs Me · My team · Workspace; 5–7 rows per block (V433).
70. **The Scout's money rulings are ACTIVE**, their numbers and switches admin settings (V434).
71. **Also applied, changeable**: the SOP/SLA library stays in Drive, linked (V435); contact authority and a re-confirm
    date on contact roles (V436); Academies is a service, not a segment (V437); subtasks are checklists inside a task,
    categories are the task-type setting, dependencies later (V438).
72. **Shell rules for every session** (V439).
73. **People are added through the app** by the oversight, never seeded; the first admin and the department once by
    builder A; the list stays in the owner's private knowledge base (V440).
74. **Temporary passwords are generated, never typed**: per person, or for everyone without one; shown once with Copy;
    changed at first sign-in (V441).
75. **View as** — an admin previews the app as any person, read-only, with a banner and Exit, every start and stop
    logged, writes refused server-side; off at go-live (V442, the oversight's proposal; the owner may veto).
76. **Ten people** (twelve sign-ins), the owner's separate admin account and one test account, neither a team member; the owner types
    each temporary password once; all changed before go-live (V443–V446).
77. **Hard testing** on production through the test account and View as, on localhost with fixture users of every
    role (V447).
78. **The Supplier & partner types are the owner's seven** (V448); **pace bands 90 / 70** (V449); **Supplier & partner
    statuses Prospect · Active · On hold · Ended** (V450) — all admin-editable.
79. **The owner's three accounts came from the Supabase dashboard**; Generate links to an existing sign-in, never
    duplicates or overwrites it without a confirmed action (V451).
80. **The oversight's scenario catalogue** (V452–V461, each unless the owner says no): leaving in one request; View as
    writes nothing and never views an admin; private notes author-only; reminders on time; assigned and helper notices
    always sent; a locked "Handed to Product" stage; money Provisional while any expense is pending, masked for readers
    without Finance, appraisal items computed for all, Exclude admin-only; one on-time cut-off, a reading's period is
    its start, moves need a reason; appraisals follow manager changes and lock for leavers; an MoU never overwrites a
    status; no future invoice dates.
81. **The Scout's old-app comparison** (V462–V470, each unless the owner says no): access re-read on focus and every
    90 s; a switch-off refused while open work exists unless reassigned in the same request, a head needing a successor;
    the default owner chain; an active check on every person picker; client work needs an organisation or a project; an
    achievement from a closed task is the owner's; the admin account creates no work; IBAN letters restricted; fail
    closed while levels load. The catalogue itself: `SCENARIOS.csv`, `SCENARIOS-OLD.csv`, `SCENARIOS.md`.

**Finance finding (the oversight's read-only sample of Payments, 28 Sep)** — the unit of revenue is the transaction
invoice (a standalone invoice with no consolidation link counts as itself); billing invoices re-bill transactions and
are excluded from revenue, and collections are settled on them; cost is the sum of approved expenses on the
transaction, and invoice line names are not a reliable cost (kept only as a flagged fallback estimate); the DPIN tax
invoice (child of the billing or direct invoice) equals the total minus approved expenses and is used as the check —
cost Provisional while an expense is pending or none is registered (commission-only excepted), Final once the DPIN
exists, "expenses missing" when the DPIN is 100 % of a non-commission total, and a billing total must equal the sum of
its transactions. VAT is never shown; profit = revenue − cost as recorded. Details: `TECH-SPEC.md` §3.6.
