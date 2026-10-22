-- QA-585 (QA 2, 22 Oct): Recently deleted offered Restore that the restore then refused. A member saw Restore on a
-- removed Side owner, and the door said access.needs_capability (a side's owner is restored only by who holds that
-- side's Assign, core.restore_needs); a manager, a head and an admin saw it too, and the door said
-- restore.blocked_by_duplicate (the owner who replaced it holds the same days, side_owner_one_at_a_time). The list
-- asked core.may_restore alone; the door asked that, then restore_needs, then met the uniqueness rule on the write.
-- Now one function, core.restore_refusal, answers for both: the first reason the caller's restore would be refused —
-- may_restore, restore_needs, then any unique index or exclusion constraint of the record's table that a live row
-- already holds — or null. core.restore_ticketed raises that reason (same code, same message); each row of
-- core.recently_deleted carries can_restore (it is null) and restore_blocked (the reason's key) for Builder B2's line.
-- The write keeps its own catch of a uniqueness clash, for a row added between the check and the write.
-- core.restore_ticketed and core.recently_deleted are as 20261017181000 left them, but for those lines. Forward-only (V103).

-- Would restoring this removed row break a unique index or an exclusion constraint of its table? The name of the
-- first one a live row already holds, or null. Each is read from the catalogue, so a rule added later is checked too.
-- The removed row is compared as it would be once restored (its removal fields cleared); the index's own condition
-- (where deleted_at is null …) is applied to both rows; a key with an empty part never clashes in a unique index.
create function core.restore_duplicate(p_table text, p_id uuid) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  rel regclass := pg_catalog.to_regclass(p_table);
  back text;
  ix record;
  pred text;
  keys text;
  cond text;
  hit boolean;
begin
  back := pg_catalog.format('(select (pg_catalog.jsonb_populate_record(null::%s, pg_catalog.to_jsonb(r) || %L::jsonb)).*'
                            || ' from %s r where r.id = $1) x', rel,
                            '{"deleted_at": null, "deleted_by": null, "delete_reason": null}', rel);
  for ix in
    select i.indexrelid, i.indnkeyatts, i.indpred, c.relname, x.conexclop
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    left join pg_catalog.pg_constraint x on x.conindid = i.indexrelid and x.contype = 'x'
    where i.indrelid = rel and ((i.indisunique and not i.indisprimary) or x.oid is not null)
    order by c.relname
  loop
    pred := coalesce(pg_catalog.pg_get_expr(ix.indpred, rel), 'true');
    if ix.conexclop is null then
      select pg_catalog.string_agg(pg_catalog.pg_get_indexdef(ix.indexrelid, k, true), ', ' order by k) into keys
      from pg_catalog.generate_series(1, ix.indnkeyatts) k;
      cond := pg_catalog.format('row(%s) = (select %s from %s where %s)', keys, keys, back, pred);
    else
      select pg_catalog.string_agg(pg_catalog.format('(%s) operator(%I.%s) (select %s from %s where %s)',
                                                     pg_catalog.pg_get_indexdef(ix.indexrelid, k, true), n.nspname,
                                                     o.oprname, pg_catalog.pg_get_indexdef(ix.indexrelid, k, true),
                                                     back, pred), ' and ' order by k) into cond
      from pg_catalog.generate_series(1, ix.indnkeyatts) k
      join pg_catalog.pg_operator o on o.oid = ix.conexclop[k]
      join pg_catalog.pg_namespace n on n.oid = o.oprnamespace;
    end if;
    execute pg_catalog.format('select exists (select 1 from %s where id <> $1 and (%s) and %s)', rel, pred, cond)
      into hit using p_id;
    if hit then
      return ix.relname;
    end if;
  end loop;
  return null;
end
$$;
revoke all on function core.restore_duplicate(text, uuid) from public;

-- Why the caller may not restore this removed row, as the restore door would say it, or null when it may:
-- {reason, errcode, detail}. The one rule behind Recently deleted's Restore and core.restore_ticketed.
create function core.restore_refusal(p_table text, p_id uuid, p_removed_by uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  why text;
  code text;
  said text;
  clash text;
begin
  if not core.may_restore(p_table, p_id, authz.me(), p_removed_by) then
    return pg_catalog.jsonb_build_object('reason', 'restore.not_allowed', 'errcode', '42501');
  end if;
  begin
    perform core.restore_needs(p_table, p_id);
  exception when others then
    get stacked diagnostics why = message_text, code = returned_sqlstate, said = pg_exception_detail;
    return pg_catalog.jsonb_build_object('reason', why, 'errcode', code, 'detail', nullif(said, ''));
  end;
  clash := core.restore_duplicate(p_table, p_id);
  if clash is not null then
    return pg_catalog.jsonb_build_object('reason', 'restore.blocked_by_duplicate', 'errcode', '23505', 'detail', clash);
  end if;
  return null;
end
$$;
revoke all on function core.restore_refusal(text, uuid, uuid) from public;

create or replace function core.restore_ticketed(p_entity text, p_id uuid, p_ticket uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  gone timestamptz;
  who uuid;
  req uuid;
  holder text;
  resync uuid[];
  refused jsonb;
begin
  if not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(e.table_name)
                   and a.attname = 'deleted_at' and not a.attisdropped) then
    raise exception using errcode = 'P0001', message = 'restore.not_removable', detail = p_entity;
  end if;
  execute pg_catalog.format('select t.deleted_at, t.deleted_by from %s t where t.id = $1', pg_catalog.to_regclass(e.table_name))
    into gone, who using p_id;
  if gone is null then
    raise exception using errcode = 'P0001', message = 'restore.not_removed';
  end if;
  if gone < core.clock() - pg_catalog.make_interval(days => days) then
    raise exception using errcode = 'P0001', message = 'restore.too_late', detail = days::text;
  end if;
  refused := core.restore_refusal(e.table_name, p_id, who);
  if refused is not null then
    raise exception using errcode = refused ->> 'errcode', message = refused ->> 'reason',
      detail = coalesce(refused ->> 'detail', '');
  end if;
  if e.table_name in ('core.person_email', 'core.person_auth')
     and not core.auth_ticket_take(p_ticket, 'restore', p_entity || ':' || p_id) then
    raise exception using errcode = 'P0001', message = 'restore.via_admin_route', detail = '/auth/admin/restore';
  end if;
  req := audit.begin('ui', 'record.restored', pg_catalog.jsonb_build_object('entity', p_entity), p_reason);
  begin
    perform audit.write_fields(e.table_name, p_id, '{"deleted_at": null, "deleted_by": null, "delete_reason": null}');
  exception when unique_violation or exclusion_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'restore.blocked_by_duplicate', detail = holder;
  end;
  if e.table_name in ('core.person_email', 'core.person_auth') then
    execute pg_catalog.format('select array[t.person_id] from %s t where t.id = $1', pg_catalog.to_regclass(e.table_name))
      into resync using p_id;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'auth_resync', coalesce(pg_catalog.to_jsonb(resync), '[]'::jsonb));
end
$$;

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
      || ' ''reason'', t.delete_reason, ''can_restore'', z.refused is null,'
      || ' ''restore_blocked'', z.refused ->> ''reason'')), ''[]''::jsonb)'
      || ' from %s t cross join lateral (select core.restore_refusal($4, t.id, t.deleted_by) as refused) z'
      || ' where t.id = any ($5) and t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
      || ' and core.deleted_visible($4, t.id, $3) and not core.removed_by_system($4, t.id)',
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
