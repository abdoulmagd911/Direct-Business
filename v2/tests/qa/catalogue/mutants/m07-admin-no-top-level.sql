-- Mutant m07-admin-no-top-level: the admin role no longer gets the top level on every page
CREATE OR REPLACE FUNCTION authz.level_of(p_person uuid, p_page text)
 RETURNS core.level
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select case
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
$function$
;
