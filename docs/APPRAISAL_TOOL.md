# The appraisal & tasks tool — what it is, and the two faults that distort the result

Read-only survey, 2026-08-13. **Nothing in the tool was changed.**
Re-verified against live data and adversarially audited 2026-08-16 — see *Audit* at the end,
which lists the errors the audit found in the first version of this file.

## Where it lives

Not on Vercel (Vercel has only `direct-business` and `ahmed-aboelmagd-consulting`). It is
the second Supabase project, **`directksa-performance`** (ref `byhxnmafaumersoaiybq`).

## Shape of it

32 tables; 10 users; three appraisal cycles, each running **April → March**:

| Cycle | Tasks filed in it | Abdulrahman's score |
|---|---|---|
| Apr 2024 – Mar 2025 | **0** | 0.00 — "Fail" |
| Apr 2025 – Mar 2026 | **0** | 0.00 — "Fail" |
| Apr 2026 – Mar 2027 *(current)* | **796** | `aboelmagd` 98.49 "A+" · `business` 87.02 "B+" |

There are **three role templates**, not one:

| Template | Users | Structure |
|---|---|---|
| Business Development | aboelmagd, business, kareem.medhat, raad.elkhair, abdulaziz.alreshody | 4 categories / 12 KPIs — Sales & Revenue 35 · Client Acquisition 30 · Internal Coordination 20 · Reporting 15 |
| Quality | asmak, hossam, osharafi | 3 categories / 8 KPIs — Efficiency & Service Delivery · Reporting & Collaboration · Standards Monitoring |
| Partnerships | assem.alsweed, mohammed.altuwaijri | 3 categories / 9 KPIs — Strategic Partnerships · Tender Management · Internal Collaboration |

Every instance is weighted personal 70 / competencies 25 / corporate 5. The BD sales targets
are real and ambitious: **Planned GMV 5,000,000 SAR**, Revenue from new clients 1,500,000 SAR,
Upsell & cross-sell 600,000 SAR, New B2B clients 12.

## Fault 1 — everything is filed in the wrong year, because `work_date` is empty

`tasks.work_date` is **null on 795 of the 796 rows**. That single null disables the whole
date-filing mechanism. The trigger `reallocate_task_by_work_date()` opens with:

```sql
if NEW.work_date is null or NEW.primary_kpi_list_id is null then return NEW; end if;
```

Its job is to read the work date, find the cycle whose window contains it, and move the task
(and its contributions) into that cycle's matching KPI folder, rescoring both. With no work
date it does nothing, so **everything piles into the current cycle**.

(The one row that now carries a work date — "Hotel Sourcing — Riyadh Conference" — was set to
**2026-11-13**, a date in the future. That looks like a placeholder rather than the real date
of the work, and it would file the achievement into Apr 2026 – Mar 2027.)

Reading the dates out of the task titles instead — handling month-year, Arabic months and
ranges, not just bare years — shows where they should sit. **99 of 796 titles name a date:**

| Where the title's date says it belongs | Achievements |
|---|---|
| Apr 2025 – Mar 2026 | **56** (+4 date ranges ending here) |
| Apr 2024 – Mar 2025 | **18** |
| Apr 2026 – Mar 2027 *(where all 796 currently sit)* | 14 — **but 7 of those are future tender *due* dates, not work done** |
| Apr 2023 – Mar 2024 | 1 |
| Bare year, ambiguous across two cycles | 6 |

So only **7 genuine achievements** actually belong to the year all 796 are filed under. Two
full appraisal years show zero work and score "Fail" while their contents sit in the current
year. 697 achievements name no date at all.

## Fault 2 — the money is recorded but never scored

`task_kpi_contributions.contribution_value` is the amount field. Across the whole company:

- **1,395 of 1,423 contribution rows are exactly `1`** — 9 are null, and only ~19 carry a
  real number. The field is 98% placeholder.
- **`aboelmagd` — every money row is `1`.** Planned GMV: 76 tasks, all `1`, total **76**
  against a 5,000,000 SAR target. Revenue from new clients: 25 × `1` = 25 of 1,500,000.
  Upsell: 6 × `1` = 6 of 600,000.
- **`business` — mixed.** Most GMV rows are `1`; 23 contribution rows carry real figures
  totalling 19,902,052 SAR. But those include obvious test rows — `sdf` = 10,000,000,
  `fghfghhgjghj` = 1,000,000, `محمد` = 1,000,000, `hghjgjhg` = 100,000, `new task` = 350,000
  — roughly **12.45 M of the 19.9 M is junk**. Several of the rest are the same item twice
  with slightly different numbers (`Ratehwak credit line` 1,125,758 vs `credit line ratehwak`
  1,123,477; likewise Dida and Holiday Me).
- Other users carry worse test data still: `raad.elkhair` has `trst` = **100,000,000 SAR**
  and `test` = 10,000,000, most of the 151,305,179 SAR sitting in the table overall.

**And none of it reaches the score.** In `compute_appraisal()`, when a KPI's
`manual_achievement` is null the achievement percentage is:

```sql
else case when total_count = 0 then 0 else (done_count::numeric / total_count) * 100 end
```

— the share of that KPI's tasks marked *complete*. `contribution_value` appears nowhere in the
function. **`manual_achievement` is null on every KPI of all 10 users**, so *every employee in
the company*, not just Abdulrahman, is scored purely on how many boxes are ticked.

That is the whole explanation of the scores, and it is verifiable:

| Account | Tasks complete | Tick rate | Score |
|---|---|---|---|
| `aboelmagd` | 530 / 548 | 96.72% | **98.49 — A+** |
| `business` | 187 / 248 | 75.40% | **87.02 — B+** |

The account with **zero** recorded revenue outscores the one with 19.9 M recorded, because it
has fewer unticked rows. Each KPI is also capped at 100% (`least(achievement_pct, 100)`), so
genuine over-achievement — 155 new B2B clients against a target of 12 — earns nothing extra.

### A live proof of the fault

Three tasks were added to `business` on 2026-08-13, after the first survey. One reads
*"اتمام صفقة حجوزات فنادق بقيمة **5000000 ريال**"* — a hotel-booking deal worth 5,000,000 SAR,
filed against the GMV KPI whose annual target is **exactly 5,000,000 SAR**. Its
`contribution_value` is **`1`**. A single deal that meets the entire year's target counted as
one tick, and moved the score from 86.83 to 87.02 — the same fraction any trivial task would
have moved it.

## Consequence for the 45 money achievements

Every achievement whose title names a riyal figure was counted as `1` — verified twice, by the
title parser and independently in SQL: **45 money-naming titles, 45 counted as `1`, 0 counted
with their real value.** The two sets do not overlap at all: the rows carrying real values have
titles with no amount in them (`Bayswater`, `EC`, `Kaplan`, `sdf`), and the rows naming amounts
(`MDD London Contract — 285,000 SAR`) all counted `1`. Nothing named in the titles has ever
entered the score.

Beyond that, the figures cannot simply be summed — they mix kinds:

- **Repeated:** Osaka 210,577 appears 4×, Milan 258,000 4×, Tabby 63,366 4×, London 285,000 3×,
  Babylon $10K 3×, Islamic University 21,045 3×.
- **Not revenue:** margin (45,000 inside the 285,000 London deal), a cost (7,639 WTA ceremony),
  a saving (Hotelbeds $10K→$6K).
- **Not totals:** per-room (25,000 Davos), per-day (150,000 Riyadh), per-month ($57K CareMed).
- **Not won:** the تسعير / quotation lines are prices offered, not business closed.
- **Not SAR:** CareMed, Babylon and Hotelbeds are USD.
- **Already roll-ups:** "Madad Key Account 1,853,000+" and the 2,430,678 scorecard line
  summarise other rows.

## Deliverables

In the "WhatsApp backup" Drive folder, plus the full file sent directly in chat:

- **`APPRAISAL-DECISIONS`** — the 136 rows needing a human decision: has a date, has money,
  is repeated, or carries a care flag.
- **`appraisal_master.csv`** — all 796, same columns.

Columns: what the title claims · what the tool actually counted · whether money was lost · the
date · **which appraisal year that date puts it in** · a care flag (margin / cost / saving /
rate / quoted / roll-up / USD / duplicate / **due-date** / **ambiguous date** / **Arabic month
with no year**) · repeat count · three blanks to fill in.

## The fix, in order

1. **Fill `work_date`** on the dated achievements. The trigger then files each one into its
   real appraisal year by itself and rescores both years — no manual moving. Use the real date
   of the work, not a future placeholder.
2. **Decide the real figure per KPI** from the decision sheet (dedupe, drop costs/savings/
   quotes/rates, convert USD), then set it as `manual_achievement` on that KPI. That is the
   only route by which a number ever reaches the score. He is `superadmin`, so
   `guard_manual_achievement()` permits him to set it. **This applies to all 10 employees**,
   not only him — every appraisal in the company is currently a tick-count.
3. **Delete the test rows** (`trst`, `test`, `sdf`, `fghfghhgjghj`, `hghjgjhg`, `محمد`,
   `new task`) — they inflate company-wide revenue by well over 100 M SAR.
4. Only then consider schema work for the redesign: a real `achievement_date`, and `amount` +
   `currency` + `value_type` (revenue / margin / cost / saving / rate / roll-up) on the task
   itself, so none of this has to be read out of a title again.

---

## Audit — 2026-08-16

The first version of this file was published without adversarial checking. Auditing it against
live data found **nine defects, six of them in my own reporting.** All are fixed above.

| # | What was wrong | Why it mattered | Fixed by |
|---|---|---|---|
| 1 | Claimed **793 tasks**; there are **796** | Three tasks were added after the extraction, so every count was stale | Re-pulled; counts now 796 |
| 2 | Claimed `work_date` is **"null on all rows"** | One row now carries a work date — and it is a *future* date (2026-11-13), which would misfile that achievement | Corrected to 795 of 796, with the future-date caveat called out |
| 3 | Claimed **"every KPI is identical across users — 4 categories, 12 KPIs"** | Flatly wrong: there are **three** role templates. I generalised from the two accounts I had looked at | Table of all three templates added |
| 4 | Duplicate detector produced **false positives** | It stripped words of ≤2 characters and digits, so `EC` / `11` / `1` all normalised to an empty string and were flagged "3× same wording"; likewise *"Arrange a meeting with **EC**"* vs *"…with **EF**"* (two different providers) and `booking issue 1/2/3`. Acting on those flags would have **deleted real, distinct achievements** | Short tokens and digits are now kept, and a title with fewer than 2 tokens is never grouped. 16 flags → **8**, all verified true |
| 5 | Headline said **"only 14 of 98 belong to the current year"** | 7 of those 14 are **future tender due dates**, not work done. The real figure is **7 genuine achievements** — the fault is worse than reported | Due dates now flagged and excluded from the headline |
| 6 | Bare-year and `5/3/2026`-style dates presented as settled | A bare "2025" spans two appraisal years, and `5/3/2026` is day/month-ambiguous — presenting them as decided invites filing into the wrong year | 7 rows flagged **"AMBIGUOUS date — needs your call"** |
| 7 | Two Arabic titles with a month but no year were silently undated | *"في شهر مايو"* and *"خلال شهر سبتمبر"* dropped out with no trace, so they'd look like the 697 genuinely undated rows | Flagged **"Arabic month with NO year"** |
| 8 | Scope understated as Abdulrahman's problem | `manual_achievement` is null for **all 10 users**; 1,395 of 1,423 contribution rows are `1`. It is company-wide | Stated company-wide, and step 2 of the fix now says so |
| 9 | `business` figures (245 tasks / 184 complete / 75.10% / 86.83) | Stale after the three new tasks | Now 248 / 187 / 75.40% / **87.02** |

**A near-miss worth recording.** Checking whether the paginated extraction had silently dropped
or duplicated rows, the first checksum comparison came back as a mismatch. That looked like data
loss. It was not — Postgres and Python sort strings differently, so the *order* differed while
the *contents* were identical. Re-running with `ORDER BY title COLLATE "C"` produced an exact
match (`f7d0e7a4…`), proving all 793 rows were present, none duplicated. Reporting that first
result as data loss would have been a false alarm; the two paginated queries were in fact sound.

**Re-test after fixing, every check green:** 796 rows matching the database · no duplicate
titles · money rows = 45, equal to the independent SQL count · every money row carries the
not-counted flag · no thin/1-token title flagged as a duplicate · EC-vs-EF and booking-issue
false positives gone · all 8 remaining duplicate flags manually verified as true.

**What remains genuinely unsolved.** 697 of 796 achievements name no date anywhere, and 45 name
an amount whose *kind* (revenue, margin, quote, rate) only Abdulrahman can settle. No amount of
parsing fixes that — the information was never recorded. It has to be entered by a human, which
is exactly what the decision sheet is for.
