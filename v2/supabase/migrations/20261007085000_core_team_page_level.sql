-- V510 · Access by team. A team's level on a page sits between the role's default and the person's own override:
-- a person's level is their override, else the highest level of their home team and the teams they assist, else their
-- role's, else none. A new joiner inherits the team's grants the moment the team is set. Only admins set a team level
-- (V97, V138), with a reason; Settings pages stay admins-only (V97). View as and api.me() read it like any other level
-- (V442, V462) — both go through authz.level_of. Pipeline is the first page granted this way (V507). Forward-only (V103).

create table core.team_page_level (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references core.team (id),
  page_key text not null references core.page (key),
  level core.level not null,
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index team_page_level_live on core.team_page_level (team_id, page_key) where deleted_at is null;
comment on table core.team_page_level is
  'A team''s level on a page (V510): between the role''s default and the person''s override; the highest of a person''s teams wins.';
alter table core.team_page_level enable row level security;
select audit.track('core.team_page_level'::regclass);
select core.index_foreign_keys('core');
create trigger settings_admins_only before insert or update on core.team_page_level
  for each row execute function core.settings_level_guard();

-- ================================================================ the level, with the team's in the middle
create or replace function authz.level_of(p_person uuid, p_page text) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
             when r.is_admin then (select pg_catalog.max(l) from pg_catalog.unnest(pg.levels_allowed) l)
             when authz.is_settings_page(pg.key) then 'none'::core.level
             else coalesce(
               (select l.level from core.person_page_level l
                 where l.person_id = p.id and l.page_key = pg.key and l.deleted_at is null),
               (select pg_catalog.max(l.level) from core.team_page_level l join core.team t on t.id = l.team_id
                 where l.page_key = pg.key and l.deleted_at is null and t.active
                   and (l.team_id = p.team_id
                        or exists (select 1 from core.person_team_assist a
                                   where a.person_id = p.id and a.team_id = l.team_id and a.deleted_at is null))),
               (select l.level from core.role_page_level l
                 where l.role_id = p.role_id and l.page_key = pg.key and l.deleted_at is null),
               'none'::core.level)
           end
    from core.person p
    join core.page pg on pg.key = p_page and pg.active
    left join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
  ), 'none'::core.level)
$$;

-- ================================================================ setting and clearing a team's level (admins)
create function core.access_team_guard(p_team uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
begin
  if not exists (select 1 from core.team t where t.id = p_team and t.active) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'core.team';
  end if;
  return me;
end
$$;

create function core.access_set_team_level(p_team uuid, p_page text, p_level core.level, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_team_guard(p_team);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.team_page_level;
begin
  perform core.access_page_level(p_page, p_level);
  perform core.access_not_above(me, p_page, p_level);
  req := audit.begin('ui', 'access.team_level_set', pg_catalog.jsonb_build_object('page', p_page, 'level', p_level,
                     'team', (select t.name_en from core.team t where t.id = p_team)), why);
  update core.team_page_level set level = p_level, reason = why
  where team_id = p_team and page_key = p_page and deleted_at is null
  returning * into x;
  if x.id is null then
    insert into core.team_page_level (team_id, page_key, level, reason) values (p_team, p_page, p_level, why)
    returning * into x;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

create function core.access_clear_team_level(p_team uuid, p_page text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_team_guard(p_team);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.team_page_level;
begin
  req := audit.begin('ui', 'access.team_level_cleared', pg_catalog.jsonb_build_object('page', p_page,
                     'team', (select t.name_en from core.team t where t.id = p_team)), why);
  update core.team_page_level set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = why
  where team_id = p_team and page_key = p_page and deleted_at is null
  returning * into x;
  if x.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

-- ================================================================ the reads: the matrix carries the teams' levels; a
-- person's access says which of their teams gives each team level
create or replace function core.access_matrix() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('settings.org', 'view');
  return pg_catalog.jsonb_build_object(
    'roles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin,
               'sort', r.sort) order by r.sort, r.key) from core.role r where r.active), '[]'::jsonb),
    'pages', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'key', pg.key, 'module', pg.module, 'levels', pg.levels_allowed, 'nav_group', pg.nav_group,
               'nav_order', pg.nav_order) order by pg.key) from core.page pg where pg.active), '[]'::jsonb),
    'capabilities', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'key', c.key, 'page', c.page_key) order by c.key) from core.capability c where c.active), '[]'::jsonb),
    'role_levels', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'role_id', l.role_id, 'page', l.page_key, 'level', l.level) order by l.role_id, l.page_key)
               from core.role_page_level l where l.deleted_at is null), '[]'::jsonb),
    'role_capabilities', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'role_id', c.role_id, 'capability', c.capability_key, 'granted', c.granted)
               order by c.role_id, c.capability_key)
               from core.role_capability c where c.deleted_at is null), '[]'::jsonb),
    'team_levels', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'team_id', l.team_id, 'team_en', t.name_en, 'team_ar', t.name_ar, 'page', l.page_key, 'level', l.level,
               'reason', l.reason, 'set_by', coalesce(l.updated_by, l.created_by),
               'set_at', coalesce(l.updated_at, l.created_at)) order by t.name_en, l.page_key)
               from core.team_page_level l join core.team t on t.id = l.team_id
               where l.deleted_at is null and t.active), '[]'::jsonb));
end
$$;

create or replace function core.access_of_person(p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_person is distinct from me then
    perform authz.require('settings.org', 'view');
  end if;
  if not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff') then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.jsonb_build_object(
    'person_id', p_person,
    'role', (select pg_catalog.jsonb_build_object('id', r.id, 'key', r.key, 'is_admin', r.is_admin)
             from core.person p join core.role r on r.id = p.role_id where p.id = p_person),
    'levels', coalesce((select pg_catalog.jsonb_object_agg(pg.key, authz.level_of(p_person, pg.key))
                        from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((select pg_catalog.jsonb_agg(c.key order by c.key) from core.capability c
                              where c.active and authz.can_of(p_person, c.key)), '[]'::jsonb),
    'level_overrides', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'page', l.page_key, 'level', l.level, 'reason', l.reason,
                        'set_by', coalesce(l.updated_by, l.created_by), 'set_at', coalesce(l.updated_at, l.created_at))
                        order by l.page_key)
                        from core.person_page_level l where l.person_id = p_person and l.deleted_at is null),
                        '[]'::jsonb),
    'team_levels', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'team_id', l.team_id, 'team_en', t.name_en, 'team_ar', t.name_ar, 'page', l.page_key,
                        'level', l.level, 'home', l.team_id = p.team_id) order by l.page_key, t.name_en)
                        from core.person p join core.team_page_level l on l.deleted_at is null
                        join core.team t on t.id = l.team_id and t.active
                        where p.id = p_person
                          and (l.team_id = p.team_id
                               or exists (select 1 from core.person_team_assist a
                                          where a.person_id = p.id and a.team_id = l.team_id and a.deleted_at is null))),
                        '[]'::jsonb),
    'capability_overrides', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'capability', c.capability_key, 'granted', c.granted, 'reason', c.reason,
                        'set_by', coalesce(c.updated_by, c.created_by), 'set_at', coalesce(c.updated_at, c.created_at))
                        order by c.capability_key)
                        from core.person_capability c where c.person_id = p_person and c.deleted_at is null),
                        '[]'::jsonb));
end
$$;

-- ================================================================ the doors (V124)
grant execute on function core.access_set_team_level(uuid, text, core.level, text),
  core.access_clear_team_level(uuid, text, text) to authenticated;
create function api.access_set_team_level(p_team uuid, p_page text, p_level core.level, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_set_team_level(p_team, p_page, p_level, p_reason) $$;
create function api.access_clear_team_level(p_team uuid, p_page text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_clear_team_level(p_team, p_page, p_reason) $$;
grant execute on function api.access_set_team_level(uuid, text, core.level, text),
  api.access_clear_team_level(uuid, text, text) to authenticated;
