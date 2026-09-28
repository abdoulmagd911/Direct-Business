-- GRANTS-03 — a caller who is not signed in reaches nothing in v2: no schema, table, column or function, and no
-- function of v2 is executable by PUBLIC (M87; A8).
-- Sabotage: supabase/tests/sabotage/grant-execute-to-anon.sql.
do $$
declare
  found text;
begin
  select string_agg(what, E'\n    ') into found from (
    select 'schema ' || nspname as what from pg_namespace
      where nspname = any (test.v2_schemas()) and has_schema_privilege('anon', oid, 'usage')
    union all
    select format('%s.%s', n.nspname, c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any (test.v2_schemas()) and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
        and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
          or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))
    union all
    select format('%s.%s(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = any (test.v2_schemas())
        and (has_function_privilege('anon', p.oid, 'execute')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0))
  ) f;
  perform test.ok(found is null, format(E'reachable without signing in:\n    %s', found));
end $$;
