-- Mutant m08-admin-no-capabilities: the admin role no longer holds every capability
CREATE OR REPLACE FUNCTION authz.can_of(p_person uuid, p_capability text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select case
             when false then true
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
$function$
;
