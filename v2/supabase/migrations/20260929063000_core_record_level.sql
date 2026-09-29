-- v2 a record type may say how a person's level on one of its records is found (P3-8b, V98). An organisation is one
-- record reached through the pages of its sides — Clients, and Suppliers & partners — each with its own access: a
-- person's level on it is the level on the pages of the sides it has on, and a side's own records (its status, its
-- owner, its fields; client IDs, codes and credit on the Client side) go by that side's page alone. So an entity may
-- name a level function (table, record id, person) → level; without one, the level is the person's on the type's page
-- (§5), as before. Everything that asks "may this person see, undo or restore this record" asks authz.record_level.
-- Forward-only (V103).

alter table core.entity add column level text check (level ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$');
comment on column core.entity.level is 'A function (table text, record id uuid, person uuid) → core.level: the person''s level on one record (V98). Null: their level on the type''s page.';

-- The registry's rows name real tables and functions — while they are active: a retired type may name a table that
-- has since gone (P3-8b drops P3-8a's role tables).
create or replace function core.entity_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t regclass := pg_catalog.to_regclass(new.table_name);
begin
  if not new.active then
    return new;
  end if;
  if t is null then
    raise exception using errcode = 'P0001', message = 'entity.unknown_table', detail = new.table_name;
  end if;
  if new.owners is not null and (
       (pg_catalog.strpos(new.owners, '.') > 0 and pg_catalog.to_regprocedure(new.owners || '(uuid)') is null)
       or (pg_catalog.strpos(new.owners, '.') = 0 and not exists (
             select 1 from pg_catalog.pg_attribute a
             where a.attrelid = t and a.attname = new.owners and a.attnum > 0 and not a.attisdropped))) then
    raise exception using errcode = 'P0001', message = 'entity.bad_owners', detail = new.owners;
  end if;
  if new.visible is not null and pg_catalog.to_regprocedure(new.visible || '(uuid, uuid)') is null then
    raise exception using errcode = 'P0001', message = 'entity.bad_visible', detail = new.visible;
  end if;
  if new.level is not null and pg_catalog.to_regprocedure(new.level || '(text, uuid, uuid)') is null then
    raise exception using errcode = 'P0001', message = 'entity.bad_level', detail = new.level;
  end if;
  return new;
end
$$;

-- A person's level on one record: the type's own function when it names one, else their level on its page.
create function authz.record_level(p_person uuid, p_table text, p_id uuid) returns core.level
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  lv core.level;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return 'none';
  end if;
  if e.level is not null then
    execute pg_catalog.format('select %s($1, $2, $3)', pg_catalog.to_regprocedure(e.level || '(text, uuid, uuid)')::regproc)
      into lv using p_table, p_id, p_person;
    return coalesce(lv, 'none');
  end if;
  if e.page_key is null then
    return 'none';
  end if;
  return authz.level_of(p_person, e.page_key);
end
$$;

-- authz.can_see_as as P3-6d wrote it, the page's View now read per record.
create or replace function authz.can_see_as(p_person uuid, p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  ok boolean;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return false;
  end if;
  if exists (select 1 from core.person p join core.role r on r.id = p.role_id
             where p.id = p_person and r.is_admin and p.active and p.can_sign_in and p.deleted_at is null) then
    return true;
  end if;
  if e.visible is not null then
    execute pg_catalog.format('select %s($1, $2)', pg_catalog.to_regprocedure(e.visible || '(uuid, uuid)')::regproc)
      into ok using p_id, p_person;
    if coalesce(ok, false) then
      return true;
    end if;
  end if;
  if p_person = any (core.owners_of(p_table, p_id)) then
    return true;
  end if;
  return not e.private and (e.page_key is not null or e.level is not null)
         and e.page_key is distinct from 'settings.profile'
         and authz.record_level(p_person, p_table, p_id) >= 'view';
end
$$;

-- audit.undo_allowed as P3-6a wrote it, the page's Full and Own now read per record.
create or replace function audit.undo_allowed(q audit.request, me uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  window_h int := coalesce((core.setting_at('audit.undo_window_hours', null, core.riyadh_today()) #>> '{}')::int, 24);
begin
  if authz.is_admin() then
    return true;
  end if;
  if audit.touches_access(q.id) then
    return false;
  end if;
  if not exists (select 1 from audit.change c
                 left join core.entity e on e.table_name = c.table_name and e.active
                 where c.request_id = q.id
                   and (e.id is null or authz.record_level(me, c.table_name, c.row_id) < 'full')) then
    return true;
  end if;
  if q.at <= core.clock() - pg_catalog.make_interval(hours => window_h) then
    return false;
  end if;
  if q.actor_id = me then
    return true;
  end if;
  return not exists (select 1 from audit.change c
                     left join core.entity e on e.table_name = c.table_name and e.active
                     where c.request_id = q.id
                       and (not (me = any (core.owners_of(c.table_name, c.row_id)))
                            or e.id is null or authz.record_level(me, c.table_name, c.row_id) < 'own'));
end
$$;

-- core.restore as P3-6d wrote it, the page's Full and Own now read per record.
create or replace function core.restore(p_entity text, p_id uuid, p_reason text default null) returns jsonb
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
  if not (authz.is_admin()
          or (e.table_name not in ('core.person_email', 'core.person_auth', 'core.person_page_level',
                                   'core.person_capability', 'core.role_page_level', 'core.role_capability')
              and (who = me
                   or authz.record_level(me, e.table_name, p_id) = 'full'
                   or (me = any (core.owners_of(e.table_name, p_id))
                       and ((e.page_key is null and e.level is null)
                            or authz.record_level(me, e.table_name, p_id) >= 'own'))))) then
    raise exception using errcode = '42501', message = 'restore.not_allowed';
  end if;
  req := audit.begin('ui', 'record.restored', pg_catalog.jsonb_build_object('entity', p_entity), p_reason);
  begin
    perform audit.write_fields(e.table_name, p_id, '{"deleted_at": null, "deleted_by": null, "delete_reason": null}');
  exception when unique_violation or exclusion_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'restore.blocked_by_duplicate', detail = holder;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;
