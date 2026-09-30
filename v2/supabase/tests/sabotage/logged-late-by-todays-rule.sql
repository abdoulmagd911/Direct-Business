-- Sabotage: logged-late-by-todays-rule
-- Breaks: sql:LATE-01
-- Expect: fine under the 14 days in force then
-- Logged late reads today's work.late_days (PRF-143): a stricter value turns yesterday's entries late after the fact.
create or replace function core.logged_late(p_happened_on date, p_logged_at timestamptz) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(core.riyadh_day(p_logged_at) - p_happened_on
                    > coalesce((core.setting_at('work.late_days', null, core.riyadh_today()) #>> '{}')::int, 14)
                  and p_happened_on >= nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date,
                  false)
$$;
