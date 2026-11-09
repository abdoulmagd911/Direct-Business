-- FIX-11 — a switched-off user's Only-me notes are restorable by an Admin (D10); a switched-on user's are not.
-- The gap: deleted_visible falls through to authz.can_see_as for my.note (its level is null), and can_see_as returns
-- true for every admin — while a live private note is its author's alone (my.note_visible has no admin bypass, and
-- can_see_as asks only the visible rule for a rule_only record type). may_restore has the same blanket admin
-- disjunct, and a second leak beside it: record_level is 'full' for an admin on every table, so its other disjunct
-- passes for an admin too. And restore_ticketed asks can_see_record before may_restore, which refuses a private
-- note to anyone but its author — so the leaver restore needs its own narrow bypass there. All three gates now
-- carve out the same case: a private note belongs to its owner alone, unless its owner is switched off
-- (can_sign_in false) — then an admin may see it in Recently Deleted and restore it. Live reads stay owner-only
-- (V454): the bypass is restore-only. Only the owner ever removes a note (my_notes_remove requires note_mine), so
-- the remover branch stays owner-only.
create or replace function core.deleted_visible(p_table text, p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_table = 'my.note' and exists (select 1 from my.note n where n.id = p_id and n.visibility = 'private')
      then p_person = (select n.person_id from my.note n where n.id = p_id)
        or (exists (select 1 from core.person p join core.role r on r.id = p.role_id
                    where p.id = p_person and r.is_admin and p.active and p.can_sign_in and p.deleted_at is null)
            and not coalesce((select p2.can_sign_in from core.person p2
                              where p2.id = (select n.person_id from my.note n where n.id = p_id)), false))
    when e.level is not null and not e.rule_only
      then authz.record_level(p_person, p_table, p_id) >= 'view'
    else authz.can_see_as(p_person, p_table, p_id) end
  from core.entity e where e.table_name = p_table and e.active
$$;

-- The carve-out gates the whole rule: an admin passes the other disjunct too (record_level is 'full' for an admin
-- on every table), so carving out only the admin disjunct would still let an admin restore.
create or replace function core.may_restore(p_table text, p_id uuid, p_person uuid, p_removed_by uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select not (p_table = 'my.note'
                and exists (select 1 from my.note n where n.id = p_id and n.visibility = 'private')
                and p_person <> (select n.person_id from my.note n where n.id = p_id)
                and coalesce((select p2.can_sign_in from core.person p2
                              where p2.id = (select n.person_id from my.note n where n.id = p_id)), false))
        and (exists (select 1 from core.person p join core.role r on r.id = p.role_id
                     where p.id = p_person and r.is_admin)
             or (not (p_table = any (audit.access_tables()))
                 and (authz.record_level(p_person, p_table, p_id) = 'full'
                      or (((e.page_key is null and e.level is null) or authz.record_level(p_person, p_table, p_id) >= 'own')
                          and (p_removed_by = p_person or p_person = any (core.owners_of(p_table, p_id)))))))
    from core.entity e where e.table_name = p_table and e.active), false)
$$;

-- core.restore_ticketed as 20261022090000 left it, but for the first gate: a switched-off user's private note is
-- restorable by an admin (D10) — can_see_record refuses a private note to anyone but its author, so the leaver case
-- asks the entity row and the existence check directly instead. A switched-on user's note still asks the usual rule
-- and is refused there (access.needs_level), before may_restore is reached.
create or replace function core.restore_ticketed(p_entity text, p_id uuid, p_ticket uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity;
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  gone timestamptz;
  who uuid;
  req uuid;
  holder text;
  resync uuid[];
  refused jsonb;
begin
  if p_entity = 'my_note' and authz.is_admin()
     and exists (select 1 from my.note n join core.person p2 on p2.id = n.person_id
                 where n.id = p_id and n.visibility = 'private' and not p2.can_sign_in) then
    select * into e from core.entity where key = p_entity and active;
    if e.id is null then
      raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
    end if;
    if not exists (select 1 from my.note t where t.id = p_id) then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
  else
    e := core.can_see_record(p_entity, p_id);
  end if;
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
