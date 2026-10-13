-- Mutant m09-cleared-override-still-counts: a cleared (removed) level override still wins over the role
CREATE OR REPLACE FUNCTION authz.level_of(p_person uuid, p_page text)
 RETURNS core.level
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select case
             when r.is_admin then (select pg_catalog.max(l) from pg_catalog.unnest(pg.levels_allowed) l)
             when authz.is_settings_page(pg.key) then 'none'::core.level
             else coalesce(
               (select l.level from core.person_page_level l
                 where l.person_id = p.id and l.page_key = pg.key),
               (select l.level from core.role_page_level l
                 where l.role_id = p.role_id and l.page_key = pg.key and l.deleted_at is null),
               'none'::core.level)
           end
    from core.person p
    join core.page pg on pg.key = p_page and pg.active
    left join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
  ), 'none'::core.level)
$function$
;
