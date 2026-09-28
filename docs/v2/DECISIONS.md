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
