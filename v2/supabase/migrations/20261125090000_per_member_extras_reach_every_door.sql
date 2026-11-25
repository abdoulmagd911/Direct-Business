-- Landing 51 — per-member settings reach every door (the owner's approved design of 22 Nov 2026).
-- Landing 40 made the three extras real rules of the database. Checked door by door on 25 Nov, three places did not
-- yet ask for them. This file closes the three; nothing else changes, and no data is changed.
--   1. The older import door (api.finance_import) asked for the capability alone: a person whose role became Viewer
--      while their record still said "Allowed" passed it, and it never asked for Finance at Full. It now asks what
--      the other import doors ask (work.import_require), and that one rule also asks for Finance at Full.
--   2. A project (save, health, remove) looked at its owner only: "Edit someone else's work — Allowed" did not reach
--      it, though it reaches tasks, achievements, organisations and pipeline cards.
--   3. A file on an organisation's side looked at the side's owners only, where the side itself already takes the
--      extra (partner.side_writable).
-- Finance entries keep their page-level rule (Landing 34b): "own clients only" on Finance is NOT built here.
-- Each function below is the statement the database held, word for word, with only the lines marked changed.

-- ---------------------------------------------------------------- Import files on Finance
create or replace function work.import_require() returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.require_capability('finance.import');
begin
  if not core.extra_access(me, 'finance.import') then
    raise exception using errcode = '42501', message = 'access.needs_capability',
      detail = pg_catalog.jsonb_build_object('capability', 'finance.import')::text;
  end if;
  -- Landing 51: importing writes Finance, so it needs Finance at Full at every door (the newer doors already asked).
  perform authz.require('finance', 'full');
end
$$;
comment on function work.import_require() is 'Landing 40, 51: importing needs the extra finance.import (Admin and Head by role, or a person set to Allowed; never a Viewer) and Finance at Full.';

CREATE OR REPLACE FUNCTION api.finance_import(p_file text, p_rows jsonb, p_export_time timestamp with time zone, p_file_name text DEFAULT NULL::text, p_sha256 text DEFAULT NULL::text, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  -- Landing 51: the same rule as the other import doors — the extra finance.import, never a Viewer, Finance at Full.
  perform work.import_require();
  return finance.import_run(p_file, p_rows, p_export_time, p_file_name, p_sha256, p_dry_run);
exception when sqlstate 'P0001' then
  -- the preview: everything above was rolled back; its answer is in the message's detail
  declare
    m text; d text;
  begin
    get stacked diagnostics m = message_text, d = pg_exception_detail;
    if m = 'finance.import_dry_run' then
      return d::jsonb || '{"dry_run": true}'::jsonb;
    end if;
    raise;
  end;
end
$function$;

-- ---------------------------------------------------------------- Edit someone else's work: a project
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
            or (work.row_level('work.project', p_id, me) = 'own' and (me in (p.owner_id, p.created_by)
                                                                 or core.extra_access(me, 'records.edit_others')))) then
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

CREATE OR REPLACE FUNCTION work.project_health_set(p_project uuid, p_health text, p_line text, p_happened_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  p work.project;
  hid uuid;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from work.project where id = p_project and deleted_at is null;
  if p.id is null or work.row_level('work.project', p_project, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not (work.row_level('work.project', p_project, me) = 'full'
          or (work.row_level('work.project', p_project, me) = 'own'
              and (me = p.owner_id or core.extra_access(me, 'records.edit_others')))) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'projects', 'level', 'own')::text;
  end if;
  req := audit.begin('ui', 'project.health_set', pg_catalog.jsonb_build_object('health', p_health));
  perform audit.happened(p_happened_on);
  begin
    insert into work.project_health (project_id, health, line, happened_on)
    values (p_project, p_health, pg_catalog.btrim(p_line), coalesce(p_happened_on, core.riyadh_today()))
    returning id into hid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001',
      message = case when what = 'project_health_health_check' then 'project.health_invalid' else work.task_refused(what) end;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', hid, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION work.projects_remove(p_ids uuid[], p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  i uuid;
  p work.project;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  foreach i in array p_ids loop
    select * into p from work.project where id = i and deleted_at is null;
    if p.id is null or work.row_level('work.project', i, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (work.row_level('work.project', i, me) = 'full'
            or (work.row_level('work.project', i, me) = 'own' and (me in (p.owner_id, p.created_by)
                                                                 or core.extra_access(me, 'records.edit_others')))) then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'projects', 'level', 'own')::text;
    end if;
    if exists (select 1 from work.task t where t.project_id = i and t.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'project.has_tasks', detail = p.number;
    end if;
  end loop;
  req := audit.begin('ui', 'project.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update work.project set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$function$;

-- ---------------------------------------------------------------- Edit someone else's work: a file on a side
CREATE OR REPLACE FUNCTION core.file_may_change(p_file uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
begin
  if me is null then
    return false;
  end if;
  return authz.is_admin()
      or exists (select 1 from core.file f where f.id = p_file and f.created_by = me)
      or exists (select 1 from core.file_link l
                 where l.file_id = p_file and l.deleted_at is null and l.purpose <> 'avatar'
                   and case when l.side is not null
                            then partner.level_of(me, l.entity_id, l.side) = 'full'
                                 or (partner.level_of(me, l.entity_id, l.side) >= 'own'
                                     and (me in (select partner.side_owners(l.entity_id, l.side))
                                          or core.extra_access(me, 'records.edit_others')))
                            else core.may_write(l.entity_table, l.entity_id) end);
end
$function$;
