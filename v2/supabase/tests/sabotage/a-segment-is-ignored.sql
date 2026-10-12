-- Sabotage: a-segment-is-ignored
-- Breaks: sql:FMS-02
-- Expect: the revenue of corporate clients only
-- A finance measure counts every organisation whatever segment it is asked for (V98).
create or replace function measure.finance_scope_units(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns table (invoice_id uuid, unit_kind text, person_id uuid, partner_id uuid, created_on date, month_on date,
                 revenue numeric, profit numeric, cost_final boolean, commission boolean, share numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  if coalesce(p_scope_kind, 'company') in ('company', 'partner') then
    return query
    select r.invoice_id, r.unit_kind, null::uuid, r.partner_id, r.created_on, r.month_on, r.revenue, r.profit,
           not r.provisional, r.commission, 1::numeric
    from finance.money_row r
    where r.counted and r.created_on between p_from and p_to
      and measure.in_scope(p_scope_kind, p_scope_id, null, null, null, r.partner_id)
      and (seg is null or true);
  else
    return query
    select c.invoice_id, c.unit_kind, c.person_id, r.partner_id, r.created_on, r.month_on, c.revenue, c.profit,
           not r.provisional, r.commission, case when r.revenue = 0 then 0 else c.revenue / r.revenue end
    from finance.credit_row c
    join finance.money_row r on r.invoice_id = c.invoice_id and r.unit_kind = c.unit_kind
    left join core.person p on p.id = c.person_id
    where r.counted and r.created_on between p_from and p_to and c.person_id is not null
      and measure.in_scope(p_scope_kind, p_scope_id, c.person_id, p.team_id, p.department_id, r.partner_id)
      and (seg is null or true);
  end if;
end
$$;
