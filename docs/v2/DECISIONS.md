# v2 decisions in force

The rules binding on the v2 build, one short paragraph each — the v2 counterpart of `docs/DECISIONS.md`, whose old
rules stay binding where `TECH-SPEC.md` §12 says so. Same shape: `**ID — title** STATUS · date. body`; the owner's
words in double quotes; the long story in the commit. Whoever learns a rule writes it here in the same commit as the
change that taught it.

**ID ranges** (so two builders never collide — spec A18): V1–V99 architect and oversight · V100–V199 builder A ·
V200–V299 builder B. A ruled open question keeps its number inside its ID: question Qn became **V(20+n)** (Q7 → V27),
so an old "Q7" still finds its answer here.

## Owner decisions, 28 Sep 2026 (relayed by the oversight)

**V1 — The transaction is the unit of revenue** ACTIVE · 2026-09-28. Billing invoices (`is_consolidated`) re-bill transactions and never count as revenue; collections are settled on them. Cost = approved expenses on the transaction; line names are only a flagged estimate. The DPIN (child of the billing or standalone invoice) = total − approved expenses and is the check: cost Provisional while an expense is pending or none is registered (commission-only excepted), Final once the DPIN exists; "expenses missing" when the DPIN is 100 % of a non-commission total; a billing total must equal its transactions. Refines D26: the transaction is counted, the billing invoice is the zero-revenue link. Spec §3.6.

**V2 — Sign-in: Google for .com, Zoom for .net, an emailed code as fallback** ACTIVE · 2026-09-28. No passwords. A person holds one or more allowed emails; the provider-verified email must match an allowed email of an active person, else access is denied; identities link to that person and never create people; every sign-in is logged. Spec §4.

**V3 — The online appraisal tool wins over the Excel form** ACTIVE · 2026-09-28. Templates are seeded from the tool (weights 70/25/5, its grade scale, points tables and items), gaps filled from the form; everything stays a setting. The tool's data comes only as an export the owner hands over, kept out of the repository (rules 7 and 8), loaded by a person through the importer. Spec §3.10.

**V4 — "Commercial total revenue" never blocks** ACTIVE · 2026-09-28. Its definition is a Finance setting; the value is decided at go-live (together with V51).

**V5 — Go-live = code and structure proven; invoices typed first** ACTIVE · 2026-09-28. The team types the 2026 invoices in a fast, first-class entry screen (lines, expenses, DPIN, cost status Provisional/Final); imports are a later phase (plan P7). Spec §7.

**V6 — Environments: free tier preferred, any cost flagged** ACTIVE · 2026-09-28. The owner approves creating the new Supabase and Vercel projects. Spec §10.

**V7 — A fourth theme, "Direct"** ACTIVE · 2026-09-28. Orange and charcoal, beside the unchanged Light, Dark and Colorful. The accent is a fill only — never text; a label on it is charcoal, never white; orange text uses the link colour. Values: BUILD-PLAN "Design tokens" (source: the design system page).

**V8 — Comfortable density by default** ACTIVE · 2026-09-28. 14 px body, 40 px controls, 44–52 px table rows, 24–32 px between sections; Compact (32 px rows) is a per-person choice. "Nothing cramped, especially My day." Replaces v0.7's "dense tables (32px rows)" as the default.

**V9 — "My profile" for every person** ACTIVE · 2026-09-28. First in Settings; each person edits their own: photo or initials with a colour, full name, display name / nickname, badge (none / icon / zodiac sign), theme, density, language, start page, drawer, notification choices. Shown in the top bar, the drawer foot and owner/helper chips. Company logos upload on the company record. Spec §3.1, §3.4.

**V10 — Reports: one tab row, Monthly · Quarterly** ACTIVE · 2026-09-28. The quarterly report's sections and actions: spec §3.9 and the canvas's QuarterlyReport.

**V11 — Screens carry data and controls only; every entity is a link** ACTIVE · 2026-09-28. No hint text, explanatory notes, banners, callouts or demo annotations inside screens ("the old app's biggest complaint"). Every company, invoice, task, achievement, KPI, report line and person is a link. Spec §2.5, rule A19.

**V13 — The same domain, moved at go-live** ACTIVE · 2026-09-28. v2 uses `directksab2b.com`. Staging runs on the new Vercel project's `vercel.app` address; at go-live the domain moves from the old Vercel project to the new one, and the Supabase Auth site URL and redirect URLs (and any OAuth origins) list it. Spec §10, plan P6-8.

**V21 — Free plan: the old app's database is paused on 1 Oct** ACTIVE · 2026-09-28. The owner chose the free way, pausing `direct-business` (the old app), not the appraisal tool: the oversight pauses it on 1 Oct after the Q3 close of 30 Sep; from then the old app is unavailable (data kept, restorable). `directksa-performance` stays live. The oversight then creates `direct-commercial` on the free plan. (Was Q1.)

**V23 — Google and Zoom keys: later** DEFERRED · 2026-09-28. P3-2 proceeds with the emailed code on the CI stack; the cloud sign-in doors wait for the keys. (Was Q3.)

## Oversight rulings, 28 Sep 2026 (delegated by the owner)

**V12 — v2 merges into `v2/main`, never into the default branch** ACTIVE · 2026-09-28. Merging into the default branch redeploys the frozen old app to production. `v2/main` was created from the default branch on 28 Sep; builders branch from it.

**V22 — Backups: the paid plan at go-live, not before** ACTIVE · 2026-09-28. Until then only trial values are in the database. (Was Q2.)

**V24 — Emailed codes via Resend's free tier** ACTIVE · 2026-09-28. Sending from a sub-domain such as `auth.directksa.com` with its DNS records; until it exists, Google and Zoom are the only doors. (Was Q4.)

**V25 — Words: "Sales (GMV)" and "Margin"** ACTIVE · 2026-09-28. Screens say Sales (GMV) for the invoice total less top-ups (D21's figure) and Margin for it minus approved cost; no money rule changes. (Was Q5.)

**V26 — Everyone edits company details; money-moving changes are held back** ACTIVE · 2026-09-28. Details, contacts, notes and files: everyone (D7). Identifiers: managers, the head, admins. Merging and changing the account manager: the head and admins. (Was Q6.)

**V27 — Credit follows the account manager on the invoice's paid date** ACTIVE · 2026-09-28. Invoices paid before the effective date stay with the old manager; a manager may split or reassign one invoice with a note. (Was Q7.)

**V28 — A discount code matches on the invoice's creation (booking) date** ACTIVE · 2026-09-28. (Was Q8; the old app used the paid date.)

**V29 — A pin is the last resort for a conflict** ACTIVE · 2026-09-28. First move the wrong clue or merge; else "these rows belong to company A" with a reason, logged, undoable, pin-marked. (Was Q9.)

**V30 — Individuals count, credited to nobody, listed apart** ACTIVE · 2026-09-28. (Was Q10; D25.)

**V31 — Last year's figures are typed once until imports bring history** ACTIVE · 2026-09-28. Per-KPI readings for last year's months; a company can be marked "client before 2026"; Payments history from 1 January 2025 replaces both in the import phase. (Was Q11.)

**V32 — Values that never become identifiers** ACTIVE · 2026-09-28. Every address at directksa.com and directksa.net (and sub-domains), the Payments test VAT, and any customer name the owner lists as a test; the list is a setting. (Was Q12.)

**V33 — Achievements without a proof file count, flagged "no evidence yet"** ACTIVE · 2026-09-28. On the KPI page and in the KPI sheet. (Was Q13.)

**V34 — Report layout source: the issued PDFs and the artboards** ACTIVE · 2026-09-28. No PowerPoint templates are known. The layout comes from the department's issued monthly report PDFs in Drive (folder `1A5ua72_qosteLvSn22XdWgUFD9vZEqhl`, 2025; January 2026 in `12F8bnr6WqxQdJvu2PB9s6TKRG8vFi0rj`) and the canvas's MonthlyReport and QuarterlyReport artboards; the PPTX is generated to that layout until the owner supplies a template. The PDFs hold real figures — they are read, never copied into the repository. (Was Q14.)

**V35 — The KPI sheet export follows "Departmental KPIs 2026"** ACTIVE · 2026-09-28. The Google Sheet `1APdUbCPTftCxvfkqUq8m4Zl7fIZXF94rn6CQOTIZwCE` (28 KPIs). Columns, in order: No. · Objective indicators · Link to Departmental Objectives · Unit · Base Year · Baseline value · Achieved up to 2025 · 2026 · Target 2026 · Target Q1-2026 … Target Q4-2026 · Achieved Q1-2026 … Achieved Q4-2026 · Total 2026 · Status · Owners · Update · date. It holds staff names: never committed, only its column layout is described. (Was Q15.)

**V36 — A report correction keeps the issued report and supersedes it** ACTIVE · 2026-09-28. Achievements behind an issued report may be corrected by a manager with a reason; the report shows the drift and a correction is issued (both readable). (Was Q16.)

**V37 — Achievements and challenges live inside KPIs** ACTIVE · 2026-09-28. Views KPIs · Achievements · Challenges; reviewed after a month of use. (Was Q17.)

**V38 — A next-month target becomes a task at once** ACTIVE · 2026-09-28. Owned by the person named, due the end of next month; the next report shows it done or carried over. (Was Q18.)

**V39 — Operational-plan indicators are checklist KPIs** ACTIVE · 2026-09-28. Grouped under their own objective in the yearly plan. (Was Q19.)

**V40 — Gregorian dates and Latin digits in both languages** ACTIVE · 2026-09-28. (Was Q20.)

**V41 — Company categories and tiers are typed by the owner in Settings** ACTIVE · 2026-09-28. Not blocking. (Was Q21.)

**V42 — Appraisal details, where the tool does not say** ACTIVE · 2026-09-28. The tool overrides each of these where it speaks: the manager's evaluation counts (self beside it); cap 120 %; escalations: more is better; "on-time reports" = achievements and updates logged before the report's cut-off day; "weekly updates" = weeks (Sunday–Thursday) with an update on each task in progress; visible to the person, the evaluator, the reporting line and admins; personal targets entered by the manager at cycle start; MF5 exclusions apply to appraisal figures too. (Was Q22.)

**V43 — Past appraisals from the tool's export; ClickUp once** ACTIVE · 2026-09-28. The owner's export seeds the templates and brings the last two cycles as read-only "legacy"; ClickUp's KPI records imported once, then ClickUp stops for them; nothing from the old app's tasks is moved (D9). (Was Q23.)

**V44 — Imports and jobs act as "Import" and "System"** ACTIVE · 2026-09-28. Two named persons that cannot sign in; never a real login (replaces D13's QA-account attribution for v2). (Was Q24.)

**V45 — Notifications in the app only for v1** ACTIVE · 2026-09-28. Email later, once V24's sender exists. (Was Q25.)

**V46 — Vercel's free plan for now** ACTIVE · 2026-09-28. The paid plan only if Vercel asks. (Was Q26.)

**V47 — v2 lives in this repository, folder `v2/`** ACTIVE · 2026-09-28. With its own branch (V12); public, so rule 7 applies exactly as today. (Was Q27.)

**V48 — No main-builder handover note exists** CLOSED · 2026-09-28. It was never written (the owner denied its last approval); the production branch's code is the source for that builder's work. (Was Q28.)

**V49 — Everyone types invoices; a typist may pin a company** ACTIVE · 2026-09-28. Everyone in Commercial types invoices and edits their own; managers correct anyone's; a customer with no company may be pinned by the typist, and its details go to a manager as a suggested identifier. (Was Q29.)

**V50 — A person may adopt a typed invoice so imports keep it current** ACTIVE · 2026-09-28. (Was Q30.)

**V51 — VAT inside the margin: decided at go-live** DEFERRED · 2026-09-28. Until then the margin is kept as recorded (D21); decided with the revenue definition (V4). (Was Q31.)

## Builder B (screens), 28 Sep 2026

**V200 — The Direct theme's tokens are the official brand palette** ACTIVE · 2026-09-28. The oversight relayed the official palette (bg #F6F7F9, surface #FAFBFC, text #303848, muted #646D79, link #B5490E, accent #F06820 as a fill only, accent-hover #FF6B00, primary #C94C14 with a white label, focus #2563EB, nav #323E48/#E6E8EC/#3E4B56, active mark #FF6B00, charts #F06820 #FBAE16 #323E48 #2563B0 #1F7A4D #858E99), replacing the BUILD-PLAN table's Direct column (#F6F4F0 …). `--primary`/`--primary-hover`/`--on-primary` exist in all four themes (= accent elsewhere). The test `tests/unit/tokens.test.ts` checks `tokens.css` against this table, and `check-accent-fill-only` refuses `text-accent` and a label on `bg-accent`. The design system page is the source.

**V201 — Preferences are cookies, read by the server before the first paint** ACTIVE · 2026-09-28. Theme, density, drawer, locale and a development-only direction override live in `core/prefs` as an allow-listed set of cookies (not localStorage), so `<html data-theme data-density dir lang>` is right on the first byte — no flash of the wrong theme (A5, A13). New people start on Direct (Q32's recommendation) until "My profile" (P3-5) makes the profile the source and these its cache.

**V202 — `/kit` is the component gallery, development and test builds only** ACTIVE · 2026-09-28. One page renders every kit component with made-up values for the UI-* screenshots, axe and RTL walks; it returns not-found in a production build. It is a test surface, not a screen: the no-hint and catalog checks exempt it and nothing in it reaches a person.

**V203 — The drawer's page list mirrors the registry until P3-4 lands** ACTIVE · 2026-09-28. `src/ui/shell/nav.ts` and the create actions in `CreateMenu.tsx` carry the registry's keys and shape; when builder A's `core/registry` merges, the shell reads from it and these lists go. Nothing else changes: keys, routes and labels are already the registry's. "Partners" is the page name (the design system page and canvas), per the Architect's follow-up.

**V204 — Sign-in is a split layout with the brand panel at the inline start** ACTIVE · 2026-09-28 (owner, relayed by the oversight). The Direct slate panel carries the white logo, the line "The commercial arm of the all-in-one travel app" / «الذراع التجاري لتطبيق السفر الشامل» and one quiet flight-path pattern; the form sits at the inline end; in Arabic the panel mirrors by `dir`; on a phone the panel is a band on top. The only door is the emailed 6-digit code (V59, corrected by the owner on 28 Sep after seeing the page): work email and "Send code", then the code step with "Keep me signed in on this device", Resend and Change email — no Google or Zoom button, divider or icon anywhere in the UI until their keys exist and the owner asks. One step at a time. Same message: detail pages use two columns (main at the start, a properties rail at the end), empty fields sit behind "+ Add", long histories behind "Show all", and every record opens full page — applied from P3-9.

**V205 — Tables opt out of the React Compiler** ACTIVE · 2026-09-28. Next 16 compiles components by default; TanStack Table and Virtual mutate one stable instance, so the compiler memoised their reads and the table drew no rows. `DataTable` carries `'use no memo'`; any component holding a TanStack instance must too.

**V206 — Every check has a sabotage, and the runner proves it** ACTIVE · 2026-09-28. `tests/sabotage/<name>.mjs` mutates named files and names the command that must then fail; `scripts/sabotage.mjs` applies, runs, expects red and restores. Static ones run in every CI run; the E2E ones against the dev server. A test without a sabotage does not count as done (spec §9.4).
