-- GRANTS-05 — v2 keeps nothing in the public schema, so the automatic Data API grants Supabase gives there (which new
-- tables stop getting from 30 Oct) never decide what a request reaches: the API is the api schema alone (config.toml
-- [api] schemas), and every privilege is granted by a migration, explicitly, and pinned by GRANTS-01. Objects an
-- extension brings are the platform's, not v2's.
-- Sabotage: supabase/tests/sabotage/a-table-in-public.sql.
do $$
declare
  found text;
begin
  select string_agg(what, ', ' order by what) into found from (
    select format('%s %s', case when c.relkind in ('r', 'p') then 'table' when c.relkind = 'v' then 'view'
                                when c.relkind = 'm' then 'materialized view' when c.relkind = 'S' then 'sequence'
                                else 'foreign table' end, c.relname) as what
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
    union all
    select format('function %s(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  ) f;
  perform test.ok(found is null, format('in the public schema: %s — v2 keeps its objects in its own schemas', found));
end $$;
