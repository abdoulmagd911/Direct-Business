-- Sabotage: a-value-used-in-recently-deleted-is-removed
-- Breaks: sql:SETS-01
-- Expect: a record in Recently deleted still uses the value, counted apart
-- "Used in" forgets records waiting in Recently deleted: the value is removed and a restore brings back a reference to it.
create or replace function core.list_uses(p_table text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r record;
  n bigint;
  gone bigint;
  total bigint := 0;
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  uses jsonb := '[]';
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col,
           exists (select 1 from pg_catalog.pg_attribute d where d.attrelid = c.conrelid and d.attname = 'deleted_at'
                   and not d.attisdropped) as soft
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = pg_catalog.to_regclass(p_table) and pg_catalog.cardinality(c.conkey) = 1
    order by 1, 2
  loop
    execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1%s', r.tbl, r.col,
                              case when r.soft then ' and t.deleted_at is null' else '' end)
      into n using p_id;
    gone := 0;
    if false then
      execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1 and t.deleted_at is not null'
                                || ' and t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)', r.tbl, r.col)
        into gone using p_id, days;
    end if;
    if n + gone > 0 then
      total := total + n + gone;
      uses := uses || pg_catalog.jsonb_build_object('table', r.tbl, 'column', r.col, 'count', n, 'in_recently_deleted', gone);
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('total', total, 'uses', uses);
end
$$;
