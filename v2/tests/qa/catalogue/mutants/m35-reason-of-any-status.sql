-- Mutant m35-reason-of-any-status: a status takes a reason from another status's list
CREATE OR REPLACE FUNCTION partner.side_status_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and (new.partner_id, new.side, new.status, new.effective_on, new.reason_id, new.note)
     is distinct from (old.partner_id, old.side, old.status, old.effective_on, old.reason_id, old.note) then
    raise exception using errcode = 'P0001', message = 'partner.status_never_rewritten',
      detail = 'Add a new change with its own date instead.';
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from partner.partner_side s where s.partner_id = new.partner_id
                                      and s.side = new.side and s.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = new.side;
  end if;
  if new.reason_id is not null
     and not exists (select 1 from partner.side_status_reason r where r.id = new.reason_id and r.status = new.status) then
    null;
  end if;
  return new;
end
$function$
;
