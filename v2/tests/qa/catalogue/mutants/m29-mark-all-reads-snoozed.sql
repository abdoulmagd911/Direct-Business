-- Mutant m29-mark-all-reads-snoozed: Mark all read also marks snoozed (hidden) notifications
CREATE OR REPLACE FUNCTION notify.mark_read(p_ids uuid[] DEFAULT NULL::uuid[])
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
  update notify.notification set read_at = core.clock()
  where person_id = me and read_at is null
    and (id = any (p_ids) or p_ids is null);
  get diagnostics n = row_count;
  return n;
end
$function$
;
