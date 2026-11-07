-- Phase 7 — Finance Overview cost-provisional change (rulebook §16, CUJ 8). A Fully Paid unit whose cost is
-- provisional (cost_status = 'provisional') counts per figure: its Revenue counts in the Revenue total, it is
-- excluded from the Cost total (its cost is empty, never 0) and excluded from the Profit total, shown apart as
-- Provisional — the same behaviour as the Finance report (the unified ledger read), where a row with no approved
-- cost carries no cost at all and its profit is empty. The period's units still count every counted unit, so a
-- period of only cost-provisional units is never misread as "nothing imported yet".
--
-- Changed here, and only here: finance.money_month (the months rows) and finance.period_figures (the period
-- totals, whose months come from that view). The provisional cost answers null while any provisional unit exists
-- (there is no cost figure to show) and 0 when none exists (nothing provisional, so the part is genuinely 0).
-- api.finance_closed_months returns frozen snapshots and is unchanged. No signature changes, so the grants and
-- the generated types are untouched; no new function, so no grants. Forward-only (V103): nothing already on
-- v2/main is edited here. Regression test: OVP-01.
--
-- Note: this deliberately differs from the ledger on one case — a provisional unit with some expense already
-- approved (approved and pending at once) is excluded from the Overview cost and profit entirely, while the
-- ledger still counts its approved-so-far cost. CUJ 8 states the rule by cost_status, so the Overview follows
-- it; the ledger is not changed by this migration.

-- Per month: the counted units' revenue over every unit, cost and profit over the costed units only, and the
-- Provisional units' revenue and profit beside them — never left out (V611); losses counted (V414).
create or replace view finance.money_month with (security_invoker = true) as
select r.month_on, count(*)::int as units, sum(r.revenue) as revenue,
       coalesce(sum(r.cost) filter (where not r.provisional), 0) as cost,
       coalesce(sum(r.profit) filter (where not r.provisional), 0) as profit,
       count(*) filter (where r.provisional)::int as provisional_units,
       coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
       coalesce(sum(r.profit) filter (where r.provisional), 0) as provisional_profit,
       count(*) filter (where r.loss)::int as losses
from finance.money_row r
where r.counted
group by r.month_on;
comment on view finance.money_month is
  'Per month (V611): revenue over every counted unit; cost and profit over the costed units only — a unit whose cost is provisional is excluded from both and shown apart as Provisional, its cost empty, never 0 (rulebook §16, Phase 7).';

-- The counted units of the months from p_from to p_to (created month, V610): revenue over every paid unit, cost and
-- profit over the costed units only, the Provisional part of each beside it, and the same per month.
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
    with r as (select * from finance.money_row x where x.counted and x.month_on between m0 and m1)
    select pg_catalog.jsonb_build_object(
      'from', m0, 'to', m1,
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
                          from finance.money_month m where m.month_on between m0 and m1), '[]'::jsonb))
  );
end
$$;
