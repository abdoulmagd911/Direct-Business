-- Sabotage: undo-deletes-an-insert
-- Breaks: sql:UNDO-04
-- Expect: an insert undone is removed, not deleted
-- Undoing an insert deletes the row instead of removing it, so nothing is left to restore or to show.
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
  elsif c.action = 'insert' then
    if not (cur ? 'deleted_at') then
      raise exception using errcode = 'P0001', message = 'undo.cannot_remove', detail = c.table_name;
    end if;
    since := audit.changed_since(c.table_name, c.row_id, c.id, null, array[p_request, p_undo]);
    if since is not null or cur ->> 'deleted_at' is not null then
      raise exception using errcode = '40001', message = 'undo.changed_since',
        detail = coalesce(since, pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id))::text;
    end if;
    execute pg_catalog.format('delete from %s where id = $1', pg_catalog.to_regclass(c.table_name)) using c.row_id;
  end if;
end
$$;
