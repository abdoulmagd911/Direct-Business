-- Sabotage: the-working-week-starts-on-monday
-- Breaks: sql:MSR-02
-- Expect: a working week starts on Sunday
-- The working week is read a day off: Monday to Friday instead of Sunday to Thursday (V42).
create or replace function measure.week_start(p_day date) returns date
language sql stable security definer set search_path = ''
as $$
  select p_day - ((pg_catalog.date_part('dow', p_day)::int
                   - coalesce(pg_catalog.array_position(array['sunday', 'monday', 'tuesday', 'wednesday', 'thursday',
                                                              'friday', 'saturday'],
                       core.setting_at('work.week_starts_on', null, p_day) #>> '{}'), 0) + 7) % 7)
$$;
