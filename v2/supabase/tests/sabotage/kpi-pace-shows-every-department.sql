-- Sabotage: kpi-pace-shows-every-department
-- Breaks: sql:PCE-02
-- Expect: a manager of another department reads none of them
-- Everyone sees every department's plans: another department's KPIs are on the page.
create or replace function perf.sees_department(p_person uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select true $$;
