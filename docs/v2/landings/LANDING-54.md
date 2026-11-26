# Landing 54 — KPI pace (Reports → KPI pace)

26 Nov 2026 · base `4329fcd` (Landing 53) · target `v2/main` · branch `claude/kpi-pace-l51`.

Built from the design session's Batch 3, boards 5–8 (English and Arabic, desktop and phone). The people and the
figures on those boards are samples the design session invented; **none of them is in this repository or in the
page** — the page shows only what the workspace itself holds. Not built, on purpose: the KPI edit screen (board 10)
and Themes (board 9).

## In plain words — what is new

1. **A new page, Reports → KPI pace** (`/reports/kpi-pace`, opened from a "KPI pace" button on Reports; Reports stays
   the highlighted entry of the menu). Under the title is the month; a year selector offers this year and the two
   before; two arrows step a month back or forward.
2. **What a KPI is on this page:** a plan's target for one category in one month — the targets admins already keep
   in Settings → Targets. The **actual to date** is read, never typed: the dated achievements of that category in
   that month (drafts never count), the same rows the Targets screen counts. A target that also names a deal value
   shows as a second KPI ("… — deal value (SAR)").
3. **Each KPI shows** its name, who is **Responsible**, its **monthly target**, its **actual to date**, its **pace**
   as a percent with a coloured bar, its **status** in words, and its **initiatives** line.
4. **The three counts** — On track, At risk, Behind — stand above the list.
5. **The curve** draws one KPI day by day: the target due (dashed) against the running actual, with **today**
   marked. It opens on the first KPI; the small chart button on any KPI puts that one on the curve.
6. **The pencil** shows only to a person who may edit targets, and leads to the plan's page in Settings → Targets —
   where editing starts today. It opens no new screen.
7. **A month with no target** says "No KPI has a target for this month yet" (and offers "Set targets" to a person
   who may set them).
8. **Arabic**: the whole page right to left with the design's words (وتيرة مؤشرات الأداء · المسؤول · الهدف الشهري ·
   المحقق حتى الآن · السنة · اليوم · عرضها), the drawing mirrored, Western digits.

## The pace rule (one copy, in the database)

- **Pace = actual ÷ the share of the target due by today.** The share is the working days passed (Sunday to
  Thursday, today counted) over the month's working days. On 25 Nov 2026, 19 of 22 working days have passed, so 86%
  of a month's target is due.
- A finished month is judged on its whole target. A month not begun is **Not started**. A KPI with no target is
  **Not measured** (never drawn as 0%).
- **A rate KPI** (a percentage) is compared with its full target, whatever the day. The rule is in place and tested
  (`perf.pace_pct(…, p_rate)`); the workspace holds no rate KPI today — every target is a count or a deal value.
- **Bands**, judged on the whole percent the page shows: **On track 90% or more · At risk 70–89% · Behind under 70%**.
- Checked against the five sample sums of the design boards (figures only): 94%, 76%, 52%, 97% and, for the rate,
  87% — all five come out as drawn (`PCE-01`).

## Responsible, and at most three KPIs per person

The workspace had no place to say who is Responsible for a KPI. This landing adds it:

- `perf.kpi_responsible` — one Responsible per plan and category.
- **A person is Responsible for at most three KPIs in a plan year.** The table itself refuses the fourth (a
  guard on every insert and change), so no door — present or future — can pass it. Taking one away frees a place;
  another year counts apart.
- `api.kpi_responsible_set` sets or clears it (Full on Achievements, in a department the person sees). **No screen
  calls it yet** — setting the Responsible belongs to the KPI edit screen (board 10), not built in this landing.
  Until then every KPI on the page reads **"Responsible: Not set"**.

## Two things the oversight should know

1. **Initiatives.** The workspace has no "initiative" record. The line shows what it can honestly read today: the
   **projects** the month's achievements belong to (an achievement's own project, or the project of the task it was
   logged from), each with how many, and "View them" → Projects (for a person who may open Projects). With none, it
   says "None linked yet". If the design session means something else by an initiative (a record of its own, or the
   Themes of board 9), this line is the one place to change.
2. **Where the bands live.** 90 and 70 are in one database function (`perf.pace_bands`), not yet an admin setting.

## Database

Migration `20261126100000_perf_kpi_pace.sql` (new table, new functions — nothing existing is changed, no money
touched) and `20261126100100_core_registry_sync.sql` (the registry learns the new table). Forward-only. The grants
snapshot gains the nine new functions, all for signed-in people only.

## Tests

| Kind | What | Result here |
| --- | --- | --- |
| SQL | `PCE-01` the pace rule · `PCE-02` the page's read, per role and department · `PCE-03` Responsible and the three-KPI limit | green on a database built from zero |
| SQL sabotage | 7 (`pace-counts-the-weekend`, `pace-ignores-the-days-passed`, `a-rate-is-paced-by-the-days`, `the-at-risk-band-starts-at-on-track`, `kpi-pace-shows-every-department`, `a-person-is-responsible-for-a-fourth-kpi`, `a-member-sets-the-responsible`) | each turns its test red |
| Unit | `tests/unit/perf/landing-54-…` — 21 cases, English and Arabic | green (whole suite: 1,924) |
| Unit sabotage | 8 (`tests/sabotage/landing-54-kpi-pace.mjs`) | each turns the test red |
| Browser | `landing-54-kpi-pace.spec.ts` — a manager, a member, a viewer, an admin and a person with no level; 1440 px and 375 px | green |
| Browser, Arabic | `landing-54-kpi-pace-arabic.alone.spec.ts` — 1440 px and 375 px | green |
| Browser sabotage | 3 (`tests/sabotage/landing-54-e2e.mjs`) | each turns its spec red |

## Live check after deploy

The live workspace holds TEST data only. Read from the live database on 25 Nov (read-only), **November 2026 has four
TEST targets**, so the page will not be empty. Expected on the day of the read (19 of 22 working days passed — the
percents move with the day):

| KPI | Monthly target | Actual to date | Pace | Status |
| --- | --- | --- | --- | --- |
| Problem solving | 0 | 10 | — | Not measured |
| Cost savings | 3 | 2 | 77% | At risk |
| MoU / strategic signing | 1 | 1 | 116% | On track |
| MoU / strategic signing — deal value (SAR) | 100,000 | 0 | 0% | Behind |
| Contract signed | 2 | 3 | 174% | On track |
| Contract signed — deal value (SAR) | 200,000 | 12,000 | 7% | Behind |

Counts: On track 2 · At risk 1 · Behind 2. Every KPI: Responsible "Not set", Initiatives "None linked yet" (no TEST
achievement belongs to a project, and nobody has been set Responsible).

1. As Workspace Admin: Reports → **KPI pace**. The table above; the pencil on each KPI opens the 2026 plan in
   Settings → Targets; Reports is highlighted in the menu; the curve marks today.
2. Year **2025**: November 2025's three TEST targets, judged on their whole target (a finished month), no today mark.
3. Step to a month with no target (2024): "No KPI has a target for this month yet".
4. Switch to **TEST Member**, then **TEST Viewer** (Settings → People & access): the same KPIs, **no pencil**.
5. Arabic (as each of the three): the page right to left, the title وتيرة مؤشرات الأداء, the drawing mirrored.
6. A phone (375 px): one column, nothing scrolls sideways.
