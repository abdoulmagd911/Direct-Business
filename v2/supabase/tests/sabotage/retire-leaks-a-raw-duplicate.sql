-- Sabotage: retire-leaks-a-raw-duplicate
-- Breaks: sql:SETS-01
-- Expect: retiring into a term the same contract already holds is refused by name
-- A retire that would make two live rows one fails with the raw database error, not a message key.
create or replace function core.list_retire(p_list text, p_id uuid, p_replacement uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  why text := core.access_reason(p_reason);
  rep jsonb;
  r record;
  n bigint;
  moved bigint := 0;
  moved_removed bigint := 0;
  kept bigint := 0;
  defs bigint := 0;
  gone bigint;
  req uuid;
  what text;
begin
  perform core.list_entry(e, p_id, false);
  rep := core.list_entry(e, p_replacement, true);
  if p_replacement = p_id or not (rep ->> 'active')::boolean then
    raise exception using errcode = 'P0001', message = 'list.replacement_invalid';
  end if;
  req := audit.begin('ui', 'list.retired', pg_catalog.jsonb_build_object('list', p_list), why);
  begin
    for r in
      select c.conrelid::regclass::text as tbl, a.attname::text as col,
             exists (select 1 from pg_catalog.pg_attribute d where d.attrelid = c.conrelid and d.attname = 'deleted_at'
                     and not d.attisdropped) as soft
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = pg_catalog.to_regclass(e.table_name) and pg_catalog.cardinality(c.conkey) = 1
      order by 1, 2
    loop
      if core.is_history(r.tbl) or exists (select 1 from core.entity x where x.table_name = r.tbl and x.active and x.is_list) then
        execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1%s', r.tbl, r.col,
                                  case when r.soft then ' and t.deleted_at is null' else '' end)
          into n using p_id;
        if core.is_history(r.tbl) then kept := kept + n; else defs := defs + n; end if;
        continue;
      end if;
      -- rows waiting in Recently deleted move too, so a restore brings them back on the replacement (QA-97)
      gone := 0;
      if r.soft then
        execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1 and t.deleted_at is not null',
                                  r.tbl, r.col)
          into gone using p_id;
      end if;
      execute pg_catalog.format('update %s t set %I = $2 where t.%I = $1', r.tbl, r.col, r.col)
        using p_id, p_replacement;
      get diagnostics n = row_count;
      moved := moved + n - gone;
      moved_removed := moved_removed + gone;
    end loop;
  exception
    when foreign_key_violation or check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'list.retire_blocked_by_rule', detail = what;
  end;
  perform audit.write_fields(e.table_name, p_id, '{"active": false}');
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'moved_removed', moved_removed, 'kept_in_history', kept,
                                       'kept_in_lists', defs, 'request_id', req);
end
$$;
