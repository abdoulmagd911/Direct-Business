-- Sabotage: nothing-is-ever-late
-- Breaks: sql:ACT-01
-- Expect: logged 20 days after the day is late
-- Nothing is ever marked logged late (V400).
create or replace function core.logged_late(p_happened_on date, p_logged_at timestamptz) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(core.riyadh_day(p_logged_at) - p_happened_on
                    > coalesce((core.setting_at('work.late_days', null, core.riyadh_today()) #>> '{}')::int, 14)
                  and false and p_happened_on >= nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date,
                  false)
$$;
