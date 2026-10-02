-- Mutant m01-signin-unlisted-allowed: sign-in pre-check answers allowed for an e-mail nobody holds
CREATE OR REPLACE FUNCTION core.sign_in_state(p_email text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select case when p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                then 'allowed' else 'switched_off' end
    from core.person_email e join core.person p on p.id = e.person_id
    where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null), 'allowed')
$function$
;
