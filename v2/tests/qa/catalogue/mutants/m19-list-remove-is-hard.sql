-- Mutant m19-list-remove-is-hard: removing an unused list value deletes it for good
CREATE OR REPLACE FUNCTION core.list_remove(p_list text, p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  n bigint;
  req uuid;
begin
  perform core.list_entry(e, p_id, false);
  n := (core.list_uses(e.table_name, p_id) ->> 'total')::bigint;
  if n > 0 then
    raise exception using errcode = 'P0001', message = 'list.in_use', detail = n::text;
  end if;
  req := audit.begin('ui', 'list.removed', pg_catalog.jsonb_build_object('list', p_list), p_reason);
  execute pg_catalog.format('delete from %s where id = $1', e.table_name) using p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$function$
;
