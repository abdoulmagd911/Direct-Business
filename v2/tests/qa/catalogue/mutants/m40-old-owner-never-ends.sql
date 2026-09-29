-- Mutant m40-old-owner-never-ends: a new owner does not end the previous owner's time
CREATE OR REPLACE FUNCTION partner.side_owner_set_inner(p_id uuid, p_side text, p_person uuid, p_from date, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  cur partner.side_owner;
begin
  if p_person is not null and not exists (select 1 from core.person x where x.id = p_person and x.kind = 'staff'
                                          and x.active and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into cur from partner.side_owner m
  where m.partner_id = p_id and m.side = p_side and m.deleted_at is null and m.effective_from <= p_from
    and (m.effective_to is null or m.effective_to > p_from);
  if cur.id is not null and cur.person_id is not distinct from p_person then
    return;
  end if;
  if false then
    if cur.effective_from = p_from then
      update partner.side_owner set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
      where id = cur.id;
    else
      update partner.side_owner set effective_to = p_from where id = cur.id;
    end if;
  end if;
  if p_person is not null then
    begin
      insert into partner.side_owner (partner_id, side, person_id, effective_from, reason)
      values (p_id, p_side, p_person, p_from, p_reason);
    exception when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'partner.owner_later_change';
    end;
  end if;
end
$function$
;
