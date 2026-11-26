-- Sabotage: a-rate-is-paced-by-the-days
-- Breaks: sql:PCE-01
-- Expect: a rate of 80 against 92 is 87%
-- A rate KPI is divided by the share of the month passed like a running total: 80 against 92 reads as over 100%.
create or replace function perf.pace_pct(p_actual numeric, p_target numeric, p_share numeric, p_rate boolean default false)
returns int
language sql immutable security invoker set search_path = ''
as $$
  select case
    when p_target is null or p_target <= 0 or p_actual is null then null
    when p_share is null or p_share <= 0 then null
    else pg_catalog.round(100 * p_actual / (p_target * p_share))::int
  end
$$;
