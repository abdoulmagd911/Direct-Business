-- Mutant m24-ntf-dept-kind-ignored: a kind switched off for the company or department still notifies
CREATE OR REPLACE FUNCTION notify.may_notify(p_person uuid, p_kind text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select true
           and not coalesce((select (pr.notify -> p_kind) = 'false'::jsonb
                                    or (pr.notify -> p_kind -> 'in_app') = 'false'::jsonb
                             from core.person_profile pr where pr.person_id = p.id), false)
    from core.person p
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null), false)
$function$
;
