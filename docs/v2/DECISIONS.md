# v2 decisions in force

The rules binding on the v2 build, one short paragraph each — the v2 counterpart of `docs/DECISIONS.md`, whose old
rules stay binding where `TECH-SPEC.md` §12 says so. Same shape: `**ID — title** STATUS · date. body`; the owner's
words in double quotes; the long story in the commit. Whoever learns a rule writes it here in the same commit as the
change that taught it.

**ID ranges** (so two builders never collide — spec A18): V1–V99 architect and oversight · V100–V199 builder A ·
V200–V299 builder B. A ruled open question of the first round keeps its number inside its ID: question Qn (Q1–Q31) became
**V(20+n)** (Q7 → V27), so an old "Q7" still finds its answer here. Later questions (Q32 on) take the next free V
number when ruled, and the decision names its question.

## Owner decisions, 28 Sep 2026 (relayed by the oversight)

**V1 — The transaction is the unit of revenue** ACTIVE · 2026-09-28. Billing invoices (`is_consolidated`) re-bill transactions and never count as revenue; collections are settled on them. Cost = approved expenses on the transaction; line names are only a flagged estimate. The DPIN (child of the billing or standalone invoice) = total − approved expenses and is the check: cost Provisional while an expense is pending or none is registered (commission-only excepted), Final once the DPIN exists; "expenses missing" when the DPIN is 100 % of a non-commission total; a billing total must equal its transactions. Refines D26: the transaction is counted, the billing invoice is the zero-revenue link. Spec §3.6.

**V2 — Sign-in: one person, several allowed emails, no passwords** ACTIVE · 2026-09-28, amended by V59 the same day (the emailed code is now the door; Google for .com and Zoom for .net become later shortcuts). No passwords. A person holds one or more allowed emails; the provider-verified email must match an allowed email of an active person, else access is denied; identities link to that person and never create people; every sign-in is logged. Spec §4.

**V3 — The online appraisal tool wins over the Excel form** ACTIVE · 2026-09-28. Templates are seeded from the tool (weights 70/25/5, its grade scale, points tables and items), gaps filled from the form; everything stays a setting. The tool's data comes only as an export the owner hands over, kept out of the repository (rules 7 and 8), loaded by a person through the importer. Spec §3.10.

**V4 — "Commercial total revenue" never blocks** ACTIVE · 2026-09-28. Its definition is a Finance setting; the value is decided at go-live (together with V51).

**V5 — Go-live = code and structure proven; invoices typed first** ACTIVE · 2026-09-28. The team types the 2026 invoices in a fast, first-class entry screen (lines, expenses, DPIN, cost status Provisional/Final); imports are a later phase (plan P7). Spec §7.

**V6 — Environments: free tier preferred, any cost flagged** ACTIVE · 2026-09-28. The owner approves creating the new Supabase and Vercel projects. Spec §10.

**V7 — A fourth theme, "Direct"** REPLACED by V60 · 2026-09-28. Orange and charcoal beside Light, Dark and Colorful; its first values were replaced the same day by the official palette (V60).

**V8 — Comfortable density by default** ACTIVE · 2026-09-28. 14 px body, 40 px controls, 44–52 px table rows, 24–32 px between sections; Compact (32 px rows) is a per-person choice. "Nothing cramped, especially My day." Replaces v0.7's "dense tables (32px rows)" as the default.

**V9 — "My profile" for every person** ACTIVE · 2026-09-28. First in Settings; each person edits their own: photo or initials with a colour, full name, display name / nickname, badge (none / icon / zodiac sign), theme, density, language, start page, drawer, notification choices. Shown in the top bar, the drawer foot and owner/helper chips. Partner logos upload on the partner record (V53). Spec §3.1, §3.4.

**V10 — Reports: one tab row, Monthly · Quarterly** ACTIVE · 2026-09-28. The quarterly report's sections and actions: spec §3.9 and the canvas's QuarterlyReport.

**V11 — Screens carry data and controls only; every entity is a link** ACTIVE · 2026-09-28. No hint text, explanatory notes, banners, callouts or demo annotations inside screens ("the old app's biggest complaint"). Every partner, invoice, task, achievement, KPI, report line and person is a link. Spec §2.5, rule A19.

**V13 — The same domain, moved at go-live** ACTIVE · 2026-09-28. v2 uses `directksab2b.com`. Staging runs on the new Vercel project's `vercel.app` address; at go-live the domain moves from the old Vercel project to the new one, and the Supabase Auth site URL and redirect URLs (and any OAuth origins) list it. Spec §10, plan P6-8.

**V21 — Free plan: the old app's database is paused on 1 Oct** ACTIVE · 2026-09-28. The owner chose the free way, pausing `direct-business` (the old app), not the appraisal tool: the oversight pauses it on 1 Oct after the Q3 close of 30 Sep; from then the old app is unavailable (data kept, restorable). `directksa-performance` stays live. The oversight then creates `direct-commercial` on the free plan. (Was Q1.)

**V23 — Google and Zoom keys: later** DEFERRED · 2026-09-28. P3-2 proceeds with the emailed code; since V59 Google and Zoom are optional shortcuts, built when their keys arrive. (Was Q3.)

## Oversight rulings, 28 Sep 2026 (delegated by the owner)

**V12 — v2 merges into `v2/main`, never into the default branch** ACTIVE · 2026-09-28. Merging into the default branch redeploys the frozen old app to production. `v2/main` was created from the default branch on 28 Sep; builders branch from it.

**V22 — Backups: the paid plan at go-live, not before** ACTIVE · 2026-09-28. Until then only trial values are in the database. (Was Q2.)

**V24 — Emailed codes via Resend's free tier** ACTIVE · 2026-09-28. Sending from a sub-domain such as `auth.directksa.com` with its DNS records; needed before any real user signs in (V59) — until then staging uses Supabase's built-in sender, which reaches only the owner. (Was Q4.)

**V25 — Words: "Sales (GMV)" and "Margin"** ACTIVE · 2026-09-28. Screens say Sales (GMV) for the invoice total less top-ups (D21's figure) and Margin for it minus approved cost; no money rule changes. (Was Q5.)

**V26 — Everyone edits partner details; money-moving changes are held back** ACTIVE · 2026-09-28. Details, roles, contracts, contacts, notes and files: everyone (D7). Identifiers: managers, the head, admins. Merging and changing the account manager: the head and admins. (Was Q6.)

**V27 — Credit follows the account manager on the invoice's paid date** ACTIVE · 2026-09-28. Invoices paid before the effective date stay with the old manager; a manager may split or reassign one invoice with a note. (Was Q7.)

**V28 — A discount code matches on the invoice's creation (booking) date** ACTIVE · 2026-09-28. (Was Q8; the old app used the paid date.)

**V29 — A pin is the last resort for a conflict** ACTIVE · 2026-09-28. First move the wrong clue or merge; else "these rows belong to partner A" with a reason, logged, undoable, pin-marked. (Was Q9.)

**V30 — Individuals count, credited to nobody, listed apart** ACTIVE · 2026-09-28. (Was Q10; D25.)

**V31 — Last year's figures are typed once until imports bring history** ACTIVE · 2026-09-28. Per-KPI readings for last year's months; a partner can be marked "client before 2026"; Payments history from 1 January 2025 replaces both in the import phase. (Was Q11.)

**V32 — Values that never become identifiers** ACTIVE · 2026-09-28. Every address at directksa.com and directksa.net (and sub-domains), the Payments test VAT, and any customer name the owner lists as a test; the list is a setting. (Was Q12.)

**V33 — Achievements without a proof file count, flagged "no evidence yet"** ACTIVE · 2026-09-28. On the KPI page and in the KPI sheet. (Was Q13.)

**V34 — Report layout source: the issued PDFs and the artboards** ACTIVE · 2026-09-28. No PowerPoint templates are known. The layout comes from the department's issued monthly report PDFs in Drive (folder `1A5ua72_qosteLvSn22XdWgUFD9vZEqhl`, 2025; January 2026 in `12F8bnr6WqxQdJvu2PB9s6TKRG8vFi0rj`) and the canvas's MonthlyReport and QuarterlyReport artboards; the PPTX is generated to that layout until the owner supplies a template. The PDFs hold real figures — they are read, never copied into the repository. (Was Q14.)

**V35 — The KPI sheet export follows "Departmental KPIs 2026"** ACTIVE · 2026-09-28. The Google Sheet `1APdUbCPTftCxvfkqUq8m4Zl7fIZXF94rn6CQOTIZwCE` (28 KPIs). Columns, in order: No. · Objective indicators · Link to Departmental Objectives · Unit · Base Year · Baseline value · Achieved up to 2025 · 2026 · Target 2026 · Target Q1-2026 … Target Q4-2026 · Achieved Q1-2026 … Achieved Q4-2026 · Total 2026 · Status · Owners · Update · date. It holds staff names: never committed, only its column layout is described. (Was Q15.)

**V36 — A report correction keeps the issued report and supersedes it** ACTIVE · 2026-09-28. Achievements behind an issued report may be corrected by a manager with a reason; the report shows the drift and a correction is issued (both readable). (Was Q16.)

**V37 — Achievements and challenges live inside KPIs** ACTIVE · 2026-09-28. Views KPIs · Achievements · Challenges; reviewed after a month of use. (Was Q17.)

**V38 — A next-month target becomes a task at once** ACTIVE · 2026-09-28. Owned by the person named, due the end of next month; the next report shows it done or carried over. (Was Q18.)

**V39 — Operational-plan indicators are checklist KPIs** ACTIVE · 2026-09-28. Grouped under their own objective in the yearly plan. (Was Q19.)

**V40 — Gregorian dates and Latin digits in both languages** ACTIVE · 2026-09-28. (Was Q20.)

**V41 — Partner categories and tiers are typed by the owner in Settings** ACTIVE · 2026-09-28. Not blocking. (Was Q21.)

**V42 — Appraisal details, where the tool does not say** ACTIVE · 2026-09-28. The tool overrides each of these where it speaks: the manager's evaluation counts (self beside it); cap 120 %; escalations: more is better; "on-time reports" = achievements and updates logged before the report's cut-off day; "weekly updates" = weeks (Sunday–Thursday) with an update on each task in progress; visible to the person, the evaluator, the reporting line and admins; personal targets entered by the manager at cycle start; MF5 exclusions apply to appraisal figures too. (Was Q22.)

**V43 — Past appraisals from the tool's export; ClickUp once** ACTIVE · 2026-09-28. The owner's export seeds the templates and brings the last two cycles as read-only "legacy"; ClickUp's KPI records imported once, then ClickUp stops for them; nothing from the old app's tasks is moved (D9). (Was Q23.)

**V44 — Imports and jobs act as "Import" and "System"** ACTIVE · 2026-09-28. Two named persons that cannot sign in; never a real login (replaces D13's QA-account attribution for v2). (Was Q24.)

**V45 — Notifications in the app only for v1** ACTIVE · 2026-09-28. Email later, once V24's sender exists. (Was Q25.)

**V46 — Vercel's free plan for now** ACTIVE · 2026-09-28. The paid plan only if Vercel asks. (Was Q26.)

**V47 — v2 lives in this repository, folder `v2/`** ACTIVE · 2026-09-28. With its own branch (V12); public, so rule 7 applies exactly as today. (Was Q27.)

**V48 — No main-builder handover note exists** CLOSED · 2026-09-28. It was never written (the owner denied its last approval); the production branch's code is the source for that builder's work. (Was Q28.)

**V49 — Everyone types invoices; a typist may pin a partner** ACTIVE · 2026-09-28. Everyone in Commercial types invoices and edits their own; managers correct anyone's; a customer with no partner may be pinned by the typist, and its details go to a manager as a suggested identifier. (Was Q29.)

**V50 — A person may adopt a typed invoice so imports keep it current** ACTIVE · 2026-09-28. (Was Q30.)

**V51 — VAT inside the margin: decided at go-live** DEFERRED · 2026-09-28. Until then the margin is kept as recorded (D21); decided with the revenue definition (V4). (Was Q31.)

## Owner changes, round 3, 28 Sep 2026 (relayed by the oversight)

**V52 — Companies become Partners, with roles; the schema is renamed too** ACTIVE · 2026-09-28. One record per organisation, holding one or more roles — Client, Supplier, Strategic partner (sub-kinds sales channel, integration, payment solution) — each role with its stage. The partner card has one tab row, Overview · Finance · Contracts & files · Work · Achievements, a tab shown only when it applies, and each role adds its section to Overview (the role's setting). The owner left "schema or screens only" to the architect: **the schema is renamed as well** (`partner.*`, routes `/partners`), because nothing is built yet and one word in code and screens avoids a translation layer forever. The partner ID is `DK-P-0000` (a setting). Panel and full page carry the same header and actions (New task, Log achievement, New project) and tab counts. Spec §3.4.

**V53 — Logos and avatars everywhere** ACTIVE · 2026-09-28. A partner's logo (SVG or PNG, at least 256 px; else its monogram, or a blank tile by setting) and a person's avatar, nickname and badge show in rows, chips, headers and hover cards. Spec §3.4, §2.5.

**V54 — The partner card's period view, deep links and saved views** ACTIVE · 2026-09-28. A switch MTD · QTD · YTD · Custom; tiles against the same period last year and a Q1–Q4 strip this year against last; **Open in Finance** carries the partner, period and kind in the URL, so Finance shows the same figures; every Finance filter lives in the URL; saved views (personal or shared) on every list. The tiles use V25's words (Sales (GMV), Cost, Margin) where the canvas says Revenue / Profit — see Q33. Spec §3.4, §6.

**V55 — Files are named automatically, live** ACTIVE · 2026-09-28. Each file kind has a name pattern (a setting, with a live preview: invoice, contract, agreement, rate sheet, certificate, meeting note …); the name is computed when shown, from the records the file is linked to, so a renamed partner renames its files; downloads save under it (Content-Disposition); the original name is kept on record. Spec §3.4.

**V56 — Contracts with dates, computed status and renewal reminders** ACTIVE · 2026-09-28. Start and end dates; status Active / Expires in N days (from 30 days) / Expired / Not started, never stored; reminders 60 · 30 · 7 days before the end (a setting; per contract on/off or its own days) to the account manager, followers and, by setting, the commercial manager; the first reminder makes the renewal task. Terms before → after sit on the contract, each linked to its achievement. Spec §3.4.

**V57 — The reports archive, legacy PDFs and compare** ACTIVE · 2026-09-28. The Reports landing lists every monthly and quarterly report by year, with status Draft / Issued / Legacy PDF; the department's issued PDFs of 2024–2026 are loaded once (kind, period, headline figures typed, section pages) and stay in Storage, never in the repository; any two reports compare side by side. Spec §3.9.

**V58 — Names are live everywhere, even in issued reports** ACTIVE · 2026-09-28. An issued report freezes figures and wording, but people and partners in it are entity tokens rendered with the current name; the hash covers the tokens, so a rename changes no figure and no hash. FLOW-10 tests it. Spec §3.3, §3.9.

**V59 — Sign-in: the emailed code is the door** ACTIVE · 2026-09-28. Email, then a 6-digit code, and "keep me signed in" for 30 days (enforced by the app). The page shows only the official logo, "Commercial Workspace" / "مساحة العمل التجارية", EN | ع and © Direct. The department is "Commercial" / "الإدارة التجارية". Never in the app's wording: "Direct KSA", "DirectKSA", "Direct Corporate", "B2B", "MICE" (a check enforces it). A real sender (V24) is needed before real users; staging may use Supabase's built-in sender for the owner. Amends V2. Spec §4.

**V60 — The Direct theme uses the official palette; every theme has a primary** ACTIVE · 2026-09-28. Replaces V7's values: slate `#323E48` navigation, orange `#F06820` accent (a fill or mark only, never text, never under a label), primary `#C94C14` for filled buttons with white labels (4.64:1), link `#B5490E`. `--primary`, `--primary-hover` and `--on-primary` exist in all four themes. The official logo is never recoloured: slate wordmark on light, white on dark or slate. Values: BUILD-PLAN "Design tokens".

**V61 — Shared patterns** ACTIVE · 2026-09-28. A notification centre (All · Mentions · Assigned to me, by day, mark all read, snooze); alerts arrive as notifications (contract expiring, invoice unpaid past 45 days, KPI behind pace) from one daily job; hover cards for people and partners; Follow on any record, notifying followers; an activity timeline with Undo on every record; saved views; bulk actions as one request and one Undo; "Since your last visit" on My day. Spec §3.3, §6.
