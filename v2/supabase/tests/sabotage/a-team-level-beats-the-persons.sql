-- Sabotage: a-team-level-beats-the-persons
-- Breaks: sql:ACC-10
-- Expect: the person's own override beats the team
-- The team's level is read before the person's own override (V510).
create or replace function authz.level_of(p_person uuid, p_page text) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
             when r.is_admin then (select pg_catalog.max(l) from pg_catalog.unnest(pg.levels_allowed) l)
             when authz.is_settings_page(pg.key) then 'none'::core.level
             else coalesce(
               (select pg_catalog.max(l.level) from core.team_page_level l join core.team t on t.id = l.team_id
                 where l.page_key = pg.key and l.deleted_at is null and t.active
                   and (l.team_id = p.team_id
                        or exists (select 1 from core.person_team_assist a
                                   where a.person_id = p.id and a.team_id = l.team_id and a.deleted_at is null))),
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
