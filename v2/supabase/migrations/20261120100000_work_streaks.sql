-- Landing 34 (test round of 19 Nov, item 1) — the streak line under "Today's three" on My day, and the team's
-- streaks on a manager's My team tab. Nothing is stored: a streak is read from the tasks themselves.
-- The rule (the owner's words: "working days in a row with Today's three done; Friday and Saturday do not break it"):
--   * a day counts when the person finished at least three of their own tasks that day — tasks they own, whose status
--     means done, closed on that Riyadh day, not removed. Three is "Today's three"; a day with more is still one day;
--   * Friday and Saturday are not working days: they are stepped over, they neither add to a streak nor break it;
--   * today does not break a streak while it is still short of three (the day is not over) — it adds once it has three;
--   * the streak is the number of counted working days in a row, back from today (looked at over the last 400 days).
-- work.streak_of is the one rule; api.my_streak reads it for the reader, api.team_streaks for the people the reader
-- manages (core.person.manager_id), and answers an empty list to someone who manages nobody. Forward-only (V103).
create function work.streak_of(p_person uuid) returns jsonb
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
    elsif v_day <> v_today then
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

create function work.my_streak() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return work.streak_of(me);
end
$$;

create function work.team_streaks() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'person_id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
             'days', (x.s ->> 'days')::int, 'today_done', (x.s ->> 'today_done')::int)
             order by (x.s ->> 'days')::int desc, pg_catalog.lower(p.full_name_en), p.id)
    from core.person p cross join lateral (select work.streak_of(p.id) as s) x
    where p.manager_id = me and p.kind = 'staff' and p.active and p.deleted_at is null), '[]'::jsonb);
end
$$;

create function api.my_streak() returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.my_streak() $$;
create function api.team_streaks() returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.team_streaks() $$;

revoke all on function work.streak_of(uuid), work.my_streak(), work.team_streaks(), api.my_streak(), api.team_streaks()
  from public;
grant execute on function work.my_streak(), work.team_streaks() to authenticated;
grant execute on function api.my_streak(), api.team_streaks() to authenticated;

-- (work.task already has the index this read uses: task_owner_closed on (owner_id, closed_at).)
