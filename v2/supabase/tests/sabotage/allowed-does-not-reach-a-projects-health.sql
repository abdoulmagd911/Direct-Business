-- Sabotage: allowed-does-not-reach-a-projects-health
-- Breaks: sql:XTR-06
-- Expect: they say how it is going
-- A project's health looks at its owner only, as before Landing 51.
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
          or (work.row_level('work.project', p_project, me) = 'own' and me = p.owner_id)) then
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
