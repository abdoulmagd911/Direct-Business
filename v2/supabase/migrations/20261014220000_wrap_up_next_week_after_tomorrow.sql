-- QA-566 (the Architect's ruling of 14 Oct, V632 Wrap up): "Next week" is the first working day of the week AFTER the
-- next working day. On a Thursday, a Friday and a Saturday the next working day (Tomorrow) is already the Sunday that
-- starts a new week, so Next week is the Sunday after that one: on Thu 15 Oct, Tomorrow is Sun 18 Oct and Next week is
-- Sun 25 Oct. Before, both gave Sun 18 Oct — two choices for one day. On the other days nothing changes. The client's
-- Next week chip (src/modules/my-day/when.ts) says the same. Forward-only; same name, arguments and result.
create or replace function my.next_week_day(p_day date) returns date
language plpgsql stable security definer set search_path = ''
as $$
declare
  nxt date := core.next_working_day(p_day);
  ws int := case coalesce(core.setting_at('work.week_starts_on', null, nxt) #>> '{}', 'sunday')
              when 'saturday' then 6 when 'monday' then 1 else 0 end;
  d date := nxt + (7 - ((pg_catalog.date_part('dow', nxt)::int - ws + 7) % 7));
begin
  while pg_catalog.date_part('isodow', d)::int in (5, 6) loop
    d := d + 1;
  end loop;
  return d;
end
$$;
comment on function my.next_week_day(date) is
  'The first working day of the week after the next working day (QA-566): always later than Tomorrow.';
