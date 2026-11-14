-- Landing 22 — the floor moves from 2025 to 2024 (the owner's direction, 14 Nov 2026): past work, plans and
-- achievements may be dated from 1 January 2024, so 2024, 2025, 2026 and 2027 are all in reach. The V506 floor
-- (past work starts 1 January 2025) is replaced, not removed: a floor is still needed (the plan-year picker and
-- the past-work period list count down from it), and 2024 is the earliest year the owner named. Forward-only.
-- The messages follow the floor: achievement.before_2025 -> achievement.before_2024, backfill.before_2025 ->
-- backfill.before_2024 (the backfill key had no message text; it gains one in the messages files).
-- Every live department gets its 2024 plan, as 2025/2026 were seeded (20261002133000).

-- The plan's year: 2024 to 2100 (was 2025 to 2100). The constraint is PostgreSQL's auto-name for the column
-- check (plan_year_check); the achievement one is achievement_happened_on_check (named in perf.achievement_refused).
alter table perf.plan drop constraint plan_year_check;
alter table perf.plan add constraint plan_year_check check (year between 2024 and 2100);

-- An achievement's date: on or after 1 January 2024 (was 1 January 2025).
alter table perf.achievement drop constraint achievement_happened_on_check;
alter table perf.achievement add constraint achievement_happened_on_check check (happened_on >= date '2024-01-01');

-- Opens a department's plan for a year: the earliest year is 2024 (was 2025).
create or replace function perf.plan_open(p_department uuid, p_year int, p_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  pid uuid;
  req uuid;
  held uuid;
begin
  if p_department is null or not exists (select 1 from core.department d where d.id = p_department and d.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_year is null or p_year < 2024 or p_year > pg_catalog.date_part('year', core.riyadh_today())::int + 1 then
    raise exception using errcode = 'P0001', message = 'plan.year_invalid', detail = p_year::text;
  end if;
  held := perf.plan_of(p_department, p_year);
  if held is not null then
    raise exception using errcode = '23505', message = 'plan.year_taken', detail = held::text;
  end if;
  req := audit.begin('ui', 'plan.opened', pg_catalog.jsonb_build_object('year', p_year));
  pid := perf.plan_open_inner(p_department, p_year, p_name);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', 1, 'request_id', req);
end
$$;

-- The system's run: years 2024 to 2100 (was 2025 to 2100).
create or replace function perf.plans_open_missing(p_years int[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  y int;
  d uuid;
  k int := 0;
begin
  perform audit.begin('system', 'plan.opened_missing', pg_catalog.jsonb_build_object('years', pg_catalog.to_jsonb(p_years)));
  for y in select distinct x from pg_catalog.unnest(p_years) x where x between 2024 and 2100 order by x loop
    for d in select dep.id from core.department dep where dep.deleted_at is null order by dep.code loop
      if perf.plan_of(d, y) is null then
        perform perf.plan_open_inner(d, y, null);
        k := k + 1;
      end if;
    end loop;
  end loop;
  perform audit.end();
  return k;
end
$$;

-- Moving an achievement: a move that would land before the floor names the new key.
create or replace function perf.achievement_move(p_id uuid, p_to date, p_reason text, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a perf.achievement := perf.achievement_editable(p_id);
  req uuid;
begin
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if a.happened_on is null or p_to is null or core.month_of(p_to) >= core.month_of(a.happened_on) then
    raise exception using errcode = 'P0001', message = 'achievement.move_earlier_only';
  end if;
  perform core.check_version('perf.achievement', p_id, p_version, array['happened_on']);
  req := audit.begin('ui', 'achievement.moved', null, pg_catalog.btrim(p_reason));
  perform perf.quiet_if_past(array[p_id]);
  begin
    update perf.achievement set happened_on = p_to,
      period_moved_from = coalesce(period_moved_from, a.happened_on), period_move_reason = pg_catalog.btrim(p_reason),
      period_moved_by = me
    where id = p_id;
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'achievement.before_2024';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from perf.achievement x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- Past-work achievements: a row before 1 January 2024 is refused (was 1 January 2025).
create or replace function perf.backfill_achievements(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'own');
  full_access boolean := authz.level_of(authz.me(), 'kpis') >= 'full';
  src jsonb := p_request -> 'source';
  last_day date := nullif(src ->> 'last_day', '')::date;
  r jsonb;
  i int := -1;
  day date;
  first_day date;
  owner uuid;
  dept uuid;
  pl uuid;
  c perf.achievement_category;
  pid uuid;
  val numeric;
  cur perf.achievement;
  aid uuid;
  req uuid;
  what text;
  ids uuid[] := '{}';
  touched uuid[] := '{}';
  held jsonb := '[]'::jsonb;
  updated jsonb := '[]'::jsonb;
  kept jsonb := '[]'::jsonb;
  repeats jsonb := '[]'::jsonb;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request -> 'rows') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request -> 'rows') = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if coalesce(p_request ->> 'mode', 'achievements') <> 'achievements'
     or coalesce(p_request ->> 'origin', 'backfill') <> 'backfill' then
    raise exception using errcode = 'P0001', message = 'backfill.mode_invalid';
  end if;
  if src ->> 'kind' is null or src ->> 'kind' not in ('bd_monthly', 'partnerships', 'commercial_quarterly', 'improvements')
     or perf.period_last_day(src ->> 'period') is null or last_day is distinct from perf.period_last_day(src ->> 'period')
     or ((src ->> 'kind' = 'commercial_quarterly') <> (src ->> 'period' ~ 'Q')) then
    raise exception using errcode = 'P0001', message = 'backfill.source_required';
  end if;
  if last_day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  req := audit.begin('ui', 'achievement.backfilled', pg_catalog.jsonb_build_object(
    'count', pg_catalog.jsonb_array_length(p_request -> 'rows'), 'source', src ->> 'kind', 'period', src ->> 'period'));
  for r in select x from pg_catalog.jsonb_array_elements(p_request -> 'rows') x loop
    i := i + 1;
    val := nullif(r ->> 'value', '')::numeric;
    if val < 0 then
      raise exception using errcode = 'P0001', message = 'achievement.value_invalid', detail = i::text;
    end if;
    -- A key already held: left out — or its deal value taken from a newer report (V502).
    select * into cur from perf.achievement a
    where a.import_key = nullif(r ->> 'import_key', '') and a.deleted_at is null;
    if cur.id is not null then
      if val is not null and val is distinct from cur.deal_value then
        if not perf.can_edit(me, cur) then
          raise exception using errcode = '42501', message = 'access.needs_level',
            detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'own', 'row', i)::text;
        end if;
        if cur.deal_value is null
           or (cur.value_report_kind is not null
               and perf.report_newer(src ->> 'kind', src ->> 'period', cur.value_report_kind, cur.value_report_period)) then
          begin
            update perf.achievement set deal_value = val, value_report_kind = src ->> 'kind',
              value_report_period = src ->> 'period'
            where id = cur.id;
          exception
            when check_violation then
              get stacked diagnostics what = constraint_name;
              raise exception using errcode = 'P0001', message = perf.achievement_refused(what), detail = i::text;
            when raise_exception then
              get stacked diagnostics what = message_text;
              raise exception using errcode = 'P0001', message = what, detail = i::text;
          end;
          updated := updated || pg_catalog.to_jsonb(cur.import_key);
          touched := touched || cur.id;
          first_day := least(coalesce(first_day, cur.happened_on), cur.happened_on);
          continue;
        end if;
        if cur.value_report_kind is null then
          kept := kept || pg_catalog.to_jsonb(cur.import_key);
          continue;
        end if;
      end if;
      held := held || pg_catalog.to_jsonb(cur.import_key);
      continue;
    end if;
    day := coalesce(nullif(r ->> 'happened_on', '')::date, last_day);
    if day < date '2024-01-01' then
      raise exception using errcode = 'P0001', message = 'backfill.before_2024', detail = i::text;
    end if;
    if day > core.riyadh_today() then
      raise exception using errcode = 'P0001', message = 'common.date_in_future', detail = i::text;
    end if;
    owner := case when coalesce((r ->> 'owner_unknown')::boolean, false) then null
                  else coalesce(nullif(r ->> 'person_id', '')::uuid, me) end;
    if owner is distinct from me and not full_access then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'full', 'row', i)::text;
    end if;
    dept := coalesce((select p.department_id from core.person p where p.id = owner),
                     (select p.department_id from core.person p where p.id = me));
    if not perf.sees_department(me, dept) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    pl := perf.plan_of(dept, pg_catalog.date_part('year', day)::int);
    if pl is null then
      raise exception using errcode = 'P0001', message = 'achievement.no_plan',
        detail = i::text || ':' || pg_catalog.date_part('year', day)::int;
    end if;
    c := perf.category_in(pl, r ->> 'kind');
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = i::text;
    end if;
    -- A category's required reference is asked of live work only: the report stands as past work's evidence (V506).
    pid := nullif(r ->> 'organisation_id', '')::uuid;
    if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    begin
      insert into perf.achievement (number, plan_id, department_id, category_id, partner_id, title, notes, deal_value,
                                    value_report_kind, value_report_period, happened_on, owner_id, origin, source_kind,
                                    source_period, date_from_report, import_key)
      values (perf.number_for(pg_catalog.date_part('year', day)::int), pl, dept, c.id, pid, pg_catalog.btrim(r ->> 'title'), nullif(pg_catalog.btrim(r ->> 'notes'), ''), val,
              case when val is not null then src ->> 'kind' end, case when val is not null then src ->> 'period' end,
              day, owner, 'backfill', src ->> 'kind', src ->> 'period', nullif(r ->> 'happened_on', '') is null,
              nullif(r ->> 'import_key', ''))
      returning id into aid;
    exception
      when check_violation or not_null_violation then
        get stacked diagnostics what = constraint_name;
        raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_title_check')),
          detail = i::text;
      when raise_exception then
        get stacked diagnostics what = message_text;
        raise exception using errcode = 'P0001', message = what, detail = i::text;
    end;
    ids := ids || aid;
    first_day := least(coalesce(first_day, day), day);
    -- V531: a paste never prompts; it names the rows that may repeat an earlier achievement.
    if pid is not null then
      repeats := repeats || (select pg_catalog.jsonb_build_object('row', i, 'id', aid, 'matches', m)
                             from (select perf.repeats_for(me, pid, c.code, r ->> 'title', day, aid) as m) x
                             where m <> '[]'::jsonb);
    end if;
  end loop;
  if first_day is not null then
    perform audit.happened(least(first_day, core.riyadh_today() - 1));    -- past work tells nobody (V491)
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object(
    'request_id', case when pg_catalog.cardinality(ids) + pg_catalog.cardinality(touched) > 0 then req end,
    'saved', pg_catalog.cardinality(ids), 'ids', pg_catalog.to_jsonb(ids),
    'held', held, 'updated', updated, 'kept', kept, 'repeats', repeats);
end
$$;

-- Past-work tasks: a row before 1 January 2024 is refused (was 1 January 2025).
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
    if nullif(r ->> 'import_key', '') is not null
       and exists (select 1 from work.task t where t.import_key = r ->> 'import_key' and t.deleted_at is null) then
      held := held || pg_catalog.to_jsonb(r ->> 'import_key');
      continue;
    end if;
    day := coalesce(nullif(r ->> 'happened_on', '')::date, last_day);
    if day < date '2024-01-01' then
      raise exception using errcode = 'P0001', message = 'backfill.before_2024', detail = i::text;
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
      values (core.format_number('TSK', pg_catalog.date_part('year', day)::int,                      -- V531
                                 core.next_number('task', pg_catalog.date_part('year', day)::int)),
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

-- The refused-check mapping: the happened-on check names the new key.
create or replace function perf.achievement_refused(p_constraint text) returns text
language sql immutable set search_path = ''
as $$
  select case p_constraint
    when 'achievement_title_check' then 'achievement.title_required'
    when 'achievement_notes_check' then 'achievement.notes_too_long'
    when 'achievement_count_check' then 'achievement.count_invalid'
    when 'achievement_deal_value_check' then 'achievement.value_invalid'
    when 'achievement_happened_on_check' then 'achievement.before_2024'
    when 'achievement_not_after_logged' then 'common.date_in_future'
    when 'achievement_ref_value_check' then 'achievement.ref_value_required'
    when 'achievement_ref_url_check' then 'achievement.ref_url_invalid'
    when 'achievement_ref_no_secrets' then 'achievement.ref_looks_secret'
    when 'achievement_participant_role_check' then 'achievement.role_too_long'
    else 'common.invalid' end
$$;

-- Every live department gets its 2024 plan (as 2025/2026 were seeded).
select perf.plans_open_missing(array[2024]);
