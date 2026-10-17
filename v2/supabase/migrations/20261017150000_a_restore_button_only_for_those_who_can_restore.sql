-- QA-576: Recently deleted drew Restore on every row, also where pressing it answered "not allowed" (a viewer on a
-- removed contact or achievement). core.can_restore asks the very rules core.restore asks, and answers yes or no
-- instead of raising; api.restorable takes the listed rows and returns the keys ("entity:id") this person may restore,
-- so the screen draws the button only there. It changes no rule: core.restore still decides on press.
create function core.can_restore(p_entity text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  gone timestamptz;
  who uuid;
  may_own boolean;
begin
  if me is null then
    return false;
  end if;
  e := core.can_see_record(p_entity, p_id);
  if not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(e.table_name)
                   and a.attname = 'deleted_at' and not a.attisdropped) then
    return false;
  end if;
  execute pg_catalog.format('select t.deleted_at, t.deleted_by from %s t where t.id = $1', pg_catalog.to_regclass(e.table_name))
    into gone, who using p_id;
  if gone is null then
    return false;
  end if;
  may_own := (e.page_key is null and e.level is null) or authz.record_level(me, e.table_name, p_id) >= 'own';
  if not (authz.is_admin()
          or (not (e.table_name = any (audit.access_tables()))
              and (authz.record_level(me, e.table_name, p_id) = 'full'
                   or (may_own and (who = me or me = any (core.owners_of(e.table_name, p_id))))))) then
    return false;
  end if;
  perform core.restore_needs(e.table_name, p_id);
  return true;
exception when others then
  return false;
end
$$;
revoke all on function core.can_restore(text, uuid) from public;
grant execute on function core.can_restore(text, uuid) to authenticated;

create function api.restorable(p_items jsonb) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg((x.i ->> 'entity') || ':' || (x.i ->> 'id')), '[]'::pg_catalog.jsonb)
  from pg_catalog.jsonb_array_elements(p_items) as x(i)
  where core.can_restore(x.i ->> 'entity', (x.i ->> 'id')::uuid)
$$;
revoke all on function api.restorable(jsonb) from public;
grant execute on function api.restorable(jsonb) to authenticated;
