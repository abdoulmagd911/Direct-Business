-- WRITE-01 — every table of v2 refuses a direct INSERT, UPDATE, DELETE or TRUNCATE from a signed-in person and from
-- anon, with "permission denied": writes happen only inside api.* functions (A6 — the old app's refused writes came
-- back as 200 and 0 rows, and screens said "Saved").
-- Sabotage: supabase/tests/sabotage/grant-insert-to-authenticated.sql.
do $$
declare
  r record;
  who text;
  n int := 0;
  first_col text;
begin
  for who in select unnest(array['authenticated', 'anon']) loop
    for r in
      select n2.nspname, c.relname, c.oid
      from pg_class c join pg_namespace n2 on n2.oid = c.relnamespace
      where c.relkind in ('r', 'p') and n2.nspname = any (test.v2_schemas())
      order by 1, 2
    loop
      select attname into first_col from pg_attribute where attrelid = r.oid and attnum > 0 and not attisdropped
        order by attnum limit 1;
      if who = 'anon' then perform test.as_anon(); else perform test.as_auth(gen_random_uuid()); end if;
      perform test.raises(format('insert into %I.%I default values', r.nspname, r.relname), '42501',
        format('%s: insert into %s.%s', who, r.nspname, r.relname), '%permission denied%');
      perform test.raises(format('update %I.%I set %I = %I', r.nspname, r.relname, first_col, first_col), '42501',
        format('%s: update %s.%s', who, r.nspname, r.relname), '%permission denied%');
      perform test.raises(format('delete from %I.%I', r.nspname, r.relname), '42501',
        format('%s: delete from %s.%s', who, r.nspname, r.relname), '%permission denied%');
      perform test.raises(format('truncate %I.%I', r.nspname, r.relname), '42501',
        format('%s: truncate %s.%s', who, r.nspname, r.relname), '%permission denied%');
      perform test.as_owner();
      n := n + 1;
    end loop;
  end loop;
  perform test.ok(n > 0, 'no v2 table was found to attack — the test would prove nothing');
end $$;
