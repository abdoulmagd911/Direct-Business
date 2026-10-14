-- Sabotage: a-closed-month-commercial-part-reads-the-segment-live
-- Breaks: sql:FCL-05
-- Expect: commercial revenue for corporate clients keeps the closed month's unit
-- Commercial revenue limited to some Client types reads a closed month's unit by its organisation's type now
-- (QA-546, V620).
create or replace function measure.finance_commercial_part(p_invoice uuid, p_unit_kind text, p_partner uuid, p_month date,
                                                p_revenue numeric, p_profit numeric, p_commission boolean,
                                                p_share numeric) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  d jsonb := coalesce(core.setting_at('finance.revenue_definition', null, p_month), '{}'::jsonb);
  margin boolean := coalesce(d ->> 'basis', 'revenue') = 'margin';
  services text[] := array(select pg_catalog.jsonb_array_elements_text(coalesce(d -> 'services', '[]'::jsonb)));
  types text[] := array(select pg_catalog.jsonb_array_elements_text(coalesce(d -> 'client_types', '[]'::jsonb)));
begin
  if p_commission and not coalesce((d ->> 'commissions')::boolean, true) then
    return null;
  end if;
  if pg_catalog.cardinality(types) > 0
     and not exists (select 1 from partner.side_type t
                     where t.id = measure.client_segment(p_partner)
                       and t.key = any (types)) then
    return null;
  end if;
  if pg_catalog.cardinality(services) = 0 then
    return case when margin then p_profit else p_revenue end;
  end if;
  return (select coalesce(sum(case when margin then s.revenue - s.cost else s.revenue end), 0) * p_share
          from finance.money_service_row s join finance.service v on v.id = s.service_id
          where s.invoice_id = p_invoice and s.unit_kind = p_unit_kind and s.part = 'service' and v.key = any (services));
end
$$;
