-- Sabotage: a-next-week-is-the-same-day-as-tomorrow
-- Breaks: sql:WRAP-01
-- Expect: a Thursday: Next week is the Sunday after Tomorrow
-- Next week counts from today again, so on a Thursday, a Friday and a Saturday it is the same Sunday as Tomorrow (QA-566).
create or replace function my.next_week_day(p_day date) returns date
language plpgsql stable security definer set search_path = ''
as $$
declare
  ws int := case coalesce(core.setting_at('work.week_starts_on', null, p_day) #>> '{}', 'sunday')
              when 'saturday' then 6 when 'monday' then 1 else 0 end;
  d date := p_day + (7 - ((pg_catalog.date_part('dow', p_day)::int - ws + 7) % 7));
begin
  while pg_catalog.date_part('isodow', d)::int in (5, 6) loop
    d := d + 1;
  end loop;
  return d;
end
$$;
