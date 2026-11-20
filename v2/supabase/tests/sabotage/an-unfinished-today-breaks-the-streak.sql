-- Sabotage: an-unfinished-today-breaks-the-streak
-- Breaks: sql:STR-01
-- Expect: two days of three: a streak of 2, and today (still at 0) does not break it
-- A today still short of three ends the streak.
create or replace function work.streak_of(p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := core.riyadh_today();
  v_day date := v_today;
  v_done int;
  v_days int := 0;
  v_today_done int := 0;
  v_last date;
begin
  for i in 0..400 loop
    v_day := v_today - i;
    -- Friday (5) and Saturday (6) are stepped over
    continue when pg_catalog.date_part('dow', v_day) in (5, 6);
    select pg_catalog.count(*) into v_done
    from work.task t join work.task_status s on s.id = t.status_id
    where t.owner_id = p_person and t.deleted_at is null and s.meaning = 'done'
      and t.closed_at is not null and core.riyadh_day(t.closed_at) = v_day;
    if v_day = v_today then
      v_today_done := v_done;
    end if;
    if v_done >= 3 then
      v_days := v_days + 1;
      v_last := coalesce(v_last, v_day);
    else
      exit;
    end if;
  end loop;
  -- a weekend day's own work is still shown as today's count
  if pg_catalog.date_part('dow', v_today) in (5, 6) then
    select pg_catalog.count(*) into v_today_done
    from work.task t join work.task_status s on s.id = t.status_id
    where t.owner_id = p_person and t.deleted_at is null and s.meaning = 'done'
      and t.closed_at is not null and core.riyadh_day(t.closed_at) = v_today;
  end if;
  return pg_catalog.jsonb_build_object('days', v_days, 'today_done', v_today_done, 'target', 3,
    'today_counts', v_today_done >= 3 and pg_catalog.date_part('dow', v_today) not in (5, 6),
    'last_counted_on', v_last);
end
$$;
