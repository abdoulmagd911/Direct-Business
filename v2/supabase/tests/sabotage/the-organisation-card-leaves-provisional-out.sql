-- Sabotage: the-organisation-card-leaves-provisional-out
-- Breaks: sql:PMC-01
-- Expect: the organisation's month: its paid units, the Provisional part beside them, the Loss counted, the unpaid one left out
-- An organisation's months count its Final units only and leave the Provisional ones out (V611).
create or replace view finance.partner_month with (security_invoker = true) as
select r.partner_id, r.month_on, pg_catalog.count(*)::int as units, sum(r.revenue) as revenue, sum(r.cost) as cost,
       sum(r.profit) as profit, (pg_catalog.count(*) filter (where r.provisional))::int as provisional_units,
       coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
       (pg_catalog.count(*) filter (where r.loss))::int as losses,
       sum(r.estimate) as estimate
from finance.money_row r
where r.counted and r.partner_id is not null and not r.provisional
group by r.partner_id, r.month_on;
