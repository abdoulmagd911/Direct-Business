-- Sabotage: a-person-is-responsible-for-a-fourth-kpi
-- Breaks: sql:PCE-03
-- Expect: a fourth KPI for the same person is refused
-- The table no longer counts what a person already holds: a fourth KPI is taken like the first.
drop trigger guard on perf.kpi_responsible;
