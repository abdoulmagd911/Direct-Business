-- Sabotage: an-older-report-overwrites-the-deal-value
-- Breaks: sql:ACH-06
-- Expect: an older report is held
-- Every report counts as newer, so an older report's deal value overwrites a newer one's (V502).
create or replace function perf.report_newer(p_kind_a text, p_period_a text, p_kind_b text, p_period_b text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select true
         or (perf.period_last_day(p_period_a) = perf.period_last_day(p_period_b)
             and p_kind_a = 'commercial_quarterly' and p_kind_b <> 'commercial_quarterly')
$$;
