-- Sabotage: income-by-service-drops-what-the-lines-do-not-cover
-- Breaks: sql:D24-01
-- Expect: each line to one service; not income on its own row; the wallet line left out; the rest Not split by line
-- Income by service leaves out what the lines do not cover, so the services no longer add up to the revenue tile (D24, OA5).
create or replace view finance.money_service_row with (security_invoker = true) as
with u as (
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.cost, r.provisional
  from finance.money_row r where r.counted
),
lines as (
  select u.invoice_id, u.unit_kind,
         case when x.service_id is null then 'no_service' when x.counts_as_income then 'service' else 'not_income' end
           as part,
         x.service_id, x.total_sar
  from u join finance.line_service x on x.invoice_id = u.invoice_id and not x.wallet
  where u.unit_kind <> 'monthly_fee'
),
parts as (
  select l.invoice_id, l.unit_kind, l.part, l.service_id, sum(l.total_sar) as revenue
  from lines l group by l.invoice_id, l.unit_kind, l.part, l.service_id
  union all
  select u.invoice_id, u.unit_kind, 'not_split', null,
         u.revenue - coalesce((select sum(l.total_sar) from lines l
                               where l.invoice_id = u.invoice_id and l.unit_kind = u.unit_kind), 0)
  from u
),
shared as (
  select p.*, u.ref, u.month_on, u.provisional, u.cost as unit_cost, u.revenue as unit_revenue,
         pg_catalog.round(u.cost * case when u.revenue = 0 then 0 else p.revenue / u.revenue end, 2) as cost_part,
         pg_catalog.row_number() over (partition by p.invoice_id, p.unit_kind
                                       order by pg_catalog.abs(p.revenue) desc, p.part, p.service_id) as k
  from parts p join u on u.invoice_id = p.invoice_id and u.unit_kind = p.unit_kind
  where p.part <> 'not_split' and p.revenue <> 0 or not exists (
    select 1 from lines l where l.invoice_id = p.invoice_id and l.unit_kind = p.unit_kind)
)
select s.invoice_id, s.unit_kind, s.ref, s.month_on, s.provisional, s.part, s.service_id, s.revenue,
       s.cost_part + case when s.k = 1 then s.unit_cost - sum(s.cost_part) over (partition by s.invoice_id, s.unit_kind)
                          else 0 end as cost
from shared s;
