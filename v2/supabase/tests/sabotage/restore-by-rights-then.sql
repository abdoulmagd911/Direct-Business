-- Sabotage: restore-by-rights-then
-- Breaks: sql:DEL-01
-- Expect: with View only now, the one who removed it cannot restore it
-- Restore trusts who removed a record instead of their rights now (V161).
create or replace function core.restore_ticketed(p_entity text, p_id uuid, p_ticket uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  gone timestamptz;
  who uuid;
  req uuid;
  holder text;
  may_own boolean;
  resync uuid[];
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
  may_own := (e.page_key is null and e.level is null) or authz.record_level(me, e.table_name, p_id) >= 'own';
  if not (authz.is_admin()
          or (not (e.table_name = any (audit.access_tables()))
              and (authz.record_level(me, e.table_name, p_id) = 'full'
                   or (who = me or (may_own and me = any (core.owners_of(e.table_name, p_id))))))) then
    raise exception using errcode = '42501', message = 'restore.not_allowed';
  end if;
  perform core.restore_needs(e.table_name, p_id);
  if e.table_name in ('core.person_email', 'core.person_auth')
     and not core.auth_ticket_take(p_ticket, 'restore', p_entity || ':' || p_id) then
    raise exception using errcode = 'P0001', message = 'restore.via_admin_route', detail = '/auth/admin/restore';
  end if;
  req := audit.begin('ui', 'record.restored', pg_catalog.jsonb_build_object('entity', p_entity), p_reason);
  begin
    perform audit.write_fields(e.table_name, p_id, '{"deleted_at": null, "deleted_by": null, "delete_reason": null}');
  exception when unique_violation or exclusion_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'restore.blocked_by_duplicate', detail = holder;
  end;
  if e.table_name in ('core.person_email', 'core.person_auth') then
    execute pg_catalog.format('select array[t.person_id] from %s t where t.id = $1', pg_catalog.to_regclass(e.table_name))
      into resync using p_id;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'auth_resync', coalesce(pg_catalog.to_jsonb(resync), '[]'::jsonb));
end
$$;
