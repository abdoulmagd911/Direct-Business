-- 13 Nov (the coordinating session): Recently deleted timed out. For EVERY removal of the 30-day window — all the
-- tables — the read asked "may this person see it?" (core.deleted_visible) and "can it be restored?"
-- (core.restore_refusal), built its name, and only then kept the newest 100. With 754 removals in the window (two runs
-- of the browser suite on the local stack) it took 9.3 s as a signed-in admin, alone, and up to 16 s under load: past
-- the request roles' 8 s statement timeout, so Recently deleted and the Activity page's tab came back empty ("Couldn't
-- load"). A team that removes a few dozen things a day reaches that in a month.
--
-- Now in three steps: (1) every removal of the window still removed and not the system's (core.removed_by_system,
-- as before), with only its table, id and time; (2) newest first, core.deleted_visible for each until p_limit rows
-- passed — the check stops when the page is full; (3) only for those rows, the name and core.restore_refusal, exactly
-- as before. What the list shows is unchanged: the same rows (each row passes the same three checks the one query
-- asked), the same newest-first order, the same fields and name columns (20261113150000). Grants unchanged (create or
-- replace keeps them); no signature change. Forward-only (V103).
create or replace function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  lim int := greatest(1, least(coalesce(p_limit, 100), 500));
  e core.entity;
  label text;
  label_ar text;
  part jsonb;
  seen jsonb := '[]';
  keep jsonb := '[]';
  kept int := 0;
  acc jsonb := '[]';
  cand record;
  r record;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- 1. only the tables with a removal logged in the window (a day's margin either side of the test clock), each with
  --    its ids; of those rows, the ones still removed in the window and not removed by the system: table, id, time
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
    execute pg_catalog.format(
      'select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(''e'', $1, ''t'', $4, ''id'', t.id,'
      || ' ''at'', t.deleted_at)), ''[]''::jsonb) from %s t'
      || ' where t.id = any ($5) and t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
      || ' and not core.removed_by_system($4, t.id)',
      pg_catalog.to_regclass(e.table_name))
      into part using e.id, days, me, e.table_name, cand.row_ids;
    seen := seen || part;
  end loop;
  -- 2. newest first, the ones this person may see, until the page is full
  for r in
    select x from pg_catalog.jsonb_array_elements(seen) x order by (x ->> 'at')::timestamptz desc
  loop
    exit when kept >= lim;
    if core.deleted_visible(r.x ->> 't', (r.x ->> 'id')::uuid, me) then
      keep := keep || pg_catalog.jsonb_build_array(r.x);
      kept := kept + 1;
    end if;
  end loop;
  -- 3. only for those: the name (the first name column the table has) and whether it can be restored
  for cand in
    select (k ->> 'e')::uuid as ent_id, pg_catalog.array_agg((k ->> 'id')::uuid) as row_ids
    from pg_catalog.jsonb_array_elements(keep) k
    group by (k ->> 'e')::uuid
  loop
    select * into e from core.entity x where x.id = cand.ent_id;
    select pg_catalog.format('t.%I::text', a.attname) into label
    from pg_catalog.unnest(array['trade_name_en', 'title', 'name_en', 'full_name_en', 'original_name', 'key', 'value_raw',
                                 'body', 'email', 'ref', 'text', 'name']) with ordinality w(col, o)
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
      || ' ''reason'', t.delete_reason, ''can_restore'', z.refused is null,'
      || ' ''restore_blocked'', z.refused ->> ''reason'')), ''[]''::jsonb)'
      || ' from %s t cross join lateral (select core.restore_refusal($4, t.id, t.deleted_by) as refused) z'
      || ' where t.id = any ($5)',
      coalesce(label, 'null::text'), coalesce(label_ar, 'null::text'), coalesce(label, 'null::text'),
      pg_catalog.to_regclass(e.table_name))
      into part using e.key, days, me, e.table_name, cand.row_ids;
    acc := acc || part;
  end loop;
  return coalesce((select pg_catalog.jsonb_agg(x order by (x ->> 'deleted_at')::timestamptz desc)
                   from (select x from pg_catalog.jsonb_array_elements(acc) x
                         order by (x ->> 'deleted_at')::timestamptz desc
                         limit lim) y(x)), '[]'::jsonb);
end
$$;
