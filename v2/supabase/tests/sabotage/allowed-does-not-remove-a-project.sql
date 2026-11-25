-- Sabotage: allowed-does-not-remove-a-project
-- Breaks: sql:XTR-06
-- Expect: Allowed: they remove a teammate's project
-- Removing a project looks at its owner only, as before Landing 51.
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
            or (work.row_level('work.project', i, me) = 'own' and me in (p.owner_id, p.created_by))) then
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
