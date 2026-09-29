-- Sabotage: a-list-value-in-use-is-removed
-- Breaks: sql:SETS-01
-- Expect: a value in use cannot be removed
-- Removing a list value forgets to count what uses it (V97): records keep pointing at a value that has gone.
create or replace function core.list_remove(p_list text, p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  n bigint;
  req uuid;
begin
  perform core.list_entry(e, p_id, false);
  req := audit.begin('ui', 'list.removed', pg_catalog.jsonb_build_object('list', p_list), p_reason);
  perform audit.write_fields(e.table_name, p_id, pg_catalog.jsonb_build_object('deleted_at', pg_catalog.now(),
    'deleted_by', me, 'delete_reason', p_reason));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;
