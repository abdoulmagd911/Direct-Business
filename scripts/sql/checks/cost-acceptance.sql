-- READ-ONLY acceptance check for the cost import (D24): 2026 by the paid date (D21 — invoice_date holds it for a paid
-- invoice), paid B2B sales only (money_that_counts: no top-ups, no billing links, no excluded companies such as Takamol).
-- Run after the real Payments exports are imported in the browser, and compare with the oversight's reference figures
-- (kept out of this public repository — rule 7). Nothing is written.
--   cost_approved  = approved expense lines only (cost_sar)
--   cost_with_est  = approved lines, else the Revenue Report's submitted expenses, else the D23 pass-through lines
--   rev_no_cost    = revenue with neither an approved cost nor an estimate (mostly commissions)
with m as (
  select invoice_date, revenue_sar, cost_sar, est_cost_sar, revenue_way
  from public.money_that_counts
  where invoice_date >= date '2026-01-01' and invoice_date < date '2027-01-01'
)
select coalesce('Q' || extract(quarter from invoice_date)::int, '2026') as period,
       round(sum(revenue_sar), 0)                                                    as revenue,
       round(sum(cost_sar), 0)                                                       as cost_approved,
       round(sum(coalesce(cost_sar, est_cost_sar)), 0)                               as cost_with_est,
       round(sum(revenue_sar) - sum(coalesce(cost_sar, est_cost_sar)), 0)            as profit_with_est,
       round(100 * (sum(revenue_sar) - sum(coalesce(cost_sar, est_cost_sar))) / nullif(sum(revenue_sar), 0), 1) as margin_pct,
       round(sum(revenue_sar) filter (where cost_sar is null and est_cost_sar is null), 0) as rev_no_cost,
       count(*)                                                                      as invoices
from m
group by rollup (extract(quarter from invoice_date))
order by period;
