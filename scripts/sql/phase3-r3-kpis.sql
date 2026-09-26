-- Phase 3 release 3 — KPIs + the danger light (2026-09-26). Release 1 already built the whole calculation:
--   kpi_actuals   — each KPI's actual per company / department / person and month / quarter / year, from the right
--                   source: finished tasks (tasks_done, tasks_on_time_pct), Finance money (finance_revenue /
--                   finance_profit / finance_collected — never typed), or final achievements carrying a value (manual);
--   kpi_scorecard — target against actual; a KPI nobody measured is NULL ("not measured"), never 0;
--   kpi_pace      — the danger light: achieved · on track · at risk · behind · missed · not measured · not started,
--                   judged against how much of the period has passed (Riyadh's today).
-- This release adds the screens (js/112) and one rule, D2 on targets and KPI definitions:
--   before: any admin or manager could set a target or change a KPI, whatever their level on Reports;
--   now:    an admin or a manager WITH FULL CONTROL on Reports — a manager set to View on Reports changes nothing there.
--   The same rule for the plan the KPIs hang on — objectives and initiatives (the oversight's review of #41: release 1's
--   loop had left them on "any manager").
-- Rollback: scripts/sql/phase3-r3-kpis.rollback.sql

drop policy if exists kpi_targets_write on public.kpi_targets;
create policy kpi_targets_write on public.kpi_targets for all to authenticated
  using (public.is_manager() and public.can_edit_page('reports'))
  with check (public.is_manager() and public.can_edit_page('reports'));

drop policy if exists kpi_definitions_write on public.kpi_definitions;
create policy kpi_definitions_write on public.kpi_definitions for all to authenticated
  using (public.is_manager() and public.can_edit_page('reports'))
  with check (public.is_manager() and public.can_edit_page('reports'));

drop policy if exists objectives_write on public.objectives;
create policy objectives_write on public.objectives for all to authenticated
  using (public.is_manager() and public.can_edit_page('reports'))
  with check (public.is_manager() and public.can_edit_page('reports'));

drop policy if exists initiatives_write on public.initiatives;
create policy initiatives_write on public.initiatives for all to authenticated
  using (public.is_manager() and public.can_edit_page('reports'))
  with check (public.is_manager() and public.can_edit_page('reports'));
