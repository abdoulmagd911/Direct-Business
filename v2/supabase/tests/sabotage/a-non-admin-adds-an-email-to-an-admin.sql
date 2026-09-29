-- Sabotage: a-non-admin-adds-an-email-to-an-admin
-- Breaks: sql:ADM-01
-- Expect: a non-admin puts no e-mail on an admin's person
-- The world before V97: the admin check is Full on Settings → Organization & access, a person's override can give it,
-- and nothing refuses that override.
drop trigger settings_admins_only on core.person_page_level;
create or replace function authz.require_admin() returns uuid
language sql stable security definer set search_path = ''
as $$ select authz.require('settings.org', 'full') $$;
create or replace function authz.level_of(p_person uuid, p_page text) returns core.level
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
