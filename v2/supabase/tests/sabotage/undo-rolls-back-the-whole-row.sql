-- Sabotage: undo-rolls-back-the-whole-row
-- Breaks: sql:UNDO-02
-- Expect: the Arabic name someone else set since stays
-- Undo puts the whole row back as it was before the request, taking back later edits to other fields (A16).
create or replace function audit.revert_change(c audit.change, p_request uuid, p_undo uuid, me uuid) returns void
language plpgsql volatile security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  cur jsonb;
  f text;
  since jsonb;
begin
  if c.action = 'delete' then
    raise exception using errcode = 'P0001', message = 'undo.cannot_undo_delete', detail = c.table_name;
  end if;
  execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1', pg_catalog.to_regclass(c.table_name))
    into cur using c.row_id;
  if cur is null then
    raise exception using errcode = '40001', message = 'undo.changed_since',
      detail = pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id)::text;
  end if;
  if c.action in ('update', 'remove', 'restore') then
    foreach f in array c.fields loop
      if (cur -> f) is distinct from (c.after -> f) then
        since := audit.changed_since(c.table_name, c.row_id, c.id, f, array[p_request, p_undo]);
        raise exception using errcode = '40001', message = 'undo.changed_since',
          detail = coalesce(since, pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id, 'field', f))::text;
      end if;
    end loop;
    perform audit.write_fields(c.table_name, c.row_id,
      (select coalesce(pg_catalog.jsonb_object_agg(k, c.before -> k), '{}'::jsonb) from pg_catalog.unnest(c.fields) k));
    -- the sabotage: the row goes back to how it was before the request, later edits to other fields included
    perform audit.write_fields(c.table_name, c.row_id,
      (select coalesce(pg_catalog.jsonb_object_agg(k, x.before -> k), '{}'::jsonb)
       from audit.change x cross join lateral pg_catalog.unnest(x.fields) k
       where x.table_name = c.table_name and x.row_id = c.row_id and x.id > c.id
         and not (x.request_id = any (array[p_request, p_undo]))));
  elsif c.action = 'insert' then
    if not (cur ? 'deleted_at') then
      raise exception using errcode = 'P0001', message = 'undo.cannot_remove', detail = c.table_name;
    end if;
    since := audit.changed_since(c.table_name, c.row_id, c.id, null, array[p_request, p_undo]);
    if since is not null or cur ->> 'deleted_at' is not null then
      raise exception using errcode = '40001', message = 'undo.changed_since',
        detail = coalesce(since, pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id))::text;
    end if;
    perform audit.write_fields(c.table_name, c.row_id,
      pg_catalog.jsonb_build_object('deleted_at', pg_catalog.now(), 'deleted_by', me, 'delete_reason', 'undo'));
  end if;
end
$$;
