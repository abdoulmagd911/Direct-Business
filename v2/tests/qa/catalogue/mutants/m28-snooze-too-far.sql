-- Mutant m28-snooze-too-far: snooze accepts more than 30 days
CREATE OR REPLACE FUNCTION notify.snooze(p_ids uuid[], p_until timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_until is null or p_until <= core.clock() then
    raise exception using errcode = 'P0001', message = 'notify.snooze_in_the_past';
  end if;
  if p_until > core.clock() + interval '30 days' then
    null;
  end if;
  update notify.notification set snoozed_until = p_until where person_id = me and id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end
$function$
;
