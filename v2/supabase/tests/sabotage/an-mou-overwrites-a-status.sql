-- Sabotage: an-mou-overwrites-a-status
-- Breaks: sql:ACH-09
-- Expect: an Active side stays Active
-- An MoU sets Prospect over a status the side already has (V461, V521).
create or replace function perf.mou_prospect(p_partner uuid, p_side text, p_on date) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_partner is null or p_side is null or false and exists (
       select 1 from partner.side_status_change s where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null) then
    return;
  end if;
  perform partner.side_status_set(p_partner, p_side, 'prospect', coalesce(p_on, core.riyadh_today()), null, 'MoU signed');
end
$$;
