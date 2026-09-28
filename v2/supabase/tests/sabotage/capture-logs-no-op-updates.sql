-- Sabotage: capture-logs-no-op-updates
-- Breaks: sql:AUD-02
-- Expect: only the insert is logged
-- Every update is logged, even one that changes nothing.
create or replace function audit.capture() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then pg_catalog.to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then pg_catalog.to_jsonb(new) end;
begin
  insert into audit.change (request_id, table_name, row_id, action, fields, before, after, version_after)
  values (audit.ensure_request(), tg_table_schema || '.' || tg_table_name, coalesce(n ->> 'id', o ->> 'id')::uuid,
          pg_catalog.lower(tg_op), (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(coalesce(n, o)) k),
          o, n, (n ->> 'version')::int);
  return null;
end
$$;
