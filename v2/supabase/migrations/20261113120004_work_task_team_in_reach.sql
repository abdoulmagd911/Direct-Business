-- Owner 13 Nov (A-tasks): work.task_update and work.task_create took any team_id they were sent. Whoever could change
-- a task could move it into another department's team — after which the task dropped out of their own lists, and its
-- owner's — and a task could be created straight into a department its maker does not work in. A named team must now
-- be in a department the person works in (work.sees_department: their department, one they were added to, or every
-- department for an admin); anything else is refused in words (task.team_out_of_reach). A task with no team named
-- still takes its owner's team, else its maker's, exactly as before (V194, V464).
-- task_create is copied from 20261109000021_fix_landing3_p1b_doors.sql and task_update from
-- 20261002010000_work_projects_tasks.sql exactly, but for the marked check. Forward-only: both replaced whole.
create or replace function work.task_create(p_values jsonb, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  owner uuid;
  named uuid := nullif(v ->> 'owner_id', '')::uuid;
  pid uuid := nullif(v ->> 'partner_id', '')::uuid;
  prj uuid := nullif(v ->> 'project_id', '')::uuid;
  team uuid;
  day date := coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today());
  origin text := coalesce(nullif(v ->> 'origin', ''), 'manual');
  past boolean;
  tid uuid;
  req uuid;
  what text;
  h uuid;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'notes', 'owner_id', 'owner_unknown', 'team_id', 'priority', 'status', 'type', 'work_type',
                 'start_on', 'due_on', 'partner_id', 'project_id', 'happened_on', 'helper_ids', 'origin') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if origin not in ('manual', 'meeting') then
    raise exception using errcode = 'P0001', message = 'task.origin_invalid', detail = origin;
  end if;
  if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  if prj is not null then
    if work.row_level('work.project', prj, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.project';
    end if;
    pid := coalesce(pid, (select p.partner_id from work.project p where p.id = prj));
  end if;
  -- owner 13 Nov: a named team is one in a department the maker works in, never another department's
  if nullif(v ->> 'team_id', '') is not null
     and not work.sees_department(me, (select x.department_id from core.team x
                                        where x.id = (v ->> 'team_id')::uuid)) then
    raise exception using errcode = 'P0001', message = 'task.team_out_of_reach', detail = v ->> 'team_id';
  end if;
  past := work.is_past(day);
  if coalesce((v ->> 'owner_unknown')::boolean, false) then
    if not past then
      raise exception using errcode = 'P0001', message = 'task.owner_required';
    end if;
    owner := null;
  else
    owner := work.default_owner(named, prj, pid, me);
  end if;
  -- P1b (own tasks only): naming another owner on work one creates is the creator's own work, so the own-task
  -- capability suffices alongside Assign. Anything else the old rule covers — ownerless work, and an owner the
  -- project or organisation defaults to — still needs Assign alone.
  if owner is distinct from me and (named is not null or owner is null)
     and not (authz.can('tasks.assign') or (named is not null and authz.can('tasks.assign_own'))) then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  team := coalesce(nullif(v ->> 'team_id', '')::uuid,
                   (select p.team_id from core.person p where p.id = owner),
                   (select p.team_id from core.person p where p.id = me));
  if team is null then
    raise exception using errcode = 'P0001', message = 'task.team_required';
  end if;
  req := audit.begin('ui', 'task.created', null);
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  begin
    insert into work.task (number, title, notes, owner_id, team_id, department_id, priority_id, status_id, type_id,
                           work_type, start_on, due_on, partner_id, project_id, origin, assigned_by, happened_on)
    -- V531: numbered in the year it happened, so a 2025 entry is TSK-2025-… and an annual report agrees with it
    values (core.format_number('TSK', pg_catalog.date_part('year', day)::int,
                               core.next_number('task', pg_catalog.date_part('year', day)::int)),
            pg_catalog.btrim(v ->> 'title'), nullif(pg_catalog.btrim(v ->> 'notes'), ''), owner, team,
            (select t.department_id from core.team t where t.id = team),
            work.list_id('work.priority', v ->> 'priority'),
            coalesce((work.status_of(nullif(v ->> 'status', ''))).id,
                     (select s.id from work.task_status s where s.is_default and s.deleted_at is null)),
            work.list_id('work.task_type', v ->> 'type'),
            coalesce(nullif(v ->> 'work_type', ''), case when pid is null and prj is null then 'internal' else 'client' end),
            nullif(v ->> 'start_on', '')::date, nullif(v ->> 'due_on', '')::date, pid, prj, origin,
            case when owner is distinct from me then me end, day)
    returning id into tid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  if (work.status_of(nullif(v ->> 'status', ''))).meaning in ('done', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'task.created_closed';
  end if;
  for h in select x::uuid from pg_catalog.jsonb_array_elements_text(coalesce(v -> 'helper_ids', '[]'::jsonb)) x loop
    insert into work.task_helper (task_id, person_id) values (tid, h);
    if not past then
      perform notify.push_assigned(h, 'helper_added', 'work.task', tid);
    end if;
  end loop;
  if not past then
    perform notify.push_assigned(owner, 'assigned', 'work.task', tid);
  end if;
  if p_mentions is not null and pg_catalog.cardinality(p_mentions) > 0 then
    perform core.note_add('task', tid, 'comment', coalesce(nullif(pg_catalog.btrim(v ->> 'notes'), ''),
                                                           pg_catalog.btrim(v ->> 'title')),
                          nullif(v ->> 'happened_on', '')::date, p_mentions);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', tid, 'request_id', req, 'owner_id', owner,
                                       'number', (select t.number from work.task t where t.id = tid));
end
$$;

create or replace function work.task_update(p_id uuid, p_values jsonb, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_id);
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  req uuid;
  what text;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'notes', 'team_id', 'priority', 'type', 'work_type', 'start_on', 'due_on', 'partner_id',
                 'project_id', 'happened_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if nullif(v ->> 'partner_id', '') is not null
     and not authz.can_see_as(authz.me(), 'partner.partner', (v ->> 'partner_id')::uuid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  if nullif(v ->> 'project_id', '') is not null
     and work.row_level('work.project', (v ->> 'project_id')::uuid, authz.me()) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.project';
  end if;
  -- owner 13 Nov: a task moves only into a team of a department its editor works in, never another department's
  if nullif(v ->> 'team_id', '') is not null and (v ->> 'team_id')::uuid is distinct from t.team_id
     and not work.sees_department(authz.me(), (select x.department_id from core.team x
                                                where x.id = (v ->> 'team_id')::uuid)) then
    raise exception using errcode = 'P0001', message = 'task.team_out_of_reach', detail = v ->> 'team_id';
  end if;
  perform core.check_version('work.task', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
  req := audit.begin('ui', 'task.changed', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_id]);
  begin
    update work.task set
      title = case when v ? 'title' then pg_catalog.btrim(v ->> 'title') else title end,
      notes = case when v ? 'notes' then nullif(pg_catalog.btrim(v ->> 'notes'), '') else notes end,
      team_id = case when v ? 'team_id' then coalesce(nullif(v ->> 'team_id', '')::uuid, team_id) else team_id end,
      priority_id = case when v ? 'priority' then work.list_id('work.priority', v ->> 'priority') else priority_id end,
      type_id = case when v ? 'type' then work.list_id('work.task_type', v ->> 'type') else type_id end,
      work_type = case when v ? 'work_type' then coalesce(nullif(v ->> 'work_type', ''), work_type) else work_type end,
      start_on = case when v ? 'start_on' then nullif(v ->> 'start_on', '')::date else start_on end,
      due_on = case when v ? 'due_on' then nullif(v ->> 'due_on', '')::date else due_on end,
      project_id = case when v ? 'project_id' then nullif(v ->> 'project_id', '')::uuid else project_id end,
      partner_id = case when v ? 'partner_id' then nullif(v ->> 'partner_id', '')::uuid
                        when v ? 'project_id' and nullif(v ->> 'project_id', '') is not null
                          then (select p.partner_id from work.project p where p.id = (v ->> 'project_id')::uuid)
                        else partner_id end,
      happened_on = case when v ? 'happened_on' then coalesce(nullif(v ->> 'happened_on', '')::date, happened_on)
                         else happened_on end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'version', (select x.version from work.task x where x.id = p_id));
end
$$;
