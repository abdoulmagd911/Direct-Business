-- SEC-01 — every function of v2 pins its search_path (Supabase's advisor: function_search_path_mutable), so a caller
-- can never slip in an object that shadows one it uses; for a security-definer function that would be an escalation.
-- Sabotage: supabase/tests/sabotage/a-function-with-an-open-search-path.sql.
do $$
declare
  open_fns text;
  n int;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = any (test.v2_schemas()) and p.prokind in ('f', 'p');
  select string_agg(format('%s.%s(%s)', ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
                    E'\n    ' order by 1) into open_fns
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = any (test.v2_schemas()) and p.prokind in ('f', 'p')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search\_path=%');
  perform test.ok(n > 10, format('found only %s functions — the test would prove nothing', n));
  perform test.ok(open_fns is null, format(E'functions without a pinned search_path:\n    %s', open_fns));
end $$;
