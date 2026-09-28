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

**V13 — The same domain, moved as soon as v2's sign-in page renders** ACTIVE · 2026-09-28, amended the same day (V84). v2 uses `directksab2b.com`. The old app no longer runs, so the domain moves from the old Vercel project to `direct-commercial` as soon as the first v2 deployment renders the sign-in page (plan P3-2), not at go-live; the Supabase Auth site URL and redirect URLs (and any OAuth origins) list it. Spec §10.

**V21 — Free plan: the old app's database is paused** DONE · 2026-09-28. The owner chose the free way, pausing `direct-business` (the old app), not the appraisal tool. Planned for 1 Oct, it was done on 28 Sep, since the owner does not need the old app at all (V84): the old app is unavailable (data kept, restorable). `directksa-performance` stays live; `direct-commercial` was created on the free plan. (Was Q1.)

**V23 — Google and Zoom keys: later** DEFERRED · 2026-09-28. P3-2 proceeds with the emailed code; since V59 Google and Zoom are optional shortcuts, built when their keys arrive. (Was Q3.)

## Oversight rulings, 28 Sep 2026 (delegated by the owner)

**V12 — v2 merges into `v2/main`, never into the default branch** ACTIVE · 2026-09-28. Merging into the default branch redeploys the frozen old app to production. `v2/main` was created from the default branch on 28 Sep; builders branch from it.

**V22 — Backups: the paid plan at go-live, not before** ACTIVE · 2026-09-28. Until then only trial values are in the database. (Was Q2.)

**V24 — Emailed codes via Resend's free tier** ACTIVE · 2026-09-28. Sending from a sub-domain such as `auth.directksa.com` with its DNS records; needed before any real user signs in (V59) — until then staging uses Supabase's built-in sender, which reaches only the owner. (Was Q4.)

**V25 — Words: "Sales (GMV)" and "Margin"** REPLACED by V73 · 2026-09-28. Screens were to say Sales (GMV) for the invoice total less top-ups (D21's figure) and Margin for it minus approved cost; the owner's words won (V73); no money rule changed. (Was Q5.)

**V26 — Everyone edits partner details; money-moving changes are held back** ACTIVE · 2026-09-28. Details, roles, contracts, contacts, notes and files: everyone (D7). Identifiers: managers, the head, admins. Merging and changing the account manager: the head and admins. (Was Q6.)

**V27 — Credit follows the account manager on the invoice's paid date** ACTIVE · 2026-09-28. Invoices paid before the effective date stay with the old manager; a manager may split or reassign one invoice with a note. (Was Q7.)

**V28 — A discount code matches on the invoice's creation (booking) date** ACTIVE · 2026-09-28. (Was Q8; the old app used the paid date.)

**V29 — A pin is the last resort for a conflict** ACTIVE · 2026-09-28. First move the wrong clue or merge; else "these rows belong to partner A" with a reason, logged, undoable, pin-marked. (Was Q9.)

**V30 — Individuals count, credited to nobody, listed apart** ACTIVE · 2026-09-28. Campaign codes are treated the same way (V65). (Was Q10; D25.)

**V31 — Last year's figures are typed once until imports bring history** ACTIVE · 2026-09-28. Per-KPI readings for last year's months; a partner can be marked "client before 2026"; Payments history from 1 January 2025 replaces both in the import phase. (Was Q11.)

**V32 — Values that never become identifiers** ACTIVE · 2026-09-28. Every address at directksa.com and directksa.net (and sub-domains), the Payments test VAT, and any customer name the owner lists as a test; the list is a setting. (Was Q12.)

**V33 — Achievements without a proof file count, flagged "no evidence yet"** ACTIVE · 2026-09-28. On the KPI page and in the KPI sheet — not in appraisals, where V68 is stricter. (Was Q13.)

**V34 — Report layout source: the issued PDFs and the artboards** ACTIVE · 2026-09-28. No PowerPoint templates are known. The layout comes from the department's issued monthly report PDFs in Drive (folder `1A5ua72_qosteLvSn22XdWgUFD9vZEqhl`, 2025; January 2026 in `12F8bnr6WqxQdJvu2PB9s6TKRG8vFi0rj`) and the canvas's MonthlyReport and QuarterlyReport artboards; the PPTX is generated to that layout until the owner supplies a template. The PDFs hold real figures — they are read, never copied into the repository. (Was Q14.)

**V35 — The KPI sheet export follows "Departmental KPIs 2026"** ACTIVE · 2026-09-28. The Google Sheet `1APdUbCPTftCxvfkqUq8m4Zl7fIZXF94rn6CQOTIZwCE` (28 KPIs). Columns, in order: No. · Objective indicators · Link to Departmental Objectives · Unit · Base Year · Baseline value · Achieved up to 2025 · 2026 · Target 2026 · Target Q1-2026 … Target Q4-2026 · Achieved Q1-2026 … Achieved Q4-2026 · Total 2026 · Status · Owners · Update · date. It holds staff names: never committed, only its column layout is described. (Was Q15.)

**V36 — A report correction keeps the issued report and supersedes it** ACTIVE · 2026-09-28. Achievements behind an issued report may be corrected by a manager with a reason; the report shows the drift and a correction is issued (both readable). (Was Q16.)

**V37 — Achievements and challenges live inside KPIs** ACTIVE · 2026-09-28. Views KPIs · Achievements · Challenges; reviewed after a month of use. (Was Q17.)

**V38 — A next-month target becomes a task at once** ACTIVE · 2026-09-28. Owned by the person named, due the end of next month; the next report shows it done or carried over. (Was Q18.)

**V39 — Operational-plan indicators are checklist KPIs** ACTIVE · 2026-09-28. Grouped under their own objective in the yearly plan. (Was Q19.)

**V40 — Gregorian dates and Latin digits in both languages** ACTIVE · 2026-09-28. (Was Q20.)

**V41 — Partner categories and tiers are typed by the owner in Settings** ACTIVE · 2026-09-28. Not blocking. (Was Q21.)

**V42 — Appraisal details, where the tool does not say** ACTIVE · 2026-09-28. The tool overrides each of these where it speaks: the manager's evaluation counts (self beside it); cap 120 %; escalations: more is better; "on-time reports" = achievements and updates logged before the report's cut-off day; "weekly updates" = weeks (Sunday–Thursday) with an update on each task in progress (the item "weekly pipeline / task updates" also counts logged calls — V63); visible to the person, the evaluator, the reporting line and admins; personal targets entered by the manager at cycle start; MF5 exclusions apply to appraisal figures too. (Was Q22.)

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

**V54 — The partner card's period view, deep links and saved views** ACTIVE · 2026-09-28. A switch MTD · QTD · YTD · Custom; tiles against the same period last year and a Q1–Q4 strip this year against last; **Open in Finance** carries the partner, period and kind in the URL, so Finance shows the same figures; every Finance filter lives in the URL; saved views (personal or shared) on every list. The tiles say Revenue · Cost · Profit (V73). Spec §3.4, §6.

**V55 — Files are named automatically, live** ACTIVE · 2026-09-28. Each file kind has a name pattern (a setting, with a live preview: invoice, contract, agreement, rate sheet, certificate, meeting note …); the name is computed when shown, from the records the file is linked to, so a renamed partner renames its files; downloads save under it (Content-Disposition); the original name is kept on record. Spec §3.4.

**V56 — Contracts with dates, computed status and renewal reminders** ACTIVE · 2026-09-28. Start and end dates; status Active / Expires in N days (from 30 days) / Expired / Not started, never stored; reminders 60 · 30 · 7 days before the end (a setting; per contract on/off or its own days) to the account manager, followers and, by setting, the commercial manager; the first reminder makes the renewal task. Terms before → after sit on the contract, each linked to its achievement. Spec §3.4.

**V57 — The reports archive, legacy PDFs and compare** ACTIVE · 2026-09-28. The Reports landing lists every monthly and quarterly report by year, with status Draft / Issued / Legacy PDF; the department's issued PDFs of 2024–2026 are loaded once (kind, period, headline figures typed, section pages) and stay in Storage, never in the repository; any two reports compare side by side. Spec §3.9.

**V58 — Names are live everywhere, even in issued reports** ACTIVE · 2026-09-28. An issued report freezes figures and wording, but people and partners in it are entity tokens rendered with the current name; the hash covers the tokens, so a rename changes no figure and no hash. FLOW-10 tests it. Spec §3.3, §3.9.

**V59 — Sign-in: the emailed code is the door** ACTIVE · 2026-09-28, amended by V74 and V75 on 29 Sep. Email, then a 6-digit code (the 30-day "keep me signed in" tick is replaced by V74's device sessions). The page shows only the official logo, "Commercial Workspace" / "مساحة العمل التجارية", EN | ع and © Direct. The department is "Commercial" / "الإدارة التجارية". Never in the app's wording: "Direct KSA", "DirectKSA", "Direct Corporate", "B2B", "MICE" (a check enforces it). A real sender (V24) is needed before real users; staging may use Supabase's built-in sender for the owner. Amends V2. Spec §4.

**V60 — The Direct theme uses the official palette; every theme has a primary** ACTIVE · 2026-09-28. Replaces V7's values: slate `#323E48` navigation, orange `#F06820` accent (a fill or mark only, never text, never under a label), primary `#C94C14` for filled buttons with white labels (4.64:1), link `#B5490E`. `--primary`, `--primary-hover` and `--on-primary` exist in all four themes. The official logo is never recoloured: slate wordmark on light, white on dark or slate. Values: BUILD-PLAN "Design tokens".

**V61 — Shared patterns** ACTIVE · 2026-09-28. A notification centre (All · Mentions · Assigned to me, by day, mark all read, snooze); alerts arrive as notifications (contract expiring, invoice unpaid past 45 days, KPI behind pace) from one daily job; hover cards for people and partners; Follow on any record, notifying followers; an activity timeline with Undo on every record; saved views; bulk actions as one request and one Undo; "Since your last visit" on My day. Spec §3.3, §6.

## Oversight rulings, round 4, 28 Sep 2026 (from the manager's recorded calls)

The calls are an internal file with real names: nothing from them enters this repository except the rules below; every
example uses made-up names.

**V62 — Partner roles are multi-select; partner status has a history** ACTIVE · 2026-09-28. Roles sit in a link table and each role may carry its own fields (a setting). Status Prospect / Active / At risk / Lost, each change with an effective date and, for at risk and lost, a reason from a settings list; the last feedback date beside it; an "At risk" chip; a report section "Partners at risk / lost — top reasons" in the monthly and quarterly reports. Refines V52 (the role "stage" becomes a role field). Spec §3.4, §3.9.

**V63 — Light prospecting in v1, no Leads module** ACTIVE · 2026-09-28. A prospect is a partner with status Prospect. A manager bulk-assigns a list of partners (owner and priority) in one action and one Undo; a manager may assign to partners with no revenue, while changing the account manager where revenue exists stays with the head and admins (V26, V27). "Log call" is one click with an outcome from a settings list, needs no open task, and lands on the partner's timeline. Calls and task updates per person per week feed the appraisal item "weekly pipeline / task updates". Spec §3.4, §3.8.

**V64 — Segment** ACTIVE · 2026-09-28. A settings list (e.g. Government (B2G) · Corporate · Agencies · Individuals); the default is on the partner, overridable on a project and on an invoice (invoice → project → partner); revenue and KPIs can split by segment. Spec §3.4, §3.6.

**V65 — Discount codes carry terms; campaign codes** ACTIVE · 2026-09-28. Terms: percent of the service fee, scope (services, countries), volume tiers, review date, approved by — with history. One live code per partner by default (a second needs a manager and a reason). A campaign code, for short trials, is credited to no partner and listed apart, like individuals (V30). Finance shows sales by code by month. Spec §3.4, §3.5.

**V66 — Achievement categories with typed amounts; MoU; Awards** ACTIVE · 2026-09-28. Problem solving and Cost savings: exposure, actual loss, avoided (= exposure − actual), counter-party, a one-line story — typed amounts, never Finance money, never feeding a money KPI (the check stays). MoU / strategic signing: counter-party, their signatory and title, our signatory, event, signing date, announced, government or private — never a new client; after signing the partner becomes Prospect (unless Active). Awards: an optional entry cost. Spec §3.8.

**V67 — Reports: Cases, non-money lines, search** ACTIVE · 2026-09-28. The quarterly section "Cases" shows the achievements flagged "use as example" (one per quarter by default) with exposure, actual, avoided and the story. A line may show a non-money amount from its cited achievements, labelled "not revenue", drilling to their fields and evidence. Full-text search across issued reports and their lines. Spec §3.9.

**V68 — Appraisal: self-registration before the manager's review** ACTIVE · 2026-09-28. Each person sees "my achievements in this cycle" and completes them; missing date or evidence is flagged, and such items never count in the appraisal. Default cycle label "2026-27". ClickUp items without date or evidence import as legacy only. Spec §3.10.

**V69 — Challenges record escalation** ACTIVE · 2026-09-28. A critical challenge keeps who it was escalated to and when; it feeds the appraisal item "documenting and escalating critical client feedback". Spec §3.8.

**V70 — Partner finance: credit limit, wallet balance, sent to legal** ACTIVE · 2026-09-28. The credit limit Payments already enforces is mirrored with its history and approver, and outstanding is shown against it; the prepaid (wallet) balance = top-ups − consumption; a receivable can be flagged "sent to legal" with a note. Out of v1, recorded: guarantees (promissory notes), supplier payables and statements, referral terms. Spec §3.4, §3.6, §11.

**V71 — Go-live is a staged pilot** ACTIVE · 2026-09-28. A small group first (including Finance colleagues with read access to Finance), then everyone, on the owner's word. Spec §11, plan P6-8.

**V72 — A recurring "Partner feedback" task per key partner** ACTIVE · 2026-09-28. Using the recurring templates; owned by the account manager; its feedback note sets the last feedback date. Spec §3.7.

## Oversight answers, 28 Sep 2026 (after round 4)

**V73 — Screens use the owner's money words: Revenue · Cost · Profit** ACTIVE · 2026-09-28. The owner uses these words, so every screen, report and export says Revenue (the invoice total less top-ups, D21's figure), Cost (approved expenses) and Profit (revenue − cost, Final cost only). The labels are wording settings (`core.wording`), changeable without code; code keeps `revenue` and `margin`; the KPI mapping and the KPI sheet may call revenue GMV where the strategy team's sheet does. Replaces V25's words; no money rule changes. (Was Q33.)

## Owner decisions, round 5, 29 Sep 2026 (relayed by the oversight)

**V74 — Devices stay signed in until sign-out** ACTIVE · 2026-09-29. A device unused for 30 days must re-verify with an emailed code; an admin can sign anyone out; My profile lists the person's signed-in devices, each with its own sign-out. Replaces V59's 30-day tick. Spec §4.

**V75 — The sign-in page is split, with a brand line** ACTIVE · 2026-09-29. Form on the right (left-to-right; mirrored in Arabic), brand panel on the left (Direct slate, a subtle flight-path pattern from the logo's plane, the logo), a top band on phones. Under the logo: EN "The commercial arm of the all-in-one travel app" / AR «الذراع التجاري لتطبيق السفر الشامل». The title stays "Commercial Workspace" / "مساحة العمل التجارية". Artwork from the design session. Amends V59's page copy. Spec §4.

**V76 — Reports in Arabic** ACTIVE · 2026-09-29. Every settings list (categories, KPI names, segments, statuses, roles, stages …) carries a required Arabic label beside the English. Each achievement category has an Arabic sentence template filled from its fields, so report lines draft themselves in Arabic. Free text: a "Translate to Arabic" helper using the browser's built-in on-device Translator API (Chrome; free, nothing leaves the device) makes a draft the editor corrects; the button is hidden where the API is unavailable. No paid translation service. Spec §3.0, §3.8, §3.9.

**V77 — Partner names: official and trade** ACTIVE · 2026-09-29. Official English name, official Arabic name, and a trade name in English and Arabic. The trade name is the display name everywhere; the official names are used where legal (contracts, tenders, tax matching); all stay matching identifiers. Spec §3.4.

**V78 — One Partners page with saved views and a KPI filter** ACTIVE · 2026-09-29. One record per organisation; saved views across the top (All · Clients · Suppliers · Strategic · Government), a default view per person; visible chips Role · Segment · Owner · Status plus one KPI chip (objective → KPI, a period — this quarter by default — keeping the partners that contributed through achievements or invoices); everything else under More filters; any combination saves as a view; the KPI page links to the same list. Spec §3.4, §6.

**V79 — Two kinds of report line** ACTIVE · 2026-09-29. An achievement line is typed in the report but creates (or cites) the underlying achievement — category, date, person, evidence optional ("no evidence yet") — marked "added from report" and counted once in KPIs and appraisal. A note line is commentary only: it never counts and carries no amounts or counts. Any claim of work done must be an achievement line. Spec §3.9.

**V80 — Tenders and the Pipeline in v1; one Commercial overview** ACTIVE · 2026-09-29. A tender (government-entity partner, Etimad reference, tender number, submission date, value, awarded value, files; Identified → Preparing → Submitted → Awarded / Lost / Cancelled) and a partnership opportunity (Prospect → Meeting → Proposal → Signed, which makes the partner Active). One Pipeline page with two boards and list views. Computed KPIs: tenders submitted (reached Submitted in the period), awarded value (sum awarded), government entity contracts (Contract signed achievements with Government-segment partners, tender or not). One executive Commercial overview with totals, both funnels and a segment switch replaces the old Finance / B2B / Tenders split. Spec §3.7a, plan P5-8 to P5-10.

**V81 — Less crowded detail pages** ACTIVE · 2026-09-29. Two columns (main work, a narrow properties rail); empty fields behind "+ Add"; long histories show the last few with "Show all"; any record opens full page. Nothing is removed, only reorganised. Spec §2.5.

**V82 — The design source moves to Figma** ACTIVE · 2026-09-29. A dedicated design session builds the design system (variables for the four themes) and every screen in Figma; builder B reads screens through the Figma connector. The canvas and the token table stay the reference until the oversight announces the Figma file, which then supersedes them. Spec §2.5, plan "Design tokens and screens".

**V83 — Exports unchanged for now** ACTIVE · 2026-09-29. A data export on every list and the designed monthly and quarterly reports; revisited later.

**V84 — The new environments exist; keys only from the owner** ACTIVE · 2026-09-28. The owner does not need the old app at all. On 28 Sep the oversight paused `direct-business` and created the Supabase project `direct-commercial` (ref `kimadjvaxgiqzjaukuqg`, eu-central-1, free) and the Vercel project `direct-commercial` (root `v2`, Next.js, production branch `v2/main`, fra1, builds skipped when `v2/` is unchanged). Keys are pasted into Vercel by the owner only; builders never handle the service key. The domain moves as soon as v2's sign-in page renders (V13). Spec §10.

## Builder A (V100–V199)

**V100 — Every check is a script that must be seen to fail** ACTIVE · 2026-09-28. The checks of spec §9.1 live in `v2/scripts/checks/` (one file each, listed in `index.mjs`, run by `pnpm checks`); each has a planted violation in `v2/tests/sabotage/` (a `.patch` with a `Sabotage / Breaks / Expect` header, or declarative edits in a `.mjs`), and each unit test of a check has a "blind" sabotage that makes its check miss what it must refuse. `node scripts/sabotage.mjs` runs the named target clean (must pass), plants the sabotage, requires red **with the expected text in the output** (red for the planted reason, not another), restores the tree and checks it is clean. A sabotage that no longer applies fails the run and is updated, never deleted (MF3). CI runs the check, lint and unit sabotages on every PR and the E2E ones after the E2E step. A true exception is waived on its own line, or the line above, with `check-allow: <check> — <a reason of ten characters or more>`.

**V101 — Made-up values have fixed shapes, so the rule-7 scanner can tell them from real ones** ACTIVE · 2026-09-28. E-mails: a reserved domain (`example.com/.net/.org`, `*.example`, `*.test`, `*.invalid`, `localhost`) or a local part starting `test`, `fake`, `dummy`, `sample` or `madeup` — e.g. `test.am1@directksa.com`, `a@test.example`. Phones: digits 3–6 of the national number are zero — `+966 50 000 0012`, `011 000 0123`. VAT `300000000000013` (3, ten zeros, three digits, 3); CR `1010000012` (a city prefix, then `0000`); unified `7000001234`; tax invoices `DPIN-T-0001` / `TTIN-T-0001`; references `INV-T-0001`; IBANs never. Binary files only when listed with a reason in `scripts/checks/rule7-binaries.txt`. The hashed deny-list (`rule7-denylist.txt`) holds only names already public in this repository, because a hash can be confirmed by guessing. Tests that plant real-looking values assemble them at run time, so no matching literal is committed. The scanner covers `v2/**` and the v2 workflow; `docs/v2/` is reviewed by hand.

**V102 — The v2 stack pinned at P3 start** ACTIVE · 2026-09-28. Node 22, pnpm 10.33, Next.js 16.3.6 (Turbopack), React 19.3, TypeScript 6.0.3, ESLint 9.39 with `eslint-config-next` 16.3.6 and Prettier 3.9, Vitest 5.0, Playwright 1.63. TypeScript 7 is refused by typescript-eslint (< 6.1) and ESLint 10 by the react, jsx-a11y and import plugins that `eslint-config-next` uses, so both wait; ESLint 9 is past its support window — revisit when those plugins move. Upgrades are their own PRs with the full suite. `v2/.gitignore` takes back `package.json` and the lockfile, which the root `.gitignore` drops for the old static app.

**V103 — What "forward-only migrations" means, checked** ACTIVE · 2026-09-28. A migration is `YYYYMMDDHHMMSS_<module>_<what>.sql` (a real date, 2026 on; lower case, digits, underscores) directly in `v2/supabase/migrations/`; no two share a timestamp; none is empty. A migration the base branch already has is never edited, deleted or renamed; a new one sorts after the newest on the base tip; `pg_get_functiondef` is refused (A9). The base is `V2_BASE_REF` (CI: the pull request's base, or the commit before a push), else `origin/v2/main`; when the base cannot be read the check fails and says so. Also checked on migrations: no identifier with a part `vat` or a tax amount (`tax_amount`, `total_tax` … — M1), a json/jsonb column only when listed with its reason in `scripts/checks/jsonb-columns.txt` (A1), and a change to any `norm.*` function followed by `norm.rebuild()` (A17).

**V104 — The v2 workflow** ACTIVE · 2026-09-28. `.github/workflows/v2.yml` runs on pull requests into `v2/main` (or into another `v2/…` branch, when a step is stacked on an unmerged one) and pushes to `v2/main` that touch `v2/**`, `docs/v2/**` (decision IDs are checked there) or the workflow; four jobs: checks with lint, types and format · unit tests · the sabotage run · build with end-to-end and its sabotage. Read-only token, no secrets; the database jobs join it in P3-1.

**V105 — One clock, with a test clock** ACTIVE · 2026-09-29. Every "now" of a business rule comes from `core.clock()`, and "today" from `core.riyadh_today()` (D20); a test moves time by setting `v2.test_now` inside its own transaction (stale tasks, due dates, contract reminders). A request cannot set it: PostgREST passes only JWT claims and headers.

**V106 — The SQL suite** ACTIVE · 2026-09-29. A test is `v2/supabase/tests/<area>/<ID>-<its promise as a sentence>.sql`, run by `node scripts/db/test.mjs` in its own transaction and rolled back; it fails when any statement errors (`test.ok`, `test.eq`, `test.raises(sql, sqlstate, what, message_like)`; `test.as_anon()`, `test.as_auth(uid)`, `test.as_owner()` switch the caller as PostgREST does). The database is built from zero for every run: on plain Postgres (the builders' containers, and CI) the Supabase stand-ins, then every migration in order; on the Supabase stack in CI, `supabase start`. A database sabotage is `supabase/tests/sabotage/<name>.sql`, applied after the migrations of a fresh build. `supabase/grants.expected` lists every privilege a request role (public, anon, authenticated, service_role, authenticator) holds on v2's schemas, tables, columns, functions and types, and the migration role's default privileges; GRANTS-01 compares it with the catalog, and it is rewritten only on purpose (`--write-grants`, said in the PR).

**V107 — `core.person_auth` arrives with P3-1, not P3-2** ACTIVE · 2026-09-29. `api.me()` (P3-1) resolves the person through it, so the table comes first; P3-2 fills it from the allow-list and adds `core.person_email` and `core.sign_in_log`. Only a staff person can be linked (trigger): System and Import can never be a login (V44).

**V108 — How the change log is kept** ACTIVE · 2026-09-29. Every business table gets `audit.track(table)`: `audit.stamp()` (before insert/update) writes `created_at/by`, `updated_at/by` and `version` from the open request — whatever the caller sent — and an update that changes nothing a person can see keeps the row's bookkeeping; `audit.capture()` (after insert/update/delete) writes one `audit.change` with only the changed fields, skips no-op updates, logs setting `deleted_at` as `remove` and clearing it as `restore`, and still logs a stray DELETE. `audit.begin(kind, label_key, label_args, reason)` opens one request per person action (a nested begin joins it) and `audit.end()` closes it; a write with no open request gets one automatic `system` request for its transaction, attributed to the System person — never to whoever is signed in. SCHEMA-01 fails any table of v2 without row-level security, both triggers, a uuid `id` and a `version`; only `audit.request`, `audit.change` and `core.counter` are exempt.

**V109 — What `api.me()` answers** ACTIVE · 2026-09-29. For builder B's gate (A5): `{status}` is `ok`, `not_listed` (the sign-in is linked to no person) or `switched_off` (inactive, removed, not allowed to sign in, or not staff); only with `ok` come `person` (id, names, nicknames, job titles, department, team, manager, `role` {id, key, names, is_admin}), `levels` {page key → none|view|own|full: an admin role is full everywhere, else the person's override, else the role's default, else none}, `capabilities` [keys], `departments` [ids: own plus any granted] and `profile` (null until the person saves one; a null field means "use the default"). A caller who is not signed in gets `42501`.

**V110 — Errors name a key, in words kept apart** ACTIVE · 2026-09-29. A broken business rule raises SQLSTATE `P0001` with a dotted message key (`person.manager_cycle`, `setting.rows_never_change`) and any words in `detail`; a refusal raises `42501` (`auth.not_signed_in`, `auth.no_active_person`, or the page and level it needs, from P3-4); `core/db/command.ts` maps the key to the catalog's words, so no sentence is written in SQL (§2.4, A6).

**V111 — Every foreign key has its index, except `updated_by` and `deleted_by`** ACTIVE · 2026-09-29. Postgres does not index the referencing side of a foreign key (Supabase's advisor: unindexed_foreign_keys); `core.index_foreign_keys(schema)` gives each one an index led by its own columns, and every later migration calls it for its schema (FK-01 fails otherwise). `updated_by` and `deleted_by` are left out: nobody looks rows up by them and a person is never hard-deleted, so their checks never scan — on the big finance tables that saves space on the free plan. The advisor still lists those two as INFO; that is accepted.

**V112 — Supabase's agent guidance is part of the build** ACTIVE · 2026-09-29. The oversight asked builders to follow Supabase's agent skills (`supabase`, `supabase-postgres-best-practices`), installed user-level, outside the repository. Applied: every function pins `search_path` (SEC-01); a security-definer function a request role may call asks who is calling (SEC-02); foreign keys are indexed (V111); CI runs `supabase db advisors --fail-on warn` on every PR; from P3-4, read policies are written `to authenticated` with `(select auth.uid())`-style calls evaluated once, and every view in `api` is `security_invoker`. Where the guidance prefers SECURITY INVOKER, v2's write functions stay SECURITY DEFINER on purpose — tables are never writable by a request role (A6) — and SEC-02 holds them to the guidance's condition for definer functions.

## Builder B (V200–V299)

**V200 — `tokens.css` is checked against the design system table** ACTIVE · 2026-09-28. The four themes' values (V60 for Direct; BUILD-PLAN "Design tokens" for the rest) live once in `src/ui/tokens.css`; `tests/unit/tokens.test.ts` holds the same table and fails on any drift (sabotage `tokens-drift`). Beside the colours the file declares the type scale, the 4 px spacing grid, the radii, the shadows and the density sizes (Comfortable default; `[data-density='compact']` tightens table rows to 32 px only — V8). Tailwind v4 maps utilities to the tokens and its stock palette is removed, so `text-red-500` does not exist.

**V201 — Preferences are cookies, read by the server before the first paint** ACTIVE · 2026-09-28. Theme, density, drawer, locale and a direction override live in `core/prefs` as an allow-listed set of cookies (never localStorage — A13), so `<html data-theme data-density dir lang>` is right on the first byte (A5). The direction override exists for the RTL pseudo-locale walk: only the development profile menu and the tests set it. New people start on Direct (Q32's recommendation) until "My profile" (P3-5) makes the profile the source and these cookies its cache.

**V202 — `/kit` is the component gallery, development and test builds only** ACTIVE · 2026-09-28. One page renders every kit component with made-up values for the UI-* screenshots, axe and RTL walks; a production build answers not-found. It is a test surface, not a screen: the no-hint and catalog checks exempt it and nothing in it reaches a person.

**V203 — The drawer's page list mirrors the registry until P3-4 lands** ACTIVE · 2026-09-28. `src/ui/shell/nav.ts` and the create actions in `CreateMenu.tsx` carry the registry's keys and shape; when builder A's `core/registry` merges, the shell reads from it and these lists go. `Me` (`core/auth/me.ts`) already has `api.me()`'s shape (V109: status, person, levels, capabilities, departments); P3-2 fills it.

**V204 — The sign-in page, as built** ACTIVE · 2026-09-28. V59, V74 and V75 applied: the brand panel at the inline start (Direct slate, the white logo, the brand line, one quiet flight-path pattern — the page's single bold element, reduced to the dashed arcs on a phone where the panel is a band on top), the form at the inline end; the work email and "Send code", then the six-digit step with Resend and Change email; no "keep me signed in" tick (V74: devices stay signed in until sign-out) and no other door (V59). The `SignInApi` the screen calls has two functions, `sendCode` and `verifyCode`; P3-2 implements them. A sabotage (`sign-in-grows-a-google-door`) keeps the doors out.

**V205 — Components holding a TanStack instance opt out of the React Compiler** ACTIVE · 2026-09-28. Next 16 compiles components by default; TanStack Table and Virtual mutate one stable instance, so the compiler memoised their reads and the table drew no rows. `DataTable` carries `'use no memo'`; any component holding such an instance must too.

**V206 — Screens are proven by the same sabotage runner as the checks** ACTIVE · 2026-09-28. Builder B's checks (`ui-no-hints`, `accent-fill-only`, `i18n-catalogs`, `no-forbidden-words`) live in `scripts/checks/` with A's (V100), each with a planted violation and a blind sabotage in `tests/sabotage/screens.mjs`; the E2E promises (Confirm has Cancel focused, Escape closes the panel, Direct never puts text on the accent, no second door on sign-in) each have an E2E sabotage there too. Avatars draw initials in the text colour on a tint of the person's colour with an inset ring, because white on the Direct gold or the Colorful amber fails AA; the neutral status chip uses the text colour for the same reason.

**V207 — The shell's navigation, as built** ACTIVE · 2026-09-29 (oversight, relayed from the owner). Drawer 232 px pinned / 56 px collapsed with the items My day, Overview, Partners, Pipeline, Projects, Tasks, Finance, KPIs, Reports, Appraisal and Settings at the foot (V80's Overview and Pipeline included); on a phone (under 1,024 px) a **bottom bar** — My day · Tasks · Partners · KPIs · More — replaces the drawer, and More opens a sheet with the rest and the person's profile; there is no off-canvas drawer. Notifications are in-app only in v1 (V45). On-screen words: Partner (never Company — V52) and Revenue · Cost · Profit (never Margin — V73); `no-forbidden-words` checks the catalogs and JSX text for them beside V59's five. The design source stays the screens canvas and the design system page (V82's Figma file is not used — the seat is view-only).
