-- v2 access (P3-4): levels and capabilities as the registry declares them (TECH-SPEC §5, §8; D2), the three rules for
-- changing access, and the allow-list and sign-out now asking the access model instead of the admin role (V125).
-- Bodies are security definer in authz/core; everything the Data API reaches is a security-invoker wrapper (V124).
-- Forward-only (V103).

-- ================================================================ the idle window is a setting now (V74, §3.2)
create or replace function core.device_idle_days() returns int
language sql stable set search_path = ''
as $$
  select coalesce((core.setting_at('auth.device_idle_days', null, core.riyadh_today()) #>> '{}')::int, 30)
$$;
comment on function core.device_idle_days() is 'auth.device_idle_days as of today (company-wide), else 30.';

-- ================================================================ levels and capabilities (§5)
-- A person's level on a page: the admin role has the page's top level; else the person's override; else the role's
-- starting level; else none. A person who may not sign in — switched off, removed, not staff — has none anywhere, and
-- so does an unknown or retired page.
create function authz.level_of(p_person uuid, p_page text) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
             when r.is_admin then (select pg_catalog.max(l) from pg_catalog.unnest(pg.levels_allowed) l)
             else coalesce(
               (select l.level from core.person_page_level l
                 where l.person_id = p.id and l.page_key = pg.key and l.deleted_at is null),
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
comment on function authz.level_of(uuid, text) is 'A person''s level on a page (§5): admin role → top; override; role default; none.';

create function authz.can_of(p_person uuid, p_capability text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
             when r.is_admin then true
             else coalesce(
               (select x.granted from core.person_capability x
                 where x.person_id = p.id and x.capability_key = c.key and x.deleted_at is null),
               (select x.granted from core.role_capability x
                 where x.role_id = p.role_id and x.capability_key = c.key and x.deleted_at is null),
               false)
           end
    from core.person p
    join core.capability c on c.key = p_capability and c.active
    left join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
  ), false)
$$;
comment on function authz.can_of(uuid, text) is 'Whether a person holds a capability (§5): admin role → yes; override; role default; no.';

-- The caller's own: what row rules and read views ask.
create function authz.level(p_page text) returns core.level
language sql stable security definer set search_path = ''
as $$ select authz.level_of(authz.me(), p_page) $$;
comment on function authz.level(text) is 'The signed-in person''s level on a page; none without an active person.';

create function authz.can(p_capability text) returns boolean
language sql stable security definer set search_path = ''
as $$ select authz.can_of(authz.me(), p_capability) $$;
comment on function authz.can(text) is 'Whether the signed-in person holds a capability.';

-- What write functions ask: the caller, refused with the page and level (or the capability) they need (V110).
create function authz.require(p_page text, p_level core.level) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if authz.level_of(me, p_page) < p_level then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', p_level)::text;
  end if;
  return me;
end
$$;

create function authz.require_capability(p_capability text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if not authz.can_of(me, p_capability) then
    raise exception using errcode = '42501', message = 'access.needs_capability',
      detail = pg_catalog.jsonb_build_object('capability', p_capability)::text;
  end if;
  return me;
end
$$;

-- Departments I see: my own, the ones an admin let me see besides (§2.6); an admin sees every one.
create function authz.in_my_departments(p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select coalesce(r.is_admin, false) or p.department_id = p_department
           or exists (select 1 from core.person_department pd
                      where pd.person_id = p.id and pd.department_id = p_department and pd.deleted_at is null)
    from core.person p left join core.role r on r.id = p.role_id
    where p.id = authz.me()), false)
$$;

-- Whether a person is in my reporting line: I am their manager, or their manager's manager, and so on.
create function authz.reports_to(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  with recursive me as (select authz.me() as id),
  chain (manager_id, depth) as (
    select p.manager_id, 1 from core.person p where p.id = p_person
    union all
    select p.manager_id, c.depth + 1 from core.person p join chain c on p.id = c.manager_id where c.depth < 50
  )
  select coalesce((select true from chain, me where chain.manager_id = me.id limit 1), false)
$$;

grant execute on function authz.level(text), authz.can(text), authz.in_my_departments(uuid), authz.reports_to(uuid)
  to authenticated;

-- ================================================================ P3-2's checks ask the access model (V125)
-- The allow-list is Settings → Organization & access · Full; signing a person out is the org.sign_out capability;
-- seeing their devices is Organization & access · View.
create or replace function authz.require_admin() returns uuid
language sql stable security definer set search_path = ''
as $$ select authz.require('settings.org', 'full') $$;
comment on function authz.require_admin() is 'P3-2''s allow-list check: Settings → Organization & access · Full (V125).';

create or replace function core.person_sign_out(p_person uuid, p_device uuid default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require_capability('org.sign_out');
begin
  return core.end_devices(p_person, p_device, null, 'admin', me);
end
$$;

create or replace function core.person_devices(p_person uuid) returns table (id uuid, device_label text,
                                                                             signed_in_at timestamptz,
                                                                             last_seen_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('settings.org', 'view');
  return query
    select d.id, d.device_label, d.signed_in_at, d.last_seen_at
    from core.device_session d
    where d.person_id = p_person and d.signed_out_at is null
      and d.last_seen_at > core.clock() - pg_catalog.make_interval(days => core.device_idle_days())
    order by d.last_seen_at desc;
end
$$;

-- api.me()'s levels and capabilities are the same answers authz gives (one rule, not two copies).
create or replace function core.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a core.person_auth;
  p core.person;
  r core.role;
  pr core.person_profile;
  d core.device_session;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  if a.id is null or not exists (select 1 from core.person_email e
                                 where e.person_id = a.person_id and e.email operator(extensions.=) a.email
                                   and e.deleted_at is null) then
    return pg_catalog.jsonb_build_object('status', 'not_listed');
  end if;
  select * into p from core.person where id = a.person_id;
  if p.kind <> 'staff' or not p.active or not p.can_sign_in or p.deleted_at is not null then
    return pg_catalog.jsonb_build_object('status', 'switched_off');
  end if;
  select * into d from core.device_session s where s.auth_session_id = core.jwt_session_id() and s.auth_user_id = uid;
  if d.id is null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'unknown');
  end if;
  if d.signed_out_at is not null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', d.sign_out_reason);
  end if;
  if d.last_seen_at <= core.clock() - pg_catalog.make_interval(days => core.device_idle_days()) then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'inactive');
  end if;
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'session', pg_catalog.jsonb_build_object(
      'device_id', d.id, 'signed_in_at', d.signed_in_at, 'last_seen_at', d.last_seen_at, 'email', a.email),
    'person', pg_catalog.jsonb_build_object(
      'id', p.id, 'kind', p.kind,
      'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
      'role', case when r.id is null then null else pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin) end),
    'levels', coalesce((
      select pg_catalog.jsonb_object_agg(pg.key, authz.level_of(p.id, pg.key))
      from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(c.key order by c.key)
      from core.capability c where c.active and authz.can_of(p.id, c.key)), '[]'::jsonb),
    'departments', (
      select pg_catalog.jsonb_agg(ds.dep order by ds.dep)
      from (select p.department_id as dep
            union
            select pd.department_id from core.person_department pd
            where pd.person_id = p.id and pd.deleted_at is null) ds),
    'profile', case when pr.id is null then null else pg_catalog.jsonb_build_object(
      'display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar,
      'avatar_file_id', pr.avatar_file_id, 'avatar_color', pr.avatar_color,
      'badge_kind', pr.badge_kind, 'badge_value', pr.badge_value,
      'theme', pr.theme, 'density', pr.density, 'locale', pr.locale, 'start_page', pr.start_page,
      'drawer_pinned', pr.drawer_pinned, 'notify', pr.notify, 'version', pr.version) end
  );
end
$$;

-- ================================================================ changing access: the three rules (§5, plan P3-4)
-- Every change needs Settings → Organization & access · Full, and:
--   · nobody changes their own access (their overrides, their role, or the starting levels of the role they hold);
--   · only an admin makes an admin, or changes an admin's access or role;
--   · nobody grants more than they hold: a level above their own on that page, a capability they lack, a role whose
--     starting levels or capabilities exceed theirs — nor clears an override when what remains would exceed theirs.
-- Refusals raise 42501 with the rule's key (access.not_your_own, access.admins_only, access.above_your_level).

create function core.access_guard(p_person uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
begin
  if not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_person = me then
    raise exception using errcode = '42501', message = 'access.not_your_own';
  end if;
  if not authz.is_admin() and exists (select 1 from core.person p join core.role r on r.id = p.role_id
                                      where p.id = p_person and r.is_admin) then
    raise exception using errcode = '42501', message = 'access.admins_only';
  end if;
  return me;
end
$$;

-- The level a page offers, or the reason it cannot be given.
create function core.access_page_level(p_page text, p_level core.level) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  allowed core.level[];
begin
  select pg.levels_allowed into allowed from core.page pg where pg.key = p_page and pg.active;
  if allowed is null then
    raise exception using errcode = 'P0002', message = 'access.unknown_page', detail = p_page;
  end if;
  if not (p_level = any (allowed)) then
    raise exception using errcode = 'P0001', message = 'access.level_not_offered',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', p_level)::text;
  end if;
end
$$;

create function core.access_reason(p_reason text) returns text
language plpgsql immutable set search_path = ''
as $$
begin
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  return pg_catalog.btrim(p_reason);
end
$$;

create function core.access_not_above(p_me uuid, p_page text, p_level core.level) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_level > authz.level_of(p_me, p_page) then
    raise exception using errcode = '42501', message = 'access.above_your_level',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', p_level)::text;
  end if;
end
$$;

create function core.access_can_grant(p_me uuid, p_capability text) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not authz.can_of(p_me, p_capability) then
    raise exception using errcode = '42501', message = 'access.above_your_level',
      detail = pg_catalog.jsonb_build_object('capability', p_capability)::text;
  end if;
end
$$;

-- A person's level on a page, overriding their role's.
create function core.access_set_person_level(p_person uuid, p_page text, p_level core.level, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_guard(p_person);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.person_page_level;
begin
  perform core.access_page_level(p_page, p_level);
  perform core.access_not_above(me, p_page, p_level);
  req := audit.begin('ui', 'access.person_level_set', pg_catalog.jsonb_build_object('page', p_page, 'level', p_level), why);
  update core.person_page_level set level = p_level, reason = why
  where person_id = p_person and page_key = p_page and deleted_at is null
  returning * into x;
  if x.id is null then
    insert into core.person_page_level (person_id, page_key, level, reason) values (p_person, p_page, p_level, why)
    returning * into x;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

-- Back to the role's level on that page.
create function core.access_clear_person_level(p_person uuid, p_page text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_guard(p_person);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.person_page_level;
  falls_to core.level;
begin
  select coalesce((select l.level from core.role_page_level l join core.person p on p.role_id = l.role_id
                   where p.id = p_person and l.page_key = p_page and l.deleted_at is null), 'none')
    into falls_to;
  perform core.access_not_above(me, p_page, falls_to);
  req := audit.begin('ui', 'access.person_level_cleared', pg_catalog.jsonb_build_object('page', p_page), why);
  update core.person_page_level set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = why
  where person_id = p_person and page_key = p_page and deleted_at is null
  returning * into x;
  if x.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

-- A capability for one person, overriding their role's.
create function core.access_set_person_capability(p_person uuid, p_capability text, p_granted boolean,
                                                  p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_guard(p_person);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.person_capability;
begin
  if not exists (select 1 from core.capability c where c.key = p_capability and c.active) then
    raise exception using errcode = 'P0002', message = 'access.unknown_capability', detail = p_capability;
  end if;
  if p_granted then
    perform core.access_can_grant(me, p_capability);
  end if;
  req := audit.begin('ui', 'access.person_capability_set',
                     pg_catalog.jsonb_build_object('capability', p_capability, 'granted', p_granted), why);
  update core.person_capability set granted = p_granted, reason = why
  where person_id = p_person and capability_key = p_capability and deleted_at is null
  returning * into x;
  if x.id is null then
    insert into core.person_capability (person_id, capability_key, granted, reason)
    values (p_person, p_capability, p_granted, why)
    returning * into x;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

create function core.access_clear_person_capability(p_person uuid, p_capability text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_guard(p_person);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.person_capability;
begin
  if coalesce((select c.granted from core.role_capability c join core.person p on p.role_id = c.role_id
               where p.id = p_person and c.capability_key = p_capability and c.deleted_at is null), false) then
    perform core.access_can_grant(me, p_capability);
  end if;
  req := audit.begin('ui', 'access.person_capability_cleared',
                     pg_catalog.jsonb_build_object('capability', p_capability), why);
  update core.person_capability set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = why
  where person_id = p_person and capability_key = p_capability and deleted_at is null
  returning * into x;
  if x.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

-- A role's starting levels and capabilities (the matrix). The admin role has everything and is not edited; nobody
-- edits the role they hold.
create function core.access_role_guard(p_role uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  target core.role;
begin
  select * into target from core.role where id = p_role and active;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if target.is_admin then
    raise exception using errcode = 'P0001', message = 'access.admin_role_has_everything';
  end if;
  if exists (select 1 from core.person p where p.id = me and p.role_id = p_role) then
    raise exception using errcode = '42501', message = 'access.not_your_own';
  end if;
  return me;
end
$$;

create function core.access_set_role_level(p_role uuid, p_page text, p_level core.level, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_role_guard(p_role);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.role_page_level;
begin
  perform core.access_page_level(p_page, p_level);
  perform core.access_not_above(me, p_page, p_level);
  req := audit.begin('ui', 'access.role_level_set', pg_catalog.jsonb_build_object('page', p_page, 'level', p_level), why);
  update core.role_page_level set level = p_level
  where role_id = p_role and page_key = p_page and deleted_at is null
  returning * into x;
  if x.id is null then
    insert into core.role_page_level (role_id, page_key, level) values (p_role, p_page, p_level) returning * into x;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

create function core.access_set_role_capability(p_role uuid, p_capability text, p_granted boolean, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_role_guard(p_role);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.role_capability;
begin
  if not exists (select 1 from core.capability c where c.key = p_capability and c.active) then
    raise exception using errcode = 'P0002', message = 'access.unknown_capability', detail = p_capability;
  end if;
  if p_granted then
    perform core.access_can_grant(me, p_capability);
  end if;
  req := audit.begin('ui', 'access.role_capability_set',
                     pg_catalog.jsonb_build_object('capability', p_capability, 'granted', p_granted), why);
  update core.role_capability set granted = p_granted
  where role_id = p_role and capability_key = p_capability and deleted_at is null
  returning * into x;
  if x.id is null then
    insert into core.role_capability (role_id, capability_key, granted) values (p_role, p_capability, p_granted)
    returning * into x;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

-- A person's role. Only an admin gives the admin role; nobody gives a role that starts above what they hold.
create function core.access_set_person_role(p_person uuid, p_role uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_guard(p_person);
  why text := core.access_reason(p_reason);
  target core.role;
  req uuid;
  x core.person;
  over text;
begin
  select * into target from core.role where id = p_role and active;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if target.is_admin and not authz.is_admin() then
    raise exception using errcode = '42501', message = 'access.admins_only';
  end if;
  if not target.is_admin then
    select l.page_key into over from core.role_page_level l join core.page pg on pg.key = l.page_key and pg.active
    where l.role_id = p_role and l.deleted_at is null and l.level > authz.level_of(me, l.page_key)
    order by l.page_key limit 1;
    if over is not null then
      raise exception using errcode = '42501', message = 'access.above_your_level',
        detail = pg_catalog.jsonb_build_object('page', over)::text;
    end if;
    select c.capability_key into over from core.role_capability c
    where c.role_id = p_role and c.granted and c.deleted_at is null and not authz.can_of(me, c.capability_key)
    order by c.capability_key limit 1;
    if over is not null then
      raise exception using errcode = '42501', message = 'access.above_your_level',
        detail = pg_catalog.jsonb_build_object('capability', over)::text;
    end if;
  end if;
  req := audit.begin('ui', 'access.person_role_set', pg_catalog.jsonb_build_object('role', target.key), why);
  update core.person set role_id = p_role where id = p_person returning * into x;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

-- ================================================================ reading access
-- The matrix (Settings → Organization & access, View): roles × pages and capabilities, with each role's levels.
create function core.access_matrix() returns jsonb
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
               from core.role_capability c where c.deleted_at is null), '[]'::jsonb));
end
$$;

-- One person's access: their effective levels and capabilities and the overrides behind them. Your own always;
-- anyone else's with Organization & access · View.
create function core.access_of_person(p_person uuid) returns jsonb
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
    'capability_overrides', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'capability', c.capability_key, 'granted', c.granted, 'reason', c.reason,
                        'set_by', coalesce(c.updated_by, c.created_by), 'set_at', coalesce(c.updated_at, c.created_at))
                        order by c.capability_key)
                        from core.person_capability c where c.person_id = p_person and c.deleted_at is null),
                        '[]'::jsonb));
end
$$;

grant execute on function core.access_set_person_level(uuid, text, core.level, text),
  core.access_clear_person_level(uuid, text, text),
  core.access_set_person_capability(uuid, text, boolean, text), core.access_clear_person_capability(uuid, text, text),
  core.access_set_role_level(uuid, text, core.level, text), core.access_set_role_capability(uuid, text, boolean, text),
  core.access_set_person_role(uuid, uuid, text), core.access_matrix(), core.access_of_person(uuid) to authenticated;

-- ================================================================ the door (security invoker — V124)
create function api.access_set_person_level(p_person uuid, p_page text, p_level core.level, p_reason text)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_set_person_level(p_person, p_page, p_level, p_reason) $$;

create function api.access_clear_person_level(p_person uuid, p_page text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_clear_person_level(p_person, p_page, p_reason) $$;

create function api.access_set_person_capability(p_person uuid, p_capability text, p_granted boolean, p_reason text)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_set_person_capability(p_person, p_capability, p_granted, p_reason) $$;

create function api.access_clear_person_capability(p_person uuid, p_capability text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_clear_person_capability(p_person, p_capability, p_reason) $$;

create function api.access_set_role_level(p_role uuid, p_page text, p_level core.level, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_set_role_level(p_role, p_page, p_level, p_reason) $$;

create function api.access_set_role_capability(p_role uuid, p_capability text, p_granted boolean, p_reason text)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_set_role_capability(p_role, p_capability, p_granted, p_reason) $$;

create function api.access_set_person_role(p_person uuid, p_role uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.access_set_person_role(p_person, p_role, p_reason) $$;

create function api.access_matrix() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.access_matrix() $$;

create function api.access_of_person(p_person uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.access_of_person(p_person) $$;

grant execute on function api.access_set_person_level(uuid, text, core.level, text),
  api.access_clear_person_level(uuid, text, text),
  api.access_set_person_capability(uuid, text, boolean, text), api.access_clear_person_capability(uuid, text, text),
  api.access_set_role_level(uuid, text, core.level, text), api.access_set_role_capability(uuid, text, boolean, text),
  api.access_set_person_role(uuid, uuid, text), api.access_matrix(), api.access_of_person(uuid) to authenticated;
