# D27 — KPI engine: quarterly, cumulative, owned, evidenced

PLANNED · 2026-09-28 · second builder · the oversight's order of 28 Sep (design notes: Drive KB "10 App review and target
design", §1–2). Structure only: every KPI, number, target and figure is typed by a person (the QA account); nothing here
carries a value.

## What one KPI carries

| Field | Where |
|---|---|
| Number (a person can renumber), name EN/AR, unit, sum or latest, higher/lower is better, objective, active | `kpi_definitions` (exists) |
| Cumulative (a weak quarter is made up later; on by default) | `kpi_definitions.cumulative` (new) |
| Source — manual or computed (below) | `kpi_definitions.method` (extended) + `source_service_id`, `source_filter` (new) |
| Base year, baseline value, achieved up to a year (+ which year) | `kpi_definitions` (new columns) |
| Year target and Q1–Q4 targets, company or team | `kpi_targets` (exists: year and quarter periods) |
| Q1–Q4 achieved | computed from the source (`kpi_actuals`); a person may record a quarter figure for a manual KPI (below) |
| Status, manual override + note, update note + update date, support-ticket numbers | `kpi_year_plans` (new, one per KPI and year) + `kpi_status` (new view) |
| Owners — one or more people and/or teams | `kpi_owners` (new) |

## Sources

- **Manual** — the final achievements registered to the KPI that carry **evidence** (below).
- **Finance revenue** — as today (the paid date sets the quarter, D21; exclusions and merges apply, D16).
- **Finance revenue by service** — the revenue of one service from Finance → Rules (Income by service, D24).
- **Companies won** — companies whose won date (`converted_date`) falls in the period.
- **Leads from events** — leads whose source is "Conferences" or that name an event, by the day they were added.
- **API partners** — companies marked integration type = API, counted by the day the integration went live, optionally one
  partner kind (technical integration, payment solution, sales channel …). Promo-code partnerships never count.

Computed in the database (`kpi_actuals` gains these branches), so the danger light, the scorecard and the reports read them
the same way. Money is never typed (D1): a recorded quarter figure is refused on a Finance KPI.

## Recorded quarter figures (manual KPIs only)

For a quarter whose achievements were never registered in the app (e.g. the sheet's Q1–Q2), a person records the quarter's
figure with a link to its source file. It **replaces** that quarter's achievements — never added on top — so nothing counts
twice; the screen says how many achievements it stands in for.

## Status (per KPI, year and scope)

From the cumulative pace: achieved so far against the targets due so far (past quarters in full, the current quarter
pro-rated by the days passed). A "latest" KPI compares its latest figure with the current quarter's target; a
lower-is-better KPI turns the ratio round.

| Status | When |
|---|---|
| Exceeded | the year target is already reached |
| On track | 100% or more of what is due |
| Slightly behind | 90% to 100% |
| At risk | 70% to 90% |
| Critical | under 70% |
| Pending | no target, the year not started, or nothing measured yet |

Without cumulative, each quarter is judged on its own. A manual override needs a note; the computed status stays beside it.

## Evidence

An achievement counts toward a KPI only with evidence: a proof file (its own or its task's) or a link
(`report_entries.evidence_url`). Without it, it is saved and shown as "not counted: no evidence" — a file can only be
attached once the achievement exists. The strategy team audits the source files. This narrows D3 ("proofs are optional")
for achievements that count toward a KPI.

## Renumbering

One database function renumbers any set of KPIs at once (swaps allowed); two active KPIs never share a number. The
achievement form's KPI list reads the database, so a renumbered KPI keeps its own name.

## Who

Reading: everyone signed in, as today. Changing a KPI, its targets, owners, status override, notes and recorded figures:
admins and managers with Full on Reports (D1), through one save function (`kpi_save`), in one go.
