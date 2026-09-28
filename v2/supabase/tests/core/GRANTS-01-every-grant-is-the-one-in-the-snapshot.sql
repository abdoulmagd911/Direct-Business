-- GRANTS-01 — every privilege a request role holds on v2's schemas, tables, columns, functions and types, and every
-- default privilege of the migration role, is exactly the one written in supabase/grants.expected (A8: the old app's
-- functions became executable by anon each time they were re-created).
-- Sabotage: supabase/tests/sabotage/grant-execute-to-anon.sql, open-default-execute.sql.
do $$
declare
  missing text;
  extra text;
begin
  if not exists (select 1 from test.grants_expected) then
    perform test.fail('supabase/grants.expected is empty or missing — write it with --write-grants');
  end if;
  select string_agg(line, E'\n    ' order by line) into missing
    from (select line from test.grants_expected except select test.grants_actual()) m;
  select string_agg(line, E'\n    ' order by line) into extra
    from (select test.grants_actual() as line except select line from test.grants_expected) x;
  if missing is not null or extra is not null then
    perform test.fail(format(E'grants differ from supabase/grants.expected\n  missing:\n    %s\n  extra:\n    %s\n  '
      'a deliberate change is written with node scripts/db/test.mjs --write-grants and explained in the PR',
      coalesce(missing, '-'), coalesce(extra, '-')));
  end if;
end $$;
