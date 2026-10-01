-- Sabotage: a-member-assigns-to-anyone
-- Breaks: sql:TSK-01
-- Expect: a member does not give a task to someone else
-- Anyone with Own gives a new task to anyone, without the capability.
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
  past := work.is_past(day);
  if coalesce((v ->> 'owner_unknown')::boolean, false) then
    if not past then
      raise exception using errcode = 'P0001', message = 'task.owner_required';
    end if;
    owner := null;
  else
    owner := work.default_owner(named, prj, pid, me);
  end if;
  if false then
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
    values (core.format_number('TSK', pg_catalog.date_part('year', core.riyadh_today())::int,
                               core.next_number('task', pg_catalog.date_part('year', core.riyadh_today())::int)),
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
