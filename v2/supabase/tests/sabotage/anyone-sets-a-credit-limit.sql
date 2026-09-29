-- Sabotage: anyone-sets-a-credit-limit
-- Breaks: sql:CRL-01
-- Expect: a member without credit control cannot set a limit
-- Credit limits are set by anyone who can edit a partner.
create or replace function partner.credit_limit_set(p_partner uuid, p_amount numeric, p_effective_from date, p_approved_by uuid,
                                         p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  me uuid := authz.me();
  why text := core.access_reason(p_reason);
  req uuid;
  cid uuid;
begin
  if p_approved_by is null or not exists (select 1 from core.person x where x.id = p_approved_by and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'credit.approver_required';
  end if;
  req := audit.begin('ui', 'credit_limit.set', null, why);
  update partner.credit_limit set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
  where partner_id = p_partner and effective_from = coalesce(p_effective_from, core.riyadh_today()) and deleted_at is null;
  insert into partner.credit_limit (partner_id, amount_sar, effective_from, approved_by, reason)
  values (p_partner, p_amount, coalesce(p_effective_from, core.riyadh_today()), p_approved_by, why)
  returning id into cid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
exception when check_violation then
  raise exception using errcode = 'P0001', message = 'credit.amount_invalid';
end
$$;
