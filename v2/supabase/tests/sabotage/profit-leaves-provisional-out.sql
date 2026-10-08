-- Sabotage: profit-leaves-provisional-out
-- Breaks: sql:FRD-01
-- Expect: the period counts every paid unit, the Provisional part beside it
-- The period figures count Final units only and leave the Provisional ones out (V611, the screens brief F17).
create or replace function finance.period_figures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', p_from::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', p_to::timestamp)::date;
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with r as (select * from finance.money_row x where x.counted and not x.provisional and x.month_on between m0 and m1)
    select pg_catalog.jsonb_build_object(
      'from', m0, 'to', m1,
      'units', (select pg_catalog.count(*) from r),
      'revenue', (select coalesce(sum(r.revenue), 0) from r),
      'cost', (select coalesce(sum(r.cost), 0) from r),
      'profit', (select coalesce(sum(r.profit), 0) from r),
      'provisional', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from r where r.provisional),
        'revenue', (select coalesce(sum(r.revenue), 0) from r where r.provisional),
        'cost', (select coalesce(sum(r.cost), 0) from r where r.provisional),
        'profit', (select coalesce(sum(r.profit), 0) from r where r.provisional)),
      'losses', (select pg_catalog.count(*) from r where r.loss),
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on)
                          from finance.money_month m where m.month_on between m0 and m1), '[]'::jsonb))
  );
end
$$;
