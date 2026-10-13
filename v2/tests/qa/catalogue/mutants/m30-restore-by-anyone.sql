-- Mutant m30-restore-by-anyone: a viewer (anyone who sees it) may restore a removed record
CREATE OR REPLACE FUNCTION core.restore(p_entity text, p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  gone timestamptz;
  who uuid;
  req uuid;
  holder text;
begin
  if not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(e.table_name)
                   and a.attname = 'deleted_at' and not a.attisdropped) then
    raise exception using errcode = 'P0001', message = 'restore.not_removable', detail = p_entity;
  end if;
  execute pg_catalog.format('select t.deleted_at, t.deleted_by from %s t where t.id = $1', pg_catalog.to_regclass(e.table_name))
    into gone, who using p_id;
  if gone is null then
    raise exception using errcode = 'P0001', message = 'restore.not_removed';
  end if;
  if gone < core.clock() - pg_catalog.make_interval(days => days) then
    raise exception using errcode = 'P0001', message = 'restore.too_late', detail = days::text;
  end if;
  if not (authz.is_admin()
          or (e.table_name not in ('core.person_email', 'core.person_auth', 'core.person_page_level',
                                   'core.person_capability', 'core.role_page_level', 'core.role_capability')
              and (who = me
                   or authz.record_level(me, e.table_name, p_id) = 'full'
                   or (me = any (core.owners_of(e.table_name, p_id))
                       and ((e.page_key is null and e.level is null)
                            or authz.record_level(me, e.table_name, p_id) >= 'own'))))) then
    null;
  end if;
  req := audit.begin('ui', 'record.restored', pg_catalog.jsonb_build_object('entity', p_entity), p_reason);
  begin
    perform audit.write_fields(e.table_name, p_id, '{"deleted_at": null, "deleted_by": null, "delete_reason": null}');
  exception when unique_violation or exclusion_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'restore.blocked_by_duplicate', detail = holder;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$function$
;
