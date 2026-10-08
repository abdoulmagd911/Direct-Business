-- P5-1 · the work measures (TECH-SPEC §3.8 "Measures in v1"; V42, V63, V88, V400): work.tasks_on_time,
-- work.action_items_on_time, work.weekly_updates, work.meeting_notes_on_time, work.pipeline_updates, partner.calls and
-- partner.demos — each a function measure.<module>_<name>(params, scope_kind, scope_id, from, to) answering
-- (value, measured, n), with an _items twin for the drill-down. Scopes: company (everything), department, team, person,
-- partner. Every one reads `happened_on`, never `created_at`; an entry logged late (V400) never counts as on time;
-- "not measured" is never 0 (M60): a ratio with nothing due says measured = false, a count of nothing is a real 0. P5-4's
-- registry maps each dotted key to its function (perf.measure_def); the KPI and appraisal reads check access, so these
-- stay inside the database. Forward-only.

create type measure.result as (value numeric, measured boolean, n integer);
create type measure.item as (entity_table text, entity_id uuid, person_id uuid, happened_on date, counted boolean);

-- ================================================================ the shared pieces
create function measure.check_scope(p_kind text) returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_kind is not null and p_kind not in ('company', 'department', 'team', 'person', 'partner') then
    raise exception using errcode = 'P0001', message = 'measure.unknown_scope', detail = p_kind;
  end if;
end
$$;

-- Whether a row belongs to a scope: company (or none) takes everything.
create function measure.in_scope(p_kind text, p_id uuid, p_person uuid, p_team uuid, p_department uuid, p_partner uuid)
  returns boolean
language sql immutable set search_path = ''
as $$
  select case coalesce(p_kind, 'company')
           when 'company' then true
           when 'person' then p_person = p_id
           when 'team' then p_team = p_id
           when 'department' then p_department = p_id
           when 'partner' then p_partner = p_id
           else false end
$$;

-- An on-time ratio: the share counted, measured only when something was due (M60).
create function measure.ratio(p_items measure.item[]) returns measure.result
language sql immutable set search_path = ''
as $$
  select (case when pg_catalog.count(*) > 0
               then pg_catalog.round(pg_catalog.count(*) filter (where i.counted)::numeric / pg_catalog.count(*), 4) end,
          pg_catalog.count(*) > 0, pg_catalog.count(*)::int)::measure.result
  from pg_catalog.unnest(p_items) i
$$;

-- A count: always measured; nothing is a real 0.
create function measure.tally(p_items measure.item[]) returns measure.result
language sql immutable set search_path = ''
as $$
  select (pg_catalog.count(*)::numeric, true, pg_catalog.count(*)::int)::measure.result from pg_catalog.unnest(p_items) i
$$;

-- The working week holding a day: it starts on work.week_starts_on (Sunday) and runs five days, Sunday to Thursday (V42).
create function measure.week_start(p_day date) returns date
language sql stable security definer set search_path = ''
as $$
  select p_day - ((pg_catalog.date_part('dow', p_day)::int
                   - coalesce(pg_catalog.array_position(array['sunday', 'monday', 'tuesday', 'wednesday', 'thursday',
                                                              'friday', 'saturday'],
                       core.setting_at('work.week_starts_on', null, p_day) #>> '{}') - 1, 0) + 7) % 7)
$$;

-- The working weeks a period judges: those whose last working day falls inside it and is over (judged today, V400).
create function measure.weeks(p_from date, p_to date) returns setof date
language sql stable security definer set search_path = ''
as $$
  select w::date from pg_catalog.generate_series(measure.week_start(p_from), p_to, interval '7 days') w
  where w::date + 4 between p_from and p_to and w::date + 4 < core.riyadh_today()
$$;

-- Whether an entry counts: never when logged late (V400) — a backfilled one never is.
create function measure.on_record(p_happened_on date, p_logged_at timestamptz, p_backfill boolean) returns boolean
language sql stable security definer set search_path = ''
as $$ select p_backfill or not core.logged_late(p_happened_on, p_logged_at) $$;

revoke all on function measure.check_scope(text), measure.in_scope(text, uuid, uuid, uuid, uuid, uuid),
  measure.ratio(measure.item[]), measure.tally(measure.item[]), measure.week_start(date), measure.weeks(date, date),
  measure.on_record(date, timestamptz, boolean) from public;

-- ================================================================ tasks on time
-- Each task due in the period and on a day already over, not cancelled: on time when it is Done, its last move to Done
-- happened on or before its due day and was not logged late. Person scope: the owner.
create function measure.work_tasks_on_time_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                 p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'work.task'::text, t.id, t.owner_id, t.due_on,
         coalesce(d.happened_on <= t.due_on and measure.on_record(d.happened_on, d.logged_at, t.origin = 'backfill'),
                  false)
  from work.task t
  join work.task_status s on s.id = t.status_id
  left join lateral (
    select c.happened_on, c.logged_at from work.task_status_change c join work.task_status cs on cs.id = c.to_status_id
    where c.task_id = t.id and c.deleted_at is null and cs.meaning = 'done'
    order by c.happened_on desc, c.logged_at desc limit 1) d on s.meaning = 'done'
  where t.deleted_at is null and s.meaning <> 'cancelled'
    and t.due_on between p_from and least(p_to, core.riyadh_today() - 1)
    and measure.in_scope(p_scope_kind, p_scope_id, t.owner_id, t.team_id, t.department_id, t.partner_id)
  order by t.due_on, t.id;
end
$$;
create function measure.work_tasks_on_time(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.ratio(pg_catalog.array_agg(i))
  from measure.work_tasks_on_time_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- ================================================================ action items (follow-ups) on time
-- Each action item due in the period and on a day already over, on a task neither removed nor cancelled: on time when
-- ticked on or before its due day. Person scope: the item's owner (its task's when it names none).
create function measure.work_action_items_on_time_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                        p_from date, p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'work.action_item'::text, a.id, coalesce(a.owner_id, t.owner_id), a.due_on,
         coalesce(a.done_on <= a.due_on, false)
  from work.action_item a
  join work.task t on t.id = a.task_id
  join work.task_status s on s.id = t.status_id
  where a.deleted_at is null and t.deleted_at is null and s.meaning <> 'cancelled'
    and a.due_on between p_from and least(p_to, core.riyadh_today() - 1)
    and measure.in_scope(p_scope_kind, p_scope_id, coalesce(a.owner_id, t.owner_id), t.team_id, t.department_id,
                         t.partner_id)
  order by a.due_on, a.id;
end
$$;
create function measure.work_action_items_on_time(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                  p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.ratio(pg_catalog.array_agg(i))
  from measure.work_action_items_on_time_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- ================================================================ weekly updates (V42)
-- A task's status meaning on a day, from its status changes (`happened_on`); before its first change, the status it was
-- raised with; nothing before it was raised.
create function measure.task_meaning_on(p_task uuid, p_day date) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.meaning from work.task_status_change c join work.task_status s on s.id = c.to_status_id
     where c.task_id = p_task and c.deleted_at is null and c.happened_on <= p_day
     order by c.happened_on desc, c.logged_at desc limit 1),
    (select coalesce((select s.meaning from work.task_status_change c join work.task_status s on s.id = c.from_status_id
                      where c.task_id = t.id and c.deleted_at is null order by c.happened_on, c.logged_at limit 1),
                     (select s.meaning from work.task_status s where s.id = t.status_id))
     from work.task t where t.id = p_task and t.happened_on <= p_day))
$$;

-- Whether a task had an update between two days: raised, a note, a status change, an action item added or ticked —
-- none logged late (V400).
create function measure.task_updated(p_task uuid, p_from date, p_to date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from work.task t
                 where t.id = p_task and t.happened_on between p_from and p_to
                   and measure.on_record(t.happened_on, t.logged_at, t.origin = 'backfill'))
      or exists (select 1 from core.note n join work.task t on t.id = n.entity_id
                 where n.entity_table = 'work.task' and n.entity_id = p_task and n.deleted_at is null
                   and n.happened_on between p_from and p_to
                   and measure.on_record(n.happened_on, n.logged_at, t.origin = 'backfill'))
      or exists (select 1 from work.task_status_change c join work.task t on t.id = c.task_id
                 where c.task_id = p_task and c.deleted_at is null and c.happened_on between p_from and p_to
                   and measure.on_record(c.happened_on, c.logged_at, t.origin = 'backfill'))
      or exists (select 1 from work.action_item a join work.task t on t.id = a.task_id
                 where a.task_id = p_task and a.deleted_at is null
                   and ((a.happened_on between p_from and p_to
                         and measure.on_record(a.happened_on, a.logged_at, t.origin = 'backfill'))
                        or a.done_on between p_from and p_to))
$$;

-- One row per person and working week (Sunday to Thursday) in which they owned a task In progress (Blocked included) on
-- its Thursday: counted when every such task had an update that week. A week with nothing in progress is not judged.
create function measure.work_weekly_updates_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                  p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'week'::text, null::uuid, x.owner_id, x.ws, pg_catalog.bool_and(x.updated)
  from (
    select t.owner_id, w.ws, measure.task_updated(t.id, w.ws, w.ws + 4) as updated
    from work.task t cross join measure.weeks(p_from, p_to) w(ws)
    where t.deleted_at is null and t.owner_id is not null and t.happened_on <= w.ws + 4
      and measure.in_scope(p_scope_kind, p_scope_id, t.owner_id, t.team_id, t.department_id, t.partner_id)
      and measure.task_meaning_on(t.id, w.ws + 4) = 'in_progress'
  ) x
  group by x.owner_id, x.ws
  order by x.ws, x.owner_id;
end
$$;
create function measure.work_weekly_updates(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.ratio(pg_catalog.array_agg(i))
  from measure.work_weekly_updates_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- ================================================================ meeting notes on time
-- Each meeting that happened in the period — a task's meeting note, or a meeting logged on an organisation: on time
-- when it was written within work.meeting_note_on_time_days (1) of the meeting. Person scope: its author; team and
-- department: the author's; partner: the organisation it is on, or its task's.
create function measure.work_meeting_notes_on_time_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                         p_from date, p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'core.note'::text, n.id, n.created_by, n.happened_on,
         core.riyadh_day(n.logged_at) - n.happened_on
           <= coalesce((core.setting_at('work.meeting_note_on_time_days', null, core.riyadh_day(n.logged_at))
                        #>> '{}')::int, 1)
  from core.note n
  left join partner.activity_type ty on ty.id = n.activity_type_id
  left join core.person p on p.id = n.created_by
  left join work.task k on n.entity_table = 'work.task' and k.id = n.entity_id
  where n.deleted_at is null and n.happened_on between p_from and least(p_to, core.riyadh_today())
    and (n.kind = 'meeting_note' or (n.kind = 'activity' and ty.key = 'meeting'))
    and measure.in_scope(p_scope_kind, p_scope_id, n.created_by, p.team_id, p.department_id,
                         case n.entity_table when 'partner.partner' then n.entity_id else k.partner_id end)
  order by n.happened_on, n.id;
end
$$;
create function measure.work_meeting_notes_on_time(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                   p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.ratio(pg_catalog.array_agg(i))
  from measure.work_meeting_notes_on_time_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- ================================================================ weekly pipeline updates (V63)
-- One row per person and working week while they were with the team (from joined_on, until left_on): their task
-- updates (notes and status changes they wrote on tasks) and logged calls that week, none logged late; counted when
-- they reach the weekly target (params.weekly_target, else work.pipeline_weekly_target, 1). Scopes: person, team,
-- department, company — the people in it; partner is not a scope of people, so nothing is judged.
create function measure.work_pipeline_updates_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                    p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'week'::text, null::uuid, p.id, w.ws,
         (select pg_catalog.count(*) from (
            select 1 from core.note n left join partner.activity_type ty on ty.id = n.activity_type_id
            where n.created_by = p.id and n.deleted_at is null and n.happened_on between w.ws and w.ws + 4
              and ((n.entity_table = 'work.task' and n.kind <> 'activity')
                   or (n.entity_table = 'partner.partner' and n.kind = 'activity' and ty.key = 'call'))
              and measure.on_record(n.happened_on, n.logged_at, false)
            union all
            select 1 from work.task_status_change c join work.task t on t.id = c.task_id
            where c.created_by = p.id and c.deleted_at is null and t.origin <> 'backfill'
              and c.happened_on between w.ws and w.ws + 4 and measure.on_record(c.happened_on, c.logged_at, false)) u)
         >= coalesce((p_params ->> 'weekly_target')::int,
                     (core.setting_at('work.pipeline_weekly_target', null, w.ws) #>> '{}')::int, 1)
  from core.person p cross join measure.weeks(p_from, p_to) w(ws)
  where p.kind = 'staff' and p.deleted_at is null and core.is_team_member(p.id)
    and coalesce(p_scope_kind, 'company') <> 'partner'
    and measure.in_scope(p_scope_kind, p_scope_id, p.id, p.team_id, p.department_id, null)
    and (p.joined_on is null or p.joined_on <= w.ws + 4) and (p.left_on is null or p.left_on >= w.ws)
  order by w.ws, p.id;
end
$$;
create function measure.work_pipeline_updates(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                              p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.ratio(pg_catalog.array_agg(i))
  from measure.work_pipeline_updates_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- ================================================================ calls and demos (V63, V88)
-- Activities on organisations that happened in the period: calls (params.outcomes: outcome keys, else every outcome),
-- and demos — any activity whose outcome counts as a demo (demo set, demo held). Person scope: the person who logged it;
-- team and department: theirs; partner: the organisation. A count: nothing is a real 0.
create function measure.activities(p_scope_kind text, p_scope_id uuid, p_from date, p_to date, p_type text,
                                   p_outcomes text[], p_demos boolean) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'core.note'::text, n.id, n.created_by, n.happened_on, true
  from core.note n
  join partner.activity_type ty on ty.id = n.activity_type_id
  left join partner.activity_outcome o on o.id = n.outcome_id
  left join core.person p on p.id = n.created_by
  where n.deleted_at is null and n.kind = 'activity' and n.entity_table = 'partner.partner'
    and n.happened_on between p_from and p_to
    and (p_type is null or ty.key = p_type)
    and (p_outcomes is null or o.key = any (p_outcomes))
    and (not p_demos or coalesce(o.counts_as_demo, false))
    and measure.in_scope(p_scope_kind, p_scope_id, n.created_by, p.team_id, p.department_id, n.entity_id)
  order by n.happened_on, n.id;
end
$$;
revoke all on function measure.activities(text, uuid, date, date, text, text[], boolean) from public;

create function measure.partner_calls_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select * from measure.activities(p_scope_kind, p_scope_id, p_from, p_to, 'call',
    (select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(p_params -> 'outcomes') x), false)
$$;
create function measure.partner_calls(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.partner_calls_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

create function measure.partner_demos_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.activities(p_scope_kind, p_scope_id, p_from, p_to, null, null, true) $$;
create function measure.partner_demos(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.partner_demos_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- Inside the database only: the KPI and appraisal reads (P5-4, P6) call them after their own access checks.
revoke all on function
  measure.task_meaning_on(uuid, date), measure.task_updated(uuid, date, date),
  measure.work_tasks_on_time_items(jsonb, text, uuid, date, date), measure.work_tasks_on_time(jsonb, text, uuid, date, date),
  measure.work_action_items_on_time_items(jsonb, text, uuid, date, date),
  measure.work_action_items_on_time(jsonb, text, uuid, date, date),
  measure.work_weekly_updates_items(jsonb, text, uuid, date, date), measure.work_weekly_updates(jsonb, text, uuid, date, date),
  measure.work_meeting_notes_on_time_items(jsonb, text, uuid, date, date),
  measure.work_meeting_notes_on_time(jsonb, text, uuid, date, date),
  measure.work_pipeline_updates_items(jsonb, text, uuid, date, date),
  measure.work_pipeline_updates(jsonb, text, uuid, date, date),
  measure.partner_calls_items(jsonb, text, uuid, date, date), measure.partner_calls(jsonb, text, uuid, date, date),
  measure.partner_demos_items(jsonb, text, uuid, date, date), measure.partner_demos(jsonb, text, uuid, date, date)
from public;
