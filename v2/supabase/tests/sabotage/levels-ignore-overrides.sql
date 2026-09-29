-- Sabotage: levels-ignore-overrides
-- Breaks: sql:ACC-01
-- Expect: the person's override wins over the role
-- A person's level comes from their role alone; the override an admin set is never read.
create or replace function authz.level_of(p_person uuid, p_page text) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
             when r.is_admin then (select pg_catalog.max(l) from pg_catalog.unnest(pg.levels_allowed) l)
             else coalesce((select l.level from core.role_page_level l
                             where l.role_id = p.role_id and l.page_key = pg.key and l.deleted_at is null), 'none')
           end
    from core.person p
    join core.page pg on pg.key = p_page and pg.active
    left join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
  ), 'none'::core.level)
$$;
