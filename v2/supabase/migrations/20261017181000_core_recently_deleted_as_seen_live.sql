-- QA-576 (QA 2, 17 Oct): Recently deleted showed some people what they could not see before the record was removed.
--  1. A task's helper from another department, or a member whose Tasks page is None, read the title of a removed task
--     they could never open: the list asked authz.can_see_as, whose owners shortcut (owner, creator, helpers) lets
--     them through, while the task itself is read by its row level alone (work.task_get). The list now asks what the
--     live record's read asks: a record type with its own level function (core.entity.level: tasks, projects,
--     achievements, partners …) by that level at View or above; every other type by authz.can_see_as as before, so a
--     private note stays its author's alone (V454) and a removed contact is still listed to a viewer (DEL-01).
--  2. A viewer was offered Restore on a removed achievement they may only read; the server refused it, but the button
--     showed. Each row now carries can_restore, from core.may_restore: the rule core.restore_ticketed checked inline,
--     moved into one function both use, so the list and the door can never disagree. Builder B2's screen hides
--     Restore when it is false.
-- core.restore_ticketed (as 20260929093000 left it) and core.recently_deleted (as 20261014130000 left it) are
-- replaced whole but for those lines. Forward-only (V103).

-- Who may see a removed record: who could read it live.
create function core.deleted_visible(p_table text, p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case when e.level is not null and not e.rule_only
              then authz.record_level(p_person, p_table, p_id) >= 'view'
              else authz.can_see_as(p_person, p_table, p_id) end
  from core.entity e where e.table_name = p_table and e.active
$$;
revoke all on function core.deleted_visible(text, uuid, uuid) from public;

-- Who may restore a removed record (V161: rights now): an admin; or, outside the access tables, Full on its record,
-- or Own on it (or a type without levels) for whoever removed it or owns it.
create function core.may_restore(p_table text, p_id uuid, p_person uuid, p_removed_by uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select exists (select 1 from core.person p join core.role r on r.id = p.role_id
                   where p.id = p_person and r.is_admin)
        or (not (p_table = any (audit.access_tables()))
            and (authz.record_level(p_person, p_table, p_id) = 'full'
                 or (((e.page_key is null and e.level is null) or authz.record_level(p_person, p_table, p_id) >= 'own')
                     and (p_removed_by = p_person or p_person = any (core.owners_of(p_table, p_id))))))
    from core.entity e where e.table_name = p_table and e.active), false)
$$;
revoke all on function core.may_restore(text, uuid, uuid, uuid) from public;

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
  if not core.may_restore(e.table_name, p_id, me, who) then
    raise exception using errcode = '42501', message = 'restore.not_allowed';
  end if;
  perform core.restore_needs(e.table_name, p_id);
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
      || ' ''reason'', t.delete_reason, ''can_restore'', core.may_restore($4, t.id, $3, t.deleted_by))), ''[]''::jsonb)'
      || ' from %s t where t.id = any ($5) and t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
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
