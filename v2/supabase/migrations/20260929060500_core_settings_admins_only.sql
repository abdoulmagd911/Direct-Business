-- v2 Settings are admins' (V97; the owner's urgent fix of 29 Sep, QA-01). Until now authz.require_admin() meant "Full
-- on Settings → Organization & access" (V125), and heads held Full on several Settings pages: a head who is not an
-- admin could put their own mailbox on an admin's person (api.person_email_add) or link a sign-in to them
-- (api.person_auth_link), then sign in as that admin. Now the admin check is the admin role itself, and every Settings
-- page — every settings, access, people and e-mail write behind it — is none or Full, Full for admins only, whatever a
-- role's row or a person's override says. My profile stays everyone's own. Forward-only (V103).

-- ================================================================ the admin check is the admin role
create or replace function authz.require_admin() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if not authz.is_admin() then
    raise exception using errcode = '42501', message = 'access.needs_admin';
  end if;
  return me;
end
$$;
comment on function authz.require_admin() is 'The caller, when they hold the admin role; else refused (V97). E-mails, sign-ins and access.';

-- ================================================================ a Settings page is none or Full, Full an admin's
create function authz.is_settings_page(p_page text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$ select p_page like 'settings.%' and p_page <> 'settings.profile' $$;

-- A person's level on a page (§5), as P3-4 wrote it — but on a Settings page only an admin has a level (Full); nobody
-- else has any, whatever a role's row or a person's override says (V97).
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

-- A level on a Settings page is never given to anyone but the admin role: a person's override there, or a non-admin
-- role's starting level above none, is refused rather than silently ignored.
create function core.settings_level_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.deleted_at is not null or new.level = 'none' or not authz.is_settings_page(new.page_key) then
    return new;
  end if;
  if tg_table_name = 'role_page_level' then
    if exists (select 1 from core.role r where r.id = new.role_id and r.is_admin) then
      return new;
    end if;
  end if;
  raise exception using errcode = 'P0001', message = 'access.settings_admins_only', detail = new.page_key;
end
$$;

-- The rows that gave non-admins a level on a Settings page go (soft, logged, in one system request): the matrix shows
-- what is true.
select audit.begin('system', 'access.settings_admins_only', null, 'V97: Settings is admins-only');
update core.role_page_level l set deleted_at = pg_catalog.now(), deleted_by = core.system_person_id(),
                                  delete_reason = 'V97: Settings is admins-only'
where authz.is_settings_page(l.page_key) and l.deleted_at is null and l.level <> 'none'
  and not exists (select 1 from core.role r where r.id = l.role_id and r.is_admin);
update core.person_page_level l set deleted_at = pg_catalog.now(), deleted_by = core.system_person_id(),
                                    delete_reason = 'V97: Settings is admins-only'
where authz.is_settings_page(l.page_key) and l.deleted_at is null and l.level <> 'none';
select audit.end();
create trigger settings_admins_only before insert or update on core.role_page_level
  for each row execute function core.settings_level_guard();
create trigger settings_admins_only before insert or update on core.person_page_level
  for each row execute function core.settings_level_guard();
