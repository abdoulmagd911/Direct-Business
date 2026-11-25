-- Sabotage: allowed-does-not-reach-a-sides-file
-- Breaks: sql:XTR-06
-- Expect: and they move the review date of the file on a colleague's client
-- A file on an organisation's side looks at the side's owners only, as before Landing 51.
CREATE OR REPLACE FUNCTION core.file_may_change(p_file uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
begin
  if me is null then
    return false;
  end if;
  return authz.is_admin()
      or exists (select 1 from core.file f where f.id = p_file and f.created_by = me)
      or exists (select 1 from core.file_link l
                 where l.file_id = p_file and l.deleted_at is null and l.purpose <> 'avatar'
                   and case when l.side is not null
                            then partner.level_of(me, l.entity_id, l.side) = 'full'
                                 or (partner.level_of(me, l.entity_id, l.side) >= 'own'
                                     and me in (select partner.side_owners(l.entity_id, l.side)))
                            else core.may_write(l.entity_table, l.entity_id) end);
end
$function$;
