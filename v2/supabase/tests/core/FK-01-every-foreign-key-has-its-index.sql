-- FK-01 — every foreign key of v2 has an index whose leading columns are its own (Supabase's advisor:
-- unindexed_foreign_keys), except updated_by and deleted_by, which are never looked up and whose persons are never
-- hard-deleted (V111).
-- Sabotage: supabase/tests/sabotage/an-unindexed-foreign-key.sql.
do $$
declare
  missing text;
  n int;
begin
  select count(*) into n from pg_constraint c join pg_class cl on cl.oid = c.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace where c.contype = 'f' and ns.nspname = any (test.v2_schemas());
  select string_agg(format('%s (%s)', c.conrelid::regclass, cols), E'\n    ' order by 1) into missing
  from pg_constraint c
  join pg_class cl on cl.oid = c.conrelid
  join pg_namespace ns on ns.oid = cl.relnamespace
  cross join lateral (select string_agg(a.attname, ', ' order by k.ord) as cols
                      from unnest(c.conkey) with ordinality k(attnum, ord)
                      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) x
  where c.contype = 'f' and ns.nspname = any (test.v2_schemas())
    and cols not in ('updated_by', 'deleted_by')
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indpred is null
                    and (i.indkey::text || ' ') like (array_to_string(c.conkey, ' ') || ' %'));
  perform test.ok(n > 20, format('found only %s foreign keys — the test would prove nothing', n));
  perform test.ok(missing is null, format(E'foreign keys without an index:\n    %s', missing));
end $$;
