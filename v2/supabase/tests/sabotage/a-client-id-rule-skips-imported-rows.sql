-- Sabotage: a-client-id-rule-skips-imported-rows
-- Breaks: sql:LST-01
-- Expect: the Overview drops the same row
-- The Overview counts an imported row the exclusion list catches.
create or replace function finance.period_figures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with import_base as (
      select r.id, r.record_date, r.revenue_sar, r.cost_sar, r.profit_sar
      from finance.import_unit r
      where r.fully_paid and not r.promo_pool
        and r.record_date between p_from and p_to
        and not exists (select 1 from finance.money_row m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = r.partner_id and m.unit_kind = r.mapped_kind and m.ref = r.number)
    ),
    r as (
      select x.month_on, x.revenue, x.cost, x.profit, x.provisional, x.loss, x.estimate
      from finance.money_row x where x.counted and x.created_on between p_from and p_to
      union all
      select pg_catalog.date_trunc('month', i.record_date::timestamp)::date as month_on,
             i.revenue_sar as revenue, i.cost_sar as cost, i.profit_sar as profit,
             (i.cost_sar is null) as provisional, (i.profit_sar < 0) as loss, null::numeric as estimate
      from import_base i
    ),
    months as (
      select r.month_on, count(*)::int as units, sum(r.revenue) as revenue,
             coalesce(sum(r.cost) filter (where not r.provisional), 0) as cost,
             coalesce(sum(r.profit) filter (where not r.provisional), 0) as profit,
             count(*) filter (where r.provisional)::int as provisional_units,
             coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
             coalesce(sum(r.profit) filter (where r.provisional), 0) as provisional_profit,
             count(*) filter (where r.loss)::int as losses
      from r group by r.month_on
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'units', (select pg_catalog.count(*) from r),
      'revenue', (select coalesce(sum(r.revenue), 0) from r),
      'cost', (select coalesce(sum(r.cost) filter (where not r.provisional), 0) from r),
      'profit', (select coalesce(sum(r.profit) filter (where not r.provisional), 0) from r),
      'provisional', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from r where r.provisional),
        'revenue', (select coalesce(sum(r.revenue), 0) from r where r.provisional),
        'cost', (select case when pg_catalog.count(*) filter (where r.provisional) = 0 then 0::numeric
                             else null::numeric end from r),
        'profit', (select coalesce(sum(r.profit), 0) from r where r.provisional)),
      'losses', (select pg_catalog.count(*) from r where r.loss),
      'estimate', (select sum(r.estimate) from r where r.estimate is not null),
      'estimated_units', (select pg_catalog.count(*) from r where r.estimate is not null),
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on)
                          from months m), '[]'::jsonb))
  );
end
$$;
