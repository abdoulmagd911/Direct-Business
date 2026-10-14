-- QA3-007: Recently deleted was the slowest first screen on slow 4G (2.5 s median, 3.6 s worst; the limit is 3 s, V633).
-- api.recently_deleted scanned every one of the ~94 record tables on each call (a dynamic query, two catalog lookups
-- and a full scan apiece), though only a handful ever hold a removal in the window. A removal a person made is always
-- logged as a 'remove' change, and a row without one already counts as removed by the system and is never listed
-- (core.removed_by_system), so the log names every candidate: the read now starts from the 'remove' changes in the
-- window (a small partial index) and visits only the tables that have one, each by its ids. Same rows, same order,
-- same rights. Forward-only.

create index audit_change_removed on audit.change (at desc) where action = 'remove';

create or replace function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  e core.entity;
  label text;
  label_ar text;
  part jsonb;
  acc jsonb := '[]';
  ids uuid[];
  cand record;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- only the tables with a removal logged in the window (a day's margin either side of the test clock), each with its ids
  for cand in
    select x.id as ent_id, pg_catalog.array_agg(distinct c.row_id) as row_ids
    from audit.change c
    join core.entity x on x.table_name = c.table_name and x.active
    where c.action = 'remove'
      and c.at > least(core.clock(), pg_catalog.now()) - pg_catalog.make_interval(days => days + 1)
      and exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(x.table_name)
                    and a.attname = 'deleted_at' and not a.attisdropped)
    group by x.id, x.key
    order by x.key
  loop
    select * into e from core.entity x where x.id = cand.ent_id;
    ids := cand.row_ids;
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
    execute pg_catalog.format(
      'select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(''entity'', $1, ''id'', t.id, ''label'', %s,'
      || ' ''label_ar'', coalesce(%s, %s), ''deleted_at'', t.deleted_at, ''deleted_by'', t.deleted_by,'
      || ' ''reason'', t.delete_reason)), ''[]''::jsonb)'
      || ' from %s t where t.id = any ($5) and t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
      || ' and authz.can_see_as($3, $4, t.id) and not core.removed_by_system($4, t.id)',
      coalesce(label, 'null::text'), coalesce(label_ar, 'null::text'), coalesce(label, 'null::text'),
      pg_catalog.to_regclass(e.table_name))
      into part using e.key, days, me, e.table_name, ids;
    acc := acc || part;
  end loop;
  return coalesce((select pg_catalog.jsonb_agg(x order by (x ->> 'deleted_at')::timestamptz desc)
                   from (select x from pg_catalog.jsonb_array_elements(acc) x
                         order by (x ->> 'deleted_at')::timestamptz desc
                         limit greatest(1, least(coalesce(p_limit, 100), 500))) y(x)), '[]'::jsonb);
end
$$;

