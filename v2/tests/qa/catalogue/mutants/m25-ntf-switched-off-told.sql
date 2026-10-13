-- Mutant m25-ntf-switched-off-told: a person who may not sign in is still told
CREATE OR REPLACE FUNCTION notify.may_notify(p_person uuid, p_kind text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select coalesce(core.setting_at('notify.kinds_enabled', p.department_id, core.riyadh_today()) ? p_kind, true)
           and not coalesce((select (pr.notify -> p_kind) = 'false'::jsonb
                                    or (pr.notify -> p_kind -> 'in_app') = 'false'::jsonb
                             from core.person_profile pr where pr.person_id = p.id), false)
    from core.person p
    where p.id = p_person and p.kind = 'staff' and p.deleted_at is null), false)
$function$
;
