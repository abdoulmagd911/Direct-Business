-- Mutant m16-retire-moves-nothing: retiring a list value re-points nothing
CREATE OR REPLACE FUNCTION core.list_retire(p_list text, p_id uuid, p_replacement uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  why text := core.access_reason(p_reason);
  rep jsonb;
  r record;
  n bigint;
  moved bigint := 0;
  kept bigint := 0;
  req uuid;
begin
  perform core.list_entry(e, p_id, false);
  rep := core.list_entry(e, p_replacement, true);
  if p_replacement = p_id or not (rep ->> 'active')::boolean then
    raise exception using errcode = 'P0001', message = 'list.replacement_invalid';
  end if;
  req := audit.begin('ui', 'list.retired', pg_catalog.jsonb_build_object('list', p_list), why);
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col,
           exists (select 1 from pg_catalog.pg_attribute d where d.attrelid = c.conrelid and d.attname = 'deleted_at'
                   and not d.attisdropped) as soft
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = pg_catalog.to_regclass(e.table_name) and pg_catalog.cardinality(c.conkey) = 1
    order by 1, 2
  loop
    if r.tbl = 'partner.status_change' then
      execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1 and t.deleted_at is null', r.tbl, r.col)
        into n using p_id;
      kept := kept + n;
      continue;
    end if;
    null;
    get diagnostics n = row_count;
    moved := moved + n;
  end loop;
  perform audit.write_fields(e.table_name, p_id, '{"active": false}');
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'kept_in_history', kept, 'request_id', req);
end
$function$
;
