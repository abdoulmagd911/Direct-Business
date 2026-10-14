-- Sabotage: recently-deleted-reads-past-the-limit
-- Breaks: sql:DEL-03
-- Expect: Recently deleted stops asking at the limit
-- Recently deleted keeps asking may-see of every removed row after the limit is reached, and cuts the list afterwards.
create or replace function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  cutoff timestamptz;
  lim int := greatest(1, least(coalesce(p_limit, 100), 500));
  e core.entity;
  label text;
  label_ar text;
  parts text[] := '{}';
  r record;
  acc jsonb := '[]';
  n int := 0;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  cutoff := core.clock() - pg_catalog.make_interval(days => days);
  for e in
    select x.* from core.entity x
    where x.active and exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(x.table_name)
                                 and a.attname = 'deleted_at' and not a.attisdropped)
    order by x.key
  loop
    select pg_catalog.format('t.%I::text', a.attname) into label
    from pg_catalog.unnest(array['trade_name_en', 'title', 'name_en', 'full_name_en', 'original_name', 'key', 'value_raw',
                                 'body', 'email', 'ref']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    select pg_catalog.format('t.%I::text', a.attname) into label_ar
    from pg_catalog.unnest(array['trade_name_ar', 'name_ar', 'full_name_ar']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    parts := parts || pg_catalog.format(
      'select %L::text as entity, %L::text as tbl, t.id, %s as label, coalesce(%s, %s) as label_ar, t.deleted_at,'
      || ' t.deleted_by, t.delete_reason as reason from %s t where t.deleted_at > $1',
      e.key, e.table_name, coalesce(label, 'null::text'), coalesce(label_ar, 'null::text'),
      coalesce(label, 'null::text'), pg_catalog.to_regclass(e.table_name));
  end loop;
  if pg_catalog.cardinality(parts) = 0 then
    return acc;
  end if;
  -- Newest first; the system's removals and what this person may not see are skipped one row at a time, so the work
  -- ends at the limit instead of at the end of every record type.
  for r in execute 'select * from (' || pg_catalog.array_to_string(parts, ' union all ')
                   || ') c order by c.deleted_at desc, c.id' using cutoff
  loop
    continue when core.removed_by_system(r.tbl, r.id) or not authz.can_see_as(me, r.tbl, r.id);
    if n < lim then
      acc := acc || pg_catalog.jsonb_build_object('entity', r.entity, 'id', r.id, 'label', r.label,
        'label_ar', r.label_ar, 'deleted_at', r.deleted_at, 'deleted_by', r.deleted_by, 'reason', r.reason);
    end if;
    n := n + 1;
  end loop;
  return acc;
end
$$;
