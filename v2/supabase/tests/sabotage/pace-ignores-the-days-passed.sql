-- Sabotage: pace-ignores-the-days-passed
-- Breaks: sql:PCE-01
-- Expect: with 19 of 22 days passed is 94%
-- Pace is the actual over the whole month's target, whatever the day: a KPI on its way reads as behind all month.
create or replace function perf.pace_pct(p_actual numeric, p_target numeric, p_share numeric, p_rate boolean default false)
returns int
language sql immutable security invoker set search_path = ''
as $$
  select case
    when p_target is null or p_target <= 0 or p_actual is null then null
    when not p_rate and (p_share is null or p_share <= 0) then null
    else pg_catalog.round(100 * p_actual / p_target)::int
  end
$$;
