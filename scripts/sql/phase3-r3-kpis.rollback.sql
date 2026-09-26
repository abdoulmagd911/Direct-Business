-- Rollback of scripts/sql/phase3-r3-kpis.sql: targets and KPI definitions go back to "any admin or manager"
-- (release 1's rule). No rows are touched.
drop policy if exists kpi_targets_write on public.kpi_targets;
create policy kpi_targets_write on public.kpi_targets for all using (is_manager()) with check (is_manager());
drop policy if exists kpi_definitions_write on public.kpi_definitions;
create policy kpi_definitions_write on public.kpi_definitions for all using (is_manager()) with check (is_manager());
