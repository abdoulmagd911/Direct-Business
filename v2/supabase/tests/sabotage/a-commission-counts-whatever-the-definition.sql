-- Sabotage: a-commission-counts-whatever-the-definition
-- Breaks: sql:FMS-02
-- Expect: with commissions off, the commission invoice leaves
-- Commercial revenue counts a commission invoice even when the definition leaves commissions out (V4, V501).
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
  if false then
    return null;
  end if;
  if pg_catalog.cardinality(types) > 0
     and not exists (select 1 from partner.side_type t
                     where t.id = measure.unit_segment(p_invoice, p_unit_kind, p_month, p_partner)
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
