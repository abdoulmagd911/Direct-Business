-- Sabotage: allowed-does-not-reach-a-project
-- Breaks: sql:XTR-06
-- Expect: Allowed: they change a teammate's project
-- Saving a project looks at its owner only, as before Landing 51: "Edit someone else's work — Allowed" changes
-- nothing of a teammate's project.
CREATE OR REPLACE FUNCTION work.project_save(p_id uuid, p_values jsonb, p_version integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  p work.project;
  pid uuid;
  req uuid;
  what text;
  dept uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('name', 'description', 'work_type', 'partner_id', 'owner_id', 'status', 'start_on', 'due_on',
                 'segment_id', 'happened_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if nullif(v ->> 'partner_id', '') is not null
     and not authz.can_see_as(me, 'partner.partner', (v ->> 'partner_id')::uuid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  if p_id is null then
    perform authz.require('projects', 'own');
    if nullif(v ->> 'owner_id', '') is not null and (v ->> 'owner_id')::uuid <> me and not authz.can('tasks.assign') then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
    select x.department_id into dept from core.person x
    where x.id = coalesce(nullif(v ->> 'owner_id', '')::uuid, me);
    if dept is null then
      raise exception using errcode = 'P0001', message = 'project.owner_has_no_department';
    end if;
    req := audit.begin('ui', 'project.created', null);
    perform audit.happened(nullif(v ->> 'happened_on', '')::date);
    begin
      insert into work.project (number, name, description, work_type, partner_id, owner_id, department_id, status_id,
                                start_on, due_on, segment_id, happened_on)
      values (core.format_number('PRJ', pg_catalog.date_part('year', core.riyadh_today())::int,
                                 core.next_number('project', pg_catalog.date_part('year', core.riyadh_today())::int), 3),
              pg_catalog.btrim(v ->> 'name'), nullif(pg_catalog.btrim(v ->> 'description'), ''),
              coalesce(nullif(v ->> 'work_type', ''), 'client'), nullif(v ->> 'partner_id', '')::uuid,
              coalesce(nullif(v ->> 'owner_id', '')::uuid, me), dept,
              coalesce(work.list_id('work.project_status', v ->> 'status'), work.list_id('work.project_status', 'active')),
              nullif(v ->> 'start_on', '')::date, nullif(v ->> 'due_on', '')::date,
              work.segment_of(v ->> 'segment_id'),
              coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()))
      returning id into pid;
    exception when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = work.task_refused(what);
    end;
  else
    select * into p from work.project where id = p_id and deleted_at is null;
    if p.id is null or work.row_level('work.project', p_id, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (work.row_level('work.project', p_id, me) = 'full'
            or (work.row_level('work.project', p_id, me) = 'own' and me in (p.owner_id, p.created_by))) then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'projects', 'level', 'own')::text;
    end if;
    if v ? 'owner_id' and (v ->> 'owner_id')::uuid is distinct from p.owner_id and not authz.can('tasks.assign') then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
    perform core.check_version('work.project', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
    req := audit.begin('ui', 'project.changed', null);
    begin
      update work.project set
        name = case when v ? 'name' then pg_catalog.btrim(v ->> 'name') else name end,
        description = case when v ? 'description' then nullif(pg_catalog.btrim(v ->> 'description'), '') else description end,
        work_type = case when v ? 'work_type' then coalesce(nullif(v ->> 'work_type', ''), work_type) else work_type end,
        partner_id = case when v ? 'partner_id' then nullif(v ->> 'partner_id', '')::uuid else partner_id end,
        owner_id = case when v ? 'owner_id' then coalesce(nullif(v ->> 'owner_id', '')::uuid, owner_id) else owner_id end,
        status_id = case when v ? 'status' then work.list_id('work.project_status', v ->> 'status') else status_id end,
        start_on = case when v ? 'start_on' then nullif(v ->> 'start_on', '')::date else start_on end,
        due_on = case when v ? 'due_on' then nullif(v ->> 'due_on', '')::date else due_on end,
        segment_id = case when v ? 'segment_id' then work.segment_of(v ->> 'segment_id') else segment_id end,
        happened_on = case when v ? 'happened_on' then coalesce(nullif(v ->> 'happened_on', '')::date, happened_on)
                           else happened_on end
      where id = p_id;
      update work.project x set closed_at = case when s.category in ('done', 'cancelled')
                                                 then coalesce(x.closed_at, core.clock()) end
      from work.project_status s where s.id = x.status_id and x.id = p_id;
    exception when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = work.task_refused(what);
    end;
    pid := p_id;
  end if;
  if p_id is null or (v ? 'owner_id' and (v ->> 'owner_id')::uuid is distinct from p.owner_id) then
    perform notify.push_assigned((select x.owner_id from work.project x where x.id = pid), 'assigned', 'work.project', pid,
                                 pg_catalog.jsonb_build_object('what', 'project'));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'request_id', req,
    'number', (select x.number from work.project x where x.id = pid),
    'version', (select x.version from work.project x where x.id = pid));
end
$function$;
