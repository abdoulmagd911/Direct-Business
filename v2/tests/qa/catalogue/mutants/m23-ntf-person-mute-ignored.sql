-- Mutant m23-ntf-person-mute-ignored: a kind a person turned off in My profile still reaches them
CREATE OR REPLACE FUNCTION notify.may_notify(p_person uuid, p_kind text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select coalesce(core.setting_at('notify.kinds_enabled', p.department_id, core.riyadh_today()) ? p_kind, true)
    from core.person p
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null), false)
$function$
;
