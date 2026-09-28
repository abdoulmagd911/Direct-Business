-- GRANTS-04 — a function created after the foundation is executable by nobody but its owner until its migration
-- grants it: the default privileges were revoked once, for every later migration (A8).
-- Sabotage: supabase/tests/sabotage/open-default-execute.sql.
create function core.zz_probe_not_granted() returns int language sql as 'select 1';
select test.ok(not has_function_privilege('anon', 'core.zz_probe_not_granted()', 'execute'), 'anon may not execute it');
select test.ok(not has_function_privilege('authenticated', 'core.zz_probe_not_granted()', 'execute'),
  'authenticated may not execute it');
select test.ok(not exists (
  select 1 from aclexplode((select coalesce(proacl, acldefault('f', proowner)) from pg_proc
    where oid = 'core.zz_probe_not_granted()'::regprocedure)) a where a.grantee = 0),
  'PUBLIC holds no execute on it');
create table core.zz_probe_table (id int);
select test.ok(not has_table_privilege('authenticated', 'core.zz_probe_table', 'select'),
  'a new table is not readable until its migration grants it');
