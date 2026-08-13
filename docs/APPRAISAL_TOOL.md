# The appraisal & tasks tool — what it is and what its data looks like

Read-only survey done 2026-08-13. **Nothing in the tool was changed.**

## Where it lives

It is **not** on Vercel. Vercel only hosts two projects: `direct-business` (this app) and
`ahmed-aboelmagd-consulting`. The appraisal tool is the **second Supabase project**,
`directksa-performance` (ref `byhxnmafaumersoaiybq`) — a full performance-appraisal system
with its own database, separate from the B2B app.

## What is inside it

32 tables. The ones that carry real content:

| Table | Rows | What it holds |
|---|---|---|
| `tasks` | 1,414 (1,004 not deleted) | The achievements — one line each |
| `task_kpi_contributions` | 1,423 | Which KPI each task counts toward |
| `kpi_lists` | 275 | The individual KPIs |
| `kpi_categories` | 94 | KPI groupings |
| `competency_scores` | 208 | Competency ratings |
| `appraisal_instances` | 26 | One appraisal per person per cycle |
| `corporate_objective_scores` | 30 | Company-objective scoring |
| `audit_log` | 588 | Change history |
| `users` | 10 | Staff |

Ten users; the two accounts that carry Abdulrahman's own record are
`business@directksa.com` (245 tasks) and `aboelmagd@directksa.com` (548 tasks) —
**793 tasks between them**, which is 79% of everything in the tool. The rest:
Kareem Medhat 112, Raad El-Khair 95, and four accounts with 1–2 each.

Four KPI categories cover all 793: Internal Coordination (276), Client Acquisition (188),
Sales & Revenue (177), Reporting (152).

## The problem to fix before the appraisal — dates and money are not fields

This is the finding that matters. **The tool has no usable date or amount data.**

- `work_date` — **empty on every single row**.
- `due_date` — filled on **1 row out of 793**.
- `completed_at` — filled on 192 rows, but every one of them falls in
  **2 – 5 August 2026**, which is when the records were typed in, not when the work happened.
- There is **no amount/value column at all** anywhere on `tasks`.
- `description` is effectively empty (average length 0 characters, longest 30).

Everything real — the date and the money — is **buried inside the task title as free text**,
e.g. `MDD — London Mar 2026 (285,000 SAR — Margin 45,000 SAR)`. That is why the achievements
cannot currently be sorted by period or totalled by value.

## What was produced

**`APPRAISAL-ACHIEVEMENTS-WORKSHEET`** — Google Sheet, in the "WhatsApp backup" Drive folder
(`1Zt0eNwm-7R8iFGh2_O3pZiOmI8S_24E4lZZQJ-ohabE`). All 793 of Abdulrahman's task lines,
grouped by KPI category and KPI, with the amounts and dates **pulled out of the title text
into their own columns**, plus three empty columns to correct by hand:
`ACTUAL DATE`, `ACTUAL AMOUNT SAR`, `CLASSIFICATION`.

Automatic extraction found **43 lines carrying a money figure** and **99 carrying a date or
year**. Currency is marked per row: `SAR`, `$` (USD), or `?` where the title gave a bare
number with no currency.

### The money lines, as they read in the tool

Largest first. Several are the same achievement entered more than once — those are marked.

| Amount | Achievement | Note |
|---|---|---|
| 2,430,678 | KPI Scorecard — Sales & Revenue documented | a **total**, not one deal |
| 1,853,000 | MDD — Madad key account (9 trips) | a **roll-up** of the MDD lines below |
| ~1,000,000 | MDD — USA Oct 2025 (Washington + New York) | entered **3×** (EN, AR, project) |
| 450,000 | SIFI — corporate payment system (Jan 2026) | |
| 285,000 (margin 45,000) | MDD — London Mar 2026 | entered **3×** |
| 258,000 | Milan training camp — Sheraton | entered **4×** |
| 251,000 | Moola — balance + 100 cards | |
| 210,577 | MDD — Osaka Oct 2025 | entered **4×** (one self-labelled duplicate) |
| 153,686 | Takamol — fully paid | |
| 150,000/day | Riyadh conference — InterContinental | entered **2×** |
| 102,062 | MDD — Lisbon Oct 2025 | |
| 101,260 | MDD — April 2026 invoice | entered **3×** |
| 98,075 | International conference — 5 speakers | |
| 63,366 | Tabby settlement | entered **4×** |
| 56,122 | Kaplan International — fully paid | |
| 25,800 | Mal Company / Hesham CFO settlement | entered **2×** |
| 25,000/room | Davos package — Steigenberger Icon | entered **3×** |
| 21,045 | Islamic University tender won — Marriott Madinah | entered **3×** |
| 15,000/month | Ministry of Manufacturing-style proposal credit | a **proposed** term |
| 7,639 | WTA award ceremony cost | a **cost**, not revenue |
| $57,000/month | CareMed monthly invoices | **USD**, recurring |
| $10,000 | Babylon deposit | **USD**, entered 3× |
| $10,000 → $6,000 | Hotelbeds credit line cut (40% saving) | **USD**, a **saving** |

Three things make a straight sum wrong, and they are exactly what the `CLASSIFICATION`
column is for: the same win is entered several times in different wordings; the figures mix
**revenue, margin, cost, saving, per-night/per-room rates and totals**; and some are
**USD, not SAR**.

## Suggested next step (not done — decide first)

Fill `ACTUAL DATE`, `ACTUAL AMOUNT SAR` and `CLASSIFICATION` in the sheet by hand — it is
~50 rows that actually need it, not 793. Once the sheet is settled, the same three fields
should become **real columns** in the appraisal tool (`achievement_date`, `amount`,
`currency`, `value_type`) so the next appraisal can sort and total by itself instead of
re-reading titles.
