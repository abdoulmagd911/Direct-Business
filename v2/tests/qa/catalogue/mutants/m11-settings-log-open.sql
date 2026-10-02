-- Mutant m11-settings-log-open: the settings log answers any signed-in person
CREATE OR REPLACE FUNCTION core.settings_log(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(r order by (r ->> 'at')::timestamptz desc, r ->> 'request_id')
    from (
      select pg_catalog.jsonb_build_object(
               'request_id', q.id, 'at', q.at, 'actor_id', q.actor_id, 'kind', q.kind, 'label_key', q.label_key,
               'label_args', q.label_args, 'reason', q.reason, 'undone_by', q.undone_by, 'undo_of', q.undo_of,
               'changes', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                    'entity', coalesce(e.key, c.table_name), 'id', c.row_id, 'action', c.action,
                                    'fields', c.fields, 'before', c.before, 'after', c.after) order by c.id)
                           from audit.change c left join core.entity e on e.table_name = c.table_name
                           where c.request_id = q.id)) as r
      from audit.request q
      where q.kind in ('ui', 'undo') and (p_before is null or q.at < p_before)
        and exists (select 1 from audit.change c join core.entity e on e.table_name = c.table_name
                    where c.request_id = q.id and authz.is_settings_page(e.page_key))
      order by q.at desc, q.id
      limit greatest(1, least(coalesce(p_limit, 50), 500))
    ) page), '[]'::jsonb);
end
$function$
;
