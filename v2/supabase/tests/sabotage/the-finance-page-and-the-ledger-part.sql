-- Sabotage: the-finance-page-and-the-ledger-part
-- Breaks: sql:RCN-01
-- Expect: the two sides say the same four figures
-- The Finance page's own figures lose 100 of cost that the Ledger keeps: the two sides part.
alter function finance.period_figures(date, date) rename to period_figures_real;
create function finance.period_figures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  a jsonb;
begin
  perform authz.require('finance', 'view');
  a := finance.period_figures_real(p_from, p_to);
  return pg_catalog.jsonb_set(a, '{cost}', pg_catalog.to_jsonb((a ->> 'cost')::numeric - 100));
end
$$;
grant execute on function finance.period_figures(date, date) to authenticated;
