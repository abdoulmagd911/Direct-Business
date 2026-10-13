-- Mutant m15-list-key-changes: a list entry's key may change
CREATE OR REPLACE FUNCTION core.list_save(p_list text, p_id uuid, p_values jsonb, p_version integer DEFAULT NULL::integer, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  t regclass := pg_catalog.to_regclass(e.table_name);
  cols text[];
  k text;
  cur jsonb;
  rid uuid;
  req uuid;
  what text;
  bad text;
begin
  select pg_catalog.array_agg(a.attname::text) into cols from pg_catalog.pg_attribute a
  where a.attrelid = t and a.attnum > 0 and not a.attisdropped
    and a.attname::text not in ('id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'version', 'deleted_at',
                                'deleted_by', 'delete_reason', 'meaning');
  if p_values is null or pg_catalog.jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'list.nothing_to_change';
  end if;
  if p_values ? 'meaning' then
    raise exception using errcode = 'P0001', message = 'list.meaning_locked';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_values) loop
    if not (k = any (cols)) then
      raise exception using errcode = 'P0001', message = 'list.unknown_field', detail = k;
    end if;
  end loop;
  bad := (select core.banned_word(x.value) from pg_catalog.jsonb_each_text(p_values) x
          where core.banned_word(x.value) is not null limit 1);
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'list.banned_word', detail = bad;
  end if;
  begin
    if p_id is null then
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      execute pg_catalog.format('insert into %s (%s) select %s from pg_catalog.jsonb_populate_record(null::%s, $1) x returning id',
        t, (select pg_catalog.string_agg(pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        (select pg_catalog.string_agg('x.' || pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        t)
        into rid using p_values;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1 and t.deleted_at is null', t)
        into cur using p_id;
      if cur is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      if p_values ? 'key' and (p_values -> 'key') is distinct from (cur -> 'key') then
        null;
      end if;
      perform core.check_version(e.table_name, p_id, p_version,
        (select pg_catalog.array_agg(c) from pg_catalog.jsonb_object_keys(p_values) c where (cur -> c) is distinct from (p_values -> c)));
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      perform audit.write_fields(e.table_name, p_id, p_values);
      rid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'list.key_taken', detail = p_values ->> 'key';
    when not_null_violation or check_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
  end;
  perform audit.end();
  execute pg_catalog.format('select pg_catalog.jsonb_build_object(''id'', t.id, ''version'', t.version) from %s t where t.id = $1', t)
    into cur using rid;
  return cur || pg_catalog.jsonb_build_object('request_id', req);
end
$function$
;
