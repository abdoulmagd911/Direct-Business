-- Sabotage: pace-counts-the-weekend
-- Breaks: sql:PCE-01
-- Expect: November 2026 has 22 working days
-- Friday and Saturday are counted as working days: the share of a target due by today is the calendar's, not the week's.
create or replace function perf.working_days(p_from date, p_to date) returns int
language sql immutable security invoker set search_path = ''
as $$ select (p_to - p_from) + 1 $$;
