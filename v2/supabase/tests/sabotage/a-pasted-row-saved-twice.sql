-- Sabotage: a-pasted-row-saved-twice
-- Breaks: sql:BACK-01
-- Expect: task_import_key
-- A key already held is not looked for, so the same paste twice tries to save every row again (OLD-PRF-045).
create or replace function work.backfill_tasks(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  src jsonb := p_request -> 'source';
  last_day date := nullif(src ->> 'last_day', '')::date;
  r jsonb;
  i int := -1;
  day date;
  first_day date;
  owner uuid;
  team uuid;
  st work.task_status;
  pid uuid;
  tid uuid;
  req uuid;
  what text;
  ids uuid[] := '{}';
  held jsonb := '[]'::jsonb;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request -> 'rows') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request -> 'rows') = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if coalesce(p_request ->> 'mode', 'tasks') <> 'tasks' or coalesce(p_request ->> 'origin', 'backfill') <> 'backfill' then
    raise exception using errcode = 'P0001', message = 'backfill.mode_invalid';
  end if;
  if src ->> 'kind' is null or src ->> 'period' is null or last_day is null then
    raise exception using errcode = 'P0001', message = 'backfill.source_required';
  end if;
  if last_day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  req := audit.begin('ui', 'task.backfilled', pg_catalog.jsonb_build_object(
    'count', pg_catalog.jsonb_array_length(p_request -> 'rows'), 'source', src ->> 'kind', 'period', src ->> 'period'));
  for r in select x from pg_catalog.jsonb_array_elements(p_request -> 'rows') x loop
    i := i + 1;
    day := coalesce(nullif(r ->> 'happened_on', '')::date, last_day);
    if day < date '2025-01-01' then
      raise exception using errcode = 'P0001', message = 'backfill.before_2025', detail = i::text;
    end if;
    if day > core.riyadh_today() then
      raise exception using errcode = 'P0001', message = 'common.date_in_future', detail = i::text;
    end if;
    owner := case when coalesce((r ->> 'owner_unknown')::boolean, false) then null
                  else coalesce(nullif(r ->> 'person_id', '')::uuid, me) end;
    if owner is distinct from me and not authz.can('tasks.assign') then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
    pid := nullif(r ->> 'organisation_id', '')::uuid;
    if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    st := coalesce(work.status_of(nullif(r ->> 'kind', '')), work.status_of('done'));
    if st.id is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = i::text;
    end if;
    team := coalesce((select p.team_id from core.person p where p.id = owner),
                     (select p.team_id from core.person p where p.id = me));
    if team is null then
      raise exception using errcode = 'P0001', message = 'task.team_required', detail = i::text;
    end if;
    begin
      insert into work.task (number, title, notes, owner_id, team_id, department_id, status_id, work_type, partner_id,
                             origin, happened_on, closed_at, closed_by, source_kind, source_period, date_from_report,
                             import_key)
      values (core.format_number('TSK', pg_catalog.date_part('year', core.riyadh_today())::int,
                                 core.next_number('task', pg_catalog.date_part('year', core.riyadh_today())::int)),
              pg_catalog.btrim(r ->> 'title'), nullif(pg_catalog.btrim(r ->> 'notes'), ''), owner, team,
              (select t.department_id from core.team t where t.id = team), st.id,
              case when pid is null then 'internal' else 'client' end, pid, 'backfill', day,
              case when st.meaning in ('done', 'cancelled') then core.clock() end,
              case when st.meaning in ('done', 'cancelled') then me end,
              src ->> 'kind', src ->> 'period', nullif(r ->> 'happened_on', '') is null,
              nullif(r ->> 'import_key', ''))
      returning id into tid;
    exception
      when check_violation then
        get stacked diagnostics what = constraint_name;
        raise exception using errcode = 'P0001',
          message = case when what in ('task_source_kind_check', 'task_source_period_check', 'task_source_on_backfill')
                         then 'backfill.source_required' else work.task_refused(what) end,
          detail = i::text;
      when not_null_violation then
        raise exception using errcode = 'P0001', message = 'task.title_required', detail = i::text;
    end;
    if st.meaning <> 'not_started' then
      insert into work.task_status_change (task_id, from_status_id, to_status_id, happened_on)
      values (tid, (select s.id from work.task_status s where s.is_default and s.deleted_at is null), st.id, day);
    end if;
    ids := ids || tid;
    first_day := least(coalesce(first_day, day), day);
  end loop;
  if first_day is not null then
    perform audit.happened(least(first_day, core.riyadh_today() - 1));    -- past work tells nobody (V491)
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', case when pg_catalog.cardinality(ids) > 0 then req end,
                                       'saved', pg_catalog.cardinality(ids), 'ids', pg_catalog.to_jsonb(ids),
                                       'held', held);
end
$$;
