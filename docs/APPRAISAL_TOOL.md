# The appraisal & tasks tool — what it is, and the two faults that distort the result

Read-only survey, 2026-08-13. **Nothing in the tool was changed.**

> **Correction to the first version of this file.** It said "there is no amount field."
> That was wrong. There *is* one — `task_kpi_contributions.contribution_value` — and the
> real story is worse than a missing field: the field exists, is mostly filled with the
> placeholder `1`, and **is never read by the scoring function anyway.** Details below.

## Where it lives

Not on Vercel (Vercel has only `direct-business` and `ahmed-aboelmagd-consulting`). It is
the second Supabase project, **`directksa-performance`** (ref `byhxnmafaumersoaiybq`).

## Shape of it

32 tables; 10 users; three appraisal cycles, each running **April → March**:

| Cycle | Tasks filed in it | Abdulrahman's score |
|---|---|---|
| Apr 2024 – Mar 2025 | **0** | 0.00 — "Fail" |
| Apr 2025 – Mar 2026 | **0** | 0.00 — "Fail" |
| Apr 2026 – Mar 2027 *(current)* | **793** | `aboelmagd` 98.49 "A+" · `business` 86.83 "B+" |

Every KPI is identical across users — 4 categories, 12 KPIs, weighted
Sales & Revenue 35 · Client Acquisition 30 · Internal Coordination 20 · Reporting 15,
and each instance is weighted personal 70 / competencies 25 / corporate 5.

Sales targets are real and ambitious: **Planned GMV 5,000,000 SAR**, Revenue from new
clients 1,500,000 SAR, Upsell & cross-sell 600,000 SAR, New B2B clients 12.

## Fault 1 — everything is filed in the wrong year, because `work_date` is empty

`tasks.work_date` is **null on all 793 rows**. That single null disables the whole
date-filing mechanism. The trigger `reallocate_task_by_work_date()` opens with:

```sql
if NEW.work_date is null or NEW.primary_kpi_list_id is null then return NEW; end if;
```

Its job is to read the work date, find the cycle whose window contains it, and move the
task (and its contributions) into that cycle's matching KPI folder, rescoring both. With
no work date it does nothing, so **everything piles into the current cycle**.

Reading the dates out of the task titles instead shows where they should sit:

| Where the title's date says it belongs | Achievements |
|---|---|
| Apr 2025 – Mar 2026 | **55** (+4 date ranges ending here) |
| Apr 2024 – Mar 2025 | **18** |
| Apr 2026 – Mar 2027 *(where all 793 currently sit)* | **14** |
| Apr 2023 – Mar 2024 | 1 |
| Bare year, ambiguous across two cycles | 6 |

So of the 98 achievements that name a date, only **14 actually belong to the year they are
filed under**. Two full appraisal years show zero work and score "Fail" while their
contents sit in the current year. 695 achievements name no date at all.

## Fault 2 — the money is recorded but never scored

`task_kpi_contributions.contribution_value` is the amount field. How it is filled:

- **`aboelmagd` — every money row is `1`.** Planned GMV: 76 tasks, all `1`, total **76**
  against a 5,000,000 SAR target. Revenue from new clients: 25 × `1` = 25 of 1,500,000.
  Upsell: 6 × `1` = 6 of 600,000.
- **`business` — mixed.** 221 of 245 GMV rows are `1`; 23 carry real figures totalling
  19,902,052 SAR. But those 23 include obvious test rows — `sdf` = 10,000,000,
  `fghfghhgjghj` = 1,000,000, `محمد` = 1,000,000, `hghjgjhg` = 100,000, `new task` = 350,000
  — roughly **12.45 M of the 19.9 M is junk**. Several of the rest are the same item twice
  with slightly different numbers (`Ratehwak credit line` 1,125,758 vs
  `credit line ratehwak` 1,123,477; likewise Dida and Holiday Me).
- Other users carry worse test data still: `raad.elkhair` has `trst` = **100,000,000 SAR**
  and `test` = 10,000,000, which is most of the 151,305,179 SAR sitting in the table overall.

**And none of it reaches the score.** In `compute_appraisal()`, when a KPI's
`manual_achievement` is null the achievement percentage is:

```sql
else case when total_count = 0 then 0 else (done_count::numeric / total_count) * 100 end
```

— the share of that KPI's tasks marked *complete*. `contribution_value` appears nowhere in
the function. All 12 of Abdulrahman's KPIs have `manual_achievement = null`, so **every KPI,
including the three denominated in SAR, is scored purely on how many boxes are ticked.**

That is the whole explanation of the scores, and it is verifiable:

| Account | Tasks complete | Tick rate | Score |
|---|---|---|---|
| `aboelmagd` | 530 / 548 | 96.72% | **98.49 — A+** |
| `business` | 184 / 245 | 75.10% | **86.83 — B+** |

The account with **zero** recorded revenue outscores the one with 19.9 M recorded, because
it has fewer unticked rows. Each KPI is also capped at 100% (`least(achievement_pct, 100)`),
so genuine over-achievement — 155 new B2B clients against a target of 12 — earns nothing
extra.

## Consequence for the 43 money achievements

Every achievement whose title names a riyal figure was counted as `1`. The two sets do not
overlap at all: the rows carrying real values have titles with no amount in them (`Bayswater`,
`EC`, `Kaplan`, `sdf`), and the rows naming amounts (`MDD London Contract — 285,000 SAR`)
all counted `1`. Nothing named in the titles has ever entered the score.

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

## Deliverables produced

Both in the "WhatsApp backup" Drive folder, plus the full file sent directly in chat:

- **`APPRAISAL-DECISIONS-141-ROWS`** (`1IRiFc8ZmAEEvRaCTU9Y5MowwijRDnFtduQPIyR0VDZI`) —
  only the rows needing a human decision: has a date, has money, or is repeated.
- **`appraisal_master.csv`** — all 793, same columns.
- Superseded: `APPRAISAL-ACHIEVEMENTS-WORKSHEET` (`1Zt0eNwm…`), whose date column caught only
  bare years — it missed every "Oct 2025" style month-year, every Arabic month
  (أبريل/مايو/يوليو/اغسطس/فبراير), and every range.

Columns: what the title claims · what the tool actually counted · whether money was lost ·
the date · **which appraisal year that date puts it in** · a care flag (margin / cost /
saving / rate / quoted / roll-up / USD / duplicate) · repeat count · three blanks to fill in.

## The fix, in order

1. **Fill `work_date`** on the dated achievements. The trigger then files each one into its
   real appraisal year by itself and rescores both years — no manual moving.
2. **Decide the real figure per KPI** from the decision sheet (dedupe, drop costs/savings/
   quotes/rates, convert USD), then set it as `manual_achievement` on that KPI. That is the
   only route by which a number ever reaches the score. He is `superadmin`, so
   `guard_manual_achievement()` permits him to set it.
3. **Delete the test rows** (`trst`, `test`, `sdf`, `fghfghhgjghj`, `hghjgjhg`, `محمد`,
   `new task`) — they inflate company-wide revenue by well over 100 M SAR.
4. Only then consider schema work for the redesign: a real `achievement_date`, and
   `amount` + `currency` + `value_type` (revenue / margin / cost / saving / rate / roll-up)
   on the task itself, so none of this has to be read out of a title again.
